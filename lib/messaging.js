'use strict';
/**
 * lib/messaging.js — ZapResponder WhatsApp messaging
 * Vars: ZAPRESPONDER_TOKEN, ZAPRESPONDER_DEPARTMENT_ID
 */

const ZAP_TOKEN = process.env.ZAPRESPONDER_TOKEN;
const ZAP_DEPT  = process.env.ZAPRESPONDER_DEPARTMENT_ID;
const ZAP_BASE  = 'https://app.zapresponder.com.br/api/v1';

async function sendText(phone, message) {
  if (!ZAP_TOKEN) { console.error('[msg] ZAPRESPONDER_TOKEN ausente'); return false; }
  try {
    const r = await fetch(`${ZAP_BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZAP_TOKEN}` },
      body: JSON.stringify({ phone, message, department_id: ZAP_DEPT })
    });
    if (!r.ok) { console.error('[msg] sendText', r.status, await r.text()); return false; }
    return true;
  } catch (e) { console.error('[msg] sendText err:', e.message); return false; }
}

async function sendImage(phone, imageUrl, caption) {
  caption = caption || '';
  if (!ZAP_TOKEN) { console.error('[msg] ZAPRESPONDER_TOKEN ausente'); return false; }
  try {
    const r = await fetch(`${ZAP_BASE}/messages/send-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZAP_TOKEN}` },
      body: JSON.stringify({ phone, image_url: imageUrl, caption, department_id: ZAP_DEPT })
    });
    if (!r.ok) { console.error('[msg] sendImage', r.status, await r.text()); return false; }
    return true;
  } catch (e) { console.error('[msg] sendImage err:', e.message); return false; }
}

async function sendMessage(phone, text, imageUrl) {
  const p = String(phone).replace(/\D/g, '');
  if (imageUrl) return sendImage(p, imageUrl, text);
  if (text.length > 1500) {
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
      await new Promise(r => setTimeout(r, 300));
    }
    return ok;
  }
  return sendText(p, text);
}

module.exports = { sendMessage, sendText, sendImage };
