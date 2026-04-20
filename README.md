# Study Hub â Tutor de Estudos com IA no WhatsApp

Tutor inteligente via WhatsApp com mÃ©todo socrÃ¡tico, quiz, modo prÃ©-prova, resoluÃ§Ã£o de exercÃ­cios por foto e sistema de streaks/badges.

## Stack
- **Bot:** Vercel Serverless Functions (Node.js)
- **IA:** Groq (llama-3.3-70b + llama-4 vision)
- **Banco:** Supabase (PostgreSQL)
- **WhatsApp:** Evolution API (Railway)
- **Pagamentos:** Stripe
- **Cron:** Vercel Cron Jobs

## Estrutura

```
/
âââ index.html
âââ vercel.json
âââ api/
    âââ webhook.js
    âââ stripe-webhook.js
    âââ cron-streak.js
    âââ cron-tokens-reset.js
```

## VariÃ¡veis de Ambiente (Vercel)

```
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
EVOLUTION_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
STRIPE_SECRET_KEY=
STRIPE_PRICE_PRO=
STRIPE_PRICE_PREMIUM=
STRIPE_WEBHOOK_SECRET=
STRIPE_BILLING_URL=
JWT_SECRET=
JWT_SALT=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
```

## Deploy

```bash
git add .
git commit -m "feat: Study Hub v2 â multi-agent, multi-tenant, 60 agents"
git push
```
