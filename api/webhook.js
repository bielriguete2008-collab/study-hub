// api/webhook.js — Study Hub v2 · Orquestrador Principal
import { getStudent, createStudent, updateStudent, saveConversation, getRecentConversations, upsertProgress } from '../lib/supabase.js';
import { sendMessage } from '../lib/messaging.js';
import { checkRateLimit, isBlocked } from '../lib/security/ratelimit.js';
import { generateOTP, setOTP, validateOTP, markOTPVerified, incrementOTPAttempt } from '../lib/security/otp.js';
import { retrieveMemories, formatMemoriesForPrompt } from '../lib/memory/retrieve.js';
import { extractAndStoreMemories } from '../lib/memory/store.js';
import { estimateComplexity } from '../lib/tokens/estimate.js';
import { debitTokens, hasSufficientTokens, buildTokenMessage, buildNoTokensMessage } from '../lib/tokens/debit.js';
import { getPlan, canAccess, canAccessSubject } from '../lib/tokens/plans.js';
import { handleOnboarding, getFirstQuestion } from '../lib/onboarding/flow.js';
import { routeToCourse } from '../lib/orchestrator/index.js';
import { buildAgentPrompt, AGENTS } from '../lib/agents/index.js';

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODELS = { basic: 'llama-3.3-70b-versatile', fast: 'llama-3.3-70b-versatile', advanced: 'llama-3.3-70b-versatile' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Hub v2 · OK');
  res.status(200).json({ ok: true });
  try { await processWebhook(req.body || {}); } catch (e) { console.error('[webhook]', e.message); }
}

function parsePayload(body) {
  let from = '', userMsg = '', hasImage = false, imageUrl = null, imageCaption = '';
  const isEvolution = body.event === 'messages.upsert' && body.data?.key;
  if (isEvolution) {
    const d = body.data, key = d.key || {};
    if (key.fromMe) return null;
    const jid = (key.remoteJid || '').toString();
    if (jid.includes('@g.us') || jid === 'status@broadcast') return null;
    from = jid.replace(/@[a-z.]+/g, '').trim();
    if (!from || from.length < 8) return null;
    const msg = d.message || {};
    userMsg = (msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || '').trim();
    if (d.messageType === 'imageMessage' || msg.imageMessage) { hasImage = true; imageUrl = msg.imageMessage?.url; imageCaption = (msg.imageMessage?.caption || '').trim(); }
  } else {
    const raw = body.data || body;
    if (raw.fromMe === true || raw.fromMe === 'true') return null;
    from = ((raw.chatId || raw.phone || raw.contact?.phone || raw.from || '')).toString().replace(/@[a-z.]+/g, '').trim();
    if (!from || from === 'status' || from.length < 8) return null;
    userMsg = (raw.message || raw.body || raw.text || raw.content || '').toString().trim();
    const t = (raw.type || '').toLowerCase();
    hasImage = t === 'image' || !!(raw.mediaUrl && ['image','video'].includes(t));
    imageCaption = (raw.caption || '').trim(); imageUrl = raw.mediaUrl || raw.imageUrl || null;
  }
  if (!userMsg && !hasImage) return null;
  return { from, userMsg, hasImage, imageUrl, imageCaption };
}

async function processWebhook(body) {
  const parsed = parsePayload(body);
  if (!parsed) return;
  const { from, userMsg, hasImage, imageUrl, imageCaption } = parsed;
  if (await isBlocked(from)) return;
  const rateCheck = await checkRateLimit(from);
  if (!rateCheck.allowed) { if (rateCheck.reason === 'hourly_limit') await sendMessage(from, '⏳ Limite de 60 msgs/hora atingido. Aguarde.'); return; }
  let student = await getStudent(from);
  if (!student) { student = await createStudent(from); await sendMessage(from, getFirstQuestion()); return; }
  if (!student.otp_verified) { await handleOTPFlow(from, student, userMsg); return; }
  if (!student.onboarded)    { await handleOnboardingFlow(from, student, userMsg); return; }
  const plan = getPlan(student.plan);
  if (!hasSufficientTokens(student, 1)) { await sendMessage(from, buildNoTokensMessage(student)); return; }
  const message    = hasImage ? (imageCaption || 'Analise esta imagem') : userMsg;
  const complexity = await estimateComplexity(message);
  if (!hasSufficientTokens(student, complexity.tokens)) { await sendMessage(from, `❌ Esta pergunta requer *${complexity.tokens} créditos* mas você tem *${student.tokens_balance}*.`); return; }
  let memoriesText = '';
  if (canAccess(student, 'memory')) { const mems = await retrieveMemories(student, message); memoriesText = formatMemoriesForPrompt(mems); }
  const agentId   = await routeToCourse(student, message);
  const agentInfo = AGENTS[agentId];
  if (plan.id === 'free' && !canAccessSubject(student, agentId)) {
    const allowed = student.allowed_subjects || [];
    if (allowed.length >= 2) { await sendMessage(from, `📚 No plano *Free* você acessa até *2 matérias*. Faça upgrade: ${process.env.STRIPE_BILLING_URL}`); return; }
    await updateStudent(from, { allowed_subjects: [...allowed, agentId] });
  }
  const recentConvs = await getRecentConversations(student.id, 8);
  const history = (recentConvs || []).reverse().map(c => ({ role: c.role === 'assistant' ? 'assistant' : 'user', content: c.content }));
  const systemPrompt = buildAgentPrompt(agentId, student, memoriesText);
  const model   = GROQ_MODELS[plan.model] || GROQ_MODELS.basic;
  const maxToks = complexity.level >= 4 ? 1500 : complexity.level >= 3 ? 1000 : 600;
  const t0      = Date.now();
  const aiReply = await callGroq([{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }], model, maxToks);
  const latency = Date.now() - t0;
  if (!aiReply) { await sendMessage(from, '❌ Problema ao responder. Tente novamente.'); return; }
  const newBalance  = student.tokens_balance - complexity.tokens;
  const tokenFooter = buildTokenMessage(complexity.tokens, newBalance);
  await sendMessage(from, aiReply + tokenFooter);
  await Promise.allSettled([
    debitTokens(student, complexity.tokens, { reason: `${agentInfo?.label || agentId}`, complexity_level: complexity.level, agent_id: agentId }),
    saveConversation(student.id, 'user', message, { agent_id: agentId, complexity_level: complexity.level, tokens_consumed: 0 }),
    saveConversation(student.id, 'assistant', aiReply, { agent_id: agentId, complexity_level: complexity.level, tokens_consumed: complexity.tokens, groq_model: model, latency_ms: latency }),
    upsertProgress(student.id, agentId, agentInfo?.label || agentId, { questions: 1 }),
    updateStudent(from, { last_agent: agentId, last_active: new Date().toISOString() }),
    canAccess(student, 'memory') ? extractAndStoreMemories(student, message, aiReply, agentId) : Promise.resolve()
  ]);
}

async function handleOTPFlow(from, student, userMsg) {
  if (!student.otp_code) { const otp = generateOTP(); await setOTP(from, otp); await sendMessage(from, `🔐 *Verificação de segurança*\n\nPara proteger sua conta, confirme seu número digitando o código:\n\n*${otp}*`); return; }
  const result = validateOTP(student, userMsg);
  if (result === 'valid')   { await markOTPVerified(from); await sendMessage(from, `✅ Número verificado!\n\n${getFirstQuestion()}`); }
  else if (result === 'expired') { const otp = generateOTP(); await setOTP(from, otp); await sendMessage(from, `⏰ Código expirado. Novo código:\n\n*${otp}*`); }
  else if (result === 'blocked') { await sendMessage(from, '🔒 Muitas tentativas. Tente em 24h.'); }
  else { await incrementOTPAttempt(from, student.otp_attempts); await sendMessage(from, `❌ Código incorreto. ${5 - ((student.otp_attempts||0)+1)} tentativa(s) restante(s).`); }
}

async function handleOnboardingFlow(from, student, userMsg) {
  const { message, done } = await handleOnboarding(student, userMsg);
  await sendMessage(from, message);
  if (done) { const updated = await getStudent(from); if (updated) await extractAndStoreMemories(updated, `Curso: ${updated.course}, ${updated.semester}° semestre, dificuldade: ${updated.main_struggle}`, '', null); }
}

async function callGroq(messages, model, maxTokens = 600) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }) });
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || '';
  } catch (e) { console.error('[callGroq]', e.message); return ''; }
}
