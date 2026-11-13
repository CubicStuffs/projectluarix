export default async function handler(req, res) {
    if (!req.query.code) {
        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify guilds.join email'
        });
        return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
    }

    const { code } = req.query;
    try {
        // 1. Get Token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI
            })
        });
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            return res.redirect('/?discord_error=invalid_token');
        }

        // 2. Get User Info
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();

        if (!userData.id) {
            return res.redirect('/?discord_error=no_user_data');
        }

        // 3. Force Join Server (Auto-Join)
        const joinRes = await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`, {
            method: 'PUT',
            headers: { 
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_token: tokenData.access_token })
        });

        // If the join fails, it's usually because they are already in the server, which is fine.

        // 4. Redirect back to frontend with Discord Data
        const authData = {
            email: userData.email || `${userData.id}@discord.com`,
            discord_tag: userData.username,
            discord_id: userData.id
        };

        return res.redirect(`/?discord_auth=${encodeURIComponent(JSON.stringify(authData))}`);

    } catch (err) {
        return res.redirect('/?discord_error=server_error');
    }
}
