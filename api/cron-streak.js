// api/cron-streak.js
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.SUPABASE_URL, supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const evolutionUrl = process.env.EVOLUTION_URL, evolutionApiKey = process.env.EVOLUTION_API_KEY, evolutionInstance = process.env.EVOLUTION_INSTANCE;
  const today = new Date().toISOString().split('T')[0];

  const sendMessage = async (phone, message) => {
    try { await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey }, body: JSON.stringify({ number: phone, text: message }) }); } catch (e) { console.error('sendMessage error:', e); }
  };

  try {
    const res1 = await fetch(supabaseUrl + '/rest/v1/students?last_activity=neq.' + encodeURIComponent(today) + '&last_activity=not.is.null&select=phone,streak_days,points,plan', { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } });
    const users = await res1.json();
    if (!Array.isArray(users) || users.length === 0) return res.status(200).json({ sent: 0 });

    let sent = 0;
    for (const user of users) {
      const { phone, streak_days, points } = user;
      if (!phone) continue;
      let msg;
      if (streak_days >= 7) msg = `🔥 *Ei! Sua sequência de ${streak_days} dias está em risco!*\n\nVocê ainda não estudou hoje. Manda qualquer dúvida pra mim e mantém seu streak! 💪`;
      else if (streak_days >= 3) msg = `📚 *${streak_days} dias de sequência — continue!*\n\nQue tal uma revisão rápida hoje?\n\n*/quiz [matéria]* 🎯`;
      else msg = `👋 *Lembrete de estudo!*\n\nQue tal dedicar 10 minutinhos hoje?\n\n*/quiz [matéria]* 🎯`;
      await sendMessage(phone, msg);
      sent++;
      await new Promise(r => setTimeout(r, 200));
    }
    return res.status(200).json({ sent, total: users.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
