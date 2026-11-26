// create_script.js
// Supabase Edge Function — Luarix NG v6.5

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { luarixNG } from '../lib/obfuscator.js';

const MAX_ORIGINAL_BYTES   = 1024 * 1024;      // 1 MB
const MAX_OBFUSCATED_BYTES = 4 * 1024 * 1024;  // 4 MB
const FREE_WEEKLY_LIMIT    = 20;

function bytesOf(str) {
  return Buffer.byteLength(str, 'utf8');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables are missing!' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const api_key        = body?.api_key || req.query?.api_key;
  const name           = body?.name || req.query?.name;
  const keyless        = body?.keyless === true || req.query?.keyless === 'true';
  const originalCode   = body?.original_code;
  const store_original = body?.store_original === true;

  if (!api_key) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing API Key' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Invalid method' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (typeof originalCode !== 'string' || originalCode.length === 0) {
    return new Response(JSON.stringify({ error: 'No original_code provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (bytesOf(originalCode) > MAX_ORIGINAL_BYTES) {
    return new Response(JSON.stringify({
      error: `Script too large. Max ${MAX_ORIGINAL_BYTES / 1024} KB allowed.`
    }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Authenticate
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', api_key)
      .single();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Free plan quota
    if (user.plan === 'free') {
      const now     = new Date();
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
        return new Response(JSON.stringify({ error: `Limit reached (${used}/${FREE_WEEKLY_LIMIT}).` }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: bumped, error: bumpErr } = await supabase
        .from('users')
        .update({ obfuscations_used: used + 1 })
        .eq('api_key', api_key)
        .eq('obfuscations_used', used)
        .select('obfuscations_used')
        .single();

      if (bumpErr || !bumped) {
        return new Response(JSON.stringify({ error: 'Concurrent request detected, please retry' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Obfuscate with VM-based protection
    let obfuscatedCode;
    try {
      obfuscatedCode = luarixNG(originalCode);
    } catch (obfErr) {
      console.error('Obfuscation failed:', obfErr.message);
      return new Response(JSON.stringify({
        error: 'Obfuscation failed. Your script may contain unsupported syntax.',
        detail: obfErr.message,
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!obfuscatedCode || obfuscatedCode.length === 0) {
      return new Response(JSON.stringify({ error: 'Obfuscator returned empty result' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bytesOf(obfuscatedCode) > MAX_OBFUSCATED_BYTES) {
      return new Response(JSON.stringify({
        error: 'Obfuscated output exceeds size limit.'
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Save to database
    const cleanId = crypto.randomBytes(16).toString('hex');

    const { data: newScript, error: insertErr } = await supabase
      .from('scripts')
      .insert({
        id: cleanId,
        api_key: api_key,
        name: name || 'Untitled Script',
        lua_code: obfuscatedCode,
        original_code: store_original ? (originalCode || null) : null,
        keyless: keyless,
        obf_version: 'v6.5-anti-hook-vm',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 5. Return result
    return new Response(JSON.stringify({
      success: true,
      script: newScript,
      id: newScript.id,
      obfuscated_code: obfuscatedCode,
      input_size: bytesOf(originalCode),
      output_size: bytesOf(obfuscatedCode),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Create Script Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
