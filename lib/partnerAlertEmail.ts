// Pure function — testable without Next.js context.
// Generates the HTML body for the partner submission alert email.

export type PartnerAlertData = {
  agencyName: string
  agencyAMI:  string
  agencyEmail: string
  agencyPhone: string
  nome:        string
  zona:        string
  bairro?:     string
  tipo:        string
  preco:       number
  area:        number
  quartos:     number
  casasBanho:  number
  desc?:       string
  features:    string[]
  piscina?:    boolean
  garagem?:    boolean
  jardim?:     boolean
  terraco?:    boolean
  vista?:      string
  tourUrl?:    string
}

export function buildPartnerAlertHtml(d: PartnerAlertData): string {
  const featuresList = d.features.length > 0 ? d.features.join(', ') : '—'
  const extras = [
    d.piscina  && 'Piscina',
    d.garagem  && 'Garagem',
    d.jardim   && 'Jardim',
    d.terraco  && 'Terraço',
    d.vista    && `Vista: ${d.vista}`,
  ].filter(Boolean).join(' · ')

  return `
            <h2>Nova Submissão de Parceiro</h2>
            <h3>Agência</h3>
            <ul>
              <li><strong>Nome:</strong> ${d.agencyName}</li>
              <li><strong>AMI:</strong> ${d.agencyAMI}</li>
              <li><strong>Email:</strong> ${d.agencyEmail}</li>
              <li><strong>Telefone:</strong> ${d.agencyPhone}</li>
            </ul>
            <h3>Imóvel</h3>
            <ul>
              <li><strong>Nome:</strong> ${d.nome}</li>
              <li><strong>Zona:</strong> ${d.zona}${d.bairro ? ` — ${d.bairro}` : ''}</li>
              <li><strong>Tipo:</strong> ${d.tipo}</li>
              <li><strong>Preço:</strong> €${d.preco.toLocaleString('pt-PT')}</li>
              <li><strong>Área:</strong> ${d.area} m²</li>
              <li><strong>Quartos:</strong> T${d.quartos} | ${d.casasBanho} WC</li>
              ${extras ? `<li><strong>Extras:</strong> ${extras}</li>` : ''}
              ${d.tourUrl ? `<li><strong>Tour Virtual:</strong> <a href="${d.tourUrl}">${d.tourUrl}</a></li>` : ''}
              ${d.features.length ? `<li><strong>Features:</strong> ${featuresList}</li>` : ''}
            </ul>
            ${d.desc ? `<h3>Descrição</h3><p>${d.desc}</p>` : ''}
            <hr/>
            <p><small>Submetido via parceiros form — Agency Group</small></p>
          `
}
