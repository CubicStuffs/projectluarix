import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V10 ENGINE (Mini-Virtual Machine)
function luarixV10Obfuscate(luaCode) {
    // 1. Break string into numeric opcodes (simulating bytecode)
    const bytes = new TextEncoder().encode(luaCode);
    let opcodes = [];
    const salt = Math.floor(Math.random() * 50) + 10;
    
    for (let i = 0; i < bytes.length; i++) {
        // Complex Opcode mapping
        let op = ((bytes[i] + salt) * 3) % 256;
        opcodes.push(op);
    }

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');

    // 2. Generate the Lua Mini-VM Interpreter
    return `
local _e = getfenv(0)
local ${v1} = { ${opcodes.join(",")} }
local ${v2} = ${salt}
local ${v3} = ""
local ${v4} = 0

-- FAKE EXECUTION BLOCK (AI ki aankh mein dhool)
for _x = 1, 100 do
    local _y = (_x * 32) % ${salt}
    if _y == 99 then _y = 0 end
end

-- 🛑 ANTI-TAMPER (Silent Crash if hooked)
pcall(function()
    local _h1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _h2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if _e[_h1] or _e[_h2] then
        local function _c() _c() end
        _c()
    end
end)

-- 🔄 VM INTERPRETER STATE MACHINE
while true do
    ${v4} = ${v4} + 1
    if ${v4} > #${v1} then
        break
    end
    
    local _op = ${v1}[${v4}]
    -- Reverse Opcode
    local _b = math.floor(_op / 3) - ${v2}
    if _b < 0 then _b = _b + 256 end
    
    ${v3} = ${v3} .. string.char(_b)
end

-- HIDDEN LOADSTRING
local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]
if _ls then
    local _f = _ls(${v3})
    if _f then
        setfenv(_f, _e)
        pcall(_f)
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

        const finalObfuscatedCode = luarixV10Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({ id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false });
        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) { return res.status(500).json({ error: error.message }); }
}
