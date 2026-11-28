import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, key, hwid } = req.query;
    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const accept = (req.headers['accept'] || '').toLowerCase();

    // Expanded executor detection (PC + Mobile)
    const isExecutor =
        userAgent.includes('roblox') ||
        userAgent.includes('delta') ||
        userAgent.includes('arceus') ||
        userAgent.includes('fluxus') ||
        userAgent.includes('codex') ||
        userAgent.includes('solara') ||
        userAgent.includes('wave') ||
        userAgent.includes('synapse') ||
        userAgent.includes('script-ware') ||
        userAgent.includes('krnl') ||
        userAgent.includes('electron') ||
        userAgent.includes('hydrogen') ||
        userAgent.includes('evon') ||
        userAgent.includes('comet') ||
        userAgent.includes('mobile') ||
        // Many mobile executors send empty / short UA
        userAgent.length < 20;

    // Only show HTML page when a real browser is navigating (wants HTML)
    const wantsHtml = accept.includes('text/html');
    const isBrowser = wantsHtml && !isExecutor && (
        userAgent.includes('mozilla') ||
        userAgent.includes('chrome') ||
        userAgent.includes('safari') ||
        userAgent.includes('edge') ||
        userAgent.includes('firefox')
    );

    if (isBrowser) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const host = req.headers.host;
        return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Luarix | Loadstring</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.container{width:100%;max-width:850px;text-align:center}
.header{display:flex;align-items:center;justify-content:center;gap:12px;font-size:1.3rem;font-weight:700;margin-bottom:1.5rem}
.header img{height:40px}
.code-box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem;position:relative;text-align:left;overflow-x:auto}
.code-content{font-family:Consolas,'Courier New',monospace;font-size:0.95rem;line-height:1.6;white-space:pre;padding-right:50px}
.keyword{color:#f472b6}.string{color:#10b981}.comment{color:#64748b;font-style:italic}.function{color:#3b82f6}
.copy-btn{position:absolute;top:1.2rem;right:1.2rem;background:#334155;color:#f8fafc;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-weight:600}
.footer{margin-top:1.5rem;font-size:0.95rem;color:#94a3b8}.footer span{color:#f5c518;font-weight:800}
</style>
</head>
<body>
<div class="container">
<div class="header"><img src="https://${host}/logo.png" alt="Luarix"> Loadstring</div>
<div class="code-box">
<button class="copy-btn" onclick="copyCode()">Copy</button>
<div class="code-content" id="luaCode"><span class="keyword">loadstring</span>(game:<span class="function">HttpGet</span>(<span class="string">"https://${host}/api/loader/${id}"</span>))()</div>
</div>
<div class="footer">Contents cannot be displayed on browser.<br><span>PROTECTED BY LUARIX</span></div>
</div>
<script>
function copyCode(){navigator.clipboard.writeText(document.getElementById('luaCode').innerText).then(()=>{const b=document.querySelector('.copy-btn');b.innerText='Copied!';setTimeout(()=>b.innerText='Copy',2000)})}
</script>
</body>
</html>`);
    }

    // From here → always return plain Lua (for executors)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');

        if (script.is_disabled) {
            return res.status(200).send('warn("[Luarix] This script has been temporarily disabled by the owner.")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
        }

        // KEYLESS → direct script (PC + Mobile)
        if (script.keyless) {
            try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}
            return res.status(200).send(script.lua_code);
        }

        // Key required but no key given → return universal wrapper
        if (!key) {
            const host = req.headers.host || 'getluarix.vercel.app';
            const wrapper = `
-- Luarix Universal Loader (PC + Mobile)
local function getHWID()
    local hwid = "unknown"
    pcall(function()
        if gethwid then hwid = tostring(gethwid()) end
    end)
    if not hwid or hwid == "" or hwid == "unknown" then
        pcall(function()
            local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
            if ok and id then hwid = tostring(id) end
        end)
    end
    if not hwid or hwid == "" or hwid == "unknown" then
        pcall(function()
            if game.Players and game.Players.LocalPlayer then
                hwid = tostring(game.Players.LocalPlayer.UserId) .. "_user"
            end
        end)
    end
    return tostring(hwid or "unknown")
end

local function universalHttpGet(url)
    local body = nil
    local req = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request) or (getgenv and getgenv().request)
    if req then
        local ok, res = pcall(req, {Url = url, Method = "GET"})
        if ok and res then
            body = res.Body or res.body
        end
    end
    if not body or body == "" then
        local ok, res = pcall(function() return game:HttpGet(url) end)
        if ok then body = res end
    end
    return body or ""
end

if not script_key or script_key == "" then
    warn("[Luarix] Auth Error: You need a script_key.")
    return game.Players.LocalPlayer:Kick("Auth Error: Missing script_key.")
end

local h = getHWID()
local url = "https://${host}/api/loader/${id}?key=" .. tostring(script_key) .. "&hwid=" .. h

local success, err = pcall(function()
    local code = universalHttpGet(url)
    if not code or code == "" then
        warn("[Luarix] Empty response from server")
        return
    end
    if code:sub(1, 9) == "<!DOCTYPE" or code:sub(1, 5) == "<html" then
        warn("[Luarix] Server returned HTML instead of script. Contact owner.")
        return
    end
    local fn, loadErr = loadstring(code)
    if not fn then
        warn("[Luarix] Load error: " .. tostring(loadErr))
        return
    end
    fn()
end)

if not success then
    warn("[Luarix] Error: " .. tostring(err))
end
`;
            return res.status(200).send(wrapper);
        }

        // Key validation
        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) return sendAuthError(res, "Invalid script_key.");
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return sendAuthError(res, "This script_key has expired.");
        if (keyData.banned) return sendAuthError(res, "This key has been banned.");

        const incomingHwid = (hwid || "unknown").toString();
        if (!keyData.hwid || keyData.hwid === "unknown" || keyData.hwid === "" || keyData.hwid.includes("_mobile") || keyData.hwid.includes("_user")) {
            await supabase.from('script_keys').update({ hwid: incomingHwid }).eq('key', key);
        } else if (keyData.hwid !== incomingHwid && !incomingHwid.includes("_mobile") && !incomingHwid.includes("_user") && incomingHwid !== "unknown") {
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        await supabase.from('script_keys').update({ executions: (keyData.executions || 0) + 1 }).eq('key', key);
        try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}

        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + (err.message || 'Unknown'));
    }
}

function sendAuthError(res, message) {
    res.status(200).send(`warn("[Luarix] Auth Error: ${message}")\ngame.Players.LocalPlayer:Kick("Auth Error: ${message}")`);
}
