export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');

  const userMsg = (req.body && req.body.Body ? req.body.Body : '').trim();
  const from = req.body && req.body.From ? req.body.From : 'unknown';
  if (!userMsg) return res.status(200).send('<Response></Response>');

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const now = new Date();
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];
  const prova1 = new Date('2026-04-04');
  const prova2 = new Date('2026-04-07');
  const d1 = Math.ceil((prova1 - now) / 86400000);
  const d2 = Math.ceil((prova2 - now) / 86400000);
  const c1 = d1 > 0 ? d1 + ' dias' : d1 === 0 ? 'HOJE' : 'ja passou';
  const c2 = d2 > 0 ? d2 + ' dias' : d2 === 0 ? 'HOJE' : 'ja passou';
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

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

  if (lastActivity === today) {
    // mesmo dia, streak inalterado
  } else if (lastActivity === yesterday) {
    streakDays += 1;
  } else {
    streakDays = 1;
  }

  const saveToSupabase = async (newHistory, newPoints, newStreak, newBadges) => {
    try {
      await fetch(supabaseUrl + '/rest/v1/conversations', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          phone: from,
          history: newHistory,
          points: newPoints,
          streak_days: newStreak,
          last_activity: today,
          badges: newBadges,
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  };

  const callGroq = async (messages, maxTokens = 500) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + groqKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.7 })
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  };

  const sendReply = (text) => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>' + text + '</Body></Message></Response>';
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(xml);
  };

  const msgLower = userMsg.toLowerCase().trim();

  // === COMANDO /stats ===
  if (msgLower === '/stats' || msgLower === 'stats' || msgLower === '/progresso') {
    await saveToSupabase(history, points, streakDays, badges);
    const s = streakDays >= 7 ? '🔥🔥' : streakDays >= 3 ? '🔥' : '📅';
    return sendReply(
      '📊 *Seus Stats de Estudo*\n\n' +
      '⭐ Pontos: ' + points + '\n' +
      s + ' Streak: ' + streakDays + ' dia' + (streakDays !== 1 ? 's' : '') + '\n' +
      '🏅 Badges: ' + (badges.length > 0 ? badges.join(' ') : 'Nenhum ainda!') + '\n\n' +
      '📅 *Próximas Provas:*\n• Matemática Discreta: 04/04 (' + c1 + ')\n• Programação Estruturada: 07/04 (' + c2 + ')\n\n' +
      '💡 Use /quiz [matéria] para praticar!'
    );
  }

  // === COMANDO /quiz ===
  if (msgLower.startsWith('/quiz') || (msgLower.startsWith('quiz') && msgLower.length > 4)) {
    const materia = userMsg.replace(/^\/quiz\s*/i, '').replace(/^quiz\s*/i, '').trim() || 'Matemática Discreta';
    let quizReply = '❌ Não consegui gerar o quiz. Tente novamente!';
    try {
      const result = await callGroq([
        { role: 'system', content: 'Você é um professor universitário. Crie um quiz de 3 questões de múltipla escolha (A, B, C, D). Formato:\n\n*1.* [Pergunta]\nA) ...\nB) ...\nC) ...\nD) ...\n\n(repita para 2 e 3)\n\n✅ *Gabarito:* 1-X | 2-X | 3-X\n\nNível universitário, em português.' },
        { role: 'user', content: 'Crie um quiz sobre: ' + materia }
      ], 700);
      if (result) { quizReply = '🧠 *Quiz: ' + materia + '*\n\n' + result; points += 5; }
    } catch (e) {}
    const nb = [...badges];
    if (points >= 30 && !badges.some(b => b.includes('Quiz'))) nb.push('🧠 Quiz Master');
    await saveToSupabase(history, points, streakDays, nb);
    return sendReply(quizReply);
  }

  // === COMPRESSÃO DE HISTÓRICO (> 20 msgs) ===
  let compressedHistory = history;
  if (history.length > 20) {
    const old = history.slice(0, history.length - 10);
    const recent = history.slice(history.length - 10);
    try {
      const summary = await callGroq([
        { role: 'system', content: 'Resuma em 3-4 frases os tópicos de estudos discutidos. Em português, comece com "[Resumo da sessão anterior]:".' },
        { role: 'user', content: old.map(m => m.role + ': ' + m.content.substring(0, 150)).join('\n') }
      ], 200);
      compressedHistory = summary ? [{ role: 'system', content: summary }, ...recent] : recent;
    } catch (e) {
      compressedHistory = history.slice(-20);
    }
  }

  // === CONVERSA NORMAL — MÉTODO SOCRÁTICO ===
  const systemPrompt = 'Você é o Jarvis, agente de estudos pessoal do Gabriel Moreira, estudante de CDIA (Ciência de Dados e IA) no IBMEC Rio de Janeiro.\n\n' +
    'DATA ATUAL: ' + hoje + '\n' +
    'PROVAS: Matemática Discreta 04/04 (' + c1 + ') | Programação Estruturada 07/04 (' + c2 + ')\n\n' +
    'MÉTODO SOCRÁTICO — ao receber uma dúvida:\n' +
    '1. Pergunte o que Gabriel já sabe sobre o tema\n' +
    '2. Dê dicas progressivas se ele travar\n' +
    '3. Só explique completamente após 2 tentativas sem sucesso\n' +
    '4. Reforce com exemplos práticos ao final\n\n' +
    'PERFIL: ' + points + ' pontos ⭐ | Streak ' + streakDays + ' dias 🔥 | Badges: ' + (badges.length > 0 ? badges.join(' ') : 'nenhum') + '\n' +
    'COMANDOS: /stats (seus stats) | /quiz [matéria] (praticar)\n\n' +
    'Use emojis moderadamente. Seja direto, motivador e didático. Sempre em português.';

  let reply = '❌ Não consegui processar. Tente novamente!';
  try {
    const result = await callGroq([
      { role: 'system', content: systemPrompt },
      ...compressedHistory,
      { role: 'user', content: userMsg }
    ]);
    if (result) reply = result;

    points += 10;
    const nb = [...badges];
    if (!badges.some(b => b.includes('Primeira'))) nb.push('🎯 Primeira Pergunta');
    if (points >= 50 && !badges.some(b => b.includes('50'))) nb.push('⭐ 50 Pontos');
    if (points >= 100 && !badges.some(b => b.includes('100'))) nb.push('🏆 100 Pontos');
    if (points >= 250 && !badges.some(b => b.includes('250'))) nb.push('💎 250 Pontos');
    if (streakDays >= 3 && !badges.some(b => b.includes('3 Dias'))) nb.push('🔥 Streak 3 Dias');
    if (streakDays >= 7 && !badges.some(b => b.includes('7 Dias'))) nb.push('🌟 Streak 7 Dias');

    const newBadge = nb.find(b => !badges.includes(b));
    if (newBadge) reply += '\n\n🏅 *Badge conquistado: ' + newBadge + '!* Continue assim! 💪';

    await saveToSupabase(
      [...compressedHistory, { role: 'user', content: userMsg }, { role: 'assistant', content: reply }],
      points, streakDays, nb
    );
  } catch (err) {
    reply = '⚠️ Agente temporariamente fora. Tente em instantes!';
  }

  return sendReply(reply);
}
