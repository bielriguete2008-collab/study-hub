// lib/tokens/plans.js — Definição dos 3 planos

export const PLANS = {
  free: {
    id: 'free', label: 'Free', monthly_tokens: 150, price_brl: 0,
    stripe_price_id: null, subjects_limit: 2, memory: false,
    study_plan: false, summaries: false, quiz_limit: 3, model: 'basic', monthly_report: false
  },
  pro: {
    id: 'pro', label: 'Pro', monthly_tokens: 2000, price_brl: 29.90,
    stripe_price_id: process.env.STRIPE_PRICE_PRO, subjects_limit: Infinity,
    memory: true, study_plan: true, summaries: true, quiz_limit: Infinity, model: 'fast', monthly_report: false
  },
  premium: {
    id: 'premium', label: 'Premium', monthly_tokens: 8000, price_brl: 59.90,
    stripe_price_id: process.env.STRIPE_PRICE_PREMIUM, subjects_limit: Infinity,
    memory: true, study_plan: true, summaries: true, quiz_limit: Infinity, model: 'advanced', monthly_report: true
  }
};

export function getPlan(planId) { return PLANS[planId] || PLANS.free; }
export function canAccess(student, feature) { return !!getPlan(student.plan)[feature]; }
export function canAccessSubject(student, subject) {
  const plan = getPlan(student.plan);
  if (plan.subjects_limit === Infinity) return true;
  const allowed = student.allowed_subjects || [];
  return allowed.includes(subject) || allowed.length < plan.subjects_limit;
}
