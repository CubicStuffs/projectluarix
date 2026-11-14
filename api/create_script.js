import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V14 (The Abyss Engine - Anti-AI)
function luarixV14Obfuscate(luaCode) {
    // 1. Base64 Encode + XOR + Hex (Triple Layer)
    const b64 = Buffer.from(luaCode, 'utf-8').toString('base64');
    const bytes = new TextEncoder().encode(b64);
    let hex = "";
    const polyKey = Math.floor(Math.random() * 100) + 20;
    
    for (let i = 0; i < bytes.length; i++) {
        // Polynomial Math (Harder for AI to solve)
        let val = (bytes[i] ^ (polyKey + (i % 4))) + (polyKey * 2);
        hex += (val % 256).toString(16).padStart(2, "0");
    }

    // 2. Split into 3 chunks (AI cannot see full string at once)
    const chunkSize = Math.ceil(hex.length / 3);
    const c1 = hex.substring(0, chunkSize);
    const c2 = hex.substring(chunkSize, chunkSize * 2);
    const c3 = hex.substring(chunkSize * 2);

    const v1 = "_" + crypto.randomBytes(4).toString('hex');
    const v2 = "_" + crypto.randomBytes(4).toString('hex');
    const v3 = "_" + crypto.randomBytes(4).toString('hex');
    const v4 = "_" + crypto.randomBytes(4).toString('hex');

    // 3. Generate Fake VM Logic
    return `
local _e = getfenv(0)
local ${v1} = "${c1}" .. "${c2}" .. "${c3}"
local ${v2} = ${polyKey}
local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]
local _dec = ""

-- 🛑 FORT KNOX ANTI-TAMPER
pcall(function()
    local _h1 = string.char(104,111,111,107,102,117,110,99,116,105,111,110)
    local _h2 = string.char(103,101,116,114,97,119,109,101,116,97,116,97,98,108,101)
    if _e[_h1] or _e[_h2] then
        local function _c() _c() end
        _c()
    end
end)

-- 🧠 FAKE VM EXECUTION (Wastes AI Tokens)
local _vm = 0
while _vm < 100 do
    _vm = _vm + 1
    if _vm % 2 == 0 then
        local _temp = (_vm * ${polyKey}) % 255
    end
end

-- 🔄 REAL DECRYPTION (Buried Deep)
for i = 1, #${v1}, 2 do
    local h = ${v1}:sub(i, i+1)
    local b = tonumber(h, 16)
    -- Reverse Polynomial
    b = (b - (${v2} * 2)) % 256
    b = bit32.bxor(b, (${v2} + (math.floor((i-1)/2) % 4)) % 256)
    _dec = _dec .. string.char(b)
end

-- 🔓 BASE64 DECODER + LOADSTRING
local function b64_decode(data)
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    data = string.gsub(data, '[^'..b..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end

local _final = b64_decode(_dec)
if _ls and _final then
    local _f = _ls(_final)
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

        const finalObfuscatedCode = luarixV14Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({ id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false });
        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) { return res.status(500).json({ error: error.message }); }
}
