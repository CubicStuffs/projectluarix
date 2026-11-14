import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function customObfuscate(luaCode) {
    const key = Math.floor(Math.random() * 200) + 10;
    const bytes = new TextEncoder().encode(luaCode);
    let hex = ""; 
    for (let i = 0; i < bytes.length; i++) {
        hex += (bytes[i] ^ key).toString(16).padStart(2, '0');
    }
    
    const chunkSize = 500;
    let chunks = [];
    for (let i = 0; i < hex.length; i += chunkSize) {
        chunks.push(hex.substring(i, i + chunkSize));
    }
    
    const v1 = "_" + crypto.randomBytes(3).toString('hex');
    const v2 = "_" + crypto.randomBytes(3).toString('hex');
    
    // ✅ SIRF ENCRYPTION, NO INFINITE LOOPS
    const obfuscatedCode = `
local ${v1} = { ${chunks.map((c) => `"${c}"`).join(',\n')} }
local ${v2} = ${key}

local function ${v1}_d()
    local _h = table.concat(${v1}, "")
    return _h:gsub("%x%x", function(c) 
        return string.char(bit32.bxor(tonumber(c, 16), ${v2})) 
    end)
end

local _s, _c = pcall(${v1}_d)
if _s and _c then
    local _f, _e = loadstring(_c)
    if _f then pcall(_f) end
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

        const finalObfuscatedCode = customObfuscate(code);
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
