// ─── PortalEmptyState Component Test Suite ────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PortalEmptyState, { PortalEmptyState as NamedExport } from '../PortalEmptyState'

// ── Default (no-data) variant ─────────────────────────────────────────────────

describe('PortalEmptyState — no-data variant', () => {
  it('renders default title "Sem dados"', () => {
    render(<PortalEmptyState variant="no-data" />)
    expect(screen.getByText('Sem dados')).toBeInTheDocument()
  })

  it('renders default description', () => {
    render(<PortalEmptyState variant="no-data" />)
    expect(screen.getByText('Ainda não existem registos aqui.')).toBeInTheDocument()
  })

  it('does not render a button when no action is provided', () => {
    render(<PortalEmptyState variant="no-data" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders custom title when provided', () => {
    render(<PortalEmptyState variant="no-data" title="Título customizado" />)
    expect(screen.getByText('Título customizado')).toBeInTheDocument()
  })

  it('renders custom description when provided', () => {
    render(<PortalEmptyState variant="no-data" description="Descrição custom aqui." />)
    expect(screen.getByText('Descrição custom aqui.')).toBeInTheDocument()
  })

  it('custom title overrides default title', () => {
    render(<PortalEmptyState variant="no-data" title="Override" />)
    expect(screen.queryByText('Sem dados')).toBeNull()
    expect(screen.getByText('Override')).toBeInTheDocument()
  })
})

// ── error variant ─────────────────────────────────────────────────────────────

describe('PortalEmptyState — error variant', () => {
  it('renders "Erro ao carregar" as default title', () => {
    render(<PortalEmptyState variant="error" />)
    expect(screen.getByText('Erro ao carregar')).toBeInTheDocument()
  })

  it('renders the error description', () => {
    render(<PortalEmptyState variant="error" />)
    expect(screen.getByText('Não foi possível carregar os dados. Tenta novamente.')).toBeInTheDocument()
  })
})

// ── search-empty variant ──────────────────────────────────────────────────────

describe('PortalEmptyState — search-empty variant', () => {
  it('renders "Sem resultados" as default title', () => {
    render(<PortalEmptyState variant="search-empty" />)
    expect(screen.getByText('Sem resultados')).toBeInTheDocument()
  })
})

// ── no-deals variant ──────────────────────────────────────────────────────────

describe('PortalEmptyState — no-deals variant', () => {
  it('renders "Pipeline vazio" as default title', () => {
    render(<PortalEmptyState variant="no-deals" />)
    expect(screen.getByText('Pipeline vazio')).toBeInTheDocument()
  })

  it('renders action button when action prop is provided', () => {
    const mockFn = vi.fn()
    render(<PortalEmptyState variant="no-deals" action={{ label: 'Criar deal', onClick: mockFn }} />)
    expect(screen.getByRole('button', { name: 'Criar deal' })).toBeInTheDocument()
  })

  it('calls onClick when action button is clicked', () => {
    const mockFn = vi.fn()
    render(<PortalEmptyState variant="no-deals" action={{ label: 'Criar deal', onClick: mockFn }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar deal' }))
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('does not render button when no action prop', () => {
    render(<PortalEmptyState variant="no-deals" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

// ── no-contacts variant ───────────────────────────────────────────────────────

describe('PortalEmptyState — no-contacts variant', () => {
  it('renders "Sem contactos" as default title', () => {
    render(<PortalEmptyState variant="no-contacts" />)
    expect(screen.getByText('Sem contactos')).toBeInTheDocument()
  })
})

// ── no-imoveis variant ────────────────────────────────────────────────────────

describe('PortalEmptyState — no-imoveis variant', () => {
  it('renders "Sem imóveis" as default title', () => {
    render(<PortalEmptyState variant="no-imoveis" />)
    expect(screen.getByText('Sem imóveis')).toBeInTheDocument()
  })
})

// ── no-signals variant ────────────────────────────────────────────────────────

describe('PortalEmptyState — no-signals variant', () => {
  it('renders "Sem sinais detectados" as default title', () => {
    render(<PortalEmptyState variant="no-signals" />)
    expect(screen.getByText('Sem sinais detectados')).toBeInTheDocument()
  })
})

// ── loading-failed variant ────────────────────────────────────────────────────

describe('PortalEmptyState — loading-failed variant', () => {
  it('renders "Falha na ligação" as default title', () => {
    render(<PortalEmptyState variant="loading-failed" />)
    expect(screen.getByText('Falha na ligação')).toBeInTheDocument()
  })
})

// ── Action button behaviour ───────────────────────────────────────────────────

describe('PortalEmptyState — action button', () => {
  it('renders button with correct label text', () => {
    const fn = vi.fn()
    render(<PortalEmptyState variant="no-data" action={{ label: 'Adicionar registo', onClick: fn }} />)
    expect(screen.getByText('Adicionar registo')).toBeInTheDocument()
  })

  it('button has the p-btn CSS class', () => {
    const fn = vi.fn()
    render(<PortalEmptyState variant="no-data" action={{ label: 'Acção', onClick: fn }} />)
    const btn = screen.getByRole('button', { name: 'Acção' })
    expect(btn).toHaveClass('p-btn')
  })

  it('fires onClick exactly once per click', () => {
    const fn = vi.fn()
    render(<PortalEmptyState variant="no-contacts" action={{ label: 'Clica', onClick: fn }} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

// ── darkMode prop ─────────────────────────────────────────────────────────────

describe('PortalEmptyState — darkMode prop', () => {
  it('renders without error when darkMode is true', () => {
    expect(() => render(<PortalEmptyState variant="no-data" darkMode={true} />)).not.toThrow()
  })

  it('renders without error when darkMode is false', () => {
    expect(() => render(<PortalEmptyState variant="no-data" darkMode={false} />)).not.toThrow()
  })

  it('still shows title when darkMode is true', () => {
    render(<PortalEmptyState variant="no-data" darkMode={true} />)
    expect(screen.getByText('Sem dados')).toBeInTheDocument()
  })

  it('still shows custom title when darkMode is true', () => {
    render(<PortalEmptyState variant="error" darkMode={true} title="Erro crítico" />)
    expect(screen.getByText('Erro crítico')).toBeInTheDocument()
  })
})

// ── SVG icon rendering ────────────────────────────────────────────────────────

describe('PortalEmptyState — SVG icon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<PortalEmptyState variant="no-data" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('SVG has correct dimensions (24x24)', () => {
    const { container } = render(<PortalEmptyState variant="no-data" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.getAttribute('height')).toBe('24')
  })

  it('different variants render different SVG paths', () => {
    const { container: c1 } = render(<PortalEmptyState variant="no-data" />)
    const { container: c2 } = render(<PortalEmptyState variant="error" />)
    const path1 = c1.querySelector('path')?.getAttribute('d')
    const path2 = c2.querySelector('path')?.getAttribute('d')
    expect(path1).not.toBe(path2)
  })
})

// ── Named export ──────────────────────────────────────────────────────────────

describe('PortalEmptyState — named export', () => {
  it('named export renders the same as default export', () => {
    const { getByText } = render(<NamedExport variant="no-data" />)
    expect(getByText('Sem dados')).toBeInTheDocument()
  })
})

// ── Layout structure ──────────────────────────────────────────────────────────

describe('PortalEmptyState — layout', () => {
  it('renders a wrapping div with flex column layout', () => {
    const { container } = render(<PortalEmptyState variant="no-data" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.style.flexDirection).toBe('column')
    expect(wrapper.style.textAlign).toBe('center')
  })

  it('has a minimum height of 200px', () => {
    const { container } = render(<PortalEmptyState variant="no-data" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.minHeight).toBe('200px')
  })
})
