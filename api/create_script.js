import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { name, code, original_code, api_key, keyless } = req.body;

    if (!name || !code || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
        const { data: user } = await supabase.from('users').select('api_key').eq('api_key', api_key).maybeSingle();

        if (!user) {
            await supabase.from('users').insert({ api_key: api_key, email: `temp_${Date.now()}@luarix.com` });
        }

        const id = Math.random().toString(36).substring(2, 8);
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
