import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { obfuscate } from '../lib/obfuscator.js';

/**
 * POST /api/create_script
 *
 * Now does SERVER-SIDE obfuscation:
 *   - Accepts `original_code` (Luau source) from client
 *   - Runs obfuscate() with server-controlled options
 *   - Stores the obfuscated result in Supabase
 *   - Returns the obfuscated code + script ID
 *
 * Server-side obfuscation is required for:
 *   - Trust (client can't fake the output)
 *   - Anti-fetch (protection logic stays on your server)
 *   - Quota enforcement (can't be bypassed by tampering with browser)
 */

// Size limits. Vercel caps body at 4.5MB, so we leave headroom.
// A 1MB Luau script typically expands to 2-4MB after string encryption.
const MAX_ORIGINAL_BYTES     = 1024 * 1024;      // 1 MB safe on Vercel
const MAX_OBFUSCATED_BYTES   = 4 * 1024 * 1024;  // 4 MB response cap
const FREE_WEEKLY_LIMIT      = 20;

function bytesOf(str) {
    return Buffer.byteLength(str, 'utf8');
}

export default async function handler(req, res) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase environment variables are missing!' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const api_key        = req.body?.api_key || req.query?.api_key;
    const name           = req.body?.name || req.query?.name;
    const keyless        = req.body?.keyless === true || req.query?.keyless === 'true';
    const originalCode   = req.body?.original_code;   // <-- Luau source, not obfuscated
    const obf_version    = req.body?.obf_version || 'v4.0';
    const store_original = req.body?.store_original === true;

    // Options that control protection strength. Client can request, but
    // server decides defaults. `cff` defaults ON now — it's safe after the
    // v4.0 rewrite (bails on unsafe code).
    const options = {
        strings:     req.body?.options?.strings     !== false,  // default ON
        cff:         req.body?.options?.cff         === true,   // default OFF (opt-in)
        antiTamper:  req.body?.options?.antiTamper  === true,   // default OFF (opt-in)
        hostile:     false,                                     // NEVER from client
        heartbeat:   false,                                     // NEVER from client
    };

    if (!api_key) return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
    if (req.method !== 'POST') return res.status(400).json({ error: 'Invalid method' });

    if (typeof originalCode !== 'string' || originalCode.length === 0) {
        return res.status(400).json({ error: 'No original_code provided' });
    }
    if (bytesOf(originalCode) > MAX_ORIGINAL_BYTES) {
        return res.status(413).json({
            error: `Script too large. Max ${MAX_ORIGINAL_BYTES / 1024} KB on this endpoint. ` +
                   `Contact support for 10 MB+ uploads.`
        });
    }

    try {
        // ---- Step 1: Authenticate user ----
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('api_key', api_key)
            .single();

        if (userErr || !user) return res.status(401).json({ error: 'Invalid API key' });

        // ---- Step 2: Quota check (race-safe) ----
        if (user.plan === 'free') {
            const now     = new Date();
            const resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);

            if (now > resetAt) {
                await supabase.from('users').update({
                    obfuscations_used: 0,
                    obfuscation_reset_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                }).eq('api_key', api_key);
                user.obfuscations_used = 0;
            }

            const used = user.obfuscations_used || 0;
            if (used >= FREE_WEEKLY_LIMIT) {
                return res.status(403).json({ error: `Limit reached (${used}/${FREE_WEEKLY_LIMIT}).` });
            }

            const { data: bumped, error: bumpErr } = await supabase
                .from('users')
                .update({ obfuscations_used: used + 1 })
                .eq('api_key', api_key)
                .eq('obfuscations_used', used)
                .select('obfuscations_used')
                .single();

            if (bumpErr || !bumped) {
                return res.status(429).json({ error: 'Concurrent request detected, please retry' });
            }
        }

        // ---- Step 3: Obfuscate (server-side) ----
        let obfuscatedCode;
        try {
            obfuscatedCode = obfuscate(originalCode, options);
        } catch (obfErr) {
            console.error('Obfuscation failed:', obfErr.message);
            return res.status(422).json({
                error: 'Obfuscation failed. Your script may contain unsupported syntax.',
                detail: obfErr.message,
            });
        }

        if (!obfuscatedCode || obfuscatedCode.length === 0) {
            return res.status(500).json({ error: 'Obfuscator returned empty result' });
        }

        if (bytesOf(obfuscatedCode) > MAX_OBFUSCATED_BYTES) {
            return res.status(413).json({
                error: 'Obfuscated output exceeds size limit. Try a smaller script or disable CFF.'
            });
        }

        // ---- Step 4: Store in Supabase ----
        const cleanId = crypto.randomBytes(16).toString('hex');

        const { data: newScript, error: insertErr } = await supabase
            .from('scripts')
            .insert({
                id: cleanId,
                api_key: api_key,
                name: name || 'Untitled Script',
                lua_code: obfuscatedCode,           // legacy column, holds Luau
                original_code: store_original ? (originalCode || null) : null,
                keyless: keyless,
                obf_version: obf_version,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        // ---- Step 5: Return both ID and obfuscated code ----
        // Returning the obfuscated code lets the client download it directly,
        // but the canonical copy lives in Supabase (served via raw.js).
        return res.status(200).json({
            success: true,
            script: newScript,
            id: newScript.id,
            obfuscated_code: obfuscatedCode,
            input_size: bytesOf(originalCode),
            output_size: bytesOf(obfuscatedCode),
        });

    } catch (err) {
        console.error('Create Script Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
