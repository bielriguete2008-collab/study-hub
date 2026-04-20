// lib/memory/embed.js — Geração de embeddings via Groq (all-MiniLM via API)
// Usamos o modelo de embedding do Groq para manter tudo na mesma infra

const GROQ_KEY = process.env.GROQ_API_KEY;

/**
 * Gera embedding de 384 dimensões para um texto.
 * Usa nomic-embed-text via Groq (gratuito no tier atual).
 * Retorna array de floats ou null se falhar.
 */
export async function embed(text) {
  if (!text || !GROQ_KEY) return null;

  // Limita texto a 512 tokens (~2000 chars) para o modelo de embedding
  const input = text.slice(0, 2000).trim();

  try {
    const res = await fetch('https://api.groq.com/openai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nomic-embed-text-v1_5',
        input,
        encoding_format: 'float'
      })
    });

    if (!res.ok) {
      // Fallback: embedding não é crítico, retorna null sem travar
      console.warn('[embed] Groq embedding failed:', res.status);
      return null;
    }

    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    console.warn('[embed] Error:', e.message);
    return null;
  }
}

/**
 * Formata o vector para o formato do pgvector: '[0.1, 0.2, ...]'
 */
export function formatVector(embedding) {
  if (!embedding || !Array.isArray(embedding)) return null;
  return `[${embedding.join(',')}]`;
}
