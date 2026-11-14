import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function genScriptKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) key += chars[crypto.randomInt(0, chars.length)];
  return key;
}

// ✅ LUARIX V3 ENGINE (Anti-AI)
function luarixV3Obfuscate(luaCode) {
    const key1 = Math.floor(Math.random() * 200) + 10;
    const key2 = Math.floor(Math.random() * 100) + 5;
    
    const bytes = new TextEncoder().encode(luaCode);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        let enc = ((bytes[i] ^ key1) + key2) % 256;
        hex += enc.toString(16).padStart(2, "0");
    }

    const chunkSize = 300;
    let chunks = [];
    for (let i = 0; i < hex.length; i += chunkSize) chunks.push(hex.substring(i, i + chunkSize));

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');
    
    const s1 = Math.floor(Math.random() * 1000) + 100;
    const s2 = Math.floor(Math.random() * 1000) + 2000;
    const s3 = Math.floor(Math.random() * 1000) + 3000;
    const mathX = Math.floor(Math.random() * 50) + 1;
    const mathY = Math.floor(Math.random() * 50) + 1;

    return `
-- Luarix V3 (AI-Resistant VM)
local ${v1} = { ${chunks.map(c => `"${c}"`).join(",")} }
local ${v2} = ${key1}
local ${v3} = ${key2}
local ${v4} = ${s1}

local function _check_math()
    local a = ${mathX}
    local b = ${mathY}
    local c = (a * b) + (a ^ 2) - (b ^ 2)
    if c == ((a * b) + (a * a) - (b * b)) then return true end
    return false
end

pcall(function()
    local env = getfenv(0)
    local h = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local r = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if env[h] or env[r] then
        local function crash() crash() end
        crash()
    end
end)

local ${v4} = ${s1}
while true do
    if _check_math() then
        if ${v4} == ${s1} then
            local _hex = table.concat(${v1}, "")
            local _dec = ""
            for i = 1, #_hex, 2 do
                local b = tonumber(_hex:sub(i, i+1), 16)
                b = (b - ${v3}) % 256
                _dec = _dec .. string.char(bit32.bxor(b, ${v2}))
            end
            ${v4} = ${s2}
            local _func = loadstring(_dec)
            if _func then
                local _env = getfenv(_func)
                setfenv(_func, _env)
                pcall(_func)
            end
        elseif ${v4} == ${s2} then
            ${v4} = ${s3}
        elseif ${v4} == ${s3} then
            break
        end
    else
        ${v4} = ${s1}
    end
end
    `.trim();
}

export default async function handler(req, res) {
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;
    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        if (action === 'get_chart_data') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts || scripts.length === 0) return res.status(200).json({ labels: [], executions: [], keys: [] });
            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('created_at, executions').in('script_id', scriptIds);
            
            const dailyKeys = {}, dailyExecs = {}, today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dailyKeys[dateStr] = 0; dailyExecs[dateStr] = 0;
            }
            let totalExecs = 0;
            keys.forEach(k => {
                totalExecs += (k.executions || 0);
                const dateStr = new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dailyKeys[dateStr] !== undefined) dailyKeys[dateStr]++;
            });
            let remainingExecs = totalExecs;
            const dateLabels = Object.keys(dailyExecs);
            dateLabels.forEach((date, idx) => {
                if (idx === dateLabels.length - 1) dailyExecs[date] = remainingExecs; 
                else { const take = Math.floor(Math.random() * (remainingExecs / (dateLabels.length - idx))); dailyExecs[date] = take; remainingExecs -= take; }
            });
            const labels = Object.keys(dailyKeys);
            return res.status(200).json({ labels, executions: labels.map(l => dailyExecs[l]), keys: labels.map(l => dailyKeys[l]) });
        }

        if (action === 'get_stats') {
            const { data: scripts } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (!scripts || scripts.length === 0) return res.status(200).json({ totalExecutions: 0, totalKeys: 0, totalProjects: 0 });
            const scriptIds = scripts.map(s => s.id);
            const { data: keys } = await supabase.from('script_keys').select('executions').in('script_id', scriptIds);
            return res.status(200).json({ totalExecutions: keys.reduce((acc, curr) => acc + (curr.executions || 0), 0), totalKeys: keys.length, totalProjects: scripts.length });
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
                if (used >= 20) return res.status(403).json({ error: 'Limit reached (20/20). Resets on ' + resetAt.toLocaleDateString() });
                await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
            }
            
            const rawCode = req.body?.original_code || req.body?.code || req.query.original_code || req.query.code;
            if (!rawCode) return res.status(400).json({ error: 'No code provided' });

            const finalObfuscatedCode = luarixV3Obfuscate(rawCode); // V3 ENGINE APPLIED
            
            await supabase.from('scripts').update({ lua_code: finalObfuscatedCode, original_code: rawCode }).eq('id', script_id).eq('api_key', api_key);
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
