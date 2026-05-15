// AGENCY GROUP — SH-ROS | AMI: 22506
// Observability logger shim — re-exports the canonical logger as a named export
// so modules under lib/executive can use: import { logger } from '@/lib/observability/logger'
// =============================================================================

import log from '@/lib/logger'

export const logger = log
