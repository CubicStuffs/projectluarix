import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LUARIX V9 ENGINE (Chunked State Machine)
function luarixV9Obfuscate(luaCode) {
    const chunkSize = 50;
    let chunks = [];
    for (let i = 0; i < luaCode.length; i += chunkSize) {
        chunks.push(luaCode.substring(i, i + chunkSize));
    }

    const salt = Math.floor(Math.random() * 100) + 10;
    let encodedChunks = [];
    
    chunks.forEach((chunk, index) => {
        let hex = "";
        for (let i = 0; i < chunk.length; i++) {
            let enc = ((chunk.charCodeAt(i) ^ (salt + i)) + (index * 5)) % 256;
            hex += enc.toString(16).padStart(2, "0");
        }
        encodedChunks.push(`"${hex}"`);
    });

    const vTable = "_" + crypto.randomBytes(4).toString('hex');
    const vSalt = "_" + crypto.randomBytes(4).toString('hex');
    const vIndex = "_" + crypto.randomBytes(4).toString('hex');

    // Obfuscated 'loadstring' and 'string.char'
    return `
local _e = getfenv(0)
local ${vTable} = { ${encodedChunks.join(",")} }
local ${vSalt} = ${salt}
local ${vIndex} = 1
local _ls = _e[string.char(108,111,97,100,115,116,114,105,110,103)]

while ${vIndex} <= #${vTable} do
    local _hex = ${vTable}[${vIndex}]
    local _dec = ""
    for i = 1, #_hex, 2 do
        local b = tonumber(_hex:sub(i, i+1), 16)
        b = (b - ((${vIndex} - 1) * 5)) % 256
        b = bit32.bxor(b, (${vSalt} + (i-1)/2) % 256)
        _dec = _dec .. string.char(b)
    end
    
    local _f = _ls(_dec)
    if _f then
        local _env = _e
        setfenv(_f, _env)
        pcall(_f)
    end
    
    ${vIndex} = ${vIndex} + 1
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

        const finalObfuscatedCode = luarixV9Obfuscate(code);
        const id = crypto.randomBytes(16).toString('hex');
        
        const { error } = await supabase.from('scripts').insert({ id: id, name: name, lua_code: finalObfuscatedCode, original_code: original_code, api_key: api_key, keyless: keyless || false });
        if (error) throw error;
        return res.status(200).json({ success: true, id: id });
    } catch (error) { return res.status(500).json({ error: error.message }); }
}
