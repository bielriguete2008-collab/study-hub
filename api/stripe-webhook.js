import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Stripe Webhook OK');

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const evolutionUrl = process.env.EVOLUTION_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;
  const evolutionInstance = process.env.EVOLUTION_INSTANCE;

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const sendWhatsApp = async (phone, message) => {
    try {
      await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify({ number: phone, text: message })
      });
    } catch (e) { console.error('WhatsApp send error:', e); }
  };

  // ââ Pagamento confirmado â ativar plano Pro âââââââââââââââââââââââââââââââ
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const phone = session.metadata?.phone;

    if (phone) {
      try {
        await fetch(supabaseUrl + '/rest/v1/conversations', {
          method: 'POST',
          headers: {
            'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
            'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            phone,
            plan: 'pro',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString()
          })
        });

        await sendWhatsApp(phone,
          `ð *Bem-vindo ao Study Hub Pro!*\n\n` +
          `Seu plano foi ativado com sucesso!\n\n` +
          `â Mensagens ilimitadas\n` +
          `â Quiz e modo prova sem limite\n` +
          `â Suporte a imagens\n\n` +
          `Bora estudar? ð Me conta o que vocÃª quer aprender hoje!`
        );

        console.log(`Plan upgraded to Pro for phone: ${phone}`);
      } catch (e) {
        console.error('Supabase update error:', e);
      }
    }
  }

  // ââ Assinatura cancelada â reverter para Free âââââââââââââââââââââââââââââ
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    try {
      const findRes = await fetch(
        supabaseUrl + '/rest/v1/conversations?stripe_customer_id=eq.' + encodeURIComponent(customerId) + '&select=phone',
        { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
      );
      const rows = await findRes.json();
      const phone = rows?.[0]?.phone;

      if (phone) {
        await fetch(
          supabaseUrl + '/rest/v1/conversations?phone=eq.' + encodeURIComponent(phone),
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: 'free', updated_at: new Date().toISOString() })
          }
        );

        await sendWhatsApp(phone,
          `ð¢ *Sua assinatura Pro foi cancelada.*\n\n` +
          `VocÃª voluou para o plano gratuito (20 msgs/dia).\n\n` +
          `Se quiser voltar ao Pro, Ã© sÃ³ digitar */assinar*! ð`
        );

        console.log(`Plan reverted to Free for phone: ${phone}`);
      }
    } catch (e) {
      console.error('Supabase downgrade error:', e);
    }
  }

  res.status(200).json({ received: true });
}
