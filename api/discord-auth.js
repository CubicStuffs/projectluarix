import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    // 1. Redirect to Discord Auth Page
    if (!req.query.code) {
        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify guilds.join email'
        });
        return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
    }

    // 2. Handle Callback
    const { code } = req.query;
    try {
        // Exchange code for token
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

        // Get user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();

        // Force Join Server
        await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`, {
            method: 'PUT',
            headers: { 
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_token: tokenData.access_token })
        });

        // Find or create user in Supabase
        const email = userData.email || `${userData.id}@discord.com`;
        let { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
        
        if (!user) {
            const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
            const api_key = `LXR-FREE-${randomHex}`;
            const { data: newUser } = await supabase.from('users').insert({ 
                email: email, api_key: api_key, discord_id: userData.id 
            }).select().single();
            user = newUser;
        } else {
            await supabase.from('users').update({ discord_id: userData.id }).eq('email', email);
        }

        // Redirect back to frontend with auth data
        // (In a real app, use a secure cookie or JWT. For this demo, we use URL params)
        return res.redirect(`/?discord_auth=${encodeURIComponent(JSON.stringify({
            email: user.email,
            api_key: user.api_key,
            discord_tag: `${userData.username}#${userData.discriminator}`
        }))}`);

    } catch (err) {
        return res.status(500).send('Discord Auth Failed');
    }
}
