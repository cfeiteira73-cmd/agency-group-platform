// =============================================================================
// Agency Group — /api/events/schema-registry
// app/api/events/schema-registry/route.ts
//
// GET  /api/events/schema-registry?topic=deal-events&event_type=deal_closed
//   → Returns the latest registered schema for that event type.
//   Optional: &version=N  to fetch a specific version.
//
// GET  /api/events/schema-registry?topic=deal-events&event_type=deal_closed&history=true
//   → Returns all registered versions for that event type.
//
// POST /api/events/schema-registry
//   Body: EventSchema JSON
//   → Registers a new schema version (persists to Supabase + in-memory registry).
//   Responds 409 if the same topic+event_type+version already exists.
//
// Auth: INTERNAL_API_SECRET (all methods)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }    from 'next/server'
import { supabaseAdmin }                from '@/lib/supabase'
import {
  globalSchemaRegistry,
  type EventSchema,
  type SchemaValidationResult,
} from '@/lib/events/schemaRegistry'

// ─── Auth guard ───────────────────────────────────────────────────────────────

function assertInternalAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return null  // not configured → open (dev mode only)

  const header    = req.headers.get('authorization') ?? ''
  const bearerVal = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const queryVal  = req.nextUrl.searchParams.get('secret') ?? ''

  if (bearerVal !== secret && queryVal !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized — INTERNAL_API_SECRET required' },
      { status: 401 },
    )
  }
  return null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authErr = assertInternalAuth(req)
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const topic      = searchParams.get('topic')
  const event_type = searchParams.get('event_type')
  const versionStr = searchParams.get('version')
  const history    = searchParams.get('history') === 'true'

  // ── List all schemas (no filters) ──────────────────────────────────────────
  if (!topic && !event_type) {
    const all = globalSchemaRegistry.export()
    return NextResponse.json({ schemas: all, count: all.length })
  }

  if (!topic || !event_type) {
    return NextResponse.json(
      { error: 'Both ?topic and ?event_type are required when filtering' },
      { status: 400 },
    )
  }

  // ── Version history ────────────────────────────────────────────────────────
  if (history) {
    const all = globalSchemaRegistry.export().filter(
      s => s.topic === topic && s.event_type === event_type,
    )
    return NextResponse.json({
      topic,
      event_type,
      versions:      all.sort((a, b) => a.version - b.version),
      latestVersion: globalSchemaRegistry.getLatestVersion(topic, event_type),
    })
  }

  // ── Single version lookup ──────────────────────────────────────────────────
  const version = versionStr ? parseInt(versionStr, 10) : undefined

  if (versionStr && (isNaN(version!) || version! <= 0)) {
    return NextResponse.json({ error: 'version must be a positive integer' }, { status: 400 })
  }

  const schema = globalSchemaRegistry.getSchema(topic, event_type, version)

  if (!schema) {
    return NextResponse.json(
      { error: `Schema not found for ${topic}::${event_type}${version ? `::v${version}` : ''}` },
      { status: 404 },
    )
  }

  const latestVersion = globalSchemaRegistry.getLatestVersion(topic, event_type)
  const isLatest      = schema.version === latestVersion

  return NextResponse.json({
    schema,
    latestVersion,
    isLatest,
    isBackwardCompatible: schema.version > 1
      ? globalSchemaRegistry.isBackwardCompatible(
          schema.version - 1,
          schema.version,
          topic,
          event_type,
        )
      : true,
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authErr = assertInternalAuth(req)
  if (authErr) return authErr

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required shape
  const schema = body as Partial<EventSchema>

  if (!schema.topic || typeof schema.topic !== 'string') {
    return NextResponse.json({ error: 'schema.topic is required' }, { status: 400 })
  }
  if (!schema.event_type || typeof schema.event_type !== 'string') {
    return NextResponse.json({ error: 'schema.event_type is required' }, { status: 400 })
  }
  if (typeof schema.version !== 'number' || schema.version <= 0) {
    return NextResponse.json({ error: 'schema.version must be a positive integer' }, { status: 400 })
  }
  if (!schema.fields || typeof schema.fields !== 'object') {
    return NextResponse.json({ error: 'schema.fields is required (object)' }, { status: 400 })
  }

  const fullSchema: EventSchema = {
    topic:             schema.topic,
    event_type:        schema.event_type,
    version:           schema.version,
    fields:            schema.fields,
    breaking_changes:  Array.isArray(schema.breaking_changes) ? schema.breaking_changes : [],
    deprecated_fields: Array.isArray(schema.deprecated_fields) ? schema.deprecated_fields : [],
  }

  // Check for duplicate in Supabase
  const { data: existing, error: checkErr } = await (supabaseAdmin as unknown as {
    from(t: string): {
      select(c: string): {
        eq(col: string, val: string): {
          eq(col: string, val: string): {
            eq(col: string, val: number): {
              single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
            }
          }
        }
      }
    }
  })
    .from('event_schema_registry')
    .select('id')
    .eq('topic', fullSchema.topic)
    .eq('event_type', fullSchema.event_type)
    .eq('version', fullSchema.version)
    .single()

  if (checkErr && !checkErr.message.includes('No rows found') && !checkErr.message.includes('PGRST116')) {
    return NextResponse.json(
      { error: `Database check failed: ${checkErr.message}` },
      { status: 500 },
    )
  }

  if (existing) {
    return NextResponse.json(
      {
        error:   'Schema version already registered',
        topic:   fullSchema.topic,
        event_type: fullSchema.event_type,
        version: fullSchema.version,
      },
      { status: 409 },
    )
  }

  // Backward-compatibility check
  const currentLatest = globalSchemaRegistry.getLatestVersion(
    fullSchema.topic,
    fullSchema.event_type,
  )
  const isBreaking = currentLatest > 0 && !globalSchemaRegistry.isBackwardCompatible(
    currentLatest,
    fullSchema.version,
    fullSchema.topic,
    fullSchema.event_type,
  )

  // Persist to Supabase
  const { error: insertErr } = await (supabaseAdmin as unknown as {
    from(t: string): {
      insert(r: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    }
  })
    .from('event_schema_registry')
    .insert({
      topic:          fullSchema.topic,
      event_type:     fullSchema.event_type,
      version:        fullSchema.version,
      schema:         fullSchema,
      is_breaking:    isBreaking,
      registered_by:  req.headers.get('x-service-name') ?? 'api',
      registered_at:  new Date().toISOString(),
    })

  if (insertErr) {
    // Duplicate key race condition → 409
    if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Schema version already registered (race condition)' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: `Failed to persist schema: ${insertErr.message}` },
      { status: 500 },
    )
  }

  // Register in in-memory registry
  globalSchemaRegistry.register(fullSchema)

  // Validate result
  const validationResult: SchemaValidationResult = {
    valid:              true,
    version:            fullSchema.version,
    errors:             [],
    warnings:           isBreaking ? [`This version introduces a breaking change over v${currentLatest}`] : [],
    is_breaking_change: isBreaking,
  }

  return NextResponse.json(
    {
      registered:           true,
      schema:               fullSchema,
      latestVersion:        globalSchemaRegistry.getLatestVersion(fullSchema.topic, fullSchema.event_type),
      isBreakingChange:     isBreaking,
      validationResult,
    },
    { status: 201 },
  )
}
