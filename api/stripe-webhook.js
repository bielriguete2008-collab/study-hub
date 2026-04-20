'use strict';
/**
 * api/stripe-webhook.js — Stripe webhook handler
 * Atualiza plano do aluno após pagamento e notifica via ZapResponder
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { sendMessage }  = require('../lib/messaging');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const phone   = session.metadata?.phone;
      const plan    = session.metadata?.plan || 'pro';

      if (!phone) {
        console.warn('[stripe-webhook] No phone in metadata');
        return res.json({ ok: true });
      }

      // Atualiza plano no Supabase
      const { error } = await supabase
        .from('students')
        .update({
          plan,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_expires_at: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('phone', phone);

      if (error) throw error;

      // Notifica aluno via WhatsApp
      const planName = plan === 'premium' ? 'Premium' : 'Pro';
      await sendMessage(
        phone,
        `✅ *Pagamento confirmado!* Seu plano *${planName}* está ativo.\n\n🎓 Agora você tem acesso completo ao Study Hub. Me manda uma mensagem para começar!`
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      // Encontra aluno pelo subscription_id
      const { data: students, error } = await supabase
        .from('students')
        .select('phone, name')
        .eq('stripe_subscription_id', sub.id);

      if (!error && students?.length > 0) {
        const s = students[0];
        // Downgrade para plano gratuito
        await supabase
          .from('students')
          .update({ plan: 'free', stripe_subscription_id: null, plan_expires_at: null })
          .eq('stripe_subscription_id', sub.id);

        await sendMessage(
          s.phone,
          '⚠️ Sua assinatura foi cancelada e você voltou ao plano gratuito. Para reativar, acesse o link de pagamento ou me pergunte sobre os planos!'
        );
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
