import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { id, key, hwid } = req.query; 
    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isExecutor = userAgent.includes('roblox') || userAgent.includes('delta') || userAgent.includes('arceus') || userAgent.includes('fluxus') || userAgent.includes('codex') || userAgent.includes('solara');
    const isBrowser = (userAgent.includes('mozilla') || userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('edge')) && !isExecutor;

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
                    body { background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
                    .container { width: 100%; max-width: 850px; text-align: center; }
                    .header { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; color: #f8fafc; }
                    .header img { height: 40px; filter: drop-shadow(0 0 10px rgba(245, 197, 24, 0.3)); }
                    .code-box { background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; position: relative; text-align: left; overflow-x: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                    .code-content { font-family: 'Consolas', 'Courier New', monospace; font-size: 0.95rem; line-height: 1.6; white-space: pre; padding-right: 50px; }
                    .keyword { color: #f472b6; }
                    .string { color: #10b981; }
                    .comment { color: #64748b; font-style: italic; }
                    .function { color: #3b82f6; }
                    .copy-btn { position: absolute; top: 1.2rem; right: 1.2rem; background-color: #334155; color: #f8fafc; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; }
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

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    if (!key) {
        const wrapper = `
-- Luarix Universal Loader (Mobile Supported)
local function getHWID()
    local hwid = "unknown_mobile"
    pcall(function()
        if gethwid then hwid = gethwid() end
        if not hwid or hwid == "" or hwid == "unknown_mobile" then
            local rbx = game:GetService("RbxAnalyticsService")
            if rbx then hwid = rbx:GetClientId() end
        end
    end)
    if not hwid or hwid == "" or hwid == "unknown_mobile" then
        pcall(function() hwid = tostring(game.Players.LocalPlayer.UserId) .. "_mobile" end)
    end
    return tostring(hwid)
end

local function universalHttpGet(url)
    local reqFunc = nil
    if syn and syn.request then reqFunc = syn.request
    elseif http and http.request then reqFunc = http.request
    elseif http_request then reqFunc = http_request
    elseif request then reqFunc = request
    elseif fluxus and fluxus.request then reqFunc = fluxus.request
    elseif getgenv().request then reqFunc = getgenv().request
    end
    
    if reqFunc then
        local ok, res = pcall(reqFunc, {Url = url, Method = "GET"})
        if ok and res and res.Body then return res.Body end
    end
    return game:HttpGet(url)
end

if not script_key or script_key == "" then
    warn("[Luarix] Auth Error: You need a script_key to access this script.")
    return game.Players.LocalPlayer:Kick("Auth Error: Missing script_key.")
end

local h = getHWID()
local url = "https://${req.headers.host}/api/loader/${id}?key="..script_key.."&hwid="..h

local success, err = pcall(function()
    local code = universalHttpGet(url)
    local func, loadErr = loadstring(code)
    if func then func() else warn("[Luarix] Load error: "..tostring(loadErr)) end
end)

if not success then
    warn("[Luarix] HTTP/Load error: "..tostring(err))
end
`;
        return res.status(200).send(wrapper);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');
        
        if (script.is_disabled) {
            return res.status(200).send('warn("[Luarix] This script has been temporarily disabled by the owner.")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
        }

        // ✅ FIX 1: Keyless scripts ka bhi execution count badhao
        if (script.keyless) {
            // Naya SQL function call karo script ID ke sath
            await supabase.rpc('increment_executions', { script_id: id });
            return res.status(200).send(script.lua_code);
        }

        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) return sendAuthError(res, "Invalid script_key.");
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return sendAuthError(res, "This script_key has expired.");
        if (keyData.banned) return sendAuthError(res, "This key has been banned.");

        if (!keyData.hwid || keyData.hwid === "unknown" || keyData.hwid === "" || keyData.hwid.includes("_mobile")) {
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid && !hwid.includes("_mobile")) {
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        // Key executions update
        const newExecs = (keyData.executions || 0) + 1;
        await supabase.from('script_keys').update({ executions: newExecs }).eq('key', key);

        // ✅ FIX 2: Scripts table mein executions aur last_used update karo
        await supabase.rpc('increment_executions', { script_id: id });

        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + err.message);
    }
}

function sendAuthError(res, message) {
    res.status(200).send(`warn("[Luarix] Auth Error: ${message}")\ngame.Players.LocalPlayer:Kick("Auth Error: ${message}")`);
}
