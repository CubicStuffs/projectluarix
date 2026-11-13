import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { script_id, api_key, keyless } = req.body;

    try {
        const { error } = await supabase.from('scripts').update({ keyless: keyless }).eq('id', script_id).eq('api_key', api_key);
        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
