// lib/orchestrator/router.js — Motor de roteamento de matéria via LLM
const GROQ_KEY = process.env.GROQ_API_KEY;

export async function routeToAgent(message, availableAgents, courseName) {
  const agentList = availableAgents.join(', ');
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `Você é o orquestrador do curso de ${courseName}.
Um aluno enviou: "${message.slice(0, 400)}"

Agentes disponíveis: ${agentList}

Qual agente deve responder? Responda APENAS com o ID exato do agente.` }],
        max_tokens: 30, temperature: 0
      })
    });
    const data = await res.json();
    const agentId = data?.choices?.[0]?.message?.content?.trim().toLowerCase();
    if (agentId && availableAgents.includes(agentId)) return agentId;
    return availableAgents[0];
  } catch (e) {
    return availableAgents[0];
  }
}
