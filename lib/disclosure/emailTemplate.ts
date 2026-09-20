// =============================================================================
// Agency Group — Deal Pack Disclosure Email Template
// Phase 2C.D2-B-DISCLOSURE-FOUNDATION
//
// Buyer-safe only. MUST NOT expose:
//   ✗ created_by, lead_id, match_id, internal IDs
//   ✗ opportunity_score (numerical internal metric)
//   ✗ raw financial_projections with cost basis / margin
//   ✗ agent qualification notes, match_score, breakdown, ai_summary
//
// Safe to expose:
//   ✓ property title, price, location, typology, area, features
//   ✓ investment_thesis (narrative, written for buyer)
//   ✓ market_summary (buyer-facing narrative)
//   ✓ highlights (buyer-facing array)
//   ✓ estimated yield only from financial_projections
//   ✓ agent name + agency contact
// =============================================================================

export interface DisclosureEmailData {
  /** Buyer first name (from contacts.full_name — first word) */
  buyerFirstName: string
  /** Pack title */
  packTitle: string
  /** Property title */
  propertyTitle: string
  /** City/area of property */
  propertyLocation: string
  /** Property price in EUR */
  propertyPrice: number
  /** Property typology: 'apartment' | 'villa' | etc */
  propertyType: string
  /** Area in m² */
  areaM2: number | null
  /** Bedrooms */
  bedrooms: number | null
  /** Buyer-safe narrative thesis (from deal_packs.investment_thesis) */
  investmentThesis: string | null
  /** Buyer-safe market summary (from deal_packs.market_summary) */
  marketSummary: string | null
  /** Highlights array (from deal_packs.highlights) */
  highlights: string[]
  /** Estimated rental yield only — extracted from financial_projections */
  estimatedYield: number | null
  /** Agent full name */
  agentName: string
  /** Agency display phone */
  agencyPhone: string
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds the buyer-safe HTML email body for a Deal Pack disclosure.
 * No internal IDs, scores, or agent data are embedded.
 */
export function buildDisclosureEmailHtml(data: DisclosureEmailData): string {
  const { buyerFirstName, packTitle, propertyTitle, propertyLocation, propertyPrice,
    propertyType, areaM2, bedrooms, investmentThesis, marketSummary, highlights,
    estimatedYield, agentName, agencyPhone } = data

  const highlightsHtml = highlights.length > 0
    ? `<ul style="margin:0;padding-left:20px;color:#374151;">${highlights.map(h => `<li style="margin-bottom:4px;">${escapeHtml(h)}</li>`).join('')}</ul>`
    : ''

  const yieldRow = estimatedYield != null
    ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:14px;">Yield estimado</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${estimatedYield.toFixed(1)}%</td></tr>`
    : ''

  const areaRow = areaM2 != null
    ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:14px;">Área</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${areaM2} m²</td></tr>`
    : ''

  const bedroomsRow = bedrooms != null
    ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:14px;">Quartos</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${bedrooms} T${bedrooms}</td></tr>`
    : ''

  const thesisSection = investmentThesis
    ? `<div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">Tese de Investimento</h3>
        <p style="margin:0;color:#374151;line-height:1.7;">${escapeHtml(investmentThesis)}</p>
      </div>`
    : ''

  const marketSection = marketSummary
    ? `<div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">Contexto de Mercado</h3>
        <p style="margin:0;color:#374151;line-height:1.7;">${escapeHtml(marketSummary)}</p>
      </div>`
    : ''

  const highlightsSection = highlightsHtml
    ? `<div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">Destaques</h3>
        ${highlightsHtml}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(packTitle)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">

    <!-- Header -->
    <div style="background:#0B1120;border-radius:8px 8px 0 0;padding:24px 32px;">
      <p style="margin:0;color:#9CA3AF;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Agency Group · Imobiliário de Luxo</p>
      <h1 style="margin:8px 0 0;color:#FFFFFF;font-size:22px;font-weight:700;">Oportunidade Selecionada para Si</h1>
    </div>

    <!-- Body -->
    <div style="background:#FFFFFF;border-radius:0 0 8px 8px;padding:32px;">

      <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
        Caro/a <strong>${escapeHtml(buyerFirstName)}</strong>,
      </p>
      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.7;">
        Com base no seu perfil de investimento, identificámos uma oportunidade que acreditamos ser do seu interesse.
        Apresentamos em exclusivo o seguinte imóvel.
      </p>

      <!-- Property Card -->
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:24px;margin-bottom:32px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(propertyType)} · ${escapeHtml(propertyLocation)}</p>
        <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">${escapeHtml(propertyTitle)}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr>
              <td style="padding:6px 0;color:#6B7280;font-size:14px;">Preço</td>
              <td style="padding:6px 0;font-weight:700;color:#0B1120;font-size:18px;text-align:right;">${formatEur(propertyPrice)}</td>
            </tr>
            ${areaRow}
            ${bedroomsRow}
            ${yieldRow}
          </tbody>
        </table>
      </div>

      ${thesisSection}
      ${marketSection}
      ${highlightsSection}

      <!-- CTA -->
      <div style="background:#0B1120;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
        <p style="margin:0 0 4px;color:#9CA3AF;font-size:13px;">Interessado/a? Contacte o seu consultor dedicado:</p>
        <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">${escapeHtml(agentName)}</p>
        <p style="margin:4px 0 0;color:#D1D5DB;font-size:15px;">${escapeHtml(agencyPhone)}</p>
      </div>

      <!-- Footer -->
      <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
        Esta comunicação foi preparada especificamente para si com base no seu perfil de investimento.
        É confidencial e dirigida exclusivamente ao destinatário indicado.
        Para não receber comunicações futuras da Agency Group, contacte o seu consultor.
      </p>
    </div>

  </div>
</body>
</html>`
}

/**
 * Plain-text fallback for the disclosure email.
 */
export function buildDisclosureEmailText(data: DisclosureEmailData): string {
  const { buyerFirstName, propertyTitle, propertyLocation, propertyPrice,
    investmentThesis, agentName, agencyPhone } = data

  return [
    `Caro/a ${buyerFirstName},`,
    '',
    'Com base no seu perfil de investimento, identificámos uma oportunidade do seu interesse.',
    '',
    `IMÓVEL: ${propertyTitle}`,
    `LOCALIZAÇÃO: ${propertyLocation}`,
    `PREÇO: ${formatEur(propertyPrice)}`,
    '',
    investmentThesis ? `TESE DE INVESTIMENTO:\n${investmentThesis}\n` : '',
    '---',
    `Consultor: ${agentName}`,
    `Contacto: ${agencyPhone}`,
    '',
    'Agency Group · Imobiliário de Luxo',
    'Esta comunicação foi preparada especificamente para si. Para não receber comunicações futuras, contacte o seu consultor.',
  ].filter(Boolean).join('\n')
}
