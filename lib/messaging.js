// lib/messaging.js — Envio de mensagens via ZapResponder (primary) ou Evolution (fallback)

const ZAP_TOKEN   = process.env.ZAPRESPONDER_TOKEN;
const ZAP_DEPT_ID = process.env.ZAPRESPONDER_DEPARTMENT_ID;
const EVO_URL     = process.env.EVOLUTION_URL;
const EVO_KEY     = process.env.EVOLUTION_API_KEY;
const EVO_INST    = process.env.EVOLUTION_INSTANCE;

export async function sendMessage(phone, message) {
  // Tenta Evolution primeiro (se configurado)
  if (EVO_URL && EVO_KEY && EVO_INST) {
    try {
      const r = await fetch(`${EVO_URL}/message/sendText/${EVO_INST}`, {
        method:  'POST',
        headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ number: phone, text: message })
      });
      const d = await r.json();
      if (!d.error && (d.key || d.id || r.status === 201)) {
        console.log(`[Evolution] ✓ ${phone}`);
        return true;
      }
    } catch (e) { console.warn('[Evolution] sendMessage error:', e.message); }
  }

  // Fallback: ZapResponder
  if (ZAP_TOKEN && ZAP_DEPT_ID) {
    try {
      await fetch(`https://api.zapresponder.com.br/api/whatsapp/message/${ZAP_DEPT_ID}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZAP_TOKEN}` },
        body:    JSON.stringify({ type: 'text', message, number: phone, showInChat: true })
      });
      console.log(`[ZapResponder] ✓ ${phone}`);
      return true;
    } catch (e) { console.warn('[ZapResponder] sendMessage error:', e.message); }
  }

  console.error(`[messaging] Nenhum provider disponível para ${phone}`);
  return false;
}

export async function sendImageMessage(phone, url, caption = '') {
  if (EVO_URL && EVO_KEY && EVO_INST) {
    try {
      const r = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INST}`, {
        method:  'POST',
        headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ number: phone, mediatype: 'image', media: url, caption })
      });
      const d = await r.json();
      if (!d.error && (d.key || r.status === 201)) return true;
    } catch (e) { console.warn('[Evolution] sendImage error:', e.message); }
  }

  if (ZAP_TOKEN && ZAP_DEPT_ID) {
    try {
      await fetch(`https://api.zapresponder.com.br/api/whatsapp/message/${ZAP_DEPT_ID}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZAP_TOKEN}` },
        body:    JSON.stringify({ type: 'image', url, message: caption, number: phone, showInChat: true })
      });
      return true;
    } catch (e) { console.warn('[ZapResponder] sendImage error:', e.message); }
  }
  return false;
}
