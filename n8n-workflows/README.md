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

---

## Workflow C — Dormant Lead Re-engagement

### Propósito

Re-activar leads Tier A/B sem actividade nos últimos 14+ dias. Sofia envia mensagens personalizadas por dormancy level via WhatsApp + Email.

### Trigger

Cron diário às **09:00 Europe/Lisbon** (`0 9 * * *`)

### Lógica de dormancy

| Dias sem actividade | Nível | Estratégia |
|---------------------|-------|------------|
| 14–21 dias | `warm` | Check-in gentil, sem pressão |
| 22–30 dias | `cooling` | Conteúdo de valor: mercado, nova propriedade |
| 31+ dias | `cold` | CTA forte, escassez, alerta de preço |

### Tabelas Supabase necessárias

- `contacts` (campos: `last_activity`, `status`, `tier`, `language_detected`)
- `activities` (campos: `contact_id`, `type`, `description`, `metadata`)
- `automations_log`

### Setup

1. Importa `workflow-c-dormant-lead.json`
2. Confirma credencial `Supabase PostgreSQL` atribuída
3. Confirma credencial `Anthropic API Key Header` (HTTP Header Auth com `x-api-key: sk-ant-...`)
4. Confirma credencial `WhatsApp Bearer Token`
5. Confirma credencial `Resend SMTP`
6. Define `SLACK_WEBHOOK_URL` nas Railway Variables
7. Activa o workflow

### Testar

```bash
# Executa manualmente via n8n UI
# n8n → Workflow C → Execute Manually

# Ou para forçar um contacto dormiente de teste,
# insere um registo no Supabase com last_activity antiga:
# UPDATE contacts SET last_activity = NOW() - INTERVAL '25 days'
# WHERE email = 'test@example.com' AND tier = 'A';
```

Resultado esperado:
- [ ] Query retorna leads dormentes
- [ ] Claude Haiku gera mensagem personalizada por nível
- [ ] WhatsApp e email enviados para cada contacto
- [ ] `activities` table actualizada com `type = 'reengagement_sent'`
- [ ] Slack recebe resumo com contagem por nível
- [ ] `automations_log` registo inserido

---

## Workflow D — Investor Property Alert

### Propósito

Quando uma nova propriedade é recebida via webhook, o algoritmo de matching avalia todos os investidores activos e alerta os qualificados (score >= 60pts) em tempo real.

### Trigger

Webhook POST em `/webhook/new-property`

### Algoritmo de matching (100 pontos)

| Critério | Pontos | Condição |
|----------|--------|----------|
| Budget | 30 | `investor.max_budget >= property.price * 0.9` |
| Zona | 25 | `property.zone` in `investor.preferred_zones` |
| Tipo | 20 | `property.type` in `investor.preferred_types` |
| Yield | 25 | `property.yield >= investor.min_yield * 0.9` |

Score >= 60 → match qualificado e alerta enviado.

### Tabelas Supabase necessárias

- `investor_profiles` (campos: `contact_id`, `is_active`, `max_budget`, `min_budget`, `preferred_zones`, `preferred_types`, `min_yield`, `investment_horizon`, `risk_profile`)
- `contacts`
- `notifications` (campos: `contact_id`, `type`, `title`, `body`, `metadata`, `sent_at`)
- `investment_alerts` (campos: `investor_profile_id`, `property_id`, `match_score`, `match_reasons`, `alerted_at`)
- `activities`

### Setup

1. Importa `workflow-d-investor-alert.json`
2. Confirma todas as credenciais (Supabase, Anthropic, WhatsApp, Resend)
3. Define `SLACK_WEBHOOK_URL`
4. Activa o workflow
5. O webhook fica activo em `https://n8n.agencygroup.pt/webhook/new-property`

### Testar

```bash
# Testa com propriedade real ou fictícia
curl -X POST https://n8n.agencygroup.pt/webhook/new-property \
  -H "Content-Type: application/json" \
  -d '{
    "id": "prop-test-001",
    "title": "Apartamento T3 — Príncipe Real",
    "price": 850000,
    "zone": "Lisboa",
    "type": "apartamento",
    "yield_potential": 4.2,
    "area_m2": 145,
    "opportunity_score": 82,
    "source": "idealista"
  }'
```

Resultado esperado:
- [ ] HTTP 200 com `{ property_id, matches: N, investors_alerted: [...] }`
- [ ] Investidores com score >= 60 recebem WhatsApp + email personalizados
- [ ] Registos em `notifications` e `investment_alerts`
- [ ] Actividade em `activities` para cada investidor alertado
- [ ] Slack recebe mensagem com lista de matches

---

## Workflow E — Weekly Vendor Report

### Propósito

Toda segunda-feira às 08:00, gera e envia relatórios semanais profissionais para todos os vendedores com deals activos. Inclui métricas da semana, posição vs mercado, e próximos passos.

### Trigger

Cron toda segunda-feira às **08:00 Europe/Lisbon** (`0 8 * * 1`)

### Métricas calculadas por deal

- Visitas e inquéritos da semana (via `activities`)
- Nível médio de interesse dos visitantes
- Dias em mercado vs mediana Portugal (210 dias)
- Posição de preço vs mercado por zona (Lisboa €5.000/m², Porto €3.643/m², Algarve €3.941/m², Nacional €3.076/m²)
- Tendência de actividade: forte / moderada / baixa

### Branding do email

- Verde escuro: `#1c4a35`
- Dourado: `#c9a96e`
- 4 KPIs em destaque: Visitas, Inquéritos, Interesse Médio, Posição Preço

### Tabelas Supabase necessárias

- `deals` (campos: `status`, `vendor_contact_id`, `property_id`, `days_on_market`, `vendor_last_contacted`)
- `properties` (campos: `title`, `address`, `zone`, `area_m2`, `price_per_m2`)
- `contacts`
- `activities`
- `vendor_reports` (campos: `deal_id`, `contact_id`, `property_id`, `report_date`, `visits_count`, etc.)
- `market_snapshots` (campos: `deal_id`, `property_id`, `snapshot_date`, métricas semanais)
- `automations_log`

### Setup

1. Importa `workflow-e-vendor-report.json`
2. Confirma todas as credenciais
3. Cria as tabelas `vendor_reports` e `market_snapshots` se não existirem:

```sql
CREATE TABLE IF NOT EXISTS vendor_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  contact_id uuid REFERENCES contacts(id),
  property_id uuid REFERENCES properties(id),
  report_date date NOT NULL,
  visits_count int DEFAULT 0,
  inquiries_count int DEFAULT 0,
  avg_interest_level numeric(3,1),
  days_on_market int,
  price_position_label text,
  price_position_pct int,
  activity_trend text,
  report_html text,
  key_insight text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  property_id uuid REFERENCES properties(id),
  snapshot_date date NOT NULL,
  days_on_market int,
  price numeric,
  price_per_m2 int,
  visits_count int DEFAULT 0,
  inquiries_count int DEFAULT 0,
  avg_interest_level numeric(3,1),
  activity_trend text,
  price_position_pct int,
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, snapshot_date)
);
```

4. Define `SLACK_WEBHOOK_URL`
5. Activa o workflow

### Testar

```bash
# Executa manualmente via n8n UI
# n8n → Workflow E → Execute Manually

# Verifica que existem deals activos com vendor_contact_id preenchido:
# SELECT d.id, d.stage, c.full_name, c.email
# FROM deals d JOIN contacts c ON c.id = d.vendor_contact_id
# WHERE d.status = 'active' LIMIT 5;
```

Resultado esperado:
- [ ] Relatório HTML profissional gerado por Claude Sonnet para cada deal
- [ ] Email com branding AG recebido pelo vendedor
- [ ] WhatsApp summary (<=160 chars) enviado ao vendedor
- [ ] Registo em `vendor_reports`
- [ ] Snapshot em `market_snapshots`
- [ ] `deals.vendor_last_contacted` actualizado
- [ ] Slack recebe resumo com N relatórios enviados

---

## Próximos Workflows a Criar

| ID | Nome | Trigger |
|----|------|---------|
| F | CPCV Assinado — Pós-Venda | Supabase webhook stage = 'cpcv_assinado' |
| G | Lead Score Decay | Cron semanal — reduz score de leads inactivos |
| H | Price Alert — Buyer Match | Webhook preço reduzido → match buyer profiles |
