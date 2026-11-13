export default async function handler(req, res) {
    const { key } = req.query;

    if (!key) {
        return res.status(400).send('-- Error: Missing script key.');
    }

    // 1. Check the User-Agent header to see if the request is from a Roblox executor
    const userAgent = req.headers['user-agent'] || '';
    const isRoblox = userAgent.includes('Roblox') || userAgent.includes('WinInet');

    // 2. If it's NOT a Roblox executor (i.e., it's a web browser), return a landing page
    if (!isRoblox) {
        // Define the HTML for the Luarmor-style page
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Luarix | Secure Loader</title>
            <style>
                body {
                    background-color: #0d0d12;
                    color: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    flex-direction: column;
                }
                .container {
                    background: #15151e;
                    padding: 2rem 3rem;
                    border-radius: 16px;
                    border: 1px solid #222;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                h2 {
                    color: #f5c518;
                    margin-bottom: 1rem;
                }
                p {
                    color: #888;
                    margin-bottom: 2rem;
                }
                .code-box {
                    background: #000;
                    padding: 1rem;
                    border-radius: 8px;
                    border: 1px solid #333;
                    font-family: 'Courier New', monospace;
                    color: #a5f3c4;
                    word-break: break-all;
                    text-align: left;
                    position: relative;
                }
                .copy-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #f5c518;
                    color: #000;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
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
                <h2>📄 Loadstring</h2>
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

    // 3. If it IS a Roblox executor, proceed to fetch and return the raw Lua code
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
