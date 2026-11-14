import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V16 (Polymorphic Engine)
function luarixV16Obfuscate(luaCode) {
    const bytes = new TextEncoder().encode(luaCode);
    let hexData = [];
    let rollingKey = Math.floor(Math.random() * 100) + 50;
    const initialKey = rollingKey;
    
    // Polymorphic Math: 1 = XOR, 2 = ADD, 3 = SUB
    const mathType = Math.floor(Math.random() * 3) + 1; 

    for (let i = 0; i < bytes.length; i++) {
        let enc = 0;
        if (mathType === 1) enc = (bytes[i] ^ rollingKey) % 256;
        else if (mathType === 2) enc = (bytes[i] + rollingKey) % 256;
        else enc = (bytes[i] - rollingKey + 256) % 256;
        
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
    const v7 = "_" + crypto.randomBytes(4).toString('hex');
    const v8 = "_" + crypto.randomBytes(4).toString('hex');

    // Generate Polymorphic Decryption Logic
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
            ${decryptLogic} -- Dynamic Decryption
            ${v4} = ${v4} .. string.char(b)
            _rk = (_rk * 33 + b + (i-1)) % 256
        end
        ${v5} = 4
    elseif ${v5} == 4 then
        -- Nested Fake State
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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { name, code, original_code, api_key, keyless } = req.body;
    if (!name || !code || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
        let { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).maybeSingle();
        if (!user) {
            const { data: newUser } = await supabase.from('users').insert({ api_key: api_key, email: `temp_${Date.now()}@luarix.com`, plan: 'free', obfuscations_used: 0 }).select().single();
            user = newUser;
        }
        if (user && user.plan === 'free') {
            let used = user.obfuscations_used || 0;
            let resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);
            let now = new Date();
            if (now > resetAt) {
                used = 0; resetAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                await supabase.from('users').update({ obfuscations_used: used, obfuscation_reset_at: resetAt.toISOString() }).eq('api_key', api_key);
            }
            if (used >= 20) return res.status(403).json({ error: 'Limit reached (20/20). Resets on ' + resetAt.toLocaleDateString() });
            await supabase.from('users').update({ obfuscations_used: used + 1 }).eq('api_key', api_key);
        }

        const finalObfuscatedCode = luarixV16Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({ id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false });
        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) { return res.status(500).json({ error: error.message }); }
}
