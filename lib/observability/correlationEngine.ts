// AGENCY GROUP — SH-ROS Observability: correlationEngine | AMI: 22506

import { supabaseAdmin } from '@/lib/supabase'
import { tracingProvider } from './tracingProvider'

export interface CorrelatedContext {
  correlation_id: string
  trace_id: string
  span_id: string
  org_id: string
  parent_correlation_id?: string
  depth: number
  timestamp: string
}

export interface CorrelationLink {
  parent: string
  child: string
  type: string
  timestamp: string
}

export interface CorrelationChain {
  root_id: string
  links: CorrelationLink[]
  depth: number
}

export class CorrelationEngine {
  private readonly _chains: Map<string, CorrelationLink[]> = new Map()
  private readonly _contexts: Map<string, CorrelatedContext> = new Map()

  generate(): string {
    return crypto.randomUUID()
  }

  enrich(event: { correlation_id: string; org_id: string; [k: string]: unknown }): CorrelatedContext {
    const activeTraceId = tracingProvider.getActiveTraceId()
    const traceId = activeTraceId ?? crypto.randomUUID().replace(/-/g, '')
    const spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16)

    const ctx: CorrelatedContext = {
      correlation_id: event.correlation_id,
      trace_id: traceId,
      span_id: spanId,
      org_id: event.org_id,
      parent_correlation_id: undefined,
      depth: 0,
      timestamp: new Date().toISOString(),
    }

    this._contexts.set(event.correlation_id, ctx)
    return ctx
  }

  propagate(context: CorrelatedContext, child_type: string): CorrelatedContext {
    const child_id = this.generate()
    const child: CorrelatedContext = {
      correlation_id: child_id,
      trace_id: context.trace_id,
      span_id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      org_id: context.org_id,
      parent_correlation_id: context.correlation_id,
      depth: context.depth + 1,
      timestamp: new Date().toISOString(),
    }

    this._contexts.set(child_id, child)
    this.link(context.correlation_id, child_id, child_type)
    return child
  }

  link(parent_id: string, child_id: string, type: string): void {
    const entry: CorrelationLink = {
      parent: parent_id,
      child: child_id,
      type,
      timestamp: new Date().toISOString(),
    }

    const existing = this._chains.get(parent_id) ?? []
    this._chains.set(parent_id, [...existing, entry])
  }

  getChain(correlation_id: string): CorrelationChain {
    // Walk up to find root
    let root_id = correlation_id
    const visited = new Set<string>()

    while (true) {
      if (visited.has(root_id)) break
      visited.add(root_id)
      const ctx = this._contexts.get(root_id)
      if (!ctx?.parent_correlation_id) break
      root_id = ctx.parent_correlation_id
    }

    // Collect all links under root
    const allLinks: CorrelationLink[] = []
    const queue = [root_id]
    const seen = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (seen.has(current)) continue
      seen.add(current)

      const links = this._chains.get(current) ?? []
      allLinks.push(...links)
      for (const l of links) {
        queue.push(l.child)
      }
    }

    return {
      root_id,
      links: allLinks,
      depth: allLinks.length > 0 ? Math.max(...allLinks.map((_, i) => i + 1)) : 0,
    }
  }

  async flush(correlation_id: string): Promise<void> {
    const ctx = this._contexts.get(correlation_id)
    if (!ctx) return

    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'correlation_chain',
        org_id: ctx.org_id,
        correlation_id: ctx.correlation_id,
        metadata: {
          trace_id: ctx.trace_id,
          span_id: ctx.span_id,
          parent_correlation_id: ctx.parent_correlation_id,
          depth: ctx.depth,
          chain: this.getChain(correlation_id),
        },
        created_at: ctx.timestamp,
      })
    } catch (err) {
      console.warn('[CorrelationEngine] flush error:', err)
    }
  }
}

export const correlationEngine = new CorrelationEngine()
