// lib/memory/retrieve.js — Busca memórias relevantes do aluno

import { embed } from './embed.js';
import { searchMemory, getRecentMemories } from '../supabase.js';

/**
 * Recupera as memórias mais relevantes para a mensagem atual.
 * Combina busca semântica (pgvector) com memórias recentes.
 *
 * Retorna: array de objetos { memory_type, subject, content, importance }
 */
export async function retrieveMemories(student, userMessage, subject = null) {
  const memories = [];

  // Tenta busca semântica se embedding disponível
  const msgEmbedding = await embed(userMessage);
  if (msgEmbedding) {
    try {
      const vectorResults = await searchMemory(
        student.id,
        msgEmbedding,
        6,
        subject
      );
      if (Array.isArray(vectorResults)) {
        memories.push(...vectorResults.filter(m => m.similarity > 0.4));
      }
    } catch (e) {
      console.warn('[memory:retrieve] Vector search failed:', e.message);
    }
  }

  // Se não teve resultado semântico suficiente, complementa com recentes
  if (memories.length < 3) {
    try {
      const recent = await getRecentMemories(student.id, 6);
      if (Array.isArray(recent)) {
        for (const m of recent) {
          const alreadyAdded = memories.some(r => r.id === m.id);
          if (!alreadyAdded) memories.push(m);
        }
      }
    } catch (e) {
      console.warn('[memory:retrieve] Recent memories failed:', e.message);
    }
  }

  // Ordena por importância e limita a 6
  return memories
    .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
    .slice(0, 6);
}

/**
 * Formata as memórias para injeção no system prompt.
 */
export function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return '';

  const lines = memories.map(m => {
    const tag = m.memory_type === 'weakness'    ? '⚠️ dificuldade'
              : m.memory_type === 'achievement' ? '✅ conquista'
              : m.memory_type === 'goal'        ? '🎯 objetivo'
              : m.memory_type === 'preference'  ? '💡 preferência'
              : m.memory_type === 'context'     ? '📅 contexto'
              : 'ℹ️ fato';
    const subj = m.subject ? ` [${m.subject}]` : '';
    return `- ${tag}${subj}: ${m.content}`;
  });

  return `\nMEMÓRIAS DO ALUNO:\n${lines.join('\n')}\n`;
}
