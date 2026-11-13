import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    try {
        // Check if user exists
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();

        if (user) {
            // User exists, return their existing key
            return res.status(200).json({ api_key: user.api_key });
        }

        // If user doesn't exist, create a new one with a Free key
        const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
        const newKey = `LXR-FREE-${randomHex}`;

        const { error: insertError } = await supabase.from('users').insert({
            email: email,
            api_key: newKey
        });

        if (insertError) throw insertError;

        return res.status(200).json({ api_key: newKey });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
