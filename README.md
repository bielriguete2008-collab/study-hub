# Study Hub — Tutor de Estudos com IA no WhatsApp

Tutor inteligente via WhatsApp com método socrático, quiz, modo pré-prova, resolução de exercícios por foto e sistema de streaks/badges.

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
├── index.html
├── vercel.json
└── api/
    ├── webhook.js
    ├── stripe-webhook.js
    ├── cron-streak.js
    └── cron-tokens-reset.js
```

## Variáveis de Ambiente (Vercel)

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
git commit -m "feat: Study Hub v2 — multi-agent, multi-tenant, 60 agents"
git push
```
