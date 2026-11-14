import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function genScriptKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars[crypto.randomInt(0, chars.length)];
  }
  return key;
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { script_id, api_key } = req.body;

    try {
        // Check if script belongs to user
        const { data: script } = await supabase.from('scripts').select('id').eq('id', script_id).eq('api_key', api_key).single();
        if (!script) return res.status(403).json({ error: 'Unauthorized' });

        const key = genScriptKey();
        
        const { error } = await supabase.from('script_keys').insert({ key: key, script_id: script_id });
        if (error) throw error;

        return res.status(200).json({ success: true, key: key });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
