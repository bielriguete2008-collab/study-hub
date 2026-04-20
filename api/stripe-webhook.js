import Stripe from 'stripe';
export const config = { api: { bodyParser: false } };
async function getRawBody(req) {
  return new Promise((resolve, reject) => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Stripe Webhook OK');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  let event;
  try { event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  const sbUrl = process.env.SUPABASE_URL, sbKey = process.env.SUPABASE_SERVICE_KEY;
  const evoUrl = process.env.EVOLUTION_URL, evoKey = process.env.EVOLUTION_API_KEY, evoInst = process.env.EVOLUTION_INSTANCE;
  const sbH = { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const sendWA = async (phone, msg) => { try { await fetch(`${evoUrl}/message/sendText/${evoInst}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify({ number: phone, text: msg }) }); } catch(e){} };

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object, phone = s.metadata?.phone;
    if (phone) {
      const priceId = s.line_items?.data?.[0]?.price?.id || '';
      const plan = priceId === process.env.STRIPE_PRICE_PREMIUM ? 'premium' : 'pro';
      const cap  = plan === 'premium' ? 8000 : 2000;
      await fetch(sbUrl + '/rest/v1/students?phone=eq.' + encodeURIComponent(phone), { method: 'PATCH', headers: sbH, body: JSON.stringify({ plan, tokens_balance: cap, tokens_monthly_cap: cap, stripe_customer_id: s.customer, stripe_subscription_id: s.subscription, updated_at: new Date().toISOString() }) });
      await sendWA(phone, `🎉 *Bem-vindo ao Study Hub ${plan === 'premium' ? 'Premium' : 'Pro'}!*\n\nPlano ativado! Você agora tem *${cap.toLocaleString('pt-BR')} créditos/mês*.\n\nBora estudar? 🚀`);
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer;
    const findRes = await fetch(sbUrl + '/rest/v1/students?stripe_customer_id=eq.' + encodeURIComponent(customerId) + '&select=phone', { headers: { 'apikey': sbKey, 'Authorization': 'Bearer ' + sbKey } });
    const rows = await findRes.json();
    const phone = rows?.[0]?.phone;
    if (phone) {
      await fetch(sbUrl + '/rest/v1/students?phone=eq.' + encodeURIComponent(phone), { method: 'PATCH', headers: sbH, body: JSON.stringify({ plan: 'free', tokens_monthly_cap: 150, updated_at: new Date().toISOString() }) });
      await sendWA(phone, `😢 *Sua assinatura foi cancelada.*\n\nVocê voltou para o plano gratuito (150 créditos/mês).\n\nPara reativar: ${process.env.STRIPE_BILLING_URL || 'https://studyhub.app/planos'}`);
    }
  }
  res.status(200).json({ received: true });
}
