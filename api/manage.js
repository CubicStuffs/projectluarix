import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

// 🚀 LUARIX V17 ENGINE (Anti-AI / No Comments / Non-Linear)
function luarixV17Obfuscate(luaCode) {
    const bytes = new TextEncoder().encode(luaCode);
    let hexData = [];
    let rollingKey = crypto.randomInt(50, 200);
    const initialKey = rollingKey;
    
    const mathType = crypto.randomInt(1, 4); 

    for (let i = 0; i < bytes.length; i++) {
        let enc = 0;
        if (mathType === 1) {
            rollingKey = ((rollingKey * 33) ^ (bytes[i] + i)) % 256;
            enc = (bytes[i] ^ rollingKey) % 256;
        } else if (mathType === 2) {
            rollingKey = ((rollingKey + 77) ^ (bytes[i] - i)) % 256;
            enc = (bytes[i] + rollingKey) % 256;
        } else {
            rollingKey = ((rollingKey * 13) - (bytes[i] + i)) % 256;
            if (rollingKey < 0) rollingKey += 256;
            enc = (bytes[i] - rollingKey + 256) % 256;
        }
        hexData.push(enc.toString(16).padStart(2, "0"));
    }

    let indexed = hexData.map((h, i) => ({ h, i }));
    for (let i = indexed.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    const shuffled = indexed.map(obj => obj.h);
    const indexMap = indexed.map(obj => obj.i);

    const vars = Array.from({ length: 10 }, () => "_" + crypto.randomBytes(3).toString('hex'));
    const [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10] = vars;

    let decryptLogic = "";
    if (mathType === 1) {
        decryptLogic = `${v9} = ((${v9} * 33) ^ (${v7} + ${v10})) % 256; ${v7} = _bxor(${v7}, ${v9} % 256)`;
    } else if (mathType === 2) {
        decryptLogic = `${v9} = ((${v9} + 77) ^ (${v7} - ${v10})) % 256; ${v7} = (${v7} - ${v9} + 256) % 256`;
    } else {
        decryptLogic = `${v9} = ((${v9} * 13) - (${v7} + ${v10})) % 256; if ${v9} < 0 then ${v9} = ${v9} + 256 end; ${v7} = (${v7} + ${v9}) % 256`;
    }

    const states = [1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);

    return `
local ${v1} = (getgenv and getgenv()) or getfenv(0)
local ${v2} = { ${shuffled.map(h => `"${h}"`).join(",")} }
local ${v3} = { ${indexMap.join(",")} }
local ${v4} = ${initialKey}
local ${v5} = ""
local ${v6} = ${states[0]}
local ${v7} = 0
local ${v8} = {}
local ${v9} = ${v4}
local ${v10} = 0

local _bxor = (bit32 and bit32.bxor) or function(a, b)
    local r, p = 0, 1
    while a > 0 or b > 0 do
        local aa, bb = a % 2, b % 2
        if aa ~= bb then r = r + p end
        a = math.floor(a / 2); b = math.floor(b / 2); p = p * 2
    end
    return r
end

local function ${v2}_check()
    local f1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    if rawget(${v1}, f1) then
        ${v4} = ${v4} + 1
    end
end
pcall(${v2}_check)

while true do
    if ${v6} == 1 then
        for ${v10} = 1, #${v3} do
            ${v8}[${v3}[${v10}] + 1] = ${v2}[${v10}]
        end
        ${v6} = 4
    elseif ${v6} == 4 then
        for ${v10} = 1, #${v8} do
            ${v7} = tonumber(${v8}[${v10}], 16)
            ${decryptLogic}
            ${v5} = ${v5} .. string.char(${v7})
        end
        ${v6} = 2
    elseif ${v6} == 2 then
        local ${v9} = 0
        for i=1, 50 do ${v9} = (${v9} + i * 13) % 255 end
        ${v6} = 5
    elseif ${v6} == 5 then
        local _l = rawget(${v1}, string.char(108,111,97,100,115,116,114,105,110,103)) or loadstring or load
        if _l then
            local _f = _l(${v5})
            if _f then
                pcall(function() setfenv(_f, ${v1}) end)
                pcall(_f)
            end
        end
        ${v6} = 3
    elseif ${v6} == 3 then
        break
    end
end
    `.trim();
}

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
        // ==========================================
        // ✅ GET REQUESTS
        // ==========================================
        
        if (action === 'get_chart_data') {
            const { data: scripts, error: scriptErr } = await supabase.from('scripts').select('id').eq('api_key', api_key);
            if (scriptErr) throw scriptErr;
            if (!scripts || scripts.length === 0) return res.status(200).json({ labels: [], executions: [], keys: [] });
            
            const scriptIds = scripts.map(s => s.id);
            const { data: keys, error: keyErr } = await supabase.from('script_keys').select('created_at, executions').in('script_id', scriptIds);
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
            const { data: keys, error: keyErr } = await supabase.from('script_keys').select('executions').in('script_id', scriptIds);
            if (keyErr) throw keyErr;
            
            const keyExecs = (keys || []).reduce((acc, curr) => acc + (curr.executions || 0), 0);
            const scriptExecs = (scripts || []).reduce((acc, curr) => acc + (curr.executions || 0), 0);
            const totalExecutions = scriptExecs > 0 ? scriptExecs : keyExecs; 
            
            return res.status(200).json({ totalExecutions, totalKeys: (keys || []).length, totalProjects: scripts.length });
        }

        if (action === 'get_projects') {
            const { data: scripts, error: scriptErr } = await supabase
                .from('scripts')
                .select('id, name, keyless, is_disabled, created_at, executions, last_used')
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
            const { data: keys, error: keyErr } = await supabase.from('script_keys').select('*').in('script_id', scriptIds).order('created_at', { ascending: false });
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
            const { data: script, error } = await supabase.from('scripts').select('lua_code').eq('id', script_id).eq('api_key', api_key).single();
            if (error || !script) return res.status(404).json({ error: 'Not found' });
            return res.status(200).json({ code: script.lua_code });
        }

        // ==========================================
        // ✅ POST REQUESTS
        // ==========================================

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

            // ✅ V17 ENGINE APPLIED HERE
            const finalObfuscatedCode = luarixV17Obfuscate(rawCode); 
            
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
        console.error("Manage API Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
