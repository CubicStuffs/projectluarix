import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * POST /api/create_script
 *
 * Front-end sends the already-obfuscated code (obfuscation runs client-side).
 * This endpoint: (a) validates user + quota, (b) sanity-checks the submitted
 * JS is parseable, (c) stores the script in Supabase.
 *
 * Changes vs prior version:
 *   - Race-safe quota increment (optimistic lock via .eq on obfuscations_used)
 *   - Body-size caps (200 KB obfuscated, 400 KB original)
 *   - JS parse check with ESM escape hatch (import/export → skip check)
 *   - obf_version default fixed to 'v2.5'
 *   - original_code storage is opt-in (only if request explicitly sets store_original: true)
 *   - clearer 4xx error payloads
 */

const MAX_OBF_BYTES     = 200 * 1024;
const MAX_ORIGINAL_BYTES = 400 * 1024;
const FREE_WEEKLY_LIMIT = 20;

function looksLikeESM(code) {
  return /(^|\n)\s*(import\s+[\w{*]|export\s+(default|const|let|var|function|class|\{))/.test(code);
}

function isParseableScript(code) {
  // ESM cannot be compiled with new Function(); skip the check for it.
  if (looksLikeESM(code)) return true;
  try {
    // Constructs a Function but does NOT execute it — safe for validation.
    // eslint-disable-next-line no-new-func
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase environment variables are missing!' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const api_key        = req.body?.api_key || req.query?.api_key;
    const name           = req.body?.name || req.query?.name;
    const keyless        = req.body?.keyless === true || req.query?.keyless === 'true';
    const obfuscatedCode = req.body?.obfuscated_code;
    const originalCode   = req.body?.original_code;
    const obf_version    = req.body?.obf_version || 'v2.5';
    // Default OFF: only store the plaintext source if the caller explicitly opts in.
    const store_original = req.body?.store_original === true;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
    if (req.method !== 'POST') return res.status(400).json({ error: 'Invalid method' });

    if (typeof obfuscatedCode !== 'string' || obfuscatedCode.length === 0) {
        return res.status(400).json({ error: 'No obfuscated code provided' });
    }
    if (obfuscatedCode.length > MAX_OBF_BYTES) {
        return res.status(413).json({ error: `Obfuscated code too large (max ${MAX_OBF_BYTES} bytes)` });
    }
    if (store_original && typeof originalCode === 'string' && originalCode.length > MAX_ORIGINAL_BYTES) {
        return res.status(413).json({ error: `Original code too large (max ${MAX_ORIGINAL_BYTES} bytes)` });
    }
    if (!isParseableScript(obfuscatedCode)) {
        return res.status(422).json({ error: 'Submitted obfuscated_code is not valid JavaScript' });
    }

    try {
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('api_key', api_key)
            .single();

        if (userErr || !user) return res.status(401).json({ error: 'Invalid API key' });

        // ---- Free-plan quota (race-safe) ----
        if (user.plan === 'free') {
            const now     = new Date();
            const resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);

            if (now > resetAt) {
                // Window expired — reset. Two requests can race here, but the worst
                // case is both reset, which is idempotent (both write the same fields).
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

            // Optimistic lock: only succeed if obfuscations_used is still what we read.
            const { data: bumped, error: bumpErr } = await supabase
                .from('users')
                .update({ obfuscations_used: used + 1 })
                .eq('api_key', api_key)
                .eq('obfuscations_used', used)   // <-- the lock
                .select('obfuscations_used')
                .single();

            if (bumpErr || !bumped) {
                // Another concurrent request won the race. Safe response: tell
                // the client to retry — do NOT insert the script without consuming quota.
                return res.status(429).json({ error: 'Concurrent request detected, please retry' });
            }
        }

        // ---- Insert ----
        const cleanId = crypto.randomBytes(16).toString('hex');

        const { data: newScript, error: insertErr } = await supabase
            .from('scripts')
            .insert({
                id: cleanId,
                api_key: api_key,
                name: name || 'Untitled Script',
                lua_code: obfuscatedCode,          // legacy column name; holds JS
                original_code: store_original ? (originalCode || null) : null,
                keyless: keyless,
                obf_version: obf_version,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        return res.status(200).json({ success: true, script: newScript, id: newScript.id });
    } catch (err) {
        console.error('Create Script Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
