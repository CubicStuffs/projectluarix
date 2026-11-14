import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { name, code, original_code, api_key, keyless } = req.body;

    if (!name || !code || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
        // ✅ CHANGE 1: select('*') kiya taaki plan aur obfuscations_used mil sake
        let { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).maybeSingle();

        if (!user) {
            const { data: newUser } = await supabase.from('users').insert({ 
                api_key: api_key, 
                email: `temp_${Date.now()}@luarix.com`, 
                plan: 'free',
                obfuscations_used: 0 
            }).select().single();
            user = newUser;
        }

        // ✅ CHANGE 2: Obfuscation Limit Check (Free Plan = 20 Limit)
        if (user && user.plan === 'free') {
            let used = user.obfuscations_used || 0;
            let resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);
            let now = new Date();

            // Agar 7 din (1 week) ho gaye hain, toh limit reset kar do
            if (now > resetAt) {
                used = 0;
                resetAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Aaj se 7 din baad
                await supabase.from('users').update({ obfuscations_used: used, obfuscation_reset_at: resetAt.toISOString() }).eq('api_key', api_key);
            }

            // Agar 20 ho gaye hain, toh block kar do
            if (used >= 20) {
                return res.status(403).json({ error: 'Limit reached (20/20). Resets on ' + resetAt.toLocaleDateString() });
            }

            // Agar limit baaki hai, toh 1 badha do
            await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
        }
        // ---------------------------------------------------

        // Script generate aur save karo
        const id = crypto.randomBytes(16).toString('hex');
        const { error } = await supabase.from('scripts').insert({
            id: id, 
            name: name, 
            lua_code: code, 
            original_code: original_code, 
            api_key: api_key, 
            keyless: keyless || false
        });

        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
