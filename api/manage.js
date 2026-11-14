// api/manage.js
import { createClient } from '@supabase/supabase-js';
const { luarixNG } = require('../lib/obfuscator');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  try {
    // ── GET: list user's scripts (by api key) ──────────────────────
    if (req.method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key' });

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id')
        .eq('api_key', apiKey)
        .maybeSingle();

      if (userErr || !user) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const { data, error } = await supabase
        .from('scripts')
        .select('key, name, keyless, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, scripts: data });
    }

    // ── POST: actions (regenerate / delete / toggle_keyless) ───────
    if (req.method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key' });

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('api_key', apiKey)
        .maybeSingle();
      if (!user) return res.status(401).json({ error: 'Invalid API key' });

      const { action, scriptKey, luaCode, keyless } = req.body || {};
      if (!action || !scriptKey) {
        return res.status(400).json({ error: 'action and scriptKey required' });
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('scripts')
        .select('id, key')
        .eq('key', scriptKey)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        return res.status(404).json({ error: 'Script not found or not yours' });
      }

      // ── regenerate ─────────────────────────────────────────────
      if (action === 'regenerate') {
        if (!luaCode || typeof luaCode !== 'string') {
          return res.status(400).json({ error: 'luaCode required for regenerate' });
        }
        if (luaCode.length > 200_000) {
          return res.status(400).json({ error: 'luaCode too large (max 200KB)' });
        }

        let obfuscated;
        try {
          obfuscated = luarixNG(luaCode);
        } catch (e) {
          return res.status(400).json({ error: 'Obfuscation failed: ' + e.message });
        }

        const { error } = await supabase
          .from('scripts')
          .update({ code: obfuscated })
          .eq('id', existing.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, obfuscated });
      }

      // ── toggle_keyless ─────────────────────────────────────────
      if (action === 'toggle_keyless') {
        const next = keyless === true;
        const { error } = await supabase
          .from('scripts')
          .update({ keyless: next })
          .eq('id', existing.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, keyless: next });
      }

      // ── delete ─────────────────────────────────────────────────
      if (action === 'delete') {
        const { error } = await supabase
          .from('scripts')
          .delete()
          .eq('id', existing.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, deleted: scriptKey });
      }

      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[manage]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
