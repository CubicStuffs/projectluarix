import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { id, key } = req.query;
    if (!id || !key) return res.status(400).send("Invalid request");

    // Check if key exists
    const { data: keyData } = await supabase.from('monetization_keys').select('*').eq('key', key).eq('script_id', id).maybeSingle();
    
    if (!keyData) {
        return res.status(401).send("-- Invalid or expired key.");
    }

    // Key is valid! Delete it (1-time use)
    await supabase.from('monetization_keys').delete().eq('key', key);

    // Fetch the actual script code
    const { data: script } = await supabase.from('scripts').select('lua_code').eq('id', id).single();
    
    return res.status(200).send(script.lua_code);
}
