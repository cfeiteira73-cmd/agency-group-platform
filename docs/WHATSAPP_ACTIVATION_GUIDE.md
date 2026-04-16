# WhatsApp Business — Guia de Activação Completo
**Agency Group · AMI 22506 · +351 919 948 986**

---

## 1. O que já está implementado e funciona (excepto token)

### Webhook (`/api/whatsapp/webhook`)
- Verificação do webhook Meta (GET com `hub.verify_token`) — totalmente funcional
- Validação HMAC SHA-256 (`x-hub-signature-256`) com `timingSafeEqual` — segurança production-grade
- Sanitização de prompt injection nas mensagens recebidas
- Log GDPR-compliant: apenas últimos 4 dígitos do número
- Auto-criação/upsert de contactos no Supabase (`contacts` table) — **sempre activo**, independente de `WHATSAPP_ACTIVE`
- Processamento de delivery/read status updates
- Protecção contra retry storms da Meta (sempre responde 200)

### Sofia Auto-reply (`generateAndSendSofiaReply`)
- Classificação de intenção: `price_inquiry`, `visit_request`, `document_request`, `offer_inquiry`, `general`
- Prompts por intenção em PT/EN/FR (detecção automática de idioma)
- Modelo `claude-haiku-3-5-20241022` (rápido, barato)
- Resposta máx. 3 frases + oferta de ligar em 5 minutos

### Send API (`/api/whatsapp/send`)
- Envio de mensagens customizadas ou por template nomeado
- Autenticado via `x-portal-token` / cookie `ag_portal`
- Normalização de número para E.164

### Client (`/lib/whatsapp/client.ts`)
- `sendWhatsApp()` wrapper da Meta Cloud API
- Templates pré-definidos (provavelmente: nova_proposta, confirmacao_visita, etc.)

---

## 2. O que falha sem o token vs o que crasha

### Falha graciosamente (sem crash, com log de aviso):
- **Sofia auto-reply**: quando `WHATSAPP_ACCESS_TOKEN=PREENCHER`, a chamada à Meta API falha com HTTP 401. O erro é capturado no try/catch e logado — **o webhook continua a funcionar, o upsert no CRM é feito na mesma**.
- **Send API** (`/api/whatsapp/send`): retorna `{ error: ... }` HTTP 500, sem crash do servidor.
- **ANTHROPIC_API_KEY ausente**: Sofia simplesmente não responde (warn log), sem crash.

### Falha hard (rejeita o request imediatamente):
- **`WHATSAPP_APP_SECRET` ausente**: o webhook rejeita TODOS os requests POST com HTTP 503 (`"Webhook not configured"`). Isto é **intencional por segurança** — sem o segredo da app não se pode validar assinaturas Meta.

### Resumo prático com o estado actual:
| Funcionalidade | Estado actual (`WHATSAPP_ACTIVE=false`, token em falta) |
|---|---|
| Verificação webhook (GET) | ✅ Funciona (usa `WHATSAPP_VERIFY_TOKEN`) |
| Receber mensagens POST | ❌ Falha (falta `WHATSAPP_APP_SECRET`) |
| Upsert CRM | ❌ Não chega a executar (bloqueado pelo HMAC) |
| Sofia auto-reply | ❌ Off por design (`WHATSAPP_ACTIVE=false`) |
| Enviar mensagens (portal) | ❌ Falha na chamada Meta API (token inválido) |

---

## 3. Env vars necessárias e onde obter

| Variável | Valor actual | Como obter |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER` | `+351919948986` | Já preenchido |
| `WHATSAPP_PHONE_NUMBER_ID` | `855251598377117` | Já preenchido — confirmar em Meta App > WhatsApp > Configuration |
| `WHATSAPP_VERIFY_TOKEN` | `agwh-d21616b3632a63bb1d28635a04ad9b4c` | Já preenchido (token secreto que defines tu) |
| `WHATSAPP_ACCESS_TOKEN` | **PREENCHER** | Ver passo 4 abaixo |
| `WHATSAPP_APP_SECRET` | **NÃO EXISTE** | Settings > Basic > App Secret (clicar "Show") |
| `WHATSAPP_ACTIVE` | `false` | Mudar para `true` quando pronto |

---

## 4. Como obter o Access Token da Meta — passo a passo

### Pré-requisito: App Meta Business já criada com `855251598377117`

**Opção A — Token Temporário (teste, expira em 24h)**
1. Acede a https://developers.facebook.com/apps/
2. Selecciona a tua app Agency Group
3. No menu esquerdo: **WhatsApp > API Setup**
4. Na secção "Step 1", copia o **Temporary access token**
5. Cola em `WHATSAPP_ACCESS_TOKEN=...`

**Opção B — Token Permanente (produção, recomendado)**
1. Acede a https://business.facebook.com/settings/
2. Menu esquerdo: **Users > System Users**
3. Clica **Add** → Nome: `agencygroup-api` → Role: **Admin**
4. Clica no utilizador criado → **Add Assets**
5. Selecciona: **Apps > Agency Group App** → permissão: `MANAGE`
6. Volta ao utilizador → **Generate New Token**
7. Selecciona a tua App
8. Activa as permissões: `whatsapp_business_messaging` + `whatsapp_business_management`
9. Clica **Generate Token** → copia o valor
10. Cola em `WHATSAPP_ACCESS_TOKEN=<token longo>`

**Onde está o App Secret:**
1. https://developers.facebook.com/apps/ → selecciona a app
2. **Settings > Basic**
3. Campo **App Secret** → clica **Show**
4. Cola em `WHATSAPP_APP_SECRET=<valor>`

---

## 5. O que mudar em .env.local / Vercel para activar

### .env.local (desenvolvimento):
```bash
# Mudar estas duas linhas:
WHATSAPP_ACCESS_TOKEN=<token permanente do passo 4>
WHATSAPP_APP_SECRET=<app secret do passo 4>
WHATSAPP_ACTIVE=true   # ← mudar de false para true
```

### Vercel (produção):
1. https://vercel.com/carlos-feiteiras-projects/agency-group/settings/environment-variables
2. Adicionar/editar:
   - `WHATSAPP_ACCESS_TOKEN` = `<token>`
   - `WHATSAPP_APP_SECRET` = `<app secret>`
   - `WHATSAPP_ACTIVE` = `true`
3. **Redeploy** (necessário para vars de ambiente entrarem em vigor)

### Configurar o Webhook na Meta:
1. https://developers.facebook.com/apps/ → WhatsApp > Configuration
2. **Webhook > Edit**
3. **Callback URL**: `https://www.agencygroup.pt/api/whatsapp/webhook`
4. **Verify Token**: `agwh-d21616b3632a63bb1d28635a04ad9b4c` (já está em `.env.local`)
5. Clica **Verify and Save**
6. Clica **Subscribe** em `messages`

---

## 6. O que `WHATSAPP_ACTIVE=false` desactiva exactamente

**`WHATSAPP_ACTIVE=false` desactiva APENAS as respostas automáticas da Sofia.**

O que continua a funcionar mesmo com `false`:
- Recepção de mensagens via webhook (quando `WHATSAPP_APP_SECRET` estiver configurado)
- Upsert automático de contactos no Supabase CRM
- Logging de mensagens

O que fica desactivado:
- `generateAndSendSofiaReply()` — Sofia não envia resposta automática
- Log mostra: `[WhatsApp] Sofia inactiva (WHATSAPP_ACTIVE=false) — a registar mensagens mas sem resposta automática`

**Envio manual** via `/api/whatsapp/send` (portal) funciona independentemente do flag `WHATSAPP_ACTIVE` — esse flag controla só a resposta automática.

---

## 7. Checklist de activação

- [ ] Obter `WHATSAPP_ACCESS_TOKEN` permanente (Opção B do passo 4)
- [ ] Obter `WHATSAPP_APP_SECRET` (Settings > Basic)
- [ ] Adicionar `WHATSAPP_APP_SECRET` ao `.env.local` e Vercel
- [ ] Actualizar `WHATSAPP_ACCESS_TOKEN` no `.env.local` e Vercel
- [ ] Fazer redeploy em Vercel
- [ ] Configurar webhook URL na Meta Developer Console
- [ ] Testar: enviar mensagem para +351 919 948 986 e confirmar upsert no Supabase
- [ ] Mudar `WHATSAPP_ACTIVE=true` quando confirmares que está tudo correcto
- [ ] Testar resposta automática da Sofia

---

*Gerado em 2026-04-16 | Agency Group Admin*
