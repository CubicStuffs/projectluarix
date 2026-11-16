import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

export default async function handler(req, res) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase environment variables are missing!' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const api_key = req.body?.api_key || req.query?.api_key;
    const name = req.body?.name || req.query?.name;
    const keyless = req.body?.keyless === true || req.query?.keyless === 'true';
    const obfuscatedCode = req.body?.obfuscated_code; 
    const originalCode = req.body?.original_code;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized: Missing API Key' });

    try {
        if (req.method === 'POST') {
            if (!obfuscatedCode) return res.status(400).json({ error: 'No obfuscated code provided' });

            const { data: user, error: userErr } = await supabase.from('users').select('*').eq('api_key', api_key).single();
            if (userErr || !user) return res.status(401).json({ error: 'Invalid API key' });
            
            if (user.plan === 'free') {
                let used = user.obfuscations_used || 0;
                let resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);
                let now = new Date();
                if (now > resetAt) {
                    used = 0; 
                    resetAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    await supabase.from('users').update({ obfuscations_used: used, obfuscation_reset_at: resetAt.toISOString() }).eq('api_key', api_key);
                }
                if (used >= 20) return res.status(403).json({ error: 'Limit reached (20/20). Resets on ' + resetAt.toLocaleDateString() });
                await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
            }
            
            // 👇 YAHAN CHANGE KIYA HAI (Bina hyphen wali ID banayega) 👇
            const cleanId = crypto.randomBytes(16).toString('hex');

            const { data: newScript, error: insertErr } = await supabase.from('scripts').insert({
                id: cleanId,
                api_key: api_key,
                name: name || 'Untitled Script',
                lua_code: obfuscatedCode, 
                original_code: originalCode,
                keyless: keyless,
                created_at: new Date().toISOString()
            }).select().single();

            if (insertErr) throw insertErr;

            return res.status(200).json({ success: true, script: newScript, id: newScript.id });
        }

        return res.status(400).json({ error: 'Invalid method' });
    } catch (err) {
        console.error("Create Script Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
