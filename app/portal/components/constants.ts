// ─── Portal Constants ─────────────────────────────────────────────────────────
import type { NavItem } from './types'

export const NAV: NavItem[] = [
  { id:'dashboard', label:'Dashboard', icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', group:'' },
  { id:'crm', label:'CRM Clientes', icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', group:'CLIENTES' },
  { id:'voz', label:'Nota de Voz → CRM', icon:'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', group:'CLIENTES' },
  { id:'campanhas', label:'Campanhas Email', icon:'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', group:'CLIENTES' },
  { id:'visitas', label:'Gestão de Visitas', icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', group:'CLIENTES' },
  { id:'pipeline', label:'Pipeline CPCV', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', group:'DEALS' },
  { id:'dealdesk', label:'⚡ Deal Desk & Pipeline', icon:'M13 10V3L4 14h7v7l9-11h-7z', group:'DEALS' },
  { id:'radar', label:'Deal Radar 16D', icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', group:'DEALS' },
  { id:'avm', label:'Avaliação AVM', icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z', group:'DEALS' },
  { id:'draftOffer', label:'Redigir Proposta IA', icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', group:'DEALS' },
  { id:'credito', label:'Simulador Crédito', icon:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', group:'ANÁLISE' },
  { id:'nhr', label:'NHR / IFICI', icon:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064', group:'ANÁLISE' },
  { id:'maisvalias', label:'Mais-Valias', icon:'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', group:'ANÁLISE' },
  { id:'financiamento', label:'Crédito Estrangeiros', icon:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064', group:'ANÁLISE' },
  { id:'imt', label:'Calculadora IMT/IS', icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z', group:'ANÁLISE' },
  { id:'comissoes', label:'Comissões P&L', icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', group:'ANÁLISE' },
  { id:'exitSim', label:'Simulador de Saída', icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'ANÁLISE' },
  { id:'portfolio', label:'Portfolio Análise', icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'ANÁLISE' },
  { id:'crossCompare', label:'Comparar Mercados', icon:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', group:'ANÁLISE' },
  { id:'pulse', label:'Market Pulse IA', icon:'M13 10V3L4 14h7v7l9-11h-7z', group:'ANÁLISE' },
  { id:'marketing', label:'Marketing AI', icon:'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', group:'FERRAMENTAS IA' },
  { id:'homestaging', label:'Home Staging IA', icon:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', group:'FERRAMENTAS IA' },
  { id:'investorpitch', label:'Investor Pitch IA', icon:'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', group:'FERRAMENTAS IA' },
  { id:'sofia', label:'Sofia Avatar IA', icon:'M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', group:'FERRAMENTAS IA' },
  { id:'juridico', label:'Consultor Jurídico IA', icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', group:'FERRAMENTAS IA' },
  { id:'videoStudio', label:'Sofia Video Studio', icon:'M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', group:'FERRAMENTAS IA' },
  { id:'photos', label:'📸 Photo Scorer', icon:'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z', group:'FERRAMENTAS IA' },
  { id:'agentai', label:'🤖 Agente IA', icon:'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1', group:'FERRAMENTAS IA' },
  { id:'analytics', label:'Analytics & BI', icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'CAPTAÇÃO' },
  { id:'investidores', label:'Motor Investidores', icon:'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', group:'CAPTAÇÃO' },
  { id:'dealpack', label:'📄 Deal Packs IA', icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', group:'CAPTAÇÃO' },
  { id:'systemHealth',   label:'🛡 System Health',       icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', group:'SISTEMA' },
  { id:'economicTruth',  label:'📊 Economic Truth',      icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'SISTEMA' },
  { id:'modelControl',   label:'🧠 Model Control',       icon:'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', group:'SISTEMA' },
  { id:'governance',      label:'⚖ Governance',           icon:'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', group:'SISTEMA' },
  { id:'platformConfig', label:'⚙️ Platform Config',    icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', group:'SISTEMA' },
  { id:'funnelCRO',     label:'📊 Funnel CRO',          icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'ANALYTICS' },
  { id:'marketingHub',  label:'🚀 Marketing Hub',       icon:'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.952 9.168-5v16', group:'ANALYTICS' },
  { id:'outbound', label:'Captação Off-Market', icon:'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', group:'CAPTAÇÃO' },
  { id:'offmarket', label:'Leads Off-Market', icon:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', group:'CAPTAÇÃO' },
  { id:'partners', label:'Parceiros Institucionais', icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', group:'CAPTAÇÃO' },
  { id:'imoveis', label:'Imóveis', icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10', group:'OPERAÇÕES' },
  { id:'documentos', label:'Documentação', icon:'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z', group:'OPERAÇÕES' },
  { id:'agenda', label:'Agenda Semanal', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', group:'OPERAÇÕES' },
  { id:'collections', label:'Collections IA', icon:'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', group:'OPERAÇÕES' },
]

export const PIPELINE_STAGES = ['Angariação','Proposta Enviada','Proposta Aceite','Due Diligence','CPCV Assinado','Financiamento','Escritura Marcada','Escritura Concluída']

export const STAGE_PCT: Record<string, number> = {
  'Angariação':10, 'Proposta Enviada':20, 'Proposta Aceite':35,
  'Due Diligence':50, 'CPCV Assinado':70, 'Financiamento':80,
  'Escritura Marcada':90, 'Escritura Concluída':100,
}

export const STAGE_COLOR: Record<string, string> = {
  'Angariação':'#888', 'Proposta Enviada':'#3a7bd5', 'Proposta Aceite':'#3a7bd5',
  'Due Diligence':'#4a9c7a', 'CPCV Assinado':'#c9a96e', 'Financiamento':'#c9a96e',
  'Escritura Marcada':'#1c4a35', 'Escritura Concluída':'#1c4a35',
}

export const STAGE_TARGET_DAYS: Record<string, number> = {
  'Angariação': 14,
  'Proposta Enviada': 7,
  'Proposta Aceite': 5,
  'Due Diligence': 14,
  'CPCV Assinado': 30,
  'Financiamento': 21,
  'Escritura Marcada': 7,
  'Escritura Concluída': 0,
}

export const CHECKLISTS: Record<string, string[]> = {
  'Angariação':['Caderneta predial urbana','Certidão de teor do registo predial','Licença de utilização / habitação','Certificado energético (EPC)','Planta do imóvel','Fotos profissionais realizadas','Relatório AVM gerado','Contrato de mediação assinado','Ficha técnica do imóvel'],
  'Proposta Enviada':['Carta de oferta formal enviada','Prova de fundos do comprador','Carta de pré-aprovação bancária','Identificação do comprador (CC/Passaporte)','NIF do comprador confirmado'],
  'Proposta Aceite':['Contraproposta (se aplicável)','Confirmação escrita de aceitação','Advogado do comprador identificado','Advogado do vendedor confirmado','Data CPCV acordada'],
  'Due Diligence':['Certidão permanente sem ónus','Vistoria técnica ao imóvel','Verificação de dívidas IMI','Licença de obras (se remodelado)','Seguro de vida do comprador'],
  'CPCV Assinado':['CPCV redigido e revisto','Sinal transferido (10–30%)','Recibo de sinal emitido','Data de escritura acordada','Procuração (se aplicável)'],
  'Financiamento':['Avaliação bancária realizada','Aprovação formal do crédito','Seguro multirriscos habitação','Taxa de juro e spread confirmados','Minuta do contrato bancário revista'],
  'Escritura Marcada':['Notário confirmado e agendado','IMT calculado e pago','IS (0,8%) calculado e pago','Distrato anterior (se hipoteca)','Chaves e documentos preparados'],
  'Escritura Concluída':['Escritura assinada ✅','Registo predial actualizado','Chaves entregues ao comprador','Comissão liquidada','Deal registado no Notion CRM'],
}

export const DOC_LIBRARY = [
  { fase:'Angariação', docs:[
    { name:'Contrato de Mediação Imobiliária', desc:'Modelo AG — exclusivo e não exclusivo', fileUrl:'/docs/cmi-v4-final.html' },
    { name:'Ficha de Identificação do Imóvel', desc:'CIMI + características técnicas', fileUrl:'/docs/01-ficha-imovel.html' },
    { name:'Checklist Documentos Vendedor', desc:'Todos os documentos necessários para angariação', fileUrl:'/docs/02-checklist-vendedor.html' },
    { name:'Relatório AVM — Template PDF', desc:'Relatório profissional de avaliação automática', fileUrl:'/docs/03-relatorio-avm.html' },
  ]},
  { fase:'Proposta / Negociação', docs:[
    { name:'Carta de Oferta Formal', desc:'Template bilingue PT/EN', fileUrl:'/docs/04-carta-oferta.html' },
    { name:'Contraproposta', desc:'Modelo com condições suspensivas', fileUrl:'/docs/05-contraproposta.html' },
    { name:'Declaração de Fundos (Proof of Funds)', desc:'Modelo para compradores internacionais', fileUrl:'/docs/06-proof-of-funds.html' },
  ]},
  { fase:'CPCV', docs:[
    { name:'CPCV — Habitação Própria', desc:'Com cláusulas de financiamento e condições suspensivas', fileUrl:'/docs/07-cpcv-hpp.html' },
    { name:'CPCV — Investimento', desc:'Sem condições suspensivas, prazo reduzido', fileUrl:'/docs/08-cpcv-investimento.html' },
    { name:'CPCV — Off-Plan', desc:'Para imóveis em construção — faseamento de pagamentos', fileUrl:'/docs/09-cpcv-offplan.html' },
    { name:'Adenda ao CPCV', desc:'Prorrogação de prazo ou alteração de condições', fileUrl:'/docs/10-adenda-cpcv.html' },
  ]},
  { fase:'Due Diligence', docs:[
    { name:'Checklist Due Diligence Completo', desc:'Jurídico, técnico, fiscal e urbanístico', fileUrl:'/docs/11-due-diligence.html' },
    { name:'Relatório Técnico de Vistoria', desc:'Template para engenheiro/arquitecto', fileUrl:'/docs/12-relatorio-vistoria.html' },
    { name:'Declaração de Débitos IMI', desc:'Pedido às Finanças', fileUrl:'/docs/13-declaracao-imi.html' },
  ]},
  { fase:'Escritura', docs:[
    { name:'Guia IMT 2026 — Cálculo Completo', desc:'Tabelas actualizadas + isenções HPP', fileUrl:'/docs/14-guia-imt-2026.html' },
    { name:'Checklist Final Escritura', desc:'Tudo o que é necessário no dia da escritura', fileUrl:'/docs/15-checklist-escritura.html' },
    { name:'Declaração de Entrega de Chaves', desc:'Vistoria final + inventário', fileUrl:'/docs/16-declaracao-entrega-chaves.html' },
    { name:'Recibo de Comissão', desc:'Template Agency Group AMI 22506', fileUrl:'/docs/17-recibo-comissao.html' },
  ]},
]

export const FORMATS = [
  { id:'idealista', label:'Idealista', icon:'🏠', charLimit: 4000 },
  { id:'instagram', label:'Instagram', icon:'📸', charLimit: 2200 },
  { id:'facebook', label:'Facebook', icon:'👥', charLimit: 63206 },
  { id:'linkedin', label:'LinkedIn', icon:'💼', charLimit: 3000 },
  { id:'whatsapp', label:'WhatsApp', icon:'💬', charLimit: 1000 },
  { id:'newsletter', label:'Newsletter', icon:'📧', charLimit: 10000 },
  { id:'video', label:'Script Vídeo', icon:'🎥', charLimit: 3000 },
  { id:'brochure', label:'Brochura', icon:'📄', charLimit: 2000 },
  { id:'x_thread', label:'X Thread', icon:'𝕏', charLimit: 1960 },
  { id:'reels', label:'Reels/TikTok', icon:'🎬', charLimit: 500 },
  { id:'email_drip', label:'Email Drip 3x', icon:'📨', charLimit: 8000 },
  { id:'sms', label:'SMS 160', icon:'📱', charLimit: 160 },
]

export const PERSONAS = [
  { id:'americano', label:'🇺🇸 Americano', sub:'Tech/Finance · ROI + lifestyle' },
  { id:'frances', label:'🇫🇷 Francês', sub:'Art de vivre · Fiscal' },
  { id:'britanico', label:'🇬🇧 Britânico', sub:'Investor · Post-Brexit' },
  { id:'brasileiro', label:'🇧🇷 Brasileiro', sub:'Passaporte EU · Família' },
  { id:'hnwi', label:'🌍 HNWI Global', sub:'Family office · Capital preservation' },
  { id:'investidor_pt', label:'🇵🇹 Investidor PT', sub:'Yield · Cap rate · ROI' },
]

export const SECTION_NAMES: Record<string, string> = {
  dashboard:'Dashboard', crm:'CRM Clientes', avm:'Avaliação AVM', radar:'Deal Radar 16D', investorpitch:'Investor Pitch IA',
  credito:'Simulador de Crédito', nhr:'NHR / IFICI Calculator', maisvalias:'Mais-Valias PT 2026', financiamento:'Crédito para Estrangeiros',
  portfolio:'Portfolio Análise', pipeline:'Pipeline CPCV',
  marketing:'Marketing AI Suite', homestaging:'Home Staging IA', documentos:'Documentação Legal',
  juridico:'Consultor Jurídico IA', imoveis:'Imóveis', campanhas:'Campanhas Email',
  sofia:'Sofia Avatar IA',
  agenda:'Agenda Semanal',
  visitas:'Gestão de Visitas',
  imt:'Calculadora IMT + IS + Custos',
  comissoes:'Comissões & P&L',
  exitSim:'Simulador de Saída · IRR · ROI',
  pulse:'Market Pulse · Inteligência de Mercado',
  crossCompare:'Comparar Mercados Internacionais',
  voz:'Nota de Voz → CRM',
  collections:'Collections IA · Boards Colaborativos',
  draftOffer:'Redigir Proposta IA',
  analytics:'Analytics & BI · Dashboard de Performance',
  investidores:'Motor de Investidores · Deal Flow',
  outbound:'Captação Off-Market · Prospecção',
  offmarket:'Leads Off-Market · Pipeline Supabase',
  partners:'Parceiros Institucionais · Rede Captação',
  dealdesk:'⚡ Deal Desk · Execução Comercial · Negociação · CPCV',
  videoStudio:'Sofia AI Video Studio · Vídeos de Apresentação',
  dealpack:'📄 Deal Packs IA · Dossiers de Investimento',
}

export const BUYER_DEMAND = [
  { zona:'Lisboa', tipo:'T2-T3 Prime', budget:'€800K–€2M', count:847, trend:'+23%', hot:true, weekly:[620,680,710,790,830,820,847] },
  { zona:'Cascais', tipo:'Villa / Moradia', budget:'€1.5M–€5M', count:312, trend:'+31%', hot:true, weekly:[210,240,265,280,295,308,312] },
  { zona:'Algarve', tipo:'Villa Resort', budget:'€2M–€10M', count:189, trend:'+18%', hot:true, weekly:[145,155,162,170,178,183,189] },
  { zona:'Porto', tipo:'T2–T4 Foz', budget:'€500K–€1.5M', count:421, trend:'+12%', hot:false, weekly:[360,375,388,395,404,415,421] },
  { zona:'Madeira', tipo:'Qualquer', budget:'€300K–€2M', count:156, trend:'+44%', hot:true, weekly:[88,100,112,123,138,148,156] },
  { zona:'Comporta', tipo:'Villa / Terreno', budget:'€2M+', count:67, trend:'+61%', hot:true, weekly:[35,40,47,53,58,63,67] },
]

export const POST_CLOSING_TASKS = [
  { days:3, label:'Enviar carta de boas-vindas personalizada', type:'communication' },
  { days:30, label:'Check-in satisfação pós-mudança', type:'followup' },
  { days:90, label:'Oferecer serviço de remodelação / decoração', type:'service' },
  { days:180, label:'Actualização de mercado — valor actual do imóvel', type:'market' },
  { days:365, label:'Aniversário da compra — relatório de valorização', type:'anniversary' },
  { days:730, label:'2 anos — oportunidade de refinanciamento', type:'financial' },
  { days:1095, label:'3 anos — momento ideal de venda? Análise de mercado', type:'opportunity' },
]

export const WA_TEMPLATES: Record<string, Record<string, { label: string; msg: string }>> = {
  PT: {
    inicial:    { label:'Contacto Inicial', msg:'Olá {name}! Sou {agent} da Agency Group (AMI 22506). Vi o seu interesse em imóveis em Portugal. Posso partilhar opções dentro do seu orçamento? 🏡' },
    followup:   { label:'Follow-up', msg:'Olá {name}! Queria saber se já teve oportunidade de pensar nas opções que partilhei. Tenho novos imóveis exclusivos que podem ser exactamente o que procura.' },
    proposta:   { label:'Proposta Formal', msg:'Olá {name}! Conforme combinado, segue a proposta formal para {property}. Por favor reveja e qualquer questão estou disponível. Agency Group.' },
    visita:     { label:'Confirmação Visita', msg:'Olá {name}! Confirmamos a visita a {property} para {date}. Aguardamos a sua presença! Agency Group · AMI 22506' },
    cpcv:       { label:'CPCV Pronto', msg:'Olá {name}! A documentação do CPCV está pronta para revisão. Quando podemos agendar a assinatura? 📋' },
    pos_venda:  { label:'Pós-Venda', msg:'Olá {name}! Espero que esteja a adorar o novo imóvel! Se precisar de qualquer apoio — remodelação, decoração ou gestão — conte connosco. Agency Group.' },
  },
  EN: {
    inicial:    { label:'Initial Contact', msg:'Hello {name}! I\'m {agent} from Agency Group (AMI 22506). I see you\'re interested in Portuguese real estate. May I share curated options within your budget? 🏡' },
    followup:   { label:'Follow-up', msg:'Hello {name}! Just following up on the properties I shared earlier. I have exciting new exclusive listings that might be perfect for you.' },
    proposta:   { label:'Formal Proposal', msg:'Hello {name}! As discussed, please find attached the formal proposal for {property}. I\'m available for any questions. Agency Group.' },
    visita:     { label:'Visit Confirmation', msg:'Hello {name}! Confirming your property visit at {property} on {date}. Looking forward to meeting you! Agency Group · AMI 22506' },
    cpcv:       { label:'CPCV Ready', msg:'Hello {name}! The CPCV documentation is ready for review. When can we schedule the signing? 📋' },
    pos_venda:  { label:'Post-Sale', msg:'Hello {name}! Hope you\'re loving your new property! If you need any support — renovation, interior design or management — we\'re here. Agency Group.' },
  },
  FR: {
    inicial:    { label:'Premier Contact', msg:'Bonjour {name}! Je suis {agent} d\'Agency Group (AMI 22506). Je vois votre intérêt pour l\'immobilier portugais. Puis-je partager des options dans votre budget? 🏡' },
    followup:   { label:'Relance', msg:'Bonjour {name}! Je vous relance concernant les propriétés partagées. J\'ai de nouvelles opportunités exclusives qui pourraient vous intéresser.' },
    proposta:   { label:'Proposition Formelle', msg:'Bonjour {name}! Comme convenu, veuillez trouver ci-joint la proposition formelle pour {property}. Je reste disponible. Agency Group.' },
    visita:     { label:'Confirmation Visite', msg:'Bonjour {name}! Confirmation de votre visite à {property} le {date}. Agency Group vous attend! AMI 22506' },
    cpcv:       { label:'CPCV Prêt', msg:'Bonjour {name}! La documentation CPCV est prête pour révision. Quand pouvons-nous planifier la signature? 📋' },
    pos_venda:  { label:'Après-Vente', msg:'Bonjour {name}! J\'espère que vous adorez votre nouvelle propriété! Pour tout besoin — rénovation, décoration ou gestion — nous sommes là. Agency Group.' },
  },
  DE: {
    inicial:    { label:'Erstkontakt', msg:'Hallo {name}! Ich bin {agent} von Agency Group (AMI 22506). Ich sehe Ihr Interesse an Immobilien in Portugal. Darf ich passende Optionen teilen? 🏡' },
    followup:   { label:'Nachfassung', msg:'Hallo {name}! Ich möchte bezüglich der geteilten Immobilien nachfassen. Ich habe neue exklusive Angebote, die perfekt für Sie sein könnten.' },
    proposta:   { label:'Formelles Angebot', msg:'Hallo {name}! Wie besprochen, finden Sie anbei das formelle Angebot für {property}. Bei Fragen stehe ich gerne zur Verfügung. Agency Group.' },
    visita:     { label:'Besichtigungstermin', msg:'Hallo {name}! Bestätigung Ihres Besichtigungstermins bei {property} am {date}. Wir freuen uns auf Sie! Agency Group · AMI 22506' },
    cpcv:       { label:'CPCV Bereit', msg:'Hallo {name}! Die CPCV-Dokumentation ist zur Überprüfung bereit. Wann können wir die Unterzeichnung planen? 📋' },
    pos_venda:  { label:'Nach dem Kauf', msg:'Hallo {name}! Ich hoffe, Sie genießen Ihre neue Immobilie! Für Renovierung, Einrichtung oder Verwaltung — wir sind für Sie da. Agency Group.' },
  },
  AR: {
    inicial:    { label:'التواصل الأولي', msg:'مرحباً {name}! أنا {agent} من Agency Group (AMI 22506). أرى اهتمامك بالعقارات البرتغالية. هل يمكنني مشاركة خيارات ضمن ميزانيتك؟ 🏡' },
    followup:   { label:'المتابعة', msg:'مرحباً {name}! أتابع معك بخصوص العقارات التي شاركتها. لدي عقارات حصرية جديدة قد تكون مثالية لك.' },
    proposta:   { label:'العرض الرسمي', msg:'مرحباً {name}! كما اتفقنا، يرجى مراجعة العرض الرسمي للعقار {property}. أنا هنا لأي استفسار. Agency Group.' },
    visita:     { label:'تأكيد الزيارة', msg:'مرحباً {name}! تأكيد زيارتك لعقار {property} في {date}. نتطلع لرؤيتك! Agency Group · AMI 22506' },
    cpcv:       { label:'CPCV جاهز', msg:'مرحباً {name}! وثائق CPCV جاهزة للمراجعة. متى يمكننا جدولة التوقيع؟ 📋' },
    pos_venda:  { label:'ما بعد البيع', msg:'مرحباً {name}! أتمنى أنك تستمتع بعقارك الجديد! لأي دعم — تجديد، ديكور أو إدارة — نحن هنا. Agency Group.' },
  },
}

export const JUR_SUGGESTIONS = [
  { label:'CPCV — cláusulas', q:'Quais as cláusulas obrigatórias num CPCV e o que acontece em caso de incumprimento?' },
  { label:'IMT €650K HPP', q:'Qual o IMT para habitação própria permanente por €650.000 em Lisboa?' },
  { label:'Golden Visa 2025', q:'Como funciona o ARI Golden Visa em 2025? Quais as modalidades após Outubro 2023?' },
  { label:'NHR/IFICI', q:'Como funciona o NHR/IFICI e como se candidata um cliente que chegou a Portugal em 2025?' },
  { label:'Mais-valias', q:'Como se calculam as mais-valias imobiliárias e quais as isenções?' },
  { label:'Visto D7', q:'Quais os requisitos e valores mínimos para o visto D7 de rendimento passivo?' },
  { label:'Due diligence', q:'MEMO: Qual a checklist completa de due diligence antes de assinar um CPCV?' },
  { label:'Reabilitação ARU', q:'Quais os benefícios fiscais da reabilitação urbana em ARU? IMT, IMI, IRS?' },
  { label:'Licença utilização', q:'O que acontece se um imóvel pós-1951 não tiver licença de utilização?' },
  { label:'Não residentes MV', q:'Como são tributadas as mais-valias de não residentes em Portugal?' },
  { label:'Alojamento Local', q:'Como funciona o licenciamento de Alojamento Local em 2025? Zonas de contenção e tributação.' },
  { label:'Arrendamento despejo', q:'Quais os prazos e procedimento de despejo por falta de pagamento de renda?' },
  { label:'Herança imóvel', q:'MEMO: Como se processa a transmissão de um imóvel em herança? Impostos e procedimentos.' },
  { label:'Crédito habitação LTV', q:'Quais os limites de LTV e DSTI para crédito habitação em Portugal segundo o Banco de Portugal?' },
  { label:'Condomínio dívidas', q:'As dívidas de condomínio seguem o imóvel? Como proteger o comprador na escritura?' },
]

export const PORTAL_PROPERTIES = [
  { id:'AG-2026-010', ref:'AG-2026-010', nome:'Penthouse Príncipe Real', zona:'Lisboa', bairro:'Príncipe Real', tipo:'Apartamento', preco:2850000, area:220, quartos:3, casasBanho:3, badge:'Destaque', status:'Ativo', piscina:true, garagem:true, jardim:false, terraco:true, listingDate:'2026-01-10' },
  { id:'AG-2026-011', ref:'AG-2026-011', nome:'Apartamento Chiado Premium', zona:'Lisboa', bairro:'Chiado', tipo:'Apartamento', preco:1450000, area:145, quartos:2, casasBanho:2, badge:'Novo', status:'Ativo', piscina:false, garagem:true, jardim:false, terraco:false, listingDate:'2026-02-15' },
  { id:'AG-2026-012', ref:'AG-2026-012', nome:'Moradia Belém com Jardim', zona:'Lisboa', bairro:'Belém', tipo:'Moradia', preco:3200000, area:380, quartos:5, casasBanho:4, badge:'Off-Market', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-01-15' },
  { id:'AG-2026-020', ref:'AG-2026-020', nome:'Villa Quinta da Marinha', zona:'Cascais', bairro:'Quinta da Marinha', tipo:'Moradia', preco:3800000, area:450, quartos:5, casasBanho:5, badge:'Exclusivo', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-02-01' },
  { id:'AG-2026-021', ref:'AG-2026-021', nome:'Moradia Estoril Frente Mar', zona:'Cascais', bairro:'Estoril', tipo:'Moradia', preco:2100000, area:280, quartos:4, casasBanho:3, badge:'Destaque', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-02-20' },
  { id:'AG-2026-030', ref:'AG-2026-030', nome:'Herdade Comporta Exclusiva', zona:'Comporta', bairro:'Comporta', tipo:'Herdade', preco:6500000, area:850, quartos:6, casasBanho:6, badge:'Off-Market', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-01-05' },
  { id:'AG-2026-040', ref:'AG-2026-040', nome:'Apartamento Foz do Douro', zona:'Porto', bairro:'Foz do Douro', tipo:'Apartamento', preco:980000, area:180, quartos:3, casasBanho:2, badge:'Destaque', status:'Ativo', piscina:false, garagem:true, jardim:false, terraco:true, listingDate:'2026-03-01' },
  { id:'AG-2026-050', ref:'AG-2026-050', nome:'Villa Vale do Lobo Golf', zona:'Algarve', bairro:'Vale do Lobo', tipo:'Moradia', preco:4200000, area:480, quartos:5, casasBanho:5, badge:'Exclusivo', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-02-10' },
  { id:'AG-2026-060', ref:'AG-2026-060', nome:'Apartamento Funchal Prime', zona:'Madeira', bairro:'Funchal', tipo:'Apartamento', preco:980000, area:165, quartos:3, casasBanho:2, badge:'Destaque', status:'Ativo', piscina:true, garagem:true, jardim:false, terraco:true, listingDate:'2026-03-10' },
  { id:'AG-2026-070', ref:'AG-2026-070', nome:'Quinta Histórica Sintra', zona:'Sintra', bairro:'Sintra Vila', tipo:'Quinta', preco:2800000, area:650, quartos:6, casasBanho:5, badge:'Off-Market', status:'Ativo', piscina:true, garagem:true, jardim:true, terraco:true, listingDate:'2026-01-20' },
]

export const HEAT_MAP_ZONES = [
  { zona: 'Chiado/Santos', region: 'Lisboa', score: 91, pm2: 7000, yoy: 20.0, yield: 4.3, color: '#16a34a' },
  { zona: 'Príncipe Real', region: 'Lisboa', score: 89, pm2: 7400, yoy: 19.0, yield: 4.2, color: '#16a34a' },
  { zona: 'Parque Nações', region: 'Lisboa', score: 87, pm2: 5200, yoy: 23.0, yield: 4.3, color: '#16a34a' },
  { zona: 'Bairro Alto', region: 'Lisboa', score: 85, pm2: 6700, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Beato/Marvila', region: 'Lisboa', score: 88, pm2: 4500, yoy: 30.0, yield: 4.1, color: '#16a34a' },
  { zona: 'Alcântara', region: 'Lisboa', score: 82, pm2: 4900, yoy: 22.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Alfama', region: 'Lisboa', score: 80, pm2: 5200, yoy: 18.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Avenidas Novas', region: 'Lisboa', score: 81, pm2: 5500, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Campo Ourique', region: 'Lisboa', score: 79, pm2: 5700, yoy: 17.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Estrela/Lapa', region: 'Lisboa', score: 78, pm2: 6500, yoy: 18.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Cascais Centro', region: 'Cascais', score: 83, pm2: 5400, yoy: 17.0, yield: 4.0, color: '#c9a96e' },
  { zona: 'Cascais', region: 'Cascais', score: 79, pm2: 4700, yoy: 18.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Quinta Marinha', region: 'Cascais', score: 74, pm2: 6900, yoy: 18.0, yield: 3.8, color: '#2563eb' },
  { zona: 'Estoril', region: 'Cascais', score: 74, pm2: 5000, yoy: 17.0, yield: 3.9, color: '#2563eb' },
  { zona: 'Oeiras', region: 'AML', score: 82, pm2: 4000, yoy: 20.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Ericeira', region: 'AML', score: 78, pm2: 3700, yoy: 21.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Foz/Nevogilde', region: 'Porto', score: 85, pm2: 5400, yoy: 20.0, yield: 4.0, color: '#16a34a' },
  { zona: 'Bonfim/Campanhã', region: 'Porto', score: 84, pm2: 3700, yoy: 22.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Matosinhos Mar', region: 'Porto', score: 83, pm2: 3800, yoy: 21.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Porto Boavista', region: 'Porto', score: 80, pm2: 4400, yoy: 18.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Porto Ribeira', region: 'Porto', score: 79, pm2: 4100, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Matosinhos', region: 'Porto', score: 77, pm2: 3100, yoy: 19.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Gaia', region: 'Porto', score: 74, pm2: 2800, yoy: 18.0, yield: 4.3, color: '#2563eb' },
  { zona: 'Lagos', region: 'Algarve', score: 80, pm2: 4400, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Vilamoura', region: 'Algarve', score: 79, pm2: 5000, yoy: 18.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Albufeira', region: 'Algarve', score: 78, pm2: 3700, yoy: 19.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Loulé/Almancil', region: 'Algarve', score: 77, pm2: 5500, yoy: 18.0, yield: 4.0, color: '#c9a96e' },
  { zona: 'Quinta do Lago', region: 'Algarve', score: 72, pm2: 12000, yoy: 15.0, yield: 4.2, color: '#2563eb' },
  { zona: 'Portimão', region: 'Algarve', score: 73, pm2: 3100, yoy: 18.0, yield: 4.3, color: '#2563eb' },
  { zona: 'Funchal Centro', region: 'Madeira', score: 84, pm2: 4700, yoy: 20.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Funchal', region: 'Madeira', score: 82, pm2: 4200, yoy: 19.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Calheta', region: 'Madeira', score: 78, pm2: 4400, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Porto Santo', region: 'Madeira', score: 68, pm2: 2600, yoy: 15.0, yield: 4.6, color: '#2563eb' },
  { zona: 'Ponta Delgada', region: 'Açores', score: 71, pm2: 2000, yoy: 14.0, yield: 5.1, color: '#2563eb' },
  { zona: 'Comporta', region: 'Alentejo', score: 74, pm2: 8500, yoy: 12.0, yield: 4.1, color: '#2563eb' },
  { zona: 'Braga', region: 'Minho', score: 76, pm2: 2700, yoy: 20.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Coimbra', region: 'Centro', score: 71, pm2: 2300, yoy: 17.0, yield: 4.7, color: '#2563eb' },
  { zona: 'Aveiro', region: 'Centro', score: 73, pm2: 2500, yoy: 18.0, yield: 4.6, color: '#2563eb' },
]

export const STATUS_CONFIG: Record<string, { color: string; avatar: string; label: string }> = {
  lead:     { color: '#888',    avatar: 'rgba(136,136,136,.15)', label: 'Lead' },
  prospect: { color: '#3a7bd5', avatar: 'rgba(58,123,213,.15)',  label: 'Prospect' },
  cliente:  { color: '#4a9c7a', avatar: 'rgba(74,156,122,.15)',  label: 'Cliente' },
  vip:      { color: '#c9a96e', avatar: 'rgba(201,169,110,.15)', label: 'VIP' },
}

export const PORTAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--font-jost),sans-serif;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(14,14,13,.12);border-radius:2px}
  .p-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.10);border-radius:8px;padding:10px 14px;font-family:var(--font-jost),sans-serif;font-size:.85rem;color:#0e0e0d;outline:none;transition:border .2s,box-shadow .2s}
  .p-inp:focus{border-color:#1c4a35;box-shadow:0 0 0 3px rgba(28,74,53,.10)}
  .p-sel{width:100%;background:#fff;border:1px solid rgba(14,14,13,.10);border-radius:8px;padding:10px 14px;font-family:var(--font-jost),sans-serif;font-size:.85rem;color:#0e0e0d;outline:none;cursor:pointer;appearance:none;transition:border .2s,box-shadow .2s}
  .p-sel:focus{border-color:#1c4a35;box-shadow:0 0 0 3px rgba(28,74,53,.10)}
  .p-btn{background:#1c4a35;color:#f4f0e6;border:none;border-radius:6px;padding:11px 22px;font-family:var(--font-dm-mono),monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:all .2s}
  .p-btn:hover{background:#163d2c;transform:translateY(-1px);box-shadow:0 4px 12px rgba(28,74,53,.20)}
  .p-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .p-btn-gold{background:#c9a96e;color:#0c1f15;border:none;border-radius:6px;padding:11px 22px;font-family:var(--font-dm-mono),monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:all .2s}
  .p-btn-gold:hover{background:#b8945a;transform:translateY(-1px);box-shadow:0 4px 12px rgba(201,169,110,.25)}
  .p-btn-gold:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .p-label{font-family:var(--font-dm-mono),monospace;font-size:.54rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(14,14,13,.45);margin-bottom:6px;display:block}
  .p-card{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)}
  .p-result-val{font-family:var(--font-cormorant),serif;font-size:2.4rem;font-weight:300;color:#1c4a35;line-height:1}
  .mkt-tab{padding:8px 16px;border-radius:4px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(14,14,13,.10);background:none;cursor:pointer;transition:all .2s;color:rgba(14,14,13,.50)}
  .mkt-tab.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
  .mkt-result{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:8px;padding:20px;min-height:120px;font-size:.85rem;line-height:1.8;color:#0e0e0d;white-space:pre-wrap;font-family:var(--font-jost),sans-serif}
  .deal-card{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:10px;padding:16px 20px;cursor:pointer;transition:all .2s;box-shadow:0 1px 3px rgba(14,14,13,.05)}
  .deal-card:hover{border-color:#1c4a35;box-shadow:0 4px 16px rgba(14,14,13,.08)}
  .deal-card.active{border-color:#c9a96e;border-width:2px}
  .check-item{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid rgba(14,14,13,.05);font-size:.82rem;color:rgba(14,14,13,.68);cursor:pointer;transition:color .2s}
  .check-item:hover{color:#0e0e0d}
  .check-item.done{color:rgba(14,14,13,.32);text-decoration:line-through}
  .doc-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(14,14,13,.06)}
  .kpi-card{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04);transition:all .2s}
  .kpi-card:hover{box-shadow:0 4px 16px rgba(14,14,13,.08),0 2px 6px rgba(14,14,13,.04);transform:translateY(-2px)}
  .kpi-val{font-family:var(--font-cormorant),serif;font-size:2rem;font-weight:300;color:#1c4a35;line-height:1}
  .kpi-label{font-family:var(--font-dm-mono),monospace;font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(14,14,13,.45);margin-top:6px}
  .nav-item{display:flex;align-items:center;gap:12px;padding:10px 18px;cursor:pointer;transition:all .2s;border-radius:6px;margin:1px 8px;font-size:.80rem;color:rgba(244,240,230,.52);letter-spacing:.02em}
  .nav-item:hover{background:rgba(244,240,230,.06);color:rgba(244,240,230,.85)}
  .nav-item.active{background:rgba(201,169,110,.16);color:#c9a96e}
  .nav-item.active svg{stroke:#c9a96e}
  .nav-item svg{stroke:rgba(244,240,230,.40);transition:stroke .2s;flex-shrink:0}
  .port-card{border:1px solid rgba(14,14,13,.08);border-radius:10px;padding:16px;background:#fff;box-shadow:0 1px 3px rgba(14,14,13,.05)}
  .port-card.top{border-color:#c9a96e}
  @keyframes jdot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}
  @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes soundBar{0%{height:4px;opacity:.5}100%{height:18px;opacity:1}}
  .mkt-input-tab{padding:8px 16px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.42);transition:all .2s}
  .mkt-input-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
  .crm-contact-row{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(14,14,13,.06);transition:background .15s}
  .crm-contact-row:hover{background:rgba(28,74,53,.04)}
  .crm-contact-row.active{background:rgba(201,169,110,.08);border-left:3px solid #c9a96e}
  .crm-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-dm-mono),monospace;font-size:.58rem;font-weight:400;flex-shrink:0;letter-spacing:.04em}
  .crm-status{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.08em;text-transform:uppercase}
  .crm-stat-card{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:10px;padding:16px 20px;flex:1;box-shadow:0 1px 3px rgba(14,14,13,.05)}
  .crm-profile-tab{padding:8px 16px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.42);transition:all .2s}
  .crm-profile-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
  .tour-platform-btn{padding:10px 18px;border-radius:6px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(14,14,13,.12);background:none;cursor:pointer;transition:all .2s;color:rgba(14,14,13,.52)}
  .tour-platform-btn.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
  .deal-tab{padding:9px 18px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.42);transition:all .2s}
  .deal-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
  .inv-metric{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:8px;padding:14px 18px;box-shadow:0 1px 3px rgba(14,14,13,.05)}
  .inv-metric .val{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#1c4a35;line-height:1}
  .inv-metric .lbl{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.10em;text-transform:uppercase;color:rgba(14,14,13,.38);margin-top:4px}
  .inv-scenario{border:1px solid rgba(14,14,13,.10);border-radius:6px;padding:14px;flex:1;min-width:120px;text-align:center;transition:border .2s}
  .inv-scenario.best{border-color:#c9a96e;background:rgba(201,169,110,.05)}
  .tour-timer{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:4px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.10em;border:1px solid rgba(28,74,53,.2);color:#1c4a35}
  .tour-hot{background:#c9a96e;color:#0c1f15;padding:10px 16px;border-radius:4px;font-family:var(--font-dm-mono),monospace;font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;animation:pulse 1.5s ease-in-out infinite}
  .hamburger{display:none;background:none;border:none;cursor:pointer;padding:8px;flex-direction:column;gap:5px;align-items:center;justify-content:center}
  .hamburger span{display:block;width:20px;height:2px;background:#0e0e0d;transition:all .3s;border-radius:1px}
  .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9}
  @media (max-width:900px){
    .hamburger{display:flex}
    .mobile-overlay.show{display:block}
    .portal-main{flex-direction:column}
    .portal-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:10;transform:translateX(-100%);transition:transform .3s ease}
    .portal-sidebar.open{transform:translateX(0)}
    .p-card{padding:16px}
    .kpi-val{font-size:1.6rem}
  }
  @media (max-width:768px){
    .kpi-grid{grid-template-columns:1fr 1fr!important}
    .actions-grid{grid-template-columns:1fr 1fr!important}
    .mkt-grid{grid-template-columns:1fr!important}
    .p-two-col{grid-template-columns:1fr!important}
    .crm-layout{flex-direction:column}
    .crm-list{width:100%!important;min-width:unset!important;border-right:none!important;border-bottom:1px solid rgba(14,14,13,.08)!important}
  }
  .photo-drop{border:2px dashed rgba(14,14,13,.12);border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:border .2s;background:rgba(14,14,13,.02)}
  .photo-drop:hover{border-color:#1c4a35}
  .photo-drop.drag{border-color:#c9a96e;background:rgba(201,169,110,.05)}
  .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .photo-thumb{position:relative;padding-bottom:100%;background:#f0ede4;border-radius:6px;overflow:hidden}
  .photo-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .photo-remove{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center;line-height:1}
  .action-card{background:#fff;border:1px solid rgba(14,14,13,.08);border-radius:10px;padding:20px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 3px rgba(14,14,13,.05)}
  .action-card:hover{border-color:#1c4a35;transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,14,13,.09)}
  .market-pulse-item{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(14,14,13,.06)}
  .breadcrumb{display:flex;align-items:center;gap:8px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.10em;text-transform:uppercase}
  .timeline-phase{display:flex;align-items:flex-start;gap:12px;padding:6px 0}
  .timeline-dot{width:10px;height:10px;border-radius:50%;border:2px solid #ccc;flex-shrink:0;margin-top:4px}
  .timeline-dot.done{background:#1c4a35;border-color:#1c4a35}
  .timeline-dot.current{background:#c9a96e;border-color:#c9a96e}
  .comparison-table{width:100%;border-collapse:collapse;margin-top:16px;font-family:var(--font-dm-mono),monospace;font-size:.52rem}
  .comparison-table th{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(244,240,230,.1);color:rgba(244,240,230,.4);letter-spacing:.1em;text-transform:uppercase}
  .comparison-table td{padding:8px 12px;border-bottom:1px solid rgba(244,240,230,.06);color:rgba(244,240,230,.7)}
  .comparison-table tr.highlight td{color:#c9a96e}

  /* ═══ DARK MODE v2.0 — Sistema Unificado ═══ */
  html.dark .kpi-card{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.20)}
  html.dark .kpi-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.28);border-color:rgba(201,169,110,.18)}
  html.dark .kpi-val{color:#c9a96e!important}
  html.dark .kpi-label{color:rgba(240,237,228,.40)}
  html.dark .action-card{background:#0f1e16;border-color:rgba(201,169,110,.11);color:rgba(240,237,228,.80);box-shadow:0 1px 3px rgba(0,0,0,.20)}
  html.dark .action-card:hover{border-color:#c9a96e;box-shadow:0 8px 24px rgba(0,0,0,.32)}
  html.dark .deal-card{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.18)}
  html.dark .deal-card:hover{border-color:#c9a96e;box-shadow:0 4px 16px rgba(0,0,0,.28)}
  html.dark .deal-card.active{border-color:#c9a96e}
  html.dark .mkt-result{background:#0c1a12;border-color:rgba(201,169,110,.12);color:rgba(240,237,228,.85)}
  html.dark .mkt-tab{border-color:rgba(240,237,228,.10);color:rgba(240,237,228,.45)}
  html.dark .mkt-tab.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
  html.dark .mkt-input-tab{color:rgba(240,237,228,.38)}
  html.dark .mkt-input-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
  html.dark .check-item{color:rgba(240,237,228,.65);border-bottom-color:rgba(240,237,228,.06)}
  html.dark .check-item:hover{color:#f0ede4}
  html.dark .check-item.done{color:rgba(240,237,228,.25)}
  html.dark .doc-item{border-bottom-color:rgba(240,237,228,.06)}
  html.dark .p-card{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.20)}
  html.dark .port-card{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.18)}
  html.dark .port-card.top{border-color:#c9a96e}
  html.dark .crm-contact-row{border-bottom-color:rgba(240,237,228,.06)}
  html.dark .crm-contact-row:hover{background:rgba(201,169,110,.06)}
  html.dark .crm-contact-row.active{background:rgba(201,169,110,.10);border-left-color:#c9a96e}
  html.dark .crm-stat-card{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.18)}
  html.dark .crm-profile-tab{color:rgba(240,237,228,.38)}
  html.dark .crm-profile-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
  html.dark .deal-tab{color:rgba(240,237,228,.38)}
  html.dark .deal-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
  html.dark .inv-metric{background:#0f1e16;border-color:rgba(201,169,110,.11);box-shadow:0 1px 3px rgba(0,0,0,.18)}
  html.dark .inv-metric .val{color:#c9a96e}
  html.dark .inv-metric .lbl{color:rgba(240,237,228,.38)}
  html.dark .inv-scenario{border-color:rgba(240,237,228,.10)}
  html.dark .inv-scenario.best{border-color:#c9a96e;background:rgba(201,169,110,.06)}
  html.dark .market-pulse-item{border-bottom-color:rgba(240,237,228,.06)}
  html.dark .photo-drop{border-color:rgba(240,237,228,.14);background:rgba(240,237,228,.02)}
  html.dark .photo-drop:hover{border-color:#c9a96e}
  html.dark .photo-thumb{background:#0f1e16}
  html.dark .tour-platform-btn{border-color:rgba(240,237,228,.12);color:rgba(240,237,228,.45)}
  html.dark .tour-platform-btn.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
  html.dark .tour-timer{border-color:rgba(201,169,110,.25);color:#c9a96e}
  html.dark .timeline-dot{border-color:rgba(240,237,228,.20)}
  html.dark .hamburger span{background:#f0ede4}
  html.dark input,html.dark select,html.dark textarea{background:#0c1a12!important;border-color:rgba(201,169,110,.18)!important;color:#f0ede4!important}
  html.dark input::placeholder,html.dark textarea::placeholder{color:rgba(240,237,228,.32)!important}
  html.dark input:focus,html.dark select:focus,html.dark textarea:focus{border-color:#c9a96e!important;box-shadow:0 0 0 3px rgba(201,169,110,.12)!important;outline:none}
  html.dark .breadcrumb{color:rgba(240,237,228,.42)}
  html.dark .portal-main [style*="color:#0e0e0d"]{color:rgba(240,237,228,.88)!important}
  html.dark .portal-main [style*="color:#1c4a35"]{color:#6fcf97!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.7"]{color:rgba(240,237,228,.72)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.6"]{color:rgba(240,237,228,.62)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.5"]{color:rgba(240,237,228,.52)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.45"]{color:rgba(240,237,228,.48)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.4"]{color:rgba(240,237,228,.42)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.35"]{color:rgba(240,237,228,.38)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.3"]{color:rgba(240,237,228,.32)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.28"]{color:rgba(240,237,228,.30)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.25"]{color:rgba(240,237,228,.28)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.2"]{color:rgba(240,237,228,.22)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.15"]{color:rgba(240,237,228,.16)!important}
  html.dark .portal-main [style*="color:rgba(14,14,13,.1"]{color:rgba(240,237,228,.12)!important}
  html.dark .portal-main [style*="background:#fff"]{background:#0f1e16!important}
  html.dark .portal-main [style*="background:white"]{background:#0f1e16!important}
  html.dark .portal-main [style*="background:rgba(14,14,13,.02)"]{background:rgba(201,169,110,.03)!important}
  html.dark .portal-main [style*="background:rgba(14,14,13,.03)"]{background:rgba(201,169,110,.03)!important}
  html.dark .portal-main [style*="background:rgba(14,14,13,.04)"]{background:rgba(201,169,110,.04)!important}
  html.dark .portal-main [style*="background:rgba(28,74,53,.04)"]{background:rgba(201,169,110,.05)!important}
  html.dark .portal-main [style*="border:1px solid rgba(14,14,13"]{border-color:rgba(201,169,110,.14)!important}
  html.dark .portal-main [style*="borderBottom:1px solid rgba(14,14,13"]{border-bottom-color:rgba(240,237,228,.08)!important}
  html.dark .portal-main [style*="borderTop:1px solid rgba(14,14,13"]{border-top-color:rgba(240,237,228,.08)!important}

  /* ═══ ENTRANCE ANIMATIONS ═══ */
  @keyframes fadeSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
  .animate-fade-up{animation:fadeSlideUp .45s ease both}
  .animate-fade-in{animation:fadeIn .35s ease both}
  .animate-scale-in{animation:scaleIn .35s ease both}
  .stagger-1{animation-delay:.06s}
  .stagger-2{animation-delay:.12s}
  .stagger-3{animation-delay:.18s}
  .stagger-4{animation-delay:.24s}
  .stagger-5{animation-delay:.30s}
  .stagger-6{animation-delay:.36s}
  /* Shimmer skeleton base */
  .skeleton{background:linear-gradient(90deg,rgba(14,14,13,.06) 25%,rgba(14,14,13,.10) 50%,rgba(14,14,13,.06) 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:6px}
  html.dark .skeleton{background:linear-gradient(90deg,rgba(240,237,228,.04) 25%,rgba(240,237,228,.08) 50%,rgba(240,237,228,.04) 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite}
  /* ═══ MOBILE IMPROVEMENTS ═══ */
  /* Focus visible — accessibility */
  :focus-visible{outline:2px solid #c9a96e!important;outline-offset:2px}
  button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid #c9a96e!important;outline-offset:2px;border-radius:4px}
  /* Touch targets — minimum 44px */
  .nav-item{min-height:44px}
  .p-btn{min-height:40px}
  /* Smooth scrolling */
  .portal-main{scroll-behavior:smooth}
  /* Better text selection */
  ::selection{background:rgba(201,169,110,.25);color:inherit}
  /* Scrollbar improvements */
  *{scrollbar-width:thin;scrollbar-color:rgba(14,14,13,.15) transparent}
  html.dark *{scrollbar-color:rgba(240,237,228,.10) transparent}
  /* Print styles */
  @media print{
    .portal-sidebar,.portal-header{display:none!important}
    .portal-main{margin:0!important;padding:20px!important}
    .p-card,.kpi-card{box-shadow:none!important;border:1px solid #ddd!important}
  }
  @media (max-width:1200px){
    .kpi-grid{grid-template-columns:repeat(2,1fr)!important}
  }
  @media (max-width:900px){
    .portal-main-content{padding:16px!important}
    .kpi-grid{grid-template-columns:1fr 1fr!important}
    .p-card{padding:16px!important}
    .kpi-card{padding:16px 18px!important}
    .kpi-val{font-size:1.6rem!important}
    .section-header{padding:16px 20px!important}
  }
  @media (max-width:600px){
    .kpi-grid{grid-template-columns:1fr!important}
    .kpi-card{padding:14px 16px!important}
    .p-card{padding:14px!important}
    .kpi-val{font-size:1.4rem!important}
    .p-btn{width:100%!important;justify-content:center!important}
    .crm-layout{flex-direction:column!important}
    .crm-list{width:100%!important;max-height:300px!important;border-right:none!important;border-bottom:1px solid rgba(14,14,13,.08)!important}
    html.dark .crm-list{border-bottom-color:rgba(240,237,228,.08)!important}
    .actions-grid{grid-template-columns:1fr 1fr!important}
    .p-two-col{grid-template-columns:1fr!important}
    .mkt-grid{grid-template-columns:1fr!important}
    .comparison-table{font-size:.60rem!important}
    .comparison-table td,.comparison-table th{padding:6px 8px!important}
  }
  /* ═══ DARK MODE SCROLLBAR ═══ */
  html.dark ::-webkit-scrollbar-thumb{background:rgba(240,237,228,.12);border-radius:2px}
  html.dark ::-webkit-scrollbar-track{background:transparent}
  /* ═══ REDUCED MOTION ═══ */
  @media (prefers-reduced-motion:reduce){
    *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }
  /* ═══ HIGH CONTRAST ═══ */
  @media (forced-colors:active){
    .p-btn{forced-color-adjust:none;background:ButtonText;color:ButtonFace}
    .kpi-card{forced-color-adjust:none;border:2px solid ButtonText}
  }
`

// SECTION_NAMES is defined above (line ~115) — no duplicate needed
