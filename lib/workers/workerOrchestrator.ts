// Agency Group — Worker Orchestrator
// lib/workers/workerOrchestrator.ts
// Manages all 5 named workers as a single deployable unit.
// TypeScript strict — 0 errors

import { IngestionWorker, createIngestionWorker } from './ingestionWorker'
import { ScoringWorker }    from './scoringWorker'
import { MatchingWorker }   from './matchingWorker'
import { MLTrainingWorker } from './mlTrainingWorker'
import { RevenueWorker }    from './revenueWorker'
import log from '@/lib/logger'
import type { WorkerHealth } from './workerTypes'

// ─── Worker union type ────────────────────────────────────────────────────────

type AnyWorker = {
  stop(): void
  getHealth(): WorkerHealth
  runLoop(): Promise<void>
}

const WORKER_NAMES = [
  'ingestion-worker',
  'scoring-worker',
  'matching-worker',
  'ml-training-worker',
  'revenue-worker',
] as const

type WorkerKey = typeof WORKER_NAMES[number]

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class WorkerOrchestrator {
  private readonly workers = new Map<WorkerKey, AnyWorker>()
  private readonly tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  /**
   * Instantiate all 5 workers and fire their runLoop() as background promises.
   * Errors inside individual loops are caught and logged without crashing the process.
   */
  startAll(): void {
    const ingestion  = createIngestionWorker(this.tenantId)
    const scoring    = new ScoringWorker(this.tenantId)
    const matching   = new MatchingWorker(this.tenantId)
    const mlTraining = new MLTrainingWorker(this.tenantId)
    const revenue    = new RevenueWorker(this.tenantId)

    this.workers.set('ingestion-worker',   ingestion)
    this.workers.set('scoring-worker',     scoring)
    this.workers.set('matching-worker',    matching)
    this.workers.set('ml-training-worker', mlTraining)
    this.workers.set('revenue-worker',     revenue)

    for (const [name, worker] of this.workers) {
      void worker.runLoop().catch(err => {
        log.error(`[orchestrator] worker ${name} crashed`, err instanceof Error ? err : new Error(String(err)), {
          worker_name: name,
          tenant_id:   this.tenantId,
        })
      })

      log.info(`[orchestrator] started worker: ${name}`, { tenant_id: this.tenantId })
    }
  }

  /**
   * Gracefully stop all workers by signalling their loop to exit.
   */
  stopAll(): void {
    for (const [name, worker] of this.workers) {
      worker.stop()
      log.info(`[orchestrator] stopped worker: ${name}`, { tenant_id: this.tenantId })
    }
  }

  /**
   * Returns a snapshot of health for every registered worker.
   */
  getAllHealth(): WorkerHealth[] {
    return Array.from(this.workers.values()).map(w => w.getHealth())
  }

  /**
   * Start a single worker by name. Returns false if already running or unknown.
   */
  startWorker(name: string): boolean {
    if (!WORKER_NAMES.includes(name as WorkerKey)) {
      log.warn('[orchestrator] startWorker — unknown worker', { name })
      return false
    }

    const key = name as WorkerKey

    if (this.workers.has(key)) {
      const existing = this.workers.get(key)!
      const h = existing.getHealth()
      if (h.status === 'running' || h.status === 'idle') {
        log.warn('[orchestrator] startWorker — already running', { name })
        return false
      }
    }

    let worker: AnyWorker

    switch (key) {
      case 'ingestion-worker':
        worker = createIngestionWorker(this.tenantId)
        break
      case 'scoring-worker':
        worker = new ScoringWorker(this.tenantId)
        break
      case 'matching-worker':
        worker = new MatchingWorker(this.tenantId)
        break
      case 'ml-training-worker':
        worker = new MLTrainingWorker(this.tenantId)
        break
      case 'revenue-worker':
        worker = new RevenueWorker(this.tenantId)
        break
    }

    this.workers.set(key, worker)

    void worker.runLoop().catch(err => {
      log.error(`[orchestrator] worker ${key} crashed`, err instanceof Error ? err : new Error(String(err)), {
        worker_name: key,
        tenant_id:   this.tenantId,
      })
    })

    log.info(`[orchestrator] startWorker: ${key}`, { tenant_id: this.tenantId })
    return true
  }

  /**
   * Stop a single worker by name. Returns false if not found.
   */
  stopWorker(name: string): boolean {
    const key = name as WorkerKey
    const worker = this.workers.get(key)

    if (!worker) {
      log.warn('[orchestrator] stopWorker — worker not found', { name })
      return false
    }

    worker.stop()
    log.info(`[orchestrator] stopWorker: ${key}`, { tenant_id: this.tenantId })
    return true
  }
}

export function createOrchestrator(tenantId: string): WorkerOrchestrator {
  return new WorkerOrchestrator(tenantId)
}
