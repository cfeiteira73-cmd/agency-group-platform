// =============================================================================
// Agency Group — Event Schema Registry
// lib/events/schemaRegistry.ts
//
// In-memory schema versioning with backward-compatibility validation.
// Backed by a JSON-serializable store that can be persisted to Supabase
// event_schema_registry table.
//
// Pre-populated with v1 schemas derived from lib/events/types.ts.
// TypeScript strict — 0 errors
// =============================================================================

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FieldSchema {
  type:         string
  required:     boolean
  description?: string
}

export interface EventSchema {
  topic:              string
  event_type:         string
  version:            number
  fields:             Record<string, FieldSchema>
  breaking_changes:   number[]  // versions that introduced breaking changes
  deprecated_fields:  string[]
}

export interface SchemaValidationResult {
  valid:             boolean
  version:           number
  errors:            string[]
  warnings:          string[]
  is_breaking_change: boolean
}

// ─── Registry key helper ──────────────────────────────────────────────────────

function registryKey(topic: string, event_type: string, version: number): string {
  return `${topic}::${event_type}::${version}`
}

function latestKey(topic: string, event_type: string): string {
  return `${topic}::${event_type}`
}

// ─── EventSchemaRegistry class ────────────────────────────────────────────────

export class EventSchemaRegistry {
  /** Versioned schemas: key = 'topic::event_type::version' */
  private readonly schemas = new Map<string, EventSchema>()
  /** Latest version tracker: key = 'topic::event_type' */
  private readonly latestVersions = new Map<string, number>()

  // ─── Mutation ──────────────────────────────────────────────────────────────

  /**
   * Registers a schema version. If a schema with the same topic+event_type+version
   * already exists, it is replaced (upsert semantics for bootstrapping).
   */
  register(schema: EventSchema): void {
    const versionedKey = registryKey(schema.topic, schema.event_type, schema.version)
    this.schemas.set(versionedKey, schema)

    const lk      = latestKey(schema.topic, schema.event_type)
    const current = this.latestVersions.get(lk) ?? 0
    if (schema.version > current) {
      this.latestVersions.set(lk, schema.version)
    }
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * Returns the schema for the given topic+event_type+version.
   * If version is omitted, returns the latest registered version.
   */
  getSchema(
    topic:       string,
    event_type:  string,
    version?:    number,
  ): EventSchema | null {
    const v = version ?? this.getLatestVersion(topic, event_type)
    if (v === 0) return null
    return this.schemas.get(registryKey(topic, event_type, v)) ?? null
  }

  /**
   * Returns the highest registered version number for a given event type.
   * Returns 0 if no schema has been registered.
   */
  getLatestVersion(topic: string, event_type: string): number {
    return this.latestVersions.get(latestKey(topic, event_type)) ?? 0
  }

  /**
   * Returns true if transitioning from oldVersion → newVersion does NOT
   * introduce a breaking change according to the newVersion schema's
   * breaking_changes array.
   */
  isBackwardCompatible(
    oldVersion: number,
    newVersion: number,
    topic:      string,
    event_type: string,
  ): boolean {
    if (newVersion <= oldVersion) return true
    const newSchema = this.getSchema(topic, event_type, newVersion)
    if (!newSchema) return false
    // A breaking change exists if any version in the range (oldVersion, newVersion]
    // is listed in breaking_changes
    return !newSchema.breaking_changes.some(
      (v) => v > oldVersion && v <= newVersion,
    )
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  /**
   * Validates an unknown event object against the registered schema.
   *
   * - Checks all required fields are present and have the expected type
   * - Warns about deprecated fields present in the payload
   * - Flags unknown fields as warnings (not errors) for forward compatibility
   */
  validate(
    event:      unknown,
    topic:      string,
    event_type: string,
  ): SchemaValidationResult {
    const version = this.getLatestVersion(topic, event_type)

    if (version === 0) {
      return {
        valid:              true,   // unknown schema → pass-through (open schema)
        version:            0,
        errors:             [],
        warnings:           [`No schema registered for ${topic}::${event_type} — skipping validation`],
        is_breaking_change: false,
      }
    }

    const schema = this.getSchema(topic, event_type, version)!
    const errors:   string[] = []
    const warnings: string[] = []

    if (!event || typeof event !== 'object') {
      return {
        valid:              false,
        version,
        errors:             ['event must be a non-null object'],
        warnings:           [],
        is_breaking_change: false,
      }
    }

    const payload = event as Record<string, unknown>

    // Check required fields
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const value = payload[fieldName]

      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`Required field "${fieldName}" is missing or null`)
        continue
      }

      if (value !== undefined && value !== null) {
        if (!checkType(value, fieldSchema.type)) {
          errors.push(
            `Field "${fieldName}" expected type "${fieldSchema.type}", got "${typeof value}"`,
          )
        }
      }
    }

    // Warn about deprecated fields
    for (const deprecated of schema.deprecated_fields) {
      if (deprecated in payload) {
        warnings.push(`Field "${deprecated}" is deprecated and will be removed in a future version`)
      }
    }

    // Warn about unknown fields (forward-compatibility signal)
    for (const key of Object.keys(payload)) {
      if (!(key in schema.fields)) {
        warnings.push(`Unknown field "${key}" not in schema — forward-compatible if non-breaking`)
      }
    }

    // Determine if this event uses a version that introduced a breaking change
    const eventVersion = typeof payload['schema_version'] === 'number'
      ? (payload['schema_version'] as number)
      : 1
    const is_breaking_change = schema.breaking_changes.includes(eventVersion)

    return {
      valid:  errors.length === 0,
      version,
      errors,
      warnings,
      is_breaking_change,
    }
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Returns all registered schemas as a plain array, suitable for
   * JSON serialization and Supabase persistence.
   */
  export(): EventSchema[] {
    return Array.from(this.schemas.values())
  }

  /**
   * Bulk-loads schemas from a serialized array (e.g. from Supabase row data).
   */
  importAll(schemas: EventSchema[]): void {
    for (const s of schemas) this.register(s)
  }
}

// ─── Type check helper ────────────────────────────────────────────────────────

function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':  return typeof value === 'string'
    case 'number':  return typeof value === 'number'
    case 'boolean': return typeof value === 'boolean'
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array':   return Array.isArray(value)
    case 'string|null':  return typeof value === 'string' || value === null
    case 'number|null':  return typeof value === 'number' || value === null
    case 'boolean|null': return typeof value === 'boolean' || value === null
    case 'object|null':  return (typeof value === 'object' && !Array.isArray(value))
    case 'array|null':   return Array.isArray(value) || value === null
    default: return true  // unknown type constraint → pass
  }
}

// ─── Pre-populate registry ────────────────────────────────────────────────────

/**
 * Singleton global schema registry.
 * Pre-registered with all known v1 event shapes from lib/events/types.ts.
 */
export const globalSchemaRegistry = new EventSchemaRegistry()

// BaseEvent fields shared by all events
const BASE_FIELDS: Record<string, FieldSchema> = {
  event_id:        { type: 'string',      required: true,  description: 'UUID v4 globally unique event identifier' },
  event_type:      { type: 'string',      required: true,  description: 'Event type discriminator' },
  occurred_at:     { type: 'string',      required: true,  description: 'ISO timestamp of occurrence' },
  correlation_id:  { type: 'string|null', required: true,  description: 'Distributed tracing correlation ID' },
  tenant_id:       { type: 'string',      required: true,  description: 'Multi-tenant isolation key' },
  source_system:   { type: 'string',      required: true,  description: 'Origin system: api|n8n|cron|engine|agent' },
  schema_version:  { type: 'string',      required: true,  description: 'Schema version string (e.g. "1.0")' },
  idempotency_key: { type: 'string',      required: false, description: 'Optional idempotency key' },
  partition_key:   { type: 'string',      required: false, description: 'Kafka partition key' },
  global_seq:      { type: 'number',      required: false, description: 'Global monotonic sequence' },
  replay_token:    { type: 'string',      required: false, description: 'SHA-256 replay dedup token' },
  region:          { type: 'string',      required: false, description: 'Originating region' },
  logical_timestamp:{ type: 'number',     required: false, description: 'Lamport logical clock' },
}

// Helper to register a v1 schema
function reg(
  topic:      string,
  event_type: string,
  extra:      Record<string, FieldSchema>,
): void {
  globalSchemaRegistry.register({
    topic,
    event_type,
    version:           1,
    fields:            { ...BASE_FIELDS, payload: { type: 'object', required: true }, ...extra },
    breaking_changes:  [],
    deprecated_fields: [],
  })
}

// ─── Deal events ──────────────────────────────────────────────────────────────

reg('deal-events', 'deal_created', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.fase':        { type: 'string|null', required: false },
  'payload.ref':         { type: 'string|null', required: false },
  'payload.imovel':      { type: 'string|null', required: false },
  'payload.valor':       { type: 'number|null', required: false },
})

reg('deal-events', 'deal_updated', {
  'payload.deal_id':       { type: 'string',      required: true  },
  'payload.field_changed': { type: 'string',      required: true  },
  'payload.old_value':     { type: 'object',      required: false },
  'payload.new_value':     { type: 'object',      required: false },
  'payload.updated_by':    { type: 'string|null', required: false },
})

reg('deal-events', 'deal_stage_advanced', {
  'payload.deal_id':    { type: 'string',      required: true  },
  'payload.from_stage': { type: 'string|null', required: false },
  'payload.to_stage':   { type: 'string',      required: true  },
  'payload.agent_email':{ type: 'string|null', required: false },
  'payload.deal_value': { type: 'number|null', required: false },
})

reg('deal-events', 'deal_closed', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.deal_ref':    { type: 'string|null', required: false },
  'payload.deal_value':  { type: 'number|null', required: false },
})

reg('deal-events', 'deal_rejected', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.deal_ref':    { type: 'string|null', required: false },
  'payload.reason':      { type: 'string|null', required: false },
})

reg('deal-events', 'proposal_sent', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.deal_ref':    { type: 'string|null', required: false },
  'payload.fase':        { type: 'string|null', required: false },
})

reg('deal-events', 'cpcv_signed', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.deal_ref':    { type: 'string|null', required: false },
  'payload.deal_value':  { type: 'number|null', required: false },
})

reg('deal-events', 'call_booked', {
  'payload.deal_id':     { type: 'string|null', required: false },
  'payload.agent_email': { type: 'string|null', required: false },
  'payload.deal_ref':    { type: 'string|null', required: false },
  'payload.fase':        { type: 'string|null', required: false },
})

reg('deal-events', 'deal_lineage_traced', {
  'payload.deal_id':          { type: 'string',      required: true  },
  'payload.lead_id':          { type: 'string|null', required: false },
  'payload.property_id':      { type: 'string|null', required: false },
  'payload.investor_id':      { type: 'string|null', required: false },
  'payload.revenue_event_id': { type: 'string|null', required: false },
  'payload.chain_complete':   { type: 'boolean',     required: true  },
})

// ─── Revenue events ───────────────────────────────────────────────────────────

reg('revenue-events', 'revenue_recognized', {
  'payload.deal_id':       { type: 'string|null', required: false },
  'payload.amount_eur':    { type: 'number',      required: true  },
  'payload.commission_eur':{ type: 'number|null', required: false },
  'payload.agent_email':   { type: 'string|null', required: false },
  'payload.zona':          { type: 'string|null', required: false },
  'payload.recognized_at': { type: 'string',      required: true  },
})

reg('revenue-events', 'commission_calculated', {
  'payload.deal_id':          { type: 'string|null', required: false },
  'payload.commission_id':    { type: 'string',      required: true  },
  'payload.gross_eur':        { type: 'number',      required: true  },
  'payload.net_eur':          { type: 'number',      required: true  },
  'payload.agency_split_eur': { type: 'number',      required: true  },
  'payload.agent_split_eur':  { type: 'number',      required: true  },
  'payload.rate':             { type: 'number',      required: true  },
  'payload.tier':             { type: 'string',      required: true  },
  'payload.agent_email':      { type: 'string|null', required: false },
})

reg('revenue-events', 'client_milestone_reached', {
  'payload.milestone_type': { type: 'string',      required: true  },
  'payload.deal_id':        { type: 'string|null', required: false },
  'payload.contact_id':     { type: 'string|null', required: false },
  'payload.title':          { type: 'string',      required: true  },
})

// ─── Property events ──────────────────────────────────────────────────────────

reg('property-events', 'property_ingested', {
  'payload.property_id':  { type: 'string',      required: true  },
  'payload.source':       { type: 'string|null', required: false },
  'payload.listing_url':  { type: 'string|null', required: false },
  'payload.price_eur':    { type: 'number|null', required: false },
  'payload.zona':         { type: 'string|null', required: false },
  'payload.type':         { type: 'string|null', required: false },
})

reg('property-events', 'property_normalized', {
  'payload.property_id':    { type: 'string',      required: true  },
  'payload.provider':       { type: 'string',      required: true  },
  'payload.price':          { type: 'number',      required: true  },
  'payload.city':           { type: 'string|null', required: false },
  'payload.area_m2':        { type: 'number|null', required: false },
  'payload.normalized_at':  { type: 'string',      required: true  },
})

reg('property-events', 'property_enriched', {
  'payload.property_id':     { type: 'string',      required: true  },
  'payload.price_per_m2':    { type: 'number|null', required: false },
  'payload.investment_tier': { type: 'string|null', required: false },
  'payload.geo_tier':        { type: 'string|null', required: false },
  'payload.enriched_at':     { type: 'string',      required: true  },
})

reg('property-events', 'property_scored', {
  'payload.property_id':       { type: 'string',      required: true  },
  'payload.opportunity_score': { type: 'number',      required: true  },
  'payload.previous_score':    { type: 'number|null', required: false },
  'payload.score_reason':      { type: 'string|null', required: false },
  'payload.investor_suitable': { type: 'boolean',     required: true  },
})

// ─── Investor events ──────────────────────────────────────────────────────────

reg('investor-events', 'investor_created', {
  'payload.investor_id':    { type: 'string',  required: true  },
  'payload.investor_type':  { type: 'string',  required: true  },
  'payload.capital_min_eur':{ type: 'number|null', required: false },
  'payload.capital_max_eur':{ type: 'number|null', required: false },
  'payload.geography':      { type: 'array',   required: true  },
  'payload.risk_tolerance': { type: 'string',  required: true  },
  'payload.tenant_id':      { type: 'string',  required: true  },
})

reg('investor-events', 'match_created', {
  'payload.lead_id':                { type: 'string',      required: true  },
  'payload.match_score':            { type: 'number',      required: true  },
  'payload.matched_buyers_count':   { type: 'number',      required: true  },
  'payload.deal_priority_score':    { type: 'number|null', required: false },
  'payload.attack_recommendation':  { type: 'string|null', required: false },
})

reg('investor-events', 'distribution_sent', {
  'payload.property_id':        { type: 'string',      required: true  },
  'payload.distribution_tier':  { type: 'string|null', required: false },
  'payload.recipient_count':    { type: 'number',      required: true  },
  'payload.opportunity_grade':  { type: 'string|null', required: false },
  'payload.opportunity_score':  { type: 'number|null', required: false },
})

reg('investor-events', 'distribution_accepted', {
  'payload.distribution_event_id': { type: 'string',      required: true  },
  'payload.property_id':           { type: 'string',      required: true  },
  'payload.recipient_email':       { type: 'string',      required: true  },
  'payload.recipient_type':        { type: 'string',      required: true  },
  'payload.response_time_hours':   { type: 'number|null', required: false },
})

reg('investor-events', 'distribution_rejected', {
  'payload.distribution_event_id': { type: 'string',      required: true  },
  'payload.property_id':           { type: 'string',      required: true  },
  'payload.recipient_email':       { type: 'string|null', required: false },
  'payload.rejection_category':    { type: 'string',      required: true  },
  'payload.rejection_reason':      { type: 'string|null', required: false },
})

reg('investor-events', 'referral_created', {
  'payload.referrer_email': { type: 'string|null', required: false },
  'payload.referred_email': { type: 'string|null', required: false },
  'payload.source':         { type: 'string',      required: true  },
  'payload.deal_id':        { type: 'string|null', required: false },
})

// ─── Lead events ──────────────────────────────────────────────────────────────

reg('lead-events', 'lead_created', {
  'payload.lead_id':    { type: 'string',      required: true  },
  'payload.nome':       { type: 'string',      required: true  },
  'payload.source':     { type: 'string|null', required: false },
  'payload.assigned_to':{ type: 'string|null', required: false },
  'payload.score':      { type: 'number|null', required: false },
  'payload.cidade':     { type: 'string|null', required: false },
})

reg('lead-events', 'lead_qualified', {
  'payload.lead_id':       { type: 'string',      required: true  },
  'payload.qualified_by':  { type: 'string',      required: true  },
  'payload.score':         { type: 'number|null', required: false },
  'payload.budget_min':    { type: 'number|null', required: false },
  'payload.budget_max':    { type: 'number|null', required: false },
  'payload.zona':          { type: 'string|null', required: false },
})

reg('lead-events', 'lead_scored', {
  'payload.lead_id':        { type: 'string',      required: true  },
  'payload.score':          { type: 'number',      required: true  },
  'payload.score_breakdown':{ type: 'object|null', required: false },
  'payload.previous_score': { type: 'number|null', required: false },
  'payload.scored_by':      { type: 'string',      required: true  },
})

// ─── AI events ────────────────────────────────────────────────────────────────

reg('ai-events', 'ai_requested', {
  'payload.correlation_id':    { type: 'string',      required: true  },
  'payload.component':         { type: 'string',      required: true  },
  'payload.model':             { type: 'string|null', required: false },
  'payload.estimated_tokens':  { type: 'number|null', required: false },
  'payload.revenue_context':   { type: 'string|null', required: false },
})

reg('ai-events', 'ai_executed', {
  'payload.correlation_id':  { type: 'string',  required: true  },
  'payload.component':       { type: 'string',  required: true  },
  'payload.model':           { type: 'string',  required: true  },
  'payload.input_tokens':    { type: 'number',  required: true  },
  'payload.output_tokens':   { type: 'number',  required: true  },
  'payload.latency_ms':      { type: 'number',  required: true  },
  'payload.success':         { type: 'boolean', required: true  },
  'payload.fallback_used':   { type: 'boolean', required: true  },
})

reg('ai-events', 'ai_billed', {
  'payload.correlation_id':  { type: 'string', required: true },
  'payload.component':       { type: 'string', required: true },
  'payload.cost_usd':        { type: 'number', required: true },
  'payload.input_tokens':    { type: 'number', required: true },
  'payload.output_tokens':   { type: 'number', required: true },
  'payload.billing_period':  { type: 'string', required: true },
})

// ─── System events ────────────────────────────────────────────────────────────

reg('system-events', 'system_failure', {
  'payload.failure_type':             { type: 'string',      required: true  },
  'payload.component':                { type: 'string',      required: true  },
  'payload.severity':                 { type: 'string',      required: true  },
  'payload.error_message':            { type: 'string',      required: true  },
  'payload.error_code':               { type: 'string|null', required: false },
  'payload.auto_recovery_attempted':  { type: 'boolean',     required: true  },
})

reg('system-events', 'system_recovery', {
  'payload.failure_event_id': { type: 'string|null', required: false },
  'payload.component':        { type: 'string',      required: true  },
  'payload.recovery_type':    { type: 'string',      required: true  },
  'payload.recovery_time_ms': { type: 'number|null', required: false },
  'payload.recovered_at':     { type: 'string',      required: true  },
})

reg('system-events', 'anomaly_detected', {
  'payload.anomaly_type':  { type: 'string',      required: true  },
  'payload.entity_type':   { type: 'string',      required: true  },
  'payload.entity_id':     { type: 'string|null', required: false },
  'payload.severity':      { type: 'string',      required: true  },
  'payload.description':   { type: 'string',      required: true  },
  'payload.metric_value':  { type: 'number|null', required: false },
})

reg('system-events', 'leakage_detected', {
  'payload.lead_id':          { type: 'string|null', required: false },
  'payload.deal_id':          { type: 'string|null', required: false },
  'payload.leakage_type':     { type: 'string',      required: true  },
  'payload.revenue_at_risk':  { type: 'number|null', required: false },
  'payload.severity':         { type: 'string',      required: true  },
})

// ─── Governance events ────────────────────────────────────────────────────────

reg('governance-events', 'model_promoted', {
  'payload.model_name':      { type: 'string',      required: true  },
  'payload.old_version':     { type: 'string|null', required: false },
  'payload.new_version':     { type: 'string',      required: true  },
  'payload.accuracy_before': { type: 'number|null', required: false },
  'payload.accuracy_after':  { type: 'number|null', required: false },
  'payload.promoted_by':     { type: 'string|null', required: false },
})

reg('governance-events', 'rollback_triggered', {
  'payload.model_name':         { type: 'string',      required: true  },
  'payload.from_version':       { type: 'string',      required: true  },
  'payload.to_version':         { type: 'string',      required: true  },
  'payload.reason':             { type: 'string',      required: true  },
  'payload.accuracy_drop_pct':  { type: 'number|null', required: false },
})

reg('governance-events', 'governance_override', {
  'payload.override_id':  { type: 'string',      required: true  },
  'payload.user_email':   { type: 'string',      required: true  },
  'payload.user_role':    { type: 'string',      required: true  },
  'payload.action_type':  { type: 'string',      required: true  },
  'payload.resource_id':  { type: 'string|null', required: false },
  'payload.reason':       { type: 'string',      required: true  },
})

// ─── Intelligence events ──────────────────────────────────────────────────────

reg('intelligence-events', 'market_snapshot_generated', {
  'payload.snapshot_id':        { type: 'string',  required: true },
  'payload.active_properties':  { type: 'number',  required: true },
  'payload.total_investors':    { type: 'number',  required: true },
  'payload.liquidity_ratio':    { type: 'number',  required: true },
  'payload.avg_match_score':    { type: 'number',  required: true },
  'payload.snapshot_date':      { type: 'string',  required: true },
  'payload.tenant_id':          { type: 'string',  required: true },
})

// =============================================================================
// Schema evolution — backward compatibility, evolution rules, and stats
// =============================================================================

// ─── SCHEMA_REGISTRY flat map for event_type → latest EventSchema ─────────────
// Built lazily from globalSchemaRegistry for O(1) lookups by event_type alone.

function buildEventTypeIndex(): Map<string, EventSchema> {
  const idx = new Map<string, EventSchema>()
  for (const schema of globalSchemaRegistry.export()) {
    const existing = idx.get(schema.event_type)
    if (!existing || schema.version > existing.version) {
      idx.set(schema.event_type, schema)
    }
  }
  return idx
}

// ─── Export 1: validateBackwardCompatibility ─────────────────────────────────

export function validateBackwardCompatibility(
  eventType: string,
  incomingPayload: Record<string, unknown>,
): {
  compatible:             boolean
  breaking_changes:       string[]
  missing_required_fields: string[]
  extra_fields:           string[]
} {
  const idx    = buildEventTypeIndex()
  const schema = idx.get(eventType)

  if (!schema) {
    return {
      compatible:              true,
      breaking_changes:        [],
      missing_required_fields: [],
      extra_fields:            [],
    }
  }

  const knownFields      = Object.keys(schema.fields)
  const requiredFields   = knownFields.filter((k) => schema.fields[k].required)

  const missing_required_fields: string[] = []
  const breaking_changes:        string[] = []

  for (const field of requiredFields) {
    const val = incomingPayload[field]
    if (val === undefined || val === null) {
      missing_required_fields.push(field)
      breaking_changes.push(`Required field "${field}" is absent — breaking change`)
    }
  }

  const extra_fields = Object.keys(incomingPayload).filter(
    (k) => !knownFields.includes(k),
  )

  return {
    compatible: breaking_changes.length === 0,
    breaking_changes,
    missing_required_fields,
    extra_fields,
  }
}

// ─── Export 2: Schema evolution registry ─────────────────────────────────────

interface EvolutionRule {
  eventType:     string
  fromVersion:   string
  toVersion:     string
  migration:     (payload: Record<string, unknown>) => Record<string, unknown>
  breakingChange: boolean
  registeredAt:  string
}

// In-memory store for evolution rules
// Key = `${eventType}::${fromVersion}::${toVersion}`
const evolutionRules = new Map<string, EvolutionRule>()

export function registerSchemaEvolution(
  eventType:     string,
  fromVersion:   string,
  toVersion:     string,
  migration:     (payload: Record<string, unknown>) => Record<string, unknown>,
  breakingChange: boolean,
): void {
  const key = `${eventType}::${fromVersion}::${toVersion}`
  evolutionRules.set(key, {
    eventType,
    fromVersion,
    toVersion,
    migration,
    breakingChange,
    registeredAt: new Date().toISOString(),
  })
}

export function migratePayload(
  eventType:   string,
  fromVersion: string,
  toVersion:   string,
  payload:     Record<string, unknown>,
): Record<string, unknown> {
  const key  = `${eventType}::${fromVersion}::${toVersion}`
  const rule = evolutionRules.get(key)
  if (!rule) return payload
  return rule.migration(payload)
}

// ─── Export 3: getSchemaStats ─────────────────────────────────────────────────

export function getSchemaStats(): {
  total_event_types:    number
  evolution_rules_count: number
  registered_at:        string
} {
  const idx = buildEventTypeIndex()
  return {
    total_event_types:    idx.size,
    evolution_rules_count: evolutionRules.size,
    registered_at:        new Date().toISOString(),
  }
}
