export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Hub AI — Webhook OK');

  const body = req.body || {};

  // ── Parse ZapResponder webhook payload ───────────────────────────────────────
  // ZapResponder POSTs incoming messages with: chatId, message, type, fromMe, mediaUrl, name
  // Some versions use nested "data" or "contact" objects — handle both patterns.
  const raw = body.data || body;

  const fromMe = raw.fromMe === true || raw.fromMe === 'true';
  if (fromMe) return res.status(200).json({ ok: true });

  // Extract phone number (chatId comes as "5521999999999" or "5521999999999@c.us")
  const chatId = (raw.chatId || raw.phone || raw.contact?.phone || raw.from || '').toString();
  const from = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', '').trim();
  if (!from || from === 'status' || from.length < 8) return res.status(200).json({ ok: true });

  // Extract text message
  const msgType = (raw.type || '').toLowerCase(); // text, image, video, audio, document, sticker
  const userMsg = (
    raw.message ||
    raw.body ||
    raw.text ||
    raw.content ||
    ''
  ).toString().trim();

  // Extract image info
  const hasImage = msgType === 'image' || !!(raw.mediaUrl && ['image', 'video'].includes(msgType));
  const imageCaption = (raw.caption || raw.imageCaption || '').trim();
  const imageUrl = raw.mediaUrl || raw.imageUrl || null;
  const imageBase64 = null; // ZapResponder doesn't send base64 inline

  // Ignorar mensagens sem conteúdo útil
  if (!userMsg && !hasImage) return res.status(200).json({ ok: true });

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const zapToken = process.env.ZAPRESPONDER_TOKEN;
  const zapDepartmentId = process.env.ZAPRESPONDER_DEPARTMENT_ID;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID;
  const mpAccessToken = process.env.MP_ACCESS_TOKEN; // Mercado Pago
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];

  const FREE_DAILY_LIMIT = 20;

  // ── Processar tudo antes de responder (Vercel encerra após res.end()) ───────
  try {


  // ── sendMessage via ZapResponder API ─────────────────────────────────────
  const sendMessage = async (phone, message) => {
    try {
      await fetch(`https://api.zapresponder.com.br/api/whatsapp/message/${zapDepartmentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zapToken}`
        },
        body: JSON.stringify({
          type: 'text',
          message,
          number: phone,
          showInChat: true
        })
      });
    } catch (e) { console.error('sendMessage error:', e); }
  };

  // ── sendImage via ZapResponder API ─────────────────────────────────────────────
  const sendImageMessage = async (phone, url, caption = '') => {
    try {
      await fetch(`https://api.zapresponder.com.br/api/whatsapp/message/${zapDepartmentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zapToken}`
        },
        body: JSON.stringify({
          type: 'image',
          url,
          message: caption,
          number: phone,
          showInChat: true
        })
      });
    } catch (e) { console.error('sendImageMessage error:', e); }
  };
  // ── Carregar dados do usuário ──────────────────────────────────────────────────────────
  let isNewUser = false;
  let history = [], points = 0, streakDays = 0, badges = [], lastActivity = null;
  let plan = 'free', dailyCount = 0, dailyDate = null, pendingQuiz = null, examMode = null;

  try {
    const getRes = await fetch(
      supabaseUrl + '/rest/v1/conversations?phone=eq.' + encodeURIComponent(from) +
      '&select=history,points,streak_days,last_activity,badges,plan,daily_count,daily_date,pending_quiz,exam_mode',
      { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
    );
    const rows = await getRes.json();
    if (!rows || rows.length === 0) {
      isNewUser = true;
    } else {
      if (Array.isArray(rows[0].history)) history = rows[0].history;
      points = rows[0].points || 0;
      streakDays = rows[0].streak_days || 0;
      badges = Array.isArray(rows[0].badges) ? rows[0].badges : [];
      lastActivity = rows[0].last_activity;
      plan = rows[0].plan || 'free';
      dailyCount = rows[0].daily_count || 0;
      dailyDate = rows[0].daily_date;
      pendingQuiz = rows[0].pending_quiz || null;
      examMode = rows[0].exam_mode || null;
    }
  } catch (e) {}

  // Reset contador diário se mudou o dia
  if (dailyDate !== today) { dailyCount = 0; dailyDate = today; }

  // Calcular streak
  if (lastActivity === today) {}
  else if (lastActivity === yesterday) { streakDays += 1; }
  else if (lastActivity !== null) { streakDays = 1; }
  else { streakDays = 1; }

  // ── Helpers ─────────────────────────────────────────────────────────────────────────
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
  const callGroqVision = async (imageB64, prompt) => {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + groqKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageB64}` } },
              { type: 'text', text: prompt }
            ]
          }],
          max_tokens: 600,
          temperature: 0.5
        })
      });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    } catch (e) { return ''; }
  };

  const saveToSupabase = async (newHistory, newPoints, newStreak, newBadges, newPlan, newDailyCount, newPendingQuiz, newExamMode) => {
    try {
      let histToSave = newHistory;
      if (histToSave.length > 20) {
        const oldest = histToSave.slice(0, histToSave.length - 10);
        const recent = histToSave.slice(histToSave.length - 10);
        const summary = await callGroq([
          { role: 'system', content: 'Resuma em 3 frases o que foi discutido nessa conversa de estudos.' },
          ...oldest
        ], 200) || 'Conversa anterior de estudos.';
        histToSave = [{ role: 'system', content: '[Resumo] ' + summary }, ...recent];
      }
      await fetch(supabaseUrl + '/rest/v1/conversations', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          phone: from, history: histToSave, points: newPoints,
          streak_days: newStreak, last_activity: today, badges: newBadges,
          plan: newPlan, daily_count: newDailyCount, daily_date: today,
          pending_quiz: newPendingQuiz, exam_mode: newExamMode,
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  };
  const createStripeCheckout = async (phone) => {
    try {
      const body = [
        'mode=subscription',
        'line_items[0][price]=' + stripePriceId,
        'line_items[0][quantity]=1',
        'metadata[phone]=' + encodeURIComponent(phone),
        'success_url=https://study-hub-ecru.vercel.app/sucesso',
        'cancel_url=https://study-hub-ecru.vercel.app/cancelado',
        'payment_method_types[0]=card',
        'locale=pt-BR'
      ].join('&');
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + stripeSecretKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const session = await r.json();
      return session.url || null;
    } catch (e) { return null; }
  };

  const createMercadoPagoCheckout = async (phone) => {
    if (!mpAccessToken) return null;
    try {
      const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + mpAccessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ title: 'Study Hub Pro — Plano Mensal', quantity: 1, currency_id: 'BRL', unit_price: 19.90 }],
          payment_methods: { excluded_payment_types: [{ id: 'ticket' }], default_payment_method_id: 'pix' },
          metadata: { phone },
          back_urls: {
            success: 'https://study-hub-ecru.vercel.app/sucesso',
            failure: 'https://study-hub-ecru.vercel.app/cancelado',
            pending: 'https://study-hub-ecru.vercel.app/cancelado'
          },
          auto_return: 'approved',
          external_reference: phone
        })
      });
      const data = await r.json();
      return data.init_point || null;
    } catch (e) { return null; }
  };

  const addBadges = (currentBadges, pts, streak) => {
    const b = [...currentBadges];
    if (streak >= 3 && !b.includes('🔥')) b.push('🔥');
    if (streak >= 7 && !b.includes('💪')) b.push('💪');
    if (pts >= 50 && !b.includes('🧠')) b.push('🧠');
    if (pts >= 100 && !b.includes('⭐')) b.push('⭐');
    if (pts >= 300 && !b.includes('🏆')) b.push('🏆');
    return b;
  };

  const msgLower = userMsg.toLowerCase().trim();
  // ── BOAS-VINDAS para novos usuários ────────────────────────────────────────────────
  if (isNewUser) {
    const welcome =
      `Olá! 👋 Bem-vindo ao *Study Hub* — seu tutor de estudos com IA no WhatsApp!\n\n` +
      `Sou um tutor inteligente que usa o método socrático: em vez de dar respostas prontas, te guio a descobrir por conta própria. 🧠\n\n` +
      `📚 *O que posso fazer:*\n` +
      `• Explicar qualquer matéria\n` +
      `• Resolver exercícios (manda foto! 📸)\n` +
      `• Criar quizzes com pontuação\n` +
      `• Modo intensivo pré-prova\n` +
      `• Acompanhar seu progresso com streaks e badges\n\n` +
      `⚡ *Comandos:*\n` +
      `*/quiz [matéria]* — quiz de múltipla escolha\n` +
      `*/prova [matéria]* — modo intensivo pré-prova\n` +
      `*/stats* — seus pontos, streak e badges\n` +
      `*/plano* — plano atual\n` +
      `*/assinar* — upgrade para Pro ilimitado\n\n` +
      `🄓 *Gratuito:* 20 msgs/dia | ⭐ *Pro:* R$19,90/mês ilimitado\n\n` +
      `Por onde quer começar? Me conta o que está estudando! 👇`;
    await sendMessage(from, welcome);
    await saveToSupabase([], 0, 1, [], 'free', 1, null, null);
    return;
  }

  // ── /ajuda ──────────────────────────────────────────────────────────────────────────
  if (msgLower === '/ajuda' || msgLower === '/help') {
    const help =
      `📖 *Comandos disponíveis:*\n\n` +
      `*/quiz [matéria]* — quiz de múltipla escolha\n` +
      `*/prova [matéria]* — modo intensivo pré-prova\n` +
      `*/stats* — seus pontos, streak e badges\n` +
      `*/plano* — ver plano atual e limites\n` +
      `*/assinar* — fazer upgrade para Pro\n` +
      `*/cancelar* — sair do modo atual\n\n` +
      `📸 *Envie uma foto* de qualquer exercício e eu resolvo!\n\n` +
      `💬 Ou simplesmente me conte o que está estudando!`;
    await sendMessage(from, help);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }
  // ── /plano ──────────────────────────────────────────────────────────────────────────
  if (msgLower === '/plano') {
    const isPro = plan === 'pro';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply = isPro
      ? `⭐ *Plano: PRO*\n\nAcesso ilimitado! 🚀\n🏆 Pontos: ${points} | 🔥 Streak: ${streakDays} dia(s)`
      : `🄓 *Plano: Gratuito*\n\nMensagens hoje: ${dailyCount}/${FREE_DAILY_LIMIT} (restam ${remaining})\n\n💡 */assinar* para Pro por R$19,90/mês — sem limites!`;
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }

  // ── /assinar ────────────────────────────────────────────────────────────────────────
  if (msgLower === '/assinar') {
    if (plan === 'pro') {
      await sendMessage(from, '⭐ Você já é assinante Pro! Aproveite o acesso ilimitado. 🚀');
      return;
    }
    await sendMessage(from, '⏳ Gerando seus links de pagamento...');
    const [stripeUrl, mpUrl] = await Promise.all([createStripeCheckout(from), createMercadoPagoCheckout(from)]);
    let reply = `💳 *Study Hub Pro — R$19,90/mês*\n\n✅ Mensagens ilimitadas\n✅ Quiz e modo prova ilimitados\n✅ Suporte a imagens\n✅ Streaks e badges sem limite\n\n`;
    if (stripeUrl && mpUrl) {
      reply += `Escolha sua forma de pagamento:\n\n💳 *Cartão de crédito:*\n${stripeUrl}\n\n🟡 *Pix / Cartão (Mercado Pago):*\n${mpUrl}\n\n_Plano ativado automaticamente após o pagamento!_`;
    } else if (stripeUrl) {
      reply += `💰 Aceita *cartão de crédito*\n\n👇 Clique para assinar:\n${stripeUrl}\n\n_Plano ativado automaticamente após o pagamento!_`;
    } else if (mpUrl) {
      reply += `🟡 Aceita *Pix e cartão* via Mercado Pago\n\n👇 Clique para assinar:\n${mpUrl}\n\n_Plano ativado automaticamente após o pagamento!_`;
    } else {
      reply += '❌ Erro ao gerar link. Tente novamente em instantes.';
    }
    await sendMessage(from, reply);
    return;
  }

  // ── /stats ──────────────────────────────────────────────────────────────────────────
  if (msgLower === '/stats') {
    const isPro = plan === 'pro';
    const badgeList = badges.length > 0 ? badges.join(' ') : 'Nenhuma ainda';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply =
      `📊 *Suas estatísticas:*\n\n` +
      `🏆 Pontos: ${points}\n` +
      `🔥 Streak: ${streakDays} dia(s) consecutivos\n` +
      `🎖️ Badges: ${badgeList}\n` +
      `📋 Plano: ${isPro ? '⭐ Pro' : '🄓 Gratuito'}\n` +
      `💬 Mensagens hoje: ${dailyCount}${isPro ? '' : '/' + FREE_DAILY_LIMIT} (restam: ${remaining})\n\n` +
      `_Continue estudando para ganhar mais badges!_`;
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }

  // ── /cancelar ─────────────────────────────────────────────────────────────────────────
  if (msgLower === '/cancelar') {
    await sendMessage(from, '✅ Modo cancelado. Pode me perguntar qualquer coisa! 😊');
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, null, null);
    return;
  }
  // ── Limite do plano Free ─────────────────────────────────────────────────────────────────
  if (plan === 'free' && dailyCount >= FREE_DAILY_LIMIT) {
    const reply =
      `⚠️ *Limite diário atingido!*\n\n` +
      `Você usou ${FREE_DAILY_LIMIT} mensagens hoje. O limite renova à meia-noite.\n\n` +
      `💡 Digite */assinar* para acesso *ilimitado* por R$19,90/mês!\n` +
      `Aceita *Pix* e cartão de crédito. 🟡`;
    await sendMessage(from, reply);
    return;
  }

  // ── IMAGEM: resolver exercício com visão ─────────────────────────────────────────────
  if (hasImage) {
    dailyCount++;
    points += 3;
    let imageData = null;
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        const imgBuf = await imgRes.arrayBuffer();
        imageData = Buffer.from(imgBuf).toString('base64');
      } catch (e) {}
    }
    if (!imageData) {
      await sendMessage(from, '❌ Não consegui processar a imagem. Tente enviar novamente.');
      return;
    }
    const prompt = imageCaption
      ? `O aluno enviou uma imagem com a legenda: "${imageCaption}". Analise a imagem e ajude com o que foi pedido, usando o método socrático — faça perguntas para guiar o aluno à resposta. Se for um exercício, mostre o raciocínio passo a passo. Responda em português.`
      : `O aluno enviou uma imagem de exercício ou conteúdo de estudo. Identifique o que é e ajude usando o método socrático — guie o aluno com perguntas em vez de dar a resposta direto. Se for um problema matemático ou científico, mostre o raciocínio. Responda em português, de forma clara e didática.`;
    const visionReply = await callGroqVision(imageData, prompt);
    if (visionReply) {
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from, `📸 *Analisando sua imagem...*\n\n${visionReply}`);
      history.push({ role: 'user', content: '[Enviou uma imagem para análise]' });
      history.push({ role: 'assistant', content: visionReply });
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, pendingQuiz, examMode);
    } else {
      await sendMessage(from, '❌ Não consegui analisar a imagem. Tente descrever o exercício em texto!');
    }
    return;
  }

  // ── Resposta interativa de quiz (A / B / C / D) ─────────────────────────────────────
  if (pendingQuiz && /^[abcd]$/i.test(msgLower)) {
    const userAnswer = msgLower.toUpperCase();
    const correct = pendingQuiz.correct;
    dailyCount++;
    if (userAnswer === correct) {
      points += 10;
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from,
        `✅ *Correto! ${correct} é a resposta certa!*\n\n+10 pontos! 🎉 Total: ${points} pts\n\nQuer tentar mais? */quiz ${pendingQuiz.topic || 'qualquer matéria'}*`
      );
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, examMode);
    } else {
      await sendMessage(from,
        `❌ *Não foi dessa vez!*\n\nA resposta correta era *${correct}*.\n\nNão desanime — errar faz parte de aprender! 💪\n\nTente outro: */quiz ${pendingQuiz.topic || 'qualquer matéria'}*`
      );
      await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, null, examMode);
    }
    return;
  }
  // ── /quiz ─────────────────────────────────────────────────────────────────────────────
  if (msgLower.startsWith('/quiz')) {
    const topic = userMsg.slice(5).trim() || 'qualquer matéria';
    const quizReply = await callGroq([
      { role: 'system', content: 'Você é um professor. Crie UMA pergunta de múltipla escolha com opções A, B, C, D sobre o tema pedido. Formato: escreva a pergunta, depois as 4 opções marcadas com A), B), C), D), e por último escreva exatamente "Resposta correta: X" onde X é a letra. Seja conciso e use português.' },
      { role: 'user', content: 'Crie um quiz sobre: ' + topic }
    ], 400);
    if (quizReply) {
      const match = quizReply.match(/Resposta correta:\s*([A-D])/i);
      const correctAnswer = match ? match[1].toUpperCase() : null;
      const displayedReply = quizReply.replace(/\n*Resposta correta:\s*[A-D][^\n]*/gi, '').trim();
      points += 2;
      dailyCount++;
      const newBadges = addBadges(badges, points, streakDays);
      const newPending = correctAnswer ? { correct: correctAnswer, topic } : null;
      await sendMessage(from, `🎯 *Quiz — ${topic}*\n\n${displayedReply}\n\n_Responda com A, B, C ou D_`);
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, newPending, examMode);
    }
    return;
  }

  // ── /prova — Modo pré-prova intensivo ─────────────────────────────────────────────
  if (msgLower.startsWith('/prova')) {
    const topic = userMsg.slice(6).trim();
    if (!topic) {
      await sendMessage(from,
        `📝 *Modo Pré-Prova*\n\nMe diz qual matéria ou tema você quer revisar!\n\nExemplos:\n• */prova Cálculo — limites e derivadas*\n• */prova Biologia celular*\n• */prova Inglês — tempos verbais*\n• */prova Direito Constitucional*`
      );
      return;
    }
    dailyCount++;
    const examReply = await callGroq([
      {
        role: 'system',
        content: `Você é um professor especializado em preparação para provas. O aluno tem uma prova chegando e precisa de uma revisão intensiva e rápida.\n\nCrie um material de revisão completo e estruturado com:\n1. Os 5 pontos mais importantes do tema (com ⭐ no início)\n2. Fórmulas ou conceitos-chave (se houver)\n3. Um macete ou dica de memorização\n4. Um erro comum que cai em prova\n\nSeja direto, didático e use emojis com moderação. Responda em português.`
      },
      { role: 'user', content: 'Preparar revisão para prova de: ' + topic }
    ], 800);
    if (examReply) {
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from, `📝 *Modo Pré-Prova: ${topic}*\n\n${examReply}\n\n---\n💡 Quer praticar com exercícios? */quiz ${topic}*\n📸 Tem dúvida? Manda a foto do exercício!`);
      history.push({ role: 'user', content: '/prova ' + topic });
      history.push({ role: 'assistant', content: examReply });
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, { topic });
    }
    return;
  }

  // ── Conversa normal — método socrático ──────────────────────────────────────────────
  const examContext = examMode ? `\nO aluno está em modo pré-prova sobre "${examMode.topic}". Priorize perguntas e conceitos desse tema.` : '';
  const systemPrompt =
    `Você é um tutor de estudos inteligente que usa o método socrático.\n` +
    `Data de hoje: ${hoje}.${examContext}\n\n` +
    `Regras:\n- Faça perguntas para guiar o aluno a descobrir a resposta por conta própria\n- Não dê respostas diretas, prefira orientar com perguntas\n- Seja animado e encorajador, use emojis com moderação\n- Respostas curtas e diretas (máximo 3 parágrafos)\n- Se o aluno errar, corrija gentilmente\n- Fale sempre em português brasileiro`;
  const messages = [{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: userMsg }];
  const aiReply = await callGroq(messages, 500);
  if (aiReply) {
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: aiReply });
    points += 2;
    dailyCount++;
    const newBadges = addBadges(badges, points, streakDays);
    await sendMessage(from, aiReply);
    await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, examMode);
  }

  } finally {
    // Responder ao ZapResponder após todo o processamento
    if (!res.headersSent) res.status(200).json({ ok: true });
  }
}
