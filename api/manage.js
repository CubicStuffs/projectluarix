import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function genScriptKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars[crypto.randomInt(0, chars.length)];
  }
  return key;
}

export default async function handler(req, res) {
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // ✅ Fetch Chart Data (Executions & Keys)
        if (action === 'get_chart_data') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts || scripts.length === 0) {
                return res.status(200).json({ labels: [], executions: [], keys: [] });
            }
            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('created_at, executions').in('script_id', scriptIds);
            
            // Group by date (last 7 days)
            const dailyKeys = {};
            const dailyExecs = {};
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dailyKeys[dateStr] = 0;
                dailyExecs[dateStr] = 0;
            }

            let totalExecs = 0;
            keys.forEach(k => {
                totalExecs += (k.executions || 0);
                const dateObj = new Date(k.created_at);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dailyKeys[dateStr] !== undefined) dailyKeys[dateStr]++;
            });

            // Distribution logic
            let remainingExecs = totalExecs;
            const dateLabels = Object.keys(dailyExecs);
            dateLabels.forEach((date, idx) => {
                if (idx === dateLabels.length - 1) {
                    dailyExecs[date] = remainingExecs; 
                } else {
                    const take = Math.floor(Math.random() * (remainingExecs / (dateLabels.length - idx)));
                    dailyExecs[date] = take;
                    remainingExecs -= take;
                }
            });

            const labels = Object.keys(dailyKeys);
            const keyData = labels.map(l => dailyKeys[l]);
            const execData = labels.map(l => dailyExecs[l]);

            return res.status(200).json({ labels, executions: execData, keys: keyData });
        }

        // ✅ Fetch Stats
        if (action === 'get_stats') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts || scripts.length === 0) return res.status(200).json({ totalExecutions: 0, totalKeys: 0, totalProjects: 0 });

            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('executions').in('script_id', scriptIds);

            const totalExecutions = keys.reduce((acc, curr) => acc + (curr.executions || 0), 0);
            const totalKeys = keys.length;

            return res.status(200).json({ totalExecutions, totalKeys, totalProjects: scripts.length });
        }

        // ✅ Fetch Keys and Projects
        if (action === 'get_keys') {
            const { data: scripts } = await supabase.from('scripts').select('id, name, keyless').eq('api_key', api_key);
            if (!scripts) return res.status(200).json({ keys: [], scripts: [] });

            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });

            return res.status(200).json({ keys: keys || [], scripts });
        }

        // ✅ Fetch Blacklists
        if (action === 'get_blacklists') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts) return res.status(200).json({ blacklists: [] });

            const scriptIds = scripts.map(s => s.id);
            const { data: blacklists } = await supabase.from('blacklists').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });

            return res.status(200).json({ blacklists: blacklists || [] });
        }

        // ✅ NEW: Fetch Original Code for Download
        if (action === 'get_script_details') {
            const { data: script, error } = await supabase.from('scripts').select('original_code').eq('id', script_id).eq('api_key', api_key).single();
            if (error || !script) return res.status(404).json({ error: 'Not found' });
            return res.status(200).json({ original_code: script.original_code });
        }

        // ✅ Save Monetization
        if (req.method === 'POST' && action === 'save_monetization') {
            await supabase.from('scripts').update({ 
                monetization_provider: provider, 
                monetization_link: link 
            }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // ✅ Delete Key
        if (req.method === 'POST' && action === 'delete_key') {
            await supabase.from('script_keys').delete().eq('key', key_id);
            return res.status(200).json({ success: true });
        }

        // ✅ Reset HWID
        if (req.method === 'POST' && action === 'reset_hwid') {
            await supabase.from('script_keys').update({ hwid: null, resets: 0, last_reset: new Date().toISOString() }).eq('key', key_id);
            return res.status(200).json({ success: true });
        }

        // ✅ Remove Blacklist
        if (req.method === 'POST' && action === 'remove_blacklist') {
            await supabase.from('blacklists').delete().eq('discord_id', discord_id).eq('script_id', script_id);
            return res.status(200).json({ success: true });
        }

        // ✅ Delete Project
        if (req.method === 'POST' && action === 'delete_script') {
            await supabase.from('scripts').delete().eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // ✅ Toggle Keyless
        if (req.method === 'POST' && action === 'toggle_keyless') {
            await supabase.from('scripts').update({ keyless: keyless === 'true' }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // ✅ Update Script Code
        if (req.method === 'POST' && action === 'update_script_code') {
            await supabase.from('scripts').update({ 
                lua_code: req.query.code,
                original_code: req.query.original_code
            }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // ✅ Generate Key (32-char)
        if (req.method === 'POST' && action === 'generate_key') {
            const newKey = genScriptKey(); 
            const { error } = await supabase.from('script_keys').insert({ key: newKey, script_id: script_id });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true, key: newKey });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
