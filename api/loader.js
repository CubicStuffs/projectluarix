import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        const id = (req.query && req.query.id) ? String(req.query.id) : null;
        const key = (req.query && req.query.key) ? String(req.query.key) : null;
        const hwid = (req.query && req.query.hwid) ? String(req.query.hwid) : 'unknown';

        if (!id) {
            return res.status(400).send('-- [Luarix] Missing script ID');
        }

        const userAgent = String(req.headers['user-agent'] || '').toLowerCase();

        const isExecutor = (
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
            userAgent.includes('electron')
        );

        const isBrowser = (
            (userAgent.includes('mozilla') || userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('edge') || userAgent.includes('firefox')) 
            && !isExecutor
        );

        // ========== BROWSER ==========
        if (isBrowser) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            const host = req.headers.host || 'getluarix.vercel.app';
            return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Luarix</title>
<style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem;max-width:800px;width:90%}
code{color:#10b981;font-family:monospace;word-break:break-all}</style></head>
<body><div class="box"><h2>Luarix Loadstring</h2>
<code>script_key="YOUR_KEY_HERE";\nloadstring(game:HttpGet("https://${host}/api/loader/${id}"))()</code>
<p style="margin-top:1rem;color:#94a3b8">Protected by Luarix</p></div></body></html>`);
        }

        // ========== EXECUTOR ==========
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        // No key → wrapper
        if (!key) {
            const host = req.headers.host || 'getluarix.vercel.app';
            const wrapper = `-- Luarix Loader
local function getHWID()
    local h = "unknown"
    pcall(function() if gethwid then h = tostring(gethwid()) end end)
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

local ok2, runtimeErr = pcall(fn)
if not ok2 then
    warn("[Luarix] Runtime error: " .. tostring(runtimeErr))
end
`;
            return res.status(200).send(wrapper);
        }

        // ===== Authenticated path =====
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            return res.status(200).send('warn("[Luarix] Server misconfigured")');
        }

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

        // Get script
        let script = null;
        try {
            const result = await supabase.from('scripts').select('*').eq('id', id).single();
            script = result.data;
            if (result.error || !script) {
                return res.status(200).send('warn("[Luarix] Script not found")\ngame.Players.LocalPlayer:Kick("Script not found")');
            }
        } catch (e) {
            return res.status(200).send('warn("[Luarix] Database error (script)")');
        }

        if (script.is_disabled) {
            return res.status(200).send('warn("[Luarix] Script is disabled")\ngame.Players.LocalPlayer:Kick("Script Disabled")');
        }

        // Keyless
        if (script.keyless === true) {
            try { await supabase.rpc('increment_executions', { script_id: id }); } catch (e) {}
            return res.status(200).send(script.lua_code || 'warn("[Luarix] Empty script")');
        }

        // Validate key
        let keyData = null;
        try {
            const result = await supabase.from('script_keys').select('*').eq('key', key).single();
            keyData = result.data;
            if (result.error || !keyData || keyData.script_id !== id) {
                return res.status(200).send('warn("[Luarix] Auth Error: Invalid script_key")\ngame.Players.LocalPlayer:Kick("Invalid script_key")');
            }
        } catch (e) {
            return res.status(200).send('warn("[Luarix] Database error (key)")');
        }

        if (keyData.banned) {
            return res.status(200).send('warn("[Luarix] Auth Error: Key banned")\ngame.Players.LocalPlayer:Kick("Key banned")');
        }

        if (keyData.expires_at) {
            try {
                if (new Date(keyData.expires_at) < new Date()) {
                    return res.status(200).send('warn("[Luarix] Auth Error: Key expired")\ngame.Players.LocalPlayer:Kick("Key expired")');
                }
            } catch (e) {}
        }

        // HWID
        const incoming = hwid || 'unknown';
        const stored = (keyData.hwid || '').toString();

        const isWeak = (h) => {
            if (!h) return true;
            const s = String(h);
            return s === 'unknown' || s === '' || s.includes('_mobile') || s.includes('unknown_mobile') || s.includes('_uid');
        };

        try {
            if (isWeak(stored)) {
                await supabase.from('script_keys').update({ hwid: incoming }).eq('key', key);
            } else if (stored !== incoming && !isWeak(incoming)) {
                return res.status(200).send('warn("[Luarix] Auth Error: HWID Mismatch")\ngame.Players.LocalPlayer:Kick("HWID Mismatch")');
            }
        } catch (e) {
            // ignore HWID update errors
        }

        // Count
        try {
            const newExecs = (keyData.executions || 0) + 1;
            await supabase.from('script_keys').update({ executions: newExecs }).eq('key', key);
        } catch (e) {}

        try {
            await supabase.rpc('increment_executions', { script_id: id });
        } catch (e) {}

        // Return code
        if (!script.lua_code || String(script.lua_code).trim() === '') {
            return res.status(200).send('warn("[Luarix] Script has no code. Re-upload from dashboard.")');
        }

        return res.status(200).send(script.lua_code);

    } catch (err) {
        console.error('Luarix fatal error:', err);
        return res.status(200).send('-- [Luarix] Fatal: ' + (err && err.message ? err.message : 'Unknown error'));
    }
}
