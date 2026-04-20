// lib/tokens/debit.js
import { updateStudent, logTokenTransaction } from '../supabase.js';
import { getPlan } from './plans.js';

export async function debitTokens(student, amount, meta = {}) {
  const newBalance = Math.max(0, (student.tokens_balance || 0) - amount);
  const newUsed    = (student.tokens_used_month || 0) + amount;
  await updateStudent(student.phone, { tokens_balance: newBalance, tokens_used_month: newUsed, last_active: new Date().toISOString() });
  await logTokenTransaction(student.id, 'debit', -amount, newBalance, meta);
  return newBalance;
}

export async function creditTokens(phone, student, amount, reason, stripePaymentId = null) {
  const newBalance = (student.tokens_balance || 0) + amount;
  await updateStudent(phone, { tokens_balance: newBalance });
  await logTokenTransaction(student.id, 'credit', amount, newBalance, { reason, stripe_payment_id: stripePaymentId });
  return newBalance;
}

export function hasSufficientTokens(student, required) { return (student.tokens_balance || 0) >= required; }

export function buildTokenMessage(consumed, remaining) {
  const bar = '▓'.repeat(Math.round(Math.min(remaining / 2000, 1) * 5)) + '░'.repeat(5 - Math.round(Math.min(remaining / 2000, 1) * 5));
  return `\n\n💳 _${consumed} crédito(s) usados · Saldo: ${remaining} · ${bar}_`;
}

export function buildNoTokensMessage(student) {
  const plan = getPlan(student.plan);
  if (plan.id === 'free') return `⚠️ *Seus créditos gratuitos acabaram!*\n\nFaça upgrade: ${process.env.STRIPE_BILLING_URL || 'https://studyhub.app/planos'}`;
  if (plan.id === 'pro')  return `⚠️ *Seus créditos Pro acabaram!*\n\nUpgrade para Premium: ${process.env.STRIPE_BILLING_URL || 'https://studyhub.app/planos'}`;
  return `⚠️ *Seus créditos Premium acabaram!* Renovam automaticamente no próximo mês. 🔄`;
}
