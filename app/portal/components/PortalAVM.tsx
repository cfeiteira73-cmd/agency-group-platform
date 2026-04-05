'use client'
import { useUIStore } from '../stores/uiStore'
import { useAVMStore } from '../stores/avmStore'

interface PortalAVMProps {
  onRunAVM: () => Promise<void>
}

export default function PortalAVM({ onRunAVM }: PortalAVMProps) {
  const { darkMode } = useUIStore()
  const {
    avmResult, avmLoading,
    avmZona, setAvmZona,
    avmTipo, setAvmTipo,
    avmArea, setAvmArea,
    avmEstado, setAvmEstado,
    avmVista, setAvmVista,
    avmPiscina, setAvmPiscina,
    avmGaragem, setAvmGaragem,
    avmEpc, setAvmEpc,
    avmAndar, setAvmAndar,
    avmOrientacao, setAvmOrientacao,
    avmAnoConstr, setAvmAnoConstr,
    avmTerraco, setAvmTerraco,
    avmCasasBanho, setAvmCasasBanho,
    avmUso, setAvmUso,
  } = useAVMStore()

  const ZONAS = [
    'Lisboa — Chiado','Lisboa — Príncipe Real','Lisboa — Bairro Alto','Lisboa — Alfama','Lisboa — Belém',
    'Lisboa — Parque das Nações','Lisboa — Avenidas Novas','Cascais','Estoril','Sintra','Oeiras',
    'Porto — Foz','Porto — Boavista','Porto — Ribeira','Algarve — Lagos','Algarve — Albufeira',
    'Algarve — Vilamoura','Comporta','Alentejo','Madeira — Funchal','Açores — Ponta Delgada',
  ]

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Avaliação Automática de Imóveis</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>AVM Inteligente</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>6 metodologias RICS · Comparáveis em tempo real · Relatório PDF</div>
      </div>

      <div className="p-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form */}
        <div className="p-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="p-label">Zona / Localização</label>
              <select className="p-sel" value={avmZona} onChange={e => setAvmZona(e.target.value)}>
                {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Tipologia</label>
              <select className="p-sel" value={avmTipo} onChange={e => setAvmTipo(e.target.value)}>
                {['T0','T1','T2','T3','T4','T5+','Moradia','Villa','Penthouse','Loja','Escritório'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Área (m²)</label>
              <input className="p-inp" type="number" placeholder="ex: 120" value={avmArea} onChange={e => setAvmArea(e.target.value)} />
            </div>
            <div>
              <label className="p-label">Estado</label>
              <select className="p-sel" value={avmEstado} onChange={e => setAvmEstado(e.target.value)}>
                {['Novo','Excelente','Bom','Razoável','Para Renovar'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Vista</label>
              <select className="p-sel" value={avmVista} onChange={e => setAvmVista(e.target.value)}>
                {['interior','jardim','cidade','mar','rio','campo'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Andar</label>
              <select className="p-sel" value={avmAndar} onChange={e => setAvmAndar(e.target.value)}>
                {['rc','1-2','3-5','6+'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Certificado Energético</label>
              <select className="p-sel" value={avmEpc} onChange={e => setAvmEpc(e.target.value)}>
                {['A+','A','B','B-','C','D','E','F'].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Garagem</label>
              <select className="p-sel" value={avmGaragem} onChange={e => setAvmGaragem(e.target.value)}>
                {['sem','1','2','box'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Piscina</label>
              <select className="p-sel" value={avmPiscina} onChange={e => setAvmPiscina(e.target.value)}>
                <option value="nao">Sem piscina</option>
                <option value="sim">Com piscina</option>
              </select>
            </div>
            <div>
              <label className="p-label">Casas de Banho</label>
              <select className="p-sel" value={avmCasasBanho} onChange={e => setAvmCasasBanho(e.target.value)}>
                {['1','2','3','4+'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Ano Construção</label>
              <input className="p-inp" type="number" placeholder="ex: 2005" value={avmAnoConstr} onChange={e => setAvmAnoConstr(e.target.value)} />
            </div>
            <div>
              <label className="p-label">Terraço (m²)</label>
              <input className="p-inp" type="number" placeholder="0" value={avmTerraco} onChange={e => setAvmTerraco(e.target.value)} />
            </div>
            <div>
              <label className="p-label">Orientação</label>
              <select className="p-sel" value={avmOrientacao} onChange={e => setAvmOrientacao(e.target.value)}>
                <option value="">— Não especificado</option>
                {['Norte','Sul','Este','Oeste','Sul-Nascente','Sul-Poente'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label">Uso</label>
              <select className="p-sel" value={avmUso} onChange={e => setAvmUso(e.target.value)}>
                <option value="habitacao">Habitação</option>
                <option value="comercial">Comercial</option>
                <option value="investimento">Investimento</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <button className="p-btn" style={{ width: '100%' }} onClick={onRunAVM} disabled={avmLoading}>
                {avmLoading ? '✦ A calcular...' : '✦ Avaliar Imóvel'}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {!avmResult && !avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏠</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: darkMode ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.4)', marginBottom: '8px' }}>Aguarda avaliação</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)', lineHeight: 1.6 }}>Preencha os dados e clique em Avaliar</div>
            </div>
          )}
          {avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A calcular avaliação...</div>
            </div>
          )}
          {avmResult && (
            <div className="p-card">
              <div style={{ marginBottom: '20px' }}>
                <div className="p-label">Valor de Mercado Estimado</div>
                <div className="p-result-val">
                  €{Number((avmResult as Record<string, unknown>).valor_central || 0).toLocaleString('pt-PT')}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>
                  Intervalo: €{Number((avmResult as Record<string, unknown>).valor_min || 0).toLocaleString('pt-PT')} — €{Number((avmResult as Record<string, unknown>).valor_max || 0).toLocaleString('pt-PT')}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: '€/m²', val: `€${Number((avmResult as Record<string, unknown>).preco_m2 || 0).toLocaleString('pt-PT')}` },
                  { label: 'Confiança', val: `${(avmResult as Record<string, unknown>).confianca || '—'}%` },
                  { label: 'Rentabilidade Bruta', val: `${(avmResult as Record<string, unknown>).yield_bruto || '—'}%` },
                  { label: 'Liquidez', val: String((avmResult as Record<string, unknown>).liquidez || '—') },
                ].map(m => (
                  <div key={m.label} style={{ padding: '12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: '#1c4a35', fontWeight: 300 }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
