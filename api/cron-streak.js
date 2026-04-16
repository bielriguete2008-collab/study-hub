/**
 * Cron job â Lembrete diÃ¡rio de streak
 * Executa todo dia Ã s 23:00 UTC (20:00 no Brasil, UTC-3)
 * Envia mensagem para usuÃ¡rios que NÃO estudaram hoje
 */
export default async function handler(req, res) {
  // SeguranÃ§a: sÃ³ aceita requisiÃ§Ãµes do prÃ³prio Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const evolutionUrl = process.env.EVOLUTION_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;
  const evolutionInstance = process.env.EVOLUTION_INSTANCE;

  const today = new Date().toISOString().split('T')[0];

  const sendMessage = async (phone, message) => {
    try {
      await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify({ number: phone, text: message })
      });
    } catch (e) { console.error('sendMessage error:', e); }
  };

  try {
    // Buscar usuÃ¡rios que estudaram antes (nÃ£o sÃ£o novos) mas NÃO estudaram hoje
    const res1 = await fetch(
      supabaseUrl + '/rest/v1/conversations' +
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

      // Mensagem variada baseada no streak
      let msg;
      if (streak_days >= 7) {
        msg =
          `ð¥ *Ei! Sua sequÃªncia de ${streak_days} dias estÃ¡ em risco!*\n\n` +
          `VocÃª ainda nÃ£o estudou hoje. Manda qualquer dÃºvida pra mim e mantÃ©m seu streak! ðª\n\n` +
          `_VocÃª tem ${points} pontos â hÃ£o deixe ir por Ã¡gua abaixo!_`;
      } else if (streak_days >= 3) {
        msg =
          `ð *${streak_days} dias de sequÃªncia â continue!*\n\n` +
          `Que tal uma revisÃ£o rÃ¡pida hoje? Pode ser sÃ³ um quiz ou uma pergunta!\n\n` +
          `*/quiz [matÃ©ria]* para comeÃ§ar agora ð¯`;
      } else {
        msg =
          `ð *Lembrete de estudo!*\n\n` +
          `Que tal dedicar 10 minutinhos hoje?\n\n` +
          `Me manda uma dÃºvida ou faz um quiz:\n` +
          `*/quiz [matÃ©ria]* ð¯\n\n` +
          `_Construa o habito de estudar todo dia!_ ð§  `;
      }

      await sendMessage(phone, msg);
      sent++;

      // Pequeno delay para nÃ£o sobrecarregar a API
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Streak reminders sent: ${sent}/${users.length}`);
    return res.status(200).json({ sent, total: users.length });

  } catch (e) {
    console.error('Cron streak error:', e);
    return res.status(500).json({ error: e.message });
  }
}
