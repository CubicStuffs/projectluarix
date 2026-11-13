import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Get data sent from the website
    const { name, code, api_key } = req.body;

    if (!name || !code || !api_key) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Generate a random 6-character ID for the script (e.g., "a1b2c3")
        const id = Math.random().toString(36).substring(2, 8);
        
        // Insert into Supabase
        const { error } = await supabase.from('scripts').insert({
            id: id,
            name: name,
            lua_code: code,
            api_key: api_key,
            keyless: false
        });

        if (error) throw error;

        return res.status(200).json({ success: true, id: id });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
