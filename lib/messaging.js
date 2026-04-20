'use strict';
/**
 * lib/messaging.js — ZapResponder WhatsApp messaging
 * API: POST https://api.zapresponder.com.br/api/whatsapp/message/{departamentoId}
 * Auth: Authorization: {ZAPRESPONDER_TOKEN}  (sem "Bearer")
 * Env: ZAPRESPONDER_TOKEN, ZAPRESPONDER_DEPARTMENT_ID
 */

const ZAP_TOKEN = process.env.ZAPRESPONDER_TOKEN;
const ZAP_DEPT  = process.env.ZAPRESPONDER_DEPARTMENT_ID;
const ZAP_BASE  = 'https://api.zapresponder.com.br/api';

async function sendText(phone, message) {
  if (!ZAP_TOKEN || !ZAP_DEPT) {
    console.error('[msg] ZAPRESPONDER_TOKEN ou ZAPRESPONDER_DEPARTMENT_ID ausente');
    return false;
  }
  try {
    const r = await fetch(`${ZAP_BASE}/whatsapp/message/${ZAP_DEPT}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': ZAP_TOKEN
      },
      body: JSON.stringify({
        type: 'text',
        message,
        number: String(phone).replace(/\D/g, ''),
        showInChat: true
      })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[msg] sendText error', r.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[msg] sendText exception:', e.message);
    return false;
  }
}

async function sendImage(phone, imageUrl, caption) {
  caption = caption || '';
  if (!ZAP_TOKEN || !ZAP_DEPT) {
    console.error('[msg] ZAPRESPONDER_TOKEN ou ZAPRESPONDER_DEPARTMENT_ID ausente');
    return false;
  }
  try {
    const r = await fetch(`${ZAP_BASE}/whatsapp/message/${ZAP_DEPT}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': ZAP_TOKEN
      },
      body: JSON.stringify({
        type: 'image',
        url: imageUrl,
        message: caption,
        number: String(phone).replace(/\D/g, ''),
        showInChat: true
      })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[msg] sendImage error', r.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[msg] sendImage exception:', e.message);
    return false;
  }
}

async function sendMessage(phone, text, imageUrl) {
  const p = String(phone).replace(/\D/g, '');
  if (imageUrl) return sendImage(p, imageUrl, text);
  // Split mensagens longas em partes de ate 1500 chars
  if (text && text.length > 1500) {
    const parts = [];
    let rem = text;
    while (rem.length > 0) {
      let cut = rem.lastIndexOf('\n', 1500);
      if (cut < 800) cut = 1500;
      parts.push(rem.slice(0, cut));
      rem = rem.slice(cut).trim();
    }
    let ok = true;
    for (const part of parts) {
      ok = (await sendText(p, part)) && ok;
      await new Promise(r => setTimeout(r, 400));
    }
    return ok;
  }
  return sendText(p, text);
}

module.exports = { sendMessage, sendText, sendImage };
