// lib/messaging.js — Envio de mensagens via ZapResponder
// Env vars: ZAPRESPONDER_URL, ZAPRESPONDER_KEY, ZAPRESPONDER_INSTANCE

const ZAP_URL      = process.env.ZAPRESPONDER_URL;
const ZAP_KEY      = process.env.ZAPRESPONDER_KEY;
const ZAP_INSTANCE = process.env.ZAPRESPONDER_INSTANCE;

/**
 * Envia mensagem de texto via ZapResponder
 * @param {string} phone  - Número E.164 sem + (ex: 5511999999999)
 * @param {string} text   - Texto da mensagem
 */
export async function sendMessage(phone, text) {
  if (!ZAP_URL || !ZAP_KEY || !ZAP_INSTANCE) {
    console.error('[messaging] ZapResponder env vars não configuradas');
    return false;
  }
  try {
    const r = await fetch(`${ZAP_URL}/message/sendText/${ZAP_INSTANCE}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ZAP_KEY },
      body:    JSON.stringify({ number: phone, text })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error(`[messaging] Erro ao enviar para ${phone}:`, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[messaging] Erro de rede:', e.message);
    return false;
  }
}
