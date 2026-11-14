import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ✅ LUARIX V3 ENGINE (Fort Knox Anti-Tamper)
function luarixV3Obfuscate(luaCode) {
    // 1. Advanced Encryption (Multi-layer)
    const key1 = Math.floor(Math.random() * 200) + 10;
    const key2 = Math.floor(Math.random() * 100) + 5;
    
    const bytes = new TextEncoder().encode(luaCode);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        // (Byte ^ key1) + key2
        let enc = ((bytes[i] ^ key1) + key2) % 256;
        hex += enc.toString(16).padStart(2, "0");
    }

    // 2. Split into chunks
    const chunkSize = 300;
    let chunks = [];
    for (let i = 0; i < hex.length; i += chunkSize) {
        chunks.push(hex.substring(i, i + chunkSize));
    }

    // 3. Randomize Variables & State IDs
    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');
    
    // Opaque Predicate IDs
    const s1 = Math.floor(Math.random() * 1000) + 100;
    const s2 = Math.floor(Math.random() * 1000) + 2000;
    const s3 = Math.floor(Math.random() * 1000) + 3000;

    // Opaque Predicate Math
    const mathX = Math.floor(Math.random() * 50) + 1;
    const mathY = Math.floor(Math.random() * 50) + 1;

    // 4. The V3 Virtual Machine Wrapper
    const obfuscatedCode = `
-- Luarix V3 (AI-Resistant VM)
local ${v1} = { ${chunks.map(c => `"${c}"`).join(",")} }
local ${v2} = ${key1}
local ${v3} = ${key2}
local ${v4} = ${s1}

-- 🛑 Opaque Predicates (Fake Logic to confuse AI)
local function _check_math()
    local a = ${mathX}
    local b = ${mathY}
    local c = (a * b) + (a ^ 2) - (b ^ 2)
    if c == ((a * b) + (a * a) - (b * b)) then
        return true
    end
    return false
end

-- 🛑 FORT KNOX ANTI-TAMPER (Checks 9 Dumper Functions)
pcall(function()
    local _e = getfenv(0)
    local _f1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _f2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    local _f3 = string.char(104,111,111,107,109,101,116,97,109,101,116,104,111,100)
    local _f4 = string.char(100,101,98,117,103)
    local _f5 = string.char(103,101,116,117,112,118,97,108,117,101,115)
    local _f6 = string.char(115,101,116,117,112,118,97,108,117,101)
    local _f7 = string.char(103,101,116,103,99)
    local _f8 = string.char(103,101,116,99,111,110,110,101,99,116,105,111,110,115)
    local _f9 = string.char(103,101,116,114,101,103)

    if _e[_f1] or _e[_f2] or _e[_f3] or _e[_f4] or _e[_f5] or _e[_f6] or _e[_f7] or _e[_f8] or _e[_f9] then
        local function _crash() _crash() end
        _crash()
    end
    
    if tostring(loadstring) ~= "function: builtin" and string.find(tostring(loadstring), "0x") == nil then
        local function _crash2() _crash2() end
        _crash2()
    end
end)

-- 🔄 VM State Machine
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
        ${v4} = ${s1} -- Fake loop
    end
end
    `.trim();

    return obfuscatedCode;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { name, code, original_code, api_key, keyless } = req.body;
    if (!name || !code || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
        let { data: user } = await supabase.from('users').select('*').eq('api_key', api_key).maybeSingle();
        if (!user) {
            const { data: newUser } = await supabase.from('users').insert({ 
                api_key: api_key, email: `temp_${Date.now()}@luarix.com`, plan: 'free', obfuscations_used: 0 
            }).select().single();
            user = newUser;
        }

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

        const finalObfuscatedCode = luarixV3Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({
            id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false
        });

        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
