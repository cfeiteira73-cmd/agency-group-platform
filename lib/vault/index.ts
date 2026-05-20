// lib/vault/index.ts — re-exports for vault engine
export { hashFile, hashContent, hashesMatch, detectDrift, persistHash } from './hashEngine'
export type { FileHash, DriftResult } from './hashEngine'
export { computeIntegrityScores } from './integrityChecker'
export type { IntegrityScores } from './integrityChecker'
export { createSnapshot } from './snapshotManager'
export type { SnapshotManifest } from './snapshotManager'
