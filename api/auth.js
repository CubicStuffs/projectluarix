import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { action, email, password, paid_key, discord_tag, discord_id } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        if (action === 'login') {
            const { data: user } = await supabase.from('users').select('*').eq('email', email).eq('password', password).maybeSingle();
            if (!user) return res.status(401).json({ error: 'Invalid email or password' });
            return res.status(200).json({ user });
        }

        if (action === 'signup') {
            const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
            if (existing) return res.status(400).json({ error: 'Account already exists' });

            const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
            const newKey = `LXR-FREE-${randomHex}`;

            const { data: user, error } = await supabase.from('users').insert({
                email, password, api_key: newKey, plan: 'free', usage: 0
            }).select().single();

            if (error) throw error;
            return res.status(200).json({ user });
        }

        if (action === 'free') {
            let { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
            
            if (!user) {
                const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
                const newKey = `LXR-FREE-${randomHex}`;
                const { data: newUser, error } = await supabase.from('users').insert({
                    email, password: "discord_oauth_bypass", api_key: newKey, discord_id, plan: 'free', usage: 0
                }).select().single();
                if (error) throw error;
                user = newUser;
            } else {
                await supabase.from('users').update({ discord_id }).eq('email', email);
            }

            user.discord_tag = discord_tag;
            return res.status(200).json({ user });
        }

        if (action === 'link_paid') {
            if (!paid_key) return res.status(400).json({ error: 'API Key required' });

            const { data: keyData } = await supabase.from('users').select('*').eq('api_key', paid_key).maybeSingle();
            if (!keyData) return res.status(400).json({ error: 'Invalid API Key' });

            let plan = 'free';
            if (paid_key.startsWith('LXR-PREM-')) plan = 'premium';
            else if (paid_key.startsWith('LXR-BASIC-')) plan = 'basic';
            else if (paid_key === 'ADMIN') plan = 'admin';

            await supabase.from('users').update({ discord_id, email, plan }).eq('api_key', paid_key);
            
            keyData.discord_tag = discord_tag;
            keyData.plan = plan; // Ensure the frontend gets the plan
            return res.status(200).json({ user: keyData });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
