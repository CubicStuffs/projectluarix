// api/create_script.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const { luarixNG } = require('../lib/obfuscator');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { luaCode, name, keyless } = req.body || {};

    if (!luaCode || typeof luaCode !== 'string') {
      return res.status(400).json({ error: 'luaCode (string) required' });
    }
    if (luaCode.length > 200_000) {
      return res.status(400).json({
        error: 'luaCode too large (max 200KB). Split into modules.',
      });
    }

    // ── 1. Obfuscate ────────────────────────────────────────────────
    let obfuscated;
    try {
      obfuscated = luarixNG(luaCode);
    } catch (e) {
      return res.status(400).json({ error: 'Obfuscation failed: ' + e.message });
    }

    // ── 2. Generate script key ──────────────────────────────────────
    const scriptKey = crypto.randomBytes(16).toString('hex');

    // ── 3. Store ────────────────────────────────────────────────────
    const { error: dbErr } = await supabase
      .from('scripts')
      .insert({
        key: scriptKey,
        name: name || `script-${scriptKey.slice(0, 6)}`,
        code: obfuscated,
        keyless: keyless === true,
        created_at: new Date().toISOString(),
      });

    if (dbErr) {
      return res.status(500).json({ error: 'DB error: ' + dbErr.message });
    }

    return res.status(200).json({
      success: true,
      key: scriptKey,
      name: name || `script-${scriptKey.slice(0, 6)}`,
      size: obfuscated.length,
      obfuscated,
    });
  } catch (err) {
    console.error('[create_script]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
