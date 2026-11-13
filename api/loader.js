import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { id, key, hwid } = req.query;
    if (!id) return res.status(400).send('-- Error: Missing script ID.');

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        const { data: script, error: scriptErr } = await supabase.from('scripts').select('*').eq('id', id).single();
        if (scriptErr || !script) return res.status(404).send('-- Error: Script not found.');

        // 1. If Keyless and Monetization is ON, return the custom GUI
        if (script.keyless && script.monetization_link) {
            return res.status(200).send(generateMonetizationGUI(script.monetization_link, script.id));
        }

        // 2. If Keyless and no Monetization, return raw script
        if (script.keyless) {
            return res.status(200).send(script.lua_code);
        }

        // 3. Normal Key System (if not keyless)
        if (!key) return sendAuthError(res, "You need a script_key to access this script.");
        const { data: keyData, error: keyErr } = await supabase.from('script_keys').select('*').eq('key', key).single();
        if (keyErr || !keyData || keyData.script_id !== id) return sendAuthError(res, "Invalid script_key.");
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return sendAuthError(res, "This script_key has expired.");
        
        if (!keyData.hwid) {
            await supabase.from('script_keys').update({ hwid: hwid }).eq('key', key);
        } else if (keyData.hwid !== hwid) {
            return sendAuthError(res, "HWID Mismatch.");
        }

        const newExecs = (keyData.executions || 0) + 1;
        await supabase.from('script_keys').update({ executions: newExecs }).eq('key', key);

        return res.status(200).send(script.lua_code);

    } catch (err) {
        return res.status(500).send('-- Server Exception: ' + err.message);
    }
}

function generateMonetizationGUI(link, scriptId) {
    return `
-- Luarix Monetization GUI
local ScreenGui = Instance.new("ScreenGui")
local Frame = Instance.new("Frame")
local Title = Instance.new("TextLabel")
local Desc = Instance.new("TextLabel")
local GetKeyBtn = Instance.new("TextButton")
local KeyBox = Instance.new("TextBox")
local VerifyBtn = Instance.new("TextButton")
local CopyBtn = Instance.new("TextButton")

ScreenGui.Parent = game:GetService("CoreGui")
Frame.Parent = ScreenGui
Frame.Size = UDim2.new(0, 400, 0, 250)
Frame.Position = UDim2.new(0.5, -200, 0.5, -125)
Frame.BackgroundColor3 = Color3.fromRGB(15, 17, 26)
Frame.BorderSizePixel = 0

Title.Parent = Frame
Title.Size = UDim2.new(1, 0, 0, 40)
Title.BackgroundTransparency = 1
Title.Text = "🔒 Luarix Verification"
Title.TextColor3 = Color3.fromRGB(245, 197, 24)
Title.Font = Enum.Font.GothamBold
Title.TextSize = 20

Desc.Parent = Frame
Desc.Size = UDim2.new(0.9, 0, 0, 30)
Desc.Position = UDim2.new(0.05, 0, 0.15, 0)
Desc.BackgroundTransparency = 1
Desc.Text = "Complete the steps to get your key."
Desc.TextColor3 = Color3.fromRGB(136, 146, 176)
Desc.Font = Enum.Font.Gotham
Desc.TextSize = 12

GetKeyBtn.Parent = Frame
GetKeyBtn.Size = UDim2.new(0.9, 0, 0, 35)
GetKeyBtn.Position = UDim2.new(0.05, 0, 0.3, 0)
GetKeyBtn.BackgroundColor3 = Color3.fromRGB(88, 101, 242)
GetKeyBtn.Text = "Get Key (Copy Link)"
GetKeyBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
GetKeyBtn.Font = Enum.Font.GothamBold

CopyBtn.Parent = Frame
CopyBtn.Size = UDim2.new(0.45, 0, 0, 25)
CopyBtn.Position = UDim2.new(0.05, 0, 0.48, 0)
CopyBtn.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
CopyBtn.Text = "Copy Link Again"
CopyBtn.TextColor3 = Color3.fromRGB(200, 200, 200)
CopyBtn.Font = Enum.Font.Gotham

KeyBox.Parent = Frame
KeyBox.Size = UDim2.new(0.9, 0, 0, 35)
KeyBox.Position = UDim2.new(0.05, 0, 0.65, 0)
KeyBox.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
KeyBox.PlaceholderText = "Paste Key Here..."
KeyBox.Text = ""
KeyBox.TextColor3 = Color3.fromRGB(255, 255, 255)
KeyBox.Font = Enum.Font.Gotham

VerifyBtn.Parent = Frame
VerifyBtn.Size = UDim2.new(0.9, 0, 0, 35)
VerifyBtn.Position = UDim2.new(0.05, 0, 0.85, 0)
VerifyBtn.BackgroundColor3 = Color3.fromRGB(16, 185, 129)
VerifyBtn.Text = "Verify & Execute"
VerifyBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
VerifyBtn.Font = Enum.Font.GothamBold

local link = "${link}"
local scriptUrl = "https://luarix-eight.vercel.app/api/verify_monetization?id=${scriptId}&key="

local function setClipboard(text)
    if setclipboard then setclipboard(text) else toclipboard(text) end
end

GetKeyBtn.MouseButton1Click:Connect(function()
    setClipboard(link)
    GetKeyBtn.Text = "Link Copied! Opening..."
    task.wait(1)
    GetKeyBtn.Text = "Get Key (Copy Link)"
end)

CopyBtn.MouseButton1Click:Connect(function()
    setClipboard(link)
    CopyBtn.Text = "Copied!"
    task.wait(1)
    CopyBtn.Text = "Copy Link Again"
end)

VerifyBtn.MouseButton1Click:Connect(function()
    if KeyBox.Text == "" then return end
    VerifyBtn.Text = "Verifying..."
    local success, res = pcall(function() return game:HttpGet(scriptUrl .. KeyBox.Text) end)
    if success and res and not res:find("Invalid") then
        VerifyBtn.Text = "Success!"
        Frame:Destroy()
        loadstring(res)()
    else
        VerifyBtn.Text = "Invalid Key!"
        task.wait(2)
        VerifyBtn.Text = "Verify & Execute"
    end
end)
    `;
}

function sendAuthError(res, message) {
    res.status(200).send(`warn("[Luarix] ${message}") game.Players.LocalPlayer:Kick("Auth Error: ${message}")`);
}
