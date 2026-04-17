# Study Hub 📚

Tutor de estudos com Inteligência Artificial direto no WhatsApp.

## Funcionalidades

- 🧠 **Método Socrático** — o tutor faz perguntas para guiar o raciocínio
- 📸 **Resolução por Foto** — manda foto do exercício e a IA explica passo a passo
- 🎯 **Quiz Interativo** — múltipla escolha com A, B, C, D e pontuação
- 📝 **Modo Pré-Prova** — revisão intensiva com comando `/prova [tema]`
- 🔥 **Streaks e Badges** — acompanhe seu progresso diário
- 💳 **Assinatura** — Pix (Mercado Pago) ou cartão (Stripe)

## Stack

- **Webhook**: Vercel Serverless (`api/webhook.js`)
- **IA Texto**: Groq `llama-3.3-70b-versatile`
- **IA Visão**: Groq `meta-llama/llama-4-scout-17b-16e-instruct`
- **Banco**: Supabase (PostgreSQL)
- **WhatsApp**: Evolution API
- **Pagamentos**: Stripe + Mercado Pago
- **Cron**: Vercel Cron Jobs (notificação diária de streak às 23h UTC)

## Variáveis de Ambiente

```env
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
EVOLUTION_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
MP_ACCESS_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_URL=
```

## Deploy

1. Fork este repositório
2. Configure as variáveis de ambiente na Vercel
3. Configure o webhook da Evolution API para `/api/webhook`
4. Configure o webhook do Stripe para `/api/stripe-webhook`
5. O cron de streak roda automaticamente via Vercel Cron

## Comandos

| Comando | Descrição |
|---------|-----------|
| `/ajuda` | Lista todos os comandos |
| `/quiz [tema]` | Gera pergunta de múltipla escolha |
| `/prova [tema]` | Revisão intensiva pré-prova |
| `/stats` | Seus pontos, streak e badges |
| `/plano` | Informações do plano atual |
| `/assinar` | Link para assinar o Plano Pro |
| `/cancelar` | Cancela a assinatura |
