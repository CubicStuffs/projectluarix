import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V13 (The Chaos Engine / Anti-AI)
function luarixV13Obfuscate(luaCode) {
    const bytes = new TextEncoder().encode(luaCode);
    let realData = "";
    const salt = Math.floor(Math.random() * 50) + 10;
    
    // 1. Real Encryption
    for (let i = 0; i < bytes.length; i++) {
        let b = bytes[i] ^ (salt + (i % 7));
        realData += b.toString(16).padStart(2, "0");
    }

    // 2. Generate Fake Data (Honeypots) to confuse AI
    let fakeArray = [];
    const realIndex = Math.floor(Math.random() * 5); // 0 se 4 ke beech
    for (let j = 0; j < 5; j++) {
        if (j === realIndex) {
            fakeArray.push(`"${realData}"`); // Asli data
        } else {
            let fakeHex = "";
            for (let k = 0; k < bytes.length; k++) {
                fakeHex += Math.floor(Math.random() * 255).toString(16).padStart(2, "0");
            }
            fakeArray.push(`"${fakeHex}"`); // Fake data
        }
    }

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');
    const v5 = "_" + crypto.randomBytes(4).toString('hex');
    const v6 = "_" + crypto.randomBytes(4).toString('hex');

    // 3. Generate Virtual Machine Script
    return `
local _e = getfenv(0)
local ${v1} = { ${fakeArray.join(",")} } -- 5 arrays, 1 is real
local ${v2} = ${realIndex} -- The real index
local ${v3} = ${salt}
local ${v4} = ""
local ${v5} = 1
local ${v6} = 0

-- 🛑 ANTI-TAMPER
pcall(function()
    local _h1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _h2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if _e[_h1] or _e[_h2] then
        local function _c() _c() end
        _c()
    end
end)

-- 🔄 CONTROL FLOW FLATTENING (Fake Loops)
while true do
    if ${v5} == 1 then
        -- Fake math to waste AI's time
        local _x = (${salt} * 3) % 7
        if _x > 0 then
            ${v5} = 2
        else
            ${v5} = 1
        end
    elseif ${v5} == 2 then
        -- Decryption Loop
        local _realHex = ${v1}[${v2} + 1] -- Lua is 1-indexed
        for i = 1, #_realHex, 2 do
            local b = tonumber(_realHex:sub(i, i+1), 16)
            b = bit32.bxor(b, (${v3} + ((i-1)/2) % 7) % 256)
            ${v4} = ${v4} .. string.char(b)
        end
        ${v5} = 3
    elseif ${v5} == 3 then
        -- Hidden Loadstring
        local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]
        if _ls then
            local _f = _ls(${v4})
            if _f then
                setfenv(_f, _e)
                pcall(_f)
            end
        end
        ${v5} = 4
    elseif ${v5} == 4 then
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

        const finalObfuscatedCode = luarixV13Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({ id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false });
        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) { return res.status(500).json({ error: error.message }); }
}
