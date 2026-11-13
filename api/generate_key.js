import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { script_id, api_key } = req.body;

    try {
        // Check if script belongs to user
        const { data: script } = await supabase.from('scripts').select('id').eq('id', script_id).eq('api_key', api_key).single();
        if (!script) return res.status(403).json({ error: 'Unauthorized' });

        const key = "LXR-KEY-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        
        const { error } = await supabase.from('script_keys').insert({ key: key, script_id: script_id });
        if (error) throw error;

        return res.status(200).json({ success: true, key: key });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
