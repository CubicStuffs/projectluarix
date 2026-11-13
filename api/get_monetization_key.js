import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    const { script_id } = req.query;
    if (!script_id) return res.status(400).send('Missing script ID.');

    // Check if script exists and has monetization enabled
    const { data: script } = await supabase.from('scripts').select('name, monetization_provider').eq('id', script_id).single();
    if (!script) return res.status(404).send('Script not found.');

    const key = "LXR-MON-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Save key to database
    await supabase.from('monetization_keys').insert({ script_id, key });

    // Return a beautiful HTML page telling them to copy the key
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Luarix | Your Key</title>
        <style>
            body { background: #08080a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: #0f111a; border: 1px solid #1a1d2d; padding: 3rem; border-radius: 12px; text-align: center; }
            h1 { color: #f5c518; margin-bottom: 1rem; }
            .key { font-family: monospace; font-size: 1.5rem; background: #000; padding: 1rem; border-radius: 8px; border: 1px solid #f5c518; margin: 2rem 0; color: #f5c518; letter-spacing: 2px; }
            p { color: #8892b0; }
        </style>
    </head>
    <body>
        <div class="box">
            <h1>Thank you for completing the steps!</h1>
            <p>Here is your 1-time key for <strong>${script.name}</strong>.</p>
            <div class="key" onclick="navigator.clipboard.writeText('${key}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='${key}', 1000);" style="cursor:pointer;" title="Click to copy">${key}</div>
            <p>Copy this key and paste it into the Roblox GUI.</p>
        </div>
    </body>
    </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}
