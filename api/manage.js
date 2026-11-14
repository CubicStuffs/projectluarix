// api/manage.js
import { createClient } from '@supabase/supabase-js';
import { luarixNG } from '../lib/obfuscator';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  try {
    // Get user based on API Key or session
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key' });

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (!user) return res.status(401).json({ error: 'Invalid API key' });

    // ── DASHBOARD DATA FETCHING (GET) ──────────────────────────────
    if (req.method === 'GET') {
      const { type } = req.query;

      // 1. Fetch Dashboard Stats (Total Executions & Total Projects)
      if (type === 'stats') {
        const { data: scripts, error } = await supabase
          .from('scripts')
          .select('executions')
          .eq('user_id', user.id);

        if (error) throw error;

        const totalProjects = scripts.length;
        const totalExecutions = scripts.reduce((sum, s) => sum + (s.executions || 0), 0);

        return res.status(200).json({ totalProjects, totalExecutions });
      }

      // 2. Fetch Projects Table Data
      if (type === 'projects') {
        const { data: projects, error } = await supabase
          .from('scripts')
          .select('id, key, name, executions, last_used, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ projects });
      }

      // 3. Fetch Executions Graph Data (Last 7 Days)
      if (type === 'graph') {
        // Note: For a real graph, you usually need a separate 'executions_log' table 
        // with a timestamp for every hit. If you don't have that, this is a mock logic 
        // based on 'last_used' to get you started.
        
        const { data: logs } = await supabase
          .from('executions_log') // Assuming you have this table
          .select('created_at')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        // If you don't have an executions_log table yet, return empty or mock data
        // This maps the data for your chart library (e.g., Recharts)
        return res.status(200).json({ logs: logs || [] });
      }

      // Fallback: Default list scripts
      const { data, error } = await supabase
        .from('scripts')
        .select('key, name, keyless, created_at')
        .eq('user_id', user.id);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, scripts: data });
    }

    // ── ACTIONS (POST) ───────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action, scriptKey, luaCode, keyless } = req.body || {};
      if (!action || !scriptKey) {
        return res.status(400).json({ error: 'action and scriptKey required' });
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('scripts')
        .select('id')
        .eq('key', scriptKey)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) return res.status(404).json({ error: 'Script not found' });

      if (action === 'regenerate') {
        let obfuscated = luarixNG(luaCode);
        await supabase.from('scripts').update({ code: obfuscated }).eq('id', existing.id);
        return res.status(200).json({ success: true, obfuscated });
      }

      if (action === 'toggle_keyless') {
        await supabase.from('scripts').update({ keyless: keyless === true }).eq('id', existing.id);
        return res.status(200).json({ success: true, keyless });
      }

      if (action === 'delete') {
        await supabase.from('scripts').delete().eq('id', existing.id);
        return res.status(200).json({ success: true, deleted: scriptKey });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[manage]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
