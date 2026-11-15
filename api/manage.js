import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

// 🚀 LUARIX V16 ENGINE (Polymorphic Math / Anti-AI)
function luarixV16Obfuscate(luaCode) {
    const bytes = new TextEncoder().encode(luaCode);
    let hexData = [];
    let rollingKey = Math.floor(Math.random() * 100) + 50;
    const initialKey = rollingKey;
    
    // Polymorphic Math: 1 = XOR, 2 = ADD, 3 = SUB
    const mathType = Math.floor(Math.random() * 3) + 1; 

    // Encryption
    for (let i = 0; i < bytes.length; i++) {
        let enc = 0;
        if (mathType === 1) enc = (bytes[i] ^ rollingKey) % 256;
        else if (mathType === 2) enc = (bytes[i] + rollingKey) % 256;
        else enc = (bytes[i] - rollingKey + 256) % 256;
        
        hexData.push(enc.toString(16).padStart(2, "0"));
        rollingKey = (rollingKey * 33 + bytes[i] + i) % 256;
    }

    // Shuffle Array
    let indexed = hexData.map((h, i) => ({ h, i }));
    indexed.sort(() => Math.random() - 0.5);
    const shuffled = indexed.map(obj => obj.h);
    const indexMap = indexed.map(obj => obj.i);

    // Random Variables
    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');
    const v5 = "_" + crypto.randomBytes(4).toString('hex');
    const v6 = "_" + crypto.randomBytes(4).toString('hex');
    const v7 = "_" + crypto.randomBytes(4).toString('hex');
    const v8 = "_" + crypto.randomBytes(4).toString('hex');

    // Dynamic Decryption Logic based on mathType
    let decryptLogic = "";
    if (mathType === 1) {
        decryptLogic = `b = bit32.bxor(b, _rk % 256)`;
    } else if (mathType === 2) {
        decryptLogic = `b = (b - _rk + 256) % 256`;
    } else {
        decryptLogic = `b = (b + _rk) % 256`;
    }

    return `
local _e = getfenv(0)
local ${v1} = { ${shuffled.map(h => `"${h}"`).join(",")} }
local ${v2} = { ${indexMap.join(",")} }
local ${v3} = ${initialKey}
local ${v4} = ""
local ${v5} = 1
local ${v6} = 0
local ${v7} = {}
local ${v8} = ${mathType}

-- 🛑 Dead Code (Opaque Predicates)
if ${v8} == 99 then
    ${v6} = 100
end

while ${v6} < 30 do
    ${v6} = ${v6} + 1
    local _fake = (${v6} * ${initialKey}) % 255
end

-- 🛑 ANTI-TAMPER
pcall(function()
    local _h1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _h2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if _e[_h1] or _e[_h2] then
        local function _c() _c() end
        _c()
    end
end)

-- 🔄 STATE MACHINE EXECUTION
while true do
    if ${v5} == 1 then
        local _x = (${initialKey} * 3) % 7
        if (_x * _x) % 2 == _x % 2 then ${v5} = 2 else ${v5} = 1 end
    elseif ${v5} == 2 then
        for i = 1, #${v2} do
            ${v7}[${v2}[i] + 1] = ${v1}[i]
        end
        ${v5} = 3
    elseif ${v5} == 3 then
        local _rk = ${v3}
        for i = 1, #${v7} do
            local b = tonumber(${v7}[i], 16)
            ${decryptLogic} -- Dynamic Polymorphic Decryption
            ${v4} = ${v4} .. string.char(b)
            _rk = (_rk * 33 + b + (i-1)) % 256
        end
        ${v5} = 4
    elseif ${v5} == 4 then
        if ${v8} == 1 then ${v5} = 5 else ${v5} = 5 end
    elseif ${v5} == 5 then
        local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]
        if _ls then
            local _f = _ls(${v4})
            if _f then
                setfenv(_f, _e)
                pcall(_f)
            end
        end
        ${v5} = 6
    elseif ${v5} == 6 then
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
        return res.status(500).json({ error: 'Supabase environment variables are missing in Vercel!' });
    }
    
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // ==========================================
        // ✅ GET REQUESTS (Dashboard Data Loading)
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
            
            // Fixed Graph Math (No random crashes)
            let remainingExecs = totalExecs;
            const dateLabels = Object.keys(dailyExecs);
            dateLabels.forEach((date, idx) => {
                if (idx === dateLabels.length - 1) {
                    dailyExecs[date] = remainingExecs; 
                } else {
                    const take = Math.floor(remainingExecs / (dateLabels.length - idx));
                    dailyExecs[date] = take; 
                    remainingExecs -= take;
                }
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
            
            // Calculate total executions from both scripts table and script_keys table
            const keyExecs = (keys || []).reduce((acc, curr) => acc + (curr.executions || 0), 0);
            const scriptExecs = (scripts || []).reduce((acc, curr) => acc + (curr.executions || 0), 0);
            
            // Use scriptExecs (new loader updates this), fallback to keyExecs if 0
            const totalExecutions = scriptExecs > 0 ? scriptExecs : keyExecs; 
            
            return res.status(200).json({ totalExecutions, totalKeys: (keys || []).length, totalProjects: scripts.length });
        }

        // 🔥 NEW FIX: PROJECTS LOADER ADDED HERE 🔥
        if (action === 'get_projects') {
            const { data: scripts, error: scriptErr } = await supabase
                .from('scripts')
                .select('id, name, keyless, is_disabled, created_at, executions, last_used')
                .eq('api_key', api_key)
                .order('created_at', { ascending: false });
            
            if (scriptErr) throw scriptErr;
            return res.status(200).json({ projects: scripts || [] });
        }
        // 🔥 END OF NEW FIX 🔥

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
        // ✅ POST REQUESTS (Mutating Data)
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

            // ✅ V16 POLYMORPHIC ENGINE APPLIED HERE
            const finalObfuscatedCode = luarixV16Obfuscate(rawCode); 
            
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
