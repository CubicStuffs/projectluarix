import { createClient } from '@supabase/supabase-js';

// PASTE YOUR SUPABASE URL AND PUBLISHABLE KEY HERE
const supabaseUrl = 'https://djvpvxxpuvwbopzwtmgi.supabase.co';
const supabaseKey = 'sb_publishable_rz3itIinBmVWzhDlwgQV6g_EqrJ4MfI'; // Starts with sb_publishable_...

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // Get the ID, Key, and HWID from the Roblox loader URL
    const { id, key, hwid } = req.query;

    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    try {
        // 1. Fetch Script from Supabase
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');

        // 2. Keyless Bypass (If script is free)
        if (script.keyless) {
            return sendLua(res, script.lua_code);
        }

        // 3. Check if Key is provided
        if (!key) {
            return sendAuthError(res, "You need a script_key to access this script. No key found.");
        }

        // 4. Validate Key
        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) {
            return sendAuthError(res, "Invalid script_key.");
        }

        // Check Expiry
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return sendAuthError(res, "This script_key has expired.");
        }

        // 5. HWID Locking
        if (!keyData.hwid) {
            // First time use: Lock HWID to this player's device
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid) {
            // Someone else trying to use it
            return sendAuthError(res, "HWID Mismatch. This key is locked to another device.");
        }

        // 6. Success - Send the script
        return sendLua(res, script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Error');
    }
}

// Helper to send plain Lua code
function sendLua(res, code) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(code);
}

// Helper to send the Error GUI that kicks the player
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
    sendLua(res, errorScript);
}
