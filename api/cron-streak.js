/**
 * Cron job — Lembrete diário de streak
 * Executa todo dia às 23:00 UTC (20:00 no Brasil, UTC-3)
 * Envia mensagem para usuários que NÃO estudaram hoje
 */
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const zapUrl      = process.env.ZAPRESPONDER_URL;
  const zapKey      = process.env.ZAPRESPONDER_KEY;
  const zapInstance = process.env.ZAPRESPONDER_INSTANCE;

  const today = new Date().toISOString().split('T')[0];

  const sendWhatsApp = async (phone, text) => {
    try {
      await fetch(`${zapUrl}/message/sendText/${zapInstance}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': zapKey },
        body:    JSON.stringify({ number: phone, text })
      });
    } catch (e) { console.error('sendWhatsApp error:', e); }
  };

  try {
    const res1 = await fetch(
      supabaseUrl + '/rest/v1/students' +
      '?last_activity=neq.' + encodeURIComponent(today) +
      '&last_activity=not.is.null' +
      '&select=phone,streak_days,points,plan',
      { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
    );
    const users = await res1.json();

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No inactive users found' });
    }

    let sent = 0;
    for (const user of users) {
      const { phone, streak_days, points } = user;
      if (!phone) continue;

      let msg;
      if (streak_days >= 7) {
        msg =
          `🔥 *Ei! Sua sequência de ${streak_days} dias está em risco!*\n\n` +
          `Você ainda não estudou hoje. Manda qualquer dúvida pra mim e mantém seu streak! 💪\n\n` +
          `_Você tem ${points} pontos — não deixe ir por água abaixo!_`;
      } else if (streak_days >= 3) {
        msg =
          `📚 *${streak_days} dias de sequência — continue!*\n\n` +
          `Que tal uma revisão rápida hoje? Pode ser só um quiz ou uma pergunta!\n\n` +
          `*/quiz [matéria]* para começar agora 🎯`;
      } else {
        msg =
          `👋 *Lembrete de estudo!*\n\n` +
          `Que tal dedicar 10 minutinhos hoje?\n\n` +
          `Me manda uma dúvida ou faz um quiz:\n` +
          `*/quiz [matéria]* 🎯\n\n` +
          `_Construa o hábito de estudar todo dia!_ 🧠`;
      }

      await sendWhatsApp(phone, msg);
      sent++;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Streak reminders sent: ${sent}/${users.length}`);
    return res.status(200).json({ sent, total: users.length });

  } catch (e) {
    console.error('Cron streak error:', e);
    return res.status(500).json({ error: e.message });
  }
}
