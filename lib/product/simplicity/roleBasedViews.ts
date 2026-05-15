// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Role-Based Views Engine
// Tailors the platform experience to each user's function and information needs
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'
import { type ComplexityLevel } from './adaptiveInterface'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type UserRole = 'agent' | 'broker' | 'executive' | 'admin'

export interface RoleView {
  view_id: string
  role: UserRole
  title: string
  description: string
  primary_kpis: string[]
  default_actions: string[]
  hidden_sections: string[]
  complexity: ComplexityLevel
  navigation_order: string[]
}

// ─── Role View Catalog ────────────────────────────────────────────────────────

const ROLE_VIEW_CATALOG: Record<UserRole, RoleView> = {
  agent: {
    view_id: 'view_agent',
    role: 'agent',
    title: 'Agent Dashboard',
    description: 'Daily priorities, hot leads, and deal actions — everything an agent needs to close more deals',
    primary_kpis: [
      'Hot leads today',
      'Deals in active negotiation',
      'Commission MTD (€)',
      'Deals closing this week',
      'Avg. response time (min)',
    ],
    default_actions: [
      'Follow up hot leads',
      'Send deal pack',
      'Book viewing',
      'Log client interaction',
      'Request deal pack approval',
    ],
    hidden_sections: [
      'team_performance',
      'financial_reporting',
      'org_settings',
      'user_management',
      'revenue_forecast',
    ],
    complexity: 'simplified',
    navigation_order: [
      'my_leads',
      'my_deals',
      'calendar',
      'deal_pack',
      'properties',
      'messages',
    ],
  },
  broker: {
    view_id: 'view_broker',
    role: 'broker',
    title: 'Broker Operations',
    description: 'Team pipeline oversight, deal quality control, and revenue tracking for managing agents',
    primary_kpis: [
      'Team pipeline value (€)',
      'Deals closing this month',
      'Team conversion rate (%)',
      'Commission forecast (€)',
      'Active listings count',
      'Avg. days to close',
    ],
    default_actions: [
      'Review team pipeline',
      'Approve deal packs',
      'Assign leads to agents',
      'Run weekly team review',
      'Generate vendor report',
    ],
    hidden_sections: [
      'org_settings',
      'billing',
      'api_keys',
    ],
    complexity: 'standard',
    navigation_order: [
      'team_pipeline',
      'leads_inbox',
      'listings',
      'team_performance',
      'reports',
      'market_intel',
      'calendar',
    ],
  },
  executive: {
    view_id: 'view_executive',
    role: 'executive',
    title: 'Executive Command Centre',
    description: 'Full revenue intelligence, market positioning, and strategic KPIs for company leadership',
    primary_kpis: [
      'Total pipeline value (€)',
      'Revenue MTD vs. target (€)',
      'Commission run rate (€/month)',
      'Deals won YTD',
      'Market share — primary zones',
      'NPS score',
      'Active agents',
      'CAC and LTV ratios',
    ],
    default_actions: [
      'Review daily digest',
      'Approve strategic proposals',
      'Run revenue forecast',
      'Review market intelligence',
      'Access investor reporting',
    ],
    hidden_sections: [],
    complexity: 'advanced',
    navigation_order: [
      'command_centre',
      'revenue_forecast',
      'team_performance',
      'market_intelligence',
      'investor_relations',
      'pipeline',
      'reports',
      'org_settings',
    ],
  },
  admin: {
    view_id: 'view_admin',
    role: 'admin',
    title: 'System Administration',
    description: 'Platform configuration, user management, integrations, and system health monitoring',
    primary_kpis: [
      'Active users',
      'API health (%)',
      'Data sync status',
      'Error rate (24h)',
      'Storage used (GB)',
    ],
    default_actions: [
      'Manage users',
      'Configure integrations',
      'Review system logs',
      'Run data exports',
      'Update org settings',
    ],
    hidden_sections: [],
    complexity: 'advanced',
    navigation_order: [
      'users',
      'integrations',
      'system_health',
      'audit_logs',
      'org_settings',
      'billing',
      'api_keys',
    ],
  },
}

// ─── Class ────────────────────────────────────────────────────────────────────

class RoleBasedViewEngine {
  getView(role: UserRole): RoleView {
    const view = ROLE_VIEW_CATALOG[role]
    logger.info('[RoleBasedViews] getView', { role, view_id: view.view_id })
    return view
  }

  getKPIs(role: UserRole): string[] {
    return ROLE_VIEW_CATALOG[role].primary_kpis
  }

  getDefaultActions(role: UserRole): string[] {
    return ROLE_VIEW_CATALOG[role].default_actions
  }

  getNavigationOrder(role: UserRole): string[] {
    return ROLE_VIEW_CATALOG[role].navigation_order
  }

  mergeWithOverrides(role: UserRole, overrides: Partial<RoleView>): RoleView {
    const base = ROLE_VIEW_CATALOG[role]
    const merged: RoleView = { ...base, ...overrides }

    logger.info('[RoleBasedViews] mergeWithOverrides', {
      role,
      override_keys: Object.keys(overrides),
    })

    return merged
  }
}

export const roleBasedViewEngine = new RoleBasedViewEngine()
