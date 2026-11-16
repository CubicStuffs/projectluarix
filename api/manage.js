import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

function genScriptKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) key += chars[crypto.randomInt(0, chars.length)];
  return key;
}

export default async function handler(req, res) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase environment variables are missing!' });
    }
    
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        if (action === 'get_chart_data') {
            const { data: scripts, error: scriptErr } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (scriptErr) throw scriptErr;
            if (!scripts || scripts.length === 0) return res.status(200).json({ labels: [], executions: [], keys: [] });
            
            const scriptIds = scripts.map(s => s.id);
            const { data: keys, error: keyErr } = await supabase.from('script_keys')
                .select('created_at, executions').in('script_id', scriptIds)
                .order('created_at', { ascending: false }).limit(5000); 
                
            if (keyErr) throw keyErr;
            
            const dailyKeys = {}, dailyExecs = {}, today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dailyKeys[dateStr] = 0; dailyExecs[dateStr] = 0;
            }
            let totalExecs = 0;
            (keys || []).forEach(k => {
                totalExecs += (k.executions || 0);
                const dateStr = new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dailyKeys[dateStr] !== undefined) dailyKeys[dateStr]++;
            });
            let remainingExecs = totalExecs;
            const dateLabels = Object.keys(dailyExecs);
            dateLabels.forEach((date, idx) => {
                if (idx === dateLabels.length - 1) dailyExecs[date] = remainingExecs; 
                else { const take = Math.floor(remainingExecs / (dateLabels.length - idx)); dailyExecs[date] = take; remainingExecs -= take; }
            });
            const labels = Object.keys(dailyKeys);
            return res.status(200).json({ labels, executions: labels.map(l => dailyExecs[l]), keys: labels.map(l => dailyKeys[l]) });
        }

        if (action === 'get_stats') {
            const { data: scripts, error: scriptErr } = await supabase.from('scripts').select('id, executions').eq('api_key', api_key);
            if (scriptErr) throw scriptErr;
            if (!scripts || scripts.length === 0) return res.status(200).json({ totalExecutions: 0, totalKeys: 0, totalProjects: 0 });
            
            const scriptIds = scripts.map(s => s.id);
            const { count, error: keyErr } = await supabase.from('script_keys')
                .select('*', { count: 'estimated', head: true }).in('script_id', scriptIds);
                
            if (keyErr) throw keyErr;
            const scriptExecs = (scripts || []).reduce((acc, curr) => acc + (curr.executions || 0), 0);
            
            return res.status(200).json({ totalExecutions: scriptExecs, totalKeys: count || 0, totalProjects: scripts.length });
        }

        if (action === 'get_projects') {
            const { data: scripts, error: scriptErr } = await supabase
                .from('scripts')
                .select('id, name, keyless, is_disabled, created_at, executions, last_used, obf_version') // ✅ Added obf_version
                .eq('api_key', api_key)
                .order('created_at', { ascending: false });
            
            if (scriptErr) throw scriptErr;
            return res.status(200).json({ projects: scripts || [] });
        }

        if (action === 'get_keys') {
            const { data: scripts, error: scriptErr } = await supabase.from('scripts').select('id, name, keyless').eq('api_key', api_key);
            if (scriptErr) throw scriptErr;
            if (!scripts) return res.status(200).json({ keys: [], scripts: [] });
            
            const scriptIds = scripts.map(s => s.id);
            const { data: keys, error: keyErr } = await supabase.from('script_keys')
                .select('*').in('script_id', scriptIds).order('created_at', { ascending: false }).limit(1000);
                
            if (keyErr) throw keyErr;
            return res.status(200).json({ keys: keys || [], scripts });
        }

        if (action === 'get_blacklists') {
            const { data: scripts, error: scriptErr } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (scriptErr) throw scriptErr;
            if (!scripts) return res.status(200).json({ blacklists: [] });
            
            const scriptIds = scripts.map(s => s.id);
            const { data: blacklists, error: blErr } = await supabase.from('blacklists').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });
            if (blErr) throw blErr;
            return res.status(200).json({ blacklists: blacklists || [] });
        }

        if (action === 'get_script_details') {
            // ✅ Added original_code so frontend can re-obfuscate
            const { data: script, error } = await supabase.from('scripts').select('lua_code, original_code').eq('id', script_id).eq('api_key', api_key).single();
            if (error || !script) return res.status(404).json({ error: 'Not found' });
            return res.status(200).json({ code: script.lua_code, original_code: script.original_code });
        }

        if (req.method === 'POST' && action === 'save_monetization') {
            await supabase.from('scripts').update({ monetization_provider: provider, monetization_link: link }).eq('id', script_id).eq('api_key', api_key);
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
            if (!discord_id || !script_id) return res.status(400).json({ error: 'Missing discord_id or script_id' });
            const { data, error } = await supabase.from('blacklists').delete().eq('discord_id', discord_id).eq('script_id', script_id).select();
            if (error) return res.status(500).json({ error: error.message });
            if (!data || data.length === 0) return res.status(404).json({ error: 'Blacklist entry not found in database' });
            return res.status(200).json({ success: true });
        }
        
        if (req.method === 'POST' && action === 'delete_script') {
            await supabase.from('scripts').delete().eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }
        
        if (req.method === 'POST' && action === 'toggle_keyless') {
            await supabase.from('scripts').update({ keyless: keyless === 'true' }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }
        
        if (req.method === 'POST' && action === 'toggle_kill_switch') {
            await supabase.from('scripts').update({ is_disabled: keyless === 'true' }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST' && action === 'update_script_code') {
            if (!req.body) return res.status(413).json({ error: 'Payload too large.' });

            const { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).single();
            
            if (user && user.plan === 'free') {
                let used = user.obfuscations_used || 0;
                let resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);
                let now = new Date();
                if (now > resetAt) {
                    used = 0; 
                    resetAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    await supabase.from('users').update({ obfuscations_used: used, obfuscation_reset_at: resetAt.toISOString() }).eq('api_key', api_key);
                }
                if (used >= 20) return res.status(403).json({ error: 'Limit reached (20/20).' });
                await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
            }
            
            const obfuscatedCode = req.body.obfuscated_code;
            const originalCode = req.body.original_code;
            const obf_version = req.body.obf_version; // ✅ Get Version
            
            if (!obfuscatedCode) return res.status(400).json({ error: 'No obfuscated code provided' });

            const updateData = { lua_code: obfuscatedCode, original_code: originalCode };
            if (obf_version) updateData.obf_version = obf_version; // ✅ Save Version

            await supabase.from('scripts').update(updateData).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST' && action === 'generate_key') {
            const newKey = genScriptKey(); 
            const { error } = await supabase.from('script_keys').insert({ key: newKey, script_id: script_id });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true, key: newKey });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        console.error("Manage API Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
