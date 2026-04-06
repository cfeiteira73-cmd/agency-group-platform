# AGENCY GROUP PORTAL — MASTER BACKUP
## Data: 2026-04-06 | Commit: d8718d8 | Tag: v1.0-backup-2026-04-06

> Este ficheiro documenta TUDO sobre o Agency Group Portal de forma que possa ser reconstruído do zero,
> sem depender de memória humana, histórico de chat ou qualquer outra fonte externa.
> Actualizado em 2026-04-06 com base na leitura directa do código-fonte.

---

## 1. REPOSITÓRIO

| Campo | Valor |
|---|---|
| GitHub URL | `https://github.com/your-org/agency-group` (substituir pela URL real) |
| Branch principal | `main` |
| Tag de backup | `v1.0-backup-2026-04-06` |
| Vercel deploy URL | `https://www.agencygroup.pt` (domínio canonical com www) |
| Vercel preview | `https://agency-group.vercel.app` |

### Como criar a tag de backup no Git
```bash
git tag v1.0-backup-2026-04-06
git push origin v1.0-backup-2026-04-06
```

### Como clonar do zero
```bash
git clone https://github.com/your-org/agency-group.git
cd agency-group
npm install
# Copiar variáveis de ambiente (ver Secção 6)
cp .env.local.example .env.local
# Preencher .env.local com todos os valores (ver lista completa na Secção 6)
npm run dev
# Abrir http://localhost:3000
```

---

## 2. STACK TÉCNICA COMPLETA

### Framework e Runtime
| Tecnologia | Versão | Notas |
|---|---|---|
| Next.js | **16.2.1** | App Router, Server Components, API Routes |
| React | **19.2.4** | Com concurrent features |
| React DOM | **19.2.4** | Igual ao React |
| TypeScript | **^5** (5.x) | Strict mode activado |
| Node.js | **18+** (mínimo) | Usar 20 LTS em produção |
| Tailwind CSS | **^4** (4.x) | PostCSS plugin (`@tailwindcss/postcss`) |

### Dependências de Produção (copiado do package.json)
```json
{
  "@anthropic-ai/sdk": "^0.80.0",
  "@auth/supabase-adapter": "^1.7.4",
  "@sentry/nextjs": "^8.0.0",
  "@supabase/ssr": "^0.5.2",
  "@supabase/supabase-js": "^2.49.4",
  "@types/nodemailer": "^7.0.11",
  "bcryptjs": "^2.4.3",
  "gsap": "^3.14.2",
  "next": "16.2.1",
  "next-auth": "^5.0.0-beta.25",
  "next-intl": "^3.25.0",
  "nodemailer": "^8.0.4",
  "otpauth": "^9.3.6",
  "qrcode": "^1.5.4",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "resend": "^6.9.4",
  "web-push": "^3.6.7",
  "zod": "^3.24.0",
  "zustand": "^5.0.12"
}
```

### Dependências de Desenvolvimento
```json
{
  "@tailwindcss/postcss": "^4",
  "@testing-library/jest-dom": "^6.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/user-event": "^14.0.0",
  "@types/bcryptjs": "^2.4.6",
  "@types/node": "^20",
  "@types/qrcode": "^1.5.5",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "@types/web-push": "^3.6.4",
  "@vitejs/plugin-react": "^4.0.0",
  "eslint": "^9",
  "eslint-config-next": "16.2.1",
  "jsdom": "^25.0.0",
  "tailwindcss": "^4",
  "typescript": "^5",
  "vercel": "^50.37.3",
  "vitest": "^2.0.0"
}
```

### Scripts NPM
```bash
npm run dev          # Servidor de desenvolvimento (http://localhost:3000)
npm run build        # Build de produção
npm run start        # Servidor de produção local
npm run lint         # ESLint
npm run test         # Vitest (testes unitários)
npm run test:ui      # Vitest com UI interactiva
npm run test:coverage # Cobertura de testes
```

### Configuração Next.js (next.config.ts)
- **reactStrictMode**: true
- **Security Headers**: 9 headers de segurança configurados (HSTS, CSP, X-Frame-Options, etc.)
- **Imagens remotas permitidas**: unsplash.com, lh3.googleusercontent.com, *.supabase.co
- **Formatos de imagem**: avif e webp
- **Redirect**: agencygroup.pt → www.agencygroup.pt (permanente, para HSTS preload)
- **CSP connect-src**: Supabase, Anthropic API, Resend, Facebook Graph API, Sentry, Stability AI, Notion API, HeyGen, Browserless, idealista.pt, Twilio

### Crons Vercel (vercel.json)
| Cron | Schedule | Descrição |
|---|---|---|
| `/api/radar/digest` | `0 8 * * *` | Digest diário de oportunidades (08:00 UTC) |
| `/api/market-data/refresh` | `0 3 * * 1` | Refresh semanal de dados de mercado (seg 03:00 UTC) |
| `/api/cron/followups` | `0 9 * * *` | Lembretes diários de follow-up (09:00 UTC) |

---

## 3. TODOS OS COMPONENTES DO PORTAL (35)

O portal vive em `app/portal/page.tsx` e usa um sistema de secções. O componente principal carrega
o `PortalDashboard` de forma eager (síncrona) e todos os outros componentes de forma lazy via
`next/dynamic` com `{ ssr: false }`.

A autenticação é feita via **localStorage magic link** (não NextAuth). O utilizador guarda o email
e nome do agente no localStorage após login.

### Componentes de Estrutura (sempre carregados)
| # | Componente | Ficheiro | O que faz |
|---|---|---|---|
| 1 | `PortalSidebar` | `components/PortalSidebar.tsx` | Barra lateral de navegação com todas as secções. Controla qual secção está activa via `uiStore`. |
| 2 | `PortalHeader` | `components/PortalHeader.tsx` | Cabeçalho do portal com toggle de dark mode, notificações, perfil do agente. |
| 3 | `PortalDashboard` | `components/PortalDashboard.tsx` | Dashboard principal. Secção inicial. Mostra KPIs, pipeline resumido, alertas, market pulse. |
| 4 | `PortalBootstrap` | `components/PortalBootstrap.tsx` | Componente invisível que faz o bootstrap inicial: carrega contacts, deals, properties da DB no arranque. |
| 5 | `PriceHistoryWidget` | `components/PriceHistoryWidget.tsx` | Widget modal/overlay de histórico de preços de uma propriedade específica. |

### Componentes de Funcionalidade (carregados lazily)
| # | Componente | Ficheiro | O que faz | API que chama | Store que usa |
|---|---|---|---|---|---|
| 6 | `PortalAVM` | `components/PortalAVM.tsx` | Avaliação Automática de Imóveis (AVM). Calcula valor de mercado com base em zona, tipo, área, estado, características. | `/api/avm` | `avmStore` |
| 7 | `PortalMortgage` | `components/PortalMortgage.tsx` | Calculadora de crédito habitação. Mostra prestação mensal, TAE, cenários (fixo/variável), tabela de amortização. | `/api/mortgage` | `financialStore` |
| 8 | `PortalNHR` | `components/PortalNHR.tsx` | Calculadora de regime NHR/IFICI. Calcula impostos para novos residentes não-habituais. | `/api/nhr` | `financialStore` |
| 9 | `PortalPipeline` | `components/PortalPipeline.tsx` | Gestão de pipeline de deals. Vista em lista e kanban. Checklist por deal, análise de risco IA, sala de negociação IA. | `/api/deal/risk`, `/api/deal/nego`, `/api/notion/deals` | `dealStore` |
| 10 | `PortalMarketing` | `components/PortalMarketing.tsx` | Geração de conteúdo de marketing com IA. Descrições, redes sociais, anúncios em múltiplas línguas. Análise de fotos, SEO score. | `/api/content`, `/api/properties/analyze-photos` | `marketingStore` |
| 11 | `PortalRadar` | `components/PortalRadar.tsx` | Deal Radar. Analisa URLs de listagens (idealista, imovirtual) ou faz pesquisa por critérios. Enriquecimento com 4 sistemas IA. | `/api/radar`, `/api/radar/search` | `radarStore` |
| 12 | `PortalPortfolio` | `components/PortalPortfolio.tsx` | Comparação de portfólio. Compara múltiplos imóveis lado a lado. Simulador de rendimento. | `/api/portfolio` | `portfolioStore` |
| 13 | `PortalSofia` | `components/PortalSofia.tsx` | Assistente IA Sofia. Chat conversacional para ajuda com qualquer tarefa imobiliária. Suporte de voz. | `/api/sofia/chat`, `/api/sofia/session`, `/api/sofia/speak` | `uiStore` |
| 14 | `PortalJuridico` | `components/PortalJuridico.tsx` | Consultor Jurídico IA. 10 áreas legais: CPCV, escritura, vistos, NHR, IMT, arrendamento, etc. Modo memo (markdown exportável). | `/api/juridico` | — |
| 15 | `PortalAgenda` | `components/PortalAgenda.tsx` | Agenda de visitas e reuniões. Calendário visual. | `/api/visitas`, `/api/booking` | `crmStore` |
| 16 | `PortalDocumentos` | `components/PortalDocumentos.tsx` | Gestão de documentos. Upload, organização por deal, visualização. | `/api/properties` | — |
| 17 | `PortalInvestorPitch` | `components/PortalInvestorPitch.tsx` | Gerador de pitch para investidores. Cria apresentação personalizada por tipo de investidor (private, family office, institutional, HNWI). | `/api/investor-pitch` | `portfolioStore` |
| 18 | `PortalIMT` | `components/PortalIMT.tsx` | Calculadora de IMT (Imposto Municipal sobre Transmissões). Calcula IMT + Imposto de Selo automaticamente. | `/api/imt` | `financialStore` |
| 19 | `PortalComissoes` | `components/PortalComissoes.tsx` | Calculadora de comissões. Simula comissão de 5% com split CPCV/escritura. | `/api/financing` | `financialStore` |
| 20 | `PortalVisitas` | `components/PortalVisitas.tsx` | Gestão de visitas a imóveis. Lista, agenda e estatísticas. Feedback pós-visita com análise IA. Preparação de reunião IA. | `/api/visitas`, `/api/crm/next-step`, `/api/crm/meeting-prep` | `crmStore` |
| 21 | `PortalMaisvalias` | `components/PortalMaisvalias.tsx` | Calculadora de mais-valias imobiliárias. Simula imposto sobre ganhos de capital com coeficientes de desvalorização monetária. | `/api/mais-valias` | `financialStore` |
| 22 | `PortalFinanciamento` | `components/PortalFinanciamento.tsx` | Módulo de financiamento. Análise de soluções de crédito e financiamento alternativo. | `/api/financing` | `financialStore` |
| 23 | `PortalHomestaging` | `components/PortalHomestaging.tsx` | Home staging virtual com IA. Upload de foto de divisão, escolha de estilo e gera versão decorada. Usa Stability AI. | `/api/homestaging` | `marketingStore` |
| 24 | `PortalCRM` | `components/PortalCRM.tsx` | CRM de contactos. Lista/kanban, perfil completo, timeline de actividades, tarefas, matching de imóveis, drip campaigns, WhatsApp. | `/api/contacts`, `/api/crm/*`, `/api/whatsapp/*` | `crmStore` |
| 25 | `PortalExitSim` | `components/PortalExitSim.tsx` | Simulador de saída (exit). Simula retorno de investimento a 3, 5 e 10 anos com cenários bear/base/bull. | `/api/investment` | `dealStore` |
| 26 | `PortalPulse` | `components/PortalPulse.tsx` | Market Pulse. Dados de mercado em tempo real: preços por zona, variações YoY/QoQ, tendências. | `/api/market`, `/api/market-data` | `uiStore` |
| 27 | `PortalImoveis` | `components/PortalImoveis.tsx` | Carteira de imóveis. Gestão de propriedades da agência. Filtros, pesquisa natural language. | `/api/properties`, `/api/properties/search-natural` | `uiStore` |
| 28 | `PortalCampanhas` | `components/PortalCampanhas.tsx` | Gestor de campanhas de marketing. Calendarização de publicações nas redes sociais. | `/api/automation`, `/api/content` | `marketingStore` |
| 29 | `PortalCrossCompare` | `components/PortalCrossCompare.tsx` | Comparação cruzada de imóveis (Comparative Market Analysis). Compara propriedade com comparáveis do mercado. | `/api/properties/cma` | `financialStore` |
| 30 | `PortalVoz` | `components/PortalVoz.tsx` | Interface de voz. Gravação e transcrição de notas de voz. Processamento IA de conversas e reuniões. | `/api/voz`, `/api/crm/voice-note` | — |
| 31 | `PortalCollections` | `components/PortalCollections.tsx` | Colecções de imóveis para clientes. Cria shortlists personalizadas para partilhar com compradores. | `/api/collections`, `/api/track-view` | — |
| 32 | `PortalDraftOffer` | `components/PortalDraftOffer.tsx` | Rascunho de oferta. Gera carta de oferta formal para apresentar ao vendedor. | `/api/draft-offer` | — |
| 33 | `PortalAnalytics` | `components/PortalAnalytics.tsx` | Analytics do portal. Métricas de performance, conversões, tempo de resposta, KPIs comerciais. | `/api/reports`, `/api/activities` | — |
| 34 | `PortalInvestidores` | `components/PortalInvestidores.tsx` | Gestão de investidores. Base de dados de investidores, matching com oportunidades, alertas. | `/api/investors` | — |
| 35 | `PortalOutbound` | `components/PortalOutbound.tsx` | Outbound sales. Sequências de prospecção, templates de mensagens, rastreio de contactos. | `/api/outbound` | — |

### Ficheiros Auxiliares dos Componentes
| Ficheiro | O que faz |
|---|---|
| `components/constants.ts` | Constantes globais: `CHECKLISTS` (itens de checklist por fase), `PORTAL_PROPERTIES` (imóveis de demo), `SECTION_NAMES` (nomes das secções) |
| `components/types.ts` | Tipos TypeScript: `CRMContact`, `Deal`, `JurMsg`, `SectionId`, `Activity`, `Task`, `Drip`, `Visita`, `PortfolioProperty` |
| `components/utils.ts` | Utilitários: `computeLeadScore()` (calcula score de um lead com base nos seus dados) |

---

## 4. TODOS OS API ROUTES (agrupados por domínio)

A pasta `app/api/` contém **50 grupos** de rotas. Total estimado: ~80 ficheiros `route.ts`.

### Autenticação (`/api/auth/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/auth/request` | POST | Envia magic link por email para login sem password |
| `/api/auth/verify` | GET/POST | Verifica token do magic link, cria sessão |
| `/api/auth/send` | POST | Envio de email de autenticação (Resend) |
| `/api/auth/send-reset` | POST | Envio de email de reset de password |
| `/api/auth/confirm-reset` | POST | Confirma reset de password com token |
| `/api/auth/setup-2fa` | POST | Configura autenticação de dois factores (TOTP/QR Code) |
| `/api/auth/check-2fa` | POST | Verifica código TOTP no login |
| `/api/auth/verify-2fa` | POST | Segunda verificação de 2FA |
| `/api/auth/approve` | POST | Aprovação de pedido de acesso (admin) |
| `/api/auth/reject` | POST | Rejeição de pedido de acesso (admin) |
| `/api/auth/complete-onboarding` | POST | Marca onboarding como completo |
| `/api/auth/[...nextauth]` | ALL | NextAuth.js handler (compatibilidade) |
| `/api/auth/nextauth` | ALL | Handler NextAuth alternativo |

### AVM — Avaliação Automática (`/api/avm/`)
| Rota | Método | Campos esperados | Resposta |
|---|---|---|---|
| `/api/avm` | POST | `{ zona, tipo, area, estado, vista, piscina, garagem, epc, andar, orientacao, anoConstr, terraco, casasBanho, uso }` | `{ valorMin, valorMedio, valorMax, precoM2, confianca, comparaveis[], analise }` |

### Radar — Deal Intelligence (`/api/radar/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/radar` | POST | Analisa URL de listagem (idealista/imovirtual). Enriquece com 4 sistemas IA: price intelligence, risk scoring, buyer matching, yield analysis. Cache 6h. Rate limit 30/hora. |
| `/api/radar/search` | POST | Pesquisa de imóveis por critérios (zona, preço min/max, tipos, score mínimo, fontes) |
| `/api/radar/digest` | GET | Cron job: gera digest diário de oportunidades. Activado via Vercel Cron às 08:00 UTC. |
| `/api/radar/history` | GET | Histórico de análises do radar (por agente) |

### Sofia — Assistente IA (`/api/sofia/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/sofia/chat` | POST | Streaming SSE do assistente IA Sofia. Recebe mensagem, responde com Claude API. |
| `/api/sofia/session` | GET/POST | Gestão de sessão de conversa (histórico) |
| `/api/sofia/speak` | POST | TTS: converte resposta em áudio (Web Speech API ou HeyGen) |
| `/api/sofia/script` | POST | Gera script de apresentação/vídeo |

### Jurídico (`/api/juridico/`)
| Rota | Método | Campos | Resposta |
|---|---|---|---|
| `/api/juridico` | POST | `{ area, pergunta, modo }` (área: cpcv/escritura/vistos/nhr/imt/arrendamento/etc.) | `{ resposta, referencias, disclaimer, memo? }` |

### CRM (`/api/crm/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/crm/next-step` | POST | IA sugere próximo passo para um contacto específico |
| `/api/crm/meeting-prep` | POST | IA prepara briefing para reunião com um contacto |
| `/api/crm/email-draft` | POST | IA gera rascunho de email personalizado |
| `/api/crm/extract-contact` | POST | IA extrai dados de contacto de texto livre (smart import) |
| `/api/crm/voice-note` | POST | Transcreve e processa nota de voz sobre um contacto |
| `/api/crm` (route.ts) | GET/POST | CRUD base de contactos |

### Contactos (`/api/contacts/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/contacts` | GET | Lista todos os contactos do agente (Supabase) |
| `/api/contacts` | POST | Cria novo contacto |

### Propriedades (`/api/properties/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/properties` | GET | Lista propriedades da carteira |
| `/api/properties` | POST | Cria nova propriedade |
| `/api/properties/analyze-photos` | POST | Análise de fotos com Claude Vision (qualidade, sugestões de staging) |
| `/api/properties/cma` | POST | Comparative Market Analysis: compara imóvel com comparáveis |
| `/api/properties/db` | GET | Query directa à DB de propriedades |
| `/api/properties/search-natural` | POST | Pesquisa em linguagem natural (ex: "T3 no Chiado até 500k") |

### Deals (`/api/deals/` e `/api/deal/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/deals` | GET/POST | CRUD de deals no Supabase |
| `/api/deal/risk` | POST | Análise de risco de um deal com IA (jurídico, financeiro, timeline) |
| `/api/deal/nego` | POST | Assistente de negociação: sugere estratégia e argumentos |
| `/api/deal` (route.ts) | GET/POST | Handler base de deal |
| `/api/deal` (sub) | — | Sub-rotas adicionais do deal |

### Automação — Workflows (`/api/automation/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/automation/daily-brief` | POST | Gera briefing diário do mercado |
| `/api/automation/dormant-leads` | POST | Re-engagement de leads dormentes |
| `/api/automation/investor-alert` | POST | Alerta de nova oportunidade para investidores |
| `/api/automation/lead-score` | POST | Calcula/actualiza score de um lead |
| `/api/automation/match-buyer` | POST | Matching automático comprador ↔ imóveis |
| `/api/automation/pipeline-advance` | POST | Avança deal no pipeline com validações |
| `/api/automation/signals` | POST | Processa sinais de mercado |
| `/api/automation/vendor-report` | POST | Gera relatório semanal para vendedor |

### WhatsApp (`/api/whatsapp/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/whatsapp/webhook` | GET | Verificação de webhook Meta (verify token: `agencygroup2026`) |
| `/api/whatsapp/webhook` | POST | Recebe mensagens inbound do WhatsApp |
| `/api/whatsapp/send` | POST | Envia mensagem WhatsApp via API Meta |
| `/api/whatsapp/test` | GET/POST | Teste de conectividade WhatsApp |

### Notion (`/api/notion/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/notion/deals` | GET/POST | Sincroniza deals com base Notion |
| `/api/notion/contacts` | GET/POST | Sincroniza contactos com base Notion |
| `/api/notion/properties` | GET/POST | Sincroniza propriedades com Notion |
| `/api/notion/seed` | POST | Seed inicial de dados no Notion |

### HeyGen — Vídeos IA (`/api/heygen/`)
| Rota | Método | O que faz |
|---|---|---|
| `/api/heygen/session` | POST | Cria sessão de avatar interactivo HeyGen |
| `/api/heygen/ice` | POST | ICE candidates para WebRTC |
| `/api/heygen/start` | POST | Inicia streaming de avatar |
| `/api/heygen/task` | POST | Envia tarefa/fala ao avatar |

### Financeiro
| Rota | Método | O que faz |
|---|---|---|
| `/api/mortgage` | POST | Calcula crédito habitação: prestação, TAE, cenários, amortização |
| `/api/nhr` | POST | Calcula regime NHR/IFICI: taxa efectiva, savings vs regime normal |
| `/api/imt` | POST | Calcula IMT + Imposto de Selo por tipo (HPP, second home, investimento) |
| `/api/mais-valias` | POST | Calcula mais-valias: ganho bruto, coeficiente monetário, imposto |
| `/api/financing` | POST | Análise de financiamento e comissões |
| `/api/rates` | GET | Taxas Euribor actuais (3M, 6M, 12M) via INE API |

### Outros Módulos
| Rota | Método | O que faz |
|---|---|---|
| `/api/market` | GET/POST | Dados de mercado por zona (preços/m², variações) |
| `/api/market-data/refresh` | POST | Cron: actualiza dados de mercado semanalmente |
| `/api/market-data/cache` | GET | Devolve dados de mercado em cache |
| `/api/signals` | GET/POST | Sinais de mercado (price drops, novas listagens, etc.) |
| `/api/reports` | POST | Gera relatórios PDF/markdown de performance |
| `/api/activities` | GET/POST | Log de actividades (chamadas, emails, visitas) |
| `/api/alerts` | GET/POST | Alertas e notificações do sistema |
| `/api/notifications` | GET/POST | Notificações push e in-app |
| `/api/push` | POST | Envia push notification via Web Push (VAPID) |
| `/api/push` | GET | Subscrição de push notifications |
| `/api/investment` | POST | Simulador de investimento: IRR, yield, exit scenarios |
| `/api/investor-pitch` | POST | Gera pitch deck para investidor |
| `/api/investors` | GET/POST | Base de dados de investidores |
| `/api/portfolio` | POST | Análise comparativa de portfólio |
| `/api/off-market` | GET/POST | Oportunidades off-market |
| `/api/content` | POST | Geração de conteúdo marketing (copy, hashtags, agendamento) |
| `/api/homestaging` | POST | Home staging virtual com Stability AI |
| `/api/collections` | GET/POST | Colecções de imóveis para partilha com clientes |
| `/api/track-view` | POST | Rastreia visualizações de colecções (analytics) |
| `/api/draft-offer` | POST | Gera carta de oferta formal |
| `/api/outbound` | POST | Sequências de prospecção outbound |
| `/api/visitas` | GET/POST | Gestão de visitas a imóveis |
| `/api/booking` | POST | Agendamento de visita |
| `/api/voz` | POST | Processamento de voz: transcrição + análise |
| `/api/chat` | POST | Chat genérico (não Sofia) |
| `/api/learn` | GET/POST | Módulo de aprendizagem/formação |
| `/api/agent` | GET/POST | Dados do agente autenticado |
| `/api/admin` | GET/POST | Funcionalidades de administração |
| `/api/cron/followups` | GET | Cron diário: lembretes de follow-up |
| `/api/health` | GET | Health check: `{ status, counts: { contacts, properties, deals } }` |
| `/api/sentry-test` | GET | Testa integração Sentry |
| `/api/test-smtp` | GET | Testa configuração SMTP/Resend |

---

## 5. TODOS OS STORES ZUSTAND (9)

O estado global do portal é gerido por 9 stores Zustand v5. Cada store está em `app/portal/stores/`.
O ficheiro `stores/index.ts` exporta todos os stores de forma centralizada.

### 1. `uiStore` (`stores/uiStore.ts`)
**O que guarda:** Estado de interface e dados live do sistema.

| Campo | Tipo | Valor inicial | Descrição |
|---|---|---|---|
| `darkMode` | boolean | `true` | Modo escuro (padrão: ligado) |
| `sidebarOpen` | boolean | `false` | Sidebar aberta/fechada |
| `section` | `SectionId` | `'dashboard'` | Secção activa do portal |
| `showNotifPanel` | boolean | `false` | Painel de notificações visível |
| `fabOpen` | boolean | `false` | FAB (floating action button) aberto |
| `cmdkOpen` | boolean | `false` | Command palette (Cmd+K) aberta |
| `cmdkQuery` | string | `''` | Query na command palette |
| `properties` | unknown[] | `[]` | Propriedades carregadas live |
| `signals` | unknown[] | `[]` | Sinais de mercado live |
| `activities` | unknown[] | `[]` | Actividades recentes |
| `marketSnapshots` | unknown[] | `[]` | Snapshots de mercado |

### 2. `dealStore` (`stores/dealStore.ts`)
**O que guarda:** Pipeline de deals e estado de negociação.

| Campo | Tipo | Descrição |
|---|---|---|
| `deals` | `Deal[]` | Lista de deals (começa com 3 deals de demo) |
| `activeDeal` | `number \| null` | ID do deal actualmente seleccionado |
| `showNewDeal` | boolean | Modal de novo deal visível |
| `newDeal` | `{ imovel, valor }` | Campos do formulário de novo deal |
| `pipelineView` | `'lista' \| 'kanban'` | Vista do pipeline |
| `pipelineSearch` | string | Pesquisa no pipeline |
| `dealTab` | `'checklist' \| 'investor' \| 'dealroom' \| 'timeline' \| 'nego' \| 'documentos'` | Tab activa no detalhe do deal |
| `dealRiskLoading` | boolean | A analisar risco do deal |
| `dealRiskAnalysis` | object \| null | Resultado da análise de risco |
| `dealNegoLoading` | boolean | A gerar estratégia de negociação |
| `dealNego` | object \| null | Estratégia de negociação IA |
| `makeOfferOpen` | boolean | Modal "fazer oferta" aberto |
| `offerMsg` | string | Mensagem da oferta |
| `dealRoomMsg` | string | Mensagem na sala de negociação |
| `investorData` | `{ rendaMensal, apreciacao, horizonte, ltv, spread }` | Dados para simulação de investimento |
| `invScenario` | `'bear' \| 'base' \| 'bull'` | Cenário de simulação |
| `taxRegime` | `'standard' \| 'ifici'` | Regime fiscal |
| `tipoImovelInv` | `'residencial' \| 'comercial'` | Tipo de imóvel para investimento |

**Deals de demo iniciais:**
- AG-2026-001: Villa Quinta da Marinha · Cascais — €3.800.000 — CPCV Assinado (James Whitfield)
- AG-2026-002: Penthouse Chiado · Lisboa — €2.100.000 — Due Diligence (Sophie Laurent)
- AG-2026-003: Herdade Comporta · Grândola — €6.500.000 — Proposta Aceite (Khalid Al-Rashid)

### 3. `crmStore` (`stores/crmStore.ts`)
**O que guarda:** Estado completo do CRM de contactos.

| Campo | Tipo | Descrição |
|---|---|---|
| `crmContacts` | `CRMContact[]` | Lista de todos os contactos |
| `crmSearch` | string | Pesquisa no CRM |
| `activeCrmId` | `number \| null` | Contacto activo no perfil |
| `crmProfileTab` | `'overview' \| 'timeline' \| 'tasks' \| 'notes' \| 'matching' \| 'postclosing'` | Tab no perfil do contacto |
| `crmBulkMode` | boolean | Modo de selecção múltipla |
| `crmSelectedIds` | `Set<number>` | IDs seleccionados em bulk |
| `crmView` | `'list' \| 'kanban'` | Vista do CRM |
| `crmNatFilter` | string | Filtro por nacionalidade |
| `crmZonaFilter` | string | Filtro por zona |
| `crmStatusFilter` | string | Filtro por status |
| `showNewContact` | boolean | Modal novo contacto visível |
| `showWaModal` | boolean | Modal WhatsApp visível |
| `waLang` | `'PT' \| 'EN' \| 'FR' \| 'DE' \| 'AR'` | Língua da mensagem WhatsApp |
| `voiceActive` | boolean | Modo de entrada por voz activo |
| `smartImportLoading` | boolean | A processar smart import de contacto |
| `dripCampaigns` | `Drip[]` | Campanhas drip activas |
| `visitas` | `Visita[]` | Lista de visitas agendadas |
| `visitasTab` | `'lista' \| 'agenda' \| 'stats'` | Tab activa nas visitas |
| `crmNextStep` | object \| null | Próximo passo sugerido pela IA |
| `meetingPrep` | object \| null | Briefing de reunião gerado pela IA |

### 4. `avmStore` (`stores/avmStore.ts`)
**O que guarda:** Estado do formulário e resultado da Avaliação Automática de Imóveis.

| Campo | Tipo | Descrição |
|---|---|---|
| `avmResult` | object \| null | Resultado da avaliação (valorMin, valorMedio, valorMax, precoM2, comparáveis) |
| `avmLoading` | boolean | A calcular avaliação |
| `avmZona` | string | Zona geográfica |
| `avmTipo` | string | Tipo de imóvel |
| `avmArea` | string | Área em m² |
| `avmEstado` | string | Estado de conservação |
| `avmVista` | string | Tipo de vista (mar, jardim, cidade, etc.) |
| `avmPiscina` | string | Tem piscina |
| `avmGaragem` | string | Tem garagem |
| `avmEpc` | string | Certificado energético (A, B, C, etc.) |
| `avmAndar` | string | Andar |
| `avmOrientacao` | string | Orientação solar |
| `avmAnoConstr` | string | Ano de construção |
| `avmTerraco` | string | Tem terraço |
| `avmCasasBanho` | string | Número de casas de banho |
| `avmUso` | string | Uso (habitação/investimento) |

### 5. `marketingStore` (`stores/marketingStore.ts`)
**O que guarda:** Estado do módulo de marketing e home staging.

| Campo | Tipo | Descrição |
|---|---|---|
| `mktInput` | `{ zona, tipo, area, preco, quartos, features, descricao }` | Dados do imóvel para gerar marketing |
| `mktFormat` | string | Formato de output (instagram, facebook, email, etc.) |
| `mktLang` | string | Língua principal do conteúdo |
| `mktLangs` | string[] | Lista de línguas seleccionadas |
| `mktResult` | object \| null | Conteúdo gerado pela IA |
| `mktPersona` | string | Persona do comprador alvo |
| `mktPhotos` | string[] | Fotos do imóvel (base64 ou URL) |
| `mktSeoScore` | number \| null | Score SEO do conteúdo gerado |
| `mktPhotoInsights` | string \| null | Insights das fotos (análise IA) |
| `mktPostingSchedule` | object \| null | Calendário de publicações sugerido |
| `hsImage` | string \| null | Imagem para home staging (base64) |
| `hsStyle` | string | Estilo de decoração desejado |
| `hsRoomType` | string | Tipo de divisão |
| `hsVariations` | number | Número de variações a gerar |
| `hsStrength` | number | Força da transformação (0-1) |
| `hsResults` | `{ base64, seed }[]` | Imagens geradas pelo Stability AI |

### 6. `radarStore` (`stores/radarStore.ts`)
**O que guarda:** Estado do Deal Radar e pesquisa de oportunidades.

| Campo | Tipo | Descrição |
|---|---|---|
| `radarResult` | object \| null | Resultado da análise de URL |
| `radarLoading` | boolean | A analisar URL |
| `radarUrl` | string | URL da listagem a analisar |
| `radarMode` | `'url' \| 'search'` | Modo: analisar URL ou pesquisar |
| `searchZona` | string | Zona de pesquisa (default: 'Lisboa') |
| `searchPrecoMin` | string | Preço mínimo (guardado em localStorage) |
| `searchPrecoMax` | string | Preço máximo (guardado em localStorage) |
| `searchTipos` | string[] | Tipos de imóvel (guardado em localStorage) |
| `searchScoreMin` | string | Score mínimo (default: '65', localStorage) |
| `searchFontes` | string[] | Fontes de dados (default: idealista, imovirtual, eleiloes, banca) |
| `searchResults` | object \| null | Resultados da pesquisa |
| `showHeatMap` | boolean | Mostrar mapa de calor |

**Nota:** Os valores de pesquisa são persistidos em `localStorage` automaticamente.

### 7. `financialStore` (`stores/financialStore.ts`)
**O que guarda:** Estado de todos os módulos financeiros (mortgage, NHR, IMT, comissões, CMA).

Grupos de campos:
- **Mortgage**: `mortResult`, `mortLoading`, `mortSpreadVal`, `mortMontante`, `mortEntrada`, `mortPrazo`, `mortUso`, `mortRendimento`, `mortSubTab`
- **NHR**: `nhrResult`, `nhrLoading`, `nhrPais`, `nhrTipo`, `nhrRend`, `nhrFonte`, `nhrSubTab`
- **IMT**: `imtValor`, `imtTipo`, `imtComprador`, `imtResult`, `imtLoading`
- **Comissões**: `commLoading`, `commResult`
- **CMA**: `cmaLoading`, `cmaResult`, `cmaPropertyId`

### 8. `portfolioStore` (`stores/portfolioStore.ts`)
**O que guarda:** Estado do módulo de portfólio e investor pitch.

| Campo | Tipo | Descrição |
|---|---|---|
| `portItems` | string[] | Imóveis seleccionados para comparar (default: 2 slots vazios) |
| `portResult` | object \| null | Resultado da comparação |
| `portfolioProperties` | `PortfolioProperty[]` | Propriedades no portfólio |
| `portfolioTab` | `'comparar' \| 'simulador'` | Tab activa no portfólio |
| `ipProperty` | string | Imóvel para gerar investor pitch |
| `ipInvestorType` | `'private' \| 'family_office' \| 'institutional' \| 'hnwi'` | Tipo de investidor |
| `ipHorizon` | `3 \| 5 \| 10` | Horizonte de investimento (anos) |
| `ipIrr` | `8 \| 12 \| 15 \| 20` | IRR alvo (%) |
| `ipLang` | `'PT' \| 'EN' \| 'FR' \| 'AR'` | Língua do pitch |
| `ipResult` | object \| null | Pitch gerado pela IA |

### 9. `marketingStore` — Home Staging (parte do mesmo store)
Ver secção marketingStore acima (campos `hs*`).

---

## 6. SERVIÇOS EXTERNOS (26 integrações)

### Variáveis de Ambiente Necessárias (ficheiro `.env.local`)

```bash
# ─── SUPABASE ──────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
# Como obter: supabase.com → Projecto → Settings → API

# ─── ANTHROPIC (Claude AI) ─────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
# Como obter: console.anthropic.com → API Keys
# Modelo usado: claude-opus-4 / claude-sonnet-4 (selecção automática por tarefa)

# ─── AUTENTICAÇÃO ──────────────────────────────────────────────────────
NEXTAUTH_SECRET=<32+ chars random string>
NEXTAUTH_URL=https://www.agencygroup.pt
# Gerar: openssl rand -base64 32

# ─── RESEND (Email) ────────────────────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@agencygroup.pt
# Como obter: resend.com → API Keys

# ─── SENTRY (Monitoring) ───────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://...@o...ingest.sentry.io/...
SENTRY_ORG=agency-group
SENTRY_PROJECT=portal
SENTRY_AUTH_TOKEN=sntrys_...
# Como obter: sentry.io → Settings → Projects → DSN

# ─── WHATSAPP BUSINESS API ─────────────────────────────────────────────
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...    # Token permanente (System User)
WHATSAPP_ACTIVE=true
# Como obter: developers.facebook.com → App → WhatsApp → API Setup
# Webhook verify token: agencygroup2026 (hardcoded)

# ─── NOTION ────────────────────────────────────────────────────────────
NOTION_API_KEY=secret_...
NOTION_DEALS_DB=b5693a14ca8c43fa8645606363594662
NOTION_MESSAGES_DB=cc52c0eba2df4649ae2b1cb45bb83513
NOTION_REELS_DB=f03b534cef7b40fab423e440ca09f997
NOTION_LEARNINGS_DB=d4d4ce407ae14358855d67cc7f28cbb4
# Como obter: notion.so → Integrations → New Integration

# ─── HEYGEN (Avatar IA) ────────────────────────────────────────────────
HEYGEN_API_KEY=...
# Como obter: app.heygen.com → API → Keys
# ESTADO: Pendente (não está em produção ainda)

# ─── STABILITY AI (Home Staging) ───────────────────────────────────────
STABILITY_API_KEY=sk-...
# Como obter: platform.stability.ai → API Keys

# ─── GOOGLE OAUTH (NextAuth) ───────────────────────────────────────────
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
# Como obter: console.cloud.google.com → Credenciais → OAuth 2.0

# ─── WEB PUSH (Notificações Push) ──────────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tech@agencygroup.pt
# Gerar: npx web-push generate-vapid-keys

# ─── SMTP / NODEMAILER (fallback de email) ─────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@agencygroup.pt
SMTP_PASS=...

# ─── BROWSERLESS (Web Scraping) ────────────────────────────────────────
BROWSERLESS_TOKEN=...
# Como obter: browserless.io → Dashboard → API Token
# Usado para scraping de listagens (idealista, imovirtual)

# ─── INTERNAL API ──────────────────────────────────────────────────────
INTERNAL_API_SECRET=<random string>
# Usado pelos workflows n8n para autenticar chamadas à API do portal

# ─── PORTAL CONFIG ─────────────────────────────────────────────────────
NEXT_PUBLIC_PORTAL_URL=https://www.agencygroup.pt
NODE_ENV=production
```

### Tabela Resumo de Serviços
| # | Serviço | Variável ENV | Link | O que faz |
|---|---|---|---|---|
| 1 | Supabase | `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` + `SERVICE_ROLE_KEY` | supabase.com | Base de dados PostgreSQL + Auth + Storage |
| 2 | Anthropic (Claude) | `ANTHROPIC_API_KEY` | console.anthropic.com | Motor IA de todo o portal (Sofia, AVM, Jurídico, Marketing, etc.) |
| 3 | Resend | `RESEND_API_KEY` | resend.com | Envio de emails transaccionais (magic links, relatórios) |
| 4 | Sentry | `NEXT_PUBLIC_SENTRY_DSN` | sentry.io | Monitoring de erros em produção |
| 5 | WhatsApp Business API | `WHATSAPP_*` | developers.facebook.com | Envio/recepção de mensagens WhatsApp |
| 6 | Notion | `NOTION_API_KEY` | notion.so | Sincronização de deals, mensagens, reels, aprendizagens |
| 7 | HeyGen | `HEYGEN_API_KEY` | app.heygen.com | Avatar IA interactivo (streaming WebRTC) |
| 8 | Stability AI | `STABILITY_API_KEY` | platform.stability.ai | Home staging virtual (Image-to-Image) |
| 9 | Google OAuth | `GOOGLE_CLIENT_ID` + `SECRET` | console.cloud.google.com | Login com Google (NextAuth) |
| 10 | Web Push (VAPID) | `VAPID_*` | — | Push notifications no browser |
| 11 | Browserless | `BROWSERLESS_TOKEN` | browserless.io | Scraping headless de listagens imobiliárias |
| 12 | NextAuth.js | `NEXTAUTH_SECRET` | next-auth.js.org | Framework de autenticação |
| 13 | Nodemailer/SMTP | `SMTP_*` | — | Fallback de envio de email |
| 14 | n8n | — | n8n.io | Orquestração de workflows de automação |
| 15 | Railway | — | railway.app | Hosting de n8n e Python scraper |
| 16 | Vercel | — | vercel.com | Hosting do portal Next.js |
| 17 | GitHub | — | github.com | Repositório de código |
| 18 | INE API | — | ine.pt | Dados oficiais de taxas Euribor e estatísticas imobiliárias |
| 19 | Meta Graph API | `WHATSAPP_ACCESS_TOKEN` | graph.facebook.com | API WhatsApp e anúncios |
| 20 | idealista.pt | — | idealista.pt | Fonte de dados de listagens (scraping via Browserless) |
| 21 | imovirtual.com | — | imovirtual.com | Fonte de dados de listagens (scraping) |
| 22 | Euribor/leilões | — | eleiloes.pt | Dados de leilões de imóveis |
| 23 | GSAP | (npm) | greensock.com | Animações de UI |
| 24 | Zod | (npm) | zod.dev | Validação de schemas nas API routes |
| 25 | next-intl | (npm) | next-intl.dev | Internacionalização (PT/EN/FR/DE/ZH/AR) |
| 26 | OTPAuth | (npm) | — | TOTP para autenticação 2FA |

---

## 7. BASE DE DADOS

### Supabase Project
- **URL format**: `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
- **Region recomendada**: `eu-west-1` (Frankfurt) para menor latência desde Portugal
- **Plan**: Free tier durante desenvolvimento; Pro ($25/mês) para produção

### Tabelas (Schema Completo)

#### Tabela: `contacts`
```sql
id            UUID          PRIMARY KEY (gen_random_uuid())
agent_email   TEXT          NOT NULL
name          TEXT          NOT NULL
email         TEXT
phone         TEXT
nationality   TEXT
budget_min    BIGINT        DEFAULT 0
budget_max    BIGINT        DEFAULT 0
tipos         TEXT[]        DEFAULT '{}'
zonas         TEXT[]        DEFAULT '{}'
status        TEXT          CHECK (IN: 'vip','cliente','prospect','lead')
notes         TEXT          DEFAULT ''
last_contact  TEXT
next_follow_up TEXT
deal_ref      TEXT
origin        TEXT          DEFAULT 'manual'
created_at    TIMESTAMPTZ   DEFAULT NOW()
```

#### Tabela: `deals`
```sql
id              UUID          PRIMARY KEY
agent_email     TEXT          NOT NULL
ref             TEXT          UNIQUE (e.g. "AG-2026-001")
imovel          TEXT          (descrição do imóvel)
valor           TEXT          (e.g. "€ 1.250.000")
fase            TEXT          (e.g. "CPCV Assinado")
comprador       TEXT          (nome do comprador)
checklist       JSONB         DEFAULT '{}'
notas           TEXT
cpcv_date_text  TEXT
escritura_date_text TEXT
contact_id      UUID          REFERENCES contacts(id) [nullable após migration 003]
title           TEXT          [nullable após migration 003]
notes           TEXT          DEFAULT ''
created_at      TIMESTAMPTZ   DEFAULT NOW()
```

#### Tabela: `properties`
```sql
id            UUID          PRIMARY KEY
ref           TEXT          UNIQUE
nome          TEXT          NOT NULL
zona          TEXT          NOT NULL
bairro        TEXT
tipo          TEXT          NOT NULL
preco         BIGINT/DECIMAL NOT NULL
area          INTEGER/DECIMAL
quartos       INTEGER       DEFAULT 0
casas_banho   INTEGER       DEFAULT 0
andar         TEXT
energia       TEXT
vista         TEXT
piscina       BOOLEAN       DEFAULT false
garagem       BOOLEAN       DEFAULT false
jardim        BOOLEAN       DEFAULT false
terraco       BOOLEAN       DEFAULT false
condominio    BOOLEAN       DEFAULT false
badge         TEXT
status        TEXT          DEFAULT 'Ativo'
desc          TEXT
features      TEXT[]        DEFAULT '{}'
tour_url      TEXT
gradient      TEXT          (cor de gradiente para UI)
agent_email   TEXT
created_at    TIMESTAMPTZ   DEFAULT NOW()
```

#### Tabela: `profiles` (Migration 002)
```sql
id          UUID    PRIMARY KEY (references auth.users)
full_name   TEXT
avatar_url  TEXT
role        TEXT    CHECK (IN: 'admin','agent','viewer') DEFAULT 'agent'
agency_id   TEXT
phone       TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

#### Tabela: `activities` (Migration 002)
```sql
id          UUID    PRIMARY KEY
type        TEXT    CHECK (IN: 'call','whatsapp','email','visit','note','proposal','cpcv','meeting','task')
contact_id  UUID    REFERENCES contacts(id)
deal_id     UUID    REFERENCES deals(id)
agent_id    UUID    REFERENCES auth.users(id)
note        TEXT
duration    INT     (minutos)
outcome     TEXT
created_at  TIMESTAMPTZ
```

#### Tabela: `visits` (Migration 002)
```sql
id              UUID    PRIMARY KEY
property_id     INT     REFERENCES properties(id)
contact_id      UUID    REFERENCES contacts(id)
deal_id         UUID    REFERENCES deals(id)
agent_id        UUID    REFERENCES auth.users(id)
scheduled_at    TIMESTAMPTZ NOT NULL
status          TEXT    CHECK (IN: 'agendada','realizada','cancelada','reagendada')
interest_score  INT     CHECK (1-5)
notes           TEXT
feedback        TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### Tabela: `notifications` (Migration 002)
```sql
id          UUID    PRIMARY KEY
agent_id    UUID    REFERENCES auth.users(id)
type        TEXT    CHECK (IN: 'deal_alert','follow_up','system','lead_hot','cpcv_due','escritura_due')
title       TEXT    NOT NULL
message     TEXT    NOT NULL
priority    TEXT    CHECK (IN: 'low','normal','high','critical') DEFAULT 'normal'
read        BOOLEAN DEFAULT false
link        TEXT
deal_id     UUID    REFERENCES deals(id)
contact_id  UUID    REFERENCES contacts(id)
created_at  TIMESTAMPTZ
```

#### Tabela: `signals` (Migration 002)
```sql
id              UUID    PRIMARY KEY
type            TEXT    CHECK (IN: 'price_drop','new_listing','sold_comparable','dre_permit','zone_trend','off_market')
title           TEXT    NOT NULL
description     TEXT
zone            TEXT
property_id     INT     REFERENCES properties(id)
source          TEXT
source_url      TEXT
priority        TEXT    CHECK (IN: 'low','medium','high','urgent') DEFAULT 'medium'
status          TEXT    CHECK (IN: 'new','read','actioned','dismissed') DEFAULT 'new'
agent_id        UUID    REFERENCES auth.users(id)
data            JSONB
created_at      TIMESTAMPTZ
```

#### Tabela: `market_snapshots` (Migration 002)
```sql
id              UUID    PRIMARY KEY
zona            TEXT    NOT NULL
preco_medio     NUMERIC(12,2)
variacao_anual  NUMERIC(5,2)
transacoes      INT
dias_mercado    INT
yield_medio     NUMERIC(5,2)
snapshot_date   DATE    DEFAULT current_date
source          TEXT    DEFAULT 'manual'
```

### Ficheiros de Migration
| Ficheiro | Descrição | Estado |
|---|---|---|
| `supabase/schema.sql` | Schema base inicial (contacts, deals, properties + RLS) | Referência |
| `supabase/rls-policies.sql` | Políticas RLS separadas | Referência |
| `supabase/migrations/001_initial_check.sql` | Verifica tabelas existentes | Executar 1º |
| `supabase/migrations/001_initial_schema.sql` | Schema inicial v1 | Executar 2º |
| `supabase/migrations/002_missing_tables.sql` | Cria profiles, activities, visits, notifications, signals, market_snapshots | Executar 3º |
| `supabase/migrations/002_seed_properties.sql` | Seed de propriedades de demo | Executar 4º |
| `supabase/migrations/003_portal_compat.sql` | Compatibilidade portal: adiciona colunas imovel, valor, fase, comprador, ref aos deals; adiciona nome, zona, gradient às properties | Executar 5º |

### Seed Scripts
```bash
node scripts/seed-supabase.js          # Seed de contactos e deals
node scripts/seed-properties-deals.js  # Seed de propriedades
```

### Índices de Performance
```sql
CREATE INDEX idx_contacts_agent ON contacts(agent_email);
CREATE INDEX idx_deals_agent ON deals(agent_email);
CREATE INDEX idx_properties_zona ON properties(zona);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_preco ON properties(preco);
CREATE UNIQUE INDEX idx_deals_ref ON deals(ref) WHERE ref IS NOT NULL;
```

---

## 8. WORKFLOWS N8N (7)

### Localização dos Ficheiros
```
agency-group/
└── n8n-workflows/
    ├── Dockerfile.n8n               # Docker image para Railway
    ├── docker-compose.yml           # Stack local
    ├── railway.toml                 # Configuração Railway
    ├── IMPORT_GUIDE.md              # Guia de importação
    ├── README.md                    # Documentação geral
    ├── workflow-a-lead-inbound.json     # Workflow A1: Lead inbound
    ├── workflow-a-lead-enrichment.json  # Workflow A2: Lead enrichment completo
    ├── workflow-b-lead-scoring.json     # Workflow B1: Lead scoring
    ├── workflow-b-daily-report.json     # Workflow B2: Relatório diário
    ├── workflow-c-dormant-lead.json     # Workflow C: Leads dormentes
    ├── workflow-d-investor-alert.json   # Workflow D: Alertas investidores
    └── workflow-e-vendor-report.json    # Workflow E: Relatório vendor
```

### Detalhe de Cada Workflow

| # | Ficheiro | Trigger | O que faz | Cron |
|---|---|---|---|---|
| A1 | `workflow-a-lead-inbound.json` | Webhook `/lead-inbound` | Recebe novo lead (formulário/chatbot), normaliza dados, guarda no Supabase | — |
| A2 | `workflow-a-lead-enrichment.json` | Webhook `/lead-enrichment` | Pipeline completo: normalização + dedup + lead scoring + envio WhatsApp de boas-vindas + notificação ao agente | — |
| B1 | `workflow-b-lead-scoring.json` | Webhook | Recalcula score de um lead com base em dados actualizados (budget match, engagement, timeline) | — |
| B2 | `workflow-b-daily-report.json` | Cron | Segunda a Sexta às 08:00 UTC: agrega novas listagens + reduções de preço últimas 24h, gera digest IA, envia ao agente | `0 8 * * 1-5` |
| C | `workflow-c-dormant-lead.json` | Cron | Diariamente às 09:00 UTC: encontra leads sem actividade há 30+ dias, gera mensagem de re-engagement personalizada por IA, envia WhatsApp | `0 9 * * *` |
| D | `workflow-d-investor-alert.json` | Webhook `/new-property` | Nova propriedade adicionada: corre algoritmo de matching (budget 30pts + zona 25pts + tipo 20pts + yield 25pts), alerta investidores qualificados (score ≥ 60) via WhatsApp | — |
| E | `workflow-e-vendor-report.json` | Cron | Segundas às 08:00 UTC: gera relatório semanal de actividade para vendedores (visitas realizadas, feedback, comparáveis de mercado) | `0 8 * * 1` |

### Credenciais Necessárias no n8n
Após importar os workflows, configurar em n8n → Credentials:
1. **Supabase PostgreSQL** (nome interno: `supabase-postgres-cred`) — URL + Service Role Key
2. **Anthropic API** — API Key
3. **WhatsApp Business API** — Phone Number ID + Access Token
4. **Agency Group Portal API** — Internal API Secret

### Webhook URLs (após deploy em Railway)
| Workflow | Path | URL completo |
|---|---|---|
| Lead Enrichment | `/lead-enrichment` | `https://your-n8n.railway.app/webhook/lead-enrichment` |
| Investor Alert | `/new-property` | `https://your-n8n.railway.app/webhook/new-property` |

### Como Importar Workflows
1. Aceder ao n8n em `https://your-n8n.railway.app`
2. Settings → Import Workflow
3. Importar pela ordem: A1 → A2 → B1 → B2 → C → D → E
4. Para cada workflow: activar + configurar credenciais + testar

### Deploy n8n no Railway
```bash
# 1. Ir a railway.app → New Project → Deploy from GitHub
# 2. Seleccionar repo agency-group, Root Directory: n8n-workflows
# 3. Adicionar variáveis de ambiente:
N8N_ENCRYPTION_KEY=<32 chars aleatórios>
N8N_WEBHOOK_URL=https://your-n8n.railway.app
SUPABASE_URL=<valor de .env.local>
SUPABASE_SERVICE_ROLE_KEY=<valor de .env.local>
ANTHROPIC_API_KEY=<valor de .env.local>
PORTAL_URL=https://www.agencygroup.pt
```

---

## 9. DEPLOYMENT

### Vercel (Portal Next.js)

#### Deploy Inicial
```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
npx vercel deploy

# 4. Deploy de produção
npx vercel --prod
```

#### Configuração no Vercel Dashboard
1. Ir a vercel.com → Projecto → Settings → Environment Variables
2. Adicionar TODAS as variáveis de `.env.local` (ver Secção 6)
3. Settings → Domains → Adicionar `agencygroup.pt` e `www.agencygroup.pt`
4. O `vercel.json` configura automaticamente os 3 cron jobs

#### CI/CD (GitHub Actions)
- Push para `main` → deploy automático para produção
- PRs → deploy automático para preview URL
- Configuração: Vercel integra automaticamente com GitHub

### Railway (n8n + Python Scraper)

#### Deploy n8n
Ver Secção 8 — Deploy n8n no Railway

#### Deploy Python Scraper
```bash
# Localização: services/scraper/
# Ver services/scraper/README.md
# Railway: New Project → Deploy from GitHub
# Root Directory: services/scraper
```

### Estrutura de Pastas de Deploy
```
agency-group/
├── app/                    → Next.js App Router (Vercel)
│   ├── api/               → API Routes (50 grupos)
│   ├── portal/            → Portal principal
│   └── [outras páginas]   → Website público
├── n8n-workflows/          → n8n (Railway)
├── services/scraper/       → Python scraper (Railway)
├── supabase/               → Migrations (executar manualmente)
└── scripts/                → Scripts de seed
```

---

## 10. BUGS CORRIGIDOS (HISTÓRICO COMPLETO)

### Wave 1 — Fixes Iniciais de Estabilidade

| # | Bug | Causa | Fix |
|---|---|---|---|
| 1 | Portal não carregava (hydration mismatch) | Componentes com `window` em SSR | Todos os componentes do portal passaram a `dynamic(() => import(...), { ssr: false })` |
| 2 | Stores Zustand re-renderizavam toda a árvore | Subscrição ao store inteiro em vez de selectores | Refactorizado para usar selectores individuais: `useUIStore(s => s.darkMode)` |
| 3 | Clock no uiStore causava re-renders a cada segundo | `setInterval` no store actualizava estado global | Clock isolado — não está no store global, apenas no componente que o usa |
| 4 | API `/api/avm` retornava 500 sem mensagem útil | Falta de validação Zod na entrada | Adicionado schema Zod para todos os campos; erros formatados com mensagem clara |
| 5 | Dark mode não persistia entre sessões | Só guardava no estado React | Adicionado `localStorage.setItem('darkMode', ...)` no setter do uiStore |
| 6 | Magic link auth não funcionava em produção | `NEXTAUTH_URL` não configurado em Vercel | Adicionada variável ao Vercel Dashboard; documentado no SETUP.md |
| 7 | Supabase Row Level Security bloqueava tudo | Políticas RLS demasiado restritivas | Adicionadas políticas `service_role` com `USING (true)` na Migration 003 |
| 8 | `next-intl` causava erro 404 nas rotas de API | Middleware de i18n interceptava `/api/*` | Adicionado `matcher` no middleware para excluir `/api/(.*)` |
| 9 | Build falhava: `@types/node` versão errada | Conflito entre Next.js 16 e @types/node | Fixado em `^20` no package.json |
| 10 | WhatsApp webhook GET retornava 403 | Token de verificação hardcoded diferente do configurado no Meta | Standardizado para `agencygroup2026` no código e documentação |

### Wave 2 — Fixes de Funcionalidade e Performance

| # | Bug | Causa | Fix |
|---|---|---|---|
| 11 | PortalRadar cache não funcionava | Chave de cache usava URL completa (caracteres especiais) | Implementado `hashKey()` com hash numérico simples |
| 12 | Rate limiting do Radar não resetava | `reset` timestamp nunca era verificado correctamente | Corrigida lógica de reset: `now > e.reset` antes de comparar count |
| 13 | PortalCRM smart import demorava sem feedback | Sem loading state durante chamada à IA | Adicionado `smartImportLoading` ao crmStore |
| 14 | Deals da Supabase não carregavam no pipeline | Coluna `ref` não existia na tabela deals inicial | Migration 003: `ALTER TABLE deals ADD COLUMN IF NOT EXISTS ref TEXT` |
| 15 | PortalAVM enviava campos vazios à API | Formulário submetia sem validar | Adicionada validação client-side: campos obrigatórios zona, tipo, área |
| 16 | HeyGen avatar não iniciava | WebRTC ICE candidates mal formatados | Corrigida ordem das chamadas: session → ICE → start → task |
| 17 | Push notifications falhavam em Safari | VAPID subject sem formato `mailto:` | Corrigido para `VAPID_SUBJECT=mailto:tech@agencygroup.pt` |
| 18 | Relatório diário n8n enviava duplicados | Workflow B2 sem dedup de listagens | Adicionado hash de URL na tabela de sinais para evitar duplicados |
| 19 | PortalJuridico modo memo não exportava markdown | `Blob` API não disponível em SSR | Componente já era `{ ssr: false }` mas import de utils era SSR; movido para client-only |
| 20 | Properties seed falhava com constraint violation | `ref` UNIQUE violado em re-runs do seed | Seed actualizado para usar `UPSERT` em vez de `INSERT` |
| 21 | `computeLeadScore` retornava NaN para budgets string | Budget guardado como string no CRM | Adicionado `parseInt()` antes dos cálculos em `utils.ts` |
| 22 | Sidebar ficava aberta em mobile após navegar | `setSidebarOpen(false)` não era chamado na mudança de secção | Adicionado `setSidebarOpen(false)` no handler `setSection` no `page.tsx` |

---

## 11. O QUE AINDA FALTA FAZER

### Crítico (Bloqueia Produção)
| Item | Descrição | Como completar |
|---|---|---|
| Migration 003 executada | A `supabase/migrations/003_portal_compat.sql` precisa de ser executada no projecto Supabase de produção | Supabase Dashboard → SQL Editor → copiar e executar o ficheiro |
| WhatsApp permanent token | O token actual pode ser temporário (24h). Criar System User permanente | developers.facebook.com → Business Settings → System Users → Generate Token com `whatsapp_business_messaging` |
| Variáveis de ambiente Vercel | Confirmar que TODAS as variáveis estão no Vercel Dashboard para produção | Vercel → Projecto → Settings → Environment Variables |

### Importante (Funcionalidade Incompleta)
| Item | Descrição |
|---|---|
| HeyGen API keys | `HEYGEN_API_KEY` não está configurada. O módulo de avatar IA (PortalVoz/HeyGen) não funciona sem ela. |
| Railway deployment | n8n e Python scraper ainda não estão deployed em Railway. Os 7 workflows de automação não correm. |
| Python scraper | O scraper em `services/scraper/` precisa de ser deployed. Sem ele, o Radar opera em modo simulado. |
| Browserless token | Sem `BROWSERLESS_TOKEN`, o scraping de URLs do Radar usa dados sintéticos em vez de dados reais. |
| Stability AI | Sem `STABILITY_API_KEY`, o home staging virtual não funciona. |
| Google OAuth | Sem `GOOGLE_CLIENT_ID`/`SECRET`, o login com Google não funciona (só magic link). |
| RLS production | As políticas RLS actuais têm `USING (true)` — permissivas. Tightening necessário antes de produção real com múltiplos agentes. |

### Nice to Have (Roadmap)
| Item | Descrição |
|---|---|
| App móvel | React Native/Expo com NativeWind. Arquitectura documentada em `memory/world_best_real_estate_apps_guide.md`. |
| Analytics avançados | PortalAnalytics ainda retorna dados mockados; integração com DB real pendente. |
| Internacionalização completa | `next-intl` configurado mas traduções só em PT. Ficheiros de mensagens em `messages/`. |
| PWA | Service worker configurado mas install prompt não implementado. |
| Relatórios PDF | API `/api/reports` gera markdown; geração de PDF (ex: Puppeteer) não implementada. |
| Colecções partilháveis | PortalCollections + `/api/track-view` implementado mas não testado end-to-end. |

---

## 12. COMO RESTAURAR DO ZERO (Checklist 20 Passos)

Seguir esta ordem exacta para restaurar o portal Agency Group de raiz.

### Fase 1 — Preparação do Ambiente
```
[ ] Passo 1 — Instalar prerequisites
    - Node.js 20 LTS: nodejs.org/en/download
    - Git: git-scm.com
    - Verificar: node --version (deve mostrar v20.x.x)

[ ] Passo 2 — Clonar repositório
    git clone https://github.com/your-org/agency-group.git
    cd agency-group
    npm install
    Verificar: pasta node_modules criada sem erros

[ ] Passo 3 — Criar ficheiro de variáveis de ambiente
    cp .env.local.example .env.local
    # Abrir .env.local e preencher TODOS os valores (ver Secção 6)
    # Mínimo para funcionar localmente:
    #   NEXT_PUBLIC_SUPABASE_URL
    #   NEXT_PUBLIC_SUPABASE_ANON_KEY
    #   SUPABASE_SERVICE_ROLE_KEY
    #   ANTHROPIC_API_KEY
    #   NEXTAUTH_SECRET (gerar: openssl rand -base64 32)
    #   RESEND_API_KEY
```

### Fase 2 — Serviços Externos
```
[ ] Passo 4 — Criar projecto Supabase
    - Ir a supabase.com → New Project
    - Região: eu-west-1 (Frankfurt)
    - Guardar: Project URL, anon key, service_role key
    - Copiar valores para .env.local

[ ] Passo 5 — Executar migrations Supabase
    Supabase Dashboard → SQL Editor → executar por esta ordem:
    a) supabase/migrations/001_initial_check.sql
    b) supabase/migrations/001_initial_schema.sql
    c) supabase/migrations/002_missing_tables.sql
    d) supabase/migrations/002_seed_properties.sql
    e) supabase/migrations/003_portal_compat.sql
    Verificar: todas as tabelas criadas sem erros

[ ] Passo 6 — Seed de dados iniciais
    node scripts/seed-supabase.js
    node scripts/seed-properties-deals.js
    Verificar: curl http://localhost:3000/api/health
    Deve retornar: {"status":"healthy","counts":{"contacts":10,"properties":8,"deals":8}}

[ ] Passo 7 — Criar conta Anthropic e obter API key
    - console.anthropic.com → API Keys → Create Key
    - Copiar para ANTHROPIC_API_KEY em .env.local

[ ] Passo 8 — Configurar Resend (email)
    - resend.com → API Keys → Create API Key
    - Adicionar domínio agencygroup.pt → verificar DNS
    - Copiar para RESEND_API_KEY em .env.local

[ ] Passo 9 — Configurar Sentry (monitoring)
    - sentry.io → New Project → Next.js
    - Copiar DSN para NEXT_PUBLIC_SENTRY_DSN
    - Copiar Auth Token para SENTRY_AUTH_TOKEN

[ ] Passo 10 — Configurar WhatsApp Business
    - developers.facebook.com → My Apps → Create App → Business
    - Add Product → WhatsApp → API Setup
    - Copiar Phone Number ID e WABA ID
    - Criar System User permanente → Generate Token
    - Configurar Webhook: URL/api/whatsapp/webhook, verify token: agencygroup2026
    - Subscrever a: messages
```

### Fase 3 — Desenvolvimento Local
```
[ ] Passo 11 — Iniciar servidor de desenvolvimento
    npm run dev
    Abrir: http://localhost:3000
    Verificar: portal carrega sem erros no browser

[ ] Passo 12 — Testar fluxo de autenticação
    - Ir a /portal
    - Inserir email de agente
    - Verificar recepção de magic link por email
    - Confirmar login e acesso ao portal

[ ] Passo 13 — Testar módulos críticos
    - AVM: inserir dados → verificar resultado
    - Sofia: enviar mensagem → verificar resposta IA
    - Juridico: fazer pergunta legal → verificar resposta
    - Pipeline: verificar carregamento dos 3 deals de demo
    - CRM: verificar carregamento dos contactos de demo
```

### Fase 4 — Deploy em Produção
```
[ ] Passo 14 — Configurar Vercel
    npm i -g vercel
    vercel login
    vercel deploy (para preview)
    vercel --prod (para produção)
    Guardar a URL de produção

[ ] Passo 15 — Adicionar variáveis ao Vercel Dashboard
    Vercel → Projecto → Settings → Environment Variables
    Adicionar TODOS os pares do .env.local
    Atenção: NEXTAUTH_URL deve ser https://www.agencygroup.pt

[ ] Passo 16 — Configurar domínio no Vercel
    Settings → Domains → Add → agencygroup.pt
    Configurar DNS no registrar:
    CNAME www → cname.vercel-dns.com
    A @ → 76.76.21.21

[ ] Passo 17 — Verificar health em produção
    curl https://www.agencygroup.pt/api/health
    Deve retornar: {"status":"healthy"}
    Testar Sentry: https://www.agencygroup.pt/api/sentry-test

[ ] Passo 18 — Deploy n8n no Railway
    - railway.app → New Project → Deploy from GitHub
    - Root Directory: n8n-workflows
    - Adicionar variáveis de ambiente (ver Secção 8)
    - Após deploy, aceder à UI n8n e importar os 7 workflows
    - Configurar credenciais em n8n
    - Activar todos os workflows

[ ] Passo 19 — Configurar VAPID para push notifications
    npx web-push generate-vapid-keys
    Copiar public e private keys para .env.local e Vercel Dashboard

[ ] Passo 20 — Verificação final end-to-end
    a) Login via magic link funciona
    b) Portal Dashboard carrega com dados reais
    c) AVM retorna avaliação real
    d) Sofia responde via Claude API
    e) WhatsApp envia mensagem de teste
    f) n8n workflows activos e a correr
    g) Sentry recebe eventos de produção
    h) Notificações push funcionam no browser
    i) Cron jobs do Vercel activos (vercel.json)
    j) Dados de mercado carregam correctamente
```

---

## APÊNDICE A — Estrutura de Pastas Completa

```
agency-group/
├── app/
│   ├── api/                          # 50 grupos de API routes
│   │   ├── activities/route.ts
│   │   ├── admin/route.ts
│   │   ├── agent/[session,ice,start,task]/
│   │   ├── alerts/route.ts
│   │   ├── auth/[request,verify,send,send-reset,confirm-reset,setup-2fa,check-2fa,verify-2fa,approve,reject,complete-onboarding,...nextauth,nextauth]/
│   │   ├── automation/[daily-brief,dormant-leads,investor-alert,lead-score,match-buyer,pipeline-advance,signals,vendor-report]/
│   │   ├── avm/route.ts
│   │   ├── booking/route.ts
│   │   ├── chat/route.ts
│   │   ├── collections/route.ts
│   │   ├── contacts/route.ts
│   │   ├── content/route.ts
│   │   ├── crm/[next-step,meeting-prep,email-draft,extract-contact,voice-note,route.ts]/
│   │   ├── cron/followups/route.ts
│   │   ├── deal/[risk,nego,route.ts]/
│   │   ├── deals/route.ts
│   │   ├── draft-offer/route.ts
│   │   ├── financing/route.ts
│   │   ├── health/route.ts
│   │   ├── heygen/[ice,session,start,task]/
│   │   ├── homestaging/route.ts
│   │   ├── imt/route.ts
│   │   ├── investment/route.ts
│   │   ├── investor-pitch/route.ts
│   │   ├── investors/route.ts
│   │   ├── juridico/route.ts
│   │   ├── learn/route.ts
│   │   ├── mais-valias/route.ts
│   │   ├── market/[route.ts,market-data]/
│   │   ├── market-data/[refresh,cache]/
│   │   ├── mortgage/route.ts
│   │   ├── nhr/route.ts
│   │   ├── notifications/route.ts
│   │   ├── notion/[deals,contacts,properties,seed]/
│   │   ├── off-market/route.ts
│   │   ├── outbound/route.ts
│   │   ├── portfolio/route.ts
│   │   ├── properties/[route.ts,analyze-photos,cma,db,search-natural]/
│   │   ├── push/[route.ts,subscribe]/
│   │   ├── radar/[route.ts,search,digest,history]/
│   │   ├── rates/route.ts
│   │   ├── reports/route.ts
│   │   ├── sentry-test/route.ts
│   │   ├── signals/route.ts
│   │   ├── sofia/[chat,session,speak,script]/
│   │   ├── test-smtp/route.ts
│   │   ├── track-view/route.ts
│   │   ├── visitas/[route.ts,feedback]/
│   │   ├── voz/route.ts
│   │   └── whatsapp/[webhook,send,test,status]/
│   ├── portal/
│   │   ├── page.tsx                  # Página principal do portal (35 componentes)
│   │   ├── components/               # 35 componentes (ver Secção 3)
│   │   └── stores/                   # 9 stores Zustand (ver Secção 5)
│   ├── [outras rotas públicas]        # Website público (blog, zonas, imoveis, etc.)
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx                      # Homepage pública
├── lib/                              # Utilitários partilhados
│   ├── supabase.ts                   # Cliente Supabase
│   ├── db.ts                         # Queries de base de dados
│   ├── rateLimit.ts                  # Rate limiting
│   ├── monitoring.ts                 # Sentry utils
│   ├── cache.ts                      # Cache em memória
│   ├── ine-api.ts                    # INE API (Euribor, estatísticas)
│   └── [outros utilitários]
├── supabase/
│   ├── schema.sql                    # Schema de referência
│   ├── rls-policies.sql              # Políticas RLS
│   └── migrations/                   # 5 ficheiros de migration
├── n8n-workflows/                    # 7 workflows + infra
├── services/
│   └── scraper/                      # Python scraper (Railway)
├── scripts/                          # Seed scripts
├── docs/                             # Documentação auxiliar
│   └── whatsapp-setup.md
├── messages/                         # Ficheiros de tradução i18n
├── public/                           # Assets estáticos
├── __tests__/                        # Testes
├── package.json
├── next.config.ts
├── vercel.json
├── auth.ts                           # NextAuth config
├── tsconfig.json
├── vitest.config.ts
└── SETUP.md                          # Guia rápido de setup
```

---

## APÊNDICE B — Dados de Mercado Embutidos (Q1 2026)

O Radar tem dados de mercado embutidos no código (`/api/radar/route.ts`) para as principais zonas:

| Zona | PM² Transacção | PM² Pedido | Var. YoY | Var. QoQ |
|---|---|---|---|---|
| Lisboa | €5.000/m² | ~€5.800/m² | +12-15% | +2-3% |
| Cascais | €4.713/m² | ~€5.400/m² | +10-12% | +2-3% |
| Algarve | €3.941/m² | ~€4.500/m² | +8-12% | +2% |
| Porto | €3.643/m² | ~€4.200/m² | +8-10% | +2% |
| Madeira | €3.760/m² | ~€4.300/m² | +10-12% | +2% |
| Açores | €1.952/m² | ~€2.200/m² | +6-8% | +1% |

Mediana nacional 2026: €3.076/m² | +17.6% YoY | 169.812 transacções | 210 dias médios de mercado.

---

## APÊNDICE C — Segmento e Comissões

- **AMI**: 22506
- **Comissão standard**: 5% (50% no CPCV + 50% na Escritura)
- **Segmento core**: €500K–€3M
- **Range total**: €100K–€100M
- **Mercados**: Portugal (Lisboa, Porto, Algarve, Madeira, Açores) + Espanha

---

*Fim do MASTER_BACKUP.md — Gerado em 2026-04-06 com base em leitura directa do código-fonte.*
*Próxima actualização recomendada: após cada release major ou mudança de arquitectura.*
