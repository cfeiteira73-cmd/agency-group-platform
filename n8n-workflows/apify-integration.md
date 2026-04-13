# Idealista API → n8n Integration — Agency Group Deal Machine

## Status: CONFIGURED — Aguarda credenciais Idealista API Oficial

## Fonte de Dados Legal
- **Idealista API Oficial** (OAuth2 REST) — `https://api.idealista.com/3.5/pt`
- Credenciais: `IDEALISTA_API_KEY` + `IDEALISTA_SECRET` (pedir em developers.idealista.com com AMI 22506)
- Implementação: `lib/idealista-api.ts`

> ⚠️ **NOTA LEGAL (2026-04-13):** Todos os scrapers ilegais foram removidos.
> `dz_omar/idealista-scraper-api` e `epctex~imovirtual-scraper` violavam os ToS da
> Idealista e Imovirtual e foram eliminados. O pipeline usa agora apenas APIs oficiais.

## n8n Webhook
- Production: `https://{railway-app}.railway.app/webhook/offmarket-new`
- Local dev: `http://localhost:5678/webhook/offmarket-new` ✅ LIVE

## Fluxo de Sourcing Legal

### 1. Idealista API Oficial (aguarda credenciais)
```
Cron 06:30 UTC Mon-Fri → /api/offmarket-leads/fetch-idealista → n8n webhook
```

Endpoint a criar (`/api/offmarket-leads/fetch-idealista`):
```typescript
import { searchPremiumSales } from '@/lib/idealista-api'

// Lisboa centro premium ≥500K
const results = await searchPremiumSales('38.716,-9.143', 500_000)
// POST cada result → n8n webhook → offmarket_leads table
```

### 2. e-Leilões.pt + Portal das Finanças (ACTIVO)
```
fetchEleiloesListings() + fetchLeiloesTaxListings() — lib/eleiloes-api.ts
```

### 3. Citius Vendas Judiciais (ACTIVO)
```
Portal público MJ — dados abertos por lei
```

## n8n Webhook Configuration (Idealista API Oficial)
```json
POST https://{railway-app}.railway.app/webhook/offmarket-new
Headers:
  Content-Type: application/json
  x-cron-secret: $CRON_SECRET

Body (per property from Idealista API):
{
  "source": "idealista_api",
  "titulo": "{{property.address}}",
  "preco": {{property.price}},
  "area_m2": {{property.size}},
  "cidade": "{{property.municipality}}",
  "lat": {{property.latitude}},
  "lon": {{property.longitude}},
  "url": "{{property.url}}",
  "external_id": "{{property.propertyCode}}"
}
```

## Activate (quando credenciais Idealista disponíveis)
1. Pedir em https://developers.idealista.com com NIF da agência e AMI 22506
2. Adicionar `IDEALISTA_API_KEY` e `IDEALISTA_SECRET` ao Vercel + .env.local
3. Criar `/api/offmarket-leads/fetch-idealista` usando `lib/idealista-api.ts`
4. Adicionar cron Vercel: `{"path": "/api/offmarket-leads/fetch-idealista", "schedule": "30 6 * * 1-5"}`
