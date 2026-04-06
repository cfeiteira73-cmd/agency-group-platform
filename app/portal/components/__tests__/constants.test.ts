// ─── Constants Test Suite ─────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STAGES,
  STAGE_PCT,
  STAGE_COLOR,
  SECTION_NAMES,
  PORTAL_STYLES,
  NAV,
  CHECKLISTS,
  FORMATS,
  PERSONAS,
  STATUS_CONFIG,
  BUYER_DEMAND,
  POST_CLOSING_TASKS,
  WA_TEMPLATES,
  HEAT_MAP_ZONES,
  PORTAL_PROPERTIES,
} from '../constants'

// ── PIPELINE_STAGES ───────────────────────────────────────────────────────────

describe('PIPELINE_STAGES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PIPELINE_STAGES)).toBe(true)
    expect(PIPELINE_STAGES.length).toBeGreaterThan(0)
  })

  it('contains the first stage Angariação', () => {
    expect(PIPELINE_STAGES).toContain('Angariação')
  })

  it('contains the final stage Escritura Concluída', () => {
    expect(PIPELINE_STAGES).toContain('Escritura Concluída')
  })

  it('contains all 8 expected stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(8)
  })

  it('contains CPCV Assinado stage', () => {
    expect(PIPELINE_STAGES).toContain('CPCV Assinado')
  })

  it('contains Due Diligence stage', () => {
    expect(PIPELINE_STAGES).toContain('Due Diligence')
  })

  it('all stages are non-empty strings', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(typeof stage).toBe('string')
      expect(stage.length).toBeGreaterThan(0)
    })
  })
})

// ── STAGE_PCT ─────────────────────────────────────────────────────────────────

describe('STAGE_PCT', () => {
  it('has an entry for every PIPELINE_STAGES stage', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_PCT[stage]).toBeDefined()
    })
  })

  it('all percentage values are between 0 and 100 inclusive', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_PCT[stage]).toBeGreaterThanOrEqual(0)
      expect(STAGE_PCT[stage]).toBeLessThanOrEqual(100)
    })
  })

  it('Angariação is 10%', () => {
    expect(STAGE_PCT['Angariação']).toBe(10)
  })

  it('Escritura Concluída is 100%', () => {
    expect(STAGE_PCT['Escritura Concluída']).toBe(100)
  })

  it('CPCV Assinado is 70%', () => {
    expect(STAGE_PCT['CPCV Assinado']).toBe(70)
  })

  it('stages progress monotonically (each stage >= previous)', () => {
    for (let i = 1; i < PIPELINE_STAGES.length; i++) {
      expect(STAGE_PCT[PIPELINE_STAGES[i]]).toBeGreaterThanOrEqual(STAGE_PCT[PIPELINE_STAGES[i - 1]])
    }
  })
})

// ── STAGE_COLOR ───────────────────────────────────────────────────────────────

describe('STAGE_COLOR', () => {
  it('has an entry for every PIPELINE_STAGES stage', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_COLOR[stage]).toBeDefined()
    })
  })

  it('all color values are valid hex strings', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(STAGE_COLOR[stage]).toMatch(/^#[0-9a-fA-F]{3,6}$/)
    })
  })

  it('Angariação has a grey-ish color', () => {
    expect(STAGE_COLOR['Angariação']).toBe('#888')
  })

  it('Escritura Concluída has dark green color', () => {
    expect(STAGE_COLOR['Escritura Concluída']).toBe('#1c4a35')
  })
})

// ── SECTION_NAMES ─────────────────────────────────────────────────────────────

describe('SECTION_NAMES', () => {
  it('contains a dashboard entry', () => {
    expect(SECTION_NAMES['dashboard']).toBeDefined()
    expect(SECTION_NAMES['dashboard']).toBe('Dashboard')
  })

  it('contains crm section', () => {
    expect(SECTION_NAMES['crm']).toBeDefined()
  })

  it('contains pipeline section', () => {
    expect(SECTION_NAMES['pipeline']).toBeDefined()
  })

  it('contains juridico section', () => {
    expect(SECTION_NAMES['juridico']).toBeDefined()
  })

  it('contains outbound section', () => {
    expect(SECTION_NAMES['outbound']).toBeDefined()
  })

  it('all section names are non-empty strings', () => {
    Object.values(SECTION_NAMES).forEach(name => {
      expect(typeof name).toBe('string')
      expect(name.length).toBeGreaterThan(0)
    })
  })

  it('has at least 20 sections defined', () => {
    expect(Object.keys(SECTION_NAMES).length).toBeGreaterThanOrEqual(20)
  })

  it('all keys are non-empty strings', () => {
    Object.keys(SECTION_NAMES).forEach(key => {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })
  })
})

// ── PORTAL_STYLES ─────────────────────────────────────────────────────────────

describe('PORTAL_STYLES', () => {
  it('is a non-empty string', () => {
    expect(typeof PORTAL_STYLES).toBe('string')
    expect(PORTAL_STYLES.length).toBeGreaterThan(100)
  })

  it('contains .p-btn class definition', () => {
    expect(PORTAL_STYLES).toContain('.p-btn')
  })

  it('contains .p-card class definition', () => {
    expect(PORTAL_STYLES).toContain('.p-card')
  })

  it('contains .kpi-card class definition', () => {
    expect(PORTAL_STYLES).toContain('.kpi-card')
  })

  it('contains .nav-item class definition', () => {
    expect(PORTAL_STYLES).toContain('.nav-item')
  })

  it('contains dark mode styles', () => {
    expect(PORTAL_STYLES).toContain('html.dark')
  })

  it('contains dark mode .kpi-card override', () => {
    expect(PORTAL_STYLES).toContain('html.dark .kpi-card')
  })

  it('contains animation @keyframes', () => {
    expect(PORTAL_STYLES).toContain('@keyframes')
  })

  it('contains fadeSlideUp animation', () => {
    expect(PORTAL_STYLES).toContain('fadeSlideUp')
  })

  it('contains fadeIn animation', () => {
    expect(PORTAL_STYLES).toContain('fadeIn')
  })

  it('contains shimmer animation for skeleton loading', () => {
    expect(PORTAL_STYLES).toContain('shimmer')
    expect(PORTAL_STYLES).toContain('.skeleton')
  })

  it('enforces minimum font size: no sub-.52rem font-size declarations', () => {
    // The rule: smallest allowed font-size is .52rem.
    // Check for values like .1rem, .2rem, .3rem, .4rem, .51rem etc. (only in font-size declarations)
    // We test that any font-size below .52 does not appear.
    // Allowed minimum: .52rem — check no font-size smaller than that.
    const subMinMatches = PORTAL_STYLES.match(/font-size:\s*\.(0?[1-4]\d?)rem/g)
    expect(subMinMatches).toBeNull()
  })

  it('contains .deal-card class', () => {
    expect(PORTAL_STYLES).toContain('.deal-card')
  })

  it('contains .crm-contact-row class', () => {
    expect(PORTAL_STYLES).toContain('.crm-contact-row')
  })

  it('contains @media query for mobile responsiveness', () => {
    expect(PORTAL_STYLES).toContain('@media')
    expect(PORTAL_STYLES).toContain('max-width')
  })

  it('contains Google Fonts @import', () => {
    expect(PORTAL_STYLES).toContain('@import')
    expect(PORTAL_STYLES).toContain('fonts.googleapis.com')
  })

  it('contains Cormorant font family reference', () => {
    expect(PORTAL_STYLES).toContain('Cormorant')
  })

  it('contains DM Mono font family reference', () => {
    expect(PORTAL_STYLES).toContain('DM+Mono')
  })

  it('contains focus-visible accessibility styles', () => {
    expect(PORTAL_STYLES).toContain(':focus-visible')
  })

  it('contains .p-btn-gold class', () => {
    expect(PORTAL_STYLES).toContain('.p-btn-gold')
  })

  it('contains .animate-fade-up utility class', () => {
    expect(PORTAL_STYLES).toContain('.animate-fade-up')
  })
})

// ── NAV ───────────────────────────────────────────────────────────────────────

describe('NAV', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(NAV)).toBe(true)
    expect(NAV.length).toBeGreaterThan(0)
  })

  it('every nav item has id, label, icon, and group fields', () => {
    NAV.forEach(item => {
      expect(typeof item.id).toBe('string')
      expect(item.id.length).toBeGreaterThan(0)
      expect(typeof item.label).toBe('string')
      expect(item.label.length).toBeGreaterThan(0)
      expect(typeof item.icon).toBe('string')
      expect(item.icon.length).toBeGreaterThan(0)
      expect(typeof item.group).toBe('string')
    })
  })

  it('contains a dashboard nav item', () => {
    const dash = NAV.find(n => n.id === 'dashboard')
    expect(dash).toBeDefined()
    expect(dash?.label).toBe('Dashboard')
  })

  it('contains a crm nav item', () => {
    expect(NAV.find(n => n.id === 'crm')).toBeDefined()
  })

  it('contains an outbound nav item', () => {
    expect(NAV.find(n => n.id === 'outbound')).toBeDefined()
  })

  it('all nav item ids are unique', () => {
    const ids = NAV.map(n => n.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ── CHECKLISTS ────────────────────────────────────────────────────────────────

describe('CHECKLISTS', () => {
  it('has a checklist for every pipeline stage', () => {
    PIPELINE_STAGES.forEach(stage => {
      expect(CHECKLISTS[stage]).toBeDefined()
      expect(Array.isArray(CHECKLISTS[stage])).toBe(true)
      expect(CHECKLISTS[stage].length).toBeGreaterThan(0)
    })
  })

  it('Angariação checklist contains caderneta predial item', () => {
    const items = CHECKLISTS['Angariação'].map(i => i.toLowerCase())
    expect(items.some(i => i.includes('caderneta'))).toBe(true)
  })

  it('CPCV Assinado checklist contains sinal transferido item', () => {
    const items = CHECKLISTS['CPCV Assinado'].map(i => i.toLowerCase())
    expect(items.some(i => i.includes('sinal'))).toBe(true)
  })

  it('Escritura Concluída checklist contains escritura assinada item', () => {
    const items = CHECKLISTS['Escritura Concluída'].map(i => i.toLowerCase())
    expect(items.some(i => i.includes('escritura'))).toBe(true)
  })

  it('all checklist items are non-empty strings', () => {
    Object.values(CHECKLISTS).forEach(list => {
      list.forEach(item => {
        expect(typeof item).toBe('string')
        expect(item.length).toBeGreaterThan(0)
      })
    })
  })
})

// ── FORMATS ───────────────────────────────────────────────────────────────────

describe('FORMATS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FORMATS)).toBe(true)
    expect(FORMATS.length).toBeGreaterThan(0)
  })

  it('every format has id, label, icon, charLimit', () => {
    FORMATS.forEach(f => {
      expect(typeof f.id).toBe('string')
      expect(typeof f.label).toBe('string')
      expect(typeof f.icon).toBe('string')
      expect(typeof f.charLimit).toBe('number')
      expect(f.charLimit).toBeGreaterThan(0)
    })
  })

  it('contains idealista format', () => {
    expect(FORMATS.find(f => f.id === 'idealista')).toBeDefined()
  })

  it('contains instagram format with charLimit 2200', () => {
    const ig = FORMATS.find(f => f.id === 'instagram')
    expect(ig).toBeDefined()
    expect(ig?.charLimit).toBe(2200)
  })

  it('SMS format has charLimit 160', () => {
    const sms = FORMATS.find(f => f.id === 'sms')
    expect(sms).toBeDefined()
    expect(sms?.charLimit).toBe(160)
  })

  it('all format ids are unique', () => {
    const ids = FORMATS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── PERSONAS ──────────────────────────────────────────────────────────────────

describe('PERSONAS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PERSONAS)).toBe(true)
    expect(PERSONAS.length).toBeGreaterThan(0)
  })

  it('every persona has id, label, sub', () => {
    PERSONAS.forEach(p => {
      expect(typeof p.id).toBe('string')
      expect(typeof p.label).toBe('string')
      expect(typeof p.sub).toBe('string')
    })
  })

  it('contains americano persona', () => {
    expect(PERSONAS.find(p => p.id === 'americano')).toBeDefined()
  })

  it('contains HNWI persona', () => {
    expect(PERSONAS.find(p => p.id === 'hnwi')).toBeDefined()
  })
})

// ── STATUS_CONFIG ─────────────────────────────────────────────────────────────

describe('STATUS_CONFIG', () => {
  it('has entries for all four CRM statuses', () => {
    expect(STATUS_CONFIG['lead']).toBeDefined()
    expect(STATUS_CONFIG['prospect']).toBeDefined()
    expect(STATUS_CONFIG['cliente']).toBeDefined()
    expect(STATUS_CONFIG['vip']).toBeDefined()
  })

  it('every status config has color, avatar, and label', () => {
    Object.values(STATUS_CONFIG).forEach(cfg => {
      expect(typeof cfg.color).toBe('string')
      expect(cfg.color.length).toBeGreaterThan(0)
      expect(typeof cfg.avatar).toBe('string')
      expect(typeof cfg.label).toBe('string')
    })
  })

  it('vip label is VIP', () => {
    expect(STATUS_CONFIG['vip'].label).toBe('VIP')
  })

  it('vip color is the gold accent', () => {
    expect(STATUS_CONFIG['vip'].color).toBe('#c9a96e')
  })
})

// ── BUYER_DEMAND ──────────────────────────────────────────────────────────────

describe('BUYER_DEMAND', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(BUYER_DEMAND)).toBe(true)
    expect(BUYER_DEMAND.length).toBeGreaterThan(0)
  })

  it('every entry has zona, tipo, budget, count, trend, hot, and weekly', () => {
    BUYER_DEMAND.forEach(d => {
      expect(typeof d.zona).toBe('string')
      expect(typeof d.tipo).toBe('string')
      expect(typeof d.budget).toBe('string')
      expect(typeof d.count).toBe('number')
      expect(typeof d.trend).toBe('string')
      expect(typeof d.hot).toBe('boolean')
      expect(Array.isArray(d.weekly)).toBe(true)
      expect(d.weekly).toHaveLength(7)
    })
  })

  it('contains Lisboa entry', () => {
    expect(BUYER_DEMAND.find(d => d.zona === 'Lisboa')).toBeDefined()
  })

  it('all counts are positive numbers', () => {
    BUYER_DEMAND.forEach(d => {
      expect(d.count).toBeGreaterThan(0)
    })
  })
})

// ── POST_CLOSING_TASKS ────────────────────────────────────────────────────────

describe('POST_CLOSING_TASKS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(POST_CLOSING_TASKS)).toBe(true)
    expect(POST_CLOSING_TASKS.length).toBeGreaterThan(0)
  })

  it('every task has days, label, and type', () => {
    POST_CLOSING_TASKS.forEach(t => {
      expect(typeof t.days).toBe('number')
      expect(t.days).toBeGreaterThan(0)
      expect(typeof t.label).toBe('string')
      expect(t.label.length).toBeGreaterThan(0)
      expect(typeof t.type).toBe('string')
    })
  })

  it('tasks are ordered by days ascending', () => {
    for (let i = 1; i < POST_CLOSING_TASKS.length; i++) {
      expect(POST_CLOSING_TASKS[i].days).toBeGreaterThanOrEqual(POST_CLOSING_TASKS[i - 1].days)
    }
  })

  it('first task is 3 days after closing', () => {
    expect(POST_CLOSING_TASKS[0].days).toBe(3)
  })
})

// ── WA_TEMPLATES ──────────────────────────────────────────────────────────────

describe('WA_TEMPLATES', () => {
  it('contains PT, EN, FR, DE, AR language keys', () => {
    expect(WA_TEMPLATES['PT']).toBeDefined()
    expect(WA_TEMPLATES['EN']).toBeDefined()
    expect(WA_TEMPLATES['FR']).toBeDefined()
    expect(WA_TEMPLATES['DE']).toBeDefined()
    expect(WA_TEMPLATES['AR']).toBeDefined()
  })

  it('every language has an inicial template', () => {
    Object.values(WA_TEMPLATES).forEach(lang => {
      expect(lang['inicial']).toBeDefined()
      expect(typeof lang['inicial'].label).toBe('string')
      expect(typeof lang['inicial'].msg).toBe('string')
    })
  })

  it('PT inicial template contains {name} placeholder', () => {
    expect(WA_TEMPLATES['PT']['inicial'].msg).toContain('{name}')
  })

  it('PT inicial template mentions Agency Group', () => {
    expect(WA_TEMPLATES['PT']['inicial'].msg).toContain('Agency Group')
  })

  it('all templates have label and msg fields', () => {
    Object.values(WA_TEMPLATES).forEach(lang => {
      Object.values(lang).forEach(tpl => {
        expect(typeof tpl.label).toBe('string')
        expect(tpl.label.length).toBeGreaterThan(0)
        expect(typeof tpl.msg).toBe('string')
        expect(tpl.msg.length).toBeGreaterThan(0)
      })
    })
  })
})

// ── HEAT_MAP_ZONES ────────────────────────────────────────────────────────────

describe('HEAT_MAP_ZONES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HEAT_MAP_ZONES)).toBe(true)
    expect(HEAT_MAP_ZONES.length).toBeGreaterThan(0)
  })

  it('every zone has zona, region, score, pm2, yoy, yield, color', () => {
    HEAT_MAP_ZONES.forEach(z => {
      expect(typeof z.zona).toBe('string')
      expect(typeof z.region).toBe('string')
      expect(typeof z.score).toBe('number')
      expect(typeof z.pm2).toBe('number')
      expect(typeof z.yoy).toBe('number')
      expect(typeof z.yield).toBe('number')
      expect(typeof z.color).toBe('string')
    })
  })

  it('all scores are between 0 and 100', () => {
    HEAT_MAP_ZONES.forEach(z => {
      expect(z.score).toBeGreaterThanOrEqual(0)
      expect(z.score).toBeLessThanOrEqual(100)
    })
  })

  it('all colors are valid hex values', () => {
    HEAT_MAP_ZONES.forEach(z => {
      expect(z.color).toMatch(/^#[0-9a-fA-F]{3,6}$/)
    })
  })

  it('contains a Lisboa zone', () => {
    expect(HEAT_MAP_ZONES.find(z => z.region === 'Lisboa')).toBeDefined()
  })

  it('contains an Algarve zone', () => {
    expect(HEAT_MAP_ZONES.find(z => z.region === 'Algarve')).toBeDefined()
  })
})

// ── PORTAL_PROPERTIES ─────────────────────────────────────────────────────────

describe('PORTAL_PROPERTIES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PORTAL_PROPERTIES)).toBe(true)
    expect(PORTAL_PROPERTIES.length).toBeGreaterThan(0)
  })

  it('every property has id, ref, nome, zona, tipo, preco, area', () => {
    PORTAL_PROPERTIES.forEach(p => {
      expect(typeof p.id).toBe('string')
      expect(typeof p.ref).toBe('string')
      expect(typeof p.nome).toBe('string')
      expect(typeof p.zona).toBe('string')
      expect(typeof p.tipo).toBe('string')
      expect(typeof p.preco).toBe('number')
      expect(p.preco).toBeGreaterThan(0)
      expect(typeof p.area).toBe('number')
      expect(p.area).toBeGreaterThan(0)
    })
  })

  it('all property refs are unique', () => {
    const refs = PORTAL_PROPERTIES.map(p => p.ref)
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('contains at least one Lisboa property', () => {
    expect(PORTAL_PROPERTIES.find(p => p.zona === 'Lisboa')).toBeDefined()
  })

  it('contains at least one Cascais property', () => {
    expect(PORTAL_PROPERTIES.find(p => p.zona === 'Cascais')).toBeDefined()
  })

  it('all properties have status Ativo', () => {
    PORTAL_PROPERTIES.forEach(p => {
      expect(p.status).toBe('Ativo')
    })
  })
})
