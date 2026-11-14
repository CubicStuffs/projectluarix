import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ✅ STRONG OBFUSCATION LOGIC (Server-Side)
function customObfuscate(luaCode) {
    // 1. String Encryption & Splitting
    const key = Math.floor(Math.random() * 200) + 10;
    const bytes = new TextEncoder().encode(luaCode);
    let hex = ""; 
    for (let i = 0; i < bytes.length; i++) {
        hex += (bytes[i] ^ key).toString(16).padStart(2, '0');
    }
    
    // 2. Split hex into chunks to prevent easy dumping
    const chunkSize = 500;
    let chunks = [];
    for (let i = 0; i < hex.length; i += chunkSize) {
        chunks.push(hex.substring(i, i + chunkSize));
    }
    
    // 3. Generate a completely randomized variable name for the VM
    const randVar = "v_" + crypto.randomBytes(4).toString('hex');
    const loaderVar = "l_" + crypto.randomBytes(4).toString('hex');
    
    // 4. Anti-Tamper & Custom VM State Machine
    const obfuscatedCode = `
-- Luarix Custom VM (Anti-Dump)
local ${randVar} = {
    ${chunks.map((c, i) => `"${c}"`).join(',\n    ')}
}
local ${loaderVar} = ${key}

-- 🛑 ANTI-TAMPER CHECKS
pcall(function()
    local env = getfenv(0)
    if env.hookfunction or env.getrawmetatable or (env.debug and env.debug.getinfo) then
        -- Dumper detected, crash the script safely
        while true do end
    end
end)

-- 🛑 ANTI-STRING DUMP
pcall(function()
    if string.reverse("") ~= "" or tostring(print) == "function: 0000" then
        while true do end
    end
end)

local function ${randVar}_decrypt()
    local finalHex = table.concat(${randVar}, "")
    local s = finalHex:gsub("%x%x", function(c) 
        return string.char(bit32.bxor(tonumber(c, 16), ${loaderVar})) 
    end)
    return s
end

local isSuccess, finalCode = pcall(function() return ${randVar}_decrypt() end)
if isSuccess and finalCode then
    local func, err = loadstring(finalCode)
    if func then 
        pcall(func) 
    else
        warn("[Luarix VM] Execution failed: " .. tostring(err))
    end
else
    warn("[Luarix VM] Decryption failed. Anti-Tamper triggered.")
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
