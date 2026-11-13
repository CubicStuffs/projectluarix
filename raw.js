export default async function handler(req, res) {
    // Get the key from the URL (e.g., ?key=lFfpSHRFUK)
    const { key } = req.query;

    if (!key) {
        return res.status(400).send('-- Error: Missing script key.');
    }

    try {
        // Fetch the real code from Pastes.dev
        const response = await fetch(`https://api.pastes.dev/${key}`);
        
        if (!response.ok) {
            return res.status(404).send('-- Error: Script not found on host.');
        }

        const scriptText = await response.text();

        // Serve it as raw text so Roblox accepts it
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(scriptText);
        
    } catch (error) {
        res.status(500).send('-- Error fetching script.');
    }
}
