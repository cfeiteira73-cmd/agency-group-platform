// =============================================================================
// Agency Group — OpenAPI 3.1 Documentation Endpoint
// GET /api/docs — returns the OpenAPI specification
//
// Auth: requirePortalAuth (portal agents only)
// Format: JSON (consumable by Swagger UI, Postman, etc.)
//
// To view interactively:
//   Paste the response at https://editor.swagger.io
//   Or import into Postman via "Import → Link"
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// OpenAPI 3.1 Specification
// ---------------------------------------------------------------------------

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title:       'Agency Group Platform API',
    version:     '2.0.0',
    description: `
# Agency Group Platform API

Revenue operating system for luxury real estate in Portugal.

## Authentication

All portal routes require one of:
- **NextAuth session** (Google OAuth / credentials)
- **ag-auth-token cookie** (magic-link HMAC-SHA256 signed)
- **Bearer token** (CRON_SECRET or INTERNAL_API_TOKEN for internal/cron calls)

## Rate Limits

| Route category | Limit |
|---------------|-------|
| Auth (send/verify) | 5 req / 15 min |
| AI endpoints | 10 req / min |
| Analytics | 60 req / min |
| CRUD | 100 req / min |

## Base URL

Production: \`https://agencygroup.pt\`

## Revenue Pipeline

\`MATCH → DECISION → DEAL PACK → SEND → FOLLOW-UP → CLOSE\`

Priority thresholds: ≥80 = HIGH (24h SLA), 60–79 = MEDIUM (72h), <60 = LOW (168h)
    `.trim(),
    contact: {
      name:  'Agency Group Engineering',
      email: 'tech@agencygroup.pt',
      url:   'https://agencygroup.pt',
    },
    license: { name: 'Proprietary' },
  },

  servers: [
    { url: 'https://agencygroup.pt', description: 'Production' },
    { url: 'http://localhost:3000',  description: 'Development' },
  ],

  // ── Security Schemes ────────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      BearerAuth: {
        type:         'http',
        scheme:       'bearer',
        bearerFormat: 'CRON_SECRET or INTERNAL_API_TOKEN',
        description:  'For internal cron jobs and n8n automation calls',
      },
      CookieAuth: {
        type: 'apiKey',
        in:   'cookie',
        name: 'ag-auth-token',
        description: 'Magic-link HMAC-SHA256 signed session token',
      },
      NextAuthSession: {
        type: 'apiKey',
        in:   'cookie',
        name: 'next-auth.session-token',
        description: 'NextAuth v5 session (Google OAuth or credentials)',
      },
    },

    // ── Reusable Schemas ──────────────────────────────────────────────────────
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error:   { type: 'string', example: 'Unauthorized' },
          details: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total:  { type: 'integer', example: 47 },
          page:   { type: 'integer', example: 1 },
          limit:  { type: 'integer', example: 50 },
          pages:  { type: 'integer', example: 1 },
        },
      },
      Deal: {
        type: 'object',
        properties: {
          id:            { type: 'string', format: 'uuid' },
          ref:           { type: 'string', example: 'AG-2026-0042' },
          imovel:        { type: 'string', example: 'Apartamento T3 Chiado' },
          valor:         { type: 'string', example: '€ 1.250.000' },
          fase:          { type: 'string', example: 'Proposta' },
          comprador:     { type: 'string', example: 'James Mitchell' },
          expected_fee:  { type: 'number', example: 62500 },
          realized_fee:  { type: ['number', 'null'] },
          agent_email:   { type: 'string', format: 'email' },
          updated_at:    { type: 'string', format: 'date-time' },
          created_at:    { type: 'string', format: 'date-time' },
        },
      },
      Contact: {
        type: 'object',
        properties: {
          id:                   { type: 'string', format: 'uuid' },
          full_name:            { type: 'string' },
          email:                { type: ['string', 'null'], format: 'email' },
          phone:                { type: ['string', 'null'] },
          nationality:          { type: ['string', 'null'] },
          status:               { type: 'string', enum: ['lead','prospect','qualified','active','negotiating','client','vip','dormant','lost'] },
          budget_min:           { type: ['number', 'null'] },
          budget_max:           { type: ['number', 'null'] },
          lead_score:           { type: 'integer', minimum: 0, maximum: 100 },
          agent_email:          { type: ['string', 'null'], format: 'email' },
          buyer_score:          { type: ['integer', 'null'] },
          buyer_tier:           { type: ['string', 'null'] },
        },
      },
      Property: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          nome:        { type: 'string' },
          zona:        { type: 'string' },
          tipo:        { type: 'string' },
          preco:       { type: 'number' },
          area:        { type: 'number' },
          quartos:     { type: 'integer' },
          status:      { type: 'string' },
          agent_email: { type: ['string', 'null'], format: 'email' },
        },
      },
      DealPack: {
        type: 'object',
        properties: {
          id:                  { type: 'string', format: 'uuid' },
          title:               { type: 'string' },
          status:              { type: 'string', enum: ['draft','ready','sent','viewed','archived'] },
          view_count:          { type: 'integer', minimum: 0 },
          investment_thesis:   { type: ['string', 'null'] },
          opportunity_score:   { type: ['integer', 'null'], minimum: 0, maximum: 100 },
          sent_at:             { type: ['string', 'null'], format: 'date-time' },
          viewed_at:           { type: ['string', 'null'], format: 'date-time' },
          created_by:          { type: 'string', format: 'email' },
          created_at:          { type: 'string', format: 'date-time' },
        },
      },
      Match: {
        type: 'object',
        properties: {
          id:                  { type: 'string', format: 'uuid' },
          lead_id:             { type: 'string', format: 'uuid' },
          property_id:         { type: ['string', 'null'], format: 'uuid' },
          match_score:         { type: 'integer', minimum: 0, maximum: 100 },
          priority_level:      { type: 'string', enum: ['high','medium','low'] },
          next_best_action:    { type: ['string', 'null'] },
          status:              { type: 'string' },
        },
      },
      PriorityItem: {
        type: 'object',
        properties: {
          id:               { type: 'string', format: 'uuid' },
          entity_type:      { type: 'string' },
          entity_id:        { type: 'string' },
          priority_score:   { type: 'integer', minimum: 0, maximum: 100 },
          reason:           { type: 'string' },
          next_best_action: { type: ['string', 'null'] },
          deadline:         { type: ['string', 'null'], format: 'date-time' },
          owner_id:         { type: ['string', 'null'] },
          revenue_impact:   { type: ['number', 'null'] },
          status:           { type: 'string', enum: ['open','in_progress','resolved','dismissed'] },
        },
      },
      ForecastSummary: {
        type: 'object',
        properties: {
          open_deals:           { type: 'integer' },
          closed_deals:         { type: 'integer' },
          at_risk_deals:        { type: 'integer' },
          closed_revenue_total: { type: 'number' },
        },
      },
    },

    // ── Reusable Responses ────────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      BadRequest: {
        description: 'Invalid request parameters',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      InternalError: {
        description: 'Internal server error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },

  // ── Global Security ─────────────────────────────────────────────────────────
  security: [
    { NextAuthSession: [] },
    { CookieAuth: [] },
    { BearerAuth: [] },
  ],

  // ==========================================================================
  // PATHS
  // ==========================================================================
  paths: {

    // ── DEALS ────────────────────────────────────────────────────────────────
    '/api/deals': {
      get: {
        tags: ['Deals'],
        summary: 'List pipeline deals',
        description: 'Returns paginated list of deals. Supports filtering by fase, agent, search term.',
        parameters: [
          { name: 'fase',      in: 'query', schema: { type: 'string' }, description: 'Filter by Portuguese stage name' },
          { name: 'agent_id',  in: 'query', schema: { type: 'string' }, description: 'Filter by agent ID' },
          { name: 'search',    in: 'query', schema: { type: 'string' }, description: 'Search imovel, comprador, ref' },
          { name: 'min_value', in: 'query', schema: { type: 'number' } },
          { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',     in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Deal list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Pagination' },
                    { type: 'object', properties: {
                      data:   { type: 'array', items: { $ref: '#/components/schemas/Deal' } },
                      source: { type: 'string', enum: ['supabase','mock'] },
                    }},
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Deals'],
        summary: 'Create a new deal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['imovel', 'valor', 'fase'],
                properties: {
                  imovel:     { type: 'string', example: 'Apartamento T3 Chiado' },
                  valor:      { type: 'string', example: '€ 1.250.000' },
                  fase:       { type: 'string', example: 'Contacto' },
                  comprador:  { type: 'string' },
                  property_id:{ type: 'string', format: 'uuid' },
                  agent_id:   { type: 'string' },
                  ref:        { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Deal created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, deal: { $ref: '#/components/schemas/Deal' } } } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      put: {
        tags: ['Deals'],
        summary: 'Update a deal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id:    { type: 'string', format: 'uuid', description: 'UUID (preferred)' },
                  ref:   { type: 'string', description: 'Deal reference (alternative)' },
                  fase:  { type: 'string' },
                  valor: { type: 'string' },
                  notas: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Deal updated' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      delete: {
        tags: ['Deals'],
        summary: 'Delete deal (admin only)',
        parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deal deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ── CONTACTS ─────────────────────────────────────────────────────────────
    '/api/contacts': {
      get: {
        tags: ['Contacts'],
        summary: 'List contacts',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['lead','prospect','qualified','active','client','vip','dormant','lost'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',  in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': {
            description: 'Contact list',
            content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                success:  { type: 'boolean' },
                contacts: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
                total:    { type: 'integer' },
              },
            } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Contacts'],
        summary: 'Create a contact',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['full_name'],
                properties: {
                  full_name:           { type: 'string' },
                  email:               { type: 'string', format: 'email' },
                  phone:               { type: 'string' },
                  nationality:         { type: 'string' },
                  budget_min:          { type: 'number' },
                  budget_max:          { type: 'number' },
                  preferred_locations: { type: 'array', items: { type: 'string' } },
                  status:              { type: 'string', default: 'lead' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Contact created' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/contacts/{id}': {
      get: {
        tags: ['Contacts'],
        summary: 'Get single contact',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Contact detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── PROPERTIES ───────────────────────────────────────────────────────────
    '/api/properties': {
      get: {
        tags: ['Properties'],
        summary: 'List properties',
        parameters: [
          { name: 'zona',      in: 'query', schema: { type: 'string' } },
          { name: 'tipo',      in: 'query', schema: { type: 'string' } },
          { name: 'preco_min', in: 'query', schema: { type: 'number' } },
          { name: 'preco_max', in: 'query', schema: { type: 'number' } },
          { name: 'quartos',   in: 'query', schema: { type: 'integer' } },
          { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',     in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Property list', content: { 'application/json': { schema: { type: 'object', properties: { properties: { type: 'array', items: { $ref: '#/components/schemas/Property' } }, total: { type: 'integer' } } } } } },
        },
      },
    },

    '/api/properties/search-natural': {
      post: {
        tags: ['Properties'],
        summary: 'Natural language property search (AI semantic search)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string', example: 'T3 in Chiado under 1.5M with parking' }, limit: { type: 'integer', default: 10 } } } } },
        },
        responses: {
          '200': { description: 'Matched properties with similarity scores' },
        },
      },
    },

    // ── DEAL PACKS ───────────────────────────────────────────────────────────
    '/api/deal-packs': {
      get: {
        tags: ['Deal Packs'],
        summary: 'List deal packs',
        parameters: [
          { name: 'status',  in: 'query', schema: { type: 'string', enum: ['draft','ready','sent','viewed','archived'] } },
          { name: 'lead_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page',    in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',   in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Deal pack list', content: { 'application/json': { schema: { type: 'object', properties: { packs: { type: 'array', items: { $ref: '#/components/schemas/DealPack' } } } } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/deal-packs/generate': {
      post: {
        tags: ['Deal Packs'],
        summary: 'Generate AI deal pack (Claude)',
        description: 'Uses Claude to generate an investment thesis, market summary, and opportunity score for a property/lead pairing.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lead_id'],
                properties: {
                  lead_id:     { type: 'string', format: 'uuid' },
                  property_id: { type: 'string', format: 'uuid' },
                  deal_id:     { type: 'string', format: 'uuid' },
                  language:    { type: 'string', enum: ['pt','en','fr','de','es'], default: 'pt' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Generated deal pack', content: { 'application/json': { schema: { $ref: '#/components/schemas/DealPack' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/deal-packs/{id}': {
      get: {
        tags: ['Deal Packs'],
        summary: 'View deal pack (tracks view count)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deal pack detail with view_count incremented', content: { 'application/json': { schema: { $ref: '#/components/schemas/DealPack' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── ANALYTICS ────────────────────────────────────────────────────────────
    '/api/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Pipeline KPI summary',
        description: 'Returns total_deals, total_contacts, total_matches, pipeline_value, conversion_rate, top_agents.',
        responses: {
          '200': {
            description: 'KPI summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_deals:     { type: 'integer' },
                    pipeline_value:  { type: 'number' },
                    conversion_rate: { type: 'number' },
                    total_contacts:  { type: 'integer' },
                    total_matches:   { type: 'integer' },
                    top_agents:      { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, pack_count: { type: 'integer' } } } },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/analytics/forecast': {
      get: {
        tags: ['Analytics'],
        summary: 'Revenue forecast (stage-probability weighted)',
        description: 'Returns 30/60/90-day pipeline forecast, scenario modeling (pessimistic/base/optimistic), at-risk deals, and stage distribution.',
        responses: {
          '200': {
            description: 'Revenue forecast',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    summary:            { $ref: '#/components/schemas/ForecastSummary' },
                    pipeline:           { type: 'object', properties: { pessimistic: { type: 'number' }, base: { type: 'number' }, optimistic: { type: 'number' } } },
                    forecast:           { type: 'object' },
                    stage_distribution: { type: 'array' },
                    at_risk_deals:      { type: 'array' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'Revenue analytics (actual vs projected)',
        responses: {
          '200': { description: 'Revenue breakdown by agent, month, stage' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/analytics/events/replay': {
      get: {
        tags: ['Analytics', 'Events'],
        summary: 'Event replay — debug event stream',
        description: 'Replays learning_events with rich filtering. Used for debugging automation flows and auditing.',
        parameters: [
          { name: 'correlation_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'session_id',     in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'event_type',     in: 'query', schema: { type: 'string' } },
          { name: 'lead_id',        in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'deal_id',        in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'since',          in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'until',          in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit',          in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } },
          { name: 'order',          in: 'query', schema: { type: 'string', enum: ['asc','desc'], default: 'asc' } },
        ],
        responses: {
          '200': { description: 'Events + replay metadata' },
          '400': { description: 'At least one filter required' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── AUTOMATION ───────────────────────────────────────────────────────────
    '/api/automation/revenue-loop': {
      post: {
        tags: ['Automation'],
        summary: 'Revenue loop — main automation cycle',
        description: `
Executes the full revenue automation cycle:
1. Deal health scoring
2. Priority item generation (≥80 = HIGH, 60-79 = MEDIUM, <60 = LOW)
3. Dormant lead detection
4. Auto-trigger deal packs for HIGH-score matches
5. Follow-up scheduling
6. n8n workflow health check (self-healing)
7. Revenue reporting
        `.trim(),
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Cycle report with insights and statistics' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      get: {
        tags: ['Automation'],
        summary: 'Revenue loop — GET alias (Vercel cron compatible)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Cycle report' },
        },
      },
    },

    '/api/automation/match-buyer': {
      post: {
        tags: ['Automation'],
        summary: 'Match buyer to properties',
        description: 'Scores all active properties against a buyer contact profile. Uses pgvector semantic similarity + rule-based scoring.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lead_id'],
                properties: {
                  lead_id:      { type: 'string', format: 'uuid' },
                  top_n:        { type: 'integer', default: 5 },
                  auto_pack:    { type: 'boolean', default: false, description: 'Auto-generate deal pack if score ≥ 80' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Scored matches list' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/automation/daily-brief': {
      get: {
        tags: ['Automation'],
        summary: 'Daily AI brief for agent',
        description: 'Returns AI-generated daily action brief: deals at risk, closing soon, weighted pipeline GCI, recommended actions.',
        responses: {
          '200': { description: 'Daily brief with AI recommendations' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── PRIORITY ─────────────────────────────────────────────────────────────
    '/api/priority': {
      get: {
        tags: ['Priority'],
        summary: 'Get open priority items',
        description: 'Returns agent\'s priority action queue sorted by score DESC, deadline ASC.',
        parameters: [
          { name: 'agent_email', in: 'query', schema: { type: 'string', format: 'email' } },
          { name: 'status',      in: 'query', schema: { type: 'string', enum: ['open','in_progress','resolved','dismissed'] } },
          { name: 'limit',       in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Priority items list', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PriorityItem' } } } } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get notifications for agent',
        responses: {
          '200': { description: 'Notification list' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Notifications'],
        summary: 'Mark notifications as read',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ids:      { type: 'array', items: { type: 'string', format: 'uuid' } },
                  markAll:  { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Notifications marked read' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── SYSTEM ────────────────────────────────────────────────────────────────
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Basic health check',
        security: [],
        responses: {
          '200': { description: 'Service healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
        },
      },
    },

    '/api/system/state': {
      get: {
        tags: ['System'],
        summary: 'Full system health (6-layer Control Tower)',
        description: 'Returns health status across: Auth, Database, AI, Event Bus, Revenue Engine, Workflow layers.',
        responses: {
          '200': { description: '6-layer system state with anomaly detection' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/docs': {
      get: {
        tags: ['System'],
        summary: 'This OpenAPI specification',
        responses: {
          '200': { description: 'OpenAPI 3.1 JSON spec' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── AUTH ─────────────────────────────────────────────────────────────────
    '/api/auth/send': {
      post: {
        tags: ['Auth'],
        summary: 'Send magic-link email',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } },
        },
        responses: {
          '200': { description: 'Magic link sent (rate limited: 5/15min)' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },

    '/api/auth/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify magic-link token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Token valid — sets ag-auth-token cookie' },
          '401': { description: 'Invalid or expired token' },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        responses: {
          '200': { description: 'Current user info', content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, via: { type: 'string' } } } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },

  // ── Tags ───────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Deals',        description: 'Pipeline deal management — CRUD + stage transitions' },
    { name: 'Contacts',     description: 'Buyer/seller contact management + buyer intelligence' },
    { name: 'Properties',   description: 'Property listings + AI semantic search + AVM' },
    { name: 'Deal Packs',   description: 'AI-generated investment presentations + view tracking' },
    { name: 'Matches',      description: 'Buyer-property matching engine (score ≥80 = HIGH)' },
    { name: 'Analytics',    description: 'Revenue forecasting + KPIs + event replay' },
    { name: 'Automation',   description: 'Revenue loop + match-buyer + daily brief + n8n' },
    { name: 'Priority',     description: 'AI-driven action queue — revenue-first prioritization' },
    { name: 'Notifications',description: 'Agent notification inbox + push subscriptions' },
    { name: 'Auth',         description: 'Magic-link + NextAuth + service token authentication' },
    { name: 'System',       description: 'Health checks + 6-layer Control Tower' },
  ],
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth check — internal docs only
  const auth = await requirePortalAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-store',
      'X-Doc-Version': '2.0.0',
    },
  })
}
