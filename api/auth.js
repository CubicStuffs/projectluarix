import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function genApiKey(plan) {
  const planUpper = (plan || 'FREE').toUpperCase();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[crypto.randomInt(0, chars.length)];
  return `LXR-${planUpper}-${out}`;
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { action, email, password, paid_key, discord_tag, discord_id, api_key } = req.body;

    try {
        if (action === 'login_apikey') {
            if (!api_key) return res.status(400).json({ error: 'API Key required' });
            const { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).maybeSingle();
            if (!user) return res.status(401).json({ error: 'Invalid API key' });
            return res.status(200).json({ user });
        }

        if (action === 'signup') {
            if (!email || !discord_id) return res.status(400).json({ error: 'Email and Discord ID required' });
            const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
            if (existing) return res.status(400).json({ error: 'Account with this email already exists' });

            let finalApiKey = paid_key;
            let plan = 'free';

            if (paid_key) {
                if (!paid_key.startsWith('LXR-BASIC-') && !paid_key.startsWith('LXR-PREMIUM-') && !paid_key.startsWith('LXR-ADMIN-')) {
                    return res.status(400).json({ error: 'Invalid Invite Code format' });
                }
                plan = paid_key.startsWith('LXR-BASIC-') ? 'basic' : (paid_key.startsWith('LXR-PREMIUM-') ? 'premium' : 'admin');
                const { data: keyExists } = await supabase.from('users').select('*').eq('api_key', paid_key).maybeSingle();
                if (keyExists) return res.status(400).json({ error: 'This invite code has already been used' });
            } else {
                finalApiKey = genApiKey('FREE');
            }

            const { data: user, error } = await supabase.from('users').insert({
                email, discord_id, api_key: finalApiKey, plan: plan, usage: 0,
                obfuscations_used: 0, obfuscation_reset_at: new Date().toISOString()
            }).select().single();

            if (error) return res.status(500).json({ error: "Supabase Error: " + error.message });
            return res.status(200).json({ user });
        }
        
        // Purane functions (Discord OAuth ke liye) waise hi rahenge...
        if (action === 'free') { /* ... */ }
        if (action === 'link_paid') { /* ... */ }
    } catch (err) {
        return res.status(500).json({ error: "Server Error: " + err.message });
    }
}
