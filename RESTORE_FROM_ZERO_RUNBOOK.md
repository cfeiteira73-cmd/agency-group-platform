# GUIA COMPLETO DE RESTAURO — DO ZERO
## Agency Group Portal v1.0
## Em caso de perda total — este documento restaura TUDO

> **ATENÇÃO:** Este documento contém credenciais reais. Manter confidencial.
> Data de referência: 06/04/2026 | AMI: 22506 | Site: https://www.agencygroup.pt

---

## VISÃO GERAL DA ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENCY GROUP PLATFORM                        │
├──────────────────┬──────────────────────┬───────────────────────────┤
│   VERCEL         │   RAILWAY (1)         │   RAILWAY (2)             │
│   Next.js 16     │   n8n Workflows       │   Python Scraper          │
│   Portal Web     │   7 automações        │   FastAPI + BeautifulSoup │
│   www.agencygroup.pt │ ag-n8n.railway.app │ ag-scraper.railway.app   │
└──────────┬───────┴──────────┬───────────┴───────────────────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────────────────────────────────────┐
    │  SUPABASE   │    │           SERVIÇOS EXTERNOS                  │
    │  PostgreSQL │    │  Anthropic (Claude) | Resend (Email)         │
    │  Frankfurt  │    │  WhatsApp Business  | Notion (legacy CRM)    │
    │  + pgvector │    │  Sentry (Monitoring)| HeyGen (Sofia Avatar)  │
    └─────────────┘    │  Apify (Scraping)   | Stability AI (Imagens) │
                       └─────────────────────────────────────────────┘
```

**Stack completa:**
- Framework: Next.js 16.2.1 + React 19 + TypeScript
- Base de dados: Supabase (PostgreSQL) — Frankfurt (West EU)
- IA: Claude claude-haiku-3-5-20241022 (chat SSE) + claude-3-5-sonnet (tarefas complexas)
- Auth: NextAuth v5 (Google OAuth + Credentials + TOTP 2FA)
- Styling: TailwindCSS v4 + GSAP (animações)
- Workflows: n8n (7 workflows) — Railway
- Scraper: FastAPI + Python — Railway
- Monitorização: Sentry
- Email: Resend + SMTP directo
- Notificações: Web Push (VAPID)
- Domínio: agencygroup.pt (Vercel)

---

## PASSO 0 — PRÉ-REQUISITOS

### Ferramentas locais necessárias

```bash
# Verificar se Node.js 18+ está instalado
node --version   # deve ser >= 18.0.0

# Verificar se npm está instalado
npm --version    # deve ser >= 9.0.0

# Verificar se Git está instalado
git --version

# Verificar se Python 3.11+ está instalado (para o scraper)
python --version  # deve ser >= 3.11

# Instalar Vercel CLI globalmente
npm install -g vercel

# Instalar Railway CLI globalmente
npm install -g @railway/cli
```

### Contas necessárias (criar se não existirem)

| Serviço | URL | Conta |
|---|---|---|
| GitHub | https://github.com | cfeiteira73-cmd |
| Supabase | https://supabase.com | — |
| Anthropic | https://console.anthropic.com | — |
| Google Cloud | https://console.cloud.google.com | — |
| Vercel | https://vercel.com | carlos-feiteiras-projects |
| Railway | https://railway.app | — |
| Meta Developers | https://developers.facebook.com | glam.servicos@hotmail.com |
| Resend | https://resend.com | — |
| Sentry | https://sentry.io | agency-group-oc |
| HeyGen | https://heygen.com | — |
| Notion | https://notion.so | — |
| Apify | https://apify.com | — |

### Informação empresa

```
Nome:       Agency Group
AMI:        22506
Email:      geral@agencygroup.pt
WhatsApp:   +351 919 948 986
Site:       https://www.agencygroup.pt
Comissão:   5% (50% CPCV + 50% Escritura)
```

---

## PASSO 1 — RECUPERAR O CÓDIGO

### 1.1 Clonar o repositório

```bash
# Clonar o repositório principal
git clone https://github.com/cfeiteira73-cmd/agency-group-platform.git agency-group
cd agency-group

# Se a branch principal não for main, verificar
git branch -a

# Fazer checkout da tag de backup estável
git checkout v1.0-backup-2026-04-06

# Instalar todas as dependências
npm install
```

### 1.2 Estrutura de directorias

```
agency-group/
├── app/                        ← Rotas Next.js (App Router)
│   ├── api/                    ← 50+ API routes
│   │   ├── crm/                ← Gestão de contactos
│   │   ├── deals/              ← Pipeline de negócios
│   │   ├── properties/         ← Imóveis
│   │   ├── sofia/              ← Chat IA (SSE streaming)
│   │   ├── whatsapp/           ← Webhook + envio WhatsApp
│   │   ├── radar/              ← Deal Radar (digest diário 08h)
│   │   ├── market-data/        ← Dados de mercado (refresh 03h Monday)
│   │   ├── cron/               ← Follow-ups automáticos (09h diário)
│   │   ├── notifications/      ← Push notifications
│   │   ├── juridico/           ← Consultor Jurídico IA
│   │   ├── automation/         ← Lead scoring, investor alert, vendor report
│   │   ├── heygen/             ← Avatar Sofia (HeyGen)
│   │   └── health/             ← Health check do sistema
│   ├── portal/                 ← Portal privado (CRM, Pipeline, Sofia)
│   ├── imoveis/                ← Portal público de imóveis
│   ├── agente/                 ← Página do agente
│   └── [ar|de|en|fr|zh]/      ← Internacionalização (5 idiomas)
├── lib/                        ← Utilitários e clientes
│   ├── supabase/               ← Cliente Supabase (server + client)
│   ├── push/                   ← Web Push (VAPID)
│   └── whatsapp/               ← Cliente WhatsApp Business API
├── supabase/
│   ├── migrations/             ← 3 migrations SQL
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_missing_tables.sql
│   │   └── 003_portal_compat.sql
│   ├── schema.sql              ← Schema completo
│   └── rls-policies.sql        ← Row Level Security
├── n8n-workflows/              ← 7 workflows n8n + Docker
├── services/
│   └── scraper/                ← FastAPI Python service
├── scripts/                    ← Scripts de seed de dados
│   ├── seed-supabase.js
│   ├── seed-properties-deals.js
│   └── verify-setup.js
├── auth.ts                     ← Config NextAuth v5
├── vercel.json                 ← Cron jobs Vercel
├── next.config.ts              ← Config Next.js + security headers
└── package.json
```

### 1.3 Dependências principais (referência)

```json
{
  "next": "16.2.1",
  "react": "19.2.4",
  "@anthropic-ai/sdk": "^0.80.0",
  "@supabase/supabase-js": "^2.49.4",
  "@supabase/ssr": "^0.5.2",
  "@auth/supabase-adapter": "^1.7.4",
  "next-auth": "^5.0.0-beta.25",
  "@sentry/nextjs": "^8.0.0",
  "resend": "^6.9.4",
  "web-push": "^3.6.7",
  "next-intl": "^3.25.0",
  "gsap": "^3.14.2",
  "zustand": "^5.0.12",
  "zod": "^3.24.0",
  "otpauth": "^9.3.6"
}
```

---

## PASSO 2 — CRIAR PROJECTO SUPABASE

### 2.1 Criar projecto no Supabase

1. Aceder a https://supabase.com e fazer login
2. Clicar em **"New Project"**
3. Preencher:
   - **Name:** `agency-group`
   - **Database Password:** (gerar uma password forte — guardar!)
   - **Region:** `West EU (Frankfurt)` — obrigatório para GDPR
   - **Pricing Plan:** Free ou Pro
4. Aguardar ~2 minutos até o projecto estar pronto
5. No dashboard do projecto, ir a **Settings → API**
6. Copiar e guardar:
   - **Project URL** (ex: `https://XXXX.supabase.co`)
   - **anon public key** (começa com `eyJ...`)
   - **service_role key** (começa com `eyJ...`) — NUNCA expor no front-end

**Valores de referência do projecto original:**
```
URL:               https://isbfiofwpxqqpgxoftph.supabase.co
Dashboard:         https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph
Região:            West EU (Frankfurt)
```

### 2.2 Activar extensão pgvector

1. No dashboard Supabase → **Database → Extensions**
2. Procurar `vector`
3. Clicar **Enable** na extensão `pgvector`

### 2.3 Executar migrations SQL (obrigatório — fazer por ordem)

Ir a **SQL Editor** no dashboard Supabase e executar cada ficheiro pela ordem indicada:

**Migration 001 — Schema inicial**
```bash
# Conteúdo do ficheiro: supabase/migrations/001_initial_schema.sql
# Cria tabelas: contacts, deals, properties
# Activa Row Level Security
# Cria índices de performance
```
→ Copiar conteúdo de `supabase/migrations/001_initial_schema.sql` e executar no SQL Editor

**Migration 002 — Tabelas em falta**
```bash
# Conteúdo do ficheiro: supabase/migrations/002_missing_tables.sql
# Cria tabelas: profiles, activities, visits, notifications, signals,
#               market_snapshots, tasks
# Configura RLS policies para cada tabela
# Cria índices de performance
# Atribui permissões (service_role, authenticated)
```
→ Copiar conteúdo de `supabase/migrations/002_missing_tables.sql` e executar no SQL Editor

**Migration 003 — Compatibilidade portal**
```bash
# Conteúdo do ficheiro: supabase/migrations/003_portal_compat.sql
# Adiciona colunas ao deals: imovel, valor, fase, comprador, ref, notas,
#                            cpcv_date_text, escritura_date_text
# Adiciona colunas ao properties: nome, zona, bairro, tipo, preco, area,
#                                  quartos, casas_banho, features, gradient
# Configura políticas RLS adicionais para service_role
# Faz GRANT de permissões finais
```
→ Copiar conteúdo de `supabase/migrations/003_portal_compat.sql` e executar no SQL Editor

### 2.4 Configurar Auth providers

1. No dashboard Supabase → **Authentication → Providers**
2. **Email:** deve estar activo por defeito
3. **Google:** activar e preencher (ver Passo 4 para obter credenciais)
4. Em **Authentication → URL Configuration:**
   - Site URL: `https://www.agencygroup.pt`
   - Redirect URLs: `https://www.agencygroup.pt/api/auth/callback/google`

### 2.5 Criar utilizador admin inicial

No **SQL Editor** do Supabase, executar:

```sql
-- Criar utilizador admin na tabela users (custom, não auth.users)
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  is_active,
  password_hash
) VALUES (
  gen_random_uuid(),
  'geral@agencygroup.pt',
  'Agency Group Admin',
  'admin',
  true,
  -- Gerar hash bcrypt da password desejada:
  -- node -e "const b = require('bcryptjs'); console.log(b.hashSync('SUA_PASSWORD_AQUI', 10))"
  '$2b$10$HASH_GERADO_AQUI'
);
```

### 2.6 Inserir dados seed

```bash
# Depois de configurar as env vars (Passo 9), executar:
cd agency-group
node scripts/seed-supabase.js          # Insere 10 contactos + utilizadores base
node scripts/seed-properties-deals.js  # Insere 8 propriedades + 8 deals

# Verificar que tudo foi inserido correctamente
node scripts/verify-setup.js

# Health check via API (após deploy)
curl https://www.agencygroup.pt/api/health
# Resposta esperada: { "status": "healthy", "counts": { "contacts": 10, "properties": 8, "deals": 8 } }
```

---

## PASSO 3 — CONFIGURAR ANTHROPIC API

### 3.1 Obter API key

1. Aceder a https://console.anthropic.com
2. Fazer login (conta associada ao projecto)
3. Ir a **API Keys → Create Key**
4. Nome da key: `agency-group-portal`
5. Copiar a key (começa com `sk-ant-api03-SUA_CHAVE_AQUI...`) — **só é mostrada uma vez**

**Valor de referência:**
```
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI
```

### 3.2 Modelos utilizados no projecto

| Uso | Modelo |
|---|---|
| Chat Sofia (SSE streaming) | `claude-haiku-3-5-20241022` |
| Análise jurídica complexa | `claude-3-5-sonnet-20241022` |
| Enriquecimento de leads (n8n) | `claude-haiku-3-5-20241022` |
| Investor matching (n8n) | `claude-3-5-sonnet-20241022` |

### 3.3 Verificar funcionamento

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: SUA_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-haiku-3-5-20241022", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]}'
# Deve retornar uma resposta JSON com "content"
```

---

## PASSO 4 — CONFIGURAR AUTH (NextAuth v5)

### 4.1 Configurar Google OAuth

1. Aceder a https://console.cloud.google.com
2. Seleccionar ou criar projecto `agency-group`
3. Ir a **APIs & Services → Credentials**
4. Clicar **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Name: `Agency Group Portal`
7. **Authorized redirect URIs** — adicionar AMBAS:
   ```
   https://www.agencygroup.pt/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
8. Clicar **Create**
9. Copiar **Client ID** e **Client Secret**

**Valores de referência:**
```
GOOGLE_CLIENT_ID=SEU_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-SEU_SECRET_AQUI
```

### 4.2 Gerar NEXTAUTH_SECRET

```bash
# Gerar secret criptograficamente seguro
openssl rand -hex 32
# Ou em Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Valor de referência:**
```
AUTH_SECRET=69aee45a66f952968a7809404212eb5cc6f0c22db185a495190c5387e9e1300d
NEXTAUTH_URL=https://www.agencygroup.pt
```

### 4.3 Como funciona o auth no projecto

O ficheiro `auth.ts` (raiz do projecto) configura dois providers:

1. **Google OAuth** — utilizadores pré-aprovados apenas (verifica `is_active = true` na tabela `users`)
2. **Credentials** — email + password (bcrypt) + TOTP opcional (2FA via app authenticator)

> **Importante:** O Google OAuth NÃO faz auto-provisioning. O utilizador tem de existir na tabela `users` com `is_active = true` antes de conseguir fazer login. Adicionar utilizadores manualmente no Supabase ou via script de seed.

Sessão JWT com duração de **8 horas**.

Páginas personalizadas:
- Login: `/auth/login`
- Erro: `/auth/error`

---

## PASSO 5 — CONFIGURAR WHATSAPP BUSINESS

### 5.1 Configurar conta Meta Developer

1. Aceder a https://developers.facebook.com com a conta `glam.servicos@hotmail.com`
2. Se não houver conta, completar registo em https://developers.facebook.com/async/registration/
3. Ir a **My Apps → Create App**
4. Seleccionar tipo: **Business**
5. Nome: `Agency Group`
6. Associar ao Business Account (business.facebook.com)

### 5.2 Adicionar produto WhatsApp

1. Na página da App → **Add Product → WhatsApp → Set Up**
2. Ir a **WhatsApp → API Setup**

### 5.3 Obter credenciais WhatsApp

Na página **WhatsApp → API Setup**:

- **Phone Number ID:** copiar do dropdown "From" (ex: `SEU_WHATSAPP_PHONE_ID`)
- **WhatsApp Business Account (WABA) ID:** copiar do topo da página (ex: `SEU_WABA_ID`)
- **Temporary Token:** clicar "Generate token" (válido 24h — usar só para testes)
- **Token permanente:**
  1. Ir a **Business Settings → System Users → Add**
  2. Nome: `ag-system-user` | Role: **Admin**
  3. Clicar **Generate Token**
  4. Seleccionar App: `Agency Group`
  5. Adicionar permissão: `whatsapp_business_messaging`
  6. Copiar token gerado

**Valores de referência:**
```
WHATSAPP_PHONE_NUMBER_ID=SEU_WHATSAPP_PHONE_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=SEU_WABA_ID
WHATSAPP_ACCESS_TOKEN=<token permanente gerado>
WHATSAPP_VERIFY_TOKEN=SEU_VERIFY_TOKEN
WHATSAPP_ACTIVE=true
```

> **Nota:** Por defeito, `WHATSAPP_ACTIVE=false`. Sofia não responde automaticamente enquanto esta variável não for `true`.

### 5.4 Configurar Webhook na Meta

1. Na App Meta → **WhatsApp → Configuration**
2. Clicar **Edit** no campo Webhook
3. Preencher:
   - **Callback URL:** `https://www.agencygroup.pt/api/whatsapp/webhook`
   - **Verify Token:** `SEU_VERIFY_TOKEN`
4. Clicar **Verify and Save**
5. Clicar **Subscribe** em `messages`

### 5.5 Testar WhatsApp

```bash
# Verificar status do token
curl https://www.agencygroup.pt/api/whatsapp/status

# Enviar mensagem de teste
curl -X POST https://www.agencygroup.pt/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"to": "+351919948986", "message": "Teste Agency Group Portal"}'
```

### 5.6 Templates de mensagem disponíveis

O cliente em `lib/whatsapp/client.ts` tem estes templates prontos:
1. `novoContacto` — primeiro contacto com lead
2. `followUp` — seguimento após apresentação
3. `visitaConfirmacao` — confirmação de visita
4. `proposta` — envio de proposta formal
5. `cpcvReminder` — lembrete de CPCV
6. `investorPitch` — pitch para investidores
7. `docsPendentes` — pedido de documentos

---

## PASSO 6 — CONFIGURAR RESEND (EMAIL)

### 6.1 Criar conta e verificar domínio

1. Aceder a https://resend.com e criar conta
2. Ir a **Domains → Add Domain**
3. Adicionar: `agencygroup.pt`
4. Resend vai fornecer registos DNS (MX, DKIM, SPF) para adicionar ao DNS do domínio
5. Aguardar verificação (pode demorar até 48h)

### 6.2 Obter API key

1. Ir a **API Keys → Create API Key**
2. Nome: `agency-group-portal`
3. Permission: **Full Access**
4. Copiar key (começa com `re_SUA_RESEND_KEY_AQUI...`)

**Valor de referência:**
```
RESEND_API_KEY=re_SUA_RESEND_KEY_AQUI
```

### 6.3 SMTP como fallback (email directo)

O projecto usa também SMTP directo como fallback via Nodemailer:

```
SMTP_USER=geral@agencygroup.pt
SMTP_PASS=Caloca050573*
```

> Configurar via painel de email do provedor (ex: GoDaddy, Namecheap, etc.) conforme o hosting do domínio `agencygroup.pt`.

### 6.4 Testar envio de email

```bash
curl -X POST https://www.agencygroup.pt/api/test-smtp \
  -H "Content-Type: application/json" \
  -d '{"to": "geral@agencygroup.pt", "subject": "Teste", "body": "Email de teste"}'
```

---

## PASSO 7 — CONFIGURAR HEYGEN (SOFIA AVATAR)

### 7.1 Criar conta HeyGen

1. Aceder a https://heygen.com e criar conta business
2. Ir a **Avatar → Create Avatar** ou seleccionar avatar existente
3. Criar avatar chamado **"Sofia"** — face feminina, profissional
4. Anotar o **Avatar ID** (string alfanumérica)

### 7.2 Seleccionar voz

1. Ir a **Voice → Voice Library**
2. Seleccionar voz em Português (Portugal) — feminina, profissional
3. Anotar o **Voice ID**

### 7.3 Obter API key

1. Ir a **Settings → API → Generate API Key**
2. Copiar key

**Variáveis de ambiente necessárias:**
```
HEYGEN_API_KEY=<api key gerada>
HEYGEN_AVATAR_ID=<id do avatar Sofia>
HEYGEN_VOICE_ID=<id da voz seleccionada>
```

### 7.4 Endpoint do projecto

O projecto tem a route `app/api/heygen/` que aceita texto e gera vídeo com Sofia a falar.
Usar em modo de demonstração ou em vídeos de apresentação de imóveis.

---

## PASSO 8 — CONFIGURAR NOTION

> **Nota:** O Notion é usado como CRM legacy. O Supabase é o DB principal do portal.

### 8.1 Criar integração Notion

1. Aceder a https://www.notion.so/my-integrations
2. Clicar **+ New Integration**
3. Nome: `Agency Group Portal`
4. Workspace: seleccionar o workspace correcto
5. Capabilities: marcar **Read content, Update content, Insert content**
6. Clicar **Submit**
7. Copiar o **Internal Integration Token** (começa com `ntn_SEU_TOKEN_NOTION_AQUI...`)

**Valor de referência:**
```
NOTION_TOKEN=ntn_SEU_TOKEN_NOTION_AQUI
```

### 8.2 Partilhar databases com a integração

Para cada database Notion (Deals, Properties, Pipeline):
1. Abrir a database no Notion
2. Clicar nos `...` (três pontos) no canto superior direito
3. Ir a **Add connections**
4. Seleccionar `Agency Group Portal`

### 8.3 Obter IDs das databases

A URL de cada database tem o formato:
```
https://www.notion.so/NOME-DA-PAGE-{DATABASE_ID}?v=...
```
O `DATABASE_ID` é a string de 32 caracteres (com ou sem hífens).

**Valores de referência:**
```
NOTION_DEALS_DB=e8e554eb-adad-482e-b38b-443c23d08a40
NOTION_PROPERTIES_DB=bd030794-9aec-4b7d-9219-1b7beae5a658
NOTION_PIPELINE_DB=7e68e68d-86ed-471c-8655-d8edf1e5c604
```

### 8.4 Links das databases Notion

```
Deals:         https://www.notion.so/b5693a14ca8c43fa8645606363594662
Mensagens:     https://www.notion.so/cc52c0eba2df4649ae2b1cb45bb83513
Reels:         https://www.notion.so/f03b534cef7b40fab423e440ca09f997
Aprendizagens: https://www.notion.so/d4d4ce407ae14358855d67cc7f28cbb4
```

---

## PASSO 9 — CONFIGURAR VARIÁVEIS DE AMBIENTE

### 9.1 Criar ficheiro .env.local (desenvolvimento local)

```bash
# Na raiz do projecto
cp .env.local.example .env.local
# Ou criar do zero:
touch .env.local
```

### 9.2 Conteúdo completo do .env.local

```bash
# =============================================================================
# SUPABASE
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_SUPABASE_SERVICE_ROLE_JWT_AQUI
SUPABASE_SERVICE_ROLE_KEY=SEU_SUPABASE_SERVICE_ROLE_JWT_AQUI

# =============================================================================
# ANTHROPIC / CLAUDE (IA)
# =============================================================================
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI

# =============================================================================
# NEXTAUTH / AUTH
# =============================================================================
AUTH_SECRET=69aee45a66f952968a7809404212eb5cc6f0c22db185a495190c5387e9e1300d
NEXTAUTH_URL=https://www.agencygroup.pt
GOOGLE_CLIENT_ID=SEU_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-SEU_SECRET_AQUI

# =============================================================================
# WHATSAPP BUSINESS
# =============================================================================
WHATSAPP_PHONE_NUMBER_ID=SEU_WHATSAPP_PHONE_ID
WHATSAPP_BUSINESS_ACCOUNT_ID=SEU_WABA_ID
WHATSAPP_ACCESS_TOKEN=<OBTER VIA META DEVELOPER — ver Passo 5>
WHATSAPP_VERIFY_TOKEN=SEU_VERIFY_TOKEN
WHATSAPP_ACTIVE=false

# =============================================================================
# EMAIL — RESEND
# =============================================================================
RESEND_API_KEY=re_SUA_RESEND_KEY_AQUI

# =============================================================================
# EMAIL — SMTP DIRECTO (fallback)
# =============================================================================
SMTP_HOST=smtp.agencygroup.pt
SMTP_PORT=587
SMTP_USER=geral@agencygroup.pt
SMTP_PASS=Caloca050573*
SMTP_FROM=geral@agencygroup.pt

# =============================================================================
# SENTRY (Error Monitoring)
# =============================================================================
NEXT_PUBLIC_SENTRY_DSN=https://b12f3a5deb135114dfffc81a9e6ef1e1@o4511156597096448.ingest.de.sentry.io/4511156599324752
SENTRY_AUTH_TOKEN=sntrys_SEU_SENTRY_TOKEN_AQUI
SENTRY_ORG=agency-group-oc

# =============================================================================
# WEB PUSH NOTIFICATIONS (VAPID)
# =============================================================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BARz3T5nPTbfKfZOstDSNJvmDl15dmFj0PMPRy82b8Jnxp6ys4quRqQ6Lgz4JQva7q9U9oywxB7sj2bOnK68DCs
VAPID_PRIVATE_KEY=SUA_VAPID_PRIVATE_KEY_AQUI

# =============================================================================
# NOTION
# =============================================================================
NOTION_TOKEN=ntn_SEU_TOKEN_NOTION_AQUI
NOTION_DEALS_DB=e8e554eb-adad-482e-b38b-443c23d08a40
NOTION_PROPERTIES_DB=bd030794-9aec-4b7d-9219-1b7beae5a658
NOTION_PIPELINE_DB=7e68e68d-86ed-471c-8655-d8edf1e5c604

# =============================================================================
# INTERNAL API
# =============================================================================
INTERNAL_API_SECRET=ag-internal-2026-9f3a2b1c4d5e6f7a
ADMIN_EMAIL=geral@agencygroup.pt
ALLOWED_AGENTS=geral@agencygroup.pt
BASE_URL=https://www.agencygroup.pt

# =============================================================================
# HEYGEN (Avatar Sofia)
# =============================================================================
HEYGEN_API_KEY=<API KEY DO HEYGEN>
HEYGEN_AVATAR_ID=<ID DO AVATAR SOFIA>
HEYGEN_VOICE_ID=<ID DA VOZ>

# =============================================================================
# APIFY (Scraping)
# =============================================================================
APIFY_TOKEN=apify_api_SEU_TOKEN_AQUI

# =============================================================================
# STABILITY AI (Imagens)
# =============================================================================
STABILITY_API_KEY=sk-E9q1U70vuk9Qy6o1bFLnInCby9TIcW8ulmKMMuhPOI2hAD7c

# =============================================================================
# SERVIÇOS RAILWAY (URLs após deploy — preencher depois do Passo 10 e 11)
# =============================================================================
N8N_URL=https://<SEU-N8N>.railway.app
SCRAPER_URL=https://<SEU-SCRAPER>.railway.app
```

### 9.3 Verificar instalação local

```bash
# Arrancar servidor de desenvolvimento
npm run dev

# Abrir em browser
# http://localhost:3000

# Verificar health da API
curl http://localhost:3000/api/health
```

---

## PASSO 10 — CONFIGURAR VERCEL (DEPLOY PORTAL)

### 10.1 Importar projecto no Vercel

1. Aceder a https://vercel.com e fazer login
2. Clicar **Add New → Project**
3. Seleccionar repositório `agency-group-platform` do GitHub
4. Framework: **Next.js** (detectado automaticamente)
5. Root Directory: `.` (raiz)
6. Clicar **Deploy** (vai falhar — falta as env vars)

### 10.2 Adicionar variáveis de ambiente no Vercel

1. No projecto Vercel → **Settings → Environment Variables**
2. Adicionar **TODAS** as variáveis do `.env.local` do Passo 9.2
3. Para cada variável, seleccionar os ambientes: **Production, Preview, Development**
4. Clicar **Save**

> **Variáveis críticas que NUNCA podem faltar:**
> ```
> NEXT_PUBLIC_SUPABASE_URL
> NEXT_PUBLIC_SUPABASE_ANON_KEY
> SUPABASE_SERVICE_ROLE_KEY
> ANTHROPIC_API_KEY
> AUTH_SECRET
> NEXTAUTH_URL
> GOOGLE_CLIENT_ID
> GOOGLE_CLIENT_SECRET
> INTERNAL_API_SECRET
> NEXT_PUBLIC_VAPID_PUBLIC_KEY
> VAPID_PRIVATE_KEY
> NEXT_PUBLIC_SENTRY_DSN
> ```

### 10.3 Re-fazer deploy com env vars

```bash
# Via CLI (recomendado)
npx vercel deploy --prod

# Ou no dashboard Vercel → Deployments → Redeploy
```

### 10.4 Configurar domínio personalizado

1. No Vercel → **Settings → Domains**
2. Adicionar: `www.agencygroup.pt`
3. Adicionar também: `agencygroup.pt` (redireccionará para www)
4. Vercel vai fornecer registos DNS (CNAME ou A)
5. Adicionar esses registos no DNS do registar do domínio
6. Aguardar propagação DNS (até 48h)

### 10.5 Cron jobs (já configurados no vercel.json)

O ficheiro `vercel.json` já configura 3 cron jobs automáticos:

| Cron | Schedule | Descrição |
|---|---|---|
| `/api/radar/digest` | `0 8 * * *` | Digest diário de oportunidades — 08h00 UTC |
| `/api/market-data/refresh` | `0 3 * * 1` | Refresh dados mercado — 03h00 UTC às segundas |
| `/api/cron/followups` | `0 9 * * *` | Follow-ups automáticos — 09h00 UTC |

> **Nota:** Os cron jobs Vercel requerem plano **Pro** (€20/mês). No plano Free, os cron jobs não executam.

### 10.6 Verificar deploy

```bash
# Testar URL de produção
curl https://www.agencygroup.pt/api/health

# Resposta esperada:
# { "status": "healthy", "counts": { "contacts": 10, "properties": 8, "deals": 8 } }

# Testar redirect de non-www para www
curl -I http://agencygroup.pt
# Deve retornar 301 para https://www.agencygroup.pt
```

---

## PASSO 11 — CONFIGURAR N8N (RAILWAY)

### 11.1 Deploy n8n no Railway

1. Aceder a https://railway.app e fazer login
2. Clicar **New Project → Deploy from GitHub repo**
3. Seleccionar repositório `agency-group-platform`
4. **Root Directory:** `n8n-workflows`
5. Railway detecta automaticamente o `Dockerfile.n8n`

### 11.2 Adicionar variáveis de ambiente n8n no Railway

No painel Railway do serviço n8n → **Variables → Add Variable**:

```bash
N8N_ENCRYPTION_KEY=<gerar: openssl rand -hex 16>
N8N_WEBHOOK_URL=https://<SEU-N8N>.railway.app
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https
NODE_ENV=production

# Supabase (connection pooler — porta 6543 para n8n)
SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SEU_SUPABASE_SERVICE_ROLE_JWT_AQUI

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI

# Portal
PORTAL_URL=https://www.agencygroup.pt
INTERNAL_API_SECRET=ag-internal-2026-9f3a2b1c4d5e6f7a

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=SEU_WHATSAPP_PHONE_ID
WHATSAPP_ACCESS_TOKEN=<TOKEN META>
```

### 11.3 Importar workflows n8n

1. Aceder à UI do n8n: `https://<SEU-N8N>.railway.app`
2. Ir a **Settings → Import Workflow**
3. Importar os 7 ficheiros pela ordem indicada:

| Ordem | Ficheiro | Descrição |
|---|---|---|
| 1 | `workflow-a-lead-inbound.json` | Webhook para novos leads inbound |
| 2 | `workflow-a-lead-enrichment.json` | Enriquecimento: normalizar, dedup, score, WhatsApp |
| 3 | `workflow-b-lead-scoring.json` | Scoring automático de leads |
| 4 | `workflow-b-daily-report.json` | Report diário de mercado (Seg–Sex 08h00) |
| 5 | `workflow-c-dormant-lead.json` | Re-engajamento leads dormentes (09h00 diário) |
| 6 | `workflow-d-investor-alert.json` | Alerta investidor via WhatsApp (threshold 60pts) |
| 7 | `workflow-e-vendor-report.json` | Report semanal vendedor (Segunda 08h00) |

### 11.4 Configurar credenciais n8n

Em cada workflow importado, configurar as credenciais internas do n8n:

1. **Supabase PostgreSQL** (nome: `supabase-postgres-cred`):
   - Host: `db.isbfiofwpxqqpgxoftph.supabase.co`
   - Port: `6543` (connection pooler)
   - Database: `postgres`
   - User: `postgres`
   - Password: `<password do Supabase>`

2. **Anthropic API** (nome: `Anthropic API`):
   - API Key: `sk-ant-api03-SUA_CHAVE_AQUI...`

3. **WhatsApp Business API** (nome: `WhatsApp Business API`):
   - Phone Number ID: `SEU_WHATSAPP_PHONE_ID`
   - Access Token: `<token permanente>`

4. **Agency Group Portal API** (nome: `Agency Group Portal API`):
   - Base URL: `https://www.agencygroup.pt`
   - Secret: `ag-internal-2026-9f3a2b1c4d5e6f7a`

### 11.5 Activar workflows

1. Para cada workflow importado, clicar no toggle **"Active"** no canto superior direito
2. Verificar que o status fica verde (activo)

### 11.6 URLs de webhook (após activação)

| Workflow | Webhook URL |
|---|---|
| Lead Enrichment | `https://<N8N>.railway.app/webhook/lead-enrichment` |
| Investor Alert | `https://<N8N>.railway.app/webhook/new-property` |

> **Nota de timezone:** Os cron jobs estão em UTC. Lisboa é UTC+1 (inverno) ou UTC+2 (verão). Ajustar as expressões cron conforme necessário.

---

## PASSO 12 — CONFIGURAR PYTHON SCRAPER (RAILWAY)

### 12.1 Deploy scraper no Railway

1. No Railway → **New Project → Deploy from GitHub repo**
2. Seleccionar repositório `agency-group-platform`
3. **Root Directory:** `services/scraper`
4. Railway detecta `Dockerfile` automaticamente
5. O serviço chama-se `ag-scraper` (definido em `railway.toml`)

### 12.2 Variáveis de ambiente do scraper

No painel Railway do serviço scraper → **Variables**:

```bash
SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SEU_SUPABASE_SERVICE_ROLE_JWT_AQUI
ANTHROPIC_API_KEY=sk-ant-api03-SUA_CHAVE_AQUI
APIFY_TOKEN=apify_api_SEU_TOKEN_AQUI
PORT=8000
```

### 12.3 Dependências Python do scraper

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
httpx==0.26.0
pydantic==2.5.3
python-dotenv==1.0.0
supabase==2.3.4
anthropic==0.18.1
beautifulsoup4==4.12.3
lxml==5.1.0
```

### 12.4 Endpoints do scraper

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | Health check do serviço |
| `POST` | `/signals/dre` | Fetch de alvarás DRE (licenças construção) |
| `POST` | `/enrich/property` | Enriquecimento de imóvel com dados de mercado |
| `GET` | `/market/zones` | Dados de mercado por zona |

### 12.5 Testar scraper

```bash
# Health check
curl https://<SEU-SCRAPER>.railway.app/health

# Dados de mercado
curl https://<SEU-SCRAPER>.railway.app/market/zones

# Enriquecer propriedade
curl -X POST https://<SEU-SCRAPER>.railway.app/enrich/property \
  -H "Content-Type: application/json" \
  -d '{"zona": "Lisboa", "tipo": "Apartamento", "area": 80}'
```

### 12.6 Actualizar URL do scraper nas env vars Vercel

Depois de o scraper estar deployed e ter uma URL pública:

1. Ir ao Vercel → Settings → Environment Variables
2. Adicionar/actualizar: `SCRAPER_URL=https://<SEU-SCRAPER>.railway.app`
3. Re-fazer deploy do Vercel

---

## PASSO 13 — CONFIGURAR SENTRY (MONITORING)

### 13.1 Criar projecto Sentry

1. Aceder a https://sentry.io
2. Login na organização `agency-group-oc`
3. Se for nova conta:
   - **Create Organization:** `agency-group-oc`
   - **Create Project:** Next.js
   - Nome: `agency-group`
4. Copiar o **DSN** do projecto

**Valores de referência:**
```
NEXT_PUBLIC_SENTRY_DSN=https://b12f3a5deb135114dfffc81a9e6ef1e1@o4511156597096448.ingest.de.sentry.io/4511156599324752
SENTRY_ORG=agency-group-oc
```

### 13.2 Obter Auth Token

1. Sentry → **Settings → Auth Tokens → Create New Token**
2. Scopes: `project:releases`, `org:read`
3. Copiar token

**Valor de referência:**
```
SENTRY_AUTH_TOKEN=sntrys_SEU_SENTRY_TOKEN_AQUI
```

### 13.3 Configuração Sentry no projecto

O projecto tem 3 ficheiros de configuração Sentry (já criados):
- `sentry.client.config.ts` — browser (10% de sessões, 100% em erros)
- `sentry.server.config.ts` — server-side
- `sentry.edge.config.ts` — edge runtime

### 13.4 Testar Sentry

```bash
# Trigger um erro de teste
curl https://www.agencygroup.pt/api/sentry-test

# Verificar no dashboard Sentry se o erro aparece
# https://agency-group-oc.sentry.io
```

---

## PASSO 14 — PUSH NOTIFICATIONS (VAPID)

### 14.1 Gerar novas chaves VAPID (se necessário)

Se as chaves originais estiverem perdidas, gerar novas:

```bash
# Método 1: Usando o script do projecto
cd agency-group
npx tsx lib/push/vapid.ts

# Método 2: Via Node.js puro
node -e "
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + Buffer.from(publicKey).toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + Buffer.from(privateKey).toString('base64url'));
"
```

> **AVISO:** Se as chaves VAPID mudarem, **todos os utilizadores têm de re-subscrever** as notificações push. Usar as chaves originais sempre que possível.

**Chaves de referência:**
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BARz3T5nPTbfKfZOstDSNJvmDl15dmFj0PMPRy82b8Jnxp6ys4quRqQ6Lgz4JQva7q9U9oywxB7sj2bOnK68DCs
VAPID_PRIVATE_KEY=SUA_VAPID_PRIVATE_KEY_AQUI
```

### 14.2 Como funcionam as push notifications

O projecto tem em `lib/push/`:
- `vapid.ts` — geração de chaves
- `notifications.ts` — envio de notificações
- `client.ts` — service worker client

As notificações são enviadas via API route `/api/push` e recebidas via service worker no browser.

### 14.3 Testar push notifications

1. Aceder ao portal em https://www.agencygroup.pt/portal
2. O browser vai pedir permissão para notificações
3. Aceitar
4. Fazer trigger de um evento que gera notificação (ex: novo lead)
5. Verificar que a notificação aparece no browser

---

## PASSO 15 — SMOKE TEST COMPLETO

### 15.1 Verificação de infraestrutura (20 pontos)

Executar cada teste pela ordem e verificar o resultado:

```bash
BASE_URL="https://www.agencygroup.pt"
N8N_URL="https://<SEU-N8N>.railway.app"
SCRAPER_URL="https://<SEU-SCRAPER>.railway.app"

echo "=== SMOKE TEST AGENCY GROUP PORTAL ==="
echo "Data: $(date)"
echo ""

# 1. Health check do portal
echo "[1/20] Portal health check..."
curl -s $BASE_URL/api/health | python -m json.tool
echo ""

# 2. Supabase — leitura de contactos
echo "[2/20] Supabase contacts..."
curl -s "$BASE_URL/api/crm?limit=5" | python -m json.tool
echo ""

# 3. Supabase — leitura de deals
echo "[3/20] Supabase deals..."
curl -s "$BASE_URL/api/deals?limit=5" | python -m json.tool
echo ""

# 4. Supabase — leitura de propriedades
echo "[4/20] Supabase properties..."
curl -s "$BASE_URL/api/properties?limit=5" | python -m json.tool
echo ""

# 5. Dados de mercado
echo "[5/20] Market data..."
curl -s "$BASE_URL/api/market-data" | python -m json.tool
echo ""

# 6. Sofia AI (endpoint SSE — apenas verificar status 200)
echo "[6/20] Sofia AI endpoint..."
curl -s -o /dev/null -w "HTTP %{http_code}" -X POST "$BASE_URL/api/sofia/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá Sofia", "conversationId": "test-123"}'
echo ""

# 7. Página principal carrega
echo "[7/20] Página principal..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL"
echo ""

# 8. Página de imóveis carrega
echo "[8/20] Página de imóveis..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/imoveis"
echo ""

# 9. WhatsApp status
echo "[9/20] WhatsApp status..."
curl -s "$BASE_URL/api/whatsapp/status"
echo ""

# 10. WhatsApp webhook (verificação GET)
echo "[10/20] WhatsApp webhook verification..."
curl -s -o /dev/null -w "HTTP %{http_code}" \
  "$BASE_URL/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_VERIFY_TOKEN&hub.challenge=test123"
echo ""

# 11. Signals API
echo "[11/20] Signals API..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/api/signals"
echo ""

# 12. Notifications API
echo "[12/20] Notifications API..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/api/notifications"
echo ""

# 13. Juridico API
echo "[13/20] Consultor Jurídico..."
curl -s -o /dev/null -w "HTTP %{http_code}" -X POST "$BASE_URL/api/juridico" \
  -H "Content-Type: application/json" \
  -d '{"query": "O que é IMT?"}'
echo ""

# 14. Radar digest trigger
echo "[14/20] Deal Radar API..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/api/radar/digest"
echo ""

# 15. n8n health
echo "[15/20] n8n health..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$N8N_URL/healthz"
echo ""

# 16. Scraper health
echo "[16/20] Scraper health..."
curl -s "$SCRAPER_URL/health"
echo ""

# 17. Scraper market zones
echo "[17/20] Scraper market zones..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$SCRAPER_URL/market/zones"
echo ""

# 18. Sentry test endpoint
echo "[18/20] Sentry test..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/api/sentry-test"
echo ""

# 19. Portal page (requer auth — verificar redirect para login)
echo "[19/20] Portal auth redirect..."
curl -s -o /dev/null -w "HTTP %{http_code}" -L "$BASE_URL/portal"
echo ""

# 20. Sitemap
echo "[20/20] Sitemap..."
curl -s -o /dev/null -w "HTTP %{http_code}" "$BASE_URL/sitemap.xml"
echo ""

echo "=== FIM DO SMOKE TEST ==="
```

### 15.2 Verificações manuais no browser

Abrir https://www.agencygroup.pt e verificar:

- [ ] Página principal carrega sem erros no console
- [ ] Login com Google OAuth funciona (redireccionamento correcto)
- [ ] Login com email/password funciona
- [ ] Portal carrega com dados reais (contactos, deals, imóveis)
- [ ] Chat Sofia responde (streaming SSE a funcionar)
- [ ] Consultor Jurídico responde a perguntas
- [ ] Pipeline de deals actualiza em tempo real
- [ ] Mapa de imóveis carrega
- [ ] Notificações push aparecem (aceitar permissão)

### 15.3 Verificar cron jobs Vercel

No dashboard Vercel → **Cron Jobs**:
- [ ] `/api/radar/digest` — activo, último run OK
- [ ] `/api/market-data/refresh` — activo, último run OK
- [ ] `/api/cron/followups` — activo, último run OK

### 15.4 Verificar workflows n8n

Em `https://<SEU-N8N>.railway.app`:
- [ ] `workflow-a-lead-inbound` — Active (verde)
- [ ] `workflow-a-lead-enrichment` — Active (verde)
- [ ] `workflow-b-lead-scoring` — Active (verde)
- [ ] `workflow-b-daily-report` — Active (verde)
- [ ] `workflow-c-dormant-lead` — Active (verde)
- [ ] `workflow-d-investor-alert` — Active (verde)
- [ ] `workflow-e-vendor-report` — Active (verde)

### 15.5 Verificar Sentry

Em https://agency-group-oc.sentry.io:
- [ ] Erros a ser capturados correctamente
- [ ] Performance transactions a aparecer
- [ ] Sessions a ser registadas

---

## APÊNDICE A — COMANDOS DE EMERGÊNCIA

```bash
# Forçar re-deploy imediato no Vercel
npx vercel deploy --prod --force

# Ver logs do Vercel em tempo real
npx vercel logs https://www.agencygroup.pt --follow

# Ver status do Railway
railway status

# Ver logs do n8n no Railway
railway logs --service ag-n8n

# Ver logs do scraper no Railway
railway logs --service ag-scraper

# Rebuild completo (limpar cache npm)
rm -rf node_modules .next
npm install
npm run build

# Correr testes
npm test

# Verificar TypeScript sem erros
npx tsc --noEmit

# Verificar lint
npm run lint

# Seed de dados de desenvolvimento
node scripts/seed-supabase.js
node scripts/seed-properties-deals.js
node scripts/verify-setup.js
```

---

## APÊNDICE B — TROUBLESHOOTING COMUM

### Auth não funciona
- Verificar `AUTH_SECRET` e `NEXTAUTH_URL` nas env vars Vercel
- Verificar que os redirect URIs do Google incluem o domínio correcto
- No Supabase, verificar que o utilizador existe com `is_active = true`

### Supabase retorna 401
- A `SUPABASE_SERVICE_ROLE_KEY` é diferente da `ANON_KEY`
- Service Role bypassa RLS — usar para operações admin
- Verificar que as env vars têm o valor completo (as keys JWT são longas)

### Sofia não responde
- Verificar `ANTHROPIC_API_KEY` nas env vars
- Verificar que a key não expirou no dashboard Anthropic
- Verificar rate limits (ver https://console.anthropic.com/settings/limits)

### WhatsApp não envia
- `WHATSAPP_ACTIVE` deve ser `true`
- O token Meta expira — usar sempre token de System User permanente
- O número tem de estar aprovado pela Meta para enviar para números externos

### n8n workflows não executam
- Verificar que os workflows estão no estado "Active" (toggle verde)
- Verificar credenciais configuradas correctamente em cada workflow
- Cron jobs em UTC — Lisoba é UTC+1 (inverno) / UTC+2 (verão)
- Usar connection pooler Supabase na porta 6543 (não 5432)

### Push notifications não aparecem
- As chaves VAPID têm de ser as mesmas em dev e produção
- Se as chaves mudarem, utilizadores têm de re-subscrever
- Verificar service worker no browser (DevTools → Application → Service Workers)
- HTTPS obrigatório para push notifications (funciona em localhost mas não em HTTP remoto)

### Sentry não captura erros
- `NEXT_PUBLIC_SENTRY_DSN` é a variável pública (browser)
- Em desenvolvimento, Sentry está desactivado (`beforeSend` retorna null)
- Só activo em produção (NODE_ENV=production)

---

## APÊNDICE C — CUSTOS MENSAIS ESTIMADOS

| Serviço | Plano | Custo/mês |
|---|---|---|
| Vercel | Pro (para cron jobs) | ~€20 |
| Supabase | Free / Pro | €0 / €25 |
| Railway (n8n) | Hobby | ~€5–15 |
| Railway (scraper) | Hobby | ~€5–10 |
| Anthropic | Pay-per-use | ~€20–50 |
| Resend | Free (3k emails) | €0 / €20 |
| Sentry | Free (10k erros) | €0 / €26 |
| HeyGen | Pay-per-use | ~€20–50 |
| Apify | Pay-per-use | ~€5–20 |
| **Total estimado** | | **~€75–215/mês** |

---

## APÊNDICE D — CONTACTOS E REFERÊNCIAS

```
Empresa:         Agency Group
AMI:             22506
Email principal: geral@agencygroup.pt
WhatsApp:        +351 919 948 986
Portal:          https://www.agencygroup.pt
GitHub:          https://github.com/cfeiteira73-cmd/agency-group-platform
Supabase:        https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph
Sentry:          https://agency-group-oc.sentry.io
Vercel:          https://vercel.com/carlos-feiteiras-projects/agency-group
```

---

*Documento criado em 06/04/2026. Actualizar sempre que houver mudanças de infra ou credenciais.*
*Versão: 1.0 | Runbook de Disaster Recovery — Agency Group Portal*
