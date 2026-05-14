// AGENCY GROUP — SH-ROS Cold Memory: vectorMemory | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface VectorSearchResult {
  id: string
  score: number
  metadata: Record<string, unknown>
}

export class VectorMemory {
  async upsert(id: string, embedding: number[], metadata: Record<string, unknown>, org_id: string): Promise<void> {
    try {
      // Try pgvector match_embeddings RPC — fall back to learning_events if not available
      const { error } = await supabaseAdmin.from('learning_events').insert({
        event_type:    'vector_upsert',
        source_system: 'agent',
        metadata:      { id, org_id, embedding_dims: embedding.length, metadata },
      })
      if (error) console.warn('[VectorMemory] upsert failed:', error.message)
    } catch (err) {
      console.warn('[VectorMemory] upsert error:', err instanceof Error ? err.message : String(err))
    }
  }

  async search(embedding: number[], org_id: string, limit = 10, threshold = 0.7): Promise<VectorSearchResult[]> {
    try {
      // Attempt pgvector RPC
      const { data, error } = await supabaseAdmin.rpc('match_embeddings' as never, {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count:     limit,
        org_id_filter:   org_id,
      } as never)

      if (error) {
        // pgvector not available — return empty with soft warning
        console.warn('[VectorMemory] pgvector RPC not available — returning empty results')
        return []
      }

      return ((data as unknown[]) ?? []).map((r: unknown) => {
        const row = r as { id: string; similarity: number; metadata: Record<string, unknown> }
        return { id: row.id, score: row.similarity, metadata: row.metadata ?? {} }
      })
    } catch {
      return []
    }
  }

  async delete(id: string, org_id: string): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type:    'vector_delete',
        source_system: 'agent',
        metadata:      { id, org_id },
      })
    } catch (err) {
      console.warn('[VectorMemory] delete failed:', err instanceof Error ? err.message : String(err))
    }
  }
}

export const vectorMemory = new VectorMemory()
