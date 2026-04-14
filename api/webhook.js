export default async function handler(req, res) {
  // Health check
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');

  const body = req.body || {};

  // Evolution API sends events — only process incoming messages
  if (body.event !== 'messages.upsert') return res.status(200).json({ ok: true });

  const data = body.data || {};
  const key = data.key || {};

  // Ignore messages sent by the bot itself
  if (key.fromMe) return res.status(200).json({ ok: true });

  // Extract text
  const msg = data.message || {};
  const userMsg = (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.buttonsResponseMessage?.selectedDisplayText ||
    ''
  ).trim();

  if (!userMsg) return res.status(200).json({ ok: true });

  // Extract phone — strip @s.whatsapp.net suffix
  const from = (key.remoteJid || '').replace('@s.whatsapp.net', '').replace('@g.us', '');

  if (!from || from === 'status') return res.status(200).json({ ok: true });

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const evolutionUrl = process.env.EVOLUTION_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;
  const evolutionInstance = process.env.EVOLUTION_INSTANCE;

  const now = new Date();
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

  const sendMessage = async (phone, message) => {
    try {
      await fetch(
        evolutionUrl + '/message/sendText/' + evolutionInstance,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
          body: JSON.stringify({ number: phone, text: message })
        }
      );
    } catch (e) { console.error('Evolution API send error:', e); }
  };

  res.status(200).json({ ok: true });

  let history = [], points = 0, streakDays = 0, badges = [], lastActivity = null;
  try {
    const getRes = await fetch(
      supabaseUrl + '/rest/v1/conversations?phone=eq.' + encodeURIComponent(from) + '&select=history,points,streak_days,last_activity,badges',
      { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
    );
    const rows = await getRes.json();
    if (rows && rows[0]) {
      if (Array.isArray(rows[0].history)) history = rows[0].history;
      points = rows[0].points || 0;
      streakDays = rows[0].streak_days || 0;
      badges = Array.isArray(rows[0].badges) ? rows[0].badges : [];
      lastActivity = rows[0].last_activity;
    }
  } catch (e) {}

  if (lastActivity === today) {}
  else if (lastActivity === yesterday) { streakDays += 1; }
  else { streakDays = 1; }

  const callGroq = async (messages, maxTokens = 500) => {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + groqKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.7 })
      });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    } catch (e) { return ''; }
  };

  const saveToSupabase = async (newHistory, newPoints, newStreak, newBadges) => {
    try {
      let histToSave = newHistory;
      if (histToSave.length > 20) {
        const oldest = histToSave.slice(0, histToSave.length - 10);
        const recent = histToSave.slice(histToSave.length - 10);
        const summary = await callGroq([{ role: 'system', content: 'Resuma em portugues em 3 frases o que foi discutido.' }, ...oldest], 200) || 'Discussao anterior.';
        histToSave = [{ role: 'system', content: '[Resumo] ' + summary }, ...recent];
      }
      await fetch(supabaseUrl + '/rest/v1/conversations', {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ phone: from, history: histToSave, points: newPoints, streak_days: newStreak, last_activity: today, badges: newBadges, updated_at: new Date().toISOString() })
      });
    } catch (e) {}
  };

  const msgLower = userMsg.toLowerCase().trim();

  if (msgLower === '/stats') {
    const badgeList = badges.length > 0 ? badges.join(' ') : 'Nenhuma ainda';
    await sendMessage(from, `📊 *Suas estatísticas:*\n\n🏆 Pontos: ${points}\n🔥 Sequência: ${streakDays} dia(s)\n🎖️ Badges: ${badgeList}\n💬 Mensagens no histórico: ${history.length}`);
    await saveToSupabase(history, points, streakDays, badges);
    return;
  }

  if (msgLower.startsWith('/quiz')) {
    const topic = userMsg.slice(5).trim() || 'qualquer matéria';
    const quizReply = await callGroq([
      { role: 'system', content: 'Você é um professor. Crie UMA pergunta de múltipla escolha (A, B, C, D). No final escreva "Resposta correta: X". Seja conciso.' },
      { role: 'user', content: `Crie um quiz sobre: ${topic}` }
    ], 400);
    if (quizReply) {
      points += 5;
      const newBadges = [...badges];
      if (points >= 50 && !newBadges.includes('🧠')) newBadges.push('🧠');
      if (points >= 100 && !newBadges.includes('⭐')) newBadges.push('⭐');
      await sendMessage(from, `🎯 *Quiz - ${topic}*\n\n${quizReply}\n\n+5 pontos!`);
      await saveToSupabase(history, points, streakDays, newBadges);
    }
    return;
  }

  const systemPrompt = `Você é um tutor de estudos que usa o método socrático.
Data: ${hoje}.
Regras: faça perguntas para guiar o aluno, não dê respostas diretas, use emojis com moderação, respostas curtas (máx 3 parágrafos), fale em português brasileiro.`;

  const aiReply = await callGroq([{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: userMsg }], 500);

  if (aiReply) {
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: aiReply });
    points += 2;
    const newBadges = [...badges];
    if (streakDays >= 3 && !newBadges.includes('🔥')) newBadges.push('🔥');
    if (streakDays >= 7 && !newBadges.includes('💪')) newBadges.push('💪');
    if (points >= 50 && !newBadges.includes('🧠')) newBadges.push('🧠');
    if (points >= 100 && !newBadges.includes('⭐')) newBadges.push('⭐');
    await sendMessage(from, aiReply);
    await saveToSupabase(history, points, streakDays, newBadges);
  }
}
