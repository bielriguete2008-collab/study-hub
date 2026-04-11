export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');
  const body = req.body || {};
  if (body.fromMe) return res.status(200).json({ ok: true });
  if (!body.text?.message && !body.body) return res.status(200).json({ ok: true });
  const userMsg = (body.text?.message || body.body || '').trim();
  const from = body.phone || 'unknown';
  if (!userMsg) return res.status(200).json({ ok: true });
  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const zapiInstance = process.env.ZAPI_INSTANCE_ID;
  const zapiToken = process.env.ZAPI_TOKEN;
  const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN;
  const now = new Date();
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
  const sendZapi = async (phone, message) => {
    try {
      await fetch(`https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken || '' },
        body: JSON.stringify({ phone, message })
      });
    } catch (e) { console.error('Zapi send error:', e); }
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
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) { return ''; }
  };
  const saveToSupabase = async (newHistory, newPoints, newStreak, newBadges) => {
    try {
      let histToSave = newHistory;
      if (histToSave.length > 20) {
        const oldest = histToSave.slice(0, histToSave.length - 10);
        const recent = histToSave.slice(histToSave.length - 10);
        const sum = await callGroq([{ role: 'system', content: 'Resuma em 3 frases o que foi discutido.' }, ...oldest], 200);
        histToSave = [{ role: 'system', content: '[Resumo] ' + (sum || 'Conversa anterior sobre estudos.') }, ...recent];
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
    await sendZapi(from, 'Suas estatisticas:\n\nPontos: ' + points + '\nSequencia: ' + streakDays + ' dia(s)\nBadges: ' + badgeList + '\nMensagens: ' + history.length);
    await saveToSupabase(history, points, streakDays, badges);
    return;
  }
  if (msgLower.startsWith('/quiz')) {
    const topic = userMsg.slice(5).trim() || 'qualquer materia';
    const quizReply = await callGroq([
      { role: 'system', content: 'Voce e um professor. Crie UMA pergunta de multipla escolha (A,B,C,D). No final escreva "Resposta correta: X". Seja conciso.' },
      { role: 'user', content: 'Quiz sobre: ' + topic }
    ], 400);
    if (quizReply) {
      points += 5;
      const nb = [...badges];
      if (points >= 50 && !nb.includes('cerebro')) nb.push('cerebro');
      if (points >= 100 && !nb.includes('estrela')) nb.push('estrela');
      await sendZapi(from, 'Quiz - ' + topic + '\n\n' + quizReply + '\n\n+5 pontos!');
      await saveToSupabase(history, points, streakDays, nb);
    }
    return;
  }
  const systemPrompt = 'Voce e um tutor de estudos que usa o metodo socratico. Data: ' + hoje + '. Faca perguntas para guiar o aluno. Nao de respostas diretas. Seja animado e use emojis com moderacao. Maximo 3 paragrafos. Fale em portugues brasileiro.';
  const aiReply = await callGroq([{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: userMsg }], 500);
  if (aiReply) {
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: aiReply });
    points += 2;
    const nb = [...badges];
    if (streakDays >= 3 && !nb.includes('fogo')) nb.push('fogo');
    if (streakDays >= 7 && !nb.includes('braco')) nb.push('braco');
    if (points >= 50 && !nb.includes('cerebro')) nb.push('cerebro');
    if (points >= 100 && !nb.includes('estrela')) nb.push('estrela');
    await sendZapi(from, aiReply);
    await saveToSupabase(history, points, streakDays, nb);
  }
}
