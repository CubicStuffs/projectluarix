import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { luarixNG } from '../lib/obfuscator.js';

const MAX_ORIGINAL_BYTES   = 1024 * 1024;
const MAX_OBFUSCATED_BYTES = 4 * 1024 * 1024;
const FREE_WEEKLY_LIMIT    = 20;

function bytesOf(str) {
  return Buffer.byteLength(str, 'utf8');
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase environment variables are missing!' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Safe body parsing
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const api_key        = body.api_key || req.query?.api_key;
  const name           = body.name || req.query?.name;
  const keyless        = body.keyless === true || req.query?.keyless === 'true';
  const originalCode   = body.original_code;
  const store_original = body.store_original === true;

  if (!api_key) {
    return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
  }

  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'Invalid method' });
  }

  if (typeof originalCode !== 'string' || originalCode.length === 0) {
    return res.status(400).json({ error: 'No original_code provided' });
  }

  if (bytesOf(originalCode) > MAX_ORIGINAL_BYTES) {
    return res.status(413).json({
      error: `Script too large. Max ${MAX_ORIGINAL_BYTES / 1024} KB allowed.`
    });
  }

  try {
    // Authenticate
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', api_key)
      .single();

    if (userErr || !user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Free plan limit
    if (user.plan === 'free') {
      const now = new Date();
      const resetAt = user.obfuscation_reset_at ? new Date(user.obfuscation_reset_at) : new Date(0);

      if (now > resetAt) {
        await supabase.from('users').update({
          obfuscations_used: 0,
          obfuscation_reset_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('api_key', api_key);
        user.obfuscations_used = 0;
      }

      const used = user.obfuscations_used || 0;
      if (used >= FREE_WEEKLY_LIMIT) {
        return res.status(403).json({ error: `Limit reached (${used}/${FREE_WEEKLY_LIMIT}).` });
      }

      const { data: bumped, error: bumpErr } = await supabase
        .from('users')
        .update({ obfuscations_used: used + 1 })
        .eq('api_key', api_key)
        .eq('obfuscations_used', used)
        .select('obfuscations_used')
        .single();

      if (bumpErr || !bumped) {
        return res.status(429).json({ error: 'Concurrent request detected, please retry' });
      }
    }

    // Obfuscate
    let obfuscatedCode;
    try {
      obfuscatedCode = luarixNG(originalCode);
    } catch (obfErr) {
      console.error('Obfuscation failed:', obfErr.message);
      return res.status(422).json({
        error: 'Obfuscation failed. Your script may contain unsupported syntax.',
        detail: obfErr.message
      });
    }

    if (!obfuscatedCode || obfuscatedCode.length === 0) {
      return res.status(500).json({ error: 'Obfuscator returned empty result' });
    }

    if (bytesOf(obfuscatedCode) > MAX_OBFUSCATED_BYTES) {
      return res.status(413).json({ error: 'Obfuscated output exceeds size limit.' });
    }

    // Save
    const cleanId = crypto.randomBytes(16).toString('hex');

    const { data: newScript, error: insertErr } = await supabase
      .from('scripts')
      .insert({
        id: cleanId,
        api_key: api_key,
        name: name || 'Untitled Script',
        lua_code: obfuscatedCode,
        original_code: store_original ? originalCode : null,
        keyless: keyless,
        obf_version: 'v8.0-ai-bait',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.status(200).json({
      success: true,
      script: newScript,
      id: newScript.id,
      obfuscated_code: obfuscatedCode,
      input_size: bytesOf(originalCode),
      output_size: bytesOf(obfuscatedCode),
    });

  } catch (err) {
    console.error('Create Script Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
