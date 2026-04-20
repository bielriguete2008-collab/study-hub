// lib/memory/store.js — Extrai e persiste memórias da conversa

import { embed, formatVector } from './embed.js';
import { saveMemory } from '../supabase.js';

const GROQ_KEY = process.env.GROQ_API_KEY;

/**
 * Analisa a conversa e extrai memórias relevantes usando LLM.
 * Chamado após cada resposta do bot.
 */
export async function extractAndStoreMemories(student, userMessage, botResponse, agentId) {
  try {
    const extracted = await extractMemories(student, userMessage, botResponse);
    if (!extracted || extracted.length === 0) return;

    // Persiste cada memória com embedding
    for (const mem of extracted) {
      const embedding = await embed(mem.content);
      const vectorStr = embedding ? formatVector(embedding) : null;

      await saveMemory(
        student.id,
        mem.type,
        mem.content,
        agentId || null,
        mem.importance || 0.6,
        vectorStr,
        mem.expires_at || null
      );
    }
  } catch (e) {
    console.warn('[memory:store] Failed:', e.message);
  }
}

/**
 * Chama o LLM para extrair fatos, preferências, dificuldades e conquistas
 * da última troca de mensagens.
 */
async function extractMemories(student, userMessage, botResponse) {
  const prompt = `Analise esta troca de mensagens entre um aluno e um tutor de IA.
Extraia apenas informações NOVAS e RELEVANTES sobre o aluno que merecem ser lembradas.

Mensagem do aluno: "${userMessage}"
Resposta do tutor: "${botResponse.slice(0, 500)}"

Retorne um JSON array (pode ser vazio []) com objetos no formato:
[
  {
    "type": "fact|preference|weakness|achievement|goal|context",
    "content": "descrição concisa da memória em linguagem natural",
    "importance": 0.1 a 1.0
  }
]

Regras:
- Só extraia se houver algo genuinamente novo e útil
- "weakness": o aluno demonstrou dificuldade com algo específico
- "achievement": o aluno acertou algo difícil ou progrediu
- "fact": dado pessoal relevante (curso, horário, objetivo de vida)
- "preference": como o aluno prefere aprender
- "goal": objetivo declarado ("quero passar em X")
- "context": situação temporária ("tem prova amanhã") — importance <= 0.4
- Máximo 2 memórias por chamada
- Se não houver nada relevante, retorne []

Responda APENAS com o JSON, sem texto adicional.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '[]';

    // Parse seguro
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch (e) {
    return [];
  }
}
