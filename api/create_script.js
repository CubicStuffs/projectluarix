import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V4 ENGINE (AI-Poison)
function luarixV4Obfuscate(luaCode) {
    const salt = Math.floor(Math.random() * 100) + 50;
    const bytes = new TextEncoder().encode(luaCode);
    let hex = "";
    
    // Rolling XOR + Index-based Decryption (AI cannot do this easily)
    for (let i = 0; i < bytes.length; i++) {
        let b = bytes[i] ^ (salt + (i % 7));
        hex += b.toString(16).padStart(2, "0");
    }

    // Generate 50 lines of useless junk code to fill AI's context window
    let poison = "";
    for (let i = 0; i < 50; i++) {
        const a = Math.floor(Math.random() * 10000);
        const b = Math.floor(Math.random() * 10000);
        poison += `
local _p${i} = ${a} * ${b}
local _q${i} = _p${i} % ${Math.floor(Math.random() * 100) + 1}
if _q${i} > ${Math.floor(Math.random() * 5000)} then
    _q${i} = _q${i} - 1
end
`;
    }

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');

    return `
-- Luarix V4 (AI-Poison Engine)
local _env = getfenv(0)
local ${v1} = "${hex}"
local ${v2} = ${salt}

-- 🛑 FAKE JUNK CODE (Makes AI confused)
${poison}

-- 🛑 FORT KNOX ANTI-TAMPER (Silent Crash)
pcall(function()
    local _f1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _f2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    local _f3 = string.char(100,101,98,117,103)
    if _env[_f1] or _env[_f2] or _env[_f3] then
        local function _c() _c() end
        _c()
    end
end)

-- 🔄 VM State Machine
local _ls = _env[string.char(108,111,97,100,115,116,114,105,110,103)]
local _bx = bit32.bxor
local _ch = string.char
local _sb = string.sub
local _tn = tonumber
local _dec = ""

for _i = 1, #${v1}, 2 do
    local _h = _sb(${v1}, _i, _i+1)
    local _b = _tn(_h, 16)
    local _mod = (_i / 2) % 7
    _b = _bx(_b, (${v2} + _mod) % 256)
    _dec = _dec .. _ch(_b)
end

if _ls then
    local _f = _ls(_dec)
    if _f then
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

        const finalObfuscatedCode = luarixV4Obfuscate(code);
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
