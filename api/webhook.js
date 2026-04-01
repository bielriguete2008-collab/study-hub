export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');

  const userMsg = (req.body && req.body.Body ? req.body.Body : '').trim();
  const from = req.body && req.body.From ? req.body.From : 'unknown';
  if (!userMsg) return res.status(200).send('<Response></Response>');

  const groqKey = process.env.GROQ_API_KEY;
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  // Data atual
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

  const systemPrompt = `Voce e o agente de estudos pessoal do Gabriel Moreira, estudante de Ciencia de Dados e Inteligencia Artificial (CDIA) no IBMEC Rio de Janeiro.

DATA ATUAL: ${hoje}

PROVAS PROXIMAS:
- Matematica Discreta: 04/04 (${c1})
- Programacao Estruturada: 07/04 (${c2})

DISCIPLINAS DO SEMESTRE:
1. Pensamento Computacional (dificuldade 2/5)
2. GAAL - Geometria Analitica e Algebra Linear (dificuldade 4/5)
3. Calculo I (dificuldade 4/5)
4. Matematica Discreta (dificuldade 3/5)
5. Programacao Estruturada (dificuldade 2/5)

LINK DO HUB: https://bielriguete2008-collab.github.io/study-hub/

REGRAS:
- Responda SEMPRE em portugues brasileiro informal
- Use formatacao WhatsApp: *negrito*, _italico_
- Maximo 500 caracteres. Se longo, divida e pergunte se quer continuar
- Exercicios: crie 3 problemas praticos com gabarito
- Seja motivador e encorajador`;

  // Buscar historico do Redis
  let history = [];
  try {
    const redisKey = 'history:' + from;
    const getRes = await fetch(redisUrl + '/get/' + encodeURIComponent(redisKey), {
      headers: { Authorization: 'Bearer ' + redisToken }
    });
    const getData = await getRes.json();
    if (getData.result) {
      history = JSON.parse(getData.result);
      if (!Array.isArray(history)) history = [];
    }
  } catch (e) {
    history = [];
  }

  // Manter apenas as ultimas 20 mensagens (10 trocas)
  if (history.length > 20) history = history.slice(history.length - 20);

  // Montar mensagens para o Groq
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMsg }
  ];

  let reply = 'Nao consegui processar agora. Tente novamente!';
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + groqKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 400,
        temperature: 0.7
      })
    });
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      reply = data.choices[0].message.content.trim();
    }

    // Salvar historico atualizado no Redis (TTL 24h)
    try {
      const newHistory = [...history, { role: 'user', content: userMsg }, { role: 'assistant', content: reply }];
      const redisKey = 'history:' + from;
      await fetch(redisUrl + '/set/' + encodeURIComponent(redisKey), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(newHistory), ex: 86400 })
      });
    } catch (e) {}

  } catch (err) {
    reply = 'Agente temporariamente fora. Tente em instantes!';
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>' + reply + '</Body></Message></Response>';
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
