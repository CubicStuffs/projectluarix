import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { name, code, original_code, api_key } = req.body;

    try {
        const id = Math.random().toString(36).substring(2, 8);
        const { error } = await supabase.from('scripts').insert({
            id: id, name: name, lua_code: code, original_code: original_code, api_key: api_key, keyless: false
        });

        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
