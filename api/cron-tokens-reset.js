// api/cron-tokens-reset.js
const SUPABASE_URL = process.env.SUPABASE_URL, SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reset_monthly_tokens`, { method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const updated = await r.json();
    return res.status(200).json({ ok: true, updated });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
