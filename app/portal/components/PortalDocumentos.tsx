'use client'
import { useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { DOC_LIBRARY } from './constants'

export default function PortalDocumentos() {
  const { darkMode } = useUIStore()
  const [docSearch, setDocSearch] = useState('')

  type DocItem = { name: string; desc: string; badge?: string; url?: string }
  type DocCat = { category: string; docs: DocItem[] }
  const filteredDocs = (DOC_LIBRARY as unknown as DocCat[]).map((cat) => ({
    ...cat,
    docs: docSearch.trim()
      ? cat.docs.filter(doc =>
          doc.name.toLowerCase().includes(docSearch.toLowerCase()) ||
          doc.desc.toLowerCase().includes(docSearch.toLowerCase())
        )
      : cat.docs,
  })).filter(cat => cat.docs.length > 0)

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Biblioteca Jurídica</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Documentação & Templates</div>
      </div>

      <input
        className="p-inp"
        style={{ marginBottom: '24px' }}
        placeholder="Pesquisar documentos, contratos, checklists..."
        value={docSearch}
        onChange={e => setDocSearch(e.target.value)}
      />

      {filteredDocs.map((cat) => (
        <div key={cat.category} style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
            {cat.category}
          </div>
          <div>
            {cat.docs.map((doc) => (
              <div key={doc.name} className="doc-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', marginBottom: '2px' }}>{doc.name}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>{doc.desc}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  {doc.badge && (
                    <span style={{ padding: '2px 8px', background: 'rgba(28,74,53,.08)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.34rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {doc.badge}
                    </span>
                  )}
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '5px 14px', background: '#1c4a35', color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textDecoration: 'none', textTransform: 'uppercase' }}>
                      Ver →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredDocs.length === 0 && docSearch && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(14,14,13,.4)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
          Nenhum documento encontrado para "{docSearch}"
        </div>
      )}
    </div>
  )
}
