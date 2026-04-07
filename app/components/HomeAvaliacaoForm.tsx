'use client'

// ─── Avaliação Privada form — client island for the WhatsApp CTA ──────────────

export default function HomeAvaliacaoForm() {
  function submitAvaliacao() {
    const nome = (document.getElementById('avalNome') as HTMLInputElement)?.value || ''
    const tel  = (document.getElementById('avalTel')  as HTMLInputElement)?.value || ''
    const zona = (document.getElementById('avalZona') as HTMLInputElement)?.value || ''
    if (!nome || !tel) {
      window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg: 'Por favor preenche o nome e telefone.', type: 'error' } }))
      return
    }
    window.open(
      `https://wa.me/351919948986?text=${encodeURIComponent(`Pedido de avaliação privada:\nNome: ${nome}\nTelefone: ${tel}\nZona: ${zona}`)}`,
      '_blank'
    )
  }

  return (
    <button
      type="button"
      onClick={submitAvaliacao}
      style={{marginTop:'8px',padding:'14px',background:'#1c4a35',color:'#f4f0e6',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.16em',textTransform:'uppercase',cursor:'pointer',fontWeight:400,transition:'background .25s,transform .2s'}}
      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLButtonElement).style.background='#16382a'}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';(e.currentTarget as HTMLButtonElement).style.background='#1c4a35'}}
    >
      Pedir Avaliação Privada →
    </button>
  )
}
