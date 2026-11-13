import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        if (action === 'get_stats') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts || scripts.length === 0) return res.status(200).json({ totalExecutions: 0, totalKeys: 0, totalProjects: 0 });

            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('executions').in('script_id', scriptIds);

            const totalExecutions = keys.reduce((acc, curr) => acc + (curr.executions || 0), 0);
            const totalKeys = keys.length;

            return res.status(200).json({ totalExecutions, totalKeys, totalProjects: scripts.length });
        }

        if (action === 'get_keys') {
            const { data: scripts } = await supabase.from('scripts').select('id, name, keyless').eq('api_key', api_key);
            if (!scripts) return res.status(200).json({ keys: [], scripts: [] });

            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });

            return res.status(200).json({ keys: keys || [], scripts });
        }

        if (action === 'get_blacklists') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts) return res.status(200).json({ blacklists: [] });

            const scriptIds = scripts.map(s => s.id);
            const { data: blacklists } = await supabase.from('blacklists').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });

            return res.status(200).json({ blacklists: blacklists || [] });
        }

        if (req.method === 'POST' && action === 'save_monetization') {
            await supabase.from('scripts').update({ 
                monetization_provider: provider, 
                monetization_link: link 
            }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST' && action === 'delete_key') {
            await supabase.from('script_keys').delete().eq('key', key_id);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST' && action === 'reset_hwid') {
            await supabase.from('script_keys').update({ hwid: null, resets: 0, last_reset: new Date().toISOString() }).eq('key', key_id);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST' && action === 'remove_blacklist') {
            await supabase.from('blacklists').delete().eq('discord_id', discord_id).eq('script_id', script_id);
            return res.status(200).json({ success: true });
        }

        // NEW: Delete Project
        if (req.method === 'POST' && action === 'delete_script') {
            await supabase.from('scripts').delete().eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // NEW: Toggle Keyless
        if (req.method === 'POST' && action === 'toggle_keyless') {
            await supabase.from('scripts').update({ keyless: keyless === 'true' }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // NEW: Generate Key from Web
        if (req.method === 'POST' && action === 'generate_key') {
                    // NEW: Update Script Code
        if (req.method === 'POST' && action === 'update_script_code') {
            await supabase.from('scripts').update({ 
                lua_code: req.query.code,
                original_code: req.query.original_code
            }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }
            const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
            const newKey = `LXR-KEY-${randomHex}`;
            const { error } = await supabase.from('script_keys').insert({ key: newKey, script_id: script_id });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true, key: newKey });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
