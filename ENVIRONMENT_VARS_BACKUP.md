# Agency Group Portal — Environment Variables Backup
**Gerado em:** 2026-04-06
**Projecto:** Agency Group Portal (Next.js 15, Supabase, Anthropic, WhatsApp Business)
**Stack:** Next.js · Supabase · NextAuth v5 · Anthropic SDK · HeyGen · Stability AI · Notion · Resend · SMTP · web-push · Sentry · Apify · Browserless

---

## Indice por Grupo

1. [Supabase](#1-supabase)
2. [Anthropic (Claude AI)](#2-anthropic-claude-ai)
3. [Auth (NextAuth / Magic Link)](#3-auth-nextauth--magic-link)
4. [Google OAuth](#4-google-oauth)
5. [WhatsApp Business API](#5-whatsapp-business-api)
6. [Email — Resend + SMTP Fallback](#6-email--resend--smtp-fallback)
7. [HeyGen (Avatar de Video IA)](#7-heygen-avatar-de-video-ia)
8. [Notion (CRM + Pipeline)](#8-notion-crm--pipeline)
9. [Monitoring — Sentry](#9-monitoring--sentry)
10. [Push Notifications — VAPID](#10-push-notifications--vapid)
11. [Scraping — Apify + Browserless](#11-scraping--apify--browserless)
12. [Stability AI (Home Staging)](#12-stability-ai-home-staging)
13. [App Config & Internos](#13-app-config--internos)

---

## 1. Supabase

### NEXT_PUBLIC_SUPABASE_URL
- **Obrigatoria**: Sim
- **Servico**: Supabase
- **Como obter**: Dashboard Supabase → Project Settings → API → Project URL
- **Formato**: `https://abcdefghijklmnop.supabase.co`
- **Usado em**: `lib/supabase.ts`, `lib/supabase/server.ts`, todos os API routes que acedem ao DB
- **Se em falta**: Crash imediato com `Error: Missing env: NEXT_PUBLIC_SUPABASE_URL` — app nao arranca

---

### NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Obrigatoria**: Sim
- **Servico**: Supabase
- **Como obter**: Dashboard Supabase → Project Settings → API → `anon` `public` key
- **Formato**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ii4uLiIsInJvbGUiOiJhbm9uIi...`
- **Usado em**: `lib/supabase.ts` (cliente browser), componentes client-side
- **Se em falta**: Crash imediato com `Error: Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY` — app nao arranca

---

### SUPABASE_SERVICE_ROLE_KEY
- **Obrigatoria**: Recomendada (funciona com fallback para anon key)
- **Servico**: Supabase
- **Como obter**: Dashboard Supabase → Project Settings → API → `service_role` `secret` key
- **Formato**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ii4uLiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiI...`
- **Usado em**: `lib/supabase.ts` (cliente admin — bypassa RLS), API routes server-side que precisam de acesso total
- **Se em falta**: `supabaseAdmin` usa a anon key como fallback — operacoes administrativas podem falhar por restricoes de RLS. NUNCA expor ao browser.

---

## 2. Anthropic (Claude AI)

### ANTHROPIC_API_KEY
- **Obrigatoria**: Recomendada (graceful mock se em falta)
- **Servico**: Anthropic
- **Como obter**: https://console.anthropic.com → API Keys → Create Key
- **Formato**: `sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Usado em**:
  - `app/api/sofia/chat/route.ts` — Sofia chatbot (streaming SSE)
  - `app/api/whatsapp/webhook/route.ts` — Sofia auto-reply WhatsApp
  - `app/api/radar/route.ts` — Analise de oportunidades IA
- **Se em falta**: Sofia retorna mensagem mock ("servico de IA nao configurado") em vez de crashar; webhook WhatsApp loga aviso e nao envia resposta automatica

---

## 3. Auth (NextAuth / Magic Link)

### AUTH_SECRET
- **Obrigatoria**: Sim
- **Servico**: NextAuth v5 (Auth.js)
- **Como obter**: Gerar localmente: `openssl rand -base64 32` ou `npx auth secret`
- **Formato**: string aleatoria de 32+ caracteres, ex: `K8mP2xQrT9vN4wL1jH6bY3uA7sE5cF0d`
- **Usado em**:
  - `auth.ts` — JWT signing/verification
  - `app/api/auth/request/route.ts`, `app/api/auth/send/route.ts`, `app/api/auth/verify/route.ts`, `app/api/auth/approve/route.ts`, `app/api/auth/reject/route.ts` — magic link token signing
  - `app/api/notion/contacts/route.ts`, `app/api/reports/weekly/route.ts` — validacao de token interno
- **Se em falta**: Crash no arranque do NextAuth — login impossivel

---

### NEXTAUTH_URL
- **Obrigatoria**: Recomendada (tem fallback para outros URL vars)
- **Servico**: NextAuth v5
- **Como obter**: URL base do deploy. Em dev: `http://localhost:3000`. Em prod: URL do Vercel/dominio proprio
- **Formato**: `https://portal.agencygroup.pt` ou `http://localhost:3000`
- **Usado em**: `app/api/whatsapp/test/route.ts` (webhook URL display), NextAuth internamente
- **Se em falta**: NextAuth pode ter problemas com redirects de callback em producao. Em dev funciona com localhost.

---

## 4. Google OAuth

### GOOGLE_CLIENT_ID
- **Obrigatoria**: Nao (apenas se quiser login Google activo)
- **Servico**: Google OAuth 2.0
- **Como obter**: https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web Application. Authorized redirect URIs: `{URL}/api/auth/callback/google`
- **Formato**: `123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`
- **Usado em**: `auth.ts` — provider Google no NextAuth
- **Se em falta**: Botao "Entrar com Google" nao aparece / falha silenciosamente. Login por credenciais continua a funcionar.

---

### GOOGLE_CLIENT_SECRET
- **Obrigatoria**: Nao (par com GOOGLE_CLIENT_ID)
- **Servico**: Google OAuth 2.0
- **Como obter**: Mesma consola que GOOGLE_CLIENT_ID — campo "Client Secret"
- **Formato**: `GOCSPX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Usado em**: `auth.ts`
- **Se em falta**: Idem ao GOOGLE_CLIENT_ID

---

## 5. WhatsApp Business API

### WHATSAPP_ACCESS_TOKEN
- **Obrigatoria**: Sim (se WHATSAPP_ACTIVE=true)
- **Servico**: Meta WhatsApp Business Cloud API
- **Como obter**: https://developers.facebook.com → App → WhatsApp → Configuration → Permanent Token (via System User no Business Manager)
- **Formato**: `EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usado em**: `lib/whatsapp/client.ts` — Authorization header para todas as chamadas a API Meta
- **Se em falta**: `sendWhatsApp()` retorna `{ success: false, error: 'WhatsApp API not configured' }` — sem envio de mensagens

---

### WHATSAPP_PHONE_NUMBER_ID
- **Obrigatoria**: Sim (se WHATSAPP_ACTIVE=true)
- **Servico**: Meta WhatsApp Business Cloud API
- **Como obter**: https://developers.facebook.com → App → WhatsApp → Getting Started → Phone Number ID (numero de 15 digitos)
- **Formato**: `123456789012345`
- **Usado em**: `lib/whatsapp/client.ts` — URL endpoint `/{PHONE_NUMBER_ID}/messages`
- **Se em falta**: Idem ao WHATSAPP_ACCESS_TOKEN

---

### WHATSAPP_BUSINESS_ID
- **Obrigatoria**: Nao (apenas para endpoint `/api/whatsapp/status`)
- **Servico**: Meta WhatsApp Business Cloud API
- **Como obter**: https://developers.facebook.com → App → WhatsApp → Getting Started → WhatsApp Business Account ID (WABA ID)
- **Formato**: `123456789012345`
- **Usado em**: `app/api/whatsapp/status/route.ts` — consulta metricas e estado da conta
- **Se em falta**: Endpoint de status retorna erro mas app continua a funcionar

---

### WHATSAPP_VERIFY_TOKEN
- **Obrigatoria**: Sim (para receber mensagens/webhook Meta)
- **Servico**: Meta WhatsApp Business Cloud API
- **Como obter**: Valor proprio escolhido por ti — deve ser igual ao configurado no painel Meta Developer → Webhook → Verify Token
- **Formato**: qualquer string segura, ex: `agencygroup2026`
- **Usado em**: `app/api/whatsapp/webhook/route.ts` — verificacao GET do webhook pela Meta
- **Se em falta**: Meta nao consegue verificar o webhook → nao recebe mensagens inbound

---

### WHATSAPP_APP_SECRET
- **Obrigatoria**: Recomendada (validacao HMAC de seguranca)
- **Servico**: Meta WhatsApp Business Cloud API
- **Como obter**: https://developers.facebook.com → App → Settings → Basic → App Secret
- **Formato**: string hexadecimal de 32 chars, ex: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`
- **Usado em**: `app/api/whatsapp/webhook/route.ts` — validacao da assinatura HMAC SHA-256 de cada request recebido da Meta
- **Se em falta**: Webhook aceita qualquer request sem validar origem — risco de seguranca (spoofing)

---

### WHATSAPP_ACTIVE
- **Obrigatoria**: Nao (default: false)
- **Servico**: Feature flag interno
- **Como obter**: Definir manualmente. Valor: `true` ou `false`
- **Formato**: `true` ou `false`
- **Usado em**: `lib/whatsapp/client.ts`, `app/api/whatsapp/webhook/route.ts`
- **Se em falta** (ou `false`): Sofia WhatsApp inactiva — webhook regista mensagens no CRM mas Sofia nao responde automaticamente. Envio manual tambem bloqueado.

---

## 6. Email — Resend + SMTP Fallback

### RESEND_API_KEY
- **Obrigatoria**: Recomendada (fallback para SMTP se em falta)
- **Servico**: Resend.com
- **Como obter**: https://resend.com/api-keys → Create API Key. Verificar dominio `agencygroup.pt` em Resend → Domains.
- **Formato**: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usado em**:
  - `app/api/radar/digest/route.ts` — envio do digest diario de oportunidades
  - `app/api/alerts/route.ts` — alertas de mercado
  - `app/api/auth/request/route.ts` — magic link de acesso
  - `app/api/cron/followups/route.ts` — email de follow-ups
  - `app/api/reports/weekly/route.ts` — relatorio semanal
- **Se em falta**: Tenta fallback SMTP. Se ambos em falta, emails nao sao enviados (sem crash)

---

### SMTP_HOST
- **Obrigatoria**: Nao (apenas como fallback se RESEND nao configurado)
- **Servico**: Qualquer servidor SMTP (Gmail, Outlook, Mailgun, etc.)
- **Como obter**: Depende do provider. Ex Gmail: `smtp.gmail.com`
- **Formato**: `smtp.gmail.com` / `smtp.mailgun.org` / `mail.agencygroup.pt`
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/alerts/route.ts` — fallback nodemailer
- **Se em falta**: Fallback SMTP desactivado; apenas Resend e usado

---

### SMTP_USER
- **Obrigatoria**: Nao (par com SMTP_HOST)
- **Servico**: SMTP
- **Como obter**: Conta de email / username do SMTP provider
- **Formato**: `geral@agencygroup.pt`
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/alerts/route.ts`
- **Se em falta**: SMTP nao funciona mesmo com SMTP_HOST definido

---

### SMTP_PASS
- **Obrigatoria**: Nao (par com SMTP_HOST)
- **Servico**: SMTP
- **Como obter**: Password da conta de email ou App Password (Gmail)
- **Formato**: string de password, ex: `xxxx xxxx xxxx xxxx` (Google App Password)
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/alerts/route.ts`
- **Se em falta**: SMTP nao funciona

---

### SMTP_PORT
- **Obrigatoria**: Nao (default: 587)
- **Servico**: SMTP
- **Como obter**: Depende do provider. 587 (STARTTLS), 465 (SSL), 25
- **Formato**: `587`
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/alerts/route.ts`
- **Se em falta**: Usa porta 587 por default

---

### SMTP_SECURE
- **Obrigatoria**: Nao (default: false)
- **Servico**: SMTP
- **Como obter**: `true` se porta 465 (SSL directo); `false` se STARTTLS (porta 587)
- **Formato**: `true` ou `false`
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/alerts/route.ts`
- **Se em falta**: Assume `false` (STARTTLS)

---

## 7. HeyGen (Avatar de Video IA)

### HEYGEN_API_KEY
- **Obrigatoria**: Nao (Sofia video inactiva se em falta)
- **Servico**: HeyGen
- **Como obter**: https://app.heygen.com → Settings → API → Generate API Key
- **Formato**: `NzZhNzQxNjctYTJiYy00ZmE3LThiYzktMThhYmU4NTZiMGI4`  (base64-like string)
- **Usado em**:
  - `app/api/heygen/session/route.ts` — criar/fechar sessao de streaming
  - `app/api/heygen/ice/route.ts` — ICE candidates WebRTC
  - `app/api/heygen/start/route.ts` — iniciar streaming
  - `app/api/heygen/task/route.ts` — enviar texto para o avatar
  - `app/api/sofia/speak/route.ts` — Sofia em modo video
- **Se em falta**: Endpoints retornam 503 com mensagem "HeyGen nao configurado" — sem crash, UI deve desativar o modo video

---

### HEYGEN_AVATAR_ID
- **Obrigatoria**: Nao (default: `default`)
- **Servico**: HeyGen
- **Como obter**: https://app.heygen.com → Avatars → seleccionar avatar → copiar ID
- **Formato**: UUID ou string, ex: `ef08039a41354b7b9bc9f4e8c2d4a388`
- **Usado em**: `app/api/heygen/session/route.ts` — parametro `avatar_id`
- **Se em falta**: Usa avatar `default` da HeyGen

---

### HEYGEN_VOICE_ID
- **Obrigatoria**: Nao (default: voz padrao HeyGen)
- **Servico**: HeyGen
- **Como obter**: https://app.heygen.com → Voices → seleccionar voz → copiar ID
- **Formato**: UUID ou string, ex: `2d5b0e6cf36f460aa7fc47e3eee4ba54`
- **Usado em**: `app/api/heygen/session/route.ts` — parametro `voice.voice_id`
- **Se em falta**: HeyGen usa voz padrao

---

## 8. Notion (CRM + Pipeline)

### NOTION_TOKEN
- **Obrigatoria**: Sim (para todos os endpoints /api/notion/*)
- **Servico**: Notion API
- **Como obter**: https://www.notion.so/my-integrations → New Integration → copiar "Internal Integration Token". Depois adicionar a integracao a cada base de dados em Notion.
- **Formato**: `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usado em**:
  - `app/api/notion/deals/route.ts`
  - `app/api/notion/contacts/route.ts`
  - `app/api/notion/properties/route.ts`
  - `app/api/notion/seed/route.ts`
  - `app/api/alerts/route.ts`
  - `app/api/cron/followups/route.ts`
- **Se em falta**: Todos os endpoints Notion retornam `{ error: 'No Notion token' }` com status 500

---

### NOTION_PIPELINE_DB
- **Obrigatoria**: Sim (para deals/pipeline)
- **Servico**: Notion API
- **Como obter**: Abrir base de dados Pipeline em Notion → URL: `https://notion.so/workspace/{DATABASE_ID}?v=...` — copiar o ID (32 chars com hifens)
- **Formato**: `7e68e68d-86ed-471c-8655-d8edf1e5c604`
- **Valor actual (do .env.example)**: `7e68e68d-86ed-471c-8655-d8edf1e5c604`
- **Usado em**: `app/api/notion/deals/route.ts`
- **Se em falta**: Usa fallback hardcoded `37682f4dd3bb488c9c969bcf140c1f94`

---

### NOTION_CRM_DB
- **Obrigatoria**: Sim (para contactos CRM)
- **Servico**: Notion API
- **Como obter**: Idem acima para a base de dados CRM/Contactos
- **Formato**: `e8e554eb-adad-482e-b38b-443c23d08a40`
- **Valor actual (do .env.example)**: `e8e554eb-adad-482e-b38b-443c23d08a40`
- **Usado em**: `app/api/notion/contacts/route.ts`, `app/api/cron/followups/route.ts`
- **Se em falta**: Usa fallback hardcoded `385a010f42244ef79b0a2ead4f258698`

---

### NOTION_PROPERTIES_DB
- **Obrigatoria**: Sim (para imoveis)
- **Servico**: Notion API
- **Como obter**: Idem acima para a base de dados de Imoveis
- **Formato**: `bd030794-9aec-4b7d-9219-1b7beae5a658`
- **Valor actual (do .env.example)**: `bd030794-9aec-4b7d-9219-1b7beae5a658`
- **Usado em**: `app/api/notion/properties/route.ts`
- **Se em falta**: Endpoint retorna erro 500

---

### NOTION_ALERTS_DB
- **Obrigatoria**: Nao (apenas para sistema de alertas)
- **Servico**: Notion API
- **Como obter**: Idem acima para a base de dados de Alertas
- **Formato**: UUID Notion com hifens
- **Usado em**: `app/api/alerts/route.ts`
- **Se em falta**: Sistema de alertas Notion desactivado (sem crash)

---

### NOTION_DEALS_DB
- **Obrigatoria**: Nao (alias — ver NOTION_PIPELINE_DB)
- **Servico**: Notion API
- **Como obter**: Mesmo ID que NOTION_PIPELINE_DB (referenciado no memory como Notion Deals)
- **Formato**: UUID Notion com hifens
- **Usado em**: Referencias em memoria/docs — na pratica o codigo usa NOTION_PIPELINE_DB
- **Se em falta**: Sem impacto directo

---

### NOTION_PRICE_HISTORY_DB
- **Obrigatoria**: Nao (historico de precos de mercado)
- **Servico**: Notion API
- **Como obter**: Idem acima para base de dados de Historico de Precos
- **Formato**: UUID Notion com hifens
- **Usado em**: `app/api/market-data/refresh/route.ts`, `app/api/radar/history/route.ts`
- **Se em falta**: Historico de precos sem persistencia Notion

---

## 9. Monitoring — Sentry

### NEXT_PUBLIC_SENTRY_DSN
- **Obrigatoria**: Nao (monitoring desactivado se em falta)
- **Servico**: Sentry.io
- **Como obter**: https://sentry.io → Project → Settings → Client Keys (DSN)
- **Formato**: `https://abcdef1234567890abcdef1234567890@o1234567.ingest.sentry.io/1234567`
- **Usado em**:
  - `sentry.client.config.ts` — monitoring browser
  - `sentry.server.config.ts` — monitoring server/API
  - `sentry.edge.config.ts` — monitoring edge runtime
- **Se em falta**: Sentry nao inicializa — erros nao sao reportados mas app funciona normalmente

---

### SENTRY_AUTH_TOKEN
- **Obrigatoria**: Nao (apenas para source maps em CI/CD)
- **Servico**: Sentry.io
- **Como obter**: https://sentry.io → User Settings → Auth Tokens → Create New Token (scopes: `project:releases`, `org:read`)
- **Formato**: `sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usado em**: `next.config.ts` (withSentryConfig durante build — upload de source maps)
- **Se em falta**: Source maps nao sao enviados para Sentry — stack traces menos legives em producao

---

## 10. Push Notifications — VAPID

### NEXT_PUBLIC_VAPID_PUBLIC_KEY
- **Obrigatoria**: Nao (push notifications desactivadas se em falta)
- **Servico**: Web Push (VAPID)
- **Como obter**: Gerar com o script incluido: `npx tsx lib/push/vapid.ts` — imprime ambas as chaves
- **Formato**: Base64url string, ex: `BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U`
- **Usado em**: `lib/push/notifications.ts` (VAPID setup), `app/components/PushNotificationSetup.tsx` (subscribe browser)
- **Se em falta**: `initVapid()` falha silenciosamente — notificacoes push nao funcionam

---

### VAPID_PRIVATE_KEY
- **Obrigatoria**: Nao (par com NEXT_PUBLIC_VAPID_PUBLIC_KEY)
- **Servico**: Web Push (VAPID)
- **Como obter**: Gerado pelo mesmo script: `npx tsx lib/push/vapid.ts`
- **Formato**: Base64url string, ex: `4EYMTQ2XVKG9jltAgVQP3kg5HrzXpuoB8DvxcKJETM`
- **Usado em**: `lib/push/notifications.ts` — assinar payloads push server-side
- **Se em falta**: Idem ao NEXT_PUBLIC_VAPID_PUBLIC_KEY — push notifications inactivas

---

## 11. Scraping — Apify + Browserless

### APIFY_TOKEN
- **Obrigatoria**: Nao (scraping degradado sem ele)
- **Servico**: Apify
- **Como obter**: https://console.apify.com → Settings → Integrations → API token
- **Formato**: `apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Usado em**: `app/api/radar/route.ts`, `app/api/radar/search/route.ts` — scraping idealista, imovirtual, supercasa via Apify actors
- **Se em falta**: Apenas fontes scrapeaveis directamente (e-leiloes, banca) funcionam. Resultados do Radar ficam reduzidos.

---

### BROWSERLESS_TOKEN
- **Obrigatoria**: Nao (fallback de scraping)
- **Servico**: Browserless.io
- **Como obter**: https://cloud.browserless.io → Account → API Token
- **Formato**: string token, ex: `094a5c3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Usado em**: `app/api/market-data/route.ts`, `app/api/radar/search/route.ts` — scraping via browser headless para sites que bloqueiam fetch simples
- **Se em falta**: Scraping browserless desactivado; tenta alternativas sem browser headless

---

## 12. Stability AI (Home Staging)

### STABILITY_API_KEY
- **Obrigatoria**: Nao (Home Staging IA desactivado se em falta)
- **Servico**: Stability AI (DreamStudio / Stable Diffusion API)
- **Como obter**: https://platform.stability.ai/account/keys → Create API Key
- **Formato**: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Custo**: ~$0.04/imagem | limite: 20 gerações/hora por IP
- **Usado em**: `app/api/homestaging/route.ts` — Stable Diffusion Structure Control para virtual staging
- **Se em falta**: Endpoint retorna erro 503 "STABILITY_API_KEY not configured" — funcionalidade de home staging indisponivel

---

## 13. App Config & Internos

### NEXT_PUBLIC_URL
- **Obrigatoria**: Nao (tem fallbacks para agencygroup.pt)
- **Servico**: App config
- **Como obter**: URL base do deploy — `https://portal.agencygroup.pt`
- **Formato**: `https://portal.agencygroup.pt`
- **Usado em**: `app/api/auth/approve/route.ts`, `app/api/auth/send/route.ts`, `app/api/cron/followups/route.ts`, `app/api/reports/weekly/route.ts` — construcao de URLs em emails
- **Se em falta**: Usa `https://www.agencygroup.pt` como fallback

---

### NEXT_PUBLIC_BASE_URL
- **Obrigatoria**: Nao (tem fallbacks)
- **Servico**: App config
- **Como obter**: Idem a NEXT_PUBLIC_URL — URL publica do portal
- **Formato**: `https://portal.agencygroup.pt`
- **Usado em**: `app/api/radar/digest/route.ts`, `app/api/radar/route.ts`, `app/api/radar/search/route.ts`, `app/api/auth/send-reset/route.ts`, `app/api/avm/route.ts`, `app/api/mortgage/route.ts`
- **Se em falta**: Usa `https://www.agencygroup.pt` ou `http://localhost:3000` como fallback

---

### INTERNAL_API_SECRET
- **Obrigatoria**: Sim (para endpoint push/send)
- **Servico**: Seguranca interna
- **Como obter**: Gerar: `openssl rand -hex 32`
- **Formato**: string hexadecimal de 64 chars, ex: `a3f7b2c9d1e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4`
- **Usado em**: `app/api/push/send/route.ts` — autenticacao do header `x-internal-secret`
- **Se em falta**: Endpoint retorna 401 Unauthorized — push notifications internas impossivel enviar

---

### ADMIN_SECRET
- **Obrigatoria**: Recomendada (acesso admin manual)
- **Servico**: Seguranca interna
- **Como obter**: Gerar: `openssl rand -hex 32`
- **Formato**: string aleatoria longa
- **Usado em**: `app/api/alerts/route.ts` — autenticacao de acoes admin (trigger manual, deletes)
- **Se em falta**: Acoes admin nao disponiveis via API (sem crash do sistema)

---

### CRON_SECRET
- **Obrigatoria**: Recomendada (seguranca dos cron jobs)
- **Servico**: Vercel Cron / seguranca interna
- **Como obter**: Gerar: `openssl rand -hex 32`
- **Formato**: string aleatoria longa
- **Usado em**:
  - `app/api/radar/digest/route.ts` — autenticacao do cron diario
  - `app/api/alerts/route.ts` — trigger manual de cron
  - `app/api/cron/followups/route.ts` — cron de follow-ups
- **Se em falta**: Vercel cron (via header `x-vercel-cron: 1`) continua a funcionar. Trigger manual via Bearer token impossivel.

---

### ADMIN_EMAIL
- **Obrigatoria**: Nao (default: `geral@agencygroup.pt`)
- **Servico**: App config
- **Como obter**: Definir com email do administrador do portal
- **Formato**: `carlos@agencygroup.pt`
- **Usado em**: `app/api/auth/request/route.ts` — destinatario de pedidos de acesso ao portal
- **Se em falta**: Usa `geral@agencygroup.pt` como fallback

---

### DIGEST_EMAIL
- **Obrigatoria**: Nao (default: `geral@agencygroup.pt`)
- **Servico**: App config
- **Como obter**: Email que recebe o Radar Diario de Oportunidades
- **Formato**: `carlos@agencygroup.pt`
- **Usado em**: `app/api/radar/digest/route.ts`
- **Se em falta**: Usa `geral@agencygroup.pt` como fallback

---

### ALLOWED_AGENTS
- **Obrigatoria**: Nao (ADMIN_EMAIL ja e automaticamente permitido)
- **Servico**: App config — whitelist de agentes
- **Como obter**: Lista de emails de agentes autorizados a pedir acesso ao portal
- **Formato**: `agente1@agencygroup.pt,agente2@agencygroup.pt` (separados por virgula)
- **Usado em**: `app/api/auth/request/route.ts` — validacao de whitelist de emails
- **Se em falta**: Apenas o ADMIN_EMAIL tem acesso ao portal (os outros pedidos sao rejeitados)

---

### AUTH_SECRET (ver tambem secao 3)
*Documentado na secao 3. Nota: este mesmo var e usado tanto pelo NextAuth (JWT sessions) como pelo sistema de magic links internos.*

---

### NODE_ENV
- **Obrigatoria**: Gerida automaticamente pelo Next.js/Node
- **Servico**: Runtime Node.js / Next.js
- **Como obter**: Automatico (`development` em dev, `production` em prod)
- **Formato**: `development` / `production` / `test`
- **Usado em**: `sentry.client.config.ts`, `sentry.server.config.ts` — controlo de sample rate; outros comportamentos condicionais
- **Se em falta**: Node assume `production`

---

---

## Template .env.local

Copiar para `.env.local` e preencher com os valores reais:

```bash
# =============================================================================
# AGENCY GROUP PORTAL — .env.local
# Copiar este ficheiro para .env.local e preencher os valores
# NUNCA commitar .env.local para git
# =============================================================================

# ─── SUPABASE (Obrigatorio) ───────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ─── ANTHROPIC (Claude AI) ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-

# ─── AUTH (Obrigatorio) ───────────────────────────────────────────────────────
# Gerar com: openssl rand -base64 32
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# ─── GOOGLE OAUTH (opcional — login Google) ───────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── WHATSAPP BUSINESS API ────────────────────────────────────────────────────
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=agencygroup2026
WHATSAPP_ACTIVE=false

# ─── EMAIL ────────────────────────────────────────────────────────────────────
# Opcao A: Resend (recomendado)
RESEND_API_KEY=re_

# Opcao B: SMTP fallback (se Resend nao configurado)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_PORT=587
SMTP_SECURE=false

# ─── HEYGEN (Avatar Sofia em Video — opcional) ────────────────────────────────
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=

# ─── NOTION (CRM + Pipeline) ─────────────────────────────────────────────────
NOTION_TOKEN=secret_
NOTION_PIPELINE_DB=7e68e68d-86ed-471c-8655-d8edf1e5c604
NOTION_CRM_DB=e8e554eb-adad-482e-b38b-443c23d08a40
NOTION_PROPERTIES_DB=bd030794-9aec-4b7d-9219-1b7beae5a658
NOTION_ALERTS_DB=
NOTION_DEALS_DB=
NOTION_PRICE_HISTORY_DB=

# ─── SENTRY (Monitoring — opcional) ──────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# ─── PUSH NOTIFICATIONS — VAPID ──────────────────────────────────────────────
# Gerar com: npx tsx lib/push/vapid.ts
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ─── SCRAPING (Deal Radar) ────────────────────────────────────────────────────
APIFY_TOKEN=apify_api_
BROWSERLESS_TOKEN=

# ─── STABILITY AI (Home Staging IA — opcional) ───────────────────────────────
STABILITY_API_KEY=sk-

# ─── APP CONFIG ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_EMAIL=geral@agencygroup.pt
DIGEST_EMAIL=geral@agencygroup.pt
ALLOWED_AGENTS=

# ─── SEGURANCA INTERNA ────────────────────────────────────────────────────────
# Gerar com: openssl rand -hex 32
INTERNAL_API_SECRET=
ADMIN_SECRET=
CRON_SECRET=
```

---

## Resumo de Prioridade

| Prioridade | Variavel | Impacto se em falta |
|-----------|----------|---------------------|
| CRITICO | `NEXT_PUBLIC_SUPABASE_URL` | App nao arranca |
| CRITICO | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App nao arranca |
| CRITICO | `AUTH_SECRET` | Login impossivel |
| ALTO | `ANTHROPIC_API_KEY` | Sofia retorna mock (UI funciona) |
| ALTO | `NOTION_TOKEN` | Todos endpoints /api/notion/ retornam erro 500 |
| ALTO | `NOTION_PIPELINE_DB` + `NOTION_CRM_DB` + `NOTION_PROPERTIES_DB` | Dados Notion inacessiveis |
| ALTO | `RESEND_API_KEY` | Emails nao enviados (sem SMTP fallback) |
| MEDIO | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp inactivo (WHATSAPP_ACTIVE=false por default) |
| MEDIO | `WHATSAPP_VERIFY_TOKEN` | Webhook Meta nao verificavel |
| MEDIO | `INTERNAL_API_SECRET` | Push notifications internas nao funcionam |
| MEDIO | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Push browser desactivado |
| BAIXO | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Login Google desactivado |
| BAIXO | `HEYGEN_API_KEY` | Sofia video desactivada |
| BAIXO | `STABILITY_API_KEY` | Home Staging IA desactivado |
| BAIXO | `APIFY_TOKEN` + `BROWSERLESS_TOKEN` | Radar com menos fontes |
| BAIXO | `NEXT_PUBLIC_SENTRY_DSN` | Sem monitoring de erros |
| OPCIONAL | `CRON_SECRET`, `ADMIN_SECRET` | Crons funcionam via Vercel header; trigger manual impossivel |
| OPCIONAL | `ADMIN_EMAIL`, `DIGEST_EMAIL`, `ALLOWED_AGENTS` | Usam fallbacks hardcoded |

---

*Ficheiro gerado para backup seguro — nao inclui valores reais. Guardar este documento num local seguro (ex: 1Password, Bitwarden, ou Notion privado).*
