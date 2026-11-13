import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { id, key, hwid } = req.query;

    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        // Fetch Script
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        
        // NEW: If there is a DB error, print it to the browser!
        if (scriptErr) {
            return res.status(500).send('-- Database Error: ' + scriptErr.message);
        }
        if (!script) {
            return res.status(404).send('-- Error: Script not found.');
        }

        if (script.keyless) return res.status(200).send(script.lua_code);
        if (!key) return sendAuthError(res, "You need a script_key to access this script.");

        // Validate Key
        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        
        if (keyErr || !keyData || keyData.script_id !== id) {
            return sendAuthError(res, "Invalid script_key.");
        }

        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return sendAuthError(res, "This script_key has expired.");
        }

        // HWID Locking
        if (!keyData.hwid) {
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid) {
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + err.message);
    }
}

function sendAuthError(res, message) {
    const errorScript = `
local ScreenGui = Instance.new("ScreenGui")
local Frame = Instance.new("Frame")
local Title = Instance.new("TextLabel")
local Desc = Instance.new("TextLabel")
local Btn = Instance.new("TextButton")

ScreenGui.Parent = game:GetService("CoreGui")
Frame.Parent = ScreenGui
Frame.Size = UDim2.new(0, 400, 0, 200)
Frame.Position = UDim2.new(0.5, -200, 0.5, -100)
Frame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
Frame.BorderSizePixel = 0

Title.Parent = Frame
Title.Size = UDim2.new(1, 0, 0, 50)
Title.BackgroundTransparency = 1
Title.Text = "Auth Error"
Title.TextColor3 = Color3.fromRGB(255, 255, 255)
Title.Font = Enum.Font.GothamBold
Title.TextSize = 20

Desc.Parent = Frame
Desc.Size = UDim2.new(0.9, 0, 0, 80)
Desc.Position = UDim2.new(0.05, 0, 0.3, 0)
Desc.BackgroundTransparency = 1
Desc.Text = "${message}"
Desc.TextColor3 = Color3.fromRGB(200, 200, 200)
Desc.Font = Enum.Font.Gotham
Desc.TextSize = 14
Desc.TextWrapped = true

Btn.Parent = Frame
Btn.Size = UDim2.new(0.9, 0, 0, 40)
Btn.Position = UDim2.new(0.05, 0, 0.75, 0)
Btn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
Btn.Text = "Leave"
Btn.TextColor3 = Color3.fromRGB(0, 0, 0)
Btn.Font = Enum.Font.GothamBold
Btn.TextSize = 16

Btn.MouseButton1Click:Connect(function()
    game.Players.LocalPlayer:Kick("Auth Error: ${message}")
end)
`;
    res.status(200).send(errorScript);
}
