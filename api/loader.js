import { createClient } from '@supabase/supabase-js';

// Simple in-memory rate limit (per isolate; best-effort on Vercel)
const hits = globalThis.__luarixHits || (globalThis.__luarixHits = new Map());

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 45;
  let entry = hits.get(ip);
  if (!entry || now - entry.t > windowMs) {
    entry = { t: now, n: 0 };
    hits.set(ip, entry);
  }
  entry.n += 1;
  return entry.n > max;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, key, hwid } = req.query;
  if (!id) return res.status(400).send('-- Error: Missing script ID.');

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).send('warn("[Luarix] Too many requests")\nreturn');
  }

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const accept = (req.headers['accept'] || '').toLowerCase();

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
    userAgent.includes('hydrogen') ||
    userAgent.includes('electron') ||
    userAgent.includes('evon') ||
    userAgent.includes('comet') ||
    userAgent.includes('mobile') ||
    userAgent.length < 25;

  const wantsHtml = accept.includes('text/html');
  const isBrowser =
    wantsHtml &&
    !isExecutor &&
    (userAgent.includes('mozilla') ||
      userAgent.includes('chrome') ||
      userAgent.includes('safari') ||
      userAgent.includes('edge') ||
      userAgent.includes('firefox'));

  if (isBrowser) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const host = req.headers.host;
    return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Luarix</title></head>
<body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center"><h2 style="color:#f8fafc">Protected by Luarix</h2>
<p>Script payload is not available in browsers.</p>
<code style="color:#10b981">loadstring(game:HttpGet("https://${host}/api/loader/${id}"))()</code>
</div></body></html>`);
  }

  // Block common scraper bots from getting raw lua
  if (
    userAgent.includes('python-requests') ||
    userAgent.includes('curl/') ||
    userAgent.includes('wget') ||
    userAgent.includes('scrapy') ||
    userAgent.includes('httpclient') ||
    userAgent.includes('postman')
  ) {
    return res.status(403).send('-- Forbidden');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
    if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');

    if (script.is_disabled) {
      return res.status(200).send('warn("[Luarix] This script has been temporarily disabled by the owner.")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
    }

    if (script.keyless) {
      try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}
      return res.status(200).send(script.lua_code);
    }

    if (!key) {
      const host = req.headers.host || 'getluarix.vercel.app';
      const wrapper = `
-- Luarix Universal Loader (PC + Mobile)
local function getHWID()
  local hwid = "unknown"
  pcall(function() if gethwid then hwid = tostring(gethwid()) end end)
  if hwid == "unknown" or hwid == "" then
    pcall(function()
      local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
      if ok and id then hwid = tostring(id) end
    end)
  end
  if hwid == "unknown" or hwid == "" then
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
    if ok and res then body = res.Body or res.body end
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
  if not code or code == "" then warn("[Luarix] Empty response") return end
  if code:sub(1, 9) == "<!DOCTYPE" or code:sub(1, 5) == "<html" then
    warn("[Luarix] HTML response — not a script") return
  end
  local fn, loadErr = loadstring(code)
  if not fn then warn("[Luarix] Load error: " .. tostring(loadErr)) return end
  fn()
end)
if not success then warn("[Luarix] Error: " .. tostring(err)) end
`;
      return res.status(200).send(wrapper);
    }

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
