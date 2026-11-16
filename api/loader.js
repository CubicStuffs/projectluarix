export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const id = req.query.id;
    const key = req.query.key;
    const hwid = req.query.hwid;

    if (!id) {
        return res.status(400).send('-- [Luarix] Error: Missing script ID.');
    }

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    const isExecutor =
        userAgent.includes('roblox') ||
        userAgent.includes('delta') ||
        userAgent.includes('arceus') ||
        userAgent.includes('fluxus') ||
        userAgent.includes('codex') ||
        userAgent.includes('solara') ||
        userAgent.includes('synapse') ||
        userAgent.includes('script-ware') ||
        userAgent.includes('wave') ||
        userAgent.includes('oxygen') ||
        userAgent.includes('krnl') ||
        userAgent.includes('electron');

    const isBrowser =
        (userAgent.includes('mozilla') ||
            userAgent.includes('chrome') ||
            userAgent.includes('safari') ||
            userAgent.includes('edge') ||
            userAgent.includes('firefox')) &&
        !isExecutor;

    // ========== BROWSER ==========
    if (isBrowser) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const host = req.headers.host || 'getluarix.vercel.app';

        const html = `<!DOCTYPE html>
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
.code-content{font-family:Consolas,monospace;font-size:0.95rem;line-height:1.6;white-space:pre;padding-right:50px}
.keyword{color:#f472b6}.string{color:#10b981}.comment{color:#64748b;font-style:italic}.function{color:#3b82f6}
.copy-btn{position:absolute;top:1.2rem;right:1.2rem;background:#334155;color:#f8fafc;border:none;padding:0.5rem 1rem;border-radius:6px;cursor:pointer;font-weight:600}
.copy-btn:hover{background:#475569}
.footer{margin-top:1.5rem;font-size:0.95rem;color:#94a3b8}
.footer span{color:#f5c518;font-weight:800}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="https://${host}/logo.png" alt="Luarix" onerror="this.style.display='none'">
    Loadstring
  </div>
  <div class="code-box">
    <button class="copy-btn" onclick="copyCode()">Copy</button>
    <div class="code-content" id="luaCode"><span class="keyword">script_key</span> = <span class="string">"YOUR_KEY_HERE"</span>; <span class="comment">-- Remove this line if Keyless</span>
<span class="function">loadstring</span>(game:<span class="function">HttpGet</span>(<span class="string">"https://${host}/api/loader/${id}"</span>))()</div>
  </div>
  <div class="footer">
    Contents cannot be displayed in browser.<br>
    <span>PROTECTED BY LUARIX</span>
  </div>
</div>
<script>
function copyCode(){
  const code=document.getElementById('luaCode').innerText;
  navigator.clipboard.writeText(code).then(function(){
    var btn=document.querySelector('.copy-btn');
    btn.innerText='Copied!';
    btn.style.color='#10b981';
    setTimeout(function(){btn.innerText='Copy';btn.style.color='#f8fafc'},2000);
  });
}
</script>
</body>
</html>`;

        return res.status(200).send(html);
    }

    // ========== EXECUTOR ==========
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // No key → return wrapper
    if (!key) {
        const host = req.headers.host || 'getluarix.vercel.app';

        const wrapper = `-- Luarix Loader
local function getHWID()
    local h = "unknown"
    pcall(function()
        if gethwid then h = tostring(gethwid()) end
    end)
    if h == "unknown" or h == "" then
        pcall(function()
            local s = game:GetService("RbxAnalyticsService")
            if s then h = s:GetClientId() end
        end)
    end
    if h == "unknown" or h == "" then
        pcall(function()
            local lp = game:GetService("Players").LocalPlayer
            if lp then h = tostring(lp.UserId) .. "_uid" end
        end)
    end
    return tostring(h)
end

local function httpGet(url)
    local ok, result = pcall(function()
        if syn and syn.request then
            local r = syn.request({Url = url, Method = "GET"})
            return r and r.Body
        end
        if http_request then
            local r = http_request({Url = url, Method = "GET"})
            return r and r.Body
        end
        if request then
            local r = request({Url = url, Method = "GET"})
            return r and r.Body
        end
        if fluxus and fluxus.request then
            local r = fluxus.request({Url = url, Method = "GET"})
            return r and r.Body
        end
        return game:HttpGet(url)
    end)
    if ok then return result end
    return nil
end

if type(script_key) ~= "string" or script_key == "" then
    warn("[Luarix] Missing script_key")
    pcall(function() game.Players.LocalPlayer:Kick("Luarix: Missing script_key") end)
    return
end

local h = getHWID()
local url = "https://${host}/api/loader/${id}?key=" .. tostring(script_key) .. "&hwid=" .. tostring(h)

local code = httpGet(url)
if not code or code == "" then
    warn("[Luarix] Empty response from server")
    return
end

local fn, err = loadstring(code)
if not fn then
    warn("[Luarix] loadstring error: " .. tostring(err))
    return
end

local ok, runtimeErr = pcall(fn)
if not ok then
    warn("[Luarix] Runtime error: " .. tostring(runtimeErr))
end
`;

        return res.status(200).send(wrapper);
    }

    // Key provided → auth + return code
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res.status(500).send('-- [Luarix] Server misconfigured');
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase
            .from('scripts')
            .select('*')
            .eq('id', id)
            .single();

        if (scriptErr || !script) {
            return res.status(200).send('warn("[Luarix] Script not found")\ngame.Players.LocalPlayer:Kick("Script not found")');
        }

        if (script.is_disabled) {
            return res.status(200).send('warn("[Luarix] Script is disabled")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
        }

        // Keyless
        if (script.keyless) {
            try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}
            return res.status(200).send(script.lua_code || 'warn("[Luarix] Empty script")');
        }

        // Validate key
        const { data: keyData, error: keyErr } = await supabase
            .from('script_keys')
            .select('*')
            .eq('key', key)
            .single();

        if (keyErr || !keyData || keyData.script_id !== id) {
            return sendAuthError(res, 'Invalid script_key');
        }

        if (keyData.banned) {
            return sendAuthError(res, 'Key banned');
        }

        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return sendAuthError(res, 'Key expired');
        }

        // HWID logic
        const incoming = (hwid || 'unknown').toString();
        const stored = (keyData.hwid || '').toString();

        const isWeak = function(h) {
            return !h || h === 'unknown' || h === '' || h.indexOf('_mobile') !== -1 || h.indexOf('unknown_mobile') !== -1 || h.indexOf('_uid') !== -1;
        };

        if (isWeak(stored)) {
            await supabase.from('script_keys').update({ hwid: incoming }).eq('key', key);
        } else if (stored !== incoming && !isWeak(incoming)) {
            return sendAuthError(res, 'HWID Mismatch. Reset HWID from panel.');
        }

        // Count execution
        const newExecs = (keyData.executions || 0) + 1;
        await supabase.from('script_keys').update({ executions: newExecs }).eq('key', key);
        try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}

        if (!script.lua_code || script.lua_code.trim() === '') {
            return res.status(200).send('warn("[Luarix] Script has no code. Re-upload from dashboard.")');
        }

        return res.status(200).send(script.lua_code);

    } catch (err) {
        console.error('Luarix Loader Error:', err);
        return res.status(200).send('-- [Luarix] Server Error: ' + (err.message || 'Unknown'));
    }
}
