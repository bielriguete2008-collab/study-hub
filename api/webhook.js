export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Hub AI â Webhook OK');

  const body = req.body || {};
  if (body.event !== 'messages.upsert') return res.status(200).json({ ok: true });

  const data = body.data || {};
  const key = data.key || {};
  if (key.fromMe) return res.status(200).json({ ok: true });

  const msg = data.message || {};

  // Detectar tipo de mensagem (texto ou imagem)
  const userMsg = (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.buttonsResponseMessage?.selectedDisplayText ||
    ''
  ).trim();

  const hasImage = !!(msg.imageMessage);
  const imageCaption = msg.imageMessage?.caption?.trim() || '';
  const imageBase64 = msg.imageMessage?.base64 || null;
  const imageUrl = msg.imageMessage?.url || null;

  // Ignorar mensagens sem conteÃºdo
  if (!userMsg && !hasImage) return res.status(200).json({ ok: true });

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
  const mpAccessToken = process.env.MP_ACCESS_TOKEN; // Mercado Pago

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
  const dias = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const hoje = dias[now.getDay()] + ', ' + now.getDate() + ' de ' + meses[now.getMonth()];

  const FREE_DAILY_LIMIT = 20;

  // ââ Responder 200 imediatamente para o Evolution API nÃ£o retentar ââââââââââ
  res.status(200).json({ ok: true });

  const sendMessage = async (phone, message) => {
    try {
      await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify({ number: phone, text: message })
      });
    } catch (e) { console.error('sendMessage error:', e); }
  };

  // ââ Carregar dados do usuÃ¡rio ââââââââââââââââââââââââââââââââââââââââââââââ
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

  // Reset contador diÃ¡rio se mudou o dia
  if (dailyDate !== today) { dailyCount = 0; dailyDate = today; }

  // Calcular streak
  if (lastActivity === today) {}
  else if (lastActivity === yesterday) { streakDays += 1; }
  else if (lastActivity !== null) { streakDays = 1; }
  else { streakDays = 1; }

  // ââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
        headers: {
          'Authorization': 'Bearer ' + mpAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [{
            title: 'Study Hub Pro â Plano Mensal',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: 19.90
          }],
          payment_methods: {
            excluded_payment_types: [{ id: 'ticket' }],
            default_payment_method_id: 'pix'
          },
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
    if (streak >= 3 && !b.includes('ð¥')) b.push('ð¥');
    if (streak >= 7 && !b.includes('ðª')) b.push('ðª');
    if (pts >= 50 && !b.includes('ð§ ')) b.push('ð§ ');
    if (pts >= 100 && !b.includes('â­')) b.push('â­');
    if (pts >= 300 && !b.includes('ð')) b.push('ð');
    return b;
  };

  const msgLower = userMsg.toLowerCase().trim();

  // ââ BOAS-VINDAS para novos usuÃ¡rios ââââââââââââââââââââââââââââââââââââââ
  if (isNewUser) {
    const welcome =
      `OlÃ¡! ð Bem-vindo ao *Study Hub* â seu tutor de estudos com IA no WhatsApp!\n\n` +
      `Sou um tutor inteligente que usa o mÃ©todo socrÃ¡tico: em vez de dar respostas prontas, te guio a descobrir por conta prÃ³pria. ð§ \n\n` +
      `ð *O que posso fazer:*\n` +
      `â¢ Explicar qualquer matÃ©ria\n` +
      `â¢ Resolver exercÃ­cios (manda foto! ð¸)\n` +
      `â¢ Criar quizzes com pontuaÃ§Ã£o\n` +
      `â¢ Modo intensivo prÃ©-prova\n` +
      `â¢ Acompanhar seu progresso com streaks e badges\n\n` +
      `â¡ *Comandos:*\n` +
      `*/quiz [matÃ©ria]* â quiz de mÃºltipla escolha\n` +
      `*/prova [matÃ©ria]* â modo intensivo prÃ©-prova\n` +
      `*/stats* â seus pontos, streak e badges\n` +
      `*/plano* â plano atual\n` +
      `*/assinar* â upgrade para Pro ilimitado\n\n` +
      `ð *Gratuito:* 20 msgs/dia | â­ *Pro:* R$19,90/mÃªs ilimitado\n\n` +
      `Por onde quer comeÃ§ar? Me conta o que estÃ¡ estudando! ð`;
    await sendMessage(from, welcome);
    await saveToSupabase([], 0, 1, [], 'free', 1, null, null);
    return;
  }

  // ââ /ajuda ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower === '/ajuda' || msgLower === '/help') {
    const help =
      `ð *Comandos disponÃ­veis:*\n\n` +
      `*/quiz [matÃ©ria]* â quiz de mÃºltipla escolha\n` +
      `*/prova [matÃ©ria]* â modo intensivo prÃ©-prova\n` +
      `*/stats* â seus pontos, streak e badges\n` +
      `*/plano* â ver plano atual e limites\n` +
      `*/assinar* â fazer upgrade para Pro\n` +
      `*/cancelar* â sair do modo atual\n\n` +
      `ð¸ *Envie uma foto* de qualquer exercÃ­cio e eu resolvo!\n\n` +
      `ð¬ Ou simplesmente me conte o que estÃ¡ estudando!`;
    await sendMessage(from, help);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }

  // ââ /plano ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower === '/plano') {
    const isPro = plan === 'pro';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply = isPro
      ? `â­ *Plano: PRO*\n\nAcesso ilimitado! ð\nð Pontos: ${points} | ð¥ Streak: ${streakDays} dia(s)`
      : `ð *Plano: Gratuito*\n\nMensagens hoje: ${dailyCount}/${FREE_DAILY_LIMIT} (restam ${remaining})\n\nð¡ */assinar* para Pro por R$19,90/mÃªs â sem limites!`;
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }

  // ââ /assinar ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower === '/assinar') {
    if (plan === 'pro') {
      await sendMessage(from, 'â­ VocÃª jÃ¡ Ã© assinante Pro! Aproveite o acesso ilimitado. ð');
      return;
    }
    await sendMessage(from, 'â³ Gerando seus links de pagamento...');

    const [stripeUrl, mpUrl] = await Promise.all([
      createStripeCheckout(from),
      createMercadoPagoCheckout(from)
    ]);

    let reply =
      `ð³ *Study Hub Pro â R$19,90/mÃªs*\n\n` +
      `â Mensagens ilimitadas\n` +
      `â Quiz e modo prova ilimitados\n` +
      `â Suporte a imagens\n` +
      `â Streaks e badges sem limite\n\n`;

    if (stripeUrl && mpUrl) {
      reply +=
        `Escolha sua forma de pagamento:\n\n` +
        `ð³ *CartÃ£o de crÃ©dito:*\n${stripeUrl}\n\n` +
        `ð¡ *Pix / CartÃ£o (Mercado Pago):*\n${mpUrl}\n\n` +
        `_Plano ativado automaticamente apÃ³s o pagamento!_`;
    } else if (stripeUrl) {
      reply +=
        `ð° Aceita *cartÃ£o de crÃ©dito*\n\n` +
        `ð Clique para assinar:\n${stripeUrl}\n\n` +
        `_Plano ativado automaticamente apÃ³s o pagamento!_`;
    } else if (mpUrl) {
      reply +=
        `ð¡ Aceita *Pix e cartÃ£o* via Mercado Pago\n\n` +
        `ð Clique para assinar:\n${mpUrl}\n\n` +
        `_Plano ativado automaticamente apÃ³s o pagamento!_`;
    } else {
      reply += 'â Erro ao gerar link. Tente novamente em instantes.';
    }

    await sendMessage(from, reply);
    return;
  }

  // ââ /stats ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower === '/stats') {
    const isPro = plan === 'pro';
    const badgeList = badges.length > 0 ? badges.join(' ') : 'Nenhuma ainda';
    const remaining = isPro ? 'ilimitado' : Math.max(0, FREE_DAILY_LIMIT - dailyCount);
    const reply =
      `ð *Suas estatÃ­sticas:*\n\n` +
      `ð Pontos: ${points}\n` +
      `ð¥ Streak: ${streakDays} dia(s) consecutivos\n` +
      `ðï¸ Badges: ${badgeList}\n` +
      `ð Plano: ${isPro ? 'â­ Pro' : 'ð Gratuito'}\n` +
      `ð¬ Mensagens hoje: ${dailyCount}${isPro ? '' : '/' + FREE_DAILY_LIMIT} (restam: ${remaining})\n\n` +
      `_Continue estudando para ganhar mais badges!_`;
    await sendMessage(from, reply);
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, pendingQuiz, examMode);
    return;
  }

  // ââ /cancelar âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower === '/cancelar') {
    await sendMessage(from, 'â Modo cancelado. Pode me perguntar qualquer coisa! ð');
    await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, null, null);
    return;
  }

  // ââ Limite do plano Free ââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (plan === 'free' && dailyCount >= FREE_DAILY_LIMIT) {
    const reply =
      `â ï¸ *Limite diÃ¡rio atingido!*\n\n` +
      `VocÃª usou ${FREE_DAILY_LIMIT} mensagens hoje. O limite renova Ã  meia-noite.\n\n` +
      `ð¡ Digite */assinar* para acesso *ilimitado* por R$19,90/mÃªs!\n` +
      `Aceita *Pix* e cartÃ£o de crÃ©dito. ð¡`;
    await sendMessage(from, reply);
    return;
  }

  // ââ IMAGEM: resolver exercÃ­cio com visÃ£o ââââââââââââââââââââââââââââââââââ
  if (hasImage) {
    dailyCount++;
    points += 3;

    let imageData = imageBase64;

    // Se nÃ£o veio base64, tenta baixar da URL
    if (!imageData && imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        const imgBuf = await imgRes.arrayBuffer();
        imageData = Buffer.from(imgBuf).toString('base64');
      } catch (e) {}
    }

    if (!imageData) {
      await sendMessage(from, 'â NÃ£o consegui processar a imagem. Tente enviar novamente.');
      return;
    }

    const prompt = imageCaption
      ? `O aluno enviou uma imagem com a legenda: "${imageCaption}". Analise a imagem e ajude com o que foi pedido, usando o mÃ©todo socrÃ¡tico â faÃ§a perguntas para guiar o aluno Ã  resposta. Se for um exercÃ­cio, mostre o raciocÃ­nio passo a passo. Responda em portuguÃªs.`
      : `O aluno enviou uma imagem de exercÃ­cio ou conteÃºdo de estudo. Identifique o que Ã© e ajude usando o mÃ©todo socrÃ¡tico â guie o aluno com perguntas em vez de dar a resposta direto. Se for um problema matemÃ¡tico ou cientÃ­fico, mostre o raciocÃ­nio. Responda em portuguÃªs, de forma clara e didÃ¡tica.`;

    const visionReply = await callGroqVision(imageData, prompt);

    if (visionReply) {
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from, `ð¸ *Analisando sua imagem...*\n\n${visionReply}`);
      history.push({ role: 'user', content: '[Enviou uma imagem para anÃ¡lise]' });
      history.push({ role: 'assistant', content: visionReply });
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, pendingQuiz, examMode);
    } else {
      await sendMessage(from, 'â NÃ£o consegui analisar a imagem. Tente descrever o exercÃ­cio em texto!');
    }
    return;
  }

  // ââ Resposta interativa de quiz (A / B / C / D) âââââââââââââââââââââââââââ
  if (pendingQuiz && /^[abcd]$/i.test(msgLower)) {
    const userAnswer = msgLower.toUpperCase();
    const correct = pendingQuiz.correct;
    dailyCount++;

    if (userAnswer === correct) {
      points += 10;
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from,
        `â *Correto! ${correct} Ã© a resposta certa!*\n\n` +
        `+10 pontos! ð Total: ${points} pts\n\n` +
        `Quer tentar mais? */quiz ${pendingQuiz.topic || 'qualquer matÃ©ria'}*`
      );
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, examMode);
    } else {
      await sendMessage(from,
        `â *NÃ£o foi dessa vez!*\n\n` +
        `A resposta correta era *${correct}*.\n\n` +
        `NÃ£o desanime â errar faz parte de aprender! ðª\n\n` +
        `Tente outro: */quiz ${pendingQuiz.topic || 'qualquer matÃ©ria'}*`
      );
      await saveToSupabase(history, points, streakDays, badges, plan, dailyCount, null, examMode);
    }
    return;
  }

  // ââ /quiz âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (msgLower.startsWith('/quiz')) {
    const topic = userMsg.slice(5).trim() || 'qualquer matÃ©ria';
    const quizReply = await callGroq([
      { role: 'system', content: 'VocÃª Ã© um professor. Crie UMA pergunta de mÃºltipla escolha com opÃ§Ãµes A, B, C, D sobre o tema pedido. Formato: escreva a pergunta, depois as 4 opÃ§Ãµes marcadas com A), B), C), D), e por Ãºltimo escreva exatamente "Resposta correta: X" onde X Ã© a letra. Seja conciso e use portuguÃªs.' },
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

      await sendMessage(from,
        `ð¯ *Quiz â ${topic}*\n\n${displayedReply}\n\n_Responda com A, B, C ou D_`
      );
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, newPending, examMode);
    }
    return;
  }

  // ââ /prova â Modo prÃ©-prova intensivo âââââââââââââââââââââââââââââââââââââ
  if (msgLower.startsWith('/prova')) {
    const topic = userMsg.slice(6).trim();

    if (!topic) {
      await sendMessage(from,
        `ð *Modo PrÃ©-Prova*\n\n` +
        `Me diz qual matÃ©ria ou tema vocÃª quer revisar!\n\n` +
        `Exemplos:\n` +
        `â¢ */prova CÃ¡lculo â limites e derivadas*\n` +
        `â¢ */prova Biologia celular*\n` +
        `â¢ */prova InglÃªs â tempos verbais*\n` +
        `â¢ */prova Direito Constitucional*`
      );
      return;
    }

    dailyCount++;
    const examReply = await callGroq([
      {
        role: 'system',
        content:
          `VocÃª Ã© um professor especializado em preparaÃ§Ã£o para provas. O aluno tem uma prova chegando e precisa de uma revisÃ£o intensiva e rÃ¡pida.\n\n` +
          `Crie um material de revisÃ£o completo e estruturado com:\n` +
          `1. Os 5 pontos mais importantes do tema (com â­ no inÃ­cio)\n` +
          `2. FÃ³rmulas ou conceitos-chave (se houver)\n` +
          `3. Um macete ou dica de memorizaÃ§Ã£o\n` +
          `4. Um erro comum que cai em prova\n\n` +
          `Seja direto, didÃ¡tico e use emojis com moderaÃ§Ã£o. Responda em portuguÃªs.`
      },
      { role: 'user', content: 'Preparar revisÃ£o para prova de: ' + topic }
    ], 800);

    if (examReply) {
      const newBadges = addBadges(badges, points, streakDays);
      await sendMessage(from,
        `ð *Modo PrÃ©-Prova: ${topic}*\n\n${examReply}\n\n` +
        `---\nð¡ Quer praticar com exercÃ­cios? */quiz ${topic}*\n` +
        `ð¸ Tem dÃºvida? Manda a foto do exercÃ­cio!`
      );
      history.push({ role: 'user', content: '/prova ' + topic });
      history.push({ role: 'assistant', content: examReply });
      await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, { topic });
    }
    return;
  }

  // ââ Conversa normal â mÃ©todo socrÃ¡tico ââââââââââââââââââââââââââââââââââââ
  const examContext = examMode
    ? `\nO aluno estÃ¡ em modo prÃ©-prova sobre "${examMode.topic}". Priorize perguntas e conceitos desse tema.`
    : '';

  const systemPrompt =
    `VocÃª Ã© um tutor de estudos inteligente que usa o mÃ©todo socrÃ¡tico.\n` +
    `Data de hoje: ${hoje}.${examContext}\n\n` +
    `Regras:\n` +
    `- FaÃ§a perguntas para guiar o aluno a descobrir a resposta por conta prÃ³pria\n` +
    `- NÃ£o dÃª respostas diretas, prefira orientar com perguntas\n` +
    `- Seja animado e encorajador, use emojis com moderaÃ§Ã£o\n` +
    `- Respostas curtas e diretas (mÃ¡ximo 3 parÃ¡grafos)\n` +
    `- Se o aluno errar, corrija gentilmente\n` +
    `- Fale sempre em portuguÃªs brasileiro`;

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
    dailyCount++;
    const newBadges = addBadges(badges, points, streakDays);
    await sendMessage(from, aiReply);
    await saveToSupabase(history, points, streakDays, newBadges, plan, dailyCount, null, examMode);
  }
}
