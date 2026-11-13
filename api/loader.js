import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { id, key, hwid } = req.query;

    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        // 1. Fetch Script
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        
        if (scriptErr) return res.status(500).send('-- Database Error: ' + scriptErr.message);
        if (!script) return res.status(404).send('-- Error: Script not found.');

        // 2. If Keyless, bypass everything and send the code
        if (script.keyless) return res.status(200).send(script.lua_code);

        // 3. THE MAGIC: If no key or hwid is in the URL, send the Wrapper Script!
        if (!key && !hwid) {
            const wrapper = `
-- Luarix Clean Loader
if not script_key then script_key = "" end
local hwid = gethwid and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId()
local url = "https://${req.headers.host}/api/loader?id=${id}&key="..script_key.."&hwid="..hwid
loadstring(game:HttpGet(url))()
`;
            return res.status(200).send(wrapper);
        }

        // 4. Validate Key (This runs on the second request)
        if (!key) return sendAuthError(res, "You need a script_key to access this script.");
        
        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) {
            return sendAuthError(res, "Invalid script_key.");
        }

        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return sendAuthError(res, "This script_key has expired.");
        }

        // 5. HWID Locking
        if (!keyData.hwid) {
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid) {
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        // 6. Send the actual obfuscated code
        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + err.message);
    }
}

// Real Kick Error
function sendAuthError(res, message) {
    const errorScript = `
warn("[Luarix] Auth Error: ${message}")
game.Players.LocalPlayer:Kick("Auth Error: ${message}")
`;
    res.status(200).send(errorScript);
}
