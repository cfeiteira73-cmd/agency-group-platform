// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer — Barrel Index
// Single entry-point for all 12 simplicity modules

// ─── Workflow Simplifier ──────────────────────────────────────────────────────
export {
  workflowSimplifier,
  type WorkflowStep,
  type SimplifiedWorkflow,
} from './workflowSimplifier'

// ─── Decision Compression ─────────────────────────────────────────────────────
export {
  decisionCompressor,
  type RawDecision,
  type CompressedDecision,
} from './decisionCompression'

// ─── Operational Digest ───────────────────────────────────────────────────────
export {
  operationalDigestEngine,
  type DigestItemType,
  type DigestItem,
  type OperationalDigest,
} from './operationalDigest'

// ─── AI Executive Assistant ───────────────────────────────────────────────────
export {
  aiExecutiveAssistant,
  type AssistantDomain,
  type AssistantQuery,
  type AssistantResponse,
} from './aiExecutiveAssistant'

// ─── Smart Defaults ───────────────────────────────────────────────────────────
export {
  smartDefaultsEngine,
  type OrgDefaults,
} from './smartDefaults'

// ─── Adaptive Interface ───────────────────────────────────────────────────────
export {
  adaptiveInterfaceEngine,
  type ComplexityLevel,
  type InterfaceConfig,
} from './adaptiveInterface'

// ─── Role-Based Views ─────────────────────────────────────────────────────────
export {
  roleBasedViewEngine,
  type UserRole,
  type RoleView,
} from './roleBasedViews'

// ─── Onboarding Compression ───────────────────────────────────────────────────
export {
  onboardingCompressionEngine,
  type OnboardingStep,
  type OnboardingFlow,
} from './onboardingCompression'

// ─── One-Click Automation ─────────────────────────────────────────────────────
export {
  oneClickAutomationEngine,
  type OneClickAction,
  type AutomationResult,
} from './oneClickAutomation'

// ─── Explainability Layer ─────────────────────────────────────────────────────
export {
  explainabilityLayer,
  type ExplainAudience,
  type ExplainRequest,
  type SimpleExplanation,
} from './explainabilityLayer'

// ─── Operational Narrative ────────────────────────────────────────────────────
export {
  operationalNarrativeEngine,
  type NarrativeContext,
  type NarrativeTone,
  type Narrative,
} from './operationalNarrative'

// ─── Friction Elimination ─────────────────────────────────────────────────────
export {
  frictionEliminationEngine,
  type FrictionSeverity,
  type FrictionPoint,
  type FrictionAnalysis,
} from './frictionElimination'
