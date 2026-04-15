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

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  // Verify Stripe signature
  let event;
  try {
    const crypto = await import('crypto');
    const payload = rawBody.toString('utf8');
    const parts = sig.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      if (k === 't') acc.timestamp = v;
      if (k === 'v1') acc.signatures = [...(acc.signatures || []), v];
      return acc;
    }, {});
    const signedPayload = parts.timestamp + '.' + payload;
    const expected = crypto.createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');
    if (!parts.signatures.includes(expected)) {
      throw new Error('Signature mismatch');
    }
    event = JSON.parse(payload);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  // Payment confirmed -> activate Pro plan
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const phone = session.metadata?.phone;

    if (phone) {
      try {
        await fetch(
          supabaseUrl + '/rest/v1/conversations',
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': 'Bearer ' + supabaseKey,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              phone,
              plan: 'pro',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              updated_at: new Date().toISOString()
            })
          }
        );
        console.log('Plan upgraded to Pro for phone:', phone);
      } catch (e) {
        console.error('Supabase update error:', e);
      }
    }
  }

  // Subscription cancelled -> revert to Free
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
              'apikey': supabaseKey,
              'Authorization': 'Bearer ' + supabaseKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: 'free', updated_at: new Date().toISOString() })
          }
        );
        console.log('Plan reverted to Free for phone:', phone);
      }
    } catch (e) {
      console.error('Supabase downgrade error:', e);
    }
  }

  res.status(200).json({ received: true });
}
