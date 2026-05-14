// AGENCY GROUP — SH-ROS Cold Memory: semanticMemory | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface SemanticSearchResult {
  entry_id: string
  score: number
  summary: string
  type: string
  timestamp: string
}

interface TFIDFIndex {
  entry_id: string
  terms: Record<string, number>
  type: string
  summary: string
  timestamp: string
}

export class SemanticMemory {
  private _index = new Map<string, Map<string, TFIDFIndex>>() // org_id → entry_id → index

  async index(entry_id: string, text: string, org_id: string): Promise<void> {
    const terms = this._tokenize(text)
    const tfidf = this._computeTFIDF(terms)

    const entry: TFIDFIndex = {
      entry_id, terms: tfidf, type: 'text',
      summary: text.slice(0, 200), timestamp: new Date().toISOString(),
    }

    if (!this._index.has(org_id)) this._index.set(org_id, new Map())
    this._index.get(org_id)!.set(entry_id, entry)

    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type:    'semantic_index',
        source_system: 'agent',
        metadata:      { entry_id, org_id, terms: Object.keys(tfidf).slice(0, 50), tfidf },
      })
    } catch (err) {
      console.warn('[SemanticMemory] index persist failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async search(query: string, org_id: string, limit = 10): Promise<SemanticSearchResult[]> {
    const queryTerms = this._tokenize(query)
    const queryTFIDF = this._computeTFIDF(queryTerms)

    const orgIndex = this._index.get(org_id)
    if (!orgIndex || orgIndex.size === 0) return []

    const results: SemanticSearchResult[] = []

    for (const entry of orgIndex.values()) {
      const score = this._cosineSimilarity(queryTFIDF, entry.terms)
      if (score > 0.1) {
        results.push({ entry_id: entry.entry_id, score, summary: entry.summary, type: entry.type, timestamp: entry.timestamp })
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  private _tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  }

  private _computeTFIDF(terms: string[]): Record<string, number> {
    const freq: Record<string, number> = {}
    for (const t of terms) freq[t] = (freq[t] ?? 0) + 1
    const total = terms.length || 1
    const result: Record<string, number> = {}
    for (const [term, count] of Object.entries(freq)) {
      result[term] = count / total // TF only (IDF needs corpus — simplified)
    }
    return result
  }

  private _cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    let dot = 0, magA = 0, magB = 0
    for (const k of keys) {
      const av = a[k] ?? 0, bv = b[k] ?? 0
      dot += av * bv; magA += av * av; magB += bv * bv
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB)
    return denom > 0 ? dot / denom : 0
  }
}

export const semanticMemory = new SemanticMemory()
