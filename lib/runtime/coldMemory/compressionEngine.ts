// AGENCY GROUP — SH-ROS Cold Memory: compressionEngine | AMI: 22506

export interface CompressionResult {
  compressed: string
  algorithm: 'json_delta' | 'field_omission'
  original_size: number
  compressed_size: number
  ratio: number
}

// Field aliases for common long field names
const FIELD_ALIASES: Record<string, string> = {
  correlation_id: 'cid', event_id: 'eid', org_id: 'oid',
  created_at: 'cat', updated_at: 'uat', source_system: 'ss',
  schema_version: 'sv', financial_impact: 'fi', revenue_impact_eur: 'ri',
}
const ALIAS_REVERSE = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([k, v]) => [v, k]))

export class CompressionEngine {
  compress(data: Record<string, unknown>): CompressionResult {
    const original = JSON.stringify(data)

    // Step 1: remove null/undefined values
    const cleaned = this._stripNulls(data)

    // Step 2: apply field aliases
    const aliased = this._applyAliases(cleaned, FIELD_ALIASES)

    // Step 3: truncate long strings
    const truncated = this._truncateStrings(aliased, 500)

    const compressed = JSON.stringify(truncated)

    return {
      compressed,
      algorithm:        'field_omission',
      original_size:    original.length,
      compressed_size:  compressed.length,
      ratio: original.length > 0 ? parseFloat((1 - compressed.length / original.length).toFixed(3)) : 0,
    }
  }

  decompress(compressed: string, _algorithm: string): Record<string, unknown> {
    try {
      const data = JSON.parse(compressed) as Record<string, unknown>
      return this._applyAliases(data, ALIAS_REVERSE) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  estimateSize(data: Record<string, unknown>): number {
    return JSON.stringify(data).length
  }

  private _stripNulls(obj: unknown): unknown {
    if (obj === null || obj === undefined) return undefined
    if (typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(v => this._stripNulls(v)).filter(v => v !== undefined)

    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const stripped = this._stripNulls(v)
      if (stripped !== undefined) result[k] = stripped
    }
    return result
  }

  private _applyAliases(obj: unknown, aliases: Record<string, string>): unknown {
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) return obj.map(v => this._applyAliases(v, aliases))

    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = aliases[k] ?? k
      result[newKey] = this._applyAliases(v, aliases)
    }
    return result
  }

  private _truncateStrings(obj: unknown, maxLen: number): unknown {
    if (typeof obj === 'string') return obj.length > maxLen ? obj.slice(0, maxLen) + '…' : obj
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) return obj.map(v => this._truncateStrings(v, maxLen))

    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = this._truncateStrings(v, maxLen)
    }
    return result
  }
}

export const compressionEngine = new CompressionEngine()
