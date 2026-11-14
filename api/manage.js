import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; 

function luarixV15Obfuscate(luaCode) {
    const bytes = new TextEncoder().encode(luaCode);
    let hexData = [];
    let rollingKey = Math.floor(Math.random() * 100) + 50;
    const initialKey = rollingKey;

    for (let i = 0; i < bytes.length; i++) {
        let enc = (bytes[i] ^ rollingKey) % 256;
        hexData.push(enc.toString(16).padStart(2, "0"));
        rollingKey = (rollingKey * 33 + bytes[i] + i) % 256;
    }

    let indexed = hexData.map((h, i) => ({ h, i }));
    indexed.sort(() => Math.random() - 0.5);
    const shuffled = indexed.map(obj => obj.h);
    const indexMap = indexed.map(obj => obj.i);

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');
    const v5 = "_" + crypto.randomBytes(4).toString('hex');
    const v6 = "_" + crypto.randomBytes(4).toString('hex');

    return `
local _e = getfenv(0)
local ${v1} = { ${shuffled.map(h => `"${h}"`).join(",")} }
local ${v2} = { ${indexMap.join(",")} }
local ${v3} = ${initialKey}
local ${v4} = ""
local ${v5} = 1
local ${v6} = 0

while ${v6} < 50 do
    ${v6} = ${v6} + 1
    if ${v6} % 2 == 0 then
        local _fake = (${v6} * ${initialKey}) % 255
    end
end

pcall(function()
    local _h1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _h2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if _e[_h1] or _e[_h2] then
        local function _c() _c() end
        _c()
    end
end)

while true do
    if ${v5} == 1 then
        local _x = (${initialKey} * 3) % 7
        if (_x * _x) % 2 == _x % 2 then
            ${v5} = 2
        else
            ${v5} = 1
        end
    elseif ${v5} == 2 then
        local _tmpHex = {}
        for i = 1, #${v2} do
            _tmpHex[${v2}[i] + 1] = ${v1}[i]
        end
        ${v5} = 3
    elseif ${v5} == 3 then
        local _rk = ${v3}
        for i = 1, #_tmpHex do
            local b = tonumber(_tmpHex[i], 16)
            b = bit32.bxor(b, _rk % 256)
            ${v4} = ${v4} .. string.char(b)
            _rk = (_rk * 33 + b + (i-1)) % 256
        end
        ${v5} = 4
    elseif ${v5} == 4 then
        local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]
        if _ls then
            local _f = _ls(${v4})
            if _f then
                setfenv(_f, _e)
                pcall(_f)
            end
        end
        ${v5} = 5
    elseif ${v5} == 5 then
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
        return res.status(500).json({ error: 'Supabase env variables are missing!' });
    }
    
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { api_key, action, key_id, script_id, discord_id, provider, link, keyless } = req.query;

    if (!api_key) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // ... (Saare GET requests: get_chart_data, get_stats, get_keys, get_blacklists, get_script_details yahan aayenge)
        
        // ✅ V15 ENGINE APPLIED HERE
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

            const finalObfuscatedCode = luarixV15Obfuscate(rawCode); 
            
            await supabase.from('scripts').update({ lua_code: finalObfuscatedCode, original_code: rawCode }).eq('id', script_id).eq('api_key', api_key);
            return res.status(200).json({ success: true });
        }

        // ... (Baaki POST requests: save_monetization, delete_key, reset_hwid, etc.)
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
