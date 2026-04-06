# ARQUITECTURA TÉCNICA COMPLETA
## Agency Group Portal v1.0 — 2026-04-06

---

## 1. DIAGRAMA DE ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UTILIZADOR / AGENTE                               │
│                         Browser (Chrome/Safari)                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │  HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERCEL (Edge Network CDN)                            │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    NEXT.JS 16 (App Router)                          │   │
│   │                                                                     │   │
│   │   ┌─────────────────┐    ┌──────────────────────────────────────┐  │   │
│   │   │  React 19 SPA   │    │          API Routes (120+)           │  │   │
│   │   │                 │    │                                      │  │   │
│   │   │  • 35 Portais   │    │  /api/crm        /api/deals          │  │   │
│   │   │  • 9 Stores     │    │  /api/properties /api/signals        │  │   │
│   │   │    Zustand       │    │  /api/activities /api/market-data   │  │   │
│   │   │  • useLiveData  │    │  /api/avm        /api/radar          │  │   │
│   │   │  • dynamic()    │    │  /api/marketing  /api/mortgage       │  │   │
│   │   │    lazy load    │    │  /api/nhr        /api/imt            │  │   │
│   │   │                 │    │  /api/sofia      /api/juridico       │  │   │
│   │   └────────┬────────┘    │  /api/comissoes  /api/investor-pitch │  │   │
│   │            │             │  /api/whatsapp   /api/auth/*         │  │   │
│   │            │             │  /api/push       /api/heygen         │  │   │
│   │            │             └──────────────────────────────────────┘  │   │
│   └────────────┼─────────────────────────────────────────────────────  ┘   │
└────────────────┼────────────────────────────────────────────────────────────┘
                 │
                 │  Chamadas paralelas (Promise.allSettled)
    ┌────────────┼───────────────────────────────────────────────┐
    │            │                                               │
    ▼            ▼            ▼            ▼           ▼         ▼
┌───────┐  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌───────┐  ┌────────┐
│SUPA-  │  │ANTHROPIC│  │WhatsApp│  │  HeyGen  │  │NOTION │  │RESEND  │
│BASE   │  │CLAUDE   │  │Meta API│  │  Avatar  │  │  API  │  │ Email  │
│       │  │   API   │  │        │  │   API    │  │       │  │        │
│Postgre│  │claude-  │  │Send/   │  │Video     │  │Deals/ │  │Trans-  │
│SQL +  │  │sonnet-  │  │Receive │  │Avatar    │  │Contacts│  │actional│
│pgvec- │  │4-5 /    │  │WA msgs │  │Generation│  │Notes  │  │Emails  │
│tor    │  │haiku    │  │        │  │          │  │       │  │        │
│RLS    │  │         │  │        │  │          │  │       │  │        │
└───┬───┘  └─────────┘  └────────┘  └──────────┘  └───────┘  └────────┘
    │
    │  Supabase Realtime (WebSocket)
    ├──────────────────────────────────────────────────────────┐
    │                                                          │
    ▼                                                          ▼
┌────────────────────┐                             ┌──────────────────────┐
│   n8n (Railway)    │                             │ Python Scraper       │
│                    │                             │ (Railway)            │
│  7 Workflows:      │                             │                      │
│  • Lead Inbound    │                             │ Portais externos:    │
│  • Lead Dormiente  │◄────── Triggers ──────────►│ • idealista.pt       │
│  • Visita Follow   │        Cron + WH            │ • imovirtual.com     │
│  • CPCV Alerts     │                             │ • eleiloes.pt        │
│  • Vendor Report   │                             │ • banca (BPI, CGD)   │
│  • Investor Alert  │                             │ • rightmove.co.uk    │
│  • Drip Campaigns  │                             │                      │
└────────────────────┘                             └──────────┬───────────┘
                                                              │
                                                              │ INSERT/UPSERT
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │  Supabase PostgreSQL │
                                                   │  (tabela: properties,│
                                                   │   signals, radar)    │
                                                   └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI/CD — GitHub Actions                             │
│                                                                             │
│   git push → GitHub → Actions (lint + test) → Vercel Deploy → Preview URL  │
│                                                Vercel → Production (main)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CAMADAS DA APLICAÇÃO

### 2.1 Frontend (React 19 / Next.js 16)

#### Estrutura App Router

```
app/
├── portal/
│   ├── page.tsx               ← SPA shell principal (auth + routing)
│   ├── components/            ← 35 componentes de portal
│   │   ├── PortalDashboard    ← carregado eager (secção default)
│   │   ├── PortalCRM          ← lazy (dynamic import)
│   │   ├── PortalPipeline     ← lazy
│   │   ├── PortalAVM          ← lazy
│   │   ├── PortalRadar        ← lazy
│   │   ├── PortalSofia        ← lazy (IA conversacional)
│   │   ├── PortalJuridico     ← lazy
│   │   ├── PortalMarketing    ← lazy
│   │   ├── PortalFinanciamento← lazy
│   │   ├── PortalMortgage     ← lazy
│   │   ├── PortalNHR          ← lazy
│   │   ├── PortalIMT          ← lazy
│   │   ├── PortalComissoes    ← lazy
│   │   ├── PortalMaisvalias   ← lazy
│   │   ├── PortalPortfolio    ← lazy
│   │   ├── PortalInvestorPitch← lazy
│   │   ├── PortalHomestaging  ← lazy
│   │   ├── PortalAgenda       ← lazy
│   │   ├── PortalVisitas      ← lazy
│   │   ├── PortalDocumentos   ← lazy
│   │   ├── PortalImoveis      ← lazy
│   │   ├── PortalCampanhas    ← lazy
│   │   ├── PortalPulse        ← lazy
│   │   ├── PortalExitSim      ← lazy
│   │   ├── PortalCrossCompare ← lazy
│   │   ├── PortalSidebar
│   │   ├── PortalHeader
│   │   ├── PortalBootstrap
│   │   ├── PriceHistoryWidget
│   │   ├── constants.ts       ← CHECKLISTS, PORTAL_PROPERTIES, SECTION_NAMES
│   │   ├── types.ts           ← interfaces TypeScript
│   │   └── utils.ts           ← computeLeadScore, helpers
│   ├── stores/                ← 9 Zustand stores
│   └── hooks/
│       └── useLiveData.ts     ← bootstrap de dados reais
├── api/                       ← 120+ API routes
└── layout.tsx
```

#### 9 Zustand Stores (Estado Global)

| Store | Responsabilidade | Estado principal |
|-------|-----------------|-----------------|
| `useUIStore` | UI global + live data slices | darkMode, section, properties[], signals[], activities[], marketSnapshots[] |
| `useDealStore` | Pipeline + deal management | deals[], activeDeal, pipelineView (lista/kanban), dealTab, riskAnalysis, nego |
| `useCRMStore` | Contactos + visitas + drip | crmContacts[], visitas[], dripCampaigns[], waLang, bulkMode |
| `useAVMStore` | Avaliação automática | 16 parâmetros AVM (zona, tipo, area, estado, epc, andar...) |
| `useMarketingStore` | Marketing IA + Home Staging | mktInput, mktFormat, mktLangs[], hsImage, hsStyle, hsResults[] |
| `useRadarStore` | Radar off-market | searchFontes[], searchZona, searchTipos[], preços — persistido em localStorage |
| `useFinancialStore` | Calculadoras financeiras | mortgage, NHR, IMT, comissões, CMA |
| `usePortfolioStore` | Portfolio + Investor Pitch | portfolioProperties[], ipInvestorType, ipHorizon, ipIrr, ipLang |
| (index.ts) | Barrel export de todos os stores | — |

#### Lazy Loading Strategy

Apenas `PortalDashboard` é carregado eager (sem `dynamic()`). Todos os outros 24+ componentes usam `next/dynamic` com `{ ssr: false }`, garantindo:
- Bundle inicial pequeno (apenas o dashboard necessário ao login)
- Sem renderização server-side de componentes com estado browser (localStorage, WebSpeech API)
- Split automático de chunks por Next.js

---

### 2.2 API Layer (Next.js Route Handlers)

#### Grupos de rotas

**Auth (`/api/auth/`)**
- Magic link por email via Resend
- Google OAuth via next-auth v5 + @auth/supabase-adapter
- 2FA via otpauth (TOTP) + QR code via qrcode
- Push notifications via web-push + VAPID

**CRM (`/api/crm`)**
- GET: leitura com filtro agentId, limit
- POST: criação/actualização contactos
- Smart Import: parsing linguagem natural → campos estruturados via Claude
- Next Step AI: sugestão de próxima acção via Claude

**Deals (`/api/deals`)**
- CRUD pipeline
- Risk Analysis: análise jurídico-financeira via Claude
- Deal Nego: estratégia de negociação via Claude
- Offer via WhatsApp

**Properties (`/api/properties`)**
- Listagem com filtros (zona, tipo, preço máximo)
- UPSERT para scraper externo

**IA/Claude (`/api/sofia`, `/api/avm`, `/api/marketing`, `/api/juridico`, `/api/investor-pitch`, `/api/radar`)**
- Chamadas Anthropic SDK com lazy import
- Modelo: claude-sonnet-4-5 para análise complexa, claude-haiku para respostas rápidas

**Comunicação (`/api/whatsapp`, `/api/push`, `/api/heygen`)**
- WhatsApp: envio de mensagens via Meta Cloud API
- Push: notificações web-push com VAPID
- HeyGen: geração de vídeos com avatar IA

**Financeiro (`/api/mortgage`, `/api/nhr`, `/api/imt`, `/api/comissoes`)**
- Calculadoras fiscais e financeiras portuguesas
- Integração com taxas Euribor em tempo real via INE API (`lib/ine-api.ts`)

**Market Data (`/api/market-data`, `/api/signals`, `/api/activities`)**
- Dados de mercado por zona
- Sinais off-market
- Feed de actividades do agente

---

### 2.3 Data Layer (Supabase PostgreSQL)

#### Arquitectura de dois clientes

```typescript
// lib/supabase.ts

// Cliente browser — anon key, sujeito a RLS
export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Cliente admin — service role key, bypass RLS
// APENAS em API routes — nunca exposto ao browser
export const supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})
```

#### Tabelas principais (`lib/database.types.ts`)

**Schema público** (dados de negócio):

| Tabela | Descrição |
|--------|-----------|
| `contacts` | CRM — leads, prospects, clientes, VIPs |
| `deals` | Pipeline — do contacto à escritura |
| `properties` | Portfólio de imóveis (activos + arquivo) |
| `activities` | Timeline de interacções por contacto |
| `signals` | Sinais off-market detectados pelo Radar |
| `market_data` | Dados de preço por zona/tipo |
| `visitas` | Agendamento e feedback de visitas |
| `tasks` | Tarefas e follow-ups por contacto |
| `drip_campaigns` | Campanhas de email automáticas |
| `documents` | Gestão documental por deal |
| `notifications` | Push notifications pendentes |

**Schema interno** (infra/auth):

| Tabela | Descrição |
|--------|-----------|
| `users` | Utilizadores com roles (admin, agent, viewer) |
| `sessions` | Sessões next-auth |
| `audit_log` | Log de acções para compliance |

#### pgvector (Embeddings)

- Coluna `embedding vector(1536)` nas tabelas `contacts`, `properties`, `signals`
- Utilizado para matching semântico lead↔imóvel
- Consulta via `<=>` (cosine similarity) no Supabase

#### Row Level Security (RLS)

- Agentes apenas vêem os seus próprios contactos e deals (`assigned_to = auth.uid()`)
- Admin tem acesso global
- supabaseAdmin (service role) bypassa RLS para operações de sistema (n8n, scrapers)

#### Camada de abstracção (`lib/db/`)

```
lib/db/
├── contacts.ts    — getContacts(), upsertContact()
├── deals.ts       — getDeals(), upsertDeal()
├── properties.ts  — getProperties() com filtros
├── activities.ts  — log de actividades
├── signals.ts     — sinais off-market
├── market.ts      — snapshots de mercado
└── index.ts       — barrel export
```

#### Cache em memória (`lib/cache.ts`)

Quatro instâncias `MemoryCache` com TTL configurável:

| Cache | Dados | TTL típico |
|-------|-------|-----------|
| `avmCache` | Resultados AVM por zona/tipo/área | 30 min |
| `marketCache` | Dados de mercado por zona | 60 min |
| `ratesCache` | Taxas Euribor INE | 4 horas |
| `radarCache` | Resultados radar por query | 15 min |

---

### 2.4 Automation Layer (n8n + Python)

#### 7 Workflows n8n (Railway)

| Workflow | Trigger | Acção |
|----------|---------|-------|
| Lead Inbound | Webhook WhatsApp | Cria contacto Supabase → notifica agente → envia welcome WA |
| Lead Dormiente | Cron diário 09:00 | Detecta leads sem contacto >14 dias → cria tarefa reactivação |
| Visita Follow-up | Supabase trigger (visita.status=realizada) | Envia feedback request WA → 24h depois summary email |
| CPCV Alerts | Cron diário | Verifica datas CPCV próximas → alerta agente + comprador |
| Vendor Report | Cron semanal | Gera relatório automático para vendedores |
| Investor Alert | Supabase trigger (signal.score>80) | Notifica investidores matching |
| Drip Campaigns | Cron + evento | Envio sequencial de emails via Resend |

#### Python Scraper (Railway)

- Scraping de portais: idealista.pt, imovirtual.com, eleiloes.pt, portais de banca
- Pipeline: extracção → normalização → scoring → INSERT na tabela `properties`/`signals`
- Cron Railway: execução a cada 6 horas
- User agent rotation + rate limiting para evitar bloqueios

#### Cron Jobs (Vercel)

- `/api/cron/market-update` — actualização de dados de mercado INE
- `/api/cron/lead-scoring` — recálculo de lead scores

---

## 3. FLUXOS DE DADOS PRINCIPAIS

### Fluxo 1: Novo Lead Entra via WhatsApp

```
WhatsApp (utilizador)
    │
    ▼ POST webhook
Meta Cloud API
    │
    ▼ Webhook payload
n8n (Railway) — workflow "Lead Inbound"
    │
    ├── [1] Extrai nome, phone, mensagem do payload
    │
    ├── [2] Verifica duplicados → POST /api/crm (upsertContact)
    │         Supabase: INSERT INTO contacts (name, phone, origin='WhatsApp', status='lead')
    │
    ├── [3] Claude via /api/sofia: classifica intenção da mensagem
    │         → extrai budget, zona, tipo de imóvel se mencionado
    │         → actualiza contacto com estes campos
    │
    ├── [4] Calcula lead_score (computeLeadScore) → guarda em contacts.lead_score
    │
    ├── [5] Envia mensagem de boas-vindas WhatsApp (PT/EN/FR/AR consoante phone prefix)
    │
    └── [6] Cria notificação push para agente assigned
              → web-push via VAPID → browser do agente
              → Portal mostra badge em tempo real via Supabase Realtime
```

### Fluxo 2: Agente Cria Deal

```
Agente (Portal browser)
    │
    ▼ useDealStore.setShowNewDeal(true)
PortalPipeline (React)
    │
    ▼ Preenche form: imovel + valor
POST /api/deals
    │
    ├── Valida com Zod schema
    ├── supabaseAdmin.from('deals').upsert({...})
    │     → Gera ref AG-YYYY-NNN
    │     → Define fase inicial: 'Contacto'
    │     → Associa checklist da fase
    │
    ├── captureEvent('deal_created', {ref, valor}) → Sentry
    │
    └── Response { data: Deal }
         │
         ▼ useDealStore.addDeal(deal)
    Estado React actualizado → UI re-render imediato
         │
         ▼ (background, fire-and-forget)
    POST /api/notion ← sincroniza com Notion Deals database
    POST /api/whatsapp ← notifica vendedor (opcional)
```

### Fluxo 3: Sofia Responde a uma Pergunta

```
Agente (PortalSofia — chat interface)
    │
    ▼ digita pergunta → Enter
POST /api/sofia
    │ body: { messages: ChatMessage[], context: { deals, contacts } }
    │
    ├── Rate limit check (lib/rateLimit.ts)
    │     → 20 req/min por IP — retorna 429 se excedido
    │
    ├── Lazy import Anthropic SDK
    │     const { default: Anthropic } = await import('@anthropic-ai/sdk')
    │
    ├── Monta system prompt com contexto:
    │     → perfil Agency Group, AMI 22506, comissão 5%
    │     → deals activos do agente
    │     → dados de mercado actuais (de marketCache)
    │
    ├── anthropic.messages.create({
    │     model: 'claude-sonnet-4-5',
    │     max_tokens: 2048,
    │     system: systemPrompt,
    │     messages: conversationHistory
    │   })
    │
    └── Response streaming/completo → { reply: string }
         │
         ▼ useCRMStore / useUIStore actualiza estado
    Sofia exibe resposta com markdown renderizado
```

### Fluxo 4: Radar Detecta Oportunidade Off-Market

```
Modo A — Análise de URL (agente submete link do idealista)
    │
    ▼
POST /api/radar { url: 'https://idealista.pt/...', mode: 'url' }
    │
    ├── radarCache.get(url) → cache hit? retorna imediatamente
    │
    ├── Scrape metadata do URL (título, preço, zona, área)
    │
    ├── Claude via Anthropic SDK:
    │     → calcula opportunity_score (0-100)
    │     → avalia: preço vs mercado, potencial rendimento, riscos
    │     → classifica: underpriced / off-market / execution_risk
    │
    ├── radarCache.set(url, result, 900) ← 15 min TTL
    │
    └── Response { score, analise, recomendacao, comparables }
         │
         ▼ useRadarStore.setRadarResult(result)
    PortalRadar exibe score + análise detalhada

Modo B — Search (Python Scraper Railway, assíncrono)
    │
    Python scraper corre a cada 6h:
    ├── Scrape idealista, imovirtual, eleiloes, banca
    ├── Normaliza dados → score cada propriedade
    ├── supabaseAdmin.from('signals').upsert(signals com score>65)
    │
    └── n8n "Investor Alert" workflow:
         → Supabase trigger em signals.score > 80
         → Compara com perfis de investidores (budgetMin/Max, zonas, tipos)
         → Envia WhatsApp + push ao agente matching
```

---

## 4. DECISÕES DE ARQUITECTURA

### Next.js 16 como full-stack único

**Decisão:** Uma única aplicação Next.js serve frontend, API routes e cron jobs.

**Razão:** Elimina a necessidade de um backend separado (Express/FastAPI), reduz latência entre UI e API (sem cross-origin), simplifica deploy (Vercel gere tudo), e permite partilha de tipos TypeScript entre client e server. Para uma equipa pequena, a redução de complexidade operacional supera as limitações de scalabilidade de edge functions stateless.

### Zustand em vez de Redux ou Context API

**Decisão:** 9 stores Zustand modulares, sem Provider wrap.

**Razão:** Zustand tem zero boilerplate comparado com Redux Toolkit, sem re-renders desnecessários (subscrições granulares), e funciona fora de componentes React (útil em route handlers e hooks). A modularidade por domínio (CRM, Deals, Financial...) mantém stores pequenos e focados.

### Dois clientes Supabase (anon + service role)

**Decisão:** `supabase` (anon key, RLS activo) para o browser; `supabaseAdmin` (service role, bypass RLS) para API routes.

**Razão:** Segurança por princípio de menor privilégio. O browser nunca tem acesso directo a dados de outros agentes. As API routes validam a sessão do utilizador antes de usar supabaseAdmin, garantindo que o bypass de RLS é controlado e auditado.

### Anthropic SDK com lazy import

**Decisão:** `const { default: Anthropic } = await import('@anthropic-ai/sdk')` dentro dos handlers.

**Razão:** O SDK Anthropic não é necessário em todas as routes. Lazy import reduz o bundle inicial e o tempo de cold start das edge functions em ~200ms. Também permite graceful degradation se a API key não estiver configurada em ambiente de desenvolvimento.

### Mock fallback pattern (useLiveData)

**Decisão:** Dados demo hardcoded nos stores; `useLiveData` tenta carregar dados reais e só substitui os demos se a API responder com sucesso.

**Razão:** O portal é funcional e demonstrável sem Supabase configurado. Isto acelera o desenvolvimento, permite demos a clientes sem dados reais, e torna o sistema resiliente a falhas temporárias de rede. O padrão `Promise.allSettled` garante que uma API em baixo não bloqueia as outras.

### Cache em memória (sem Redis)

**Decisão:** `MemoryCache` em `lib/cache.ts` com TTL em vez de Redis.

**Razão:** Para o volume actual (1 instância Vercel, poucos agentes simultâneos), Redis é over-engineering com custo adicional (~€15/mês). A cache em memória elimina latência de rede, reinicia com cada deploy (o que é aceitável dado o TTL curto dos dados), e tem zero configuração. Se o tráfego escalar para múltiplas instâncias, migrar para Upstash Redis requer apenas substituir a classe `MemoryCache`.

### Rate limiting em memória

**Decisão:** Rate limiter próprio em `lib/rateLimit.ts` com `Map` em vez de biblioteca externa.

**Razão:** Mesma lógica que o cache: sem necessidade de Redis para volume actual. Protege as rotas Claude (custo por token) e auth (brute force) sem dependências adicionais. Auto-prune de entradas expiradas previne memory leaks.

### n8n no Railway em vez de Vercel Cron

**Decisão:** Workflows de automação em n8n (Railway), não em Vercel Cron.

**Razão:** n8n tem interface visual para criar e debugar workflows sem código, suporta triggers de Supabase (webhook realtime), tem retry automático com backoff, e permite que utilizadores não-técnicos ajustem fluxos. Vercel Cron é adequado para jobs simples (market-update, lead-scoring), mas n8n gere lógica de negócio complexa (drip campaigns, matching lead↔imóvel).

---

## 5. PADRÕES DE CÓDIGO

### Fire-and-forget para sincronizações secundárias

Quando uma acção principal (criar deal, actualizar contacto) é concluída, sincronizações secundárias para Notion e WhatsApp são iniciadas sem `await`, para não bloquear a resposta ao utilizador:

```typescript
// API route: /api/deals
const deal = await supabaseAdmin.from('deals').upsert(data)

// Responde ao cliente imediatamente
res.json({ data: deal })

// Sincronizações em background (sem await)
fetch('/api/notion', { method: 'POST', body: JSON.stringify(deal) })
  .catch(err => captureApiError('notion-sync', err))
```

### Estratégia de dois schemas Supabase

- **Schema `public`:** Dados de negócio com RLS — acedido pelo cliente anon
- **Schema interno / service:** Dados de auth e auditoria — acedido apenas via supabaseAdmin

Esta separação garante que mesmo um RLS mal configurado num schema não expõe dados críticos do outro.

### Mock fallback pattern

```typescript
// useLiveData.ts — padrão implementado
const [crmRes, dealsRes, ...] = await Promise.allSettled([
  fetch('/api/crm?limit=100'),
  fetch('/api/deals?limit=100'),
  // ...
])

// Só actualiza o store se a resposta for válida E não vazia
if (crmRes.status === 'fulfilled' && crmRes.value.ok) {
  const { data } = await crmRes.value.json()
  if (data && data.length > 0) {
    setCrmContacts(data) // substitui dados demo
  }
}
// Caso contrário, os dados demo do store mantêm-se
```

### Zustand + localStorage persistence (RadarStore)

O `useRadarStore` persiste preferências do utilizador directamente no `localStorage` sem middleware de persistência:

```typescript
setSearchPrecoMin: (s) => {
  localStorage.setItem('radar_precoMin', s)
  set({ searchPrecoMin: s })
},
```

Inicialização lê do `localStorage` com fallback para valor default:

```typescript
searchPrecoMin: getLS('radar_precoMin', '50000'),
searchTipos: getLSJson<string[]>('radar_tipos', ['apartamento', 'moradia']),
```

O guard `if (typeof window === 'undefined') return fallback` previne erros em SSR.

### Lazy imports para Anthropic SDK

```typescript
// Padrão em todas as API routes com IA
export async function POST(req: Request) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // ...
}
```

---

## 6. SEGURANÇA

### Fluxo de Autenticação

```
Opção A — Magic Link (principal)
    Agente introduz email → /api/auth/magic-link
        → Resend envia email com token único (15 min TTL)
        → Agente clica link → /api/auth/verify
        → Cria sessão JWT → Cookie HttpOnly
        → Redireciona para /portal

Opção B — Google OAuth
    Agente clica "Google" → next-auth v5 OAuth flow
        → @auth/supabase-adapter cria/actualiza user no Supabase
        → Sessão JWT → Cookie HttpOnly

Opção C — 2FA (opcional, para admins)
    Após login inicial → /portal/2fa
        → QR code gerado via lib/qrcode
        → TOTP via lib/otpauth
        → Verificação a cada 30 segundos
```

### Row Level Security (RLS)

Todas as tabelas de negócio têm RLS activo no Supabase:

```sql
-- Exemplo: contacts
CREATE POLICY "agents_own_contacts" ON contacts
  USING (assigned_to = auth.uid());

-- Admin tem acesso total
CREATE POLICY "admin_all_contacts" ON contacts
  USING (auth.jwt() ->> 'role' = 'admin');
```

### Armazenamento de Chaves API

- **Nunca no cliente:** Todas as API keys (ANTHROPIC_API_KEY, WHATSAPP_TOKEN, HEYGEN_API_KEY, RESEND_API_KEY) ficam exclusivamente em variáveis de ambiente server-side no Vercel
- **NEXT_PUBLIC\_\*:** Apenas Supabase URL e anon key (desenhadas para ser públicas)
- **SUPABASE_SERVICE_ROLE_KEY:** Sem prefixo NEXT_PUBLIC — nunca exposta ao browser

### Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/api/sofia` | 20 req | 1 min |
| `/api/avm` | 30 req | 1 min |
| `/api/marketing` | 10 req | 1 min |
| `/api/auth/*` | 5 req | 15 min |
| `/api/radar` | 15 req | 1 min |

Rate limiter em memória por IP (`lib/rateLimit.ts`). Retorna `429 Too Many Requests` com header `Retry-After`.

### Validação de Input

- Todos os bodies de POST são validados com **Zod** antes de qualquer acesso à base de dados
- Schemas definidos inline em cada route handler
- Erros de validação retornam `400 Bad Request` com detalhes dos campos inválidos

---

## 7. PERFORMANCE

### Edge Runtime

As routes de leitura simples (market-data, signals) são candidatas a Edge Runtime (`export const runtime = 'edge'`), minimizando latência via Vercel Edge Network. Routes com dependências Node.js (bcryptjs, web-push) ficam em Node.js runtime standard.

### Lazy Loading de Componentes

Apenas `PortalDashboard` carrega no bundle inicial. Os restantes 24+ componentes são divididos em chunks separados por Next.js dynamic imports. Resultado típico:

- Bundle inicial: ~180KB gzipped
- Cada portal adicional: ~15-40KB gzipped (carregado on-demand ao navegar)
- Primeira pintura do dashboard: <1.5s em rede 4G

### localStorage Caching (Radar)

Preferências de filtro do Radar persistem entre sessões sem round-trip ao servidor. Isto elimina "form amnesia" — o agente retoma exactamente onde parou.

### Cache em Memória para Dados Caros

| Operação | Custo sem cache | Com cache |
|----------|----------------|-----------|
| AVM request | ~2s (Claude API) | <50ms |
| Market data | ~400ms (Supabase) | <5ms |
| Euribor rates | ~600ms (INE API) | <5ms |
| Radar query | ~3s (scrape + Claude) | <50ms |

### pgvector Similarity Search

Matching semântico lead↔imóvel usa índice HNSW no pgvector:

```sql
CREATE INDEX ON properties USING hnsw (embedding vector_cosine_ops);
```

Queries de similarity retornam em <100ms mesmo com 10.000+ imóveis indexados.

### Promise.allSettled para Bootstrap Paralelo

`useLiveData` carrega 6 endpoints simultaneamente em vez de sequencialmente:

- Sem paralelo: ~2.4s (6 × 400ms)
- Com `Promise.allSettled`: ~400ms (limitado pelo endpoint mais lento)

---

## 8. STACK TÉCNICA RESUMIDA

| Camada | Tecnologia | Versão | Propósito |
|--------|-----------|--------|-----------|
| Framework | Next.js | 16.2.1 | App Router, API routes, SSR/SSG |
| Runtime UI | React | 19.2.4 | Componentes, estado local |
| Estado global | Zustand | 5.0.12 | 9 stores modulares |
| Base de dados | Supabase (PostgreSQL) | — | Dados + auth + realtime + embeddings |
| IA | Anthropic Claude | SDK 0.80.0 | Sofia, AVM, Marketing, Jurídico, Radar |
| Auth | next-auth v5 | beta.25 | Magic link + OAuth + 2FA |
| Email | Resend | 6.9.4 | Transaccional + drip campaigns |
| WhatsApp | Meta Cloud API | — | Inbound leads + outbound msgs |
| Avatar IA | HeyGen | — | Vídeos com avatar |
| Notas | Notion API | — | Sincronização deals/contactos |
| Push | web-push + VAPID | 3.6.7 | Notificações browser |
| Automação | n8n (Railway) | — | 7 workflows de negócio |
| Scraping | Python (Railway) | — | Portais imobiliários |
| Monitorização | Sentry | 8.0.0 | Error tracking + APM |
| i18n | next-intl | 3.25.0 | PT/EN/FR/AR/DE |
| Animações | GSAP | 3.14.2 | Transições premium |
| Estilos | Tailwind CSS | 4.x | Utility-first |
| Validação | Zod | 3.24.0 | Schema validation |
| Encriptação | bcryptjs + otpauth | — | Passwords + TOTP 2FA |
| Testes | Vitest + Testing Library | 2.0.0 | Unit + integration |
| Deploy | Vercel | — | CI/CD + Edge Network |
| CI | GitHub Actions | — | Lint + test + deploy |

---

*Documento gerado em 2026-04-06 | Agency Group Portal v1.0 | AMI 22506*
