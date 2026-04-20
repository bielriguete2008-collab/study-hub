import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Stripe Webhook OK');

  const stripe        = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody       = await getRawBody(req);
  const sig           = req.headers['stripe-signature'];
  const supabaseUrl   = process.env.SUPABASE_URL;
  const supabaseKey   = process.env.SUPABASE_SERVICE_KEY;
  const zapUrl        = process.env.ZAPRESPONDER_URL;
  const zapKey        = process.env.ZAPRESPONDER_KEY;
  const zapInstance   = process.env.ZAPRESPONDER_INSTANCE;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const sendWhatsApp = async (phone, text) => {
    try {
      await fetch(`${zapUrl}/message/sendText/${zapInstance}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': zapKey },
        body:    JSON.stringify({ number: phone, text })
      });
    } catch (e) { console.error('WhatsApp send error:', e); }
  };

  // ── Pagamento confirmado → ativar plano ─────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const phone   = session.metadata?.phone;
    const planId  = session.metadata?.plan || 'pro';

    if (phone) {
      try {
        await fetch(supabaseUrl + '/rest/v1/students', {
          method:  'PATCH',
          headers: {
            'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            plan: planId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: 'active',
            updated_at: new Date().toISOString()
          })
        });

        const labels = { pro: 'Pro (R$29,90/mês)', premium: 'Premium (R$59,90/mês)' };
        await sendWhatsApp(phone,
          `🎉 *Bem-vindo ao Study Hub ${labels[planId] || planId}!*\n\n` +
          `Seu plano foi ativado com sucesso!\n\n` +
          `✅ Créditos mensais renovados\n` +
          `✅ Memória permanente ativada\n` +
          `✅ Todos os agentes disponíveis\n\n` +
          `Bora estudar? 🚀 Me conta o que você quer aprender hoje!`
        );
        console.log(`Plan upgraded to ${planId} for phone: ${phone}`);
      } catch (e) {
        console.error('Supabase update error:', e);
      }
    }
  }

  // ── Assinatura cancelada → reverter para Free ───────────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId   = subscription.customer;

    try {
      const findRes = await fetch(
        supabaseUrl + '/rest/v1/students?stripe_customer_id=eq.' + encodeURIComponent(customerId) + '&select=phone',
        { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
      );
      const rows  = await findRes.json();
      const phone = rows?.[0]?.phone;

      if (phone) {
        await fetch(
          supabaseUrl + '/rest/v1/students?phone=eq.' + encodeURIComponent(phone),
          {
            method:  'PATCH',
            headers: {
              'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: 'free', subscription_status: 'canceled', updated_at: new Date().toISOString() })
          }
        );

        await sendWhatsApp(phone,
          `😢 *Sua assinatura foi cancelada.*\n\n` +
          `Você voltou para o plano gratuito (150 créditos/mês).\n\n` +
          `Se quiser voltar, é só digitar */assinar*! 💙`
        );
        console.log(`Plan reverted to Free for phone: ${phone}`);
      }
    } catch (e) {
      console.error('Supabase downgrade error:', e);
    }
  }

  res.status(200).json({ received: true });
}
