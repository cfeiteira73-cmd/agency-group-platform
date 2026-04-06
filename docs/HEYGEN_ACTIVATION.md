# HeyGen Activation Guide — Agency Group

## 1. O que já está implementado

### API Routes (server-side proxy)

| Ficheiro | Endpoint | Função |
|---|---|---|
| `app/api/heygen/session/route.ts` | `POST /api/heygen/session` | Cria nova sessão de streaming WebRTC |
| `app/api/heygen/session/route.ts` | `DELETE /api/heygen/session` | Encerra sessão de streaming |
| `app/api/heygen/start/route.ts` | `POST /api/heygen/start` | Completa o WebRTC handshake com SDP answer |
| `app/api/heygen/task/route.ts` | `POST /api/heygen/task` | Envia texto para o avatar falar (TTS) |

### Funcionalidades implementadas no back-end
- `HEYGEN_API_KEY` mantida exclusivamente server-side (nunca exposta ao browser)
- Suporte a `avatar_id` configurável via env var `HEYGEN_AVATAR_ID`
- Suporte a `voice_id` configurável via env var `HEYGEN_VOICE_ID`
- Qualidade de stream configurável (`low` / `medium` / `high`), default `medium`
- Encoding H264, protocolo v2 da HeyGen Streaming API
- Task types suportados: `talk` (default) e outros que a API aceite

### PortalSofia — Componente front-end
- Localizado em `app/portal/components/PortalSofia.tsx`
- Tem modos `avatar` (HeyGen) e `chat` (Claude)
- Props já mapeadas: `sofiaSessionId`, `sofiaConnected`, `sofiaLoading`, `sofiaSpeaking`, `sofiaVideoRef`
- Callbacks já definidos: `onConnect`, `onDisconnect`, `onSpeak`, `onGenerateScript`
- Suporte multilíngue: PT / EN / FR / AR
- Assistente tem 4 modos: Deal, Market, Legal, Investor

---

## 2. O que falta para activar

### Env vars obrigatórias

| Variável | Onde obter | Notas |
|---|---|---|
| `HEYGEN_API_KEY` | [app.heygen.com](https://app.heygen.com) → API → API Key | Plano mínimo: Creator ($29/mês). Para streaming em tempo real: Enterprise |
| `HEYGEN_AVATAR_ID` | HeyGen Studio → Avatars → copiar ID do avatar criado | Ex: `Anna_public_3_20240108` ou avatar personalizado Sofia |
| `HEYGEN_VOICE_ID` | HeyGen Studio → Voices → copiar Voice ID | Recomendado: voz portuguesa ou espanhola natural |

### Pré-requisitos de conta HeyGen
1. Conta HeyGen activa em [heygen.com](https://heygen.com)
2. Plano **Business** ou **Enterprise** para Streaming Avatar (tempo real)
   - Plano Creator não suporta streaming — apenas video render pré-gravado
3. Avatar criado ou seleccionado (pode usar avatars públicos ou criar avatar personalizado "Sofia")
4. API Key gerada em Settings → API → Generate Key

### Verificação de limites
- A API de Streaming tem limite de sessões concorrentes dependendo do plano
- Cada sessão consome créditos de streaming minutes
- Monitorizar uso em app.heygen.com → Usage

---

## 3. Passos exactos para activar

### Passo 1 — Criar conta e obter API Key
```
1. Ir a https://app.heygen.com
2. Registar conta (ou fazer login)
3. Upgrade para plano Business ($89/mês) ou Enterprise
4. Settings → API → Generate New API Key
5. Copiar a key — só é mostrada uma vez
```

### Passo 2 — Criar ou escolher Avatar "Sofia"
```
1. HeyGen Studio → Avatars → Browse Public Avatars
   OU
   Studio → Instant Avatar → Upload 2-5 min de vídeo → treinar avatar personalizado
2. Copiar o Avatar ID (ex: "Sofia_public_20240501" ou UUID)
3. Testar no HeyGen Playground antes de integrar
```

### Passo 3 — Escolher Voice
```
1. Studio → Voices → filtrar por Português (Portugal) ou Castelhano
2. Copiar o Voice ID
3. Testar com o avatar escolhido
```

### Passo 4 — Configurar .env.local
```bash
# Adicionar ao ficheiro C:\Users\Carlos\agency-group\.env.local
HEYGEN_API_KEY=hg_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
HEYGEN_AVATAR_ID=Anna_public_3_20240108   # substituir pelo ID real
HEYGEN_VOICE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # substituir pelo ID real
```

### Passo 5 — Configurar Vercel (produção)
```
1. Vercel Dashboard → agency-group → Settings → Environment Variables
2. Adicionar:
   - HEYGEN_API_KEY  (valor: chave obtida no Passo 1)
   - HEYGEN_AVATAR_ID (valor: ID do Passo 2)
   - HEYGEN_VOICE_ID  (valor: ID do Passo 3)
3. Redeploy: vercel --prod
```

### Passo 6 — Testar a integração
```bash
# Testar criação de sessão (local)
curl -X POST http://localhost:3000/api/heygen/session \
  -H "Content-Type: application/json" \
  -d '{"quality": "medium"}'

# Resposta esperada (sucesso):
# { "data": { "session_id": "...", "sdp": {...}, "ice_servers": [...] } }

# Resposta esperada (sem API key):
# { "error": "HeyGen não configurado. Adicionar HEYGEN_API_KEY ao .env.local" }
```

### Passo 7 — Activar Sofia no Portal
```
1. Aceder ao Portal: http://localhost:3000/portal
2. Clicar em "Sofia" → separador "Avatar"
3. Clicar "Conectar" — deve iniciar sessão WebRTC
4. Aguardar vídeo carregar (2-5 segundos)
5. Digitar texto e clicar "Falar" — Sofia deve pronunciar o texto
```

---

## 4. Troubleshooting

| Erro | Causa | Solução |
|---|---|---|
| `503 HeyGen não configurado` | `HEYGEN_API_KEY` em falta no .env | Adicionar key ao .env.local e reiniciar servidor |
| `401 Unauthorized` | API Key inválida ou expirada | Regenerar key em HeyGen Studio |
| `403 Forbidden` | Plano não suporta Streaming | Fazer upgrade para Business/Enterprise |
| `Avatar ID not found` | ID inválido ou avatar privado noutra conta | Verificar ID em HeyGen Studio → Avatars |
| Vídeo não aparece | WebRTC bloqueado por firewall/VPN | Testar sem VPN; verificar ICE servers na resposta |
| Sofia não fala | `task_type` inválido ou sessão expirada | Reconectar; verificar que sessionId está correcto |

---

## 5. Custos estimados

| Plano | Preço | Streaming Avatar | Recomendado para |
|---|---|---|---|
| Creator | $29/mês | Não | Apenas renders pré-gravados |
| Business | $89/mês | Sim (limitado) | Testes e demos |
| Enterprise | Custom | Sim (ilimitado) | Produção com múltiplos utilizadores |

**Estimativa Agency Group:** ~$89-199/mês para uso normal (demos a compradores, portal interno).

---

*Documento gerado automaticamente — Agency Group Portal v3.0 — 2026-04-06*
