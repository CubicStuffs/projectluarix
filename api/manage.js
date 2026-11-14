import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ✅ ADVANCED OBFUSCATION LOGIC (Stealth Anti-Tamper)
function customObfuscate(luaCode) {
    const key = Math.floor(Math.random() * 200) + 10;
    const bytes = new TextEncoder().encode(luaCode);
    let hex = ""; 
    for (let i = 0; i < bytes.length; i++) {
        hex += (bytes[i] ^ key).toString(16).padStart(2, '0');
    }
    
    // Split hex into chunks
    const chunkSize = 500;
    let chunks = [];
    for (let i = 0; i < hex.length; i += chunkSize) {
        chunks.push(hex.substring(i, i + chunkSize));
    }
    
    // Randomize variable names heavily
    const v1 = "_" + crypto.randomBytes(3).toString('hex');
    const v2 = "_" + crypto.randomBytes(3).toString('hex');
    const v3 = "_" + crypto.randomBytes(3).toString('hex');
    
    // Obfuscate the anti-tamper strings so people can't just search "hookfunction"
    // "hookfunction" -> 104,111,111,107,102,117,110,99,116,105,111,110
    // "getrawmetatable" -> 103,101,116,114,97,119,109,101,116,97,116,97,98,108,101
    const obfuscatedCode = `
local ${v1} = { ${chunks.map((c) => `"${c}"`).join(',\n')} }
local ${v2} = ${key}

pcall(function()
    local ${v3} = getfenv(0)
    local _f1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _f2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if ${v3}[_f1] or ${v3}[_f2] then 
        local _x = 0
        while true do _x = _x + 1 end 
    end
end)

pcall(function()
    local _p = string.char(112,114,105,110,116)
    local _s = string.char(114,101,118,101,114,115,101)
    if tostring(${v3}[_p]) == "function: 0000" or string[_s]("") ~= "" then
        local _x = 0
        while true do _x = _x + 1 end
    end
end)

local function ${v1}_d()
    local _h = table.concat(${v1}, "")
    return _h:gsub("%x%x", function(c) 
        return string.char(bit32.bxor(tonumber(c, 16), ${v2})) 
    end)
end

local _s, _c = pcall(${v1}_d)
if _s and _c then
    local _f, _e = loadstring(_c)
    if _f then 
        pcall(_f) 
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

        // Obfuscation Limit Check
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

        // ✅ Apply Strong Obfuscation here
        const finalObfuscatedCode = customObfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({
            id: id, 
            name: name, 
            lua_code: finalObfuscatedCode, 
            original_code: original_code, 
            api_key: api_key, 
            keyless: keyless || false
        });

        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
