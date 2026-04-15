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

  // Extract text: can be in conversation, extendedTextMessage, or buttonsResponseMessage
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
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID;

  const now = new Date();
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

  const FREE_DAILY_LIMIT = 20;

  // Enviar mensagem via Evolution API
  const sendMessage = async (phone, message) => {
    try {
      await fetch(
        evolutionUrl + '/message/sendText/' + evolutionInstance,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify({ number: phone, text: message })
        }
      );
    } catch (e) {
      console.error('Evolution API send error:', e);
    }
  };

  // Responde 200 imediatamente
  res.status(200).json({ ok: true });

  // Carregar dados do usuario do Supabase
  let history = [], points = 0, streakDays = 0, badges = [], lastActivity = null;
  let plan = 'free', dailyCount = 0, dailyDate = null;
  try {
    const getRes = await fetch(
      supabaseUrl + '/rest/v1/conversations?phone=eq.' + encodeURIComponent(from) +
      '&select=history,points,streak_days,last_activity,badges,plan,daily_count,daily_date',
      { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
    );
    const rows = await getRes.json();
    if (rows && rows[0]) {
      if (Array.isArray(rows[0].history)) history = rows[0].history;
      points = rows[0].points || 0;
      streakDays = rows[0].streak_days || 0;
      badges = Array.isArray(rows[0].badges) ? rows[0].badges : [];
      lastActivity = rows[0].last_activity;
      plan = rows[0].plan || 'free';
      dailyCount = rows[0].daily_count || 0;
      dailyDate = rows[0].daily_date;
    }
  } catch (e) {}

  // Reset contador diario se mudou o dia
  if (dailyDate !== today) {
    dailyCount = 0;
    dailyDate = today;
  }

  // Calcular streak
  if (lastActivity === today) { /* mesmo dia */ }
  else if (lastActivity === yesterday) { streakDays += 1; }
  else { streakDays = 1; }

  // Salvar no Supabase
  const saveToSupabase = async (newHistory, newPoints, newStreak, newBadges, newPlan, newDailyCount) => {
    try {
      let histToSave = newHistory;
      if (histToSave.length > 20) {
        const oldest = histToSave.slice(0, histToSave.length - 10);
        const recent = histToSave.slice(histToSave.length - 10);
        const summaryRes = await callGroq([
          { role: 'system', content: 'Resuma em portugues em 3 frases o que foi discutido nessa conversa de estudos.' },
          ...oldest
        ], 200);
        const summary = summaryRes || 'Discussao anterior sobre estudos.';
        histToSave = [{ role: 'system', content: '[Resumo conversa anterior] ' + summary }, ...recent];
      }
      await fetch(
        supabaseUrl + '/rest/v1/conversations',
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            phone: from,
            history: histToSave,
            points: newPoints,
            streak_days: newStreak,
            last_activity: today,
            badges: newBadges,
            plan: newPlan,
            daily_count: newDailyCount,
            daily_date: today,
            updated_at: new Date().toISOString()
          })
        }
      );
    } catch (e) {}
  };

  // Chamar Groq
  const callGroq = async (messages, maxTokens = 500) => {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + groqKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          max_tokens: maxTokens,
          temperature: 0.7
        })
      });
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) {
      return '';
    }
  };

  // Criar Stripe Checkout Session
  const createCheckoutSession = async (phone) => {
    try {
      const params = new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': stripePriceId,
        'line_items[0][quantity]': '1',
        'metadata[phone]': phone,
        'success_url': 'https://study-hub-ecru.vercel.app/sucesso',
        'cancel_url': 'https://study-hub-ecru.vercel.app/cancelado',
        'payment_method_types[0]': 'card',
        'locale': 'pt-BR'
      });
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + stripeSecretKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const session = await r.json();
      return session.url || null;
    } catch (e) {
      console.error('Stripe error:', e);
      return null;
    }
  };

  const msgLower = userMsg.toLowerCase().trim();

  // Comando /plano
  if (msgLower === '/plano') {
    const isPro = plan === 'pro';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply = isPro
      ? '\u2b50 *Seu plano: PRO*\n\nVoce tem acesso ilimitado ao Study Hub!\n\uD83C\uDFC6 Pontos: ' + points + ' | \uD83D\uDD25 Streak: ' + streakDays + ' dia(s)'
      : '\uD83C\uDD93 *Seu plano: Gratuito*\n\nMensagens restantes hoje: *' + remaining + '/' + FREE_DAILY_LIMIT + '*\n\n\uD83D\uDCA1 Quer acesso ilimitado? Digite */assinar* para assinar o plano Pro por R$19,90/mes!';
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount);
    return;
  }

  // Comando /assinar
  if (msgLower === '/assinar') {
    if (plan === 'pro') {
      await sendMessage(from, '\u2b50 Voce ja e assinante Pro! Aproveite o acesso ilimitado.');
      return;
    }
    await sendMessage(from, '\u23f3 Gerando seu link de pagamento...');
    const checkoutUrl = await createCheckoutSession(from);
    if (checkoutUrl) {
      const reply = '\uD83D\uDCB3 *Study Hub Pro — R$19,90/mes*\n\nAcesso ilimitado a:\n• Conversas sem limite diario\n• Quiz ilimitado\n• Suporte prioritario\n\n\uD83D\uDC47 Clique para assinar:\n' + checkoutUrl + '\n\n_Apos o pagamento, seu plano e ativado automaticamente!_';
      await sendMessage(from, reply);
    } else {
      await sendMessage(from, '\u274C Erro ao gerar link. Tente novamente em alguns instantes.');
    }
    return;
  }

  // Comando /stats
  if (msgLower === '/stats') {
    const isPro = plan === 'pro';
    const badgeList = badges.length > 0 ? badges.join(' ') : 'Nenhuma ainda';
    const planLabel = isPro ? '\u2b50 Pro' : '\uD83C\uDD93 Gratuito';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply = '\uD83D\uDCCA *Suas estatisticas:*\n\n\uD83C\uDFC6 Pontos: ' + points + '\n\uD83D\uDD25 Sequencia: ' + streakDays + ' dia(s)\n\uD83C\uDF96\uFE0F Badges: ' + badgeList + '\n\uD83D\uDCCB Plano: ' + planLabel + '\n\uD83D\uDCAC Mensagens hoje: ' + dailyCount + (isPro ? '' : '/' + FREE_DAILY_LIMIT) + ' (restam: ' + remaining + ')';
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount);
    return;
  }

  // Verificar limite do plano Free
  if (plan === 'free' && dailyCount >= FREE_DAILY_LIMIT) {
    const reply = '\u26A0\uFE0F *Limite diario atingido!*\n\nVoce usou suas ' + FREE_DAILY_LIMIT + ' mensagens gratuitas de hoje.\n\n\uD83D\uDD04 O limite e renovado a meia-noite.\n\n\uD83D\uDCA1 Quer acesso *ilimitado*? Digite */assinar* para o plano Pro por R$19,90/mes!';
    await sendMessage(from, reply);
    return;
  }

  // Comando /quiz
  if (msgLower.startsWith('/quiz')) {
    const topic = userMsg.slice(5).trim() || 'qualquer materia';
    const quizPrompt = [
      { role: 'system', content: 'Voce e um professor. Crie UMA pergunta de multipla escolha (A, B, C, D) sobre o tema pedido. No final, escreva "Resposta correta: X" em uma linha separada. Seja conciso.' },
      { role: 'user', content: 'Crie um quiz sobre: ' + topic }
    ];
    const quizReply = await callGroq(quizPrompt, 400);
    if (quizReply) {
      points += 5;
      dailyCount += 1;
      const newBadges = [...badges];
      if (points >= 50 && !newBadges.includes('\uD83E\uDDE0')) newBadges.push('\uD83E\uDDE0');
      if (points >= 100 && !newBadges.includes('\u2b50')) newBadges.push('\u2b50');
      await sendMessage(from, '\uD83C\uDFAF *Quiz - ' + topic + '*\n\n' + quizReply + '\n\n+5 pontos por praticar!');
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount);
    }
    return;
  }

  // Conversa normal com metodo socratico
  const systemPrompt = 'Voce e um tutor de estudos inteligente que usa o metodo socratico.\nData de hoje: ' + hoje + '.\n\nRegras:\n- Faca perguntas para guiar o aluno a descobrir a resposta por conta propria\n- Nao de respostas diretas, prefira orientar com perguntas\n- Seja animado, use emojis com moderacao\n- Respostas curtas e diretas (max 3 paragrafos)\n- Se o aluno errar, corrija gentilmente e explique o porque\n- Fale sempre em portugues brasileiro';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMsg }
  ];

  const aiReply = await callGroq(messages, 500);

  if (aiReply) {
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: aiReply });
    points += 2;
    dailyCount += 1;

    const newBadges = [...badges];
    if (streakDays >= 3 && !newBadges.includes('\uD83D\uDD25')) newBadges.push('\uD83D\uDD25');
    if (streakDays >= 7 && !newBadges.includes('\uD83D\uDCAA')) newBadges.push('\uD83D\uDCAA');
    if (points >= 50 && !newBadges.includes('\uD83E\uDDE0')) newBadges.push('\uD83E\uDDE0');
    if (points >= 100 && !newBadges.includes('\u2b50')) newBadges.push('\u2b50');

    await sendMessage(from, aiReply);
    await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount);
  }
}
