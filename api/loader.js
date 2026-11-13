import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { id, key, hwid } = req.query;
    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    // THE MAGIC WRAPPER: If no key is in the URL, send a script that grabs it locally
    if (!key) {
        const wrapper = `
local sk = script_key or ""
if sk == "" then
    warn("[Luarix] Auth Error: Please define script_key='YOUR_KEY' before running the loader.")
    return game.Players.LocalPlayer:Kick("Auth Error: Missing script_key.")
end
local h = gethwid and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId()
loadstring(game:HttpGet("https://${req.headers.host}/api/loader?id=${id}&key="..sk.."&hwid="..h))()
`;
        return res.status(200).send(wrapper);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');

        if (script.keyless) return res.status(200).send(script.lua_code);

        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) return sendAuthError(res, "Invalid script_key.");
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return sendAuthError(res, "This script_key has expired.");
        if (keyData.banned) return sendAuthError(res, "This key has been banned.");

        if (!keyData.hwid) {
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid) {
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        const newExecs = (keyData.executions || 0) + 1;
        await supabase.from('script_keys').update({ executions: newExecs }).eq('key', key);

        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + err.message);
    }
}

function sendAuthError(res, message) {
    res.status(200).send(`warn("[Luarix] Auth Error: ${message}")\ngame.Players.LocalPlayer:Kick("Auth Error: ${message}")`);
}
