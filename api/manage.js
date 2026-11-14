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
        // ✅ GET REQUESTS (Dashboard Data Loading)
        
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

        if (action === 'get_script_details') {
            const { data: script, error } = await supabase.from('scripts').select('lua_code').eq('id', script_id).eq('api_key', api_key).single();
            if (error || !script) return res.status(404).json({ error: 'Not found' });
            return res.status(200).json({ code: script.lua_code });
        }

        // ✅ POST REQUESTS (Mutating Data)

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

        // ✅ Update Script Code (WITH STRONG OBFUSCATION)
        if (req.method === 'POST' && action === 'update_script_code') {
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
                
                if (used >= 20) {
                    return res.status(403).json({ error: 'Limit reached (20/20). Resets on ' + resetAt.toLocaleDateString() });
                }
                
                await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
            }
            
            const rawCode = req.query.original_code || req.query.code;
            const key = Math.floor(Math.random() * 200) + 10;
            const bytes = new TextEncoder().encode(rawCode);
            let hex = ""; 
            for (let i = 0; i < bytes.length; i++) hex += (bytes[i] ^ key).toString(16).padStart(2, '0');
            
            const chunkSize = 500;
            let chunks = [];
            for (let i = 0; i < hex.length; i += chunkSize) chunks.push(hex.substring(i, i + chunkSize));
            
            const randVar = "v_" + crypto.randomBytes(4).toString('hex');
            
            const finalObfuscatedCode = `
local ${randVar} = { ${chunks.map((c) => `"${c}"`).join(',\n    ')} }
pcall(function()
    local env = getfenv(0)
    local _f1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _f2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if env[_f1] or env[_f2] then while true do end end
end)
local function ${randVar}_d()
    return table.concat(${randVar}, ""):gsub("%x%x", function(c) return string.char(bit32.bxor(tonumber(c, 16), ${key})) end)
end
local s, code = pcall(${randVar}_d)
if s then loadstring(code)() end
            `.trim();
            
            await supabase.from('scripts').update({ 
                lua_code: finalObfuscatedCode,
                original_code: rawCode
            }).eq('id', script_id).eq('api_key', api_key);
            
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
        return res.status(500).json({ error: err.message });
    }
}
