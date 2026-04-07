// =============================================================================
// AGENCY GROUP — Agentic CRM Orchestrator v1.0
// POST /api/automation/agent — Sofia AI autonomous CRM analysis loop
// Uses Claude tool-use to: identify stalled deals, score leads,
// generate follow-ups, create tasks, suggest stage progressions
// AMI: 22506 | Protected via proxy.ts (/api/automation)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── CRM Tools for Claude ────────────────────────────────────────────────────

const CRM_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_stalled_deals',
    description: 'Get deals that have not had activity in more than N days',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_stalled: { type: 'number', description: 'Minimum days without activity (default: 7)' },
        stage: { type: 'string', description: 'Filter by pipeline stage (optional)' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_details',
    description: 'Get full details of a specific deal including contact, property, history',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'UUID of the deal' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'score_lead',
    description: 'Calculate lead score based on engagement, budget, timeline, and fit',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string' },
        engagement_score: { type: 'number', description: '0-100 based on emails opened, views, calls' },
        budget_fit: { type: 'number', description: '0-100: how well budget matches available inventory' },
        timeline_urgency: { type: 'number', description: '0-100: how urgent is their timeline' },
        profile_completeness: { type: 'number', description: '0-100: how complete is their profile' },
      },
      required: ['deal_id', 'engagement_score', 'budget_fit', 'timeline_urgency', 'profile_completeness'],
    },
  },
  {
    name: 'generate_followup',
    description: 'Generate a personalized follow-up message for a contact',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string' },
        channel: { type: 'string', enum: ['email', 'whatsapp', 'sms'] },
        context: { type: 'string', description: 'Why this follow-up (e.g., "stalled 14 days", "just viewed property X")' },
        language: { type: 'string', enum: ['pt', 'en', 'fr', 'de', 'zh'], description: 'Contact preferred language' },
      },
      required: ['deal_id', 'channel', 'context', 'language'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a CRM task for an agent to follow up',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        due_date: { type: 'string', description: 'ISO date string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        type: { type: 'string', enum: ['call', 'email', 'visit', 'document', 'offer'] },
      },
      required: ['deal_id', 'title', 'description', 'due_date', 'priority', 'type'],
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Move a deal to a new pipeline stage with reason',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string' },
        new_stage: { type: 'string', enum: ['lead', 'qualified', 'visita', 'proposta', 'cpcv', 'escritura', 'lost'] },
        reason: { type: 'string' },
      },
      required: ['deal_id', 'new_stage', 'reason'],
    },
  },
  {
    name: 'get_matching_properties',
    description: 'Find properties matching a client profile (budget, zona, quartos, tipo)',
    input_schema: {
      type: 'object' as const,
      properties: {
        budget_min: { type: 'number' },
        budget_max: { type: 'number' },
        zona: { type: 'string' },
        quartos_min: { type: 'number' },
        tipo: { type: 'string' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'complete_analysis',
    description: 'Signal that analysis is complete and return summary of actions taken',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Summary of all actions taken and recommendations' },
        deals_processed: { type: 'number' },
        tasks_created: { type: 'number' },
        followups_generated: { type: 'number' },
      },
      required: ['summary', 'deals_processed', 'tasks_created', 'followups_generated'],
    },
  },
]

// ─── Tool Execution ──────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_stalled_deals': {
      const days = (input.days_stalled as number) || 7
      const limit = (input.limit as number) || 10
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('deals')
        .select('id, title, stage, contact_name, contact_email, contact_phone, property_id, valor, last_activity_at, created_at, agent_id, notes')
        .lt('last_activity_at', cutoff)
        .neq('stage', 'lost')
        .neq('stage', 'escritura')
        .order('last_activity_at', { ascending: true })
        .limit(limit)

      if (input.stage) query = query.eq('stage', input.stage as string)

      const { data, error } = await query
      if (error) return { error: error.message }
      return { deals: data, count: (data as unknown[])?.length ?? 0 }
    }

    case 'get_deal_details': {
      const { data, error } = await (supabase as any)
        .from('deals')
        .select('*, properties(nome, zona, preco, quartos, area, tipo)')
        .eq('id', input.deal_id as string)
        .single()
      if (error) return { error: error.message }
      return data
    }

    case 'score_lead': {
      const score = Math.round(
        (input.engagement_score as number) * 0.3 +
        (input.budget_fit as number) * 0.3 +
        (input.timeline_urgency as number) * 0.25 +
        (input.profile_completeness as number) * 0.15
      )
      const { error } = await (supabase as any)
        .from('deals')
        .update({ lead_score: score, scored_at: new Date().toISOString() })
        .eq('id', input.deal_id as string)
      return { score, updated: !error }
    }

    case 'generate_followup': {
      const { data: deal } = await (supabase as any)
        .from('deals')
        .select('contact_name, contact_email, valor, stage, notes, properties(nome, zona, preco)')
        .eq('id', input.deal_id as string)
        .single()

      if (!deal) return { error: 'Deal not found' }

      const langInstructions: Record<string, string> = {
        pt: 'Escreve em português europeu formal mas caloroso',
        en: 'Write in professional British English',
        fr: 'Écris en français formel et chaleureux',
        de: 'Schreibe auf formelles aber freundliches Deutsch',
        zh: '用正式但友好的中文书写',
      }

      const dealData = deal as Record<string, unknown>
      const propertiesData = dealData.properties as Record<string, unknown> | null

      const completion = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `${langInstructions[input.language as string] ?? langInstructions.en}.

Generate a ${input.channel} follow-up message for:
- Client: ${dealData.contact_name}
- Context: ${input.context}
- Deal stage: ${dealData.stage}
- Budget: €${typeof dealData.valor === 'number' ? dealData.valor.toLocaleString('pt-PT') : 'unknown'}
- Property interest: ${propertiesData?.nome ?? 'general interest'}
- Notes: ${dealData.notes ?? 'none'}

Agency: Agency Group | AMI 22506 | +351 919 948 986
Tone: Professional luxury real estate, not pushy. Max ${input.channel === 'whatsapp' ? '3 paragraphs' : '4 paragraphs'}.
Do NOT add subject line for WhatsApp/SMS. Add subject line for email.`,
        }],
      })

      const message = completion.content[0].type === 'text' ? completion.content[0].text : ''

      // Store generated message
      await (supabase as any).from('crm_followups').upsert({
        deal_id: input.deal_id,
        channel: input.channel,
        message,
        language: input.language,
        context: input.context,
        generated_at: new Date().toISOString(),
        status: 'pending',
      })

      return { message, deal_id: input.deal_id, channel: input.channel }
    }

    case 'create_task': {
      const { error } = await (supabase as any).from('crm_tasks').insert({
        deal_id: input.deal_id,
        title: input.title,
        description: input.description,
        due_date: input.due_date,
        priority: input.priority,
        type: input.type,
        status: 'pending',
        created_by: 'sofia_agent',
        created_at: new Date().toISOString(),
      })
      return { created: !error, error: error?.message }
    }

    case 'update_deal_stage': {
      const { error } = await (supabase as any)
        .from('deals')
        .update({
          stage: input.new_stage,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', input.deal_id as string)

      if (!error) {
        // Log stage change in deal_stage_history if table exists (best-effort)
        await (supabase as any).from('deal_stage_history').insert({
          deal_id: input.deal_id,
          stage: input.new_stage,
          reason: input.reason,
          changed_at: new Date().toISOString(),
          changed_by: 'sofia_agent',
        }).then(() => null).catch(() => null)
      }

      return { updated: !error }
    }

    case 'get_matching_properties': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('properties')
        .select('id, nome, zona, preco, quartos, area, tipo, fotos')
        .eq('status', 'active')
        .limit((input.limit as number) || 5)

      if (input.budget_min) query = query.gte('preco', input.budget_min as number)
      if (input.budget_max) query = query.lte('preco', input.budget_max as number)
      if (input.zona) query = query.ilike('zona', `%${input.zona}%`)
      if (input.quartos_min) query = query.gte('quartos', input.quartos_min as number)
      if (input.tipo) query = query.eq('tipo', input.tipo as string)

      const { data, error } = await query
      return error ? { error: error.message } : { properties: data }
    }

    case 'complete_analysis':
      return { completed: true, ...input }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─── Agentic Loop ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth is enforced by proxy.ts for /api/automation
  if (!req.headers.get('cookie') && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const task = (body.task as string) || 'analyze_stalled_deals'
  const context = (body.context as string) || ''

  const systemPrompt = `You are Sofia, Agency Group's AI CRM agent (AMI 22506, Portugal luxury real estate).
Your mission: autonomously analyze the CRM and take intelligent actions to accelerate deals.

Current date: ${new Date().toISOString().split('T')[0]}
Agency focus: Luxury properties €500K–€5M in Lisboa, Cascais, Porto, Algarve, Madeira, Comporta.
Buyer profiles: Americans 16%, French 13%, British 9%, Chinese 8%, Brazilian 6%.

Workflow:
1. Get stalled deals
2. Analyze each deal — why stalled? What's the best next action?
3. Score leads
4. Generate personalized follow-ups if needed
5. Create tasks for agents
6. Complete with summary

Always be strategic. Quality over quantity. Max 10 deals per run.`

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Task: ${task}. ${context ? `Context: ${context}` : 'Run a full CRM analysis and take autonomous actions to re-engage stalled deals.'}`,
  }]

  const results: Array<{ tool: string; input: Record<string, unknown>; result: unknown }> = []
  let iterations = 0
  const MAX_ITERATIONS = 20

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        tools: CRM_TOOLS,
        messages,
      })

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: response.content })

      // Check stop condition
      if (response.stop_reason === 'end_turn') break
      if (response.stop_reason !== 'tool_use') break

      // Execute tool calls
      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: [],
      }

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const result = await executeTool(block.name, block.input as Record<string, unknown>)
        results.push({ tool: block.name, input: block.input as Record<string, unknown>, result })

        ;(toolResults.content as Anthropic.ToolResultBlockParam[]).push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })

        // Stop if complete_analysis was called
        if (block.name === 'complete_analysis') {
          messages.push(toolResults)
          return NextResponse.json({ success: true, iterations, results, summary: result })
        }
      }

      messages.push(toolResults)
    }

    return NextResponse.json({ success: true, iterations, results })
  } catch (error) {
    console.error('[automation/agent] Error:', error)
    return NextResponse.json({ error: 'Agent execution failed' }, { status: 500 })
  }
}
