'use strict';
/**
 * api/cron-streak.js — Cron diário de streak
 * Envia lembrete via ZapResponder para alunos com streak ativo
 */
const { createClient } = require('@supabase/supabase-js');
const { sendMessage }  = require('../lib/messaging');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Verificação de segurança via CRON_SECRET
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Busca alunos com streak > 0 e última mensagem há mais de 20h
    const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { data: students, error } = await supabase
      .from('students')
      .select('id, phone, name, streak_days, plan')
      .gt('streak_days', 0)
      .or(`last_message_at.lt.${cutoff},last_message_at.is.null`);

    if (error) throw error;
    if (!students || students.length === 0) {
      return res.json({ ok: true, sent: 0 });
    }

    let sent = 0;
    for (const s of students) {
      const nome = (s.name || '').split(' ')[0] || 'Aluno';
      const streak = s.streak_days || 0;
      let msg;
      if (streak >= 30) {
        msg = `🔥 *${nome}*, você tem ${streak} dias de streak! Incrível! Não perca agora — me manda uma mensagem para continuar seus estudos hoje!`;
      } else if (streak >= 7) {
        msg = `⚡ *${nome}*, ${streak} dias seguidos estudando! Continue a sequência — manda uma mensagem e vamos estudar juntos!`;
      } else {
        msg = `📚 *${nome}*, lembrete diário: não esqueça de estudar hoje! Já são ${streak} dias de sequência. Me manda uma mensagem!`;
      }

      await sendMessage(s.phone, msg);
      sent++;
      await new Promise(r => setTimeout(r, 500));
    }

    return res.json({ ok: true, sent, total: students.length });
  } catch (err) {
    console.error('[cron-streak]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
