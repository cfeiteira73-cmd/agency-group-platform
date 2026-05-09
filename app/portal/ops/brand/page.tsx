'use client'
// =============================================================================
// Agency Group — Brand & Positioning Reference Page
// app/portal/ops/brand/page.tsx
// =============================================================================

const COLORS = [
  { name: 'Ouro Primário', hex: '#c9a96e', role: 'Acções, CTAs, destaques premium' },
  { name: 'Verde Floresta', hex: '#1c4a35', role: 'Fundos principais, autoridade' },
  { name: 'Verde Suave', hex: '#52b788', role: 'Positivo, crescimento, confirmações' },
  { name: 'Preto Profundo', hex: '#0f0f0f', role: 'Background principal, elegância' },
  { name: 'Creme', hex: '#e8e0d0', role: 'Texto principal sobre fundos escuros' },
  { name: 'Cinza Escuro', hex: '#2a2a2a', role: 'Borders, separadores, cards' },
  { name: 'Vermelho Alerta', hex: '#e63946', role: 'Erros, alertas críticos, perdas' },
]

const PERSONAS = [
  {
    emoji: '🌍',
    title: 'O Investidor Internacional',
    nationality: 'Norte-americano · Francês · Britânico',
    budget: '€500K – €3M',
    focus: 'Yield + lifestyle + NHR/Golden Visa',
    channel: 'WhatsApp + Email EN/FR',
    pain: 'Não conhece o mercado PT, precisa de confiança imediata',
    message: '"Acesso exclusivo ao que não está no mercado — com dados reais, não opinião."',
    color: '#8ecae6',
  },
  {
    emoji: '🏦',
    title: 'Family Office / HNWI',
    nationality: 'Médio Oriente · Asiático · Europeu',
    budget: '€3M+',
    focus: 'Off-market exclusivo · Discrição total · Portfolio',
    channel: 'Telefone directo · WhatsApp pessoal',
    pain: 'Vê muito ruído, precisa de curadoria cirúrgica',
    message: '"Uma oportunidade por mês. Seleccionada a seu critério. Zero spam."',
    color: '#c9a96e',
  },
  {
    emoji: '🇵🇹',
    title: 'O Investidor Nacional',
    nationality: 'Português · Residente em Portugal',
    budget: '€100K – €500K',
    focus: 'Yield > lifestyle · AL Porto/Lisboa · Buy & Hold',
    channel: 'Digital-first · Portal próprio · Email PT',
    pain: 'Quer dados, não promessas — yield real, DOM real',
    message: '"O yield que a plataforma calcula, não o que o vendedor imagina."',
    color: '#52b788',
  },
]

const PILLARS = [
  {
    number: '01',
    title: 'Acesso',
    tagline: '"Imóveis que não estão no mercado"',
    description: 'Pre-market exclusives, off-market mandatos, pipeline de captação próprio. O cliente chega até nós — não ao mercado público — porque tem acesso privilegiado.',
    examples: ['Pre-market com 89 alertas activos', 'Off-market leads com score 85+', 'Exclusivos com cláusula de acesso registado'],
    color: '#c9a96e',
  },
  {
    number: '02',
    title: 'Inteligência',
    tagline: '"Dados que a concorrência não tem"',
    description: 'AVM proprietário, scoring BANT-RE, win/loss analytics, market trends por zona. Transformamos dados em decisões — não em apresentações bonitas.',
    examples: ['AVM com erro médio <4.2%', 'Score de lead em tempo real (0-100)', 'Análise win/loss por razão e agente'],
    color: '#52b788',
  },
  {
    number: '03',
    title: 'Parceria',
    tagline: '"O seu agente até ao fim"',
    description: 'Comissão 5%, 50% CPCV + 50% Escritura. Sem surpresas, sem conflito de interesse. O agente está alinhado com o comprador durante todo o processo.',
    examples: ['SLA: resposta em <5min', 'Follow-up automático por cadência', 'Relatório de vendedor semanal'],
    color: '#8ecae6',
  },
]

const VOICE_RULES = [
  { do: 'Directo e confiante', dont: 'Vago e entusiasta ("incrível!", "fantástico!")' },
  { do: 'Dados específicos: "€3.076/m²"', dont: 'Generalidades: "preços estão a subir"' },
  { do: 'Tom consultivo: "O que faz sentido para si é..."', dont: 'Tom vendedor: "Não vai encontrar melhor!"' },
  { do: 'Honesto sobre limitações', dont: 'Over-promise ("garantimos que..."' },
  { do: 'Culto sem ser esnobe', dont: 'Jargão excessivo ou linguagem técnica desnecessária' },
]

function ColorSwatch({ color }: { color: typeof COLORS[0] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        backgroundColor: color.hex, flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e0d0' }}>{color.name}</div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#888' }}>{color.hex}</div>
        <div style={{ fontSize: 11, color: '#666' }}>{color.role}</div>
      </div>
    </div>
  )
}

export default function BrandPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#c9a96e', margin: 0 }}>Agency Group</h1>
        <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>Brand & Positioning Reference · AMI 22506 · Versão 1.0 · Maio 2026</div>
        <p style={{ fontSize: 16, color: '#e8e0d0', marginTop: 12, fontStyle: 'italic', borderLeft: '3px solid #c9a96e', paddingLeft: 16 }}>
          &ldquo;O mercado que conhecemos. O acesso que merecem.&rdquo;
        </p>
      </div>

      {/* Identity */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', marginBottom: 16 }}>🎨 Identidade Visual</h2>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, padding: 24, border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
            {COLORS.map(c => <ColorSwatch key={c.hex} color={c} />)}
          </div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Tipografia</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: 700, color: '#e8e0d0' }}>Interface</div>
                <div style={{ fontSize: 11, color: '#666' }}>system-ui · UI, dados, números</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 400, color: '#c9a96e', fontStyle: 'italic' }}>Luxury</div>
                <div style={{ fontSize: 11, color: '#666' }}>Georgia/serif · Títulos premium, hero text</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Personas */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', marginBottom: 16 }}>👥 Buyer Personas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {PERSONAS.map(p => (
            <div key={p.title} style={{
              backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20,
              border: `1px solid ${p.color}33`, borderTop: `3px solid ${p.color}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{p.emoji}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: p.color, margin: '0 0 4px' }}>{p.title}</h3>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{p.nationality}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><span style={{ color: '#666' }}>Budget: </span><strong style={{ color: '#e8e0d0' }}>{p.budget}</strong></div>
                <div><span style={{ color: '#666' }}>Foco: </span><span style={{ color: '#e8e0d0' }}>{p.focus}</span></div>
                <div><span style={{ color: '#666' }}>Canal: </span><span style={{ color: '#e8e0d0' }}>{p.channel}</span></div>
                <div><span style={{ color: '#666' }}>Dor: </span><span style={{ color: '#e8e0d0' }}>{p.pain}</span></div>
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: p.color + '15', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: p.color }}>
                {p.message}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Messaging pillars */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', marginBottom: 16 }}>💬 Messaging Framework</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PILLARS.map(p => (
            <div key={p.number} style={{
              backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20,
              border: '1px solid #2a2a2a', display: 'grid',
              gridTemplateColumns: '80px 1fr', gap: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: p.color, lineHeight: 1 }}>{p.number}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: p.color, marginTop: 4 }}>{p.title}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontStyle: 'italic', color: '#e8e0d0', marginBottom: 8 }}>{p.tagline}</div>
                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 10 }}>{p.description}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.examples.map(e => (
                    <span key={e} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, backgroundColor: p.color + '20', color: p.color, border: `1px solid ${p.color}33` }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tom de voz */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', marginBottom: 16 }}>🗣️ Tom de Voz</h2>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 14, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#52b788', backgroundColor: '#52b78808' }}>✓ FAZ</div>
            <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#e63946', backgroundColor: '#e6394608', borderLeft: '1px solid #2a2a2a' }}>✗ NÃO FAZ</div>
          </div>
          {VOICE_RULES.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: i === 0 ? 'none' : '1px solid #1e1e1e' }}>
              <div style={{ padding: '10px 16px', fontSize: 13, color: '#e8e0d0' }}>{r.do}</div>
              <div style={{ padding: '10px 16px', fontSize: 13, color: '#888', borderLeft: '1px solid #2a2a2a' }}>{r.dont}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Market positioning */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#c9a96e', marginBottom: 16 }}>📊 Posicionamento 2026</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Comissão', value: '5%', sub: '50% CPCV · 50% Escritura', color: '#c9a96e' },
            { label: 'Segmento Core', value: '€500K–€3M', sub: 'Portugal + Espanha', color: '#c9a96e' },
            { label: 'Mercado PT 2026', value: '€3.076/m²', sub: 'mediana nacional', color: '#52b788' },
            { label: 'Crescimento YoY', value: '+17,6%', sub: '169.812 transacções', color: '#52b788' },
            { label: 'DOM Médio', value: '210 dias', sub: 'média de mercado', color: '#888' },
            { label: 'Ranking Luxury', value: 'Top 5', sub: 'Lisboa, nível mundial', color: '#c9a96e' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: '16px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#e8e0d0', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
