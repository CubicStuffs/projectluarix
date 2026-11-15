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
    
    // 👇 Maine yahan 'password' add kar diya hai 👇
    const { action, email, password, paid_key, discord_tag, discord_id, api_key, turnstile_token } = req.body;

    try {
        // ✅ NAYA ADMIN LOGIN CHECK (Secure)
        if (action === 'admin_login') {
            if (!password) return res.status(400).json({ error: 'Password required' });
            
            // Vercel Environment Variable se password check kar raha hai
            if (password === process.env.ADMIN_PASSWORD) {
                return res.status(200).json({ success: true });
            } else {
                return res.status(401).json({ error: 'Incorrect Admin Password' });
            }
        }

        if (action === 'login_apikey') {
            if (!api_key) return res.status(400).json({ error: 'API Key required' });
            const { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).maybeSingle();
            if (!user) return res.status(401).json({ error: 'Invalid API key' });
            return res.status(200).json({ user });
        }

        if (action === 'signup') {
            // ✅ Verify Turnstile Token
            if (!turnstile_token) return res.status(400).json({ error: 'Security check missing.' });
            
            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${process.env.TURNSTILE_SECRET_KEY}&response=${turnstile_token}`
            });
            const verifyData = await verifyRes.json();
            
            if (!verifyData.success) {
                return res.status(400).json({ error: 'Security check failed. Please try again.' });
            }

            if (!email || !discord_id) return res.status(400).json({ error: 'Email and Discord ID required' });
            const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
            if (existing) return res.status(400).json({ error: 'Account with this email already exists' });

            let finalApiKey = paid_key;
            let plan = 'free';

            if (paid_key) {
                if (!paid_key.startsWith('LXR-BASIC-') && !paid_key.startsWith('LXR-PREMIUM-') && !paid_key.startsWith('LXR-PRO-') && !paid_key.startsWith('LXR-ADMIN-')) {
                    return res.status(400).json({ error: 'Invalid Invite Code format' });
                }
                
                if (paid_key.startsWith('LXR-BASIC-')) plan = 'basic';
                else if (paid_key.startsWith('LXR-PREMIUM-')) plan = 'premium';
                else if (paid_key.startsWith('LXR-PRO-')) plan = 'pro';
                else if (paid_key.startsWith('LXR-ADMIN-') || paid_key === 'ADMIN') plan = 'admin';
                
                const { data: keyExists } = await supabase.from('users').select('*').eq('api_key', paid_key).maybeSingle();
                if (keyExists) return res.status(400).json({ error: 'This invite code has already been used' });
            } else {
                finalApiKey = genApiKey('FREE');
            }

            const { data: user, error } = await supabase.from('users').insert({
                email, discord_id, api_key: finalApiKey, plan: plan,
                obfuscations_used: 0, obfuscation_reset_at: new Date().toISOString()
            }).select().single();

            if (error) return res.status(500).json({ error: "Supabase Error: " + error.message });
            return res.status(200).json({ user });
        }
    } catch (err) {
        return res.status(500).json({ error: "Server Error: " + err.message });
    }
}
