# zeromultas

Gerador de recursos administrativos de multa de trânsito (defesa prévia + JARI).

Stack: Next.js 14 (App Router) + Prisma 5 + PostgreSQL + Anthropic Claude (Haiku/Sonnet) + TriboPay (PIX).

## Como funciona

1. Usuário envia foto/PDF da multa em `/`.
2. Chamada 1 (Haiku 4.5) analisa a notificação, identifica tipo (NA/NP), extrai todos os dados e detecta vícios formais. A imagem é descartada.
3. Sistema roteia a fase (defesa prévia ou JARI) por código, não por IA.
4. Usuário envia CNH (extraída e descartada), endereço e motivo.
5. Cobrança PIX via TriboPay.
6. Webhook confirma o pagamento na origem antes de marcar como pago.
7. Chamada 2 (Sonnet 4.6) gera a peça jurídica e renderiza em PDF.

## Setup local

```bash
npm install
cp .env.example .env  # ajustar credenciais
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Deploy (VPS Contabo)

```bash
git pull
npm install
npx prisma migrate deploy
npx next build
pm2 restart zeromultas
```

App roda em `localhost:3001` por padrão. Nginx faz proxy reverso.

## Variáveis de ambiente

Ver `.env.example` para a lista completa.

## Estrutura

```
src/
  app/           # rotas Next.js (LP, funil, admin, APIs)
  lib/           # módulos: prisma, anthropic, tribopay, recurso, auth, etc.
  middleware.ts  # protege /admin/*
prisma/
  schema.prisma
  seed.ts
  migrations/
storage/
  recursos/      # PDFs gerados (fora do git)
```

## Admin

- Login em `/admin/login` (admin/admin123 no seed — trocar).
- Painel: pedidos, faixas de preço, prompts versionados, métricas de funil.

## Decisões importantes

- **Imagens descartadas após chamada 1**: por LGPD a chamada 1 faz análise + extração completa numa só ida.
- **TriboPay com modo mock**: pra dev/sem credenciais, `TRIBOPAY_MODE=mock` gera PIX dummy em memória. `TRIBOPAY_MODE=live` chama API real (ajustar payload conforme docs oficiais).
- **Prompts versionados**: editáveis no painel, com histórico e ativação por versão.
