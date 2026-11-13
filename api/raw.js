export default async function handler(req, res) {
    const { key } = req.query;

    if (!key) {
        return res.status(400).send('-- Error: Missing script key.');
    }

    const userAgent = req.headers['user-agent'] || '';
    const isRoblox = userAgent.includes('Roblox') || userAgent.includes('WinInet');

    // If opening in a browser, show the custom landing page
    if (!isRoblox) {
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Luarix | Secure Loader</title>
            <style>
                body {
                    background-color: #08080a;
                    color: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    background: #0f111a;
                    padding: 2rem 3rem;
                    border-radius: 12px;
                    border: 1px solid #1a1d2d;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    max-width: 600px;
                    width: 100%;
                }
                .title {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    color: #f5c518;
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 1rem;
                }
                p {
                    color: #8892b0;
                    margin-bottom: 2rem;
                    font-size: 0.9rem;
                }
                .code-box {
                    background: #050505;
                    padding: 1rem;
                    border-radius: 8px;
                    border: 1px solid #1a1d2d;
                    font-family: monospace;
                    color: #a5f3c4;
                    word-break: break-all;
                    text-align: left;
                    position: relative;
                    font-size: 0.85rem;
                }
                .copy-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #f5c518;
                    color: #000;
                    border: none;
                    padding: 0.4rem 0.8rem;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 0.75rem;
                }
                .footer {
                    margin-top: 2rem;
                    font-size: 0.8rem;
                    color: #555;
                }
                .footer span {
                    color: #f5c518;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Loadstring
                </div>
                <p>Copy the code below to execute the script.</p>
                <div class="code-box">
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('script_key = \\'KEY\\'; loadstring(game:HttpGet(\\'${req.headers.host ? 'https://' + req.headers.host : 'https://luarix.vercel.app'}/api/raw?key=${key}\\'))()')">Copy</button>
                    <code>script_key = "KEY";<br>loadstring(game:HttpGet("${req.headers.host ? 'https://' + req.headers.host : 'https://luarix.vercel.app'}/api/raw?key=${key}"))()</code>
                </div>
                <div class="footer">
                    Protected By <span>Luarix</span>
                </div>
            </div>
        </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    }

    // If Roblox executor, return code
    try {
        const response = await fetch(`https://api.pastes.dev/${key}`);
        if (!response.ok) {
            return res.status(404).send('-- Error: Script not found on host.');
        }
        const scriptText = await response.text();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(scriptText);
    } catch (error) {
        res.status(500).send('-- Error fetching script.');
    }
}
