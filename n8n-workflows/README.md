# n8n Workflows — Agency Group Setup Guide

n8n self-hosted on Railway. Sistema nervoso da automação: lead enrichment, daily briefs, vendor reports, reactivação de leads dormientes.

---

## 1. Deploy n8n no Railway

### Método: Docker (recomendado)

1. Vai a [railway.app](https://railway.app) → New Project → Deploy from Docker Image
2. Imagem: `n8nio/n8n:latest`
3. Porta: `5678`
4. Volume: monta `/home/node/.n8n` para persistência

### Ou via Railway CLI

```bash
railway init
railway up --image n8nio/n8n:latest
```

---

## 2. Environment Variables (Railway)

Define estas variáveis em Railway → Variables:

```env
# n8n Core
N8N_HOST=n8n.agencygroup.pt
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://n8n.agencygroup.pt/

# Segurança
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<senha_forte_aqui>
N8N_ENCRYPTION_KEY=<32_chars_random>

# Timezone
GENERIC_TIMEZONE=Europe/Lisbon
TZ=Europe/Lisbon

# Execuções
EXECUTIONS_PROCESS=main
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336

# Agency Group — IDs operacionais
WHATSAPP_PHONE_ID=<phone_id_da_meta>
CARLOS_PHONE=+351XXXXXXXXX
NOTION_APRENDIZAGENS_DB_ID=d4d4ce407ae14358855d67cc7f28cbb4

# Resend
RESEND_FROM_EMAIL=noreply@agencygroup.pt
```

---

## 3. Supabase — Configurar Webhook

O Workflow A é disparado por INSERT na tabela `contacts` via webhook Supabase.

### Opção A: Supabase Database Webhook (recomendado)

1. Supabase Dashboard → Database → Webhooks → Create Webhook
2. Nome: `lead-enrichment-n8n`
3. Tabela: `contacts`
4. Evento: `INSERT`
5. URL: `https://n8n.agencygroup.pt/webhook/lead-enrichment`
6. HTTP Method: `POST`
7. Headers: `Content-Type: application/json`

### Opção B: Trigger PostgreSQL via n8n Postgres trigger

Alternativa se não usares webhooks Supabase:

```sql
-- Cria function no Supabase SQL Editor
CREATE OR REPLACE FUNCTION notify_new_contact()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://n8n.agencygroup.pt/webhook/lead-enrichment',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := row_to_json(NEW)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_contact_insert
  AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION notify_new_contact();
```

Nota: requer extensão `pg_net` activa no Supabase.

---

## 4. Importar os Workflows

1. Abre n8n: `https://n8n.agencygroup.pt`
2. Menu lateral → Workflows → Import from File
3. Importa por esta ordem:
   - `workflow-a-lead-enrichment.json`
   - `workflow-b-daily-report.json`
4. Cada workflow fica em estado `Inactive` após import — activa manualmente após configurar credenciais

---

## 5. Configurar Credenciais

Em n8n → Settings → Credentials → New Credential:

### Supabase PostgreSQL

- Tipo: `Postgres`
- Nome: `Supabase PostgreSQL`
- Host: `db.<project-ref>.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `<supabase_db_password>`
- SSL: `enabled`

### Anthropic API

- Tipo: `Anthropic`
- Nome: `Anthropic API`
- API Key: `sk-ant-...`

### Resend (SMTP)

- Tipo: `SMTP`
- Nome: `Resend SMTP`
- Host: `smtp.resend.com`
- Port: `465`
- User: `resend`
- Password: `re_...` (Resend API Key)
- SSL: `true`

### WhatsApp (Bearer Token)

- Tipo: `HTTP Header Auth`
- Nome: `WhatsApp Bearer Token`
- Name: `Authorization`
- Value: `Bearer <whatsapp_permanent_token>`

### Clearbit API Key

- Tipo: `HTTP Header Auth`
- Nome: `Clearbit API Key`
- Name: `Authorization`
- Value: `Bearer <clearbit_api_key>`

### Notion API

- Tipo: `Notion API`
- Nome: `Notion API`
- API Key: `secret_...` (Internal Integration Token)

### Slack Bot Token (opcional)

- Tipo: `HTTP Header Auth`
- Nome: `Slack Bot Token`
- Name: `Authorization`
- Value: `Bearer xoxb-...`

---

## 6. Activar Workflows

Após configurar todas as credenciais:

1. Abre cada workflow
2. Verifica que todas as credenciais estão atribuídas (sem ícones de aviso)
3. Clica no toggle "Active" (canto superior direito)
4. Workflow B activa o cron automaticamente — verifica em Settings → Schedule

---

## 7. Testing Checklist

### Workflow A — Lead Enrichment

```bash
# Testa webhook directamente
curl -X POST https://n8n.agencygroup.pt/webhook/lead-enrichment \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test Lead",
    "email": "test@example.com",
    "phone": "+351912345678",
    "source": "website",
    "budget": 750000,
    "zone_interest": "Lisboa",
    "typology": "T3",
    "timeline": "3months",
    "motivation_score": 4,
    "message": "Procuro apartamento T3 em Lisboa para habitação própria"
  }'
```

Resultado esperado:
- [ ] HTTP 200 com `{ status: "success", lead_score: X, routing: "warm"|"hot" }`
- [ ] Novo registo em `contacts` no Supabase
- [ ] Se score >= 70: email de boas-vindas recebido + alerta Slack
- [ ] Se score < 70: email nurture recebido
- [ ] Registo em `automations_log`

### Workflow B — Daily Report

1. n8n → Workflow B → Execute Manually (botão play)
2. Verifica:
   - [ ] Queries Supabase retornam dados (ou arrays vazios sem erro)
   - [ ] Claude Sonnet gera relatório em português
   - [ ] Email recebido em `carlos@agencygroup.pt`
   - [ ] WhatsApp summary recebido no telemóvel
   - [ ] Página criada no Notion Aprendizagens
   - [ ] Log em `automations_log`

### Verificar Cron (Workflow B)

- Cron configurado: `0 8 * * 1-5` (Seg-Sex 08:00 Lisboa)
- Confirma timezone: Railway Variables → `TZ=Europe/Lisbon`
- n8n Settings → Timezone: `Europe/Lisbon`

---

## 8. Monitorização

### Execuções n8n
- n8n → Executions → filtra por workflow
- Erros ficam marcados a vermelho com stack trace

### Logs Railway
```bash
railway logs --tail
```

### Query automations_log (Supabase)
```sql
SELECT workflow, outcome, executed_at
FROM automations_log
ORDER BY executed_at DESC
LIMIT 50;
```

---

## Próximos Workflows a Criar

| ID | Nome | Trigger |
|----|------|---------|
| C | Dormant Lead Reactivation | Cron Ter+Qui 10:00 |
| D | Investor Property Alert | Supabase webhook opportunity_score > 70 |
| E | Weekly Vendor Report | Cron Sábado 09:00 |
| F | CPCV Assinado — Pós-Venda | Supabase webhook stage = 'cpcv_assinado' |
