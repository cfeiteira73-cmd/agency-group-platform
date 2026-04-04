// WhatsApp Business API client
// Uses Meta Cloud API (free tier: 1000 conversations/month)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const WA_API_URL = 'https://graph.facebook.com/v21.0'
// Lidos dinamicamente para suportar testes e hot-reload de env vars
const getPhoneNumberId = () => process.env.WHATSAPP_PHONE_NUMBER_ID
const getAccessToken   = () => process.env.WHATSAPP_ACCESS_TOKEN

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WATextMessage {
  to: string
  type: 'text'
  text: string
}

export interface WATemplateComponent {
  type: 'body' | 'header' | 'button'
  parameters: Array<{ type: 'text'; text: string }>
}

export interface WATemplateMessage {
  to: string
  type: 'template'
  template: {
    name: string
    language: string
    components?: WATemplateComponent[]
  }
}

export type WAMessage = WATextMessage | WATemplateMessage

export interface WASendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Core Send Function ───────────────────────────────────────────────────────

export async function sendWhatsApp(message: WAMessage): Promise<WASendResult> {
  // ── Feature flag: Sofia WhatsApp OFF ─────────────────────────────────────
  // Set WHATSAPP_ACTIVE=true no .env.local para activar Sofia no WhatsApp
  if (process.env.WHATSAPP_ACTIVE !== 'true') {
    console.log('[WhatsApp] Sofia inactiva (WHATSAPP_ACTIVE=false) — mensagem bloqueada para:', message.to)
    return { success: false, error: 'WhatsApp inactivo — alterar WHATSAPP_ACTIVE=true para activar' }
  }

  const PHONE_NUMBER_ID = getPhoneNumberId()
  const ACCESS_TOKEN    = getAccessToken()

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN')
    return { success: false, error: 'WhatsApp API not configured' }
  }

  try {
    const to = message.to.replace(/\s/g, '')

    let body: Record<string, unknown>

    if (message.type === 'text') {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: message.text,
        },
      }
    } else {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: message.template.name,
          language: { code: message.template.language },
          components: message.template.components ?? [],
        },
      }
    }

    const response = await fetch(`${WA_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as {
      messages?: Array<{ id: string }>
      error?: { message: string; code: number }
    }

    if (!response.ok) {
      console.error('[WhatsApp] API error:', data.error)
      return {
        success: false,
        error: data.error?.message || `WhatsApp API error (${response.status})`,
      }
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    }
  } catch (error) {
    console.error('[WhatsApp] Send error:', error)
    return { success: false, error: 'Erro ao enviar WhatsApp' }
  }
}

// ─── Pre-built Message Templates ─────────────────────────────────────────────

export const templates = {
  novoContacto: (nome: string, zona: string, budget: string): string =>
    `Olá ${nome}! Sou o Carlos Feiteira da Agency Group (AMI 22506). Vi que tem interesse em imóveis ${zona !== '—' ? `em ${zona}` : 'em Portugal'} com budget até ${budget}. Tenho imóveis exclusivos que correspondem ao seu perfil — posso apresentar-lhe esta semana?`,

  followUp: (nome: string, imovel: string): string =>
    `Olá ${nome}! Queria saber se teve oportunidade de analisar os detalhes do ${imovel}. Está disponível para uma chamada esta semana para esclarecer dúvidas?`,

  visitaConfirmacao: (nome: string, imovel: string, data: string, hora: string): string =>
    `Olá ${nome}! Confirmo a visita ao ${imovel} para ${data} às ${hora}. Encontramo-nos na entrada principal. Qualquer questão, contacte-me. Carlos Feiteira — Agency Group`,

  proposta: (nome: string, imovel: string, valor: string): string =>
    `Olá ${nome}! Conforme conversado, envio proposta formal para o ${imovel}: ${valor}. O nosso advogado irá contactá-lo para os próximos passos. Obrigado pela confiança — Agency Group`,

  cpcvReminder: (nome: string, data: string): string =>
    `Olá ${nome}! Lembrete: CPCV agendado para ${data}. Documentação necessária: NIF, BI/Passaporte, comprovativo de morada. Até ${data}!`,

  investorPitch: (nome: string, imovel: string, yield_: string, valor: string): string =>
    `Olá ${nome}! Oportunidade de investimento exclusiva: ${imovel} com yield bruta de ${yield_} — €${valor}. Disponível para uma apresentação privada esta semana? Agency Group (AMI 22506)`,

  docsPendentes: (nome: string, documentos: string): string =>
    `Olá ${nome}! Para avançar com a escritura, precisamos dos seguintes documentos: ${documentos}. Por favor envie até ao fim desta semana. Obrigado — Agency Group`,
} as const

export type TemplateName = keyof typeof templates
