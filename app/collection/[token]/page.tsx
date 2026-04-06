'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'

interface CollectionItem {
  property: { id: string; nome: string; zona: string; preco: number; area: number; quartos: number; tipo: string; badge?: string }
  addedAt: string
  agentNote?: string
  clientNote?: string
  interestScore?: number
}

interface Comment {
  author: string; text: string; timestamp: string; language?: string
}

interface Collection {
  id: string; name: string; clientName?: string; clientEmail?: string
  items: CollectionItem[]; comments: Comment[]; aiProfile?: string
  createdAt: string; updatedAt: string
}

const GRADIENTS = [
  'linear-gradient(135deg,#1c4a35,#0c1f15)',
  'linear-gradient(135deg,#2d5a40,#1c4a35)',
  'linear-gradient(135deg,#0c3020,#1c4a35)',
  'linear-gradient(135deg,#1a3a2a,#0d2018)',
]

export default function CollectionSharePage() {
  const params = useParams()
  const token = params?.token as string
  const [collection, setCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientNote, setClientNote] = useState<Record<string, string>>({})
  const [interestScore, setInterestScore] = useState<Record<string, number>>({})
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [clientName, setClientName] = useState('')
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!token) return
    fetch(`/api/collections?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCollection(d.collection)
          // Pre-populate interest scores from collection data
          const scores: Record<string, number> = {}
          d.collection.items.forEach((item: CollectionItem) => {
            if (item.interestScore) scores[item.property.id] = item.interestScore
          })
          setInterestScore(scores)
        } else {
          setError('Colecção não encontrada ou expirada.')
        }
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar colecção.'); setLoading(false) })
  }, [token])

  const saveClientNote = async (propId: string) => {
    if (!collection || !clientNote[propId]?.trim()) return
    await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_item', collectionId: collection.id, data: { propertyId: propId, clientNote: clientNote[propId] } }),
    })
    setSaved(p => ({ ...p, [propId]: true }))
    setTimeout(() => setSaved(p => ({ ...p, [propId]: false })), 2000)
  }

  const rateProperty = async (propId: string, score: number) => {
    if (!collection) return
    setInterestScore(p => ({ ...p, [propId]: score }))
    await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_item', collectionId: collection.id, data: { propertyId: propId, interestScore: score } }),
    })
  }

  const addComment = async () => {
    if (!collection || !commentText.trim()) return
    setCommenting(true)
    const r = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_comment', collectionId: collection.id, data: { author: clientName || collection.clientName || 'Cliente', text: commentText, language: 'pt' } }),
    })
    const d = await r.json()
    if (d.success) { setCollection(d.collection); setCommentText('') }
    setCommenting(false)
  }

  const S = {
    page: { minHeight: '100vh', background: '#0c1f15', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" } as CSSProperties,
    wrap: { maxWidth: '900px', margin: '0 auto', padding: '48px 24px' } as CSSProperties,
  }

  if (loading) return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.5)', letterSpacing: '.15em' }}>A CARREGAR...</div>
      </div>
    </div>
  )

  if (error || !collection) return (
    <div style={S.page}>
      <div style={{ ...S.wrap, textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', color: '#f4f0e6', marginBottom: '8px' }}>Colecção não disponível</div>
        <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.85rem', color: 'rgba(244,240,230,.4)' }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: 'rgba(12,31,21,.98)', borderBottom: '1px solid rgba(201,169,110,.15)', padding: '16px 32px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: '#c9a96e', letterSpacing: '.12em', textTransform: 'uppercase' }}>Agency Group · AMI 22506</div>
          <div style={{ width: '1px', height: '14px', background: 'rgba(201,169,110,.3)' }} />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>Selecção Exclusiva</div>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.2)' }}>
          {collection.items.length} propriedade{collection.items.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={S.wrap}>
        {/* Title block */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: '12px' }}>
            Selecção Personalizada
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontSize: '2.4rem', fontWeight: 600, color: '#f4f0e6', lineHeight: 1.1, margin: '0 0 12px' }}>
            {collection.name}
          </h1>
          {collection.clientName && (
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.5)' }}>
              Preparado para {collection.clientName}
            </div>
          )}
          {collection.aiProfile && (
            <div style={{ marginTop: '16px', padding: '14px 20px', background: 'rgba(201,169,110,.05)', border: '1px solid rgba(201,169,110,.15)', display: 'inline-block', maxWidth: '600px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '6px' }}>✦ Análise do Perfil</div>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.6)', lineHeight: 1.6 }}>{collection.aiProfile}</div>
            </div>
          )}
        </div>

        {/* Properties grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '20px', marginBottom: '48px' }}>
          {collection.items.map((item, idx) => (
            <div key={item.property.id} style={{ background: 'rgba(244,240,230,.02)', border: '1px solid rgba(244,240,230,.08)', overflow: 'hidden' }}>
              {/* Image placeholder */}
              <div style={{ height: '160px', background: GRADIENTS[idx % GRADIENTS.length], position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px' }}>
                {item.property.badge && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(201,169,110,.2)', border: '1px solid rgba(201,169,110,.4)', padding: '3px 8px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: '#c9a96e', textTransform: 'uppercase' }}>
                    {item.property.badge}
                  </div>
                )}
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 600, color: '#f4f0e6', lineHeight: 1.2 }}>{item.property.nome}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.6)', marginTop: '4px' }}>{item.property.zona}</div>
              </div>

              <div style={{ padding: '16px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Preço', val: `€${(item.property.preco / 1e6).toFixed(2)}M` },
                    { label: 'Área', val: `${item.property.area}m²` },
                    { label: 'Tipologia', val: `T${item.property.quartos}` },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(244,240,230,.03)', border: '1px solid rgba(244,240,230,.05)' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', marginBottom: '3px' }}>{s.label}</div>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: '.9rem', color: '#f4f0e6', fontWeight: 600 }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Agent note */}
                {item.agentNote && (
                  <div style={{ padding: '10px 12px', background: 'rgba(28,74,53,.2)', border: '1px solid rgba(28,74,53,.3)', marginBottom: '12px' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '4px' }}>Nota do Consultor</div>
                    <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.65)', lineHeight: 1.6, fontStyle: 'italic' }}>"{item.agentNote}"</div>
                  </div>
                )}

                {/* Interest rating */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '6px' }}>O seu interesse</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} onClick={() => rateProperty(item.property.id, s)} style={{ cursor: 'pointer', fontSize: '1.1rem', color: s <= (interestScore[item.property.id] || 0) ? '#c9a96e' : 'rgba(244,240,230,.12)', transition: 'color .15s' }}>★</span>
                    ))}
                  </div>
                </div>

                {/* Client note */}
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '6px' }}>A sua nota</div>
                  <textarea
                    value={clientNote[item.property.id] || ''}
                    onChange={e => setClientNote(p => ({ ...p, [item.property.id]: e.target.value }))}
                    rows={2}
                    placeholder="O que acha deste imóvel? Questões, observações..."
                    style={{ width: '100%', background: 'rgba(244,240,230,.03)', border: '1px solid rgba(244,240,230,.1)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.75rem', padding: '7px 10px', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button onClick={() => saveClientNote(item.property.id)} disabled={!clientNote[item.property.id]?.trim()} style={{ marginTop: '6px', padding: '5px 14px', background: 'rgba(28,74,53,.4)', border: '1px solid rgba(28,74,53,.5)', color: saved[item.property.id] ? '#4a9c7a' : '#c9a96e', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', cursor: 'pointer' }}>
                    {saved[item.property.id] ? '✓ GUARDADO' : 'GUARDAR NOTA'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comments section */}
        <div style={{ background: 'rgba(28,74,53,.1)', border: '1px solid rgba(28,74,53,.25)', padding: '28px', marginBottom: '40px' }}>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', color: '#f4f0e6', marginBottom: '16px' }}>Comentários &amp; Perguntas</div>

          {/* Existing comments */}
          <div style={{ marginBottom: '20px' }}>
            {collection.comments.length === 0 && (
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.2)', padding: '16px 0' }}>Sem comentários ainda. Seja o primeiro!</div>
            )}
            {collection.comments.map((c, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid rgba(244,240,230,.05)' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: '#c9a96e' }}>{c.author}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.2)' }}>{new Date(c.timestamp).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.7)', lineHeight: 1.6 }}>{c.text}</div>
              </div>
            ))}
          </div>

          {/* New comment */}
          <div>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="O seu nome (opcional)"
              style={{ width: '100%', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(244,240,230,.08)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '8px 12px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={3}
              placeholder="Escreva uma mensagem, pergunta ou comentário ao consultor..."
              style={{ width: '100%', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(244,240,230,.08)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '8px 12px', resize: 'none', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <button onClick={addComment} disabled={!commentText.trim() || commenting} style={{ padding: '10px 28px', background: commentText.trim() ? '#c9a96e' : 'rgba(201,169,110,.15)', color: commentText.trim() ? '#0c1f15' : 'rgba(201,169,110,.3)', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700 }}>
              {commenting ? 'A ENVIAR...' : 'ENVIAR MENSAGEM'}
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.2)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: '8px' }}>Tem interesse em algum imóvel?</div>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', color: '#f4f0e6', marginBottom: '16px' }}>Fale com o seu consultor</div>
          <a href="mailto:geral@agencygroup.pt" style={{ display: 'inline-block', padding: '12px 32px', background: '#c9a96e', color: '#0c1f15', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 700 }}>
            CONTACTAR AGORA
          </a>
          <div style={{ marginTop: '24px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.15)' }}>
            Agency Group · AMI 22506 · geral@agencygroup.pt
          </div>
        </div>
      </div>
    </div>
  )
}
