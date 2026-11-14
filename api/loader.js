import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Get ID from the clean URL, and key/hwid from the hidden second request
    const { id, key, hwid } = req.query; 
    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    // ✅ NEW: CHECK IF OPENED IN BROWSER (Luarmor UI)
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Edge');

    if (isBrowser) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const host = req.headers.host;
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Luarix | Loadstring</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        background-color: #0f172a; color: #f8fafc;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        min-height: 100vh; padding: 1rem;
                    }
                    .container { width: 100%; max-width: 850px; text-align: center; }
                    .header { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; color: #f8fafc; }
                    .header img { height: 40px; filter: drop-shadow(0 0 10px rgba(245, 197, 24, 0.3)); }
                    .code-box {
                        background-color: #1e293b; border: 1px solid #334155; border-radius: 12px;
                        padding: 1.5rem; position: relative; text-align: left; overflow-x: auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    }
                    .code-box::-webkit-scrollbar { height: 8px; }
                    .code-box::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
                    .code-box::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
                    .code-content {
                        font-family: 'Consolas', 'Courier New', monospace; font-size: 0.95rem;
                        line-height: 1.6; white-space: pre; padding-right: 50px;
                    }
                    .keyword { color: #f472b6; }
                    .string { color: #10b981; }
                    .comment { color: #64748b; font-style: italic; }
                    .function { color: #3b82f6; }
                    .copy-btn {
                        position: absolute; top: 1.2rem; right: 1.2rem; background-color: #334155;
                        color: #f8fafc; border: none; padding: 0.5rem 1rem; border-radius: 6px;
                        cursor: pointer; font-weight: 600; transition: 0.2s;
                    }
                    .copy-btn:hover { background-color: #475569; }
                    .footer { margin-top: 1.5rem; font-size: 0.95rem; color: #94a3b8; line-height: 1.6; }
                    .footer span { color: #f5c518; font-weight: 800; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://${host}/logo.png" alt="Luarix Logo">
                        Loadstring
                    </div>
                    <div class="code-box">
                        <button class="copy-btn" onclick="copyCode()">Copy</button>
                        <div class="code-content" id="luaCode"><span class="keyword">script_key</span> = <span class="string">"YOUR_KEY_HERE"</span>; <span class="comment">-- A key might be required, if not, delete this line.</span>
<span class="function">loadstring</span>(game:<span class="function">HttpGet</span>(<span class="string">"https://${host}/api/loader/${id}"</span>))()</div>
                    </div>
                    <div class="footer">
                        Contents cannot be displayed on browser.<br>
                        <span>PROTECTED BY LUARIX</span>
                    </div>
                </div>
                <script>
                    function copyCode() {
                        const code = document.getElementById('luaCode').innerText;
                        navigator.clipboard.writeText(code).then(() => {
                            const btn = document.querySelector('.copy-btn');
                            btn.innerText = 'Copied!';
                            btn.style.color = '#10b981';
                            setTimeout(() => { btn.innerText = 'Copy'; btn.style.color = '#f8fafc'; }, 2000);
                        });
                    }
                </script>
            </body>
            </html>
        `);
    }

    // ✅ EXECUTOR LOGIC (ROBLOX) - Tumhara original logic
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // THE MAGIC WRAPPER: If no key is provided, send a tiny script that grabs it from the executor.
    if (!key) {
        const wrapper = `
if not script_key or script_key == "" then
    warn("[Luarix] Auth Error: You need a script_key to access this script.")
    return game.Players.LocalPlayer:Kick("Auth Error: Missing script_key.")
end
local h = gethwid and gethwid() or game:GetService("RbxAnalyticsService"):GetClientId()
local url = "https://${req.headers.host}/api/loader/${id}?key="..script_key.."&hwid="..h
loadstring(game:HttpGet(url))()
`;
        return res.status(200).send(wrapper);
    }

    // IF KEY IS PRESENT, VALIDATE AND SEND SCRIPT
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');
        // ✅ KILL SWITCH CHECK
        if (script.is_disabled) {
            return res.status(200).send('warn("[Luarix] This script has been temporarily disabled by the owner.")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
        }

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
