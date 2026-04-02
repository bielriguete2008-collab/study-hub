export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');

  const userMsg = (req.body && req.body.Body ? req.body.Body : '').trim();
  const from = req.body && req.body.From ? req.body.From : 'unknown';
  if (!userMsg) return res.status(200).send('<Response></Response>');

  const groqKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

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

Seu papel e ajudar o Gabriel a estudar, revisar materias, criar resumos, montar planos de estudo e se preparar para provas. Seja direto, didatico e motivador. Responda sempre em portugues. Mantenha o contexto da conversa e lembre do que foi dito anteriormente.`;

  // Buscar historico do Supabase
  let history = [];
  try {
    const getRes = await fetch(
      supabaseUrl + '/rest/v1/conversations?phone=eq.' + encodeURIComponent(from) + '&select=history',
      { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
    );
    const rows = await getRes.json();
    if (rows && rows[0] && Array.isArray(rows[0].history)) {
      history = rows[0].history;
    }
  } catch (e) { history = []; }

  if (history.length > 20) history = history.slice(history.length - 20);

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
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 400, temperature: 0.7 })
    });
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      reply = data.choices[0].message.content.trim();
    }

    // Salvar historico no Supabase (upsert)
    try {
      const newHistory = [...history, { role: 'user', content: userMsg }, { role: 'assistant', content: reply }];
      await fetch(supabaseUrl + '/rest/v1/conversations', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ phone: from, history: newHistory, updated_at: new Date().toISOString() })
      });
    } catch (e) {}

  } catch (err) {
    reply = 'Agente temporariamente fora. Tente em instantes!';
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>' + reply + '</Body></Message></Response>';
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
