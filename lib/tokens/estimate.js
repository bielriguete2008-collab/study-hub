// lib/tokens/estimate.js
const GROQ_KEY = process.env.GROQ_API_KEY;
export const COMPLEXITY = {
  1: { label: 'simples',  tokens: 1  },
  2: { label: 'médio',    tokens: 3  },
  3: { label: 'complexo', tokens: 6  },
  4: { label: 'premium',  tokens: 12 }
};
const QUICK_LEVEL_4 = ['plano de estudos','resumo completo','simulado','prova completa','corrij','avali','redação','trabalho','relatório'];
const QUICK_LEVEL_3 = ['exercício','exercicios','resolve','passo a passo','quiz','questões','questoes','analise','por que erro'];
const QUICK_LEVEL_1 = ['o que é','o que são','defina','fórmula de','formula de','está certo','ta certo','verdade ou','sim ou não'];

export async function estimateComplexity(message) {
  const lower = message.toLowerCase();
  if (QUICK_LEVEL_4.some(kw => lower.includes(kw))) return COMPLEXITY[4];
  if (QUICK_LEVEL_3.some(kw => lower.includes(kw))) return COMPLEXITY[3];
  if (QUICK_LEVEL_1.some(kw => lower.includes(kw))) return COMPLEXITY[1];
  if (message.trim().length < 40)  return COMPLEXITY[1];
  if (message.trim().length < 200) return COMPLEXITY[2];
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: `Classifique 1-4:\n1=simples 2=explicação 3=exercício 4=plano\nMensagem: "${message.slice(0, 300)}"\nResponda APENAS o número.` }], max_tokens: 5, temperature: 0 })
    });
    const data = await res.json();
    const level = parseInt(data?.choices?.[0]?.message?.content?.trim()) || 2;
    return COMPLEXITY[Math.min(Math.max(level, 1), 4)];
  } catch { return COMPLEXITY[2]; }
}
