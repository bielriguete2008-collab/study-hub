export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Agent IA OK');

  const userMsg = (req.body && req.body.Body ? req.body.Body : '').trim();
  if (!userMsg) return res.status(200).send('<Response></Response>');

  const groqKey = process.env.GROQ_API_KEY;

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
1. Pensamento Computacional (dificuldade 2/5) - logica, algoritmos basicos
2. GAAL - Geometria Analitica e Algebra Linear (dificuldade 4/5) - vetores, matrizes, determinantes, sistemas lineares
3. Calculo I (dificuldade 4/5) - limites, derivadas, regras de derivacao, aplicacoes
4. Matematica Discreta (dificuldade 3/5) - logica proposicional, tabelas verdade, conjuntos, relacoes, inducao matematica
5. Programacao Estruturada (dificuldade 2/5) - variaveis, condicionais, loops, funcoes em Python/C

LINK DO HUB DE ESTUDOS: https://bielriguete2008-collab.github.io/study-hub/

REGRAS DE RESPOSTA:
- Responda SEMPRE em portugues brasileiro informal e amigavel
- Use formatacao WhatsApp: *negrito* para termos importantes, _italico_ para enfase
- Seja CONCISO: maximo 500 caracteres. Se a explicacao for longa, divida em partes e pergunte se quer continuar
- Quando pedir exercicios: crie 3 problemas praticos com gabarito ao final
- Quando pedir plano: priorize materias com prova mais proxima
- Seja motivador e encorajador, Gabriel e estudante dedicado
- Se nao entender a pergunta, peca mais contexto de forma simples`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + groqKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    const data = await response.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
      ? data.choices[0].message.content.trim()
      : 'Nao consegui processar agora. Tente novamente!';

    const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>' + reply + '</Body></Message></Response>';
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(xml);

  } catch (err) {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>Agente temporariamente fora. Tente em instantes!</Body></Message></Response>';
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(xml);
  }
        }
