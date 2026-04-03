'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'

const NAV = [
  { id:'dashboard', label:'Dashboard', icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', group:'' },
  { id:'crm', label:'CRM Clientes', icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', group:'' },
  { id:'pipeline', label:'Pipeline CPCV', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', group:'DEALS' },
  { id:'radar', label:'Deal Radar 16D', icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', group:'DEALS' },
  { id:'avm', label:'Avaliação AVM', icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z', group:'DEALS' },
  { id:'marketing', label:'Marketing AI', icon:'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', group:'FERRAMENTAS IA' },
  { id:'homestaging', label:'Home Staging IA', icon:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', group:'FERRAMENTAS IA' },
  { id:'investorpitch', label:'Investor Pitch IA', icon:'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', group:'FERRAMENTAS IA' },
  { id:'sofia', label:'Sofia Avatar IA', icon:'M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', group:'FERRAMENTAS IA' },
  { id:'juridico', label:'Consultor Jurídico IA', icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', group:'FERRAMENTAS IA' },
  { id:'credito', label:'Simulador Crédito', icon:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', group:'ANÁLISE' },
  { id:'nhr', label:'NHR / IFICI', icon:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064', group:'ANÁLISE' },
  { id:'maisvalias', label:'Mais-Valias', icon:'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', group:'ANÁLISE' },
  { id:'financiamento', label:'Crédito Estrangeiros', icon:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064', group:'ANÁLISE' },
  { id:'portfolio', label:'Portfolio Análise', icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', group:'ANÁLISE' },
  { id:'documentos', label:'Documentação', icon:'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z', group:'MAIS' },
  { id:'imoveis', label:'Im\u00f3veis', icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10', group:'MAIS' },
  { id:'campanhas', label:'Campanhas Email', icon:'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', group:'MAIS' },
  { id:'agenda', label:'Agenda Semanal', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', group:'MAIS' },
]

const PIPELINE_STAGES = ['Angariação','Proposta Enviada','Proposta Aceite','Due Diligence','CPCV Assinado','Financiamento','Escritura Marcada','Escritura Concluída']
const STAGE_PCT: Record<string,number> = { 'Angariação':10,'Proposta Enviada':20,'Proposta Aceite':35,'Due Diligence':50,'CPCV Assinado':70,'Financiamento':80,'Escritura Marcada':90,'Escritura Concluída':100 }
const STAGE_COLOR: Record<string,string> = { 'Angariação':'#888','Proposta Enviada':'#3a7bd5','Proposta Aceite':'#3a7bd5','Due Diligence':'#4a9c7a','CPCV Assinado':'#c9a96e','Financiamento':'#c9a96e','Escritura Marcada':'#1c4a35','Escritura Concluída':'#1c4a35' }

const CHECKLISTS: Record<string,string[]> = {
  'Angariação':['Caderneta predial urbana','Certidão de teor do registo predial','Licença de utilização / habitação','Certificado energético (EPC)','Planta do imóvel','Fotos profissionais realizadas','Relatório AVM gerado','Contrato de mediação assinado','Ficha técnica do imóvel'],
  'Proposta Enviada':['Carta de oferta formal enviada','Prova de fundos do comprador','Carta de pré-aprovação bancária','Identificação do comprador (CC/Passaporte)','NIF do comprador confirmado'],
  'Proposta Aceite':['Contraproposta (se aplicável)','Confirmação escrita de aceitação','Advogado do comprador identificado','Advogado do vendedor confirmado','Data CPCV acordada'],
  'Due Diligence':['Certidão permanente sem ónus','Vistoria técnica ao imóvel','Verificação de dívidas IMI','Licença de obras (se remodelado)','Seguro de vida do comprador'],
  'CPCV Assinado':['CPCV redigido e revisto','Sinal transferido (10–30%)','Recibo de sinal emitido','Data de escritura acordada','Procuração (se aplicável)'],
  'Financiamento':['Avaliação bancária realizada','Aprovação formal do crédito','Seguro multirriscos habitação','Taxa de juro e spread confirmados','Minuta do contrato bancário revista'],
  'Escritura Marcada':['Notário confirmado e agendado','IMT calculado e pago','IS (0,8%) calculado e pago','Distrato anterior (se hipoteca)','Chaves e documentos preparados'],
  'Escritura Concluída':['Escritura assinada ✅','Registo predial actualizado','Chaves entregues ao comprador','Comissão liquidada','Deal registado no Notion CRM'],
}

const DOC_LIBRARY = [
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

const FORMATS = [
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

const PERSONAS = [
  { id:'americano', label:'🇺🇸 Americano', sub:'Tech/Finance · ROI + lifestyle' },
  { id:'frances', label:'🇫🇷 Francês', sub:'Art de vivre · Fiscal' },
  { id:'britanico', label:'🇬🇧 Britânico', sub:'Investor · Post-Brexit' },
  { id:'brasileiro', label:'🇧🇷 Brasileiro', sub:'Passaporte EU · Família' },
  { id:'hnwi', label:'🌍 HNWI Global', sub:'Family office · Capital preservation' },
  { id:'investidor_pt', label:'🇵🇹 Investidor PT', sub:'Yield · Cap rate · ROI' },
]

const SECTION_NAMES: Record<string,string> = {
  dashboard:'Dashboard', crm:'CRM Clientes', avm:'Avalia\u00e7\u00e3o AVM', radar:'Deal Radar 16D', investorpitch:'Investor Pitch IA',
  credito:'Simulador de Cr\u00e9dito', nhr:'NHR / IFICI Calculator', maisvalias:'Mais-Valias PT 2026', financiamento:'Cr\u00e9dito para Estrangeiros',
  portfolio:'Portfolio An\u00e1lise', pipeline:'Pipeline CPCV',
  marketing:'Marketing AI Suite', homestaging:'Home Staging IA', documentos:'Documenta\u00e7\u00e3o Legal',
  juridico:'Consultor Jur\u00eddico IA', imoveis:'Im\u00f3veis', campanhas:'Campanhas Email',
  sofia:'Sofia Avatar IA',
  agenda:'Agenda Semanal',
}

const BUYER_DEMAND = [
  { zona:'Lisboa', tipo:'T2-T3 Prime', budget:'€800K–€2M', count:847, trend:'+23%', hot:true, weekly:[620,680,710,790,830,820,847] },
  { zona:'Cascais', tipo:'Villa / Moradia', budget:'€1.5M–€5M', count:312, trend:'+31%', hot:true, weekly:[210,240,265,280,295,308,312] },
  { zona:'Algarve', tipo:'Villa Resort', budget:'€2M–€10M', count:189, trend:'+18%', hot:true, weekly:[145,155,162,170,178,183,189] },
  { zona:'Porto', tipo:'T2–T4 Foz', budget:'€500K–€1.5M', count:421, trend:'+12%', hot:false, weekly:[360,375,388,395,404,415,421] },
  { zona:'Madeira', tipo:'Qualquer', budget:'€300K–€2M', count:156, trend:'+44%', hot:true, weekly:[88,100,112,123,138,148,156] },
  { zona:'Comporta', tipo:'Villa / Terreno', budget:'€2M+', count:67, trend:'+61%', hot:true, weekly:[35,40,47,53,58,63,67] },
]

const POST_CLOSING_TASKS = [
  { days:3, label:'Enviar carta de boas-vindas personalizada', type:'communication' },
  { days:30, label:'Check-in satisfação pós-mudança', type:'followup' },
  { days:90, label:'Oferecer serviço de remodelação / decoração', type:'service' },
  { days:180, label:'Actualização de mercado — valor actual do imóvel', type:'market' },
  { days:365, label:'Aniversário da compra — relatório de valorização', type:'anniversary' },
  { days:730, label:'2 anos — oportunidade de refinanciamento', type:'financial' },
  { days:1095, label:'3 anos — momento ideal de venda? Análise de mercado', type:'opportunity' },
]

// ─── WhatsApp Templates by Language ─────────────────────────────────────────
const WA_TEMPLATES: Record<string, Record<string, { label: string; msg: string }>> = {
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

const JUR_SUGGESTIONS = [
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

// ─── Markdown renderer para respostas jurídicas ───────────────────────────────
function renderJurMarkdown(raw: string): string {
  // 1. HTML escape
  let h = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 2. Section dividers (═══ or ---)
  h = h.replace(/[═]{3,}/g, '<div style="height:1px;background:rgba(28,74,53,.15);margin:.7em 0"></div>')
  h = h.replace(/^-{3,}$/gm, '<div style="height:1px;background:rgba(14,14,13,.1);margin:.6em 0"></div>')

  // 3. Headers
  h = h.replace(/^### (.+)$/gm, '<strong style="display:block;font-size:.85rem;color:#1c4a35;margin:.9em 0 .2em;letter-spacing:.04em">$1</strong>')
  h = h.replace(/^## (.+)$/gm, '<strong style="display:block;font-size:.9rem;color:#0e0e0d;margin:1em 0 .3em;border-bottom:1px solid rgba(14,14,13,.1);padding-bottom:.25em">$1</strong>')
  h = h.replace(/^# (.+)$/gm, '<strong style="display:block;font-size:.95rem;color:#0e0e0d;margin:1em 0 .3em">$1</strong>')

  // 4. Bold
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 5. Italic
  h = h.replace(/\*(.+?)\*/g, '<em style="color:rgba(14,14,13,.7)">$1</em>')

  // 6. Numbered list items
  h = h.replace(/^(\d+)\. (.+)$/gm,
    '<span style="display:flex;gap:7px;margin:.18em 0;align-items:baseline"><b style="color:#1c4a35;font-size:.78rem;min-width:1.3em;flex-shrink:0">$1.</b><span>$2</span></span>')

  // 7. Bullet list items (-, •, *)
  h = h.replace(/^[-•*] (.+)$/gm,
    '<span style="display:flex;gap:7px;margin:.18em 0;align-items:baseline"><span style="color:#c9a96e;font-size:.7em;min-width:.8em;flex-shrink:0;line-height:1.9">●</span><span>$1</span></span>')

  // 8. Base legal line (special pill styling)
  h = h.replace(/((?:Base legal|Base Legal)[:\s].+)$/gm,
    '<span style="display:block;margin-top:.7em;padding:.4em .8em;background:rgba(28,74,53,.06);border-left:2px solid rgba(28,74,53,.35);font-size:.8em;font-style:italic;color:rgba(14,14,13,.6);line-height:1.6">$1</span>')

  // 9. Newlines
  h = h.replace(/\n/g, '<br/>')

  return h
}

const PORTAL_PROPERTIES = [
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

// ─── CRM Lead Scoring (budget / completeness / source / notes) ───────────────
function calcLeadScore(contact: { budgetMax?: number|string; phone?: string; email?: string; zone?: string; source?: string; notes?: string; type?: string; budgetMin?: number|string }): { score: number; factors: string[]; label: string; color: string } {
  let score = 0
  const factors: string[] = []

  // Budget weight (0-30 points)
  const budget = Number(contact.budgetMax) || 0
  if (budget >= 3000000) { score += 30; factors.push('Budget premium \u20ac3M+') }
  else if (budget >= 1000000) { score += 22; factors.push('Budget alto \u20ac1M+') }
  else if (budget >= 500000) { score += 15; factors.push('Budget m\u00e9dio \u20ac500K+') }
  else if (budget > 0) { score += 8; factors.push('Budget definido') }

  // Contact info completeness (0-20 points)
  if (contact.phone) { score += 8; factors.push('Telefone dispon\u00edvel') }
  if (contact.email) { score += 7; factors.push('Email dispon\u00edvel') }
  if (contact.zone) { score += 5; factors.push('Zona definida') }

  // Source quality (0-20 points)
  const src = (contact.source || '').toLowerCase()
  if (src.includes('referral') || src.includes('refer\u00eancia')) { score += 20; factors.push('Refer\u00eancia de cliente') }
  else if (src.includes('whatsapp') || src.includes('directo')) { score += 15; factors.push('Contacto directo') }
  else if (src.includes('portal') || src.includes('idealista')) { score += 10; factors.push('Portal imobili\u00e1rio') }
  else if (src.includes('instagram') || src.includes('social')) { score += 7; factors.push('Social media') }
  else { score += 5 }

  // Notes/engagement (0-15 points)
  if (contact.notes && contact.notes.length > 100) { score += 15; factors.push('Perfil detalhado') }
  else if (contact.notes && contact.notes.length > 30) { score += 8; factors.push('Notas existentes') }

  // Type specificity (0-15 points)
  if (contact.type) { score += 10; factors.push('Tipo de im\u00f3vel definido') }
  if (contact.budgetMin && contact.budgetMax && Number(contact.budgetMax) - Number(contact.budgetMin) < Number(contact.budgetMax) * 0.5) {
    score += 5; factors.push('Budget preciso')
  }

  score = Math.min(100, score)
  const label = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : score >= 40 ? 'Cool' : 'Cold'
  const color = score >= 80 ? 'emerald' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'gray'

  return { score, factors, label, color }
}

function getAINextAction(contact: { status: string; lastContact: string; nextFollowUp: string }): { text: string; urgency: 'high'|'medium'|'low' } {
  const daysSinceLast = Math.max(0, Math.floor((Date.now() - new Date(contact.lastContact).getTime()) / 86400000))
  const daysUntilFollowup = Math.floor((new Date(contact.nextFollowUp || '').getTime() - Date.now()) / 86400000)
  if (daysUntilFollowup < 0 && contact.nextFollowUp) return { text: `Follow-up em atraso ${Math.abs(daysUntilFollowup)}d \u2014 Ligar agora!`, urgency: 'high' }
  if (daysUntilFollowup === 0) return { text: 'Follow-up hoje \u2014 Contactar antes das 18h', urgency: 'high' }
  if (contact.status === 'vip' && daysSinceLast >= 7) return { text: `VIP sem contacto h\u00e1 ${daysSinceLast}d \u2014 Enviar update de mercado`, urgency: 'high' }
  if (contact.status === 'prospect' && daysSinceLast >= 5) return { text: `Prospect frio h\u00e1 ${daysSinceLast}d \u2014 Partilhar novo im\u00f3vel`, urgency: 'medium' }
  if (contact.status === 'lead' && daysSinceLast >= 3) return { text: `Lead sem resposta há ${daysSinceLast}d — Tentar WhatsApp`, urgency: 'medium' }
  if (daysUntilFollowup <= 2) return { text: `Follow-up em ${daysUntilFollowup}d — Preparar proposta`, urgency: 'medium' }
  if (contact.status === 'cliente') return { text: 'Cliente activo — Agendar visita a imóvel em carteira', urgency: 'low' }
  return { text: 'Perfil actualizado — Aguardar resposta', urgency: 'low' }
}

function computeLeadScore(contact: {
  status: string; lastContact: string; nextFollowUp: string; budgetMin: number; budgetMax: number
}): { score: number; label: string; color: string; breakdown: { factor: string; pts: number }[] } {
  const breakdown: { factor: string; pts: number }[] = []
  let score = 0

  // Status score (0-35)
  const statusPts = contact.status === 'vip' ? 35 : contact.status === 'cliente' ? 28 : contact.status === 'prospect' ? 18 : 8
  score += statusPts
  breakdown.push({ factor: `Status (${contact.status})`, pts: statusPts })

  // Recency score (0-30)
  const lastDate = new Date(contact.lastContact)
  const daysSince = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / (1000*60*60*24)))
  const recencyPts = daysSince <= 1 ? 30 : daysSince <= 7 ? 22 : daysSince <= 30 ? 12 : daysSince <= 90 ? 5 : 0
  score += recencyPts
  breakdown.push({ factor: `Último contacto (${daysSince}d)`, pts: recencyPts })

  // Follow-up urgency (0-25)
  const followDate = new Date(contact.nextFollowUp)
  const daysUntil = Math.floor((followDate.getTime() - Date.now()) / (1000*60*60*24))
  const followPts = daysUntil < 0 ? 25 : daysUntil === 0 ? 22 : daysUntil <= 3 ? 15 : daysUntil <= 7 ? 8 : 3
  score += followPts
  breakdown.push({ factor: `Follow-up (${daysUntil < 0 ? 'overdue' : daysUntil+'d'})`, pts: followPts })

  // Budget alignment bonus (0-10)
  const midBudget = ((Number(contact.budgetMin)||0) + (Number(contact.budgetMax)||0)) / 2
  const budgetPts = midBudget >= 500000 ? 10 : midBudget >= 300000 ? 6 : 3
  score += budgetPts
  breakdown.push({ factor: `Budget (€${(midBudget/1e6).toFixed(1)}M)`, pts: budgetPts })

  score = Math.min(100, score)
  const label = score >= 80 ? '🔥 Hot' : score >= 60 ? '⚡ Warm' : score >= 40 ? '📞 Active' : '💤 Cold'
  const color = score >= 80 ? '#e05454' : score >= 60 ? '#c9a96e' : score >= 40 ? '#4a9c7a' : 'rgba(14,14,13,.3)'
  return { score, label, color, breakdown }
}

const HEAT_MAP_ZONES = [
  // LISBOA
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
  // CASCAIS
  { zona: 'Cascais Centro', region: 'Cascais', score: 83, pm2: 5400, yoy: 17.0, yield: 4.0, color: '#c9a96e' },
  { zona: 'Cascais', region: 'Cascais', score: 79, pm2: 4700, yoy: 18.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Quinta Marinha', region: 'Cascais', score: 74, pm2: 6900, yoy: 18.0, yield: 3.8, color: '#2563eb' },
  { zona: 'Estoril', region: 'Cascais', score: 74, pm2: 5000, yoy: 17.0, yield: 3.9, color: '#2563eb' },
  { zona: 'Oeiras', region: 'AML', score: 82, pm2: 4000, yoy: 20.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Ericeira', region: 'AML', score: 78, pm2: 3700, yoy: 21.0, yield: 4.2, color: '#c9a96e' },
  // PORTO
  { zona: 'Foz/Nevogilde', region: 'Porto', score: 85, pm2: 5400, yoy: 20.0, yield: 4.0, color: '#16a34a' },
  { zona: 'Bonfim/Campanhã', region: 'Porto', score: 84, pm2: 3700, yoy: 22.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Matosinhos Mar', region: 'Porto', score: 83, pm2: 3800, yoy: 21.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Porto Boavista', region: 'Porto', score: 80, pm2: 4400, yoy: 18.0, yield: 4.1, color: '#c9a96e' },
  { zona: 'Porto Ribeira', region: 'Porto', score: 79, pm2: 4100, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Matosinhos', region: 'Porto', score: 77, pm2: 3100, yoy: 19.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Gaia', region: 'Porto', score: 74, pm2: 2800, yoy: 18.0, yield: 4.3, color: '#2563eb' },
  // ALGARVE
  { zona: 'Lagos', region: 'Algarve', score: 80, pm2: 4400, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Vilamoura', region: 'Algarve', score: 79, pm2: 5000, yoy: 18.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Albufeira', region: 'Algarve', score: 78, pm2: 3700, yoy: 19.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Loulé/Almancil', region: 'Algarve', score: 77, pm2: 5500, yoy: 18.0, yield: 4.0, color: '#c9a96e' },
  { zona: 'Quinta do Lago', region: 'Algarve', score: 72, pm2: 12000, yoy: 15.0, yield: 4.2, color: '#2563eb' },
  { zona: 'Portimão', region: 'Algarve', score: 73, pm2: 3100, yoy: 18.0, yield: 4.3, color: '#2563eb' },
  // ILHAS
  { zona: 'Funchal Centro', region: 'Madeira', score: 84, pm2: 4700, yoy: 20.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Funchal', region: 'Madeira', score: 82, pm2: 4200, yoy: 19.0, yield: 4.3, color: '#c9a96e' },
  { zona: 'Calheta', region: 'Madeira', score: 78, pm2: 4400, yoy: 19.0, yield: 4.2, color: '#c9a96e' },
  { zona: 'Porto Santo', region: 'Madeira', score: 68, pm2: 2600, yoy: 15.0, yield: 4.6, color: '#2563eb' },
  { zona: 'Ponta Delgada', region: 'Açores', score: 71, pm2: 2000, yoy: 14.0, yield: 5.1, color: '#2563eb' },
  // OUTROS
  { zona: 'Comporta', region: 'Alentejo', score: 74, pm2: 8500, yoy: 12.0, yield: 4.1, color: '#2563eb' },
  { zona: 'Braga', region: 'Minho', score: 76, pm2: 2700, yoy: 20.0, yield: 4.4, color: '#c9a96e' },
  { zona: 'Coimbra', region: 'Centro', score: 71, pm2: 2300, yoy: 17.0, yield: 4.7, color: '#2563eb' },
  { zona: 'Aveiro', region: 'Centro', score: 73, pm2: 2500, yoy: 18.0, yield: 4.6, color: '#2563eb' },
]

function PriceHistoryWidget({ url }: { url: string }) {
  const [history, setHistory] = useState<{preco: number; data: string; score: number}[]>([])
  const [trend, setTrend] = useState<'down'|'stable'|'up'|null>(null)

  useEffect(() => {
    if (!url) return
    fetch(`/api/radar/history?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.history && Array.isArray(d.history) && d.history.length > 1) {
          setHistory(d.history)
          setTrend(d.trend || 'stable')
        }
      })
      .catch(() => {})
  }, [url])

  if (history.length < 2) return null

  const maxP = Math.max(...history.map((h: {preco: number}) => h.preco))
  const minP = Math.min(...history.map((h: {preco: number}) => h.preco))
  const range = maxP - minP || 1
  const trendIcon = trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→'
  const trendColor = trend === 'down' ? '#16a34a' : trend === 'up' ? '#dc2626' : '#c9a96e'

  return (
    <div style={{background:'rgba(14,14,13,.03)', border:'1px solid rgba(14,14,13,.08)', borderRadius:'8px', padding:'16px', marginTop:'12px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
        <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.42rem', color:'rgba(14,14,13,.6)', fontWeight:600, letterSpacing:'.06em'}}>HISTÓRICO DE PREÇO</span>
        <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.52rem', fontWeight:700, color: trendColor}}>{trendIcon} {trend === 'down' ? 'A BAIXAR' : trend === 'up' ? 'A SUBIR' : 'ESTÁVEL'}</span>
      </div>
      <div style={{display:'flex', alignItems:'flex-end', gap:'4px', height:'48px', marginBottom:'8px'}}>
        {history.map((h: {preco: number; data: string; score: number}, i: number) => {
          const heightPct = ((h.preco - minP) / range) * 80 + 20
          const isLast = i === history.length - 1
          return (
            <div key={i} title={`${new Date(h.data).toLocaleDateString('pt-PT')}: €${h.preco.toLocaleString('pt-PT')}`}
              style={{flex:1, height:`${heightPct}%`, background: isLast ? '#1c4a35' : 'rgba(28,74,53,.3)', borderRadius:'2px 2px 0 0', transition:'height 0.3s', minWidth:'8px'}}
            />
          )
        })}
      </div>
      <div style={{display:'flex', justifyContent:'space-between'}}>
        <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.34rem', color:'rgba(14,14,13,.35)'}}>{history.length > 0 ? new Date(history[0].data).toLocaleDateString('pt-PT') : ''}</span>
        <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.34rem', color:'rgba(14,14,13,.35)'}}>{history.length > 0 ? new Date(history[history.length-1].data).toLocaleDateString('pt-PT') : ''}</span>
      </div>
    </div>
  )
}

export default function Portal() {
  const [ready, setReady] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [agentEmail, setAgentEmail] = useState('')
  const [agentName, setAgentName] = useState('Agente')
  const [section, setSection] = useState('dashboard')
  const [now, setNow] = useState(new Date())

  // AVM states
  const [avmResult, setAvmResult] = useState<Record<string,unknown>|null>(null)
  const [avmLoading, setAvmLoading] = useState(false)
  const [avmZona, setAvmZona] = useState('Lisboa — Chiado')
  const [avmTipo, setAvmTipo] = useState('T2')
  const [avmArea, setAvmArea] = useState('')
  const [avmEstado, setAvmEstado] = useState('Bom')
  const [avmVista, setAvmVista] = useState('interior')
  const [avmPiscina, setAvmPiscina] = useState('nao')
  const [avmGaragem, setAvmGaragem] = useState('sem')
  const [avmEpc, setAvmEpc] = useState('C')
  const [avmAndar, setAvmAndar] = useState('1-2')
  const [avmOrientacao, setAvmOrientacao] = useState('')
  const [avmAnoConstr, setAvmAnoConstr] = useState('2005')
  const [avmTerraco, setAvmTerraco] = useState('0')
  const [avmCasasBanho, setAvmCasasBanho] = useState('1')
  const [avmUso, setAvmUso] = useState('habitacao')

  // Radar states
  const [radarResult, setRadarResult] = useState<Record<string,unknown>|null>(null)
  const [radarLoading, setRadarLoading] = useState(false)
  const [radarUrl, setRadarUrl] = useState('')
  // Radar search mode
  const [radarMode, setRadarMode] = useState<'url'|'search'>('url')
  const [searchZona, setSearchZona] = useState('Lisboa')
  const [searchPrecoMin, setSearchPrecoMin] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('radar_precoMin') ?? '50000') : '50000')
  const [searchPrecoMax, setSearchPrecoMax] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('radar_precoMax') ?? '500000000') : '500000000')
  const [searchTipos, setSearchTipos] = useState<string[]>(() => { try { const s = typeof window !== 'undefined' ? localStorage.getItem('radar_tipos') : null; return s ? JSON.parse(s) : ['apartamento','moradia'] } catch { return ['apartamento','moradia'] } })
  const [searchScoreMin, setSearchScoreMin] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('radar_scoreMin') ?? '65') : '65')
  const [searchFontes, setSearchFontes] = useState<string[]>(() => { try { const s = typeof window !== 'undefined' ? localStorage.getItem('radar_fontes') : null; return s ? JSON.parse(s) : ['idealista','imovirtual','eleiloes','banca'] } catch { return ['idealista','imovirtual','eleiloes','banca'] } })
  const [searchResults, setSearchResults] = useState<Record<string,unknown>|null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showHeatMap, setShowHeatMap] = useState(false)

  // Mortgage states
  const [mortResult, setMortResult] = useState<Record<string,unknown>|null>(null)
  const [mortLoading, setMortLoading] = useState(false)
  const [mortSpreadVal, setMortSpreadVal] = useState(1.0)
  const [mortMontante, setMortMontante] = useState('')
  const [mortEntrada, setMortEntrada] = useState(20)
  const [mortPrazo, setMortPrazo] = useState(30)
  const [mortUso, setMortUso] = useState<'habitacao_propria'|'investimento'>('habitacao_propria')
  const [mortRendimento, setMortRendimento] = useState('')
  const [mortSubTab, setMortSubTab] = useState<'cenarios'|'amortizacao'|'share'>('cenarios')

  // NHR states
  const [nhrResult, setNhrResult] = useState<Record<string,unknown>|null>(null)
  const [nhrLoading, setNhrLoading] = useState(false)
  const [nhrPais, setNhrPais] = useState('UK')
  const [nhrTipo, setNhrTipo] = useState('salario')
  const [nhrRend, setNhrRend] = useState('')
  const [nhrFonte, setNhrFonte] = useState(true)
  const [nhrSubTab, setNhrSubTab] = useState<'elegib'|'processo'|'share'>('elegib')

  // Portfolio states
  const [portItems, setPortItems] = useState(['',''])
  const [portResult, setPortResult] = useState<Record<string,unknown>|null>(null)
  const [portLoading, setPortLoading] = useState(false)

  // Portfolio Investment Simulator states
  interface PortfolioProperty {
    id: string; name: string; currentValue: number; downPayment: number; rentalYield: number; appreciation: number;
  }
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioProperty[]>([])
  const [showPropertyPicker, setShowPropertyPicker] = useState(false)
  const [portfolioTab, setPortfolioTab] = useState<'comparar'|'simulador'>('comparar')

  // Pipeline
  const [pipelineView, setPipelineView] = useState<'lista'|'kanban'>('lista')
  const [pipelineSearch, setPipelineSearch] = useState('')
  const [deals, setDeals] = useState([
    { id:1, ref:'AG-2026-001', imovel:'Villa Quinta da Marinha · Cascais', valor:'€ 3.800.000', fase:'CPCV Assinado', comprador:'James Whitfield', cpcvDate:'2026-04-04', escrituraDate:'2026-05-15', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k=>[k,CHECKLISTS[k].map(()=>false)])) },
    { id:2, ref:'AG-2026-002', imovel:'Penthouse Chiado · Lisboa', valor:'€ 2.100.000', fase:'Due Diligence', comprador:'Sophie Laurent', cpcvDate:'2026-04-07', escrituraDate:'', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k=>[k,CHECKLISTS[k].map(()=>false)])) },
    { id:3, ref:'AG-2026-003', imovel:'Herdade Comporta · Grândola', valor:'€ 6.500.000', fase:'Proposta Aceite', comprador:'Khalid Al-Rashid', cpcvDate:'', escrituraDate:'', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k=>[k,CHECKLISTS[k].map(()=>false)])) },
  ])
  const [activeDeal, setActiveDeal] = useState<number|null>(null)
  const [dealRiskLoading, setDealRiskLoading] = useState(false)
  const [dealRiskAnalysis, setDealRiskAnalysis] = useState<Record<string,unknown>|null>(null)
  const [dealNegoLoading, setDealNegoLoading] = useState(false)
  const [dealNego, setDealNego] = useState<Record<string,unknown>|null>(null)
  const [newDeal, setNewDeal] = useState({ imovel:'', valor:'' })
  const [showNewDeal, setShowNewDeal] = useState(false)

  // Marketing AI
  const [mktInput, setMktInput] = useState({ zona:'', tipo:'', area:'', preco:'', quartos:'', features:'', descricao:'' })
  const [mktFormat, setMktFormat] = useState('idealista')
  const [mktLang, setMktLang] = useState('pt')
  const [mktResult, setMktResult] = useState<Record<string,unknown>|null>(null)
  const [mktLoading, setMktLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mktPhotos, setMktPhotos] = useState<string[]>([])
  const [mktVideoUrl, setMktVideoUrl] = useState('')
  const [mktListingUrl, setMktListingUrl] = useState('')
  const [mktTourUrl, setMktTourUrl] = useState('')
  const [mktInputTab, setMktInputTab] = useState<'dados'|'media'|'url'|'tour'>('dados')
  const [mktAutoFilling, setMktAutoFilling] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [mktPersona, setMktPersona] = useState('hnwi')
  const [mktLangs, setMktLangs] = useState<string[]>(['pt','en','fr'])
  const [mktSeoScore, setMktSeoScore] = useState<number|null>(null)
  const [mktPhotoInsights, setMktPhotoInsights] = useState<string|null>(null)
  const [mktCalendarOpen, setMktCalendarOpen] = useState(false)
  const [mktPostingSchedule, setMktPostingSchedule] = useState<Record<string,{day:string;time:string;reason:string}>|null>(null)
  const [mktCharCounts, setMktCharCounts] = useState<Record<string,Record<string,number>>|null>(null)
  const [mktCharLimits, setMktCharLimits] = useState<Record<string,number>|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Home Staging IA
  const [hsImage, setHsImage] = useState<string|null>(null)        // original base64
  const [hsImageName, setHsImageName] = useState('')
  const [hsStyle, setHsStyle] = useState('moderno')
  const [hsRoomType, setHsRoomType] = useState('sala')
  const [hsVariations, setHsVariations] = useState(1)
  const [hsStrength, setHsStrength] = useState(0.68)
  const [hsLoading, setHsLoading] = useState(false)
  const [hsError, setHsError] = useState<string|null>(null)
  const [hsResults, setHsResults] = useState<{base64:string;seed:number}[]>([])
  const [hsSelected, setHsSelected] = useState(0)  // which variation shown
  const [hsSlider, setHsSlider] = useState(50)     // before/after slider %
  const [hsDragOver, setHsDragOver] = useState(false)
  const hsFileRef = useRef<HTMLInputElement>(null)
  const hsSliderRef = useRef<HTMLDivElement>(null)

  // Investor Pitch IA
  const [ipProperty, setIpProperty] = useState<string>('')
  const [ipInvestorType, setIpInvestorType] = useState<'private'|'family_office'|'institutional'|'hnwi'>('private')
  const [ipHorizon, setIpHorizon] = useState<3|5|10>(5)
  const [ipIrr, setIpIrr] = useState<8|12|15|20>(12)
  const [ipLang, setIpLang] = useState<'PT'|'EN'|'FR'|'AR'>('EN')
  const [ipLoading, setIpLoading] = useState(false)
  const [ipResult, setIpResult] = useState<Record<string,unknown>|null>(null)
  const [ipError, setIpError] = useState<string|null>(null)

  // CRM Next Step IA
  const [crmNextStep, setCrmNextStep] = useState<Record<string,unknown>|null>(null)
  const [crmNextStepLoading, setCrmNextStepLoading] = useState(false)

  // CRM
  interface Activity {
    id: number; type: 'call'|'whatsapp'|'email'|'visit'|'note'|'proposal'|'cpcv'
    date: string; note: string; duration?: number
  }
  interface Task {
    id: number; title: string; dueDate: string; done: boolean; type: 'call'|'visit'|'email'|'proposal'|'other'
  }
  interface CRMContact {
    id: number; name: string; email: string; phone: string; nationality: string
    budgetMin: number; budgetMax: number; tipos: string[]; zonas: string[]
    status: 'lead'|'prospect'|'cliente'|'vip'; notes: string
    lastContact: string; nextFollowUp: string; dealRef: string; origin: string; createdAt: string
    language?: 'PT'|'EN'|'FR'|'DE'|'AR'|'ZH'
    activities?: Activity[]
    tasks?: Task[]
  }
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([
    { id:1, name:'James Mitchell', email:'james@mitchellfamily.com', phone:'+44 7700 900123', nationality:'🇬🇧 Britânico', budgetMin:1500000, budgetMax:3000000, tipos:['Villa','Penthouse'], zonas:['Cascais','Quinta da Marinha'], status:'vip', notes:'Família com 2 filhos. Preferência por Cascais ou Quinta da Marinha. Quer piscina + garagem dupla. Viagem em Maio.', lastContact:'2026-03-28', nextFollowUp:'2026-04-02', dealRef:'', origin:'Referência', createdAt:'2026-02-15' },
    { id:2, name:'Marie-Claire Dupont', email:'mc.dupont@gmail.com', phone:'+33 6 12 34 56 78', nationality:'🇫🇷 Francesa', budgetMin:800000, budgetMax:1500000, tipos:['T3','T4'], zonas:['Lisboa — Chiado','Lisboa — Príncipe Real'], status:'prospect', notes:'Residente NHR. Quer zona histórica, andar alto, terraço. Filha começa universidade em Lisboa.', lastContact:'2026-03-25', nextFollowUp:'2026-04-05', dealRef:'', origin:'Website', createdAt:'2026-03-01' },
    { id:3, name:'Carlos Ferreira', email:'carlos.ferreira@empresa.pt', phone:'+351 912 345 678', nationality:'🇵🇹 Português', budgetMin:500000, budgetMax:900000, tipos:['T4','Moradia'], zonas:['Cascais','Sintra'], status:'cliente', notes:'Crédito aprovado €600K. HPP. Prazo urgente — 3 meses. Já visitou 4 imóveis.', lastContact:'2026-03-29', nextFollowUp:'2026-04-01', dealRef:'AG-2026-001', origin:'WhatsApp', createdAt:'2026-01-20' },
    { id:4, name:'Khalid Al-Mansouri', email:'kmansouri@holdings.ae', phone:'+971 50 123 4567', nationality:'🇦🇪 Emirados', budgetMin:3000000, budgetMax:10000000, tipos:['Herdade','Villa','Penthouse'], zonas:['Comporta','Alentejo','Lisboa'], status:'vip', notes:'Family office. Interesse em portfólio. Possível compra múltipla. Reunião via Zoom confirmada.', lastContact:'2026-03-20', nextFollowUp:'2026-04-10', dealRef:'AG-2026-003', origin:'Referência', createdAt:'2026-01-05' },
    { id:5, name:'Sophie Weber', email:'s.weber@private.de', phone:'+49 176 1234 5678', nationality:'🇩🇪 Alemã', budgetMin:600000, budgetMax:1200000, tipos:['T3','Moradia'], zonas:['Porto — Foz','Porto — Boavista'], status:'lead', notes:'Primeiro contacto via email. Interesse em Porto para investimento arrendamento. Aguarda proposta.', lastContact:'2026-03-22', nextFollowUp:'2026-04-08', dealRef:'', origin:'Email', createdAt:'2026-03-22' },
  ])
  const [crmSearch, setCrmSearch] = useState('')
  const [activeCrmId, setActiveCrmId] = useState<number|null>(null)
  const [crmProfileTab, setCrmProfileTab] = useState<'overview'|'timeline'|'tasks'|'notes'|'matching'|'postclosing'>('overview')
  const [crmBulkMode, setCrmBulkMode] = useState(false)
  const [crmSelectedIds, setCrmSelectedIds] = useState<Set<number>>(new Set())
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [showNewContact, setShowNewContact] = useState(false)
  const [smartImportText, setSmartImportText] = useState('')
  const [smartImportLoading, setSmartImportLoading] = useState(false)
  const [showSmartImport, setShowSmartImport] = useState(false)
  const [newContact, setNewContact] = useState({ name:'', email:'', phone:'', nationality:'', budgetMin:'', budgetMax:'', tipos:'', zonas:'', origin:'Website', notes:'' })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [crmView, setCrmView] = useState<'list'|'kanban'>('list')
  const [crmShowFilters, setCrmShowFilters] = useState(false)
  const [crmNatFilter, setCrmNatFilter] = useState('')
  const [crmZonaFilter, setCrmZonaFilter] = useState('')
  const [crmStatusFilter, setCrmStatusFilter] = useState('')
  const [showWaModal, setShowWaModal] = useState(false)
  const [waModalContact, setWaModalContact] = useState<number|null>(null)
  const [waLang, setWaLang] = useState<'PT'|'EN'|'FR'|'DE'|'AR'>('PT')
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ type:'call' as Activity['type'], note:'', date: new Date().toISOString().split('T')[0] })
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title:'', dueDate:'', type:'call' as Task['type'] })

  // Email Drip Campaign state
  interface Drip {
    id: string; name: string; status: 'active'|'paused'|'draft'; emails: number; days: number; openRate: string;
  }
  const [dripCampaigns, setDripCampaigns] = useState<Drip[]>([
    { id:'d1', name:'Boas-Vindas Novo Lead', status:'active', emails:5, days:14, openRate:'42%' },
    { id:'d2', name:'Follow-Up Im\u00f3vel', status:'paused', emails:4, days:10, openRate:'38%' },
    { id:'d3', name:'Reactiva\u00e7\u00e3o Lead Frio', status:'draft', emails:3, days:21, openRate:'29%' },
  ])
  const [expandedDrip, setExpandedDrip] = useState<string|null>(null)
  const [campTab, setCampTab] = useState<'email'|'whatsapp'>('email')
  const [emailDraftLoading, setEmailDraftLoading] = useState(false)
  const [emailDraft, setEmailDraft] = useState<Record<string,string>|null>(null)
  const [emailDraftPurpose, setEmailDraftPurpose] = useState('Follow-up geral')
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState<Record<string,unknown>|null>(null)
  const [meetingPrepLoading, setMeetingPrepLoading] = useState(false)
  const [meetingPrep, setMeetingPrep] = useState<Record<string,unknown>|null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [cmdkQuery, setCmdkQuery] = useState('')

  // Sofia Avatar IA
  const sofiaVideoRef = useRef<HTMLVideoElement|null>(null)
  const sofiaPeerRef = useRef<RTCPeerConnection|null>(null)
  const [sofiaSessionId, setSofiaSessionId] = useState<string|null>(null)
  const [sofiaConnected, setSofiaConnected] = useState(false)
  const [sofiaLoading, setSofiaLoading] = useState(false)
  const [sofiaSpeaking, setSofiaSpeaking] = useState(false)
  const [sofiaText, setSofiaText] = useState('')
  const [sofiaError, setSofiaError] = useState<string|null>(null)
  const [sofiaScriptLoading, setSofiaScriptLoading] = useState(false)
  const [sofiaPropSel, setSofiaPropSel] = useState('')
  const [sofiaLang, setSofiaLang] = useState<'PT'|'EN'|'FR'|'AR'>('EN')

  // Imoveis states
  const [imoveisTab, setImoveisTab] = useState<'lista'|'adicionar'|'stats'|'comparar'>('lista')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [imoveisSearch, setImoveisSearch] = useState('')
  const [imoveisZona, setImoveisZona] = useState('')
  const [imoveisStaleOnly, setImoveisStaleOnly] = useState(false)
  const [newImovel, setNewImovel] = useState({
    nome: '', zona: 'Lisboa', bairro: '', tipo: 'Apartamento',
    preco: 0, area: 0, quartos: 0, casasBanho: 0, andar: '',
    energia: 'A', vista: '', piscina: false, garagem: false,
    jardim: false, terraco: false, condominio: false,
    badge: '', status: 'Ativo', desc: '', features: '', tourUrl: ''
  })
  const [imoveisList, setImoveisList] = useState<(typeof PORTAL_PROPERTIES[0] & Record<string, unknown>)[]>([])
  const [showAddImovel, setShowAddImovel] = useState(false)
  const [imovelSaved, setImovelSaved] = useState(false)

  // AI Photo Publisher states
  interface AiPhoto { url: string; b64: string; analysis?: Record<string,unknown> }
  const [aiPhotos, setAiPhotos] = useState<AiPhoto[]>([])
  const [aiHeroIndex, setAiHeroIndex] = useState(0)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiDesc, setAiDesc] = useState<Record<string,unknown>|null>(null)
  const [aiDescMeta, setAiDescMeta] = useState<Record<string,unknown>|null>(null)
  const [aiSummary, setAiSummary] = useState<Record<string,unknown>|null>(null)
  const [publishStep, setPublishStep] = useState<1|2|3|4>(1)
  const [descTab, setDescTab] = useState<'main'|'instagram'|'linkedin'|'whatsapp'|'email'>('main')
  const [copiedKey, setCopiedKey] = useState<string|null>(null)
  const [showcaseImovel, setShowcaseImovel] = useState<Record<string,unknown>|null>(null)
  // Lightbox states
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [lightboxPhotos, setLightboxPhotos] = useState<{url:string; label?:string}[]>([])
  const [showcaseCarouselIdx, setShowcaseCarouselIdx] = useState(0)
  const [descPersona, setDescPersona] = useState('HNWI Global')

  function saveCrmContacts(updated: CRMContact[]) {
    setCrmContacts(updated)
    if (agentEmail) localStorage.setItem(`ag_crm_${agentEmail}`, JSON.stringify(updated))
    // Sync to Notion in background (non-blocking)
    syncContactsToNotion(updated, agentEmail).catch(console.error)
  }

  async function syncContactsToNotion(contacts: CRMContact[], email: string) {
    for (const contact of contacts) {
      try {
        const payload = {
          ...contact,
          agentEmail: email,
          leadScore: computeLeadScore(contact).score,
          notionId: (contact as CRMContact & { notionId?: string }).notionId,
        }
        if ((payload as CRMContact & { notionId?: string }).notionId) {
          await fetch('/api/notion/contacts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          const res = await fetch('/api/notion/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (data.notionId) {
            // Store notionId back into localStorage
            const idx = contacts.findIndex(c => c.id === contact.id)
            if (idx >= 0) {
              const updatedWithId = [...contacts]
              ;(updatedWithId[idx] as CRMContact & { notionId?: string }).notionId = data.notionId
              localStorage.setItem(`ag_crm_${email}`, JSON.stringify(updatedWithId))
            }
          }
        }
      } catch (e) {
        console.error('Notion sync error for contact:', contact.name, e)
      }
    }
  }

  function saveImoveis(updated: (typeof PORTAL_PROPERTIES[0] & Record<string, unknown>)[]) {
    setImoveisList(updated)
    localStorage.setItem(`ag_imoveis_${agentEmail}`, JSON.stringify(updated))
  }

  function exportCrmCSV() {
    const headers = ['Nome','Email','Telefone','Nacionalidade','Status','Budget Mín','Budget Máx','Tipologias','Zonas','Origem','Último Contacto','Follow-up','Score']
    const rows = crmContacts.map(c => [
      c.name, c.email, c.phone, c.nationality, c.status,
      c.budgetMin, c.budgetMax,
      c.tipos.join(';'), c.zonas.join(';'), c.origin,
      c.lastContact, c.nextFollowUp, computeLeadScore(c).score
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `crm_ag_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Load CRM from localStorage, then merge from Notion (Notion is authoritative)
  useEffect(() => {
    if (!agentEmail) return
    const stored = localStorage.getItem(`ag_crm_${agentEmail}`)
    if (stored) { try { setCrmContacts(JSON.parse(stored)) } catch {} }
    // Try to load from Notion in background
    fetch(`/api/notion/contacts?agent=${encodeURIComponent(agentEmail)}`)
      .then(r => r.json())
      .then(data => {
        if (data.contacts && data.contacts.length > 0) {
          // Notion wins for existing records
          setCrmContacts(data.contacts)
          localStorage.setItem(`ag_crm_${agentEmail}`, JSON.stringify(data.contacts))
        }
      })
      .catch(() => {}) // Fail silently — localStorage fallback already loaded
  }, [agentEmail])

  // Load Imoveis from localStorage
  useEffect(() => {
    if (ready) {
      const saved = localStorage.getItem(`ag_imoveis_${agentEmail}`)
      if (saved) {
        try { setImoveisList(JSON.parse(saved)) } catch {}
      } else {
        setImoveisList(PORTAL_PROPERTIES)
      }
    }
  }, [ready, agentEmail])

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightboxIdx(i => Math.min(i + 1, lightboxPhotos.length - 1))
      if (e.key === 'ArrowLeft')  setLightboxIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     { setLightboxOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen, lightboxPhotos.length])

  // Showcase carousel keyboard
  useEffect(() => {
    if (!showcaseImovel || lightboxOpen) return
    const photos = (showcaseImovel.photos as string[]) || []
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setShowcaseCarouselIdx(i => Math.min(i + 1, photos.length - 1))
      if (e.key === 'ArrowLeft')  setShowcaseCarouselIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     setShowcaseImovel(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showcaseImovel, lightboxOpen])

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(o=>!o); setCmdkQuery('') }
      if (e.key === 'Escape') { setCmdkOpen(false); setFabOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const openLightbox = (photos: {url:string; label?:string}[], startIdx: number) => {
    setLightboxPhotos(photos)
    setLightboxIdx(startIdx)
    setLightboxOpen(true)
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  // Documents search
  const [docSearch, setDocSearch] = useState('')

  // Pipeline Investor Dashboard
  const [dealTab, setDealTab] = useState<'checklist'|'investor'|'dealroom'|'timeline'|'nego'>('checklist')
  const [makeOfferOpen, setMakeOfferOpen] = useState(false)
  const [offerMsg, setOfferMsg] = useState('')
  const [dealRoomMsg, setDealRoomMsg] = useState('')
  const [investorData, setInvestorData] = useState({ rendaMensal:'', apreciacao:'4', horizonte:'10', ltv:'70', spread:'1.0' })
  const [invScenario, setInvScenario] = useState<'bear'|'base'|'bull'>('base')
  const [taxRegime, setTaxRegime] = useState<'standard'|'ifici'>('standard')
  const [tipoImovelInv, setTipoImovelInv] = useState<'residencial'|'comercial'>('residencial')
  const tourTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const [tourSeconds, setTourSeconds] = useState(0)
  const [tourHotAlert, setTourHotAlert] = useState(false)

  // Tour timer
  useEffect(() => {
    if (section === 'marketing' && mktInputTab === 'tour' && mktTourUrl) {
      setTourSeconds(0)
      setTourHotAlert(false)
      tourTimerRef.current = setInterval(() => {
        setTourSeconds(s => {
          const next = s + 1
          if (next === 300) setTourHotAlert(true)
          return next
        })
      }, 1000)
    } else {
      if (tourTimerRef.current) { clearInterval(tourTimerRef.current); tourTimerRef.current = null }
    }
    return () => { if (tourTimerRef.current) clearInterval(tourTimerRef.current) }
  }, [section, mktInputTab, mktTourUrl])

  // Jurídico IA
  interface JurMsg { role: 'user'|'assistant'; content: string; webSearch?: boolean; ts: string; mode?: 'memo' }
  const [jurMsgs, setJurMsgs] = useState<JurMsg[]>([
    { role:'assistant', content:'Bom dia. Sou o Consultor Jurídico IA da Agency Group.\n\n**Áreas de especialização:**\n- Transacções imobiliárias (CPCV, escritura, due diligence)\n- Fiscalidade (IMT, IMI, IS, AIMI, mais-valias, NHR/IFICI)\n- Vistos e residência (ARI/Golden Visa, D7, D8, D2)\n- Alojamento Local — licenciamento, RNAL, zonas de contenção\n- Arrendamento urbano (NRAU, despejo, actualização rendas)\n- Herança e sucessões imobiliárias\n- Crédito habitação e hipotecas (limites BdP, LTV, DSTI)\n- Condomínio e propriedade horizontal\n\nColoque a sua questão — respondo com base legal actualizada.\nPrefixo **MEMO:** para relatório jurídico estruturado completo.', ts: new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) }
  ])
  const [jurInput, setJurInput] = useState('')
  const [jurLoading, setJurLoading] = useState(false)
  const [jurWebSearch, setJurWebSearch] = useState(false)
  const [jurMode, setJurMode] = useState<'rapido'|'memo'>('rapido')
  const jurBottomRef = useRef<HTMLDivElement>(null)

  // Dark mode persistence + DOM class
  useEffect(() => {
    const stored = localStorage.getItem('ag_dark_mode')
    if (stored === '1') setDarkMode(true)
  }, [])
  useEffect(() => {
    localStorage.setItem('ag_dark_mode', darkMode ? '1' : '0')
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auth gate
  useEffect(() => {
    const stored = localStorage.getItem('ag_auth')
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.v === '1' && Date.now() < d.exp) {
          setAgentEmail(d.email || '')
          const name = d.email ? d.email.split('@')[0].split('.')[0] : 'Agente'
          setAgentName(name.charAt(0).toUpperCase() + name.slice(1))
          setReady(true)
          return
        }
      } catch {}
    }
    window.location.href = '/#agentes'
  }, [])

  // Load deals from localStorage
  useEffect(() => {
    if (!agentEmail) return
    const key = `ag_deals_${agentEmail}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try { setDeals(JSON.parse(stored)) } catch {}
    }
  }, [agentEmail])

  // Persist radar search settings to localStorage whenever they change
  useEffect(() => { localStorage.setItem('radar_precoMin', searchPrecoMin) }, [searchPrecoMin])
  useEffect(() => { localStorage.setItem('radar_precoMax', searchPrecoMax) }, [searchPrecoMax])
  useEffect(() => { localStorage.setItem('radar_tipos', JSON.stringify(searchTipos)) }, [searchTipos])
  useEffect(() => { localStorage.setItem('radar_scoreMin', searchScoreMin) }, [searchScoreMin])
  useEffect(() => { localStorage.setItem('radar_fontes', JSON.stringify(searchFontes)) }, [searchFontes])

  // Save deals
  const saveDeals = useCallback((d: typeof deals) => {
    setDeals(d)
    if (agentEmail) localStorage.setItem(`ag_deals_${agentEmail}`, JSON.stringify(d))
  }, [agentEmail])

  function logout() {
    localStorage.removeItem('ag_auth')
    window.location.href = '/'
  }

  // ── AVM ──
  async function runAVM() {
    if (!avmZona || !avmArea) { alert('Preenche zona e área.'); return }
    setAvmLoading(true); setAvmResult(null)
    try {
      const andarNum = avmAndar==='rc'?0:avmAndar==='1-2'?2:avmAndar==='3-5'?4:avmAndar==='6+'?8:parseInt(avmAndar)||2
      const res = await fetch('/api/avm', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          zona:avmZona, tipo:avmTipo, area:parseFloat(avmArea),
          estado:avmEstado, vista:avmVista, piscina:avmPiscina,
          epc:avmEpc, garagem:avmGaragem, andar:andarNum,
          orientacao:avmOrientacao, anoConstr:parseInt(avmAnoConstr)||2000,
          terraco:parseFloat(avmTerraco)||0, casasBanho:parseInt(avmCasasBanho)||1,
          uso:avmUso,
        })
      })
      const data = await res.json()
      if (data.success) setAvmResult(data)
      else alert(data.error || 'Erro na avaliação')
    } catch { alert('Erro de ligação.') }
    finally { setAvmLoading(false) }
  }

  // ── RADAR ──
  async function runRadar() {
    if (!radarUrl.trim()) { alert('Cola um link ou texto.'); return }
    setRadarLoading(true); setRadarResult(null)
    try {
      const res = await fetch('/api/radar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: radarUrl.trim() }) })
      const data = await res.json()
      if (data.success) setRadarResult(data)
      else alert(data.error || 'Erro na análise')
    } catch { alert('Erro de ligação.') }
    finally { setRadarLoading(false) }
  }

  // ── RADAR SEARCH ──
  async function runRadarSearch() {
    setSearchLoading(true); setSearchResults(null)
    try {
      const res = await fetch('/api/radar/search', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          zona: searchZona,
          preco_min: parseFloat(searchPrecoMin)||0,
          preco_max: parseFloat(searchPrecoMax)||0,
          tipos: searchTipos,
          fontes: searchFontes,
          score_min: parseFloat(searchScoreMin)||65,
        })
      })
      const data = await res.json()
      if (data.success) setSearchResults(data)
      else alert(data.error || 'Erro na busca')
    } catch { alert('Erro de ligação.') }
    finally { setSearchLoading(false) }
  }

  // ── PDF GENERATOR ──
  function gerarPDF(deals: Record<string,unknown>[], filtros: Record<string,unknown>, stats: Record<string,unknown>) {
    const hoje = new Date().toLocaleDateString('pt-PT', {day:'2-digit',month:'long',year:'numeric'})
    const scoreColor = (s:number) => s>=88?'#16a34a':s>=78?'#c9a96e':s>=68?'#2563eb':s>=55?'#6b7280':'#dc2626'
    const classifBadge = (c:string) => c.includes('ATAQUE')?'#16a34a':c.includes('PRIORIT')?'#c9a96e':c.includes('BOM')?'#2563eb':'#6b7280'

    const dealsHtml = deals.map((d,i)=>{
      const sc = Number(d.score||0)
      const cl = String(d.classificacao||'⚖️')
      const pr = Number(d.preco||0)
      const ar = Number(d.area||0)
      const pm2 = Number(d.pm2||0)
      const pm2m = Number(d.pm2_mercado||0)
      const yB = Number(d.yield_bruto_pct||0)
      const desc = Number(d.desconto_mercado_pct||0)
      const pl = String(d.platform||'')
      const isL = Boolean(d.is_leilao)
      const isB = Boolean(d.is_banca)
      return `<div class="deal" style="break-inside:avoid;margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;padding:14px;border-left:4px solid ${scoreColor(sc)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-size:22px;font-weight:900;color:${scoreColor(sc)}">${sc}</span>
              <span style="font-size:10px;background:${scoreColor(sc)}20;color:${scoreColor(sc)};padding:2px 8px;border-radius:12px;font-weight:600">${cl}</span>
              <span style="font-size:9px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:10px">${isL?'🔨 LEILÃO':isB?'🏦 BANCA':'🏠 MERCADO'} — ${pl}</span>
            </div>
            <div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:2px">${String(d.titulo||'Imóvel').substring(0,80)}</div>
            <div style="font-size:10px;color:#64748b">${String(d.morada||d.zona||'').substring(0,70)} · ${String(d.zona||'')}</div>
          </div>
          <div style="text-align:right;min-width:130px">
            <div style="font-size:16px;font-weight:700;color:#0f172a">${pr>0?`€ ${pr.toLocaleString('pt-PT')}`:'—'}</div>
            <div style="font-size:9px;color:#64748b">${ar>0?`${ar}m²  ·  `:''}${pm2>0?`€${pm2.toLocaleString('pt-PT')}/m²`:''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:9px;margin-bottom:8px">
          <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">€/m² Mercado</div><div style="font-weight:600;color:#0f172a">${pm2m>0?`€${pm2m.toLocaleString('pt-PT')}`:'-'}</div></div>
          <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Desc. Mercado</div><div style="font-weight:600;color:${desc>10?'#16a34a':desc>0?'#c9a96e':'#dc2626'}">${desc>0?`-${desc.toFixed(1)}%`:desc<0?`+${Math.abs(desc).toFixed(1)}%`:'—'}</div></div>
          <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Yield Bruto</div><div style="font-weight:600;color:#2563eb">${yB>0?`${yB.toFixed(1)}%`:'—'}</div></div>
          <div style="background:#f8fafc;padding:5px 8px;border-radius:5px"><div style="color:#94a3b8;text-transform:uppercase;font-size:8px">Trend YoY</div><div style="font-weight:600;color:#16a34a">${d.var_yoy?`+${d.var_yoy}%`:'—'}</div></div>
        </div>
        ${isL&&d.valor_base?`<div style="font-size:9px;background:#fef2f2;padding:4px 8px;border-radius:4px;color:#dc2626;margin-bottom:6px">⚠️ Leilão Judicial · Valor Base: €${Number(d.valor_base).toLocaleString('pt-PT')} · ${d.prazo_licitacao?`Prazo: ${d.prazo_licitacao}`:''}</div>`:''}
        ${isB?`<div style="font-size:9px;background:#eff6ff;padding:4px 8px;border-radius:4px;color:#2563eb;margin-bottom:6px">🏦 Imóvel da Banca — ${String(d.banco||'')} · Desconto estimado 10-25%</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:9px;color:#64748b">${d.agente?`Agente/Plataforma: ${String(d.agente).substring(0,40)}`:''} ${d.telefone?`· ☎ ${d.telefone}`:''}</div>
          <a href="${String(d.url)}" style="font-size:9px;color:#1c4a35;font-weight:600;text-decoration:none">Ver imóvel →</a>
        </div>
        <div style="font-size:8px;color:#94a3b8;margin-top:4px;word-break:break-all">${String(d.url).substring(0,80)}${String(d.url).length>80?'...':''}</div>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<title>Agency Group — Radar Escolhas do Dia ${hoje}</title>
<style>
  @page { size:A4; margin:15mm 12mm; }
  *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:11px;line-height:1.4;margin:0;padding:0}
  .header{border-bottom:3px solid #1c4a35;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
  .logo{font-size:22px;font-weight:900;color:#1c4a35;letter-spacing:-0.5px}
  .logo span{color:#c9a96e}
  .subtitle{font-size:10px;color:#64748b;margin-top:2px}
  .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
  .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;text-align:center}
  .stat-val{font-size:18px;font-weight:800;color:#1c4a35}
  .stat-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em}
  .section-title{font-size:13px;font-weight:700;color:#0f172a;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{font-size:10px}.deal{page-break-inside:avoid}}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">Agency<span>Group</span></div>
    <div class="subtitle">AMI 22506 · geral@agencygroup.pt · www.agencygroup.pt</div>
    <div class="subtitle">RADAR DE OPORTUNIDADES — ${hoje} · Zona: ${String(filtros.zona||'Portugal')} · Score mínimo: ${String(filtros.score_min||65)}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;font-weight:700;color:#0f172a">ESCOLHAS DO DIA</div>
    <div style="font-size:9px;color:#64748b">${deals.length} oportunidades identificadas</div>
    <div style="font-size:9px;color:#64748b">Gerado: ${new Date().toLocaleTimeString('pt-PT')}</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${deals.length}</div><div class="stat-label">Deals Encontrados</div></div>
  <div class="stat"><div class="stat-val" style="color:#c9a96e">${Number(stats.avg_score||0)}</div><div class="stat-label">Score Médio</div></div>
  <div class="stat"><div class="stat-val" style="color:#dc2626">${Number(stats.leiloes||0)}</div><div class="stat-label">🔨 Leilões</div></div>
  <div class="stat"><div class="stat-val" style="color:#2563eb">${Number(stats.banca||0)}</div><div class="stat-label">🏦 Banca</div></div>
  <div class="stat"><div class="stat-val">${Number(stats.mercado_livre||0)}</div><div class="stat-label">🏠 Mercado</div></div>
</div>
<div class="section-title">Ranking de Oportunidades — Ordenado por Score Descrescente</div>
${dealsHtml}
<div class="footer">
  <span>Agency Group · AMI 22506 · Nota: Análise indicativa. Não constitui proposta de negócio. Verifique sempre informação directamente com os vendedores/plataformas.</span>
  <span>Fontes: ${String((filtros.fontes as string[]||[]).join(' · '))} · Euribor live BCE · INE/AT Q4 2025</span>
</div>
</body></html>`

    // Blob URL — browsers don't block this unlike window.open('')
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    if (w) {
      // Auto-trigger print dialog after page renders
      setTimeout(() => {
        try { w.print() } catch { /* user can Ctrl+P manually */ }
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 1200)
    } else {
      // Popup blocked → silent download as HTML (open + print to PDF)
      const a = document.createElement('a')
      a.href = url
      a.download = `radar-escolhas-${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
    }
  }

  // ── MORTGAGE ──
  async function runMort(overrides?: {montante?:number,entrada?:number,prazo?:number,spread?:number,uso?:string,rendimento?:number}) {
    const montante = overrides?.montante ?? (parseFloat(mortMontante) || 0)
    const entrada_pct = overrides?.entrada ?? mortEntrada
    const prazo = overrides?.prazo ?? mortPrazo
    const spread = overrides?.spread ?? mortSpreadVal
    const uso = overrides?.uso ?? mortUso
    const rendimento_anual = overrides?.rendimento ?? (parseFloat(mortRendimento) || undefined)
    if (!montante || montante < 10000) return
    setMortLoading(true); setMortResult(null)
    try {
      const body: Record<string,unknown> = { montante, entrada_pct, prazo, spread, uso }
      if (rendimento_anual) body.rendimento_anual = rendimento_anual
      const res = await fetch('/api/mortgage', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) setMortResult(data)
      else alert(data.error || 'Erro no cálculo')
    } catch { alert('Erro de ligação.') }
    finally { setMortLoading(false) }
  }

  async function runMortPersona(p: {montante:number,entrada:number,prazo:number,spread:number,uso:string,rendimento?:number}) {
    setMortMontante(String(p.montante))
    setMortEntrada(p.entrada)
    setMortPrazo(p.prazo)
    setMortSpreadVal(p.spread)
    setMortUso(p.uso as 'habitacao_propria'|'investimento')
    if (p.rendimento) setMortRendimento(String(p.rendimento))
    setMortLoading(true); setMortResult(null)
    try {
      const body: Record<string,unknown> = { montante:p.montante, entrada_pct:p.entrada, prazo:p.prazo, spread:p.spread, uso:p.uso }
      if (p.rendimento) body.rendimento_anual = p.rendimento
      const res = await fetch('/api/mortgage', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) setMortResult(data)
      else alert(data.error || 'Erro no cálculo')
    } catch { alert('Erro de ligação.') }
    finally { setMortLoading(false) }
  }

  // ── NHR ──
  async function runNHR(overrides?: {pais?:string, tipo?:string, rend?:number, fonte?:boolean}) {
    const pais = overrides?.pais ?? nhrPais
    const tipo = overrides?.tipo ?? nhrTipo
    const rendimento = overrides?.rend ?? (parseFloat(nhrRend) || 0)
    const fonte = overrides?.fonte ?? nhrFonte
    if (!rendimento || rendimento < 1000) return
    setNhrLoading(true); setNhrResult(null)
    try {
      const res = await fetch('/api/nhr', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pais, tipo_rendimento: tipo, rendimento_anual: rendimento, regime:'compare', fonte_estrangeira: fonte }) })
      const data = await res.json()
      if (data.success) setNhrResult(data)
    } catch {}
    finally { setNhrLoading(false) }
  }

  async function runNHRPersona(p: {pais:string, tipo:string, rend:number, fonte:boolean}) {
    setNhrPais(p.pais); setNhrTipo(p.tipo); setNhrRend(String(p.rend)); setNhrFonte(p.fonte)
    setNhrLoading(true); setNhrResult(null)
    try {
      const res = await fetch('/api/nhr', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pais:p.pais, tipo_rendimento:p.tipo, rendimento_anual:p.rend, regime:'compare', fonte_estrangeira:p.fonte }) })
      const data = await res.json()
      if (data.success) setNhrResult(data)
    } catch {}
    finally { setNhrLoading(false) }
  }

  // ── PORTFOLIO ──
  async function runPortfolio() {
    const items = portItems.filter(x => x.trim())
    if (items.length < 2) { alert('Introduz pelo menos 2 imóveis.'); return }
    setPortLoading(true); setPortResult(null)
    try {
      const res = await fetch('/api/portfolio', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ properties: items.map(url => ({ url })) }) })
      const data = await res.json()
      if (data.success) setPortResult(data)
      else alert(data.error || 'Erro')
    } catch { alert('Erro de ligação.') }
    finally { setPortLoading(false) }
  }

  // ── MARKETING AI ──
  function handlePhotoUpload(files: FileList | null) {
    if (!files) return
    Array.from(files).slice(0, 10).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        if (e.target?.result) {
          setMktPhotos(prev => [...prev, e.target!.result as string].slice(0, 10))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  async function autoFillFromUrl() {
    if (!mktListingUrl.trim()) return
    setMktAutoFilling(true)
    try {
      const res = await fetch('/api/radar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: mktListingUrl }) })
      const data = await res.json()
      if (data.success && data.analise) {
        const a = data.analise as Record<string,unknown>
        setMktInput(prev => ({
          ...prev,
          zona: String(a.zona || prev.zona || ''),
          tipo: String(a.tipologia || prev.tipo || ''),
          area: String(a.area_m2 || prev.area || ''),
          preco: String(a.preco_pedido || prev.preco || ''),
          quartos: String(a.quartos || prev.quartos || ''),
        }))
        setMktInputTab('dados')
      }
    } catch {}
    setMktAutoFilling(false)
  }

  async function runMarketing() {
    if (!mktInput.zona || !mktInput.preco) { alert('Preenche pelo menos zona e preço.'); return }
    setMktLoading(true); setMktResult(null); setMktSeoScore(null); setMktPhotoInsights(null)
    try {
      const body = {
        ...mktInput,
        fotos_count: mktPhotos.length,
        fotos_base64: mktPhotos.slice(0, 4), // send up to 4 for vision analysis
        video_url: mktVideoUrl,
        listing_url: mktListingUrl,
        persona: mktPersona,
        idiomas: mktLangs.length > 0 ? mktLangs : ['pt', 'en', 'fr'],
      }
      const res = await fetch('/api/content', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) {
        setMktResult(data.content)
        setMktSeoScore(data.seo_score ?? null)
        setMktPhotoInsights(data.photo_insights ?? null)
        setMktPostingSchedule(data.posting_schedule ?? null)
        setMktCharCounts(data.char_counts ?? null)
        setMktCharLimits(data.char_limits ?? null)
        // Auto-set lang to first available
        if (mktLangs.length > 0 && !mktLangs.includes(mktLang)) setMktLang(mktLangs[0])
      } else {
        alert(data.error || 'Erro na geração')
      }
    } catch { alert('Erro de ligação.') }
    finally { setMktLoading(false) }
  }

  function startVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('O teu browser não suporta reconhecimento de voz. Usa Chrome.')
      return
    }
    const SR = (window as unknown as Record<string,unknown>).SpeechRecognition || (window as unknown as Record<string,unknown>).webkitSpeechRecognition
    const recognition = new (SR as new() => { lang:string; continuous:boolean; interimResults:boolean; onresult:(e:unknown)=>void; onend:()=>void; start:()=>void; stop:()=>void })()
    recognition.lang = 'pt-PT'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: unknown) => {
      const ev = e as { results: { [0]: { [0]: { transcript: string } } } }
      const transcript = ev.results[0][0].transcript
      setMktInput(prev => ({ ...prev, descricao: prev.descricao ? prev.descricao + ' ' + transcript : transcript }))
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    setIsListening(true)
    recognition.start()
  }

  function copyContent() {
    const content = mktResult && mktResult[mktFormat] ? (mktResult[mktFormat] as Record<string,string>)[mktLang] || '' : ''
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function addDeal() {
    if (!newDeal.imovel || !newDeal.valor) return
    const id = Date.now()
    const deal = {
      id,
      ref: `AG-2026-${String(deals.length + 1).padStart(3,'0')}`,
      imovel: newDeal.imovel,
      valor: newDeal.valor,
      fase: 'Angariação',
      checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k=>[k,CHECKLISTS[k].map(()=>false)]))
    }
    saveDeals([...deals, deal])
    setNewDeal({ imovel:'', valor:'' })
    setShowNewDeal(false)
  }

  function toggleCheck(dealId:number, fase:string, idx:number) {
    saveDeals(deals.map(d => {
      if (d.id !== dealId) return d
      const newChecklist = { ...d.checklist }
      const arr = [...newChecklist[fase]]
      arr[idx] = !arr[idx]
      newChecklist[fase] = arr
      return { ...d, checklist: newChecklist }
    }))
  }

  function changeFase(dealId:number, fase:string) {
    saveDeals(deals.map(d => d.id === dealId ? { ...d, fase } : d))
  }

  // ── JURÍDICO IA ──
  async function enviarJuridico(texto?: string) {
    let pergunta = (texto ?? jurInput).trim()
    if (!pergunta || jurLoading) return
    // Apply mode prefix if memo and not already prefixed
    if (jurMode === 'memo' && !pergunta.startsWith('MEMO:')) {
      pergunta = 'MEMO: ' + pergunta
    }
    setJurInput('')
    const ts = new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})
    const novas: JurMsg[] = [...jurMsgs, { role:'user', content:pergunta, ts, mode: jurMode === 'memo' ? 'memo' : undefined }]
    setJurMsgs(novas)
    setJurLoading(true)
    setJurWebSearch(false)
    try {
      const res = await fetch('/api/juridico', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: novas.map(m=>({ role:m.role, content:m.content })) })
      })
      const data = await res.json()
      if (data.success) {
        setJurWebSearch(data.webSearch ?? false)
        setJurMsgs(prev => [...prev, { role:'assistant', content:data.resposta, webSearch:data.webSearch, ts: new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) }])
      } else {
        setJurMsgs(prev => [...prev, { role:'assistant', content:`Erro: ${data.error}`, ts: new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) }])
      }
    } catch {
      setJurMsgs(prev => [...prev, { role:'assistant', content:'Erro de ligação. Tenta novamente.', ts: new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) }])
    } finally { setJurLoading(false); setJurWebSearch(false) }
  }

  function exportarJuridico() {
    const texto = jurMsgs
      .map(m => `[${m.ts}] ${m.role === 'user' ? 'AGENTE' : 'CONSULTOR IA'}\n${m.content}`)
      .join('\n\n─────────────────────────────────\n\n')
    const blob = new Blob([`CONSULTOR JURÍDICO IA — Agency Group (AMI 22506)\n${'═'.repeat(50)}\n${new Date().toLocaleDateString('pt-PT')}\n\n${texto}\n\n${'═'.repeat(50)}\nInformação jurídica para apoio a agentes · Não substitui aconselhamento jurídico profissional`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `juridico-${new Date().toISOString().split('T')[0]}.txt`
    a.click(); URL.revokeObjectURL(url)
  }

  const portfolioStats = useMemo(() => {
    if (portfolioProperties.length === 0) return null
    const totalValue = portfolioProperties.reduce((s,p) => s + p.currentValue, 0)
    const totalLoan = portfolioProperties.reduce((s,p) => s + (p.currentValue * (1 - p.downPayment/100)), 0)
    const totalEquity = totalValue - totalLoan
    const totalRental = portfolioProperties.reduce((s,p) => s + (p.currentValue * p.rentalYield/100), 0)
    const value5y = portfolioProperties.reduce((s,p) => s + p.currentValue * Math.pow(1 + p.appreciation/100, 5), 0)
    const value10y = portfolioProperties.reduce((s,p) => s + p.currentValue * Math.pow(1 + p.appreciation/100, 10), 0)
    const roi10y = ((value10y - totalValue) / totalValue * 100)
    return { totalValue, totalEquity, totalRental, value5y, value10y, roi10y }
  }, [portfolioProperties])

  if (!ready) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0c1f15',fontFamily:'Cormorant,serif',fontSize:'1.5rem',color:'#c9a96e',letterSpacing:'.1em'}}>
      A carregar...
    </div>
  )

  const initials = agentName.substring(0,2).toUpperCase()
  const pipelineTotal = deals.reduce((s,d) => s + parseFloat(d.valor.replace(/[^0-9.]/g,'')), 0)

  const filteredDocs = DOC_LIBRARY.map(cat => ({
    ...cat,
    docs: docSearch.trim()
      ? cat.docs.filter(doc => doc.name.toLowerCase().includes(docSearch.toLowerCase()) || doc.desc.toLowerCase().includes(docSearch.toLowerCase()))
      : cat.docs
  })).filter(cat => cat.docs.length > 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Jost',sans-serif;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15);border-radius:2px}
        .p-inp{width:100%;background:#fff;border:1px solid rgba(14,14,13,.12);padding:10px 14px;font-family:'Jost',sans-serif;font-size:.83rem;color:#0e0e0d;outline:none;transition:border .2s}
        .p-inp:focus{border-color:#1c4a35}
        .p-sel{width:100%;background:#fff;border:1px solid rgba(14,14,13,.12);padding:10px 14px;font-family:'Jost',sans-serif;font-size:.83rem;color:#0e0e0d;outline:none;cursor:pointer;appearance:none}
        .p-btn{background:#1c4a35;color:#f4f0e6;border:none;padding:12px 24px;font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s}
        .p-btn:hover{background:#163d2c}
        .p-btn:disabled{opacity:.5;cursor:not-allowed}
        .p-btn-gold{background:#c9a96e;color:#0c1f15}
        .p-btn-gold:hover{background:#b8945a}
        .p-label{font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-bottom:6px;display:block}
        .p-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .p-result-val{font-family:'Cormorant',serif;font-size:2.4rem;font-weight:300;color:#1c4a35;line-height:1}
        .mkt-tab{padding:8px 16px;font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(14,14,13,.12);background:none;cursor:pointer;transition:all .2s;color:rgba(14,14,13,.5)}
        .mkt-tab.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
        .mkt-result{background:#fff;border:1px solid rgba(14,14,13,.1);padding:20px;min-height:120px;font-size:.83rem;line-height:1.8;color:#0e0e0d;white-space:pre-wrap;font-family:'Jost',sans-serif}
        .deal-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;cursor:pointer;transition:border .2s}
        .deal-card:hover{border-color:#1c4a35}
        .deal-card.active{border-color:#c9a96e;border-width:2px}
        .check-item{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(14,14,13,.05);font-size:.8rem;color:rgba(14,14,13,.7);cursor:pointer;transition:color .2s}
        .check-item:hover{color:#0e0e0d}
        .check-item.done{color:rgba(14,14,13,.35);text-decoration:line-through}
        .doc-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(14,14,13,.06)}
        .kpi-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:20px 24px}
        .kpi-val{font-family:'Cormorant',serif;font-size:2rem;font-weight:300;color:#1c4a35;line-height:1}
        .kpi-label{font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-top:6px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:7px 16px;cursor:pointer;transition:all .2s;border-radius:4px;margin:1px 8px;font-size:.75rem;color:rgba(244,240,230,.45);letter-spacing:.04em}
        .nav-item:hover{background:rgba(244,240,230,.06);color:rgba(244,240,230,.8)}
        .nav-item.active{background:rgba(201,169,110,.15);color:#c9a96e}
        .nav-item.active svg{stroke:#c9a96e}
        .nav-item svg{stroke:rgba(244,240,230,.35);transition:stroke .2s;flex-shrink:0}
        .port-card{border:1px solid rgba(14,14,13,.08);padding:16px;background:#fff}
        .port-card.top{border-color:#c9a96e}
        @keyframes jdot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes soundBar{0%{height:4px;opacity:.5}100%{height:18px;opacity:1}}
        .mkt-input-tab{padding:8px 16px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .mkt-input-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .crm-contact-row{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(14,14,13,.06);transition:background .15s}
        .crm-contact-row:hover{background:rgba(28,74,53,.04)}
        .crm-contact-row.active{background:rgba(201,169,110,.08);border-left:3px solid #c9a96e}
        .crm-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:.56rem;font-weight:400;flex-shrink:0;letter-spacing:.04em}
        .crm-status{display:inline-flex;align-items:center;padding:2px 8px;font-family:'DM Mono',monospace;font-size:.42rem;letter-spacing:.1em;text-transform:uppercase}
        .crm-stat-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:16px 20px;flex:1}
        .crm-profile-tab{padding:8px 16px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .crm-profile-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .tour-platform-btn{padding:10px 18px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(14,14,13,.15);background:none;cursor:pointer;transition:all .2s;color:rgba(14,14,13,.5)}
        .tour-platform-btn.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
        .deal-tab{padding:9px 18px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:rgba(14,14,13,.4);transition:all .2s}
        .deal-tab.active{color:#1c4a35;border-bottom-color:#1c4a35}
        .inv-metric{background:#fff;border:1px solid rgba(14,14,13,.08);padding:14px 18px}
        .inv-metric .val{font-family:'Cormorant',serif;font-weight:300;font-size:1.6rem;color:#1c4a35;line-height:1}
        .inv-metric .lbl{font-family:'DM Mono',monospace;font-size:.42rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(14,14,13,.35);margin-top:4px}
        .inv-scenario{border:1px solid rgba(14,14,13,.1);padding:14px;flex:1;min-width:120px;text-align:center;transition:border .2s}
        .inv-scenario.best{border-color:#c9a96e;background:rgba(201,169,110,.04)}
        .tour-timer{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.12em;border:1px solid rgba(28,74,53,.2);color:#1c4a35}
        .tour-hot{background:#c9a96e;color:#0c1f15;padding:10px 16px;font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;animation:pulse 1.5s ease-in-out infinite}
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
          .kpi-val{font-size:1.5rem}
        }
        @media (max-width:768px){
          .kpi-grid{grid-template-columns:1fr 1fr!important}
          .actions-grid{grid-template-columns:1fr 1fr!important}
          .mkt-grid{grid-template-columns:1fr!important}
          .p-two-col{grid-template-columns:1fr!important}
          .crm-layout{flex-direction:column}
          .crm-list{width:100%!important;min-width:unset!important;border-right:none!important;border-bottom:1px solid rgba(14,14,13,.08)!important}
        }
        .photo-drop{border:2px dashed rgba(14,14,13,.15);padding:32px;text-align:center;cursor:pointer;transition:border .2s;background:rgba(14,14,13,.02)}
        .photo-drop:hover{border-color:#1c4a35}
        .photo-drop.drag{border-color:#c9a96e;background:rgba(201,169,110,.05)}
        .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
        .photo-thumb{position:relative;padding-bottom:100%;background:#f0ede4;overflow:hidden}
        .photo-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .photo-remove{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:.7rem;display:flex;align-items:center;justify-content:center;line-height:1}
        .action-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:20px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:8px}
        .action-card:hover{border-color:#1c4a35;transform:translateY(-2px);box-shadow:0 8px 24px rgba(14,14,13,.08)}
        .market-pulse-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(14,14,13,.06)}
        .breadcrumb{display:flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.1em;text-transform:uppercase}
        .timeline-phase{display:flex;align-items:flex-start;gap:12px;padding:6px 0}
        .timeline-dot{width:10px;height:10px;border-radius:50%;border:2px solid #ccc;flex-shrink:0;margin-top:4px}
        .timeline-dot.done{background:#1c4a35;border-color:#1c4a35}
        .timeline-dot.current{background:#c9a96e;border-color:#c9a96e}
        .comparison-table{width:100%;border-collapse:collapse;margin-top:16px;font-family:'DM Mono',monospace;font-size:.5rem}
        .comparison-table th{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(244,240,230,.1);color:rgba(244,240,230,.4);letter-spacing:.1em;text-transform:uppercase}
        .comparison-table td{padding:8px 12px;border-bottom:1px solid rgba(244,240,230,.06);color:rgba(244,240,230,.7)}
        .comparison-table tr.highlight td{color:#c9a96e}

        /* ═══ DARK MODE — Verde Agency Group ═══ */
        html.dark .kpi-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .kpi-val{color:#c9a96e!important}
        html.dark .kpi-label{color:rgba(244,240,230,.35)}
        html.dark .action-card{background:#122a1a;border-color:rgba(201,169,110,.12);color:rgba(244,240,230,.8)}
        html.dark .action-card:hover{border-color:#c9a96e;box-shadow:0 8px 24px rgba(0,0,0,.3)}
        html.dark .deal-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .deal-card:hover{border-color:#c9a96e}
        html.dark .deal-card.active{border-color:#c9a96e}
        html.dark .mkt-result{background:#0e2416;border-color:rgba(201,169,110,.12);color:rgba(244,240,230,.85)}
        html.dark .mkt-tab{border-color:rgba(244,240,230,.1);color:rgba(244,240,230,.45)}
        html.dark .mkt-tab.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
        html.dark .mkt-input-tab{color:rgba(244,240,230,.35)}
        html.dark .mkt-input-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
        html.dark .check-item{color:rgba(244,240,230,.65);border-bottom-color:rgba(244,240,230,.06)}
        html.dark .check-item:hover{color:#f4f0e6}
        html.dark .check-item.done{color:rgba(244,240,230,.25)}
        html.dark .doc-item{border-bottom-color:rgba(244,240,230,.06)}
        html.dark .port-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .port-card.top{border-color:#c9a96e}
        html.dark .crm-contact-row{border-bottom-color:rgba(244,240,230,.06)}
        html.dark .crm-contact-row:hover{background:rgba(201,169,110,.06)}
        html.dark .crm-contact-row.active{background:rgba(201,169,110,.1);border-left-color:#c9a96e}
        html.dark .crm-stat-card{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .crm-profile-tab{color:rgba(244,240,230,.35)}
        html.dark .crm-profile-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
        html.dark .deal-tab{color:rgba(244,240,230,.35)}
        html.dark .deal-tab.active{color:#c9a96e;border-bottom-color:#c9a96e}
        html.dark .inv-metric{background:#122a1a;border-color:rgba(201,169,110,.12)}
        html.dark .inv-metric .val{color:#c9a96e}
        html.dark .inv-metric .lbl{color:rgba(244,240,230,.35)}
        html.dark .inv-scenario{border-color:rgba(244,240,230,.1)}
        html.dark .inv-scenario.best{border-color:#c9a96e;background:rgba(201,169,110,.06)}
        html.dark .market-pulse-item{border-bottom-color:rgba(244,240,230,.06)}
        html.dark .photo-drop{border-color:rgba(244,240,230,.15);background:rgba(244,240,230,.02)}
        html.dark .photo-drop:hover{border-color:#c9a96e}
        html.dark .photo-thumb{background:#122a1a}
        html.dark .tour-platform-btn{border-color:rgba(244,240,230,.12);color:rgba(244,240,230,.45)}
        html.dark .tour-platform-btn.active{background:#1c4a35;color:#f4f0e6;border-color:#1c4a35}
        html.dark .tour-timer{border-color:rgba(201,169,110,.25);color:#c9a96e}
        html.dark .timeline-dot{border-color:rgba(244,240,230,.2)}
        html.dark .hamburger span{background:#f4f0e6}
        html.dark input,html.dark select,html.dark textarea{background:#0e2416!important;border-color:rgba(201,169,110,.2)!important;color:#f4f0e6!important}
        html.dark input::placeholder,html.dark textarea::placeholder{color:rgba(244,240,230,.3)!important}
        html.dark input:focus,html.dark select:focus,html.dark textarea:focus{border-color:#c9a96e!important;outline:none}
        html.dark .breadcrumb{color:rgba(244,240,230,.4)}

        /* ── Sobrepor cores escuras inline com attribute selectors ── */
        html.dark .portal-main [style*="color:#0e0e0d"]{color:rgba(244,240,230,.88)!important}
        html.dark .portal-main [style*="color:#1c4a35"]{color:#6fcf97!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.7"]{color:rgba(244,240,230,.7)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.6"]{color:rgba(244,240,230,.6)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.5"]{color:rgba(244,240,230,.5)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.45"]{color:rgba(244,240,230,.45)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.4"]{color:rgba(244,240,230,.4)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.35"]{color:rgba(244,240,230,.35)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.3"]{color:rgba(244,240,230,.3)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.28"]{color:rgba(244,240,230,.28)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.25"]{color:rgba(244,240,230,.25)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.2"]{color:rgba(244,240,230,.2)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.15"]{color:rgba(244,240,230,.15)!important}
        html.dark .portal-main [style*="color:rgba(14,14,13,.1"]{color:rgba(244,240,230,.1)!important}
        /* Backgrounds brancas → verde escuro */
        html.dark .portal-main [style*="background:#fff"]{background:#122a1a!important}
        html.dark .portal-main [style*="background:white"]{background:#122a1a!important}
        html.dark .portal-main [style*="background:rgba(14,14,13,.02)"]{background:rgba(201,169,110,.03)!important}
        html.dark .portal-main [style*="background:rgba(14,14,13,.03)"]{background:rgba(201,169,110,.03)!important}
        html.dark .portal-main [style*="background:rgba(14,14,13,.04)"]{background:rgba(201,169,110,.04)!important}
        html.dark .portal-main [style*="background:rgba(28,74,53,.04)"]{background:rgba(201,169,110,.05)!important}
        /* Borders escuras → douradas subtis */
        html.dark .portal-main [style*="border:1px solid rgba(14,14,13"]{border-color:rgba(201,169,110,.15)!important}
        html.dark .portal-main [style*="borderBottom:1px solid rgba(14,14,13"]{border-bottom-color:rgba(244,240,230,.08)!important}
        html.dark .portal-main [style*="borderTop:1px solid rgba(14,14,13"]{border-top-color:rgba(244,240,230,.08)!important}
      `}</style>

      <div style={{display:'flex',flexDirection:'row',height:'100vh',overflow:'hidden'}} className={`portal-main${darkMode?' dark bg-gray-950 text-gray-100':''}`}>

        {/* Mobile overlay */}
        <div className={`mobile-overlay${sidebarOpen?' show':''}`} onClick={()=>setSidebarOpen(false)}/>

        {/* ═══════════ SIDEBAR ═══════════ */}
        <aside className={`portal-sidebar${sidebarOpen?' open':''}`} style={{width:'240px',minWidth:'240px',maxWidth:'240px',flexShrink:0,background:'#0c1f15',display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid rgba(201,169,110,.1)',zIndex:10}}>

          {/* Logo */}
          <div style={{padding:'28px 24px 22px',borderBottom:'1px solid rgba(244,240,230,.06)',flexShrink:0}}>
            <Link href="/" style={{textDecoration:'none',display:'block'}}>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.4rem',letterSpacing:'.4em',textTransform:'uppercase',color:'#c9a96e',lineHeight:1}}>Agency</div>
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'.7rem',letterSpacing:'.65em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginTop:'3px'}}>Group</div>
            </Link>
          </div>

          {/* User */}
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(244,240,230,.06)',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
            <div style={{width:'34px',height:'34px',borderRadius:'50%',background:'rgba(201,169,110,.15)',border:'1px solid rgba(201,169,110,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#c9a96e',flexShrink:0,letterSpacing:'.06em'}}>{initials}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:'.78rem',color:'#f4f0e6',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{agentName}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',color:'rgba(244,240,230,.3)',textTransform:'uppercase',marginTop:'2px'}}>AMI 22506</div>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.35rem',color:'rgba(44,122,86,.8)',letterSpacing:'.08em',background:'rgba(44,122,86,.1)',border:'1px solid rgba(44,122,86,.25)',padding:'2px 8px',marginTop:'4px',display:'inline-block'}}>● Notion Sync</span>
            </div>
          </div>

          {/* Nav — grouped */}
          <nav style={{flex:1,overflowY:'auto',overflowX:'hidden',padding:'10px 0',minHeight:0,position:'relative',top:'auto',left:'auto',right:'auto',zIndex:'auto',width:'auto',background:'transparent',display:'flex',flexDirection:'column'}}>
            {(()=>{
              const rendered: React.ReactNode[] = []
              let lastGroup = '__start__'
              NAV.forEach(item => {
                if(item.group !== lastGroup) {
                  if(item.group) rendered.push(
                    <div key={`g-${item.group}`} style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.16em',color:'rgba(244,240,230,.2)',textTransform:'uppercase',padding:'10px 24px 4px',marginTop: lastGroup===''||lastGroup==='__start__' ? '4px':'0'}}>
                      {item.group}
                    </div>
                  )
                  lastGroup = item.group
                }
                rendered.push(
                  <div key={item.id} className={`nav-item${section===item.id?' active':''}`} onClick={()=>{setSection(item.id);setSidebarOpen(false)}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" style={{flexShrink:0}}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                    </svg>
                    <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.label}</span>
                  </div>
                )
              })
              return rendered
            })()}
          </nav>

          {/* Mercado + Logout */}
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(244,240,230,.06)',flexShrink:0}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.14em',color:'rgba(244,240,230,.2)',textTransform:'uppercase',marginBottom:'8px'}}>Mercado Portugal</div>
            {[['Mediana','€3.076/m²'],['YoY','+17,6%'],['Transacções','169.812']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.28)',letterSpacing:'.06em'}}>{k}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(201,169,110,.65)',letterSpacing:'.06em'}}>{v}</span>
              </div>
            ))}
            <button onClick={logout}
              style={{marginTop:'10px',width:'100%',background:'none',border:'1px solid rgba(244,240,230,.08)',color:'rgba(244,240,230,.25)',padding:'7px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.14em',textTransform:'uppercase',cursor:'pointer',transition:'all .2s'}}
              onMouseOver={e=>{(e.target as HTMLButtonElement).style.borderColor='rgba(244,240,230,.25)';(e.target as HTMLButtonElement).style.color='rgba(244,240,230,.55)'}}
              onMouseOut={e=>{(e.target as HTMLButtonElement).style.borderColor='rgba(244,240,230,.08)';(e.target as HTMLButtonElement).style.color='rgba(244,240,230,.25)'}}>
              Terminar sessão
            </button>
          </div>
        </aside>

        {/* ═══════════ MAIN ═══════════ */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',overflow:'hidden',background:darkMode?'#0f2518':'#f4f0e6'}}>

          {/* HEADER — só título + stats */}
          <header style={{height:'56px',background:darkMode?'#0c1f15':'#f4f0e6',borderBottom:`1px solid ${darkMode?'rgba(201,169,110,.12)':'rgba(14,14,13,.08)'}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px 0 20px',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <button className="hamburger" onClick={()=>setSidebarOpen(!sidebarOpen)}>
                <span/><span/><span/>
              </button>
              {section !== 'dashboard' && (
                <button onClick={()=>setSection('dashboard')}
                  style={{background:'none',border:'none',cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',padding:'4px 8px 4px 0',transition:'color .2s',display:'flex',alignItems:'center',gap:'5px'}}
                  onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.color='#1c4a35'}}
                  onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.color='rgba(14,14,13,.35)'}}>
                  ← voltar
                </button>
              )}
              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.05rem',color:darkMode?'#f4f0e6':'#0e0e0d',letterSpacing:'.01em'}}>{SECTION_NAMES[section]}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'20px'}}>
              <div style={{display:'flex',gap:'18px'}}>
                {[['Pipeline',`€${(pipelineTotal/1e6).toFixed(1)}M`],['Deals',String(deals.length)],['Mercado','+17,6%']].map(([l,v])=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.53rem',color:darkMode?'#c9a96e':'#1c4a35',fontWeight:500}}>{v}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',color:darkMode?'rgba(244,240,230,.35)':'rgba(14,14,13,.32)',textTransform:'uppercase'}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.08em',color:darkMode?'rgba(244,240,230,.4)':'rgba(14,14,13,.35)'}}>
                {now.toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short'})} · {now.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}
              </div>
              {/* Notification Bell */}
              {(() => {
                const today = new Date().toISOString().split('T')[0]
                const todayTs = Date.now()
                const overdueFU = crmContacts.filter(c => c.nextFollowUp && c.nextFollowUp <= today)
                const stalePropsN = imoveisList.filter(p => {
                  const ld = (p as Record<string,unknown>).listingDate as string|undefined
                  return ld ? Math.floor((todayTs - new Date(ld).getTime()) / 86400000) > 60 : false
                })
                const totalAlerts = overdueFU.length + stalePropsN.length
                return (
                  <div style={{position:'relative'}}>
                    <button
                      onClick={()=>setShowNotifPanel(n=>!n)}
                      style={{position:'relative',background:showNotifPanel?'rgba(201,169,110,.12)':'none',border:`1px solid ${showNotifPanel?'rgba(201,169,110,.3)':darkMode?'rgba(244,240,230,.1)':'rgba(14,14,13,.1)'}`,borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:darkMode?'rgba(244,240,230,.6)':'rgba(14,14,13,.5)',transition:'all .2s',display:'flex',alignItems:'center'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                      {totalAlerts > 0 && <span style={{position:'absolute',top:'2px',right:'2px',minWidth:'14px',height:'14px',borderRadius:'7px',background:'#e05454',border:`2px solid ${darkMode?'#0c1f15':'#fff'}`,fontFamily:"'DM Mono',monospace",fontSize:'.28rem',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 2px'}}>{totalAlerts}</span>}
                    </button>
                    {showNotifPanel && (
                      <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,width:'320px',background:darkMode?'#0f2117':'#fff',border:`1px solid ${darkMode?'rgba(201,169,110,.15)':'rgba(14,14,13,.12)'}`,boxShadow:'0 16px 48px rgba(0,0,0,.25)',zIndex:300,overflow:'hidden'}}>
                        <div style={{padding:'12px 16px',borderBottom:`1px solid ${darkMode?'rgba(244,240,230,.06)':'rgba(14,14,13,.08)'}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:darkMode?'rgba(244,240,230,.4)':'rgba(14,14,13,.4)'}}>Central de Alertas</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:totalAlerts>0?'#e05454':'#10b981'}}>{totalAlerts} alerta{totalAlerts!==1?'s':''}</div>
                        </div>
                        <div style={{maxHeight:'380px',overflowY:'auto'}}>
                          {overdueFU.length > 0 && (
                            <div style={{padding:'10px 16px',borderBottom:`1px solid ${darkMode?'rgba(244,240,230,.04)':'rgba(14,14,13,.06)'}`}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#e05454',letterSpacing:'.1em',marginBottom:'6px',textTransform:'uppercase'}}>📅 Follow-up Atrasado ({overdueFU.length})</div>
                              {overdueFU.map(c => (
                                <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',cursor:'pointer',borderBottom:`1px solid ${darkMode?'rgba(244,240,230,.03)':'rgba(14,14,13,.04)'}`}} onClick={()=>{setActiveCrmId(c.id);setCrmProfileTab('overview');setSection('crm');setShowNotifPanel(false)}}>
                                  <div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:darkMode?'rgba(244,240,230,.8)':'rgba(14,14,13,.8)',fontWeight:500}}>{c.name}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:darkMode?'rgba(244,240,230,.3)':'rgba(14,14,13,.4)'}}>{c.nextFollowUp}</div>
                                  </div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#e05454',background:'rgba(224,84,84,.08)',padding:'2px 7px',flexShrink:0}}>ATRASADO</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {stalePropsN.length > 0 && (
                            <div style={{padding:'10px 16px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#f97316',letterSpacing:'.1em',marginBottom:'6px',textTransform:'uppercase'}}>🏠 Imóvel Stale &gt;60d ({stalePropsN.length})</div>
                              {stalePropsN.map(p => {
                                const ld = (p as Record<string,unknown>).listingDate as string
                                const days = Math.floor((todayTs - new Date(ld).getTime()) / 86400000)
                                return (
                                  <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',cursor:'pointer',borderBottom:`1px solid ${darkMode?'rgba(244,240,230,.03)':'rgba(14,14,13,.04)'}`}} onClick={()=>{setSection('imoveis');setShowNotifPanel(false)}}>
                                    <div>
                                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:darkMode?'rgba(244,240,230,.8)':'rgba(14,14,13,.8)',fontWeight:500}}>{p.nome}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:darkMode?'rgba(244,240,230,.3)':'rgba(14,14,13,.4)'}}>{p.zona} · €{(p.preco/1e6).toFixed(1)}M</div>
                                    </div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#f97316',background:'rgba(249,115,22,.08)',padding:'2px 7px',flexShrink:0}}>{days}d</div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {totalAlerts === 0 && (
                            <div style={{padding:'32px',textAlign:'center' as const}}>
                              <div style={{fontSize:'1.8rem',marginBottom:'8px'}}>✅</div>
                              <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.85rem',color:darkMode?'rgba(244,240,230,.4)':'rgba(14,14,13,.4)'}}>Tudo em dia — sem alertas activos</div>
                            </div>
                          )}
                        </div>
                        <div style={{padding:'10px 16px',borderTop:`1px solid ${darkMode?'rgba(244,240,230,.06)':'rgba(14,14,13,.08)'}`,display:'flex',gap:'8px'}}>
                          <button style={{flex:1,padding:'7px',background:darkMode?'rgba(28,74,53,.2)':'rgba(28,74,53,.06)',border:'1px solid rgba(28,74,53,.2)',color:'#1c4a35',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.08em'}} onClick={()=>{setSection('crm');setShowNotifPanel(false)}}>Ver CRM →</button>
                          <button style={{flex:1,padding:'7px',background:'rgba(14,14,13,.04)',border:`1px solid ${darkMode?'rgba(244,240,230,.08)':'rgba(14,14,13,.1)'}`,color:darkMode?'rgba(244,240,230,.4)':'rgba(14,14,13,.4)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}} onClick={()=>setShowNotifPanel(false)}>Fechar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <button
                onClick={() => setDarkMode(d => !d)}
                style={{padding:'6px 10px',borderRadius:'8px',border:`1px solid ${darkMode?'rgba(244,240,230,.1)':'rgba(14,14,13,.1)'}`,cursor:'pointer',fontSize:'.78rem',background:'transparent',color:darkMode?'rgba(244,240,230,.5)':'rgba(14,14,13,.4)',transition:'all .2s',flexShrink:0}}
                title={darkMode ? 'Modo claro' : 'Modo escuro'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          {/* CONTENT */}
          <main style={{flex:1,overflowY:(section==='juridico'||section==='sofia')?'hidden':'auto',padding:(section==='juridico'||section==='sofia')?'0':'32px',display:'flex',flexDirection:'column'}}>

            {/* ── DASHBOARD ── */}
            {section==='dashboard' && (
              <div>
                <div style={{marginBottom:'32px',display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
                  <div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:darkMode?'rgba(244,240,230,.3)':'rgba(14,14,13,.3)',marginBottom:'8px'}}>
                      {now.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    </div>
                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.2rem',color:darkMode?'#f4f0e6':'#0e0e0d',lineHeight:1.05}}>
                      {now.getHours()<12?'Bom dia':now.getHours()<19?'Boa tarde':'Boa noite'}, <em style={{fontStyle:'italic',color:'#c9a96e'}}>{agentName}</em>.
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <button style={{padding:'6px 14px',background:weeklyReport?'rgba(201,169,110,.12)':'rgba(28,74,53,.06)',border:`1px solid ${weeklyReport?'rgba(201,169,110,.3)':'rgba(28,74,53,.2)'}`,color:weeklyReport?'#c9a96e':'#1c4a35',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'pointer',transition:'all .15s'}}
                      disabled={weeklyReportLoading}
                      onClick={async()=>{
                        if (weeklyReport) { setWeeklyReport(null); return }
                        setWeeklyReportLoading(true)
                        try {
                          const today2 = new Date()
                          const period = `Semana de ${today2.toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'})}`
                          const res = await fetch('/api/agent/weekly-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent:agentName,deals,contacts:crmContacts,properties:imoveisList,period})})
                          const d = await res.json()
                          if (d.report) setWeeklyReport(d.report)
                        } catch{} finally{setWeeklyReportLoading(false)}
                      }}>
                      {weeklyReportLoading ? '✦ A gerar...' : weeklyReport ? '× Fechar Relatório' : '📋 Relatório Semanal IA'}
                    </button>
                    <div style={{background:'#1c4a35',padding:'6px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#6fcf97'}}/>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',color:'#f4f0e6',textTransform:'uppercase'}}>Portal Activo</span>
                    </div>
                    <div style={{background:'rgba(201,169,110,.1)',border:'1px solid rgba(201,169,110,.25)',padding:'6px 14px'}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',color:'#c9a96e',textTransform:'uppercase'}}>AMI 22506</span>
                    </div>
                  </div>
                </div>
                {/* Weekly Report Panel */}
                {weeklyReport && (
                  <div style={{background:'linear-gradient(135deg,#0c1f15,#1a3d2a)',padding:'20px 24px',marginBottom:'24px',border:'1px solid rgba(201,169,110,.15)'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'8px'}}>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.5)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'4px'}}>📋 Relatório Semanal IA — Claude Opus</div>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:'#f4f0e6',fontWeight:300}}>{String(weeklyReport.title)}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.35)',marginTop:'2px'}}>{String(weeklyReport.period)}</div>
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button style={{padding:'5px 12px',background:'rgba(244,240,230,.06)',border:'1px solid rgba(244,240,230,.1)',color:'rgba(244,240,230,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.06em'}}
                          onClick={()=>{
                            const text = `${weeklyReport.title}\n${weeklyReport.period}\n\n${weeklyReport.executiveSummary}\n\nHIGHLIGHTS:\n${(weeklyReport.highlights as string[]).map(h=>`• ${h}`).join('\n')}\n\nPRIORIDADES:\n${(weeklyReport.priorities as string[]).map(p=>`• ${p}`).join('\n')}\n\nMARKET INSIGHT:\n${weeklyReport.marketInsight}\n\nFOCO PRÓXIMA SEMANA:\n${weeklyReport.nextWeekFocus}`
                            navigator.clipboard.writeText(text)
                          }}>
                          📋 Copiar
                        </button>
                        <button style={{padding:'5px 12px',background:'rgba(244,240,230,.06)',border:'1px solid rgba(244,240,230,.1)',color:'rgba(244,240,230,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}} onClick={()=>setWeeklyReport(null)}>× Fechar</button>
                      </div>
                    </div>
                    {/* Executive Summary */}
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'rgba(244,240,230,.7)',lineHeight:1.7,marginBottom:'16px',padding:'12px 14px',background:'rgba(255,255,255,.04)',borderLeft:'3px solid rgba(201,169,110,.4)'}}>{String(weeklyReport.executiveSummary)}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                      {/* Highlights */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.5)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Destaques</div>
                        {(weeklyReport.highlights as string[]).map((h,i)=>(
                          <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px'}}>
                            <span style={{color:'#c9a96e',flexShrink:0}}>★</span>
                            <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(244,240,230,.6)',lineHeight:1.4}}>{h}</span>
                          </div>
                        ))}
                      </div>
                      {/* Priorities */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.5)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Prioridades</div>
                        {(weeklyReport.priorities as string[]).map((p,i)=>(
                          <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px'}}>
                            <span style={{color:'#4a9c7a',flexShrink:0,fontWeight:700}}>{i+1}.</span>
                            <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(244,240,230,.6)',lineHeight:1.4}}>{p}</span>
                          </div>
                        ))}
                      </div>
                      {/* Pipeline + Next week */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.5)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Pipeline</div>
                        {weeklyReport.pipeline && Object.entries(weeklyReport.pipeline as Record<string,unknown>).map(([k,v])=>(
                          <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.35)'}}>{k}</span>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#c9a96e',fontWeight:700}}>{String(v)}</span>
                          </div>
                        ))}
                        <div style={{marginTop:'10px',padding:'8px',background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.1)'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(201,169,110,.4)',marginBottom:'3px',textTransform:'uppercase'}}>Foco Próxima Semana</div>
                          <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.72rem',color:'rgba(244,240,230,.65)',lineHeight:1.4}}>{String(weeklyReport.nextWeekFocus)}</div>
                        </div>
                      </div>
                    </div>
                    {weeklyReport.marketInsight && (
                      <div style={{padding:'10px 12px',background:'rgba(201,169,110,.04)',border:'1px solid rgba(201,169,110,.1)',display:'flex',gap:'8px'}}>
                        <span style={{color:'#c9a96e',flexShrink:0}}>📈</span>
                        <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.76rem',color:'rgba(244,240,230,.55)',lineHeight:1.5}}>{String(weeklyReport.marketInsight)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 1: KPI Cards — 6 métricas */}
                {(() => {
                  const today = new Date().toISOString().split('T')[0]
                  const followUpsHoje = crmContacts.filter(c=>c.nextFollowUp && c.nextFollowUp<=today).length
                  const leadsAtivos = crmContacts.filter(c=>c.status==='lead'||c.status==='prospect').length
                  const closedDeals = deals.filter(d=>d.fase==='Escritura Concluída')
                  const totalComissaoRecebida = closedDeals.reduce((s,d)=>{
                    const v = parseFloat(d.valor.replace(/[^0-9.]/g,''))||0
                    return s + v*0.05
                  }, 0)
                  return (
                    <div className="kpi-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px',marginBottom:'28px'}}>
                      {[
                        {label:'Pipeline Total',val:`€${(pipelineTotal/1e6).toFixed(1)}M`,sub:'Valor total em negociação',color:'#1c4a35',icon:'📊'},
                        {label:'Deals Ativos',val:String(deals.length),sub:'Em progresso · '+deals.filter(d=>d.fase==='CPCV Assinado').length+' CPCV assinados',color:'#c9a96e',icon:'🏠'},
                        {label:'Comissão Prevista',val:`€${Math.round(pipelineTotal*0.05/1000)}K`,sub:'5% · AMI 22506',color:'#4a9c7a',icon:'💰'},
                        {label:'Leads & Prospects',val:String(leadsAtivos),sub:`${crmContacts.length} contactos no CRM`,color:'#c9a96e',icon:'👥'},
                        {label:'Follow-Up Hoje',val:String(followUpsHoje),sub:followUpsHoje>0?'⚠️ Acção necessária':'✓ Em dia',color:followUpsHoje>0?'#dc2626':'#4a9c7a',icon:'📅'},
                        {label:'Mercado 2026',val:'+17,6%',sub:'INE Q3 2025 · Lisboa Top 5 Mundial',color:'#c9a96e',icon:'📈'},
                      ].map(k=>(
                        <div key={k.label} className="kpi-card" style={{display:'flex',gap:'14px',alignItems:'flex-start'}}>
                          <div style={{fontSize:'1.3rem',lineHeight:1,flexShrink:0,marginTop:'2px'}}>{k.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="kpi-val" style={{color:k.color,fontSize:'1.6rem'}}>{k.val}</div>
                            <div className="kpi-label" style={{marginTop:'2px'}}>{k.label}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'3px',letterSpacing:'.06em',lineHeight:1.4}}>{k.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Row 2: Acções Rápidas */}
                <div style={{marginBottom:'28px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>Acções Rápidas</div>
                  <div className="actions-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
                    {[
                      {label:'CRM Clientes',sub:`${crmContacts.length} contactos · Gestão relacional`,sec:'crm',color:'#c9a96e',svg:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'},
                      {label:'Avaliar Imóvel',sub:'AVM · 6 metodologias RICS',sec:'avm',color:'#1c4a35',svg:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z'},
                      {label:'Deal Radar 16D',sub:'Score automático · Oferta óptima',sec:'radar',color:'#c9a96e',svg:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'},
                      {label:'Consultor Jurídico',sub:'IA Especialista · Direito PT',sec:'juridico',color:'#1c4a35',svg:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'},
                      {label:'Investor Dashboard',sub:'Comparação até 5 imóveis',sec:'portfolio',color:'#c9a96e',svg:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'},
                      {label:'Marketing AI',sub:'Neuromarketing · PT/EN/FR',sec:'marketing',color:'#1c4a35',svg:'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'},
                      {label:'Home Staging IA',sub:'Stability AI · 8 estilos · Antes/Depois',sec:'homestaging',color:'#c9a96e',svg:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'},
                      {label:'Calcular NHR',sub:'IFICI · 9 países · 10 anos',sec:'nhr',color:'#c9a96e',svg:'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064'},
                      {label:'Pipeline CPCV',sub:'Da angariação à escritura',sec:'pipeline',color:'#1c4a35',svg:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'},
                      {label:'Simular Crédito',sub:'Prestação e comparativo',sec:'credito',color:'#4a9c7a',svg:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'},
                      {label:'Biblioteca Legal',sub:'Documentos e modelos',sec:'documentos',color:'#4a9c7a',svg:'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'},
                      {label:'Market Report 2026',sub:'Portugal Luxury — PDF Premium',sec:'__report__',color:'#c9a96e',svg:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'},
                    ].map(a=>(
                      <div key={a.label} className="action-card" onClick={()=>{ if(a.sec==='__report__'){window.open('/relatorio-2026','_blank')}else{setSection(a.sec)} }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="1.5" width="22" height="22">
                          <path strokeLinecap="round" strokeLinejoin="round" d={a.svg}/>
                        </svg>
                        <div style={{fontSize:'.88rem',fontWeight:500,color:'#0e0e0d',marginTop:'4px'}}>{a.label}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',letterSpacing:'.06em'}}>{a.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 3: AI Market Pulse + Off-Market Exclusivos */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                  {/* AI Market Pulse */}
                  {(() => {
                    const PULSE_INSIGHTS = [
                      { icon:'📈', text:'Lisboa Chiado/Santos: transacções +22% YoY. Compradores franceses e americanos lideram procura por T2/T3 premium.' },
                      { icon:'🌍', text:'Comporta regista escassez crítica de oferta. Stock de Off-Market esgota em <30 dias. Oportunidade de captação urgente.' },
                      { icon:'💰', text:'Euribor 6M estabilizou nos 2.95%. Retorno ao crédito habitual: +18% de compradores elegíveis vs. Q4 2024.' },
                      { icon:'🏆', text:'Cascais Quinta da Marinha: yields 4.1–4.8% brutas. Perfil HNWI britânico e alemão a entrar fortemente no mercado.' },
                      { icon:'🔑', text:`Semana de ${new Date().toLocaleDateString('pt-PT',{month:'long'})} — Foco estratégico: acompanhar leads quentes CRM + follow-up compradores >€1M.` },
                    ]
                    return (
                      <div className="p-card" style={{background:'linear-gradient(135deg,#0c1f15 0%,#1c4a35 100%)',border:'none'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'4px'}}>✦ Market Pulse IA</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#f4f0e6'}}>Inteligência de <em style={{color:'#c9a96e'}}>Mercado</em></div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#6fcf97',animation:'pulse 1.5s ease-in-out infinite'}}/>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.3)'}}>Abr 2026</span>
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                          {PULSE_INSIGHTS.map((ins,i)=>(
                            <div key={i} style={{display:'flex',gap:'8px',alignItems:'flex-start',padding:'8px 10px',background:'rgba(255,255,255,.04)',borderRadius:'6px',borderLeft:'2px solid rgba(201,169,110,.3)'}}>
                              <span style={{fontSize:'.8rem',flexShrink:0,lineHeight:1.4}}>{ins.icon}</span>
                              <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.7rem',color:'rgba(244,240,230,.75)',lineHeight:1.5}}>{ins.text}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:'12px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.2)'}}>
                          ✦ Agency Group · INE/AT Q1 2026 · Euribor Live · AMI 22506
                        </div>
                      </div>
                    )
                  })()}

                  {/* Off-Market Exclusivos */}
                  {(() => {
                    const offMarketList = imoveisList.filter(p=>p.badge==='Off-Market'||p.badge==='Exclusivo')
                    return (
                      <div className="p-card" style={{border:'1px solid rgba(201,169,110,.2)',position:'relative',overflow:'hidden'}}>
                        <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:'linear-gradient(90deg,#c9a96e,#1c4a35)'}}/>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>🔒 Carteira Exclusiva</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#0e0e0d'}}>Off-Market & <em style={{color:'#1c4a35'}}>Exclusivos</em></div>
                          </div>
                          <div style={{display:'flex',gap:'6px'}}>
                            <span style={{background:'#c9a96e',color:'#0c1f15',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',padding:'3px 8px',letterSpacing:'.08em',fontWeight:700}}>{imoveisList.filter(p=>p.badge==='Off-Market').length} OFF</span>
                            <span style={{background:'rgba(28,74,53,.15)',color:'#1c4a35',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',padding:'3px 8px',letterSpacing:'.08em',fontWeight:700}}>{imoveisList.filter(p=>p.badge==='Exclusivo').length} EXC</span>
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                          {offMarketList.slice(0,4).map(p=>(
                            <div key={p.id} onClick={()=>setSection('imoveis')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:p.badge==='Off-Market'?'rgba(201,169,110,.06)':'rgba(28,74,53,.04)',border:`1px solid ${p.badge==='Off-Market'?'rgba(201,169,110,.2)':'rgba(28,74,53,.12)'}`,cursor:'pointer',transition:'border .2s'}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',background:p.badge==='Off-Market'?'#c9a96e':'rgba(28,74,53,.15)',color:p.badge==='Off-Market'?'#0c1f15':'#1c4a35',padding:'1px 5px',letterSpacing:'.06em',fontWeight:600}}>{p.badge?.toUpperCase()}</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)'}}>{p.ref}</span>
                                </div>
                                <div style={{fontSize:'.78rem',color:'#0e0e0d',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nome}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>{p.zona} · {p.area}m² · T{p.quartos}</div>
                              </div>
                              <div style={{textAlign:'right',flexShrink:0,marginLeft:'8px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.58rem',color:'#c9a96e',fontWeight:600}}>€{(p.preco/1e6).toFixed(2).replace('.','.')}M</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>→</div>
                              </div>
                            </div>
                          ))}
                          {offMarketList.length > 4 && (
                            <button onClick={()=>setSection('imoveis')} style={{background:'none',border:'1px dashed rgba(201,169,110,.3)',color:'#c9a96e',padding:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.1em',textAlign:'center'}}>
                              +{offMarketList.length-4} imóveis off-market → Ver todos
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Row 4: Follow-up Hoje + Comissão Tracker */}
                {(() => {
                  const today = new Date().toISOString().split('T')[0]
                  const urgentContacts = crmContacts.filter(c=>c.nextFollowUp && c.nextFollowUp<=today).sort((a,b)=>(a.nextFollowUp||'').localeCompare(b.nextFollowUp||''))
                  const STATUS_CFG: Record<string,{color:string;label:string}> = {
                    lead:{ color:'#888', label:'Lead' },
                    prospect:{ color:'#3a7bd5', label:'Prospect' },
                    cliente:{ color:'#4a9c7a', label:'Cliente' },
                    vip:{ color:'#c9a96e', label:'VIP' },
                  }
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                      {/* Follow-up Hoje */}
                      <div className="p-card" style={{border:urgentContacts.length>0?'1px solid rgba(220,38,38,.2)':'1px solid rgba(14,14,13,.08)',position:'relative',overflow:'hidden'}}>
                        {urgentContacts.length>0&&<div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:'linear-gradient(90deg,#dc2626,#c9a96e)'}}/>}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.14em',textTransform:'uppercase',color:urgentContacts.length>0?'rgba(220,38,38,.7)':'rgba(14,14,13,.35)',marginBottom:'4px'}}>
                              {urgentContacts.length>0?'⚠️ Acção Necessária':'✓ Follow-Up'}
                            </div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#0e0e0d'}}>
                              Follow-up <em style={{color:urgentContacts.length>0?'#dc2626':'#1c4a35'}}>Hoje</em>
                            </div>
                          </div>
                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'2rem',color:urgentContacts.length>0?'#dc2626':'#4a9c7a',lineHeight:1,fontWeight:300}}>{urgentContacts.length}</div>
                        </div>
                        {urgentContacts.length===0 ? (
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.3)',letterSpacing:'.06em',padding:'16px 0',textAlign:'center'}}>✓ Todos os contactos em dia</div>
                        ) : (
                          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                            {urgentContacts.slice(0,4).map(c=>{
                              const cfg = STATUS_CFG[c.status]||STATUS_CFG.lead
                              const isOverdue = c.nextFollowUp && c.nextFollowUp < today
                              return (
                                <div key={c.id} onClick={()=>{setSection('crm');setActiveCrmId(c.id)}} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:isOverdue?'rgba(220,38,38,.04)':'rgba(14,14,13,.02)',border:`1px solid ${isOverdue?'rgba(220,38,38,.15)':'rgba(14,14,13,.06)'}`,cursor:'pointer',transition:'border .2s'}}>
                                  <div style={{width:'28px',height:'28px',borderRadius:'50%',background:cfg.color+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    <span style={{fontFamily:"'Cormorant',serif",fontSize:'.8rem',color:cfg.color,fontWeight:600}}>{c.name.split(' ').map((n:string)=>n[0]).slice(0,2).join('')}</span>
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:'.82rem',color:'#0e0e0d',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)'}}>€{Number(c.budgetMax).toLocaleString('pt-PT')} · {c.zonas[0]}</div>
                                  </div>
                                  <div style={{flexShrink:0,textAlign:'right'}}>
                                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',background:cfg.color+'20',color:cfg.color,padding:'1px 5px',letterSpacing:'.06em'}}>{cfg.label}</span>
                                    {isOverdue && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'#dc2626',marginTop:'2px'}}>ATRASADO</div>}
                                  </div>
                                </div>
                              )
                            })}
                            {urgentContacts.length>4&&(
                              <button onClick={()=>setSection('crm')} style={{background:'none',border:'1px dashed rgba(220,38,38,.25)',color:'#dc2626',padding:'6px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.08em',textAlign:'center'}}>
                                +{urgentContacts.length-4} mais → Ver CRM
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Comissão Tracker */}
                      <div className="p-card" style={{background:'linear-gradient(135deg,rgba(28,74,53,.06) 0%,rgba(201,169,110,.04) 100%)'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>💰 Tracker de Comissões</div>
                        <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#0e0e0d',marginBottom:'16px'}}>Pipeline <em style={{color:'#1c4a35'}}>AMI 22506</em></div>
                        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
                          {deals.map(d=>{
                            const val = parseFloat(d.valor.replace(/[^0-9.]/g,''))||0
                            const comm5 = val*0.05
                            const pct = (STAGE_PCT[d.fase]||10)/100
                            return (
                              <div key={d.id} style={{padding:'8px 12px',background:'rgba(255,255,255,.7)',border:'1px solid rgba(14,14,13,.06)'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                                  <span style={{fontSize:'.78rem',color:'#0e0e0d',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'65%'}}>{d.imovel.split('·')[0].trim()}</span>
                                  <div style={{textAlign:'right',flexShrink:0}}>
                                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'#1c4a35',fontWeight:600}}>€{Math.round(comm5/1000)}K</span>
                                  </div>
                                </div>
                                <div style={{height:'3px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden'}}>
                                  <div style={{height:'100%',width:`${pct*100}%`,background:`linear-gradient(90deg,#1c4a35,#c9a96e)`,borderRadius:'2px'}}/>
                                </div>
                                <div style={{display:'flex',justifyContent:'space-between',marginTop:'3px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)'}}>{d.fase}</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)'}}>{Math.round(pct*100)}%</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{borderTop:'1px solid rgba(14,14,13,.08)',paddingTop:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.08em',textTransform:'uppercase'}}>Total Previsto</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',color:'#c9a96e',lineHeight:1,fontWeight:300}}>€{Math.round(pipelineTotal*0.05/1000)}K</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.08em',textTransform:'uppercase'}}>5% Pipeline</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(14,14,13,.5)',marginTop:'2px'}}>€{(pipelineTotal/1e6).toFixed(1)}M</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 5: Pipeline + Buyer Demand */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                  <div className="p-card">
                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'16px'}}>Pipeline Activo</div>
                    {deals.map(d=>(
                      <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(14,14,13,.06)',cursor:'pointer'}} onClick={()=>{setSection('pipeline');setActiveDeal(d.id)}}>
                        <div>
                          <div style={{fontSize:'.8rem',color:'#0e0e0d',fontWeight:500}}>{d.imovel}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>{d.ref}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.65rem',color:'#c9a96e'}}>{d.valor}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:STAGE_COLOR[d.fase]||'#888',marginTop:'2px',letterSpacing:'.06em'}}>{d.fase}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-card" style={{position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d'}}>Buyer Demand Live</div>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#6fcf97',animation:'pulse 1.5s ease-in-out infinite'}}/>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>Real-time</span>
                      </div>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',color:'rgba(14,14,13,.3)',marginBottom:'12px'}}>Compradores activos na tua área esta semana</div>
                    {BUYER_DEMAND.map(b=>(
                      <div key={b.zona} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid rgba(14,14,13,.05)',cursor:'pointer'}} onClick={()=>setSection('crm')}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                            <span style={{fontSize:'.8rem',fontWeight:500,color:'#0e0e0d'}}>{b.zona}</span>
                            {b.hot && <span style={{background:'#c9a96e',color:'#0c1f15',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',padding:'1px 5px',letterSpacing:'.06em'}}>HOT</span>}
                          </div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)'}}>{b.tipo} · {b.budget}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#1c4a35',lineHeight:1}}>{b.count}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#4a9c7a'}}>{b.trend}</div>
                        </div>
                        <div style={{display:'flex',gap:'1px',alignItems:'flex-end',height:'20px'}}>
                          {b.weekly.map((v,i)=>{
                            const maxV = Math.max(...b.weekly)
                            return <div key={i} style={{width:'3px',height:`${Math.max(3,(v/maxV)*18)}px`,background:i===6?'#c9a96e':'rgba(201,169,110,.3)',borderRadius:'1px'}}/>
                          })}
                        </div>
                      </div>
                    ))}
                    <div style={{marginTop:'10px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.35)',display:'flex',justifyContent:'space-between'}}>
                      <span>Total activos: {BUYER_DEMAND.reduce((s,b)=>s+b.count,0).toLocaleString('pt-PT')}</span>
                      <span style={{color:'#1c4a35',cursor:'pointer'}} onClick={()=>setSection('crm')}>Ver CRM →</span>
                    </div>
                  </div>
                {/* Row 5: Match de Oportunidades IA */}
                {(() => {
                  // Cross-reference imoveisList with crmContacts to find buyer-property matches
                  interface MatchPair { contact: typeof crmContacts[0]; property: typeof imoveisList[0]; score: number; reasons: string[] }
                  const matches: MatchPair[] = []
                  for (const contact of crmContacts) {
                    if (contact.status === 'lead' || contact.status === 'prospect' || contact.status === 'vip') {
                      for (const prop of imoveisList) {
                        const reasons: string[] = []
                        let score = 0
                        // Budget match
                        const preco = Number(prop.preco) || 0
                        if (preco >= (contact.budgetMin * 0.85) && preco <= (contact.budgetMax * 1.15)) { score += 40; reasons.push('Budget alinhado') }
                        // Zone match
                        const zonaMatch = contact.zonas.some(z => String(prop.zona).toLowerCase().includes(z.toLowerCase().split('—')[0].trim()) || z.toLowerCase().includes(String(prop.zona).toLowerCase().split('—')[0].trim()))
                        if (zonaMatch) { score += 30; reasons.push('Zona preferida') }
                        // Type match
                        const tipoMatch = contact.tipos.some(t => String(prop.tipo).toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(String(prop.tipo).toLowerCase()))
                        if (tipoMatch) { score += 20; reasons.push('Tipologia correcta') }
                        // Premium badge bonus
                        if (prop.badge === 'Off-Market' || prop.badge === 'Exclusivo') { score += 10; reasons.push('Exclusivo') }
                        if (score >= 60) matches.push({ contact, property: prop, score, reasons })
                      }
                    }
                  }
                  matches.sort((a, b) => b.score - a.score)
                  const topMatches = matches.slice(0, 6)

                  if (topMatches.length === 0) return null

                  return (
                    <div style={{marginBottom:'28px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                        <div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'#c9a96e',marginBottom:'4px'}}>✦ Matchmaking IA</div>
                          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',color:'#0e0e0d'}}>Oportunidades de <em style={{color:'#1c4a35'}}>Match</em> — {topMatches.length} detectadas</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#c9a96e',animation:'pulse 2s ease-in-out infinite'}}/>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.1em'}}>AUTO-MATCH</span>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
                        {topMatches.map((m, idx) => (
                          <div key={idx}
                            style={{background:'#fff',border:'1px solid rgba(201,169,110,.2)',borderLeft:'3px solid #c9a96e',padding:'14px 16px',cursor:'pointer',transition:'all .2s'}}
                            onClick={()=>{setActiveCrmId(m.contact.id);setSection('crm')}}
                            onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='#c9a96e';(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 16px rgba(201,169,110,.12)'}}
                            onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(201,169,110,.2)';(e.currentTarget as HTMLDivElement).style.boxShadow='none'}}>
                            {/* Score */}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)'}}>Match Score</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',fontWeight:700,color:m.score>=90?'#10b981':m.score>=70?'#f59e0b':'#c9a96e'}}>{m.score}%</div>
                            </div>
                            {/* Score bar */}
                            <div style={{height:'3px',background:'rgba(14,14,13,.06)',borderRadius:'2px',marginBottom:'10px',overflow:'hidden'}}>
                              <div style={{height:'100%',background:m.score>=90?'#10b981':m.score>=70?'#f59e0b':'#c9a96e',width:`${m.score}%`,borderRadius:'2px'}}/>
                            </div>
                            {/* Contact */}
                            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
                              <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'rgba(201,169,110,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:700,color:'#c9a96e',flexShrink:0}}>
                                {m.contact.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:'.78rem',fontWeight:500,color:'#0e0e0d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.contact.name}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>€{((m.contact.budgetMin||0)/1e6).toFixed(1)}M–€{((m.contact.budgetMax||0)/1e6).toFixed(1)}M</div>
                              </div>
                            </div>
                            {/* Property */}
                            <div style={{padding:'6px 8px',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.08)',marginBottom:'8px'}}>
                              <div style={{fontSize:'.76rem',color:'#1c4a35',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{String(m.property.nome)}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>{String(m.property.zona)} · €{(Number(m.property.preco)/1e6).toFixed(2)}M · {m.property.area}m²</div>
                            </div>
                            {/* Reasons */}
                            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                              {m.reasons.map((r, i) => (
                                <span key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',background:'rgba(201,169,110,.08)',color:'#c9a96e',padding:'2px 6px',letterSpacing:'.06em'}}>{r}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{textAlign:'right',marginTop:'8px'}}>
                        <button onClick={()=>setSection('crm')} style={{background:'none',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#1c4a35',cursor:'pointer',letterSpacing:'.1em'}}>Ver todos no CRM →</button>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 6: Agent Performance + Deal Velocity */}
                {(() => {
                  const closedDeals = deals.filter(d => d.fase === 'Escritura Concluída')
                  const totalCommClosed = closedDeals.reduce((s,d) => s + ((parseFloat(d.valor.replace(/[^0-9.]/g,''))||0)*0.05), 0)
                  const ytdTarget = 300000 // €300K commission target 2026
                  const ytdPct = Math.min(100, Math.round(totalCommClosed / ytdTarget * 100))
                  const activePipeline = deals.filter(d => d.fase !== 'Escritura Concluída')
                  const avgDealSize = activePipeline.length ? activePipeline.reduce((s,d)=>s+(parseFloat(d.valor.replace(/[^0-9.]/g,''))||0),0)/activePipeline.length : 0
                  const conversionRate = deals.length ? Math.round(closedDeals.length / deals.length * 100) : 0
                  const zonaStats: Record<string, number> = {}
                  imoveisList.forEach(p => { const z = String(p.zona).split('—')[0].trim(); zonaStats[z] = (zonaStats[z]||0) + 1 })
                  const topZonas = Object.entries(zonaStats).sort((a,b)=>b[1]-a[1]).slice(0,5)
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'28px'}}>
                      {/* Goal Tracker */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>🎯 Objectivo 2026</div>
                        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'10px'}}>
                          <div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#1c4a35',lineHeight:1}}>€{Math.round(totalCommClosed/1000)}K</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',marginTop:'4px'}}>Comissão recebida 2026</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.6rem',fontWeight:700,color:ytdPct>=80?'#10b981':ytdPct>=50?'#c9a96e':'rgba(14,14,13,.4)'}}>{ytdPct}%</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)'}}>meta €{Math.round(ytdTarget/1000)}K</div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{height:'8px',background:'rgba(14,14,13,.08)',borderRadius:'4px',overflow:'hidden',marginBottom:'14px',position:'relative'}}>
                          <div style={{height:'100%',borderRadius:'4px',background:`linear-gradient(90deg,#1c4a35,#c9a96e)`,width:`${ytdPct}%`,transition:'width .6s'}}/>
                          {[25,50,75].map(mark => (
                            <div key={mark} style={{position:'absolute',top:0,bottom:0,left:`${mark}%`,width:'1px',background:'rgba(255,255,255,.4)'}}/>
                          ))}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
                          {[
                            { label:'Deals Fechados', val:String(closedDeals.length), color:'#1c4a35' },
                            { label:'Conversão', val:`${conversionRate}%`, color:'#c9a96e' },
                            { label:'Avg Deal Size', val:`€${(avgDealSize/1e6).toFixed(1)}M`, color:'#4a9c7a' },
                          ].map(k => (
                            <div key={k.label} style={{textAlign:'center',padding:'10px 6px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.06)'}}>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:k.color,lineHeight:1}}>{k.val}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',marginTop:'4px',letterSpacing:'.06em'}}>{k.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:'12px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)'}}>
                          Restam €{Math.round(Math.max(0,ytdTarget-totalCommClosed)/1000)}K para meta 2026 · {Math.max(0,Math.round((ytdTarget-totalCommClosed)/(ytdTarget/12)))} meses
                        </div>
                      </div>

                      {/* Portfolio Distribution */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>📍 Distribuição Portfólio</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
                          {topZonas.map(([zona, count]) => {
                            const pct = Math.round(count / imoveisList.length * 100)
                            const totalVal = imoveisList.filter(p=>String(p.zona).startsWith(zona)).reduce((s,p)=>s+Number(p.preco),0)
                            return (
                              <div key={zona} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.55)',width:'80px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{zona}</div>
                                <div style={{flex:1,height:'6px',background:'rgba(14,14,13,.06)',borderRadius:'3px',overflow:'hidden'}}>
                                  <div style={{height:'100%',background:'linear-gradient(90deg,#1c4a35,#4a9c7a)',width:`${pct}%`,borderRadius:'3px'}}/>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',minWidth:'28px',textAlign:'right'}}>{count}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#c9a96e',minWidth:'48px',textAlign:'right'}}>€{(totalVal/1e6).toFixed(1)}M</div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                          {[
                            { label:'Total Imóveis', val:String(imoveisList.length), color:'#1c4a35' },
                            { label:'Portfolio Total', val:`€${(imoveisList.reduce((s,p)=>s+Number(p.preco),0)/1e6).toFixed(1)}M`, color:'#c9a96e' },
                          ].map(k => (
                            <div key={k.label} style={{textAlign:'center',padding:'10px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.06)'}}>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:k.color,lineHeight:1}}>{k.val}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',marginTop:'4px'}}>{k.label}</div>
                            </div>
                          ))}
                        </div>
                        <button onClick={()=>setSection('imoveis')} style={{marginTop:'12px',width:'100%',background:'none',border:'1px solid rgba(14,14,13,.1)',color:'rgba(14,14,13,.45)',padding:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',letterSpacing:'.1em',transition:'all .2s'}}
                          onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#1c4a35';(e.currentTarget as HTMLButtonElement).style.color='#1c4a35'}}
                          onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(14,14,13,.1)';(e.currentTarget as HTMLButtonElement).style.color='rgba(14,14,13,.45)'}}>
                          Gestão do Portfólio →
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 7: Pipeline Velocity + Market Intelligence */}
                {(() => {
                  const fases = ['Angariação','Proposta','Negociação','CPCV','Escritura Concluída']
                  const faseColors = ['#6366f1','#3b82f6','#f59e0b','#10b981','#c9a96e']
                  const faseCounts = fases.map(f => deals.filter(d => d.fase === f).length)
                  const maxCount = Math.max(1, ...faseCounts)
                  // Avg days per stage (simulated from deal data)
                  const faseAvgDays = [14, 21, 18, 45, 30]
                  const marketZonas = [
                    { zona:'Lisboa', price:5000, trend:+3.2 },
                    { zona:'Cascais', price:4713, trend:+2.8 },
                    { zona:'Algarve', price:3941, trend:+4.1 },
                    { zona:'Porto', price:3643, trend:+2.1 },
                    { zona:'Madeira', price:3760, trend:+5.3 },
                    { zona:'Comporta', price:8500, trend:+6.7 },
                  ]
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'28px'}}>
                      {/* Pipeline Velocity */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>⚡ Pipeline Velocity</div>
                        <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>Deals por fase · tempo médio estimado</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                          {fases.map((fase, i) => {
                            const count = faseCounts[i]
                            const pct = Math.round(count / maxCount * 100)
                            return (
                              <div key={fase} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',width:'88px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{fase}</div>
                                <div style={{flex:1,height:'20px',background:'rgba(14,14,13,.04)',borderRadius:'2px',overflow:'hidden',position:'relative'}}>
                                  <div style={{height:'100%',background:faseColors[i],width:`${Math.max(pct,4)}%`,borderRadius:'2px',opacity:.85,transition:'width .5s'}}/>
                                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',paddingLeft:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.6)',fontWeight:700}}>{count} deal{count!==1?'s':''}</div>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',width:'42px',textAlign:'right',flexShrink:0}}>~{faseAvgDays[i]}d</div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{marginTop:'14px',padding:'10px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.06)',display:'flex',gap:'16px'}}>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#1c4a35',lineHeight:1}}>{faseAvgDays.reduce((s,d)=>s+d,0)}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>dias angariação→escritura</div>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e',lineHeight:1}}>{deals.filter(d=>d.fase!=='Escritura Concluída').length}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>deals activos agora</div>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#4a9c7a',lineHeight:1}}>€{Math.round(deals.filter(d=>d.fase!=='Escritura Concluída').reduce((s,d)=>s+(parseFloat(d.valor.replace(/[^0-9.]/g,''))||0),0)*0.05/1000)}K</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>comissão pipeline</div>
                          </div>
                        </div>
                      </div>

                      {/* Market Intelligence */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>📈 Market Intelligence</div>
                        <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>Preços médios €/m² · Q1 2026 · INE/AT</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
                          {marketZonas.map(z => {
                            const barPct = Math.round(z.price / 10000 * 100)
                            const isPos = z.trend > 0
                            return (
                              <div key={z.zona} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.55)',width:'72px',flexShrink:0}}>{z.zona}</div>
                                <div style={{flex:1,height:'5px',background:'rgba(14,14,13,.06)',borderRadius:'3px',overflow:'hidden'}}>
                                  <div style={{height:'100%',background:`linear-gradient(90deg,#1c4a35,#4a9c7a)`,width:`${barPct}%`,borderRadius:'3px'}}/>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.6)',width:'52px',textAlign:'right',flexShrink:0}}>€{z.price.toLocaleString('pt-PT')}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:isPos?'#10b981':'#e05454',width:'36px',textAlign:'right',flexShrink:0}}>{isPos?'↑':'↓'}{Math.abs(z.trend)}%</div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{padding:'10px',background:'rgba(201,169,110,.04)',border:'1px solid rgba(201,169,110,.12)'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em'}}>MERCADO NACIONAL 2026</div>
                          <div style={{display:'flex',gap:'12px',flexWrap:'wrap' as const}}>
                            {[['€3.076/m²','Mediana PT'],['+17,6%','YoY'],[`169.812`,'Transacções'],['210d','Tempo Médio']].map(([v,l])=>(
                              <div key={l} style={{textAlign:'center'}}>
                                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1rem',color:'#c9a96e',lineHeight:1}}>{v}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 8: Revenue Forecast + Hot Leads Radar */}
                {(() => {
                  // Pipeline probability by stage
                  const stageProbability: Record<string,number> = {
                    'Angariação': 0.10, 'Proposta': 0.30, 'Negociação': 0.55,
                    'CPCV': 0.80, 'Escritura Concluída': 1.00
                  }
                  // Weighted expected commissions
                  const expectedComm = deals.reduce((s,d) => {
                    const val = parseFloat(d.valor.replace(/[^0-9.]/g,''))||0
                    const prob = stageProbability[d.fase] || 0
                    return s + val * 0.05 * prob
                  }, 0)
                  // Horizon scenarios
                  const horizons = [
                    { label:'3M', months:3, multiplier:0.35, color:'#4a9c7a' },
                    { label:'6M', months:6, multiplier:0.65, color:'#1c4a35' },
                    { label:'12M', months:12, multiplier:1.00, color:'#c9a96e' },
                  ]
                  const maxForecast = expectedComm * 1.2
                  // Hot leads: contacts with high score + recent activity
                  const hotLeads = crmContacts
                    .map(c => {
                      const ls = computeLeadScore(c)
                      const dSince = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : 999
                      const urgency = (ls.score + Math.max(0,30-dSince)*2 + (c.nextFollowUp && c.nextFollowUp <= new Date().toISOString().split('T')[0] ? 20 : 0))
                      return { ...c, ls, urgency }
                    })
                    .filter(c => c.ls.score >= 50)
                    .sort((a,b) => b.urgency - a.urgency)
                    .slice(0, 5)
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'28px'}}>
                      {/* Revenue Forecast */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>💰 Forecast de Receita</div>
                        <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>Comissão esperada por probabilidade de fecho</div>
                        <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'#1c4a35',lineHeight:1,marginBottom:'4px'}}>€{Math.round(expectedComm/1000)}K</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>Comissão ponderada total do pipeline</div>
                        {/* Horizon bars */}
                        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                          {horizons.map(h => {
                            const forecast = expectedComm * h.multiplier
                            const barPct = Math.round(forecast / Math.max(maxForecast,1) * 100)
                            return (
                              <div key={h.label} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',width:'24px',flexShrink:0}}>{h.label}</div>
                                <div style={{flex:1,height:'24px',background:'rgba(14,14,13,.04)',borderRadius:'2px',overflow:'hidden',position:'relative'}}>
                                  <div style={{height:'100%',background:h.color,width:`${barPct}%`,borderRadius:'2px',opacity:.85,transition:'width .5s'}}/>
                                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',paddingLeft:'10px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.7)',fontWeight:700}}>€{Math.round(forecast/1000)}K</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Stage breakdown */}
                        <div style={{borderTop:'1px solid rgba(14,14,13,.06)',paddingTop:'10px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',marginBottom:'8px',letterSpacing:'.08em'}}>PROBABILIDADE POR FASE</div>
                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap' as const}}>
                            {Object.entries(stageProbability).map(([fase,prob]) => (
                              <div key={fase} style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',padding:'2px 7px',background:'rgba(14,14,13,.04)',border:'1px solid rgba(14,14,13,.08)',color:'rgba(14,14,13,.45)'}}>
                                {fase.split(' ')[0]} {Math.round(prob*100)}%
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Hot Leads Radar */}
                      <div className="p-card">
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>🔥 Hot Leads Radar</div>
                        <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(14,14,13,.35)',marginBottom:'14px'}}>Contactos com maior urgência de acção</div>
                        {hotLeads.length === 0 ? (
                          <div style={{padding:'24px',textAlign:'center' as const,color:'rgba(14,14,13,.3)',fontFamily:"'Jost',sans-serif",fontSize:'.8rem'}}>Sem leads quentes no pipeline</div>
                        ) : (
                          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                            {hotLeads.map((c,i) => {
                              const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['lead']
                              const initials3 = c.name.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()
                              const dSince = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : null
                              const isOverdue2 = c.nextFollowUp && c.nextFollowUp <= new Date().toISOString().split('T')[0]
                              return (
                                <div key={c.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px',background:i===0?'rgba(201,169,110,.06)':'rgba(14,14,13,.02)',border:`1px solid ${i===0?'rgba(201,169,110,.2)':'rgba(14,14,13,.06)'}`,cursor:'pointer'}}
                                  onClick={()=>{setActiveCrmId(c.id);setCrmProfileTab('overview');setSection('crm')}}>
                                  <div style={{width:'28px',height:'28px',borderRadius:'50%',background:sc.avatar,color:sc.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'.45rem',fontWeight:700,flexShrink:0}}>{initials3}</div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontWeight:500,fontSize:'.83rem',color:'#0e0e0d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{c.name}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>€{((Number(c.budgetMax)||0)/1e6).toFixed(1)}M · {c.ls.label} {c.ls.score}</div>
                                  </div>
                                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px',flexShrink:0}}>
                                    {isOverdue2 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#e05454',background:'rgba(224,84,84,.08)',padding:'2px 5px'}}>FOLLOW-UP</div>}
                                    {dSince !== null && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:dSince>7?'#f97316':dSince>3?'#f59e0b':'#10b981'}}>{dSince}d</div>}
                                    <button style={{background:'#25d366',border:'none',color:'#fff',width:'22px',height:'22px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',borderRadius:'50%',fontSize:'.7rem'}} onClick={e=>{e.stopPropagation();if(c.phone)window.open(`https://wa.me/${c.phone.replace(/\D/g,'')}`)}}>💬</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <button onClick={()=>setSection('crm')} style={{marginTop:'12px',width:'100%',background:'none',border:'1px solid rgba(14,14,13,.1)',color:'rgba(14,14,13,.45)',padding:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',letterSpacing:'.1em'}}>
                          Ver todos no CRM →
                        </button>
                      </div>
                    </div>
                  )
                })()}

                </div>
              </div>
            )}

            {/* ── AVM ── */}
            {section==='avm' && (
              <div style={{maxWidth:'960px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>5 Metodologias RICS · INE/AT Q1 2026 · Todo Portugal + Ilhas</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'24px'}}>Avaliação <em style={{color:'#1c4a35'}}>Automática</em></div>

                {/* ─ FORM ─ */}
                <div className="p-card" style={{marginBottom:'16px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Características do imóvel</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                    <div>
                      <label className="p-label">Zona / Localização</label>
                      <select className="p-sel" value={avmZona} onChange={e=>setAvmZona(e.target.value)}>
                        <optgroup label="─ Lisboa ─">
                          {['Lisboa','Lisboa — Chiado','Lisboa — Príncipe Real','Lisboa — Bairro Alto','Lisboa — Estrela / Lapa','Lisboa — Santos','Lisboa — Alfama / Mouraria','Lisboa — Campo de Ourique','Lisboa — Avenidas Novas','Lisboa — Alvalade','Lisboa — Parque das Nações','Lisboa — Belém / Restelo','Lisboa — Beato / Marvila','Lisboa — Intendente','Lisboa — Alcântara','Lisboa — Benfica','Lisboa — Areeiro / Roma'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Cascais / Sintra ─">
                          {['Oeiras','Cascais','Cascais — Centro','Cascais — Quinta da Marinha','Cascais — Birre / Areia','Estoril','Sintra','Sintra — Centro Histórico','Ericeira','Mafra'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Porto ─">
                          {['Porto','Porto — Foz do Douro','Porto — Boavista','Porto — Bonfim','Porto — Cedofeita','Porto — Ribeira / Miragaia','Porto — Paranhos','Matosinhos','Matosinhos — Mar','Vila Nova de Gaia','Maia'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Algarve ─">
                          {['Algarve','Quinta do Lago','Vale do Lobo','Vilamoura','Loulé / Almancil','Lagos','Portimão','Albufeira','Tavira','Faro','Olhão','Silves','Aljezur / Sudoeste','Sagres / Vila do Bispo'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Alentejo / Comporta ─">
                          {['Comporta','Melides','Costa Vicentina','Grândola','Évora','Beja'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Madeira ─">
                          {['Madeira','Madeira — Funchal','Madeira — Funchal Centro','Madeira — Câmara de Lobos','Madeira — Calheta','Madeira — Ponta do Sol','Madeira — Santa Cruz','Madeira — Machico','Porto Santo'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Açores ─">
                          {['Açores','Açores — Ponta Delgada','Açores — Ribeira Grande','Açores — Angra do Heroísmo','Açores — Horta'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Centro / Norte ─">
                          {['Braga','Braga — Centro','Guimarães','Coimbra','Aveiro','Aveiro — Costa Nova','Leiria','Viseu','Viana do Castelo'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                        <optgroup label="─ Área Met. Lisboa ─">
                          {['Almada / Costa da Caparica','Amadora / Queluz','Loures / Sacavém','Odivelas','Setúbal / Tróia','Palmela / Montijo'].map(z=><option key={z} value={z}>{z}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Tipologia</label>
                      <select className="p-sel" value={avmTipo} onChange={e=>setAvmTipo(e.target.value)}>
                        {['T0','T1','T2','T3','T4','T4+','T5+','Moradia','Moradia em banda','Villa','Penthouse','Herdade','Quinta','Terreno'].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Área Útil (m²)</label>
                      <input type="number" className="p-inp" placeholder="ex: 120" value={avmArea} onChange={e=>setAvmArea(e.target.value)}/>
                    </div>
                    <div>
                      <label className="p-label">Estado</label>
                      <select className="p-sel" value={avmEstado} onChange={e=>setAvmEstado(e.target.value)}>
                        {['Nova Construção','Recém Remodelado','Excelente','Bom','Médio','Para Recuperar','Ruína'].map(e=><option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Certificado Energético</label>
                      <select className="p-sel" value={avmEpc} onChange={e=>setAvmEpc(e.target.value)}>
                        {['A+','A','B','B-','C','D','E','F'].map(e=><option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Vista</label>
                      <select className="p-sel" value={avmVista} onChange={e=>setAvmVista(e.target.value)}>
                        {[['Interior','Interior'],['Jardim','Jardim'],['Cidade','Vista cidade'],['Serra / Montanha','Serra / Montanha'],['Rio / Tejo','Rio / Tejo'],['Marina','Marina'],['Mar / Oceano','Mar / Oceano'],['Mar e Rio','Mar e Rio']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Andar</label>
                      <select className="p-sel" value={avmAndar} onChange={e=>setAvmAndar(e.target.value)}>
                        {[['-1','Cave'],['rc','R/C'],['1-2','1º–2º'],['3-5','3º–5º'],['6+','6º–10º'],['11','11º+']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Orientação Solar</label>
                      <select className="p-sel" value={avmOrientacao} onChange={e=>setAvmOrientacao(e.target.value)}>
                        <option value="">Desconhecida</option>
                        {['Sul','Nascente-Sul','Nascente','Poente-Sul','Poente','Norte','Nascente-Norte'].map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Ano de Construção</label>
                      <input type="number" className="p-inp" placeholder="ex: 2010" value={avmAnoConstr} onChange={e=>setAvmAnoConstr(e.target.value)} min="1800" max="2026"/>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:'12px',marginBottom:'16px'}}>
                    <div>
                      <label className="p-label">Piscina</label>
                      <select className="p-sel" value={avmPiscina} onChange={e=>setAvmPiscina(e.target.value)}>
                        <option value="nao">Sem piscina</option>
                        <option value="condominio">Condomínio</option>
                        <option value="privada">Privada</option>
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Garagem</label>
                      <select className="p-sel" value={avmGaragem} onChange={e=>setAvmGaragem(e.target.value)}>
                        {[['sem','Sem garagem'],['aberta','Lugar exterior'],['fechada','1 lugar fechado'],['2+','2+ lugares']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Terraço / Varanda (m²)</label>
                      <input type="number" className="p-inp" placeholder="0" value={avmTerraco} onChange={e=>setAvmTerraco(e.target.value)} min="0"/>
                    </div>
                    <div>
                      <label className="p-label">Casas de Banho</label>
                      <select className="p-sel" value={avmCasasBanho} onChange={e=>setAvmCasasBanho(e.target.value)}>
                        {['1','2','3','4+'].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="p-label">Uso Previsto</label>
                      <select className="p-sel" value={avmUso} onChange={e=>setAvmUso(e.target.value)}>
                        <option value="habitacao">Habitação Própria</option>
                        <option value="investimento">Investimento / Arrendamento</option>
                        <option value="turistico">Turístico / AL</option>
                      </select>
                    </div>
                  </div>
                  <button className="p-btn" onClick={runAVM} disabled={avmLoading} style={{width:'100%',padding:'14px',fontSize:'.62rem',letterSpacing:'.14em'}}>
                    {avmLoading ? '⟳  A calcular valor de mercado...' : '▶  Calcular Valor de Mercado'}
                  </button>
                </div>

                {/* ─ RESULTS ─ */}
                {avmResult !== null && (() => {
                  const r = avmResult as Record<string,unknown>
                  const estimativa = Number(r.estimativa)||0
                  const rangeMin = Number(r.rangeMin)||0
                  const rangeMax = Number(r.rangeMax)||0
                  const pm2Val = Number(r.pm2)||0
                  const pm2zona = Number(r.pm2_zona)||0
                  const score = Number(r.score_confianca)||0
                  const fatores = (r.fatores as Array<{label:string;impacto:string;positivo:boolean}>)||[]
                  const mets = (r.metodologias as Array<{label:string;valor:number;peso:number;descricao:string}>)||[]
                  const inv = (r.investimento as Record<string,number>)||{}
                  const merc = (r.mercado as Record<string,unknown>)||{}
                  const comps = (r.comparaveis as Array<Record<string,unknown>>)||[]
                  const confianca = String(r.confianca||'média')
                  const confColor = confianca==='alta'?'#22c55e':confianca==='média'?'#f59e0b':'#ef4444'

                  const maxMetVal = Math.max(...mets.map(m=>m.valor))

                  return (
                    <div>
                      {/* ── HEADLINE ── */}
                      <div className="p-card" style={{background:'#0c1f15',marginBottom:'12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'16px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(201,169,110,.55)',marginBottom:'6px'}}>Valor de Mercado Estimado</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'3.2rem',fontWeight:300,color:'#c9a96e',lineHeight:1}}>{String(r.formatted&&(r.formatted as Record<string,string>).estimativa||`€${estimativa.toLocaleString('pt-PT')}`)}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(244,240,230,.45)',marginTop:'8px'}}>
                              Intervalo: <span style={{color:'rgba(244,240,230,.75)'}}>€{rangeMin.toLocaleString('pt-PT')} – €{rangeMax.toLocaleString('pt-PT')}</span>
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(201,169,110,.5)',marginTop:'4px'}}>{String(r.premium_discount||'')}</div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(255,255,255,.05)',borderRadius:'8px',padding:'10px 16px'}}>
                              <div style={{width:'36px',height:'36px',borderRadius:'50%',border:`3px solid ${confColor}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'.58rem',fontWeight:700,color:confColor}}>{score}</div>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.4)',letterSpacing:'.1em',textTransform:'uppercase'}}>Confiança</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.56rem',color:confColor,fontWeight:600,textTransform:'capitalize'}}>{confianca}</div>
                              </div>
                            </div>
                            <div style={{textAlign:'right',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.35)'}}>
                              <div>€{pm2Val.toLocaleString('pt-PT')}/m² estimado</div>
                              <div>€{pm2zona.toLocaleString('pt-PT')}/m² mediana zona</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── METRICS ROW ── */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'12px'}}>
                        {[
                          ['Renda Estimada', `€${(inv.renda_mensal_estimada||0).toLocaleString('pt-PT')}/mês`, '#c9a96e'],
                          ['Yield Bruto', `${(inv.yield_bruta_pct||0).toFixed(2)}%`, '#22c55e'],
                          ['Yield Líquido', `${(inv.yield_liquida_pct||0).toFixed(2)}%`, '#86efac'],
                          ['Liquidez Zona', String(merc.liquidez||'—'), '#60a5fa'],
                          ['Dias Mercado', `${merc.days_market||'—'} dias`, '#c9a96e'],
                          ['Trend YoY', `+${merc.trend_yoy_pct||0}%`, '#22c55e'],
                          ['ROI 5 Anos', `+${inv.roi_5anos_pct||0}%`, '#86efac'],
                          ['ROI 10 Anos', `+${inv.roi_10anos_pct||0}%`, '#60a5fa'],
                        ].map(([l,v,c])=>(
                          <div key={String(l)} style={{background:'rgba(28,74,53,.12)',border:'1px solid rgba(28,74,53,.25)',borderRadius:'8px',padding:'12px 14px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>{l}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.68rem',fontWeight:600,color:String(c)}}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── METODOLOGIAS + FATORES ── */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                        {/* Metodologias */}
                        <div className="p-card">
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>5 Metodologias RICS</div>
                          {mets.map((m,i)=>{
                            const barPct = maxMetVal>0 ? Math.round((m.valor/maxMetVal)*100) : 50
                            const isWeighted = i===0
                            return (
                              <div key={m.label} style={{marginBottom:'12px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'4px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.7)',fontWeight:isWeighted?600:400}}>{m.label}</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#1c4a35',fontWeight:600}}>€{m.valor.toLocaleString('pt-PT')}</span>
                                </div>
                                <div style={{background:'rgba(28,74,53,.1)',borderRadius:'3px',height:'4px',overflow:'hidden'}}>
                                  <div style={{width:`${barPct}%`,height:'100%',background:isWeighted?'#c9a96e':'#1c4a35',borderRadius:'3px',transition:'width .5s'}}/>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{m.descricao} · {Math.round(m.peso*100)}% peso</div>
                              </div>
                            )
                          })}
                          <div style={{borderTop:'1px solid rgba(14,14,13,.08)',paddingTop:'10px',marginTop:'4px'}}>
                            <div style={{display:'flex',justifyContent:'space-between'}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.5)',letterSpacing:'.08em',textTransform:'uppercase'}}>Média Ponderada</span>
                              <span style={{fontFamily:"'Cormorant',serif",fontSize:'.9rem',fontWeight:600,color:'#1c4a35'}}>€{estimativa.toLocaleString('pt-PT')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Fatores */}
                        <div className="p-card">
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Factores de Ajustamento</div>
                          {fatores.length === 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.35)'}}>Sem ajustamentos adicionais.</div>}
                          {fatores.map((f,i)=>(
                            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid rgba(14,14,13,.06)'}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.65)',flex:1,paddingRight:'8px'}}>{f.label}</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',fontWeight:600,color:f.positivo?'#1c4a35':'#dc2626',minWidth:'40px',textAlign:'right'}}>{f.impacto}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── INVESTMENT + APPRECIATION ── */}
                      <div className="p-card" style={{marginBottom:'12px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Análise de Investimento</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em',textTransform:'uppercase'}}>Cenário Arrendamento</div>
                            {[
                              ['Renda mensal est.', `€${(inv.renda_mensal_estimada||0).toLocaleString('pt-PT')}`],
                              ['Renda anual', `€${(inv.renda_anual||0).toLocaleString('pt-PT')}`],
                              ['Custos anuais (IMI+cond)', `€${(inv.custos_anuais||0).toLocaleString('pt-PT')}`],
                              ['Renda líquida anual', `€${(inv.renda_liquida_anual||0).toLocaleString('pt-PT')}`],
                              ['Yield bruta', `${(inv.yield_bruta_pct||0).toFixed(2)}%`],
                              ['Yield líquida', `${(inv.yield_liquida_pct||0).toFixed(2)}%`],
                            ].map(([l,v])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,color:'#1c4a35'}}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em',textTransform:'uppercase'}}>Valorização Projetada</div>
                            {[
                              ['Valor actual', `€${estimativa.toLocaleString('pt-PT')}`],
                              ['Valor em 5 anos', `€${(inv.valor_5anos||0).toLocaleString('pt-PT')}`],
                              ['Valor em 10 anos', `€${(inv.valor_10anos||0).toLocaleString('pt-PT')}`],
                              ['ROI total 5 anos', `+${inv.roi_5anos_pct||0}%`],
                              ['ROI total 10 anos', `+${inv.roi_10anos_pct||0}%`],
                              ['Trend YoY zona', `+${merc.trend_yoy_pct||0}%`],
                            ].map(([l,v])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,color:'#c9a96e'}}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em',textTransform:'uppercase'}}>Crédito Habitação (est.)</div>
                            {[
                              ['Valor imóvel', `€${estimativa.toLocaleString('pt-PT')}`],
                              ['Entrada 30%', `€${Math.round(estimativa*0.30).toLocaleString('pt-PT')}`],
                              ['Capital em dívida', `€${Math.round(estimativa*0.70).toLocaleString('pt-PT')}`],
                              ['Euribor 6M actual', `${inv.euribor_6m||2.95}%`],
                              ['Prestação est. (30a)', inv.prestacao_credito_estimada ? `€${(inv.prestacao_credito_estimada||0).toLocaleString('pt-PT')}/mês` : '—'],
                              ['IMI anual est.', `€${(inv.imi_anual||0).toLocaleString('pt-PT')}`],
                            ].map(([l,v])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,color:'#60a5fa'}}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── COMPARÁVEIS ── */}
                      {comps.length > 0 && (
                        <div className="p-card" style={{marginBottom:'12px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Comparáveis de Mercado (Sintéticos)</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                            {comps.map((c,i)=>(
                              <div key={i} style={{background:'rgba(28,74,53,.06)',border:'1px solid rgba(28,74,53,.15)',borderRadius:'8px',padding:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#1c4a35',fontWeight:600,marginBottom:'6px'}}>{String(c.ref||'')}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',marginBottom:'4px'}}>{String(c.tipo||'')} · {Number(c.area||0)}m² · {String(c.andar||'')}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)',marginBottom:'8px'}}>{String(c.estado||'')} · {Number(c.meses_mercado||0)}m mercado</div>
                                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',fontWeight:600,color:'#1c4a35'}}>€{Number(c.valor||0).toLocaleString('pt-PT')}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)'}}>€{Number(c.pm2||0).toLocaleString('pt-PT')}/m²</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── PRICE FORECAST ── */}
                      {(() => {
                        const trendYoY = merc.trend_yoy_pct || 4.5
                        const monthlyRate = Math.pow(1 + trendYoY/100, 1/12) - 1
                        const f3m  = Math.round(estimativa * Math.pow(1+monthlyRate, 3))
                        const f6m  = Math.round(estimativa * Math.pow(1+monthlyRate, 6))
                        const f12m = Math.round(estimativa * Math.pow(1+monthlyRate, 12))
                        const g3m  = ((f3m-estimativa)/estimativa*100).toFixed(1)
                        const g6m  = ((f6m-estimativa)/estimativa*100).toFixed(1)
                        const g12m = ((f12m-estimativa)/estimativa*100).toFixed(1)
                        return (
                          <div className="p-card" style={{marginBottom:'12px',background:'linear-gradient(135deg,rgba(12,31,21,.04) 0%,rgba(201,169,110,.04) 100%)',border:'1px solid rgba(201,169,110,.18)'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Previsão de Preço · Property Finder Style</div>
                                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d'}}>Evolução Estimada <em style={{color:'#1c4a35'}}>do Valor</em></div>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',textAlign:'right'}}>Baseado em trend YoY<br/>{avmZona}: +{trendYoY}%/ano</div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'16px'}}>
                              {[
                                {label:'+3 Meses',val:f3m,gain:g3m,color:'#22c55e'},
                                {label:'+6 Meses',val:f6m,gain:g6m,color:'#16a34a'},
                                {label:'+12 Meses',val:f12m,gain:g12m,color:'#c9a96e'},
                              ].map(item=>(
                                <div key={item.label} style={{background:'rgba(255,255,255,.6)',border:'1px solid rgba(28,74,53,.12)',borderRadius:'8px',padding:'14px 16px',textAlign:'center'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px'}}>{item.label}</div>
                                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',fontWeight:600,color:item.color,lineHeight:1,marginBottom:'6px'}}>€{item.val.toLocaleString('pt-PT')}</div>
                                  <div style={{display:'inline-flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,.1)',border:`1px solid ${item.color}30`,borderRadius:'20px',padding:'2px 8px'}}>
                                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:700,color:item.color}}>+{item.gain}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Visual bar chart */}
                            <div style={{display:'flex',alignItems:'flex-end',gap:'6px',height:'40px',marginBottom:'8px'}}>
                              {[
                                {val:estimativa,label:'Hoje',color:'rgba(28,74,53,.3)'},
                                {val:f3m,label:'+3M',color:'#22c55e'},
                                {val:f6m,label:'+6M',color:'#16a34a'},
                                {val:f12m,label:'+12M',color:'#c9a96e'},
                              ].map((bar,i)=>{
                                const maxVal = f12m
                                const pct = Math.round((bar.val/maxVal)*100)
                                return (
                                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
                                    <div style={{width:'100%',height:`${pct}%`,background:bar.color,borderRadius:'3px 3px 0 0',minHeight:'4px',transition:'height .5s ease'}}/>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(14,14,13,.35)',textAlign:'center'}}>{bar.label}</div>
                                  </div>
                                )
                              })}
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.25)',marginTop:'4px'}}>
                              * Projeção baseada em dados INE/AT Q1 2026 e tendência histórica da zona. Não constitui garantia de valor.
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── ACTIONS ── */}
                      <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                        <button className="p-btn p-btn-gold" onClick={()=>window.open(`https://wa.me/351919948986?text=${encodeURIComponent(`🏠 Avaliação AVM — Agency Group\n\nZona: ${avmZona}\nTipologia: ${avmTipo} · ${avmArea}m²\nEstado: ${avmEstado}\n\n💰 VALOR ESTIMADO: €${estimativa.toLocaleString('pt-PT')}\nIntervalo: €${rangeMin.toLocaleString('pt-PT')} – €${rangeMax.toLocaleString('pt-PT')}\n€${pm2Val.toLocaleString('pt-PT')}/m²\n\nYield: ${(inv.yield_bruta_pct||0).toFixed(2)}% bruto · ${(inv.yield_liquida_pct||0).toFixed(2)}% líquido\nConfiança: ${confianca.toUpperCase()} (${score}/100)\n\n5 Metodologias RICS · INE/AT Q1 2026\nAgency Group · AMI 22506`)}`, '_blank')}>
                          WhatsApp Relatório
                        </button>
                        <button className="p-btn" style={{background:'transparent',color:'#1c4a35',border:'1px solid #1c4a35'}} onClick={()=>{setAvmResult(null)}}>
                          Nova Avaliação
                        </button>
                        <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',display:'flex',alignItems:'center'}}>
                          {String(r.fonte||'')}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── RADAR ── */}
            {section==='radar' && (
              <div style={{maxWidth:'1100px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>20 Dimensões · INE/AT Q1 2026 · Euribor Live · Leilões · Banca · Todo Portugal + Ilhas</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'16px'}}>Deal Radar <em style={{color:'#1c4a35'}}>Portugal</em></div>

                {/* ── MODE TOGGLE ── */}
                <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
                  {[{id:'url',label:'🔍 Analisar Imóvel',sub:'URL ou descrição manual'},{id:'search',label:'🚀 Escolhas do Dia',sub:'Busca nacional automática + PDF'}].map(m=>(
                    <button key={m.id} onClick={()=>setRadarMode(m.id as 'url'|'search')} style={{flex:1,padding:'12px 16px',borderRadius:'8px',border:`2px solid ${radarMode===m.id?'#1c4a35':'rgba(14,14,13,.12)'}`,background:radarMode===m.id?'rgba(28,74,53,.08)':'transparent',cursor:'pointer',textAlign:'left',transition:'all .2s'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',fontWeight:700,color:radarMode===m.id?'#1c4a35':'rgba(14,14,13,.5)'}}>{m.label}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{m.sub}</div>
                    </button>
                  ))}
                </div>

                {/* ── SEARCH MODE: ESCOLHAS DO DIA ── */}
                {radarMode==='search' && (
                  <div>
                    <div className="p-card" style={{marginBottom:'16px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>🔎 Parâmetros de Busca Nacional</div>
                      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:'12px',marginBottom:'14px'}}>
                        <div>
                          <label className="p-label">Zona / Região</label>
                          <select className="p-sel" value={searchZona} onChange={e=>setSearchZona(e.target.value)}>
                            {['Nacional','Lisboa','Lisboa — Chiado/Santos','Lisboa — Parque das Nações','Lisboa — Beato/Marvila','Cascais','Cascais — Centro','Oeiras','Estoril','Sintra','Ericeira','Porto','Porto — Foz/Nevogilde','Porto — Boavista','Porto — Bonfim/Campanhã','Porto — Ribeira/Miragaia','Matosinhos','Matosinhos — Mar','Vila Nova de Gaia','Algarve','Lagos','Albufeira','Vilamoura','Quinta do Lago','Comporta','Braga','Coimbra','Aveiro','Madeira — Funchal','Madeira — Funchal Centro','Madeira — Calheta','Açores — Ponta Delgada'].map(z=><option key={z}>{z}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="p-label">Preço Mín (€)</label>
                          <input className="p-inp" type="number" placeholder="50000" value={searchPrecoMin} onChange={e=>setSearchPrecoMin(e.target.value)}/>
                        </div>
                        <div>
                          <label className="p-label">Preço Máx (€)</label>
                          <input className="p-inp" type="number" placeholder="500000000" value={searchPrecoMax} onChange={e=>setSearchPrecoMax(e.target.value)}/>
                        </div>
                        <div>
                          <label className="p-label">Score Mínimo</label>
                          <select className="p-sel" value={searchScoreMin} onChange={e=>setSearchScoreMin(e.target.value)}>
                            {[['50','≥50 — Todos'],['60','≥60 — Valor Justo+'],['65','≥65 — Bom+'],['75','≥75 — Prioritário+'],['85','≥85 — Top Deals']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Tipos de Imóvel */}
                      <div style={{marginBottom:'14px'}}>
                        <label className="p-label">Tipos de Imóvel</label>
                        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'6px'}}>
                          {[
                            {id:'apartamento', label:'🏢 Apartamento', color:'#1c4a35'},
                            {id:'moradia',     label:'🏡 Moradia',     color:'#2563eb'},
                            {id:'terreno',     label:'🌍 Terreno/Lote',color:'#92400e'},
                            {id:'quinta',      label:'🌿 Quinta/Herdade',color:'#065f46'},
                            {id:'comercial',   label:'🏪 Comercial/Escritório',color:'#7c3aed'},
                            {id:'edificio',    label:'🏗️ Edifício Inteiro',color:'#dc2626'},
                            {id:'hotel',       label:'🏨 Hotel/Turismo',color:'#0369a1'},
                          ].map(({id,label,color})=>(
                            <label key={id} style={{display:'flex',alignItems:'center',gap:'5px',cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'.40rem',padding:'4px 8px',borderRadius:'6px',border:`1px solid ${searchTipos.includes(id)?color:'rgba(14,14,13,.12)'}`,background:searchTipos.includes(id)?`${color}15`:'transparent',transition:'all .15s'}}>
                              <input type="checkbox" checked={searchTipos.includes(id)} onChange={e=>setSearchTipos(prev=>e.target.checked?[...prev,id]:prev.filter(t=>t!==id))} style={{accentColor:color}}/>
                              <span style={{color:searchTipos.includes(id)?color:'rgba(14,14,13,.45)',fontWeight:searchTipos.includes(id)?600:400}}>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Fontes */}
                      <div style={{marginBottom:'14px'}}>
                        <label className="p-label">Fontes de Dados</label>
                        <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'6px'}}>
                          {[{id:'idealista',label:'Idealista',color:'#ef4444'},{id:'imovirtual',label:'Imovirtual',color:'#f59e0b'},{id:'casasapo',label:'Casa Sapo',color:'#f97316'},{id:'supercasa',label:'Supercasa',color:'#16a34a'},{id:'eleiloes',label:'🔨 e-Leilões',color:'#dc2626'},{id:'banca',label:'🏦 Banca',color:'#2563eb'},{id:'rightmove',label:'Rightmove',color:'#1d4ed8'}].map(({id,label,color})=>(
                            <label key={id} style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.7)'}}>
                              <input type="checkbox" checked={searchFontes.includes(id)} onChange={e=>setSearchFontes(prev=>e.target.checked?[...prev,id]:prev.filter(f=>f!==id))} style={{accentColor:color}}/>
                              <span style={{color:searchFontes.includes(id)?color:'rgba(14,14,13,.4)',fontWeight:searchFontes.includes(id)?600:400}}>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <button className="p-btn" onClick={runRadarSearch} disabled={searchLoading} style={{width:'100%',padding:'14px',fontSize:'.6rem',letterSpacing:'.12em'}}>
                        {searchLoading ? '⟳  A varrer Portugal... Idealista · Imovirtual · e-Leilões · Banca (30-60s)' : '🚀  Buscar Melhores Deals — Portugal + Madeira + Açores'}
                      </button>
                    </div>

                    {/* SEARCH RESULTS */}
                    {searchResults !== null && (() => {
                      const sr = searchResults as Record<string,unknown>
                      const deals = (sr.results as Record<string,unknown>[]) || []
                      const stats = (sr.stats as Record<string,unknown>) || {}
                      const filtros = { zona: sr.zona, score_min: searchScoreMin, fontes: searchFontes }

                      if (deals.length === 0) return (
                        <div className="p-card" style={{textAlign:'center',padding:'40px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'rgba(14,14,13,.4)'}}>Nenhum deal encontrado com esses critérios. Tenta reduzir o score mínimo ou alargar a zona.</div>
                        </div>
                      )

                      return (
                        <div>
                          {/* Stats bar */}
                          <div style={{display:'flex',gap:'10px',marginBottom:'14px',alignItems:'center',flexWrap:'wrap'}}>
                            <div style={{display:'flex',gap:'8px',flex:1,flexWrap:'wrap'}}>
                              {[
                                [`${deals.length}`, 'Deals Encontrados', '#1c4a35'],
                                [`${Number(stats.avg_score||0)}`, 'Score Médio', '#c9a96e'],
                                [`${Number(stats.leiloes||0)}`, '🔨 Leilões', '#ef4444'],
                                [`${Number(stats.banca||0)}`, '🏦 Banca', '#2563eb'],
                                [`${Number(stats.mercado_livre||0)}`, '🏠 Mercado', '#1c4a35'],
                              ].map(([v,l,c])=>(
                                <div key={String(l)} style={{background:'rgba(28,74,53,.06)',borderRadius:'8px',padding:'8px 14px',textAlign:'center',minWidth:'90px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.9rem',fontWeight:700,color:String(c)}}>{v}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase',letterSpacing:'.08em'}}>{l}</div>
                                </div>
                              ))}
                            </div>
                            <button className="p-btn p-btn-gold" style={{whiteSpace:'nowrap',padding:'10px 18px'}} onClick={()=>gerarPDF(deals,filtros,stats)}>
                              📄 Gerar PDF Relatório
                            </button>
                          </div>

                          {/* Deal cards grid */}
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px'}}>
                            {deals.map((deal, idx)=>{
                              const sc = Number(deal.score||0)
                              const cl = String(deal.classificacao||'')
                              const pr = Number(deal.preco||0)
                              const ar = Number(deal.area||0)
                              const pm2 = Number(deal.pm2||0)
                              const pm2m = Number(deal.pm2_mercado||0)
                              const yB = Number(deal.yield_bruto_pct||0)
                              const desc = Number(deal.desconto_mercado_pct||0)
                              const pl = String(deal.platform||'')
                              const isL = Boolean(deal.is_leilao)
                              const isB = Boolean(deal.is_banca)
                              const scColor = sc>=88?'#16a34a':sc>=78?'#c9a96e':sc>=68?'#2563eb':sc>=55?'rgba(14,14,13,.5)':'#dc2626'
                              return (
                                <div key={idx} style={{border:`1px solid ${isL?'rgba(239,68,68,.3)':isB?'rgba(37,99,235,.25)':'rgba(28,74,53,.15)'}`,borderLeft:`4px solid ${scColor}`,borderRadius:'8px',padding:'14px',background:isL?'rgba(239,68,68,.02)':isB?'rgba(37,99,235,.02)':'white',position:'relative'}}>
                                  {/* Rank + Score */}
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{width:'36px',height:'36px',borderRadius:'50%',border:`3px solid ${scColor}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Mono',monospace",fontSize:'.58rem',fontWeight:700,color:scColor,flexShrink:0}}>
                                        {sc}
                                      </div>
                                      <div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:scColor,fontWeight:600,letterSpacing:'.06em'}}>{cl}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.37rem',color:'rgba(14,14,13,.4)'}}>
                                          {isL?'🔨 LEILÃO':isB?'🏦 BANCA':'🏠 MERCADO'} · {pl}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{textAlign:'right'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.62rem',fontWeight:700,color:'rgba(14,14,13,.85)'}}>{pr>0?`€ ${pr.toLocaleString('pt-PT')}`:'—'}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>{ar>0?`${ar}m² ·`:''} {pm2>0?`€${pm2.toLocaleString('pt-PT')}/m²`:''}</div>
                                    </div>
                                  </div>
                                  {/* Title + Address */}
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.75)',fontWeight:500,marginBottom:'3px',lineHeight:1.4}}>{String(deal.titulo||'').substring(0,70) || '—'}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>{((deal.morada as string) || (deal.zona as string) || '').substring(0,60)}</div>
                                  {/* Metrics row */}
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'5px',marginBottom:'10px'}}>
                                    {([
                                      ['Desc. Mercado', desc>0?`-${desc.toFixed(0)}%`:desc<0?`+${Math.abs(desc).toFixed(0)}%`:'—', desc>10?'#16a34a':desc>0?'#c9a96e':'#dc2626'],
                                      ['Yield', yB>0?`${yB.toFixed(1)}%`:'—', '#2563eb'],
                                      ['€/m² Ref.', pm2m>0?`€${pm2m.toLocaleString('pt-PT')}`:'-', 'rgba(14,14,13,.5)'],
                                      ['YoY', deal.var_yoy?`+${deal.var_yoy}%`:'—', '#16a34a'],
                                    ] as [string,string,string][]).map(([l,v,c])=>(
                                      <div key={String(l)} style={{background:'rgba(14,14,13,.04)',borderRadius:'5px',padding:'5px 6px',textAlign:'center'}}>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',textTransform:'uppercase',marginBottom:'1px'}}>{l}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,color:String(c)}}>{v}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {/* Leilão warning */}
                                  {isL && Boolean(deal.valor_base) && Number(deal.valor_base)>0 && (
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',background:'rgba(239,68,68,.08)',padding:'4px 8px',borderRadius:'4px',color:'#dc2626',marginBottom:'6px'}}>
                                      Base: €{Number(deal.valor_base).toLocaleString('pt-PT')} · {deal.prazo_licitacao?`Prazo: ${String(deal.prazo_licitacao)}`:'Verificar prazo'}
                                    </div>
                                  )}
                                  {/* Banco info */}
                                  {isB && (
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',background:'rgba(37,99,235,.06)',padding:'4px 8px',borderRadius:'4px',color:'#2563eb',marginBottom:'6px'}}>
                                      {String(deal.banco||'Banco')} · Desc. estimado 10-25% · Neg. possível
                                    </div>
                                  )}
                                  {/* ── VALUATION PANEL ─────────────────────── */}
                                  {(() => {
                                    const vm   = Number(deal.valor_mercado||0)
                                    const vc   = Number(deal.valor_conservador||0)
                                    const va   = Number(deal.valor_agressivo||0)
                                    const vvr  = Number(deal.valor_venda_rapida||0)
                                    const vb   = Number(deal.valor_bancario||0)
                                    const pc   = Number(deal.preco_captacao||0)
                                    const pfe  = Number(deal.preco_fecho_estimado||0)
                                    const neg  = Number(deal.desconto_negociacao_pct||0)
                                    const dias = Number(deal.dias_venda_estimados||0)
                                    const conf = Number(deal.confidence_score||0)
                                    const vcomp = Number(deal.valor_comparavel||0)
                                    const vinc  = Number(deal.valor_rendimento||0)
                                    const vcost = Number(deal.valor_custo_residual||0)
                                    const wComp = Number(deal.peso_comp||0)
                                    const wInc  = Number(deal.peso_inc||0)
                                    const wCost = Number(deal.peso_cost||0)
                                    const up   = (deal.drivers_up as string[]|undefined) ?? []
                                    const dn   = (deal.drivers_down as string[]|undefined) ?? []
                                    const ti   = deal.tipo_imovel as string|undefined
                                    const nComp   = Number(deal.comparaveis_reais||0)
                                    const rendaR  = Number(deal.renda_real_m2||0)
                                    // ── Geocodificação + distâncias ─────────────────────────────────────────
                                    const distPraia  = deal.dist_praia_km as number|undefined
                                    const distMetro  = deal.dist_metro_km as number|undefined
                                    const distCentro = deal.dist_centro_km as number|undefined
                                    const distAero   = deal.dist_aeroporto_km as number|undefined
                                    const orientac   = deal.orientacao as string|undefined
                                    // ── Histórico de preços ─────────────────────────────────────────────────
                                    const reducaoPct = Number(deal.preco_reducao_pct||0)
                                    const reducoes   = Number(deal.reducoes_preco||0)
                                    const diasMerc   = deal.dias_mercado as number|undefined
                                    const tendencia  = deal.tendencia_preco as 'down'|'stable'|'up'|undefined
                                    const ceClass = deal.classe_energetica as string|undefined
                                    const estado  = deal.estado_conservacao as string|undefined
                                    const pisoN   = deal.piso as number|undefined
                                    const elevad  = deal.tem_elevador as boolean|undefined
                                    const garag   = deal.tem_garagem as boolean|undefined
                                    const varand  = deal.tem_varanda as boolean|undefined
                                    const piscin  = deal.tem_piscina as boolean|undefined
                                    const tipoLabel: Record<string,string> = {
                                      apartamento:'🏢 Apto', moradia:'🏡 Moradia',
                                      terreno:'🌍 Terreno', quinta:'🌿 Quinta',
                                      comercial:'🏪 Comercial', edificio:'🏗️ Edifício', hotel:'🏨 Hotel',
                                    }
                                    const tipoColor: Record<string,string> = {
                                      apartamento:'#1c4a35', moradia:'#2563eb',
                                      terreno:'#92400e', quinta:'#065f46',
                                      comercial:'#7c3aed', edificio:'#dc2626', hotel:'#0369a1',
                                    }
                                    const capRate = deal.cap_rate_pct as number|undefined
                                    const margem  = deal.margem_promotor_pct as number|undefined
                                    const ppKey   = deal.price_per_key as number|undefined
                                    const gdv     = deal.gdv as number|undefined
                                    const ha      = deal.hectares as number|undefined
                                    const confColor = conf>=75?'#16a34a':conf>=55?'#c9a96e':'#dc2626'
                                    if (!vm) return null
                                    const fmt = (v: number) => v > 0 ? `€${v.toLocaleString('pt-PT')}` : '—'
                                    const fmtM = (v: number) => v >= 1e6 ? `€${(v/1e6).toFixed(2)}M` : v > 0 ? `€${v.toLocaleString('pt-PT')}` : '—'
                                    return (
                                      <div style={{background:'rgba(28,74,53,.03)',border:'1px solid rgba(28,74,53,.12)',borderRadius:'7px',padding:'10px',marginBottom:'8px'}}>
                                        {/* Header */}
                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',textTransform:'uppercase',letterSpacing:'.1em'}}>
                                            {ti ? <span style={{color:tipoColor[ti]||'#1c4a35',fontWeight:700}}>{tipoLabel[ti]||ti} · </span> : null}
                                            Motor Valuation 3 Modelos
                                          </div>
                                          <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:confColor}}>Conf.</div>
                                            <div style={{width:'50px',height:'5px',borderRadius:'3px',background:'rgba(14,14,13,.08)',overflow:'hidden'}}>
                                              <div style={{width:`${conf}%`,height:'100%',background:confColor,borderRadius:'3px',transition:'width .3s'}}/>
                                            </div>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',fontWeight:700,color:confColor}}>{conf}%</div>
                                          </div>
                                        </div>
                                        {/* Main value range */}
                                        <div style={{display:'flex',gap:'6px',marginBottom:'8px',alignItems:'stretch'}}>
                                          <div style={{flex:1,background:'rgba(220,38,38,.06)',borderRadius:'6px',padding:'7px',textAlign:'center'}}>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.29rem',color:'rgba(14,14,13,.35)',marginBottom:'2px'}}>CONSERVADOR</div>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',fontWeight:700,color:'#dc2626'}}>{fmtM(vc)}</div>
                                          </div>
                                          <div style={{flex:1.4,background:'rgba(28,74,53,.08)',border:'1px solid rgba(28,74,53,.2)',borderRadius:'6px',padding:'7px',textAlign:'center'}}>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.29rem',color:'rgba(28,74,53,.5)',marginBottom:'2px',textTransform:'uppercase'}}>Valor Mercado</div>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.54rem',fontWeight:800,color:'#1c4a35'}}>{fmtM(vm)}</div>
                                            {pr > 0 && vm > 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',color:pr<vm?'#16a34a':'#dc2626',marginTop:'1px'}}>{pr<vm?`${Math.round((vm-pr)/vm*100)}% abaixo mercado`:`${Math.round((pr-vm)/vm*100)}% acima mercado`}</div>}
                                          </div>
                                          <div style={{flex:1,background:'rgba(22,163,74,.06)',borderRadius:'6px',padding:'7px',textAlign:'center'}}>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.29rem',color:'rgba(14,14,13,.35)',marginBottom:'2px'}}>AGRESSIVO</div>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',fontWeight:700,color:'#16a34a'}}>{fmtM(va)}</div>
                                          </div>
                                        </div>
                                        {/* Secondary values */}
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',marginBottom:'8px'}}>
                                          {([
                                            ['Venda Rápida','rgba(239,68,68,.08)','#dc2626',fmtM(vvr)],
                                            ['Val. Bancário','rgba(37,99,235,.08)','#2563eb',fmtM(vb)],
                                            ['P. Captação','rgba(201,169,110,.12)','#c9a96e',fmtM(pc)],
                                            ['Fecho Est.','rgba(22,163,74,.08)','#16a34a',fmtM(pfe)],
                                          ] as [string,string,string,string][]).map(([l,bg,c,v])=>(
                                            <div key={l} style={{background:bg,borderRadius:'5px',padding:'5px',textAlign:'center'}}>
                                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.27rem',color:'rgba(14,14,13,.35)',marginBottom:'1px',textTransform:'uppercase'}}>{l}</div>
                                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',fontWeight:700,color:c}}>{v}</div>
                                            </div>
                                          ))}
                                        </div>
                                        {/* Negotiation + Days */}
                                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'8px'}}>
                                          <div style={{background:'rgba(14,14,13,.04)',borderRadius:'5px',padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase'}}>Neg. estimada</span>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',fontWeight:700,color:'#c9a96e'}}>{neg.toFixed(1)}%</span>
                                          </div>
                                          <div style={{background:'rgba(14,14,13,.04)',borderRadius:'5px',padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase'}}>Prazo venda</span>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',fontWeight:700,color:'rgba(14,14,13,.7)'}}>{dias}d</span>
                                          </div>
                                        </div>
                                        {/* 3 Models breakdown */}
                                        {(vcomp > 0 || vinc > 0 || vcost > 0) && (
                                          <div style={{marginBottom:'8px'}}>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',color:'rgba(14,14,13,.3)',textTransform:'uppercase',marginBottom:'4px',letterSpacing:'.08em'}}>Reconciliação · Comparáveis {Math.round(wComp*100)}% · Rendimento {Math.round(wInc*100)}% · Custo/Residual {Math.round(wCost*100)}%</div>
                                            {[[vcomp,wComp,'Comp.','#2563eb'],[vinc,wInc,'Income','#7c3aed'],[vcost,wCost,'Custo/Res.','#c9a96e']].filter(r=>Number(r[0])>0).map(([v,w,l,c])=>(
                                              <div key={String(l)} style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}>
                                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:String(c),width:'55px',flexShrink:0}}>{String(l)}</div>
                                                <div style={{flex:1,height:'4px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden'}}>
                                                  <div style={{width:`${Math.round(Number(w)*100)}%`,height:'100%',background:String(c),borderRadius:'2px'}}/>
                                                </div>
                                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:'rgba(14,14,13,.5)',width:'60px',textAlign:'right',flexShrink:0}}>{fmtM(Number(v))}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {/* Tipo-specific metrics */}
                                        {(capRate||margem!==undefined||ppKey||ha||gdv) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}}>
                                            {capRate !== undefined && capRate > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 6px',borderRadius:'10px',background:'rgba(124,58,237,.08)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.2)'}}>Cap Rate {capRate.toFixed(1)}%</span>}
                                            {margem !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 6px',borderRadius:'10px',background:margem>=22?'rgba(22,163,74,.08)':'rgba(220,38,38,.08)',color:margem>=22?'#16a34a':'#dc2626',border:`1px solid ${margem>=22?'rgba(22,163,74,.2)':'rgba(220,38,38,.2)'}`}}>Margem {margem.toFixed(0)}%{gdv?` · GDV ${fmtM(gdv)}`:''}</span>}
                                            {ppKey !== undefined && ppKey > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 6px',borderRadius:'10px',background:'rgba(3,105,161,.08)',color:'#0369a1',border:'1px solid rgba(3,105,161,.2)'}}>€{Math.round(ppKey/1000)}k/quarto</span>}
                                            {ha !== undefined && ha > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 6px',borderRadius:'10px',background:'rgba(6,95,70,.08)',color:'#065f46',border:'1px solid rgba(6,95,70,.2)'}}>🌿 {ha.toFixed(1)} ha</span>}
                                          </div>
                                        )}
                                        {/* Atributos físicos extraídos do anúncio */}
                                        {(ceClass||estado||pisoN!==undefined||elevad!==undefined||garag||varand||piscin) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}}>
                                            {ceClass && (
                                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',
                                                background:['A+','A'].includes(ceClass)?'rgba(22,163,74,.1)':['B','B-'].includes(ceClass)?'rgba(37,99,235,.08)':['E','F'].includes(ceClass)?'rgba(220,38,38,.08)':'rgba(14,14,13,.06)',
                                                color:['A+','A'].includes(ceClass)?'#16a34a':['B','B-'].includes(ceClass)?'#2563eb':['E','F'].includes(ceClass)?'#dc2626':'rgba(14,14,13,.5)',
                                                border:'1px solid currentColor',opacity:.8,fontWeight:700}}>
                                                ⚡ {ceClass}
                                              </span>
                                            )}
                                            {estado && (
                                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',
                                                background:estado==='novo'?'rgba(22,163,74,.08)':estado==='recuperar'?'rgba(220,38,38,.07)':'rgba(14,14,13,.04)',
                                                color:estado==='novo'?'#16a34a':estado==='recuperar'?'#dc2626':'rgba(14,14,13,.5)',border:'1px solid currentColor',opacity:.85}}>
                                                {estado==='novo'?'🆕 Novo':estado==='bom'?'✓ Bom estado':'🔧 Para recuperar'}
                                              </span>
                                            )}
                                            {pisoN !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(14,14,13,.04)',color:'rgba(14,14,13,.5)',border:'1px solid rgba(14,14,13,.1)'}}>{pisoN===0?'R/C':`${pisoN}º andar`}</span>}
                                            {garag && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(28,74,53,.06)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.15)'}}>🚗 Garagem</span>}
                                            {varand && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(28,74,53,.06)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.15)'}}>🌅 Varanda</span>}
                                            {piscin && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(3,105,161,.08)',color:'#0369a1',border:'1px solid rgba(3,105,161,.2)'}}>🏊 Piscina</span>}
                                            {elevad===false && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(220,38,38,.06)',color:'#dc2626',border:'1px solid rgba(220,38,38,.15)',opacity:.7}}>⚠ Sem elevador</span>}
                                          </div>
                                        )}
                                        {/* Comparáveis reais + renda real */}
                                        {(nComp >= 2 || rendaR > 0) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}}>
                                            {nComp >= 2 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(28,74,53,.08)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)'}}>📊 {nComp} comparáveis reais</span>}
                                            {rendaR > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(37,99,235,.07)',color:'#2563eb',border:'1px solid rgba(37,99,235,.18)'}}>🏠 Renda real {rendaR.toFixed(1)}€/m²/mês</span>}
                                          </div>
                                        )}
                                        {/* Geocodificação + Distâncias */}
                                        {(distPraia !== undefined || distMetro !== undefined || distCentro !== undefined || orientac) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}}>
                                            {orientac && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:['S','SE','SO'].includes(orientac)?'rgba(201,169,110,.12)':'rgba(14,14,13,.05)',color:['S','SE','SO'].includes(orientac)?'#c9a96e':'rgba(14,14,13,.45)',border:'1px solid currentColor',fontWeight:700}}>☀️ {orientac}</span>}
                                            {distPraia !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:distPraia<1?'rgba(3,105,161,.1)':'rgba(14,14,13,.04)',color:distPraia<1?'#0369a1':'rgba(14,14,13,.45)',border:'1px solid currentColor'}}>🌊 {distPraia}km praia</span>}
                                            {distMetro !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:distMetro<0.5?'rgba(37,99,235,.1)':'rgba(14,14,13,.04)',color:distMetro<0.5?'#2563eb':'rgba(14,14,13,.45)',border:'1px solid currentColor'}}>🚇 {distMetro}km metro</span>}
                                            {distCentro !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(14,14,13,.04)',color:'rgba(14,14,13,.45)',border:'1px solid rgba(14,14,13,.1)'}}>🏛 {distCentro}km centro</span>}
                                            {distAero !== undefined && distAero < 5 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(220,38,38,.06)',color:'#dc2626',border:'1px solid rgba(220,38,38,.15)',opacity:.8}}>✈️ {distAero}km aeroporto</span>}
                                          </div>
                                        )}
                                        {/* Histórico de Preços — motivação do vendedor */}
                                        {(reducaoPct > 0 || diasMerc !== undefined) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'6px'}}>
                                            {tendencia === 'down' && reducaoPct > 0 && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(22,163,74,.1)',color:'#16a34a',border:'1px solid rgba(22,163,74,.2)',fontWeight:700}}>📉 -{reducaoPct}% preço{reducoes>1?` (${reducoes}×)`:''}</span>}
                                            {tendencia === 'up' && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(220,38,38,.07)',color:'#dc2626',border:'1px solid rgba(220,38,38,.15)'}}>📈 Preço em alta</span>}
                                            {diasMerc !== undefined && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:diasMerc>180?'rgba(220,38,38,.06)':'rgba(14,14,13,.04)',color:diasMerc>180?'#dc2626':'rgba(14,14,13,.45)',border:'1px solid currentColor'}}>🕐 {diasMerc}d mercado</span>}
                                          </div>
                                        )}
                                        {/* Drivers */}
                                        {(up.length > 0 || dn.length > 0) && (
                                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                                            {up.map((d,i)=><span key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(22,163,74,.08)',color:'#16a34a',border:'1px solid rgba(22,163,74,.15)'}}>{`↑ ${d}`}</span>)}
                                            {dn.map((d,i)=><span key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',padding:'2px 6px',borderRadius:'8px',background:'rgba(220,38,38,.06)',color:'#dc2626',border:'1px solid rgba(220,38,38,.15)'}}>{`↓ ${d}`}</span>)}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                  {/* Contact + Actions */}
                                  <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
                                    <a href={String(deal.url)} target="_blank" rel="noopener noreferrer" style={{flex:1,display:'block',padding:'7px 10px',background:'#1c4a35',color:'#e8dfc8',borderRadius:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',fontWeight:600,textDecoration:'none',textAlign:'center',letterSpacing:'.06em'}}>
                                      Ver Imóvel →
                                    </a>
                                    {Boolean(deal.telefone) && String(deal.telefone).length>4 && (
                                      <a href={`tel:${String(deal.telefone)}`} style={{padding:'7px 10px',background:'rgba(28,74,53,.1)',color:'#1c4a35',borderRadius:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',textDecoration:'none'}}>
                                        ☎ {String(deal.telefone)}
                                      </a>
                                    )}
                                    <button style={{padding:'7px 10px',background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.6)',border:'none',borderRadius:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}}
                                      onClick={()=>{ setRadarMode('url'); setRadarUrl(String(deal.url)); setTimeout(()=>runRadar(),100) }}>
                                      ⚡ Analisar
                                    </button>
                                    <button style={{padding:'7px 10px',background:'transparent',color:'#25D366',border:'1px solid rgba(37,211,102,.3)',borderRadius:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}}
                                      onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(`🏠 Encontrei este imóvel com score ${sc}/100\n${String(deal.titulo||'').substring(0,50)}\n${pr>0?`€ ${pr.toLocaleString('pt-PT')}`:''} · ${String(deal.zona||'')}\n${String(deal.url)}`)}`)}>
                                      WA
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* PDF CTA */}
                          <div className="p-card" style={{background:'rgba(28,74,53,.05)',border:'1px solid rgba(28,74,53,.15)',textAlign:'center',padding:'20px'}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',fontWeight:400,color:'#0e0e0d',marginBottom:'6px'}}>Relatório Profissional — <em style={{color:'#1c4a35'}}>Escolhas do Dia</em></div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.45)',marginBottom:'14px'}}>PDF completo com ranking, métricas, links directos e disclaimer para enviar a clientes</div>
                            <button className="p-btn p-btn-gold" style={{padding:'12px 32px',fontSize:'.5rem'}} onClick={()=>gerarPDF(deals,filtros,stats)}>
                              📄 Gerar PDF — Relatório Escolhas do Dia
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* ── MAPA DE CALOR ── */}
                <div style={{marginTop:'16px', marginBottom:'16px'}}>
                  <button
                    onClick={() => setShowHeatMap(s => !s)}
                    style={{fontFamily:"'DM Mono',monospace", fontSize:'.42rem', fontWeight:600, letterSpacing:'.08em', background:'#1c4a35', color:'#e8dfc8', border:'none', borderRadius:'8px', padding:'10px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px'}}
                  >
                    🗺️ {showHeatMap ? 'Fechar' : 'Mapa de Calor — Zonas Portugal'}
                  </button>

                  {showHeatMap && (
                    <div style={{marginTop:'16px'}}>
                      <div style={{fontFamily:"'Cormorant',serif", fontSize:'1.2rem', marginBottom:'4px'}}>
                        Mapa de Calor — <em style={{color:'#1c4a35'}}>Portugal Continental + Ilhas</em>
                      </div>
                      <div style={{fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(14,14,13,.4)', marginBottom:'16px'}}>
                        Score algorítmico Q1 2026 · INE/AT · {new Date().getFullYear()}
                      </div>

                      {/* Legend */}
                      <div style={{display:'flex', gap:'16px', marginBottom:'14px', flexWrap:'wrap'}}>
                        {([
                          ['#16a34a', '≥85 ATAQUE IMEDIATO'],
                          ['#c9a96e', '70–84 BOM NEGÓCIO'],
                          ['#2563eb', '55–69 VALOR JUSTO'],
                          ['#dc2626', '<55 EVITAR'],
                        ] as [string, string][]).map(([color, label]) => (
                          <div key={label} style={{display:'flex', alignItems:'center', gap:'6px'}}>
                            <div style={{width:'12px', height:'12px', borderRadius:'2px', background: color}}/>
                            <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(14,14,13,.6)'}}>{label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Group by region */}
                      {['Lisboa', 'Cascais', 'AML', 'Porto', 'Algarve', 'Madeira', 'Açores', 'Alentejo', 'Minho', 'Centro'].map(region => {
                        const regionZones = HEAT_MAP_ZONES.filter(z => z.region === region)
                        if (regionZones.length === 0) return null
                        return (
                          <div key={region} style={{marginBottom:'14px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace", fontSize:'.42rem', color:'rgba(14,14,13,.5)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'8px'}}>
                              {region}
                            </div>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
                              {regionZones.sort((a,b) => b.score - a.score).map(z => (
                                <div
                                  key={z.zona}
                                  style={{
                                    border: `2px solid ${z.color as string}`,
                                    borderRadius:'8px',
                                    padding:'10px 14px',
                                    background: z.score >= 85 ? `${z.color as string}18` : z.score >= 70 ? `${z.color as string}10` : `${z.color as string}08`,
                                    minWidth:'140px',
                                    cursor:'pointer',
                                    transition:'transform 0.1s',
                                  }}
                                  onClick={() => setSearchZona(z.zona.includes('Chiado') ? 'Lisboa — Chiado/Santos' : z.zona.includes('Príncipe') ? 'Lisboa — Príncipe Real' : z.zona)}
                                  title={`Clica para buscar deals em ${z.zona}`}
                                >
                                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
                                    <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(14,14,13,.55)', fontWeight:500}}>{z.zona}</span>
                                    <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.52rem', fontWeight:700, color: z.color as string}}>{z.score}</span>
                                  </div>
                                  <div style={{display:'flex', gap:'8px'}}>
                                    <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.34rem', color:'rgba(14,14,13,.4)'}}>€{(z.pm2/1000).toFixed(1)}k/m²</span>
                                    <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.34rem', color:'#16a34a'}}>+{z.yoy}%</span>
                                    <span style={{fontFamily:"'DM Mono',monospace", fontSize:'.34rem', color:'#2563eb'}}>{z.yield}%y</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      <div style={{fontFamily:"'DM Mono',monospace", fontSize:'.35rem', color:'rgba(14,14,13,.3)', marginTop:'12px', paddingTop:'12px', borderTop:'1px solid rgba(14,14,13,.08)'}}>
                        * Score baseado em: preço vs mercado · yield bruto · liquidez · valorização YoY · demanda internacional · risco zona. Clica numa zona para buscar deals.
                      </div>
                    </div>
                  )}
                </div>

                {/* ── URL ANALYSIS MODE ── */}
                {radarMode==='url' && (
                <div>
                {/* INPUT */}
                <div className="p-card" style={{marginBottom:'16px'}}>
                  <label className="p-label">Link do imóvel (Idealista, Imovirtual, ERA, Remax...) ou descreve o imóvel</label>
                  <textarea
                    className="p-inp"
                    style={{minHeight:'90px',resize:'vertical',marginBottom:'12px'}}
                    placeholder={`https://www.idealista.pt/imovel/32506977/\nhttps://www.e-leiloes.pt/e-leiloes/pesquisa/detalhe/12345\nhttps://imobiliario.bpi.pt/imovel/abc123\n\nou: T3 120m² Lisboa Chiado €850.000 3º andar remodelado`}
                    value={radarUrl}
                    onChange={e=>setRadarUrl(e.target.value)}
                  />
                  <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                    <button className="p-btn" style={{flex:1,padding:'13px'}} onClick={runRadar} disabled={radarLoading}>
                      {radarLoading ? '⟳  A analisar com IA + dados de mercado ao segundo...' : '▶  Analisar Deal — 20 Dimensões'}
                    </button>
                    {radarResult && <button className="p-btn" style={{background:'transparent',border:'1px solid rgba(14,14,13,.2)',color:'rgba(14,14,13,.5)',whiteSpace:'nowrap'}} onClick={()=>{setRadarResult(null);setRadarUrl('')}}>Limpar</button>}
                  </div>
                  <div style={{marginTop:'10px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',lineHeight:1.6}}>
                    Portais: Idealista · Imovirtual · Supercasa · ERA · Remax · KW · Sotheby's<br/>
                    Leilões: <span style={{color:'rgba(239,68,68,.6)'}}>e-Leilões (OSAE) · Leilões Tax (AT) · Citius (Judicial)</span><br/>
                    Banca: <span style={{color:'rgba(96,165,250,.6)'}}>BPI · Millennium · CGD · Novo Banco · Santander · Montepio</span><br/>
                    Ou cola descrição manual de qualquer imóvel · IA Claude Sonnet 4 · Euribor live BCE
                  </div>
                </div>

                {/* RESULTS */}
                {radarResult !== null && (() => {
                  const d = radarResult as Record<string,unknown>
                  const a = (d.analise as Record<string,unknown>) || d
                  const fin = (d.financeiro as Record<string,number>) || {}
                  const merc = (d.mercado as Record<string,unknown>) || {}
                  const dims = (a['20_dimensoes'] as Record<string,{s:number;n:string}>) || {}
                  const imovel = (d.imovel as Record<string,unknown>) || null

                  const score = Number(a.score || 0)
                  const classif = String(a.classificacao || '⚖️ VALOR JUSTO')
                  const valorJusto = Number(a.valor_justo || 0)
                  const precoP = Number(a.preco_pedido || (imovel ? imovel.preco : 0) || 0)
                  const oferta = Number(a.oferta_recomendada || 0)
                  const desconto = Number(a.desconto_percentagem || 0)
                  const pm2Anuncio = Number(a.pm2_anuncio || fin.pm2 || 0)
                  const pm2Merc = Number(a.pm2_mercado || merc.pm2_trans || 0)
                  const yieldB = Number(a.yield_bruto || 0)
                  const yieldL = Number(a.yield_liquido || 0)
                  const yieldAL = Number(a.yield_al || 0)
                  const roi5 = Number(a.roi_5_anos_pct || 0)
                  const roi10 = Number(a.roi_10_anos_pct || 0)

                  const scoreColor = score >= 80 ? '#22c55e' : score >= 65 ? '#f59e0b' : score >= 50 ? '#c9a96e' : '#ef4444'
                  const classifBg = classif.includes('ATAQUE') ? 'rgba(34,197,94,.15)' : classif.includes('PRIORIT') ? 'rgba(234,179,8,.15)' : classif.includes('BOM') ? 'rgba(28,74,53,.2)' : classif.includes('JUSTO') ? 'rgba(201,169,110,.1)' : classif.includes('SOBRE') ? 'rgba(239,68,68,.1)' : 'rgba(239,68,68,.15)'
                  const dimsList = Object.entries(dims)
                  const dimLabels: Record<string,string> = {
                    preco_vs_mediana_ine:'Preço vs INE', preco_por_m2_zona:'Preço/m²',
                    localizacao_macro_regiao:'Localização Macro', localizacao_micro_rua:'Localização Micro',
                    estado_conservacao_obras:'Estado', tipologia_funcionalidade:'Tipologia',
                    exposicao_solar_luz:'Exposição Solar', transportes_acessibilidade:'Transportes',
                    liquidez_velocidade_saida:'Liquidez', potencial_valorizacao_5a:'Valorização 5A',
                    yield_arrendamento_longo:'Yield Arrendamento', yield_al_turistico:'Yield AL/Turístico',
                    custo_obras_entrada_estado:'Obras Entrada', carga_fiscal_imt_imi:'Carga Fiscal',
                    procura_internacional:'Procura Intl.', risco_juridico_documental:'Risco Jurídico',
                    oportunidade_negociacao:'Negociação', qualidade_construcao:'Qualidade Constr.',
                    condominio_infraestrutura:'Condomínio', sustentabilidade_mercado:'Sustentabilidade',
                  }

                  const isLeilao = Boolean(d.is_leilao)
                  const isBanca = Boolean(d.is_banca)
                  const leilaoInfo = (d.leilao_info as Record<string,unknown>) || null
                  const vendaEspecial = (a.venda_especial as Record<string,unknown>) || null
                  const descontoMerc = Number(a.desconto_vs_mercado_pct || fin.desconto_vs_mercado_pct || 0)

                  return (
                    <div>
                      {/* ── LEILÃO / BANCA BADGE ── */}
                      {(isLeilao || isBanca) && (
                        <div style={{marginBottom:'12px',borderRadius:'10px',overflow:'hidden',border:`2px solid ${isLeilao ? 'rgba(239,68,68,.4)' : 'rgba(96,165,250,.4)'}`}}>
                          {/* Header */}
                          <div style={{background: isLeilao ? 'rgba(239,68,68,.12)' : 'rgba(96,165,250,.1)', padding:'10px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
                            <span style={{fontSize:'1.2rem'}}>{isLeilao ? '🔨' : '🏦'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',fontWeight:700,color: isLeilao ? '#ef4444' : '#60a5fa',letterSpacing:'.1em',textTransform:'uppercase'}}>
                                {isLeilao
                                  ? (String(d.tipo_venda) === 'leilao_fiscal' ? 'LEILÃO FISCAL — AT (Autoridade Tributária)' : String(d.tipo_venda) === 'leilao_judicial' ? 'LEILÃO JUDICIAL — e-Leilões / OSAE' : String(d.tipo_venda) === 'venda_judicial' ? 'VENDA JUDICIAL — Citius' : 'LEILÃO')
                                  : `IMÓVEL DA BANCA — ${String(d.banco || 'Banco')}`
                                }
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.45)',marginTop:'2px'}}>
                                {isLeilao ? 'Análise inclui: desconto real, riscos jurídicos, ónus, ocupação, prazo licitação' : 'Análise inclui: desconto vs mercado, margem negociação, estado, financiamento preferencial'}
                              </div>
                            </div>
                            {descontoMerc > 0 && (
                              <div style={{textAlign:'right',background: isLeilao ? 'rgba(239,68,68,.15)' : 'rgba(96,165,250,.12)',borderRadius:'8px',padding:'8px 14px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase',letterSpacing:'.1em'}}>Desconto vs Mercado</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'1.1rem',fontWeight:700,color: isLeilao ? '#ef4444' : '#60a5fa'}}>-{descontoMerc.toFixed(1)}%</div>
                              </div>
                            )}
                          </div>
                          {/* Data grid */}
                          {leilaoInfo && (
                            <div style={{background:'rgba(14,14,13,.02)',padding:'12px 16px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                              {[
                                ['Valor Base', leilaoInfo.valor_base && Number(leilaoInfo.valor_base)>0 ? `€${Number(leilaoInfo.valor_base).toLocaleString('pt-PT')}` : '—'],
                                ['Licitação Mínima', leilaoInfo.licitacao_minima && Number(leilaoInfo.licitacao_minima)>0 ? `€${Number(leilaoInfo.licitacao_minima).toLocaleString('pt-PT')}` : '—'],
                                ['Prazo Fim', String(leilaoInfo.prazo_fim || '—')],
                                ['Processo', String(leilaoInfo.processo || '—')],
                                ['Tribunal', String(leilaoInfo.tribunal || '—')],
                                ['Plataforma', String(leilaoInfo.plataforma || '—')],
                              ].map(([l,v])=>(
                                <div key={String(l)}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'2px'}}>{l}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,color:'rgba(14,14,13,.75)'}}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Venda especial AI analysis */}
                          {vendaEspecial && (
                            <div style={{background:'rgba(14,14,13,.03)',borderTop:'1px solid rgba(14,14,13,.06)',padding:'12px 16px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
                              {[
                                ['Risco Jurídico', String(vendaEspecial.risco_juridico_nivel||'—'), vendaEspecial.risco_juridico_nivel==='baixo'?'#22c55e':vendaEspecial.risco_juridico_nivel==='medio'?'#f59e0b':'#ef4444'],
                                ['Ocupação', String(vendaEspecial.risco_ocupacao||'—'), vendaEspecial.risco_ocupacao==='livre'?'#22c55e':'#f59e0b'],
                                ['Ónus/Hipotecas', String(vendaEspecial.onerus_estimados||'—'), '#f59e0b'],
                                ['Obras Estimadas', vendaEspecial.obras_estimadas_pct ? `${vendaEspecial.obras_estimadas_pct}% valor` : '—', '#c9a96e'],
                                ['Financiamento', vendaEspecial.financiamento_possivel ? '✓ Possível' : '✗ Complexo', vendaEspecial.financiamento_possivel ? '#22c55e' : '#ef4444'],
                                ['Prazo Decisão', String(vendaEspecial.prazo_decisao||'—'), vendaEspecial.prazo_decisao==='imediato'?'#ef4444':'#f59e0b'],
                                ['Vantagem Principal', String(vendaEspecial.vantagem_principal||'—'), '#22c55e'],
                                ['Risco Principal', String(vendaEspecial.risco_principal||'—'), '#ef4444'],
                              ].map(([l,v,c])=>(
                                <div key={String(l)} style={{background:'rgba(14,14,13,.04)',borderRadius:'6px',padding:'8px 10px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'3px'}}>{l}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',fontWeight:600,color:String(c),lineHeight:1.3}}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── SCORE HEADLINE ── */}
                      <div className="p-card" style={{background:'#0c1f15',marginBottom:'12px'}}>
                        <div style={{display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap'}}>
                          {/* Score circle */}
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:'100px'}}>
                            <div style={{width:'88px',height:'88px',borderRadius:'50%',border:`4px solid ${scoreColor}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.3)'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'1.6rem',fontWeight:700,color:scoreColor,lineHeight:1}}>{score}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)'}}>/100</div>
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.4)',marginTop:'6px',textAlign:'center'}}>SCORE DEAL</div>
                          </div>
                          {/* Classification + key numbers */}
                          <div style={{flex:1,minWidth:'200px'}}>
                            <div style={{display:'inline-block',padding:'5px 14px',background:classifBg,border:`1px solid ${scoreColor}40`,borderRadius:'6px',marginBottom:'10px'}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.54rem',color:scoreColor,fontWeight:700,letterSpacing:'.1em'}}>{classif}</span>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                              {[
                                ['Valor Justo', valorJusto > 0 ? `€${valorJusto.toLocaleString('pt-PT')}` : '—', '#c9a96e'],
                                ['Oferta Recomendada', oferta > 0 ? `€${oferta.toLocaleString('pt-PT')}` : '—', '#22c55e'],
                                ['Desconto Alvo', precoP > 0 && desconto ? `${desconto}%` : '—', desconto < 0 ? '#22c55e' : '#f59e0b'],
                                ['Preço Pedido', precoP > 0 ? `€${precoP.toLocaleString('pt-PT')}` : '—', 'rgba(244,240,230,.6)'],
                                ['€/m² Anúncio', pm2Anuncio > 0 ? `€${pm2Anuncio.toLocaleString('pt-PT')}` : '—', 'rgba(244,240,230,.6)'],
                                ['€/m² Mercado', pm2Merc > 0 ? `€${pm2Merc.toLocaleString('pt-PT')}` : '—', 'rgba(244,240,230,.6)'],
                              ].map(([l,v,c])=>(
                                <div key={String(l)} style={{background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 10px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'3px'}}>{l}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.56rem',fontWeight:600,color:String(c)}}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Zona + market quick */}
                          <div style={{minWidth:'160px',textAlign:'right'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(201,169,110,.7)',fontWeight:600,marginBottom:'4px'}}>{String(d.zona||'—')}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.35)',lineHeight:1.8}}>
                              <div>Trend +{Number(merc.var_yoy||0)}% YoY</div>
                              <div>{Number(merc.dias_mercado||0)} dias mercado</div>
                              <div>{Number(merc.comp_int_pct||0)}% comp. internacionais</div>
                              <div>Liquidez {Number(merc.liquidez||0)}/10</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── 20 DIMENSÕES GRID ── */}
                      <div className="p-card" style={{marginBottom:'12px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>20 Dimensões de Análise</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                          {dimsList.map(([key, val])=>{
                            const s = val?.s ?? 0
                            const n = val?.n ?? ''
                            const label = dimLabels[key] || key
                            const barColor = s >= 8 ? '#22c55e' : s >= 6 ? '#c9a96e' : s >= 4 ? '#f59e0b' : '#ef4444'
                            return (
                              <div key={key} style={{background:'rgba(28,74,53,.05)',borderRadius:'8px',padding:'10px 12px',border:'1px solid rgba(28,74,53,.12)'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',letterSpacing:'.06em',textTransform:'uppercase'}}>{label}</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',fontWeight:700,color:barColor}}>{s}</span>
                                </div>
                                <div style={{background:'rgba(14,14,13,.08)',borderRadius:'2px',height:'3px',marginBottom:'5px',overflow:'hidden'}}>
                                  <div style={{width:`${s*10}%`,height:'100%',background:barColor,borderRadius:'2px',transition:'width .4s'}}/>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.45)',lineHeight:1.4}}>{n}</div>
                              </div>
                            )
                          })}
                        </div>
                        {dimsList.length > 0 && (
                          <div style={{marginTop:'12px',padding:'10px 14px',background:'rgba(28,74,53,.06)',borderRadius:'8px',display:'flex',gap:'20px',flexWrap:'wrap'}}>
                            {[['≥8','#22c55e','Excelente'],['6-7','#c9a868','Bom'],['4-5','#f59e0b','Médio'],['<4','#ef4444','Fraco']].map(([r,c,l])=>(
                              <div key={r} style={{display:'flex',alignItems:'center',gap:'5px'}}>
                                <div style={{width:'8px',height:'8px',borderRadius:'2px',background:c}}/>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)'}}>{r} — {l}</span>
                              </div>
                            ))}
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',marginLeft:'auto'}}>Score médio: {dimsList.length>0?((dimsList.reduce((s,[,v])=>s+(v?.s??0),0)/dimsList.length)).toFixed(1):'—'}/10</span>
                          </div>
                        )}
                      </div>

                      {/* ── INVESTMENT DASHBOARD ── */}
                      <div className="p-card" style={{marginBottom:'12px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Análise Financeira Completa</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
                          {/* Arrendamento */}
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px',paddingBottom:'6px',borderBottom:'1px solid rgba(14,14,13,.08)'}}>Arrendamento Longo Prazo</div>
                            {[
                              ['Renda est./mês', Number(a.renda_mensal_estimada||fin.renda_est||0)>0?`€${Number(a.renda_mensal_estimada||fin.renda_est).toLocaleString('pt-PT')}/mês`:'—', '#22c55e'],
                              ['Yield bruto', `${yieldB.toFixed(2)}%`, '#22c55e'],
                              ['Yield líquido', `${yieldL.toFixed(2)}%`, '#86efac'],
                              ['Renda AL/mês est.', Number(a.renda_al_estimada||fin.renda_al||0)>0?`€${Number(a.renda_al_estimada||fin.renda_al).toLocaleString('pt-PT')}/mês`:'—', '#c9a96e'],
                              ['Yield AL est.', `${yieldAL.toFixed(2)}%`, '#c9a96e'],
                              ['Yield zona mercado', `${Number(merc.yield_bruto||0).toFixed(1)}%`, 'rgba(14,14,13,.5)'],
                            ].map(([l,v,c])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.41rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.43rem',fontWeight:600,color:String(c)}}>{v}</span>
                              </div>
                            ))}
                          </div>
                          {/* Valorização */}
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px',paddingBottom:'6px',borderBottom:'1px solid rgba(14,14,13,.08)'}}>Valorização & ROI</div>
                            {[
                              ['Valor actual', precoP>0?`€${precoP.toLocaleString('pt-PT')}`:'—', 'rgba(14,14,13,.6)'],
                              ['Valor justo AVM', valorJusto>0?`€${valorJusto.toLocaleString('pt-PT')}`:'—', '#c9a96e'],
                              ['Valor est. 5 anos', Number(a.valor_5_anos||0)>0?`€${Number(a.valor_5_anos).toLocaleString('pt-PT')}`:'—', '#c9a96e'],
                              ['Valor est. 10 anos', Number(a.valor_10_anos||0)>0?`€${Number(a.valor_10_anos).toLocaleString('pt-PT')}`:'—', '#86efac'],
                              ['ROI total 5 anos', roi5>0?`+${roi5.toFixed(1)}%`:'—', '#22c55e'],
                              ['ROI total 10 anos', roi10>0?`+${roi10.toFixed(1)}%`:'—', '#22c55e'],
                            ].map(([l,v,c])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.41rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.43rem',fontWeight:600,color:String(c)}}>{v}</span>
                              </div>
                            ))}
                          </div>
                          {/* Custos */}
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px',paddingBottom:'6px',borderBottom:'1px solid rgba(14,14,13,.08)'}}>Custos Aquisição & Crédito</div>
                            {[
                              ['IMT hab. própria', Number(a.imt_hp||fin.imt_hp||0)>0?`€${Number(a.imt_hp||fin.imt_hp).toLocaleString('pt-PT')}`:'—', '#f59e0b'],
                              ['IMT investimento', Number(a.imt_inv||fin.imt_inv||0)>0?`€${Number(a.imt_inv||fin.imt_inv).toLocaleString('pt-PT')}`:'—', '#f59e0b'],
                              ['Imposto de Selo', Number(a.imposto_selo||fin.is||0)>0?`€${Number(a.imposto_selo||fin.is).toLocaleString('pt-PT')}`:'—', '#f59e0b'],
                              ['Total (hab. própria)', Number(a.custo_total_aquisicao_hp||fin.total_hp||0)>0?`€${Number(a.custo_total_aquisicao_hp||fin.total_hp).toLocaleString('pt-PT')}`:'—', '#ef4444'],
                              ['Euribor 6M (live)', fin.euribor_6m?`${(Number(fin.euribor_6m)*100).toFixed(2)}%`:'—', '#60a5fa'],
                              ['Prestação 30a (70%)', Number(a.prestacao_mensal_estimada||fin.pmt30||0)>0?`€${Number(a.prestacao_mensal_estimada||fin.pmt30).toLocaleString('pt-PT')}/mês`:'—', '#60a5fa'],
                            ].map(([l,v,c])=>(
                              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.05)'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.41rem',color:'rgba(14,14,13,.5)'}}>{l}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.43rem',fontWeight:600,color:String(c)}}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── VEREDICTO + ESTRATÉGIA ── */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                        <div className="p-card">
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Veredicto & Análise</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.75)',lineHeight:1.7,marginBottom:'14px'}}>{String(a.veredicto||'')}</div>
                          <div style={{marginBottom:'10px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#1c4a35',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>✓ Pontos Fortes</div>
                            {((a.pontos_fortes as string[])||[]).map((p,i)=><div key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',padding:'4px 0',borderBottom:'1px solid rgba(14,14,13,.05)',lineHeight:1.4}}>· {p}</div>)}
                          </div>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#dc2626',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>⚠ Riscos Críticos</div>
                            {((a.riscos_criticos as string[])||[]).map((r,i)=><div key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',padding:'4px 0',borderBottom:'1px solid rgba(14,14,13,.05)',lineHeight:1.4}}>· {r}</div>)}
                          </div>
                        </div>
                        <div className="p-card">
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Estratégia & Acção</div>
                          {Boolean(a.estrategia_negociacao) && (
                            <div style={{background:'rgba(28,74,53,.08)',borderLeft:'3px solid #1c4a35',padding:'10px 12px',borderRadius:'0 6px 6px 0',marginBottom:'12px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'4px'}}>Estratégia Negociação</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.75)',lineHeight:1.6}}>{String(a.estrategia_negociacao)}</div>
                            </div>
                          )}
                          {Boolean(a.timing_recomendado) && (
                            <div style={{background:'rgba(201,169,110,.08)',borderLeft:'3px solid #c9a96e',padding:'8px 12px',borderRadius:'0 6px 6px 0',marginBottom:'12px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'4px'}}>Timing</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.75)'}}>{String(a.timing_recomendado)}</div>
                            </div>
                          )}
                          {Boolean(a.nhr_enquadramento) && (
                            <div style={{background:'rgba(96,165,250,.08)',borderLeft:'3px solid #60a5fa',padding:'8px 12px',borderRadius:'0 6px 6px 0',marginBottom:'12px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'4px'}}>NHR / IFICI</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.75)'}}>{String(a.nhr_enquadramento)}</div>
                            </div>
                          )}
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px'}}>Dados de Mercado — {String(merc.region||d.zona||'')}</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                            {[
                              [`€${Number(merc.pm2_trans||0).toLocaleString('pt-PT')}/m²`, 'Mediana trans. AT'],
                              [`+${merc.var_yoy||0}%`, 'Trend YoY'],
                              [`${merc.dias_mercado||0} dias`, 'Tempo mercado'],
                              [`${merc.comp_int_pct||0}%`, 'Compradores intl.'],
                              [`${merc.abs_meses||0} meses`, 'Absorção'],
                              [`${merc.liquidez||0}/10`, 'Liquidez'],
                            ].map(([v,l])=>(
                              <div key={String(l)} style={{background:'rgba(28,74,53,.05)',borderRadius:'6px',padding:'7px 10px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',fontWeight:600,color:'#1c4a35'}}>{v}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>{l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── WhatsApp Actions ── */}
                      <div className="p-card" style={{marginBottom:'12px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Mensagens Prontas</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                          {Boolean(a.msg_wa_comprador) && (
                            <div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em',textTransform:'uppercase'}}>WhatsApp → Vendedor/Agente</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',background:'rgba(14,14,13,.03)',borderRadius:'6px',padding:'10px',marginBottom:'8px',lineHeight:1.6,border:'1px solid rgba(14,14,13,.08)'}}>{String(a.msg_wa_comprador)}</div>
                              <button className="p-btn p-btn-gold" style={{width:'100%'}} onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(String(a.msg_wa_comprador))}`,'_blank')}>
                                Enviar WA → Vendedor
                              </button>
                            </div>
                          )}
                          {Boolean(a.msg_wa_cliente) && (
                            <div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',marginBottom:'6px',letterSpacing:'.08em',textTransform:'uppercase'}}>WhatsApp → Meu Cliente</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',background:'rgba(14,14,13,.03)',borderRadius:'6px',padding:'10px',marginBottom:'8px',lineHeight:1.6,border:'1px solid rgba(14,14,13,.08)'}}>{String(a.msg_wa_cliente)}</div>
                              <button className="p-btn" style={{width:'100%',background:'#1c4a35',color:'#e8dfc8'}} onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(String(a.msg_wa_cliente))}`,'_blank')}>
                                Enviar WA → Cliente
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',textAlign:'center',padding:'8px 0'}}>
                        Agency Group Deal Radar v4.0 · 20 Dimensões · {isLeilao ? '🔨 Leilão ' : isBanca ? '🏦 Banca ' : ''}INE/AT Q4 2025 · Euribor {fin.euribor_6m ? `${(Number(fin.euribor_6m)*100).toFixed(2)}%` : 'live'} BCE · {d.cached ? 'Cache 6h' : 'Análise em tempo real'} · Fontes: Apify · e-Leilões · Banca PT · Claude Sonnet 4
                      </div>

                      {/* Price History */}
                      {radarUrl && !radarLoading && radarResult && (
                        <PriceHistoryWidget url={radarUrl} />
                      )}
                    </div>
                  )
                })()}
                </div>
                )}
              </div>
            )}

            {/* ── CRÉDITO ── */}
            {section==='credito' && (()=>{
              type MortRes = {
                inputs:{ montante:number;entrada:number;capital:number;ltv_pct:number;prazo_anos:number;spread_pct:number }
                resultado:{ prestacao_mensal:number;tan_pct:number;taeg_pct:number;total_juros:number;imt_estimado:number;is_estimado:number;custos_legais:number;imi_anual:number;deducao_irs_ano1:number;euribor_6m_pct:number }
                acessibilidade:{ dsti_pct:number;dsti_ok:boolean;nota:string }|null
                cenarios:{ label:string;tan_pct:number;pmt:number }[]
                tabela_amortizacao:{ ano:number;prestacao_anual:number;juros:number;amortizacao:number;saldo:number;capital_pago_acum:number }[]
              }
              const PERSONAS = [
                { label:'🏠 HPP Lisboa €500K', montante:500000, entrada:20, prazo:30, spread:1.0, uso:'habitacao_propria' },
                { label:'🏡 HPP Cascais €800K', montante:800000, entrada:25, prazo:30, spread:1.15, uso:'habitacao_propria', rendimento:80000 },
                { label:'💼 Investidor Porto €300K', montante:300000, entrada:30, prazo:25, spread:1.5, uso:'investimento' },
                { label:'🌊 Comporta Luxo €1.5M', montante:1500000, entrada:30, prazo:20, spread:0.85, uso:'investimento' },
                { label:'👨‍👩‍👧 Família €650K · DSTI', montante:650000, entrada:25, prazo:35, spread:1.25, uso:'habitacao_propria', rendimento:60000 },
              ]
              const md = mortResult as MortRes|null
              const res = md?.resultado
              const fmt = (n:number) => n?.toLocaleString('pt-PT') || '0'
              const maxPmt = md ? Math.max(...(md.cenarios||[]).map(c=>c.pmt), 1) : 1
              return (
                <div style={{display:'flex',gap:'20px',alignItems:'flex-start',maxWidth:'1200px'}}>
                  {/* LEFT */}
                  <div style={{width:'300px',flexShrink:0,display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>Euribor Live · TAEG · DSTI BdP</div>
                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',lineHeight:1.1}}>Simulador de <em style={{color:'#1c4a35'}}>Crédito</em></div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginTop:'4px'}}>Prestação · Custos reais · Stress test</div>
                    </div>
                    <div className="p-card" style={{padding:'12px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'8px'}}>Perfis Rápidos</div>
                      <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                        {PERSONAS.map(p=>(
                          <button key={p.label} onClick={()=>runMortPersona(p)}
                            style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',padding:'7px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.6)',cursor:'pointer',textAlign:'left',letterSpacing:'.03em',transition:'all .15s'}}
                            onMouseOver={e=>(e.currentTarget.style.background='rgba(28,74,53,.1)')}
                            onMouseOut={e=>(e.currentTarget.style.background='rgba(28,74,53,.04)')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-card" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                      <div style={{display:'flex',gap:'6px'}}>
                        {(['habitacao_propria','investimento'] as const).map(u=>(
                          <button key={u} onClick={()=>setMortUso(u)}
                            style={{flex:1,padding:'7px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',cursor:'pointer',border:'1px solid',transition:'all .15s',background:mortUso===u?'#1c4a35':'transparent',borderColor:mortUso===u?'#1c4a35':'rgba(14,14,13,.15)',color:mortUso===u?'#f4f0e6':'rgba(14,14,13,.5)'}}>
                            {u==='habitacao_propria'?'🏠 HPP':'💼 Invest.'}
                          </button>
                        ))}
                      </div>
                      <div>
                        <label className="p-label">Valor do Imóvel (€)</label>
                        <input className="p-inp" type="number" placeholder="ex: 500 000" value={mortMontante} onChange={e=>setMortMontante(e.target.value)}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                        <div>
                          <label className="p-label">Entrada</label>
                          <select className="p-sel" value={mortEntrada} onChange={e=>setMortEntrada(Number(e.target.value))}>
                            {[10,15,20,25,30,35,40,50].map(v=><option key={v} value={v}>{v}%</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="p-label">Prazo</label>
                          <select className="p-sel" value={mortPrazo} onChange={e=>setMortPrazo(Number(e.target.value))}>
                            {[15,20,25,30,35,40].map(v=><option key={v} value={v}>{v} anos</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="p-label">Spread</label>
                        <select className="p-sel" value={mortSpreadVal} onChange={e=>setMortSpreadVal(Number(e.target.value))}>
                          {[0.75,0.85,1.0,1.15,1.25,1.5,1.75,2.0,2.5].map(v=><option key={v} value={v}>{v}%</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="p-label">Rendimento Anual (€) <span style={{opacity:.5}}>— DSTI</span></label>
                        <input className="p-inp" type="number" placeholder="opcional · ex: 60 000" value={mortRendimento} onChange={e=>setMortRendimento(e.target.value)}/>
                      </div>
                      <button className="p-btn" onClick={()=>runMort()} disabled={mortLoading||!mortMontante}>
                        {mortLoading?'◌ A calcular...':'▶ Calcular Crédito'}
                      </button>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.28)',lineHeight:1.5}}>Simulação indicativa. Não constitui proposta de crédito. Sujeito a aprovação bancária e condições individuais.</div>
                  </div>

                  {/* RIGHT */}
                  <div style={{flex:1,minWidth:0}}>
                    {!md && !mortLoading && (
                      <div style={{height:'380px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'rgba(14,14,13,.2)',textAlign:'center',gap:'10px'}}>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'3rem',fontWeight:300,lineHeight:1}}>€</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.12em',textTransform:'uppercase'}}>Selecciona um perfil rápido</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem'}}>ou preenche o formulário e clica em Calcular</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',marginTop:'4px',padding:'8px 16px',border:'1px dashed rgba(14,14,13,.1)'}}>Prestação · TAN · TAEG · DSTI · IMT · Stress Test · Amortização</div>
                      </div>
                    )}
                    {mortLoading && (
                      <div style={{height:'380px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.55rem',color:'#1c4a35',letterSpacing:'.2em'}}>◌ A calcular...</div>
                      </div>
                    )}
                    {md && res && !mortLoading && (()=>{
                      const shareText = `Simulação Crédito — Agency Group · AMI 22506\n\nImóvel: €${fmt(md.inputs.montante)} | ${mortUso==='habitacao_propria'?'Habitação Própria':'Investimento'}\nEntrada: €${fmt(md.inputs.entrada)} (${md.inputs.ltv_pct}% LTV) | Capital: €${fmt(md.inputs.capital)}\nPrazo: ${md.inputs.prazo_anos} anos | Spread: ${md.inputs.spread_pct}%\n\nPRESTAÇÃO MENSAL: €${fmt(res.prestacao_mensal)}\nTAN: ${res.tan_pct}% | TAEG: ${res.taeg_pct}%\nTotal juros estimado: €${fmt(res.total_juros)}\n\nCustos aquisição:\n• IMT: €${fmt(res.imt_estimado)}\n• Imposto Selo: €${fmt(res.is_estimado)}\n• Custos legais: €${fmt(res.custos_legais)}\n• IMI anual: €${fmt(res.imi_anual)}${md.acessibilidade?`\n\nDSTI: ${md.acessibilidade.dsti_pct}% — ${md.acessibilidade.dsti_ok?'✓ Aprovação provável (BdP ≤35%)':'⚠ Acima recomendação BdP'}`:''}  \n\nSimulação indicativa · geral@agencygroup.pt`
                      return (
                        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                          {/* Hero */}
                          <div style={{background:'#0c1f15',padding:'18px 22px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px'}}>
                            <div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.45)',letterSpacing:'.16em',textTransform:'uppercase',marginBottom:'4px'}}>Prestação mensal estimada</div>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.8rem',fontWeight:300,color:'#c9a96e',lineHeight:1}}>€ {fmt(res.prestacao_mensal)}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)',marginTop:'3px'}}>TAN {res.tan_pct}% · TAEG {res.taeg_pct}% · Euribor {res.euribor_6m_pct}%</div>
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              {md.acessibilidade ? (
                                <div>
                                  <div style={{display:'inline-block',padding:'4px 12px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',background:md.acessibilidade.dsti_ok?'rgba(74,156,122,.2)':'rgba(201,100,80,.2)',border:`1px solid ${md.acessibilidade.dsti_ok?'rgba(74,156,122,.4)':'rgba(201,100,80,.4)'}`,color:md.acessibilidade.dsti_ok?'#4a9c7a':'#e07060'}}>
                                    {md.acessibilidade.dsti_ok?'✓ DSTI OK':'⚠ DSTI Alto'} — {md.acessibilidade.dsti_pct}%
                                  </div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.35rem',color:'rgba(244,240,230,.25)',marginTop:'5px',maxWidth:'170px',lineHeight:1.4,textAlign:'right'}}>{md.acessibilidade.nota?.slice(0,90)}</div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.35)',letterSpacing:'.08em'}}>LTV {md.inputs.ltv_pct}%</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.5)',marginTop:'4px'}}>{mortUso==='habitacao_propria'?'HPP · max LTV 90%':'Invest. · max LTV 75%'}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 4-panel grid */}
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                            {([
                              ['Entrada',`€ ${fmt(md.inputs.entrada)}`,`${md.inputs.ltv_pct}% LTV`],
                              ['Capital',`€ ${fmt(md.inputs.capital)}`,`${md.inputs.prazo_anos} anos`],
                              ['Total Juros',`€ ${fmt(res.total_juros)}`,`${((res.total_juros/(md.inputs.capital||1))*100).toFixed(1)}% cap.`],
                              ['Total Pago',`€ ${fmt(res.total_juros+md.inputs.capital)}`,'capital + juros'],
                            ] as [string,string,string][]).map(([l,v,s])=>(
                              <div key={l} className="p-card" style={{padding:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.35rem',color:'rgba(14,14,13,.3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'4px'}}>{l}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.6rem',color:'#1c4a35',fontWeight:600}}>{v}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{s}</div>
                              </div>
                            ))}
                          </div>

                          {/* Acquisition costs */}
                          <div className="p-card" style={{padding:'14px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'10px'}}>Custos de Aquisição Estimados</div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
                              {([
                                ['IMT',res.imt_estimado,mortUso==='habitacao_propria'?'HPP':'Invest.'],
                                ['Imposto Selo',res.is_estimado,'0,8%'],
                                ['Custos Legais',res.custos_legais,'Adv + Reg.'],
                                ['IMI / ano',res.imi_anual,'0,3% VPT'],
                                ['TOTAL CUSTOS',res.imt_estimado+res.is_estimado+res.custos_legais,'excl. entrada'],
                              ] as [string,number,string][]).map(([l,v,s],i)=>(
                                <div key={i} style={{textAlign:'center',padding:'8px',background:i===4?'rgba(28,74,53,.06)':'rgba(14,14,13,.02)',border:`1px solid ${i===4?'rgba(28,74,53,.15)':'rgba(14,14,13,.06)'}`}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.3)',letterSpacing:'.06em',textTransform:'uppercase',marginBottom:'3px'}}>{l}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:i===4?'.52rem':'.48rem',color:i===4?'#1c4a35':'rgba(14,14,13,.65)',fontWeight:i===4?600:400}}>€ {v.toLocaleString('pt-PT')}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.31rem',color:'rgba(14,14,13,.25)',marginTop:'2px'}}>{s}</div>
                                </div>
                              ))}
                            </div>
                            {mortUso==='habitacao_propria' && res.deducao_irs_ano1>0 && (
                              <div style={{marginTop:'10px',padding:'8px 12px',background:'rgba(74,156,122,.05)',border:'1px solid rgba(74,156,122,.15)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',letterSpacing:'.06em'}}>Dedução IRS crédito habitação (Art.º 85.º CIRS)</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.45rem',color:'#4a9c7a',fontWeight:600}}>−€ {fmt(res.deducao_irs_ano1)} / ano</div>
                              </div>
                            )}
                          </div>

                          {/* Sub-tabs */}
                          <div>
                            <div style={{display:'flex',borderBottom:'1px solid rgba(14,14,13,.08)',marginBottom:'12px'}}>
                              {(['cenarios','amortizacao','share'] as const).map((t,i)=>(
                                <button key={t} onClick={()=>setMortSubTab(t)}
                                  style={{padding:'8px 18px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',cursor:'pointer',border:'none',borderBottom:`2px solid ${mortSubTab===t?'#1c4a35':'transparent'}`,background:'transparent',color:mortSubTab===t?'#1c4a35':'rgba(14,14,13,.4)',letterSpacing:'.06em',transition:'all .15s'}}>
                                  {['Stress Test','Amortização','Enviar'][i]}
                                </button>
                              ))}
                            </div>

                            {mortSubTab==='cenarios' && (
                              <div className="p-card" style={{background:'#0c1f15',padding:'16px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(244,240,230,.3)',marginBottom:'12px'}}>4 Cenários Euribor — Stress Test Banco de Portugal</div>
                                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                                  {(md.cenarios||[]).map((c,i)=>(
                                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 100px',gap:'10px',alignItems:'center'}}>
                                      <div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:i===0?'#c9a96e':'rgba(244,240,230,.4)',marginBottom:'4px'}}>{c.label}</div>
                                        <div style={{height:'5px',background:'rgba(244,240,230,.06)',borderRadius:'2px',overflow:'hidden'}}>
                                          <div style={{height:'100%',width:`${Math.round(c.pmt/maxPmt*100)}%`,background:i===0?'#c9a96e':'rgba(244,240,230,.2)',transition:'width .5s'}}/>
                                        </div>
                                      </div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.35)',textAlign:'right'}}>{c.tan_pct}%</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:i===0?'#c9a96e':'rgba(244,240,230,.55)',textAlign:'right',fontWeight:i===0?600:400}}>€ {c.pmt.toLocaleString('pt-PT')}/mês</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {mortSubTab==='amortizacao' && (
                              <div className="p-card" style={{padding:'14px',overflowX:'auto'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'10px'}}>Plano de Amortização — Anos Chave</div>
                                <table style={{width:'100%',borderCollapse:'collapse',fontFamily:"'DM Mono',monospace",fontSize:'.42rem'}}>
                                  <thead>
                                    <tr>
                                      {['Ano','Prestação/ano','Juros','Amortização','Saldo','Capital Pago'].map(h=>(
                                        <th key={h} style={{padding:'6px 10px',textAlign:'right',borderBottom:'1px solid rgba(14,14,13,.08)',color:'rgba(14,14,13,.3)',fontWeight:400,whiteSpace:'nowrap',letterSpacing:'.06em'}}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(md.tabela_amortizacao||[]).filter(r=>[1,3,5,10,15,20,25,30].includes(r.ano)).map(r=>(
                                      <tr key={r.ano} style={{borderBottom:'1px solid rgba(14,14,13,.04)'}}>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'rgba(14,14,13,.5)',fontWeight:600}}>{r.ano}</td>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'rgba(14,14,13,.55)'}}>€ {r.prestacao_anual.toLocaleString('pt-PT')}</td>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'rgba(200,80,80,.7)'}}>€ {r.juros.toLocaleString('pt-PT')}</td>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'rgba(28,74,53,.7)'}}>€ {r.amortizacao.toLocaleString('pt-PT')}</td>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'rgba(14,14,13,.55)'}}>€ {r.saldo.toLocaleString('pt-PT')}</td>
                                        <td style={{padding:'6px 10px',textAlign:'right',color:'#1c4a35',fontWeight:600}}>€ {r.capital_pago_acum.toLocaleString('pt-PT')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {mortSubTab==='share' && (
                              <div className="p-card" style={{padding:'16px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'10px'}}>Resumo para Cliente</div>
                                <pre style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',background:'rgba(14,14,13,.02)',padding:'14px',border:'1px solid rgba(14,14,13,.06)',lineHeight:1.7,whiteSpace:'pre-wrap',marginBottom:'10px'}}>{shareText}</pre>
                                <button onClick={()=>navigator.clipboard.writeText(shareText)} className="p-btn" style={{maxWidth:'200px'}}>⎘ Copiar Resumo</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })()}

            {/* ── NHR ── */}
            {section==='nhr' && (()=>{
              const PERSONAS = [
                { label:'🇬🇧 Reformado UK', pais:'UK', tipo:'pensao', rend:80000, fonte:true },
                { label:'💻 Tech Remote USA', pais:'USA', tipo:'salario', rend:150000, fonte:true },
                { label:'🏢 Empresário França', pais:'France', tipo:'dividendos', rend:300000, fonte:true },
                { label:'🎨 Freelance NL', pais:'Netherlands', tipo:'salario', rend:120000, fonte:false },
                { label:'🇧🇷 HNWI Brasil', pais:'Brazil', tipo:'dividendos', rend:500000, fonte:true },
              ]
              const PAISES = ['UK','USA','France','Germany','Brazil','Netherlands','Italy','Spain','Other']
              const TIPOS: [string,string][] = [['salario','Salário / Trabalho'],['dividendos','Dividendos'],['rendas','Rendas'],['pensao','Pensão'],['mais_valias','Mais-Valias'],['crypto','Crypto']]
              type NHRData = {
                origem_fiscal:{taxa_efetiva_pct:number;rendimento_liquido:number;imposto:number;ss_contribuicao:number;carga_total_pct:number}
                nhr_portugal:{taxa_efetiva_pct:number;rendimento_liquido:number;poupanca_vs_origem:number;poupanca_10_anos:number;imposto:number;ss_contribuicao:number;carga_total_pct:number}
                ifici_portugal:{taxa_efetiva_pct:number;rendimento_liquido:number;poupanca_vs_origem:number;poupanca_10_anos:number;imposto:number;ss_contribuicao:number;carga_total_pct:number}
                pt_normal:{taxa_efetiva_pct:number;rendimento_liquido:number;imposto:number;ss_contribuicao:number;carga_total_pct:number}
                recomendacao:{regime_recomendado:string;detalhe:string}
                elegibilidade_nhr:{condicoes:string[];nota:string;prazo_pedido:string}
                elegibilidade_ifici:{atividades_qualificadas:string[];condicoes:string[];nota:string}
                processo:{passo:number;titulo:string;descricao:string;prazo:string;documentos:string[]}[]
                perfil:{rendimento_anual:number;pais_nome:string;tipo_rendimento:string}
              }
              const d = nhrResult as NHRData|null
              const fmt = (n:number) => n?.toLocaleString('pt-PT') || '0'
              const bestSaving = d ? Math.max(d.nhr_portugal?.poupanca_vs_origem||0, d.ifici_portugal?.poupanca_vs_origem||0) : 0
              const best10 = d ? Math.max(d.nhr_portugal?.poupanca_10_anos||0, d.ifici_portugal?.poupanca_10_anos||0) : 0
              const bestRegime = d?.recomendacao?.regime_recomendado || ''
              return (
                <div style={{display:'flex',gap:'20px',alignItems:'flex-start',maxWidth:'1200px'}}>
                  {/* ─ LEFT: Controls ─ */}
                  <div style={{width:'300px',flexShrink:0,display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>IFICI · 9 países · 10 anos</div>
                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',lineHeight:1.1}}>NHR / <em style={{color:'#1c4a35'}}>IFICI</em></div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginTop:'4px'}}>Calculador fiscal para novos residentes</div>
                    </div>
                    {/* Personas */}
                    <div className="p-card" style={{padding:'12px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'8px'}}>Perfis Rápidos</div>
                      <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                        {PERSONAS.map(p=>(
                          <button key={p.label} onClick={()=>runNHRPersona(p)}
                            style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',padding:'7px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.6)',cursor:'pointer',textAlign:'left',letterSpacing:'.03em',transition:'all .15s'}}
                            onMouseOver={e=>(e.currentTarget.style.background='rgba(28,74,53,.1)')}
                            onMouseOut={e=>(e.currentTarget.style.background='rgba(28,74,53,.04)')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Form */}
                    <div className="p-card" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                      <div>
                        <label className="p-label">País de Origem</label>
                        <select className="p-sel" value={nhrPais} onChange={e=>setNhrPais(e.target.value)}>
                          {PAISES.map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="p-label">Tipo de Rendimento</label>
                        <select className="p-sel" value={nhrTipo} onChange={e=>setNhrTipo(e.target.value)}>
                          {TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="p-label">Rendimento Anual (€)</label>
                        <input className="p-inp" type="number" placeholder="ex: 150000" value={nhrRend} onChange={e=>setNhrRend(e.target.value)}/>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid rgba(14,14,13,.06)'}}>
                        <div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.5)',letterSpacing:'.06em'}}>Fonte Estrangeira</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)',marginTop:'1px'}}>Rendimento gerado fora de PT</div>
                        </div>
                        <div onClick={()=>setNhrFonte(f=>!f)} style={{width:'38px',height:'20px',borderRadius:'10px',background:nhrFonte?'#1c4a35':'rgba(14,14,13,.15)',cursor:'pointer',transition:'background .2s',position:'relative',flexShrink:0}}>
                          <div style={{position:'absolute',top:'3px',left:nhrFonte?'19px':'3px',width:'14px',height:'14px',borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                        </div>
                      </div>
                      <button className="p-btn" onClick={()=>runNHR()} disabled={nhrLoading||!nhrRend}>
                        {nhrLoading?'◌ A calcular...':'▶ Calcular Poupança'}
                      </button>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.28)',lineHeight:1.5}}>Simulação indicativa. Não substitui aconselhamento fiscal profissional.</div>
                  </div>

                  {/* ─ RIGHT: Results ─ */}
                  <div style={{flex:1,minWidth:0}}>
                    {!d && !nhrLoading && (
                      <div style={{height:'380px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'rgba(14,14,13,.2)',textAlign:'center',gap:'10px'}}>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'3rem',fontWeight:300,lineHeight:1}}>§</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.12em',textTransform:'uppercase'}}>Selecciona um perfil rápido</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem'}}>ou preenche o formulário e clica em Calcular</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',marginTop:'4px',padding:'8px 16px',border:'1px dashed rgba(14,14,13,.1)'}}>NHR · IFICI · IRS Normal · País de Origem</div>
                      </div>
                    )}
                    {nhrLoading && (
                      <div style={{height:'380px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.55rem',color:'#1c4a35',letterSpacing:'.2em'}}>◌ A calcular...</div>
                      </div>
                    )}
                    {d && !nhrLoading && (
                      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                        {/* Hero */}
                        <div style={{background:'#0c1f15',padding:'18px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
                          <div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.45)',letterSpacing:'.16em',textTransform:'uppercase',marginBottom:'4px'}}>Poupança anual estimada</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.6rem',fontWeight:300,color:'#c9a96e',lineHeight:1}}>€ {fmt(bestSaving)}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)',marginTop:'3px'}}>com {bestRegime} vs {d.perfil?.pais_nome}</div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'3px'}}>Em 10 anos</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.7rem',fontWeight:300,color:'rgba(201,169,110,.65)'}}>€ {fmt(best10)}</div>
                            <div style={{display:'inline-block',background:'rgba(201,169,110,.12)',border:'1px solid rgba(201,169,110,.25)',padding:'2px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.35rem',color:'#c9a96e',letterSpacing:'.1em',marginTop:'5px',textTransform:'uppercase'}}>✓ {bestRegime}</div>
                          </div>
                        </div>

                        {/* 4-regime grid */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                          {[
                            {label:d.perfil?.pais_nome||'Origem', data:d.origem_fiscal, color:'rgba(14,14,13,.4)', highlight:false},
                            {label:'IRS Normal PT', data:d.pt_normal, color:'rgba(14,14,13,.5)', highlight:false},
                            {label:'NHR', data:d.nhr_portugal, color:'#1c4a35', highlight:bestRegime==='NHR'},
                            {label:'IFICI', data:d.ifici_portugal, color:'#c9a96e', highlight:bestRegime==='IFICI'},
                          ].map(r=>(
                            <div key={r.label} style={{background:r.highlight?'rgba(28,74,53,.06)':'rgba(14,14,13,.02)',border:`1px solid ${r.highlight?'rgba(28,74,53,.3)':'rgba(14,14,13,.08)'}`,padding:'12px',position:'relative',borderTop:`${r.highlight?'3px':'1px'} solid ${r.highlight?'#1c4a35':'rgba(14,14,13,.08)'}`}}>
                              {r.highlight && <div style={{position:'absolute',top:'0',right:'6px',background:'#1c4a35',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.3rem',letterSpacing:'.08em',padding:'2px 6px',textTransform:'uppercase',transform:'translateY(-100%)'}}>✓ Recomendado</div>}
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.08em',color:'rgba(14,14,13,.35)',textTransform:'uppercase',marginBottom:'6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.label}</div>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',fontWeight:300,color:r.color,lineHeight:1}}>{r.data?.taxa_efetiva_pct}<span style={{fontSize:'.8rem',opacity:.6}}>%</span></div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.25)',marginBottom:'8px'}}>taxa efectiva</div>
                              <div style={{height:'3px',background:'rgba(14,14,13,.05)',borderRadius:'2px',marginBottom:'6px',overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${Math.min(r.data?.carga_total_pct||0,100)}%`,background:r.highlight?'#1c4a35':'rgba(14,14,13,.18)'}}/>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:r.color,fontWeight:600}}>€ {fmt(r.data?.rendimento_liquido)}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.25)'}}>líquido/ano</div>
                            </div>
                          ))}
                        </div>

                        {/* 10-year projection */}
                        <div className="p-card" style={{padding:'14px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'10px'}}>Projecção 10 Anos — 3% crescimento anual</div>
                          <div style={{display:'grid',gridTemplateColumns:'40px 1fr 1fr 1fr',gap:'3px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem'}}>
                            {(['Ano',d.perfil?.pais_nome,'NHR / IFICI','Poupança'] as string[]).map((h,i)=>(
                              <div key={h} style={{color:i===2?'#1c4a35':i===3?'rgba(14,14,13,.5)':'rgba(14,14,13,.3)',paddingBottom:'6px',borderBottom:'1px solid rgba(14,14,13,.06)',fontWeight:600}}>{h}</div>
                            ))}
                            {[1,2,3,5,7,10].map(yr=>{
                              const g = Math.pow(1.03, yr-1)
                              const r = d.perfil.rendimento_anual
                              const origRate = (d.origem_fiscal.imposto+d.origem_fiscal.ss_contribuicao)/r
                              const ptRate = (Math.min(d.nhr_portugal.imposto,d.ifici_portugal.imposto)+Math.min(d.nhr_portugal.ss_contribuicao,d.ifici_portugal.ss_contribuicao))/r
                              const rY = r * g
                              const origLiq = rY * (1-origRate)
                              const ptLiq = rY * (1-ptRate)
                              const poup = ptLiq - origLiq
                              return [
                                <div key={`a${yr}`} style={{color:'rgba(14,14,13,.35)',padding:'3px 0'}}>Y{yr}</div>,
                                <div key={`o${yr}`} style={{color:'rgba(14,14,13,.4)',padding:'3px 0'}}>€{(origLiq/1000).toFixed(0)}K</div>,
                                <div key={`n${yr}`} style={{color:'#1c4a35',padding:'3px 0'}}>€{(ptLiq/1000).toFixed(0)}K</div>,
                                <div key={`p${yr}`} style={{color:poup>0?'#1c4a35':'#e05454',padding:'3px 0',fontWeight:600}}>{poup>0?'+':''}€{(poup/1000).toFixed(0)}K</div>,
                              ]
                            })}
                          </div>
                        </div>

                        {/* Recomendação box */}
                        <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',padding:'12px 16px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.12em',textTransform:'uppercase',color:'#1c4a35',marginBottom:'4px'}}>Recomendação AG</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.6)',lineHeight:1.6}}>{d.recomendacao?.detalhe}</div>
                        </div>

                        {/* Sub-tabs */}
                        <div>
                          <div style={{display:'flex',gap:'0',borderBottom:'1px solid rgba(14,14,13,.1)'}}>
                            {([['elegib','Elegibilidade'],['processo','Processo (6 passos)'],['share','Enviar para Cliente']] as [string,string][]).map(([tab,lbl])=>(
                              <button key={tab} onClick={()=>setNhrSubTab(tab as typeof nhrSubTab)}
                                style={{background:'none',border:'none',borderBottom:`2px solid ${nhrSubTab===tab?'#1c4a35':'transparent'}`,color:nhrSubTab===tab?'#1c4a35':'rgba(14,14,13,.4)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',textTransform:'uppercase',padding:'9px 14px',cursor:'pointer',transition:'all .15s'}}>
                                {lbl}
                              </button>
                            ))}
                          </div>

                          {nhrSubTab==='elegib' && (
                            <div style={{padding:'14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                              <div style={{background:'rgba(28,74,53,.03)',border:'1px solid rgba(28,74,53,.1)',padding:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#1c4a35',marginBottom:'8px'}}>NHR (pré-2024)</div>
                                {d.elegibilidade_nhr?.condicoes?.map((c,i)=>(
                                  <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',lineHeight:1.4}}>
                                    <span style={{color:'#1c4a35',flexShrink:0}}>✓</span>{c}
                                  </div>
                                ))}
                                <div style={{marginTop:'8px',padding:'8px',background:'rgba(201,169,110,.05)',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.38)',lineHeight:1.5}}>{d.elegibilidade_nhr?.nota}</div>
                              </div>
                              <div style={{background:'rgba(201,169,110,.03)',border:'1px solid rgba(201,169,110,.12)',padding:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#c9a96e',marginBottom:'8px'}}>IFICI (2024+)</div>
                                {d.elegibilidade_ifici?.atividades_qualificadas?.map((a,i)=>(
                                  <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',lineHeight:1.4}}>
                                    <span style={{color:'#c9a96e',flexShrink:0}}>◆</span>{a}
                                  </div>
                                ))}
                                <div style={{marginTop:'8px',padding:'8px',background:'rgba(201,169,110,.05)',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.38)',lineHeight:1.5}}>{d.elegibilidade_ifici?.nota}</div>
                              </div>
                            </div>
                          )}

                          {nhrSubTab==='processo' && (
                            <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:'7px'}}>
                              {d.processo?.map((step,i)=>(
                                <div key={i} style={{display:'flex',gap:'12px',padding:'11px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.06)'}}>
                                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',fontWeight:300,color:'#c9a96e',lineHeight:1,minWidth:'26px',flexShrink:0}}>0{step.passo}</div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#0e0e0d',letterSpacing:'.05em',marginBottom:'3px'}}>{step.titulo}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.45)',lineHeight:1.5,marginBottom:'4px'}}>{step.descricao}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#1c4a35'}}>⏱ {step.prazo}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {nhrSubTab==='share' && (
                            <div style={{padding:'14px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginBottom:'10px',letterSpacing:'.06em'}}>Mensagem pronta para WhatsApp / Email:</div>
                              <div style={{background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)',padding:'14px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.6)',lineHeight:1.9,whiteSpace:'pre-wrap'}}>
{`🏡 SIMULAÇÃO FISCAL — PORTUGAL NHR/IFICI

País de origem: ${d.perfil?.pais_nome}
Rendimento anual: € ${fmt(d.perfil?.rendimento_anual)}
Tipo: ${d.perfil?.tipo_rendimento}

📊 COMPARAÇÃO:
${d.perfil?.pais_nome}: ${d.origem_fiscal?.taxa_efetiva_pct}% → Líquido € ${fmt(d.origem_fiscal?.rendimento_liquido)}/ano
NHR Portugal: ${d.nhr_portugal?.taxa_efetiva_pct}% → Líquido € ${fmt(d.nhr_portugal?.rendimento_liquido)}/ano
IFICI Portugal: ${d.ifici_portugal?.taxa_efetiva_pct}% → Líquido € ${fmt(d.ifici_portugal?.rendimento_liquido)}/ano

💰 Poupança anual: € ${fmt(bestSaving)}
📈 Em 10 anos: € ${fmt(best10)}
✅ Recomendação: ${bestRegime}

Agency Group · AMI 22506 · geral@agencygroup.pt`}
                              </div>
                              <button className="p-btn" style={{marginTop:'10px',maxWidth:'220px'}} onClick={()=>{
                                const txt = `🏡 SIMULAÇÃO FISCAL — PORTUGAL NHR/IFICI\n\nPaís: ${d.perfil?.pais_nome}\nRendimento: € ${fmt(d.perfil?.rendimento_anual)}\n\n💰 Poupança anual: € ${fmt(bestSaving)}\n📈 Em 10 anos: € ${fmt(best10)}\n✅ Recomendação: ${bestRegime}\n\nAgency Group · AMI 22506`
                                navigator.clipboard.writeText(txt).then(()=>alert('Copiado! ✓'))
                              }}>📋 Copiar para WhatsApp</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── MAIS-VALIAS ── */}
            {section==='maisvalias' && (
              <div style={{maxWidth:'900px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>CIRS 2026 · Coeficientes AT · Isenções automáticas</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'24px'}}>Simulador <em style={{color:'#1c4a35'}}>Mais-Valias</em></div>
                <div style={{display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap'}}>
                  <div className="p-card" style={{flex:'1',minWidth:'280px',display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <label className="p-label">Preço Compra (€)</label>
                        <input className="p-inp" type="number" id="pvMvCompra" placeholder="ex: 250000"/>
                      </div>
                      <div>
                        <label className="p-label">Ano Compra</label>
                        <select className="p-sel" id="pvMvAno">
                          {Array.from({length:27},(_,i)=>2000+i).reverse().map(y=>(
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="p-label">Preço Venda (€)</label>
                      <input className="p-inp" type="number" id="pvMvVenda" placeholder="ex: 420000"/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <label className="p-label">Despesas Compra (€)</label>
                        <input className="p-inp" type="number" id="pvMvDespAq" placeholder="IMT+IS+Notário"/>
                      </div>
                      <div>
                        <label className="p-label">Despesas Venda (€)</label>
                        <input className="p-inp" type="number" id="pvMvDespVd" placeholder="Comissão+Notário"/>
                      </div>
                    </div>
                    <div>
                      <label className="p-label">Obras c/ Factura — últimos 12 anos (€)</label>
                      <input className="p-inp" type="number" id="pvMvObras" placeholder="ex: 30000"/>
                    </div>
                    <div>
                      <label className="p-label">Rendimento Anual Colectável (€)</label>
                      <input className="p-inp" type="number" id="pvMvRendimento" placeholder="ex: 40000"/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'.75rem',color:'rgba(14,14,13,.6)'}}>
                        <input type="checkbox" id="pvMvResidente" defaultChecked style={{accentColor:'#1c4a35'}}/>Residente Fiscal PT
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'.75rem',color:'rgba(14,14,13,.6)'}}>
                        <input type="checkbox" id="pvMvHpp" defaultChecked style={{accentColor:'#1c4a35'}}/>Habitação Própria Permanente
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'.75rem',color:'rgba(14,14,13,.6)'}}>
                        <input type="checkbox" id="pvMvReinvest" style={{accentColor:'#1c4a35'}}/>Reinveste em nova HPP
                      </label>
                    </div>
                    <button className="p-btn" onClick={()=>{
                      const g=(id:string)=>(document.getElementById(id) as HTMLInputElement)?.value
                      const gb=(id:string)=>(document.getElementById(id) as HTMLInputElement)?.checked
                      const payload={
                        preco_aquisicao:parseFloat(g('pvMvCompra')||'0'),
                        preco_venda:parseFloat(g('pvMvVenda')||'0'),
                        ano_aquisicao:parseInt(g('pvMvAno')||'2010'),
                        despesas_aquisicao:parseFloat(g('pvMvDespAq')||'0'),
                        despesas_venda:parseFloat(g('pvMvDespVd')||'0'),
                        obras:parseFloat(g('pvMvObras')||'0'),
                        rendimento_anual:parseFloat(g('pvMvRendimento')||'40000'),
                        residente:gb('pvMvResidente'),
                        habitacao_propria:gb('pvMvHpp'),
                        reinvestimento:gb('pvMvReinvest'),
                      }
                      const btn=document.getElementById('pvMvBtn') as HTMLButtonElement
                      btn.textContent='A calcular...'
                      btn.disabled=true
                      fetch('/api/mais-valias',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
                        .then(r=>r.json())
                        .then(res=>{
                          btn.textContent='▶ Calcular Mais-Valias'
                          btn.disabled=false
                          const out=document.getElementById('pvMvOutput')
                          if(!out)return
                          if(res.error){out.innerHTML=`<div style="color:#e05252;padding:12px;border:1px solid rgba(224,82,82,.2);border-radius:6px;font-size:.78rem">${res.error}</div>`;return}
                          const eur=(n:number)=>'€ '+Math.abs(n).toLocaleString('pt-PT')
                          const isLoss=res.prejuizo>0
                          out.innerHTML=`
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
                              <div class="mtg-g"><div class="mtg-gl">Mais-Valia Bruta</div><div class="mtg-gv" style="color:${isLoss?'#e05252':'#1c4a35'}">${isLoss?'-':'+'}${eur(isLoss?res.prejuizo:res.ganho_bruto)}</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Imposto Estimado</div><div class="mtg-gv" style="color:#e05252">-${eur(res.imposto_estimado)}</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Taxa Efectiva</div><div class="mtg-gv">${res.taxa_efetiva?.toFixed(1)}%</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Líquido Final</div><div class="mtg-gv" style="color:#1c4a35">${eur(res.liquido_apos_imposto)}</div></div>
                              ${res.poupanca_reinvestimento>0?`<div class="mtg-g" style="grid-column:1/-1"><div class="mtg-gl">Poupança c/ Reinvestimento</div><div class="mtg-gv" style="color:#22c55e">+${eur(res.poupanca_reinvestimento)}</div></div>`:''}
                            </div>
                            <div style="font-size:.7rem;color:rgba(14,14,13,.4);border-top:1px solid rgba(14,14,13,.08);padding-top:10px;line-height:1.6">${res.mensagem}</div>
                            <details style="margin-top:12px">
                              <summary style="font-size:.73rem;color:#1c4a35;cursor:pointer">Ver breakdown detalhado</summary>
                              <div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">
                                ${(res.breakdown||[]).map((b:{label:string,valor:number,tipo:string})=>`
                                  <div style="display:flex;justify-content:space-between;font-size:.73rem;padding:5px 8px;border-radius:3px;background:rgba(14,14,13,.02)">
                                    <span style="color:rgba(14,14,13,.55)">${b.label}</span>
                                    <span style="color:${b.tipo==='positivo'?'#22c55e':b.tipo==='negativo'||b.tipo==='imposto'?'#e05252':b.tipo==='resultado'?'#1c4a35':'rgba(14,14,13,.6)'}">${b.valor>=0?'+':''}${eur(b.valor)}</span>
                                  </div>`).join('')}
                              </div>
                            </details>
                          `
                        })
                        .catch(()=>{
                          const btn2=document.getElementById('pvMvBtn') as HTMLButtonElement
                          if(btn2){btn2.textContent='▶ Calcular Mais-Valias';btn2.disabled=false}
                        })
                    }} id="pvMvBtn">▶ Calcular Mais-Valias</button>
                    <div id="pvMvOutput" style={{marginTop:'4px'}}/>
                  </div>
                  <div style={{flex:'1',minWidth:'220px',display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div className="p-card" style={{padding:'14px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'8px'}}>Referência Legal</div>
                      {[
                        'Coeficientes AT 2026 (Art. 47º CIRS)',
                        'Isenção HPP + reinvestimento (Art. 10º/5)',
                        'Taxa 28% não-residentes (Art. 72º CIRS)',
                        '50% englobamento residentes (Art. 43º)',
                        'Dedução obras c/ factura (Art. 51º)',
                      ].map(t=>(
                        <div key={t} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'.73rem',color:'rgba(14,14,13,.5)',padding:'4px 0',borderBottom:'1px solid rgba(14,14,13,.04)'}}>
                          <div style={{width:'5px',height:'5px',background:'#1c4a35',borderRadius:'50%',flexShrink:0}}/>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── FINANCIAMENTO NÃO-RESIDENTES ── */}
            {section==='financiamento' && (
              <div style={{maxWidth:'900px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>10 Países · LTV · Spreads · Islamic Finance</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'24px'}}>Crédito <em style={{color:'#1c4a35'}}>para Estrangeiros</em></div>
                <div style={{display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap'}}>
                  <div className="p-card" style={{flex:'1',minWidth:'280px',display:'flex',flexDirection:'column',gap:'10px'}} id="pvFnrWidget">
                    <div>
                      <label className="p-label">País de Residência</label>
                      <select className="p-sel" id="pvFnrPais">
                        <option value="FR">🇫🇷 França</option>
                        <option value="DE">🇩🇪 Alemanha</option>
                        <option value="GB">🇬🇧 Reino Unido</option>
                        <option value="US">🇺🇸 Estados Unidos</option>
                        <option value="CN">🇨🇳 China</option>
                        <option value="AE">🇦🇪 Emirados Árabes</option>
                        <option value="BR">🇧🇷 Brasil</option>
                        <option value="SA">🇸🇦 Arábia Saudita</option>
                        <option value="CA">🇨🇦 Canadá</option>
                        <option value="AU">🇦🇺 Austrália</option>
                        <option value="OTHER">🌍 Outro país</option>
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <label className="p-label">Valor do Imóvel (€)</label>
                        <input className="p-inp" type="number" id="pvFnrMontante" placeholder="ex: 500000"/>
                      </div>
                      <div>
                        <label className="p-label">Prazo (anos)</label>
                        <select className="p-sel" id="pvFnrPrazo">
                          {[10,15,20,25,30].map(y=><option key={y} value={y}>{y} anos</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="p-label">Rendimento Anual Bruto (€) — opcional</label>
                      <input className="p-inp" type="number" id="pvFnrRendimento" placeholder="ex: 80000"/>
                    </div>
                    <button className="p-btn" onClick={()=>{
                      const g=(id:string)=>(document.getElementById(id) as HTMLInputElement|HTMLSelectElement)?.value
                      const payload={
                        country_code:g('pvFnrPais'),
                        montante:parseFloat(g('pvFnrMontante')||'0'),
                        prazo:parseInt(g('pvFnrPrazo')||'25'),
                        rendimento_anual:parseFloat(g('pvFnrRendimento')||'0')||undefined,
                      }
                      const btn=document.getElementById('pvFnrBtn') as HTMLButtonElement
                      btn.textContent='A calcular...'
                      btn.disabled=true
                      fetch('/api/financing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
                        .then(r=>r.json())
                        .then(res=>{
                          btn.textContent='▶ Calcular Crédito'
                          btn.disabled=false
                          const out=document.getElementById('pvFnrOutput')
                          if(!out)return
                          if(res.error){out.innerHTML=`<div style="color:#e05252;padding:12px;border:1px solid rgba(224,82,82,.2);border-radius:6px;font-size:.78rem">${res.error}</div>`;return}
                          const eur=(n:number)=>'€ '+Math.round(n).toLocaleString('pt-PT')
                          const f=res.financiamento
                          const p=res.prestacoes
                          const diff=res.country.difficulty
                          const diffColor=diff==='Fácil'?'#22c55e':diff==='Moderado'?'#c6a868':diff==='Difícil'?'#e09552':'#e05252'
                          out.innerHTML=`
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                              <span style="font-size:1.4rem">${res.country.flag}</span>
                              <span style="font-size:.72rem;color:${diffColor};border:1px solid ${diffColor};padding:2px 10px;border-radius:20px">${diff}</span>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
                              <div class="mtg-g"><div class="mtg-gl">LTV Máximo</div><div class="mtg-gv" style="color:#1c4a35">${f.ltv_max_pct}%</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Entrada Mínima</div><div class="mtg-gv">${eur(f.entrada_minima)}</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Capital Máximo</div><div class="mtg-gv">${eur(f.capital_maximo)}</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Spread Típico</div><div class="mtg-gv">${f.spread_tipico_pct}%</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Prestação/mês</div><div class="mtg-gv" style="color:#1c4a35">${eur(p.cenario_tipico)}</div></div>
                              <div class="mtg-g"><div class="mtg-gl">Prazo Máximo</div><div class="mtg-gv">${f.prazo_max_anos} anos</div></div>
                            </div>
                            ${res.acessibilidade?`<div style="padding:8px;background:rgba(${res.acessibilidade.dsti_ok?'34,197,94':'224,82,82'},.07);border-radius:5px;font-size:.73rem;color:rgba(14,14,13,.6);margin-bottom:10px">${res.acessibilidade.nota}</div>`:''}
                            <details style="margin-bottom:10px">
                              <summary style="font-size:.72rem;color:#1c4a35;cursor:pointer">Documentação necessária</summary>
                              <div style="margin-top:6px;display:flex;flex-direction:column;gap:5px">
                                ${res.notas.map((n:string)=>`<div style="font-size:.72rem;color:rgba(14,14,13,.5);display:flex;gap:7px"><span style="color:#1c4a35;flex-shrink:0">›</span>${n}</div>`).join('')}
                                ${res.islamic_finance?`<div style="font-size:.72rem;color:#c6a868;background:rgba(198,168,104,.08);padding:5px 8px;border-radius:3px;margin-top:3px">☽ Islamic Finance disponível</div>`:''}
                              </div>
                            </details>
                            <div style="font-size:.68rem;color:rgba(14,14,13,.3);border-top:1px solid rgba(14,14,13,.06);padding-top:7px">Bancos: ${res.bancos_recomendados.join(' · ')}</div>
                          `
                        })
                        .catch(()=>{
                          const btn2=document.getElementById('pvFnrBtn') as HTMLButtonElement
                          if(btn2){btn2.textContent='▶ Calcular Crédito';btn2.disabled=false}
                        })
                    }} id="pvFnrBtn">▶ Calcular Crédito</button>
                    <div id="pvFnrOutput" style={{marginTop:'4px'}}/>
                  </div>
                  <div style={{flex:'1',minWidth:'220px',display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div className="p-card" style={{padding:'14px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.28)',marginBottom:'8px'}}>LTV por Origem</div>
                      {[
                        {flag:'🇫🇷🇩🇪🇧🇷',label:'França · Alemanha · Brasil',ltv:'até 80%'},
                        {flag:'🇬🇧🇦🇪🇸🇦',label:'UK · Emirados · Arábia Saudita',ltv:'até 70%'},
                        {flag:'🇺🇸🇨🇦🇦🇺',label:'EUA · Canadá · Austrália',ltv:'65–70%'},
                        {flag:'🇨🇳',label:'China',ltv:'até 60%'},
                      ].map(r=>(
                        <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.73rem',padding:'5px 0',borderBottom:'1px solid rgba(14,14,13,.04)'}}>
                          <div style={{color:'rgba(14,14,13,.5)'}}>{r.flag} {r.label}</div>
                          <div style={{color:'#1c4a35',fontWeight:600}}>{r.ltv}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PORTFOLIO ── */}
            {section==='portfolio' && (
              <div style={{maxWidth:'960px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Score 16D · Ranking automático · Simulador de Investimento</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'20px'}}>Portfolio <em style={{color:'#1c4a35'}}>Análise</em></div>

                {/* Tab navigation */}
                <div style={{display:'flex',gap:'0',marginBottom:'24px',borderBottom:'1px solid rgba(14,14,13,.1)'}}>
                  {([['comparar','⚖ Comparar Imóveis'],['simulador','📊 Simulador de Portfólio']] as const).map(([t,l])=>(
                    <button key={t} onClick={()=>setPortfolioTab(t)}
                      style={{padding:'10px 20px',background:'none',border:'none',borderBottom:`2px solid ${portfolioTab===t?'#1c4a35':'transparent'}`,fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.12em',textTransform:'uppercase',color:portfolioTab===t?'#1c4a35':'rgba(14,14,13,.4)',cursor:'pointer',transition:'all .2s'}}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* ── TAB: COMPARAR ── */}
                {portfolioTab === 'comparar' && <div>
                <div className="p-card" style={{marginBottom:'16px'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                    {portItems.map((v,i)=>(
                      <div key={i} style={{display:'flex',gap:'8px',alignItems:'center'}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#c9a96e',minWidth:'20px'}}>0{i+1}</span>
                        <input className="p-inp" placeholder={i===0?'https://idealista.pt/... ou descrição':'Imóvel '+(i+1)} value={v} onChange={e=>{const n=[...portItems];n[i]=e.target.value;setPortItems(n)}}/>
                      </div>
                    ))}
                    {portItems.length < 5 && (
                      <button style={{background:'none',border:'1px dashed rgba(14,14,13,.2)',color:'rgba(14,14,13,.4)',padding:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.12em',textTransform:'uppercase',cursor:'pointer'}} onClick={()=>setPortItems(p=>[...p,''])}>
                        + Adicionar
                      </button>
                    )}
                  </div>
                  <button className="p-btn" onClick={runPortfolio} disabled={portLoading}>{portLoading?'A analisar...':'Comparar Imóveis'}</button>
                </div>
                {portResult && (() => {
                  type PortItem = {rank:number;classificacao:string;score_total:number;valor_justo:number;oferta_recomendada:number;yield_bruto:number;desconto_percentagem:number;irr_estimado?:number;cap_rate?:number;drivers_up?:string[];drivers_down?:string[]}
                  const d = portResult as {ranking:Array<PortItem>}
                  const maxScore = Math.max(...(d.ranking?.map(p=>p.score_total)||[100]))
                  return (
                    <div>
                      {/* Header bar */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'12px',marginBottom:'16px'}}>
                        {[
                          {label:'Imóveis Analisados',val:`${d.ranking?.length||0}`},
                          {label:'Melhor Score',val:`${d.ranking?.[0]?.score_total||'—'}/100`},
                          {label:'Melhor Yield',val:`${Math.max(...(d.ranking?.map(p=>p.yield_bruto)||[0])).toFixed(1)}%`},
                          {label:'Maior Desconto',val:`${Math.max(...(d.ranking?.map(p=>p.desconto_percentagem)||[0])).toFixed(1)}%`},
                          {label:'Recomendação',val:d.ranking?.[0]?.classificacao||'—'},
                        ].map(s=>(
                          <div key={s.label} style={{background:'rgba(28,74,53,.05)',border:'1px solid rgba(28,74,53,.1)',padding:'12px 16px',borderTop:'2px solid #1c4a35'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>{s.label}</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',fontWeight:300,color:'#1c4a35'}}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                        {d.ranking?.map((p,i)=>{
                          const action = p.score_total >= 75 ? 'COMPRAR' : p.score_total >= 55 ? 'ANALISAR' : 'EVITAR'
                          const actionColor = p.score_total >= 75 ? '#1c4a35' : p.score_total >= 55 ? '#c9a96e' : '#e05454'
                          const actionBg = p.score_total >= 75 ? 'rgba(28,74,53,.08)' : p.score_total >= 55 ? 'rgba(201,169,110,.1)' : 'rgba(220,80,60,.06)'
                          const barW = (p.score_total / maxScore) * 100
                          return (
                            <div key={i} className={`port-card${i===0?' top':''}`}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                                <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.5rem',fontWeight:300,color:i===0?'#1c4a35':'rgba(14,14,13,.5)',lineHeight:1,minWidth:'40px'}}>#{p.rank}</div>
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'2px'}}>{p.classificacao}</div>
                                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',fontWeight:300,color:'#0e0e0d',lineHeight:1}}>{p.score_total}<span style={{fontSize:'.9rem',opacity:.3}}>/100</span></div>
                                  </div>
                                </div>
                                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                                  <div style={{background:actionBg,border:`1px solid ${actionColor}40`,padding:'4px 12px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',color:actionColor,fontWeight:600}}>{action}</div>
                                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#c9a96e',lineHeight:1}}>€{(p.oferta_recomendada/1000).toFixed(0)}K</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)'}}>oferta recomendada</div>
                                </div>
                              </div>
                              {/* Score bar */}
                              <div style={{height:'3px',background:'rgba(14,14,13,.06)',marginBottom:'12px',borderRadius:'1px',overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${barW}%`,background:i===0?'#1c4a35':'#c9a96e',borderRadius:'1px',transition:'width .4s'}}/>
                              </div>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
                                {[
                                  ['Valor Justo',`€${(p.valor_justo/1000).toFixed(0)}K`,'#0e0e0d'],
                                  ['Desconto',`${p.desconto_percentagem}%`,p.desconto_percentagem>=5?'#1c4a35':'rgba(14,14,13,.5)'],
                                  ['Yield Bruto',`${p.yield_bruto}%`,p.yield_bruto>=4?'#1c4a35':p.yield_bruto>=2?'#c9a96e':'#888'],
                                  ['IRR Est.',p.irr_estimado?`${p.irr_estimado.toFixed(1)}%`:'—',p.irr_estimado&&p.irr_estimado>=12?'#1c4a35':'rgba(14,14,13,.5)'],
                                  ['Cap Rate',p.cap_rate?`${p.cap_rate.toFixed(2)}%`:'—','rgba(14,14,13,.5)'],
                                ].map(([l,v,c])=>(
                                  <div key={String(l)}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'2px'}}>{l}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.6rem',color:String(c)}}>{v}</div>
                                  </div>
                                ))}
                              </div>
                              {/* Drivers */}
                              {((p.drivers_up?.length||0) + (p.drivers_down?.length||0)) > 0 && (
                                <div style={{marginTop:'10px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                                  {p.drivers_up?.slice(0,3).map((d,j)=><span key={j} style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',background:'rgba(28,74,53,.07)',color:'#1c4a35',padding:'2px 8px',borderRadius:'2px'}}>{d}</span>)}
                                  {p.drivers_down?.slice(0,2).map((d,j)=><span key={j} style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',background:'rgba(220,80,60,.06)',color:'#e05454',padding:'2px 8px',borderRadius:'2px'}}>{d}</span>)}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
                </div>}

                {/* ── TAB: SIMULADOR DE PORTFÓLIO ── */}
                {portfolioTab === 'simulador' && (
                  <div>
                    {showPropertyPicker && (
                      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowPropertyPicker(false)}>
                        <div style={{background:'#fff',maxWidth:'600px',width:'90%',maxHeight:'70vh',overflowY:'auto',padding:'24px'}} onClick={e=>e.stopPropagation()}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>Seleccionar Imóvel</div>
                          {PORTAL_PROPERTIES.filter(p=>!portfolioProperties.find(pp=>pp.id===p.id)).map(p=>(
                            <div key={p.id} onClick={()=>{setPortfolioProperties(prev=>[...prev,{id:p.id,name:p.nome,currentValue:p.preco,downPayment:20,rentalYield:4.5,appreciation:5}]);setShowPropertyPicker(false)}}
                              style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px',border:'1px solid rgba(14,14,13,.08)',marginBottom:'6px',cursor:'pointer',transition:'all .2s'}}
                              onMouseOver={e=>(e.currentTarget as HTMLDivElement).style.borderColor='#1c4a35'}
                              onMouseOut={e=>(e.currentTarget as HTMLDivElement).style.borderColor='rgba(14,14,13,.08)'}>
                              <div>
                                <div style={{fontWeight:500,fontSize:'.86rem',color:'#0e0e0d'}}>{p.nome}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>{p.zona} · {p.tipo} · {p.area}m²</div>
                              </div>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',color:'#1c4a35'}}>€{(p.preco/1e6).toFixed(2)}M</div>
                            </div>
                          ))}
                          {PORTAL_PROPERTIES.filter(p=>!portfolioProperties.find(pp=>pp.id===p.id)).length===0 && (
                            <div style={{textAlign:'center',padding:'20px',color:'rgba(14,14,13,.4)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem'}}>Todos os imóveis já adicionados</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.1em',color:'rgba(14,14,13,.5)'}}>{portfolioProperties.length} imóveis · máx. 5</div>
                      {portfolioProperties.length < 5 && (
                        <button className="p-btn p-btn-gold" style={{padding:'8px 18px',fontSize:'.44rem'}} onClick={()=>setShowPropertyPicker(true)}>+ Adicionar Imóvel</button>
                      )}
                    </div>

                    {portfolioProperties.length === 0 && (
                      <div style={{textAlign:'center',padding:'60px 24px',border:'2px dashed rgba(14,14,13,.12)',color:'rgba(14,14,13,.3)'}}>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'2rem',fontWeight:300,marginBottom:'8px'}}>Portfólio Vazio</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',marginBottom:'16px'}}>Adiciona imóveis para calcular o retorno do portfólio</div>
                        <button className="p-btn" onClick={()=>setShowPropertyPicker(true)}>+ Adicionar Imóvel</button>
                      </div>
                    )}

                    {portfolioProperties.map((pp,idx)=>(
                      <div key={pp.id} className="p-card" style={{marginBottom:'12px',padding:'16px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                          <div>
                            <div style={{fontWeight:500,fontSize:'.88rem',color:'#0e0e0d'}}>{pp.name}</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:'#1c4a35',lineHeight:1}}>€{(pp.currentValue/1e6).toFixed(2)}M</div>
                          </div>
                          <button onClick={()=>setPortfolioProperties(prev=>prev.filter((_,i)=>i!==idx))}
                            style={{background:'none',border:'1px solid rgba(220,38,38,.2)',color:'#dc2626',padding:'4px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer'}}>
                            ✕ Remover
                          </button>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
                          {([
                            {label:'Valor (€)',field:'currentValue' as const,step:10000,min:50000,max:99999999},
                            {label:'Entrada (%)',field:'downPayment' as const,step:5,min:10,max:100},
                            {label:'Yield Renda (%)',field:'rentalYield' as const,step:0.5,min:0,max:20},
                            {label:'Valoriz. Anual (%)',field:'appreciation' as const,step:0.5,min:0,max:20},
                          ]).map(f=>(
                            <div key={f.field}>
                              <label className="p-label">{f.label}</label>
                              <input className="p-inp" type="number" step={f.step} min={f.min} max={f.max}
                                value={pp[f.field]}
                                onChange={e=>setPortfolioProperties(prev=>prev.map((p,i)=>i===idx?{...p,[f.field]:parseFloat(e.target.value)||0}:p))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {portfolioStats && (
                      <div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'16px',marginTop:'8px'}}>
                          {[
                            {label:'Valor Total',val:`€${(portfolioStats.totalValue/1e6).toFixed(2)}M`,color:'#0e0e0d'},
                            {label:'Equity Total',val:`€${(portfolioStats.totalEquity/1e6).toFixed(2)}M`,color:'#1c4a35'},
                            {label:'Renda Anual',val:`€${Math.round(portfolioStats.totalRental/1000)}K`,color:'#c9a96e'},
                            {label:'Valor em 5 Anos',val:`€${(portfolioStats.value5y/1e6).toFixed(2)}M`,color:'#1c4a35'},
                            {label:'Valor em 10 Anos',val:`€${(portfolioStats.value10y/1e6).toFixed(2)}M`,color:'#1c4a35'},
                            {label:'ROI 10 Anos',val:`+${portfolioStats.roi10y.toFixed(1)}%`,color:'#c9a96e'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'16px',borderTop:'2px solid #1c4a35'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>{s.label}</div>
                              <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.6rem',fontWeight:300,color:s.color,lineHeight:1}}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        <div className="p-card" style={{padding:'20px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'16px'}}>Crescimento de Valor — 10 Anos</div>
                          <div style={{display:'flex',alignItems:'flex-end',gap:'6px',height:'140px'}}>
                            {[0,1,2,3,4,5,6,7,8,9,10].map(yr=>{
                              const val = portfolioProperties.reduce((s,p)=>s+p.currentValue*Math.pow(1+p.appreciation/100,yr),0)
                              const maxVal = portfolioProperties.reduce((s,p)=>s+p.currentValue*Math.pow(1+p.appreciation/100,10),0)
                              const pct = maxVal>0?(val/maxVal)*100:20
                              return (
                                <div key={yr} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',color:'#1c4a35'}}>{yr>0?`+${((val/portfolioStats.totalValue-1)*100).toFixed(0)}%`:''}</div>
                                  <div title={`Ano ${yr}: €${(val/1e6).toFixed(2)}M`}
                                    style={{width:'100%',height:`${pct}%`,background:yr===0?'rgba(14,14,13,.12)':yr===10?'#1c4a35':'rgba(28,74,53,.4)',borderRadius:'2px 2px 0 0',minHeight:'4px'}}/>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.28rem',color:'rgba(14,14,13,.35)'}}>A{yr}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',marginTop:'12px',paddingTop:'8px',borderTop:'1px solid rgba(14,14,13,.06)'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>Actual: <strong style={{color:'#0e0e0d'}}>€{(portfolioStats.totalValue/1e6).toFixed(2)}M</strong></div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#1c4a35'}}>10 anos: <strong>€{(portfolioStats.value10y/1e6).toFixed(2)}M</strong></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PIPELINE ── */}
            {section==='pipeline' && (
              <div>
                {/* Header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px',flexWrap:'wrap',gap:'12px'}}>
                  <div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>Da angariação à escritura</div>
                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d'}}>Pipeline <em style={{color:'#1c4a35'}}>CPCV</em></div>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <input className="p-inp" placeholder="🔍 Pesquisar deal..." value={pipelineSearch} onChange={e=>setPipelineSearch(e.target.value)} style={{width:'160px',padding:'8px 12px'}}/>
                    <div style={{display:'flex',border:'1px solid rgba(14,14,13,.12)',overflow:'hidden'}}>
                      {(['lista','kanban'] as const).map(v=>(
                        <button key={v} onClick={()=>setPipelineView(v)}
                          style={{padding:'8px 14px',background:pipelineView===v?'#1c4a35':'transparent',color:pipelineView===v?'#f4f0e6':'rgba(14,14,13,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',border:'none',cursor:'pointer',transition:'all .15s'}}>
                          {v==='lista'?'☰ Lista':'⠿ Kanban'}
                        </button>
                      ))}
                    </div>
                    <button className="p-btn p-btn-gold" onClick={()=>setShowNewDeal(true)}>+ Novo Deal</button>
                  </div>
                </div>

                {/* Pipeline KPI strip */}
                {(()=>{
                  const totalVal = deals.reduce((s,d)=>s+(parseFloat(d.valor.replace(/[^0-9.]/g,''))||0),0)
                  const totalComm = totalVal * 0.05
                  const dealsByStage = PIPELINE_STAGES.map(s=>({stage:s,count:deals.filter(d=>d.fase===s).length,val:deals.filter(d=>d.fase===s).reduce((a,d2)=>a+(parseFloat(d2.valor.replace(/[^0-9.]/g,''))||0),0)})).filter(s=>s.count>0)
                  const maxVal = Math.max(...dealsByStage.map(s=>s.val),1)
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'180px 180px 1fr',gap:'8px',marginBottom:'16px'}}>
                      <div style={{background:'#0c1f15',padding:'14px 16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.4)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'4px'}}>Pipeline Total</div>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.7rem',fontWeight:300,color:'#c9a96e',lineHeight:1}}>€ {(totalVal/1e6).toFixed(2)}M</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.2)',marginTop:'3px'}}>{deals.length} deals activos</div>
                      </div>
                      <div style={{background:'rgba(28,74,53,.05)',border:'1px solid rgba(28,74,53,.12)',padding:'14px 16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(28,74,53,.55)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'4px'}}>Comissão 5%</div>
                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.7rem',fontWeight:300,color:'#1c4a35',lineHeight:1}}>€ {(totalComm/1e3).toFixed(0)}K</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)',marginTop:'3px'}}>50% CPCV + 50% Escritura</div>
                      </div>
                      <div style={{background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)',padding:'14px 16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'8px'}}>Funil por Fase</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {dealsByStage.map(s=>(
                            <div key={s.stage} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.4)',width:'90px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:0}}>{s.stage}</div>
                              <div style={{flex:1,height:'5px',background:'rgba(14,14,13,.06)',borderRadius:'3px',overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${(s.val/maxVal)*100}%`,background:STAGE_COLOR[s.stage]||'#888'}}/>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.4)',width:'45px',textAlign:'right',flexShrink:0}}>€{Math.round(s.val/1e3)}K</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.25)',width:'20px',textAlign:'right',flexShrink:0}}>{s.count}×</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* New Deal Form */}
                {showNewDeal && (
                  <div className="p-card" style={{marginBottom:'16px',border:'1px solid #c9a96e'}}>
                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'16px'}}>Novo Deal</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                      <div style={{gridColumn:'1/-1'}}><label className="p-label">Imóvel</label><input className="p-inp" placeholder="ex: Villa T4 · Cascais" value={newDeal.imovel} onChange={e=>setNewDeal(p=>({...p,imovel:e.target.value}))}/></div>
                      <div><label className="p-label">Valor</label><input className="p-inp" placeholder="ex: € 1.500.000" value={newDeal.valor} onChange={e=>setNewDeal(p=>({...p,valor:e.target.value}))}/></div>
                      <div><label className="p-label">Comprador</label><input className="p-inp" placeholder="Nome do comprador" value={newDeal.imovel ? '' : ''} onChange={()=>{}}/></div>
                      <div><label className="p-label">Fase Inicial</label>
                        <select className="p-sel" defaultValue="Angariação">
                          {PIPELINE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'8px'}}>
                      <button className="p-btn" onClick={addDeal}>Criar Deal</button>
                      <button style={{background:'none',border:'1px solid rgba(14,14,13,.15)',color:'rgba(14,14,13,.5)',padding:'12px 20px',fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.14em',textTransform:'uppercase',cursor:'pointer'}} onClick={()=>setShowNewDeal(false)}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* LISTA VIEW */}
                {pipelineView==='lista' && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px'}}>
                    {deals.filter(d=>!pipelineSearch||d.imovel.toLowerCase().includes(pipelineSearch.toLowerCase())||d.ref.toLowerCase().includes(pipelineSearch.toLowerCase())).map(d=>{
                      const val = parseFloat(d.valor.replace(/[^0-9.]/g,''))||0
                      const comm = val * 0.05
                      const allChecks = Object.values(d.checklist).flat()
                      const checksDone = allChecks.filter(Boolean).length
                      const checksTotal = allChecks.length
                      const nextStageIdx = PIPELINE_STAGES.indexOf(d.fase)+1
                      const nextStage = nextStageIdx < PIPELINE_STAGES.length ? PIPELINE_STAGES[nextStageIdx] : null
                      const buyer = crmContacts.find(c=>val>=c.budgetMin*0.8&&val<=c.budgetMax*1.2)
                      return (
                        <div key={d.id} className={`deal-card${activeDeal===d.id?' active':''}`} onClick={()=>setActiveDeal(activeDeal===d.id?null:d.id)}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.3)',letterSpacing:'.1em',marginBottom:'3px'}}>{d.ref}</div>
                              <div style={{fontSize:'.85rem',color:'#0e0e0d',fontWeight:500,marginBottom:'2px'}}>{d.imovel}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.62rem',color:'#c9a96e'}}>{d.valor}</div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px',flexShrink:0,marginLeft:'8px'}}>
                              <select value={d.fase} onClick={e=>e.stopPropagation()} onChange={e=>changeFase(d.id,e.target.value)} style={{background:'none',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.06em',color:STAGE_COLOR[d.fase]||'#888',cursor:'pointer',outline:'none',textAlign:'right',maxWidth:'130px'}}>
                                {PIPELINE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                              <button onClick={e=>{e.stopPropagation();window.open(`https://wa.me/351919948986?text=${encodeURIComponent(`${d.ref} — ${d.imovel}\nValor: ${d.valor}\nFase: ${d.fase}`)}`, '_blank')}}
                                style={{background:'rgba(28,74,53,.08)',border:'none',color:'#1c4a35',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',cursor:'pointer'}}>WA</button>
                              <button onClick={e=>{e.stopPropagation();const link=`${window.location.origin}/deal/${d.ref}`;navigator.clipboard.writeText(link).then(()=>alert(`✓ Link copiado!\n${link}`)).catch(()=>window.open(link,'_blank'))}}
                                style={{background:'rgba(201,169,110,.12)',border:'1px solid rgba(201,169,110,.3)',color:'#c9a96e',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.06em',cursor:'pointer'}} title="Partilhar timeline com cliente">↗ Partilhar</button>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{height:'3px',background:'rgba(14,14,13,.08)',borderRadius:'2px',overflow:'hidden',marginBottom:'8px'}}>
                            <div style={{height:'100%',width:`${STAGE_PCT[d.fase]||10}%`,background:STAGE_COLOR[d.fase]||'#888',borderRadius:'2px',transition:'width .4s ease'}}/>
                          </div>
                          {/* Bottom strip */}
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'4px'}}>
                            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)'}}>{STAGE_PCT[d.fase]||10}%</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(28,74,53,.6)'}}>5% → €{Math.round(comm/1e3)}K</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)'}}>{checksDone}/{checksTotal} ✓</span>
                            </div>
                            <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                              {buyer && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#c9a96e',background:'rgba(201,169,110,.08)',padding:'2px 6px',border:'1px solid rgba(201,169,110,.2)'}}>{buyer.name.split(' ')[0]}</span>}
                              {nextStage && <button onClick={e=>{e.stopPropagation();changeFase(d.id,nextStage)}}
                                style={{background:'rgba(28,74,53,.07)',border:'1px solid rgba(28,74,53,.15)',color:'#1c4a35',padding:'2px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',cursor:'pointer',letterSpacing:'.06em'}}>
                                → {nextStage.split(' ')[0]}
                              </button>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* KANBAN VIEW */}
                {pipelineView==='kanban' && (
                  <div style={{overflowX:'auto',paddingBottom:'16px',marginBottom:'16px'}}>
                    <div style={{display:'flex',gap:'10px',minWidth:`${PIPELINE_STAGES.length*200}px`,alignItems:'flex-start'}}>
                      {PIPELINE_STAGES.map(stage=>{
                        const stageDeals = deals.filter(d=>d.fase===stage&&(!pipelineSearch||d.imovel.toLowerCase().includes(pipelineSearch.toLowerCase())))
                        const stageVal = stageDeals.reduce((s,d)=>s+(parseFloat(d.valor.replace(/[^0-9.]/g,''))||0),0)
                        const nextStageIdx = PIPELINE_STAGES.indexOf(stage)+1
                        const nextStage = nextStageIdx < PIPELINE_STAGES.length ? PIPELINE_STAGES[nextStageIdx] : null
                        return (
                          <div key={stage} style={{width:'196px',flexShrink:0}}>
                            <div style={{padding:'8px 10px',background:'rgba(14,14,13,.04)',border:'1px solid rgba(14,14,13,.08)',borderTop:`3px solid ${STAGE_COLOR[stage]||'#888'}`,marginBottom:'6px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.08em',color:'rgba(14,14,13,.5)',textTransform:'uppercase',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{stage}</div>
                              <div style={{display:'flex',justifyContent:'space-between',marginTop:'3px'}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:STAGE_COLOR[stage]||'#888'}}>{stageDeals.length}×</span>
                                {stageVal>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>€{(stageVal/1e3).toFixed(0)}K</span>}
                              </div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:'6px',minHeight:'80px'}}>
                              {stageDeals.map(d=>{
                                const val = parseFloat(d.valor.replace(/[^0-9.]/g,''))||0
                                const comm = val*0.05
                                const allChecks = Object.values(d.checklist).flat()
                                const checksDone = allChecks.filter(Boolean).length
                                return (
                                  <div key={d.id} className="deal-card" style={{padding:'10px',cursor:'pointer',margin:0}} onClick={()=>{setActiveDeal(d.id);setPipelineView('lista')}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)',marginBottom:'2px'}}>{d.ref}</div>
                                    <div style={{fontSize:'.78rem',color:'#0e0e0d',fontWeight:500,lineHeight:1.3,marginBottom:'5px'}}>{d.imovel}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#c9a96e',marginBottom:'6px'}}>{d.valor}</div>
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'3px'}}>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(28,74,53,.55)'}}>€{Math.round(comm/1e3)}K com.</span>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)'}}>{checksDone}/{allChecks.length} ✓</span>
                                    </div>
                                    {nextStage && <button onClick={e=>{e.stopPropagation();changeFase(d.id,nextStage)}}
                                      style={{marginTop:'6px',width:'100%',background:'rgba(28,74,53,.06)',border:'1px solid rgba(28,74,53,.12)',color:'#1c4a35',padding:'4px',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',cursor:'pointer',letterSpacing:'.06em',textAlign:'center'}}>
                                      → {nextStage}
                                    </button>}
                                  </div>
                                )
                              })}
                              {stageDeals.length===0 && <div style={{height:'50px',border:'1px dashed rgba(14,14,13,.07)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.18)'}}>—</span></div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {activeDeal && (() => {
                  const deal = deals.find(d=>d.id===activeDeal)
                  if (!deal) return null
                  const fase = deal.fase
                  const preco = parseFloat(deal.valor.replace(/[^0-9.]/g,'')) || 0

                  // ── XIRR helper (Newton-Raphson) ──
                  function calcXirr(cfs: number[], rate0 = 0.1): number {
                    let r = rate0
                    for (let i = 0; i < 80; i++) {
                      const n = cfs.length; let npv = 0, dnpv = 0
                      for (let y = 0; y < n; y++) {
                        const denom = Math.pow(1+r, y)
                        npv += cfs[y] / denom
                        if (y > 0) dnpv -= y * cfs[y] / Math.pow(1+r, y+1)
                      }
                      if (Math.abs(dnpv) < 1e-12) break
                      const nr = r - npv / dnpv
                      if (Math.abs(nr - r) < 1e-7) return Math.max(-0.99, Math.min(5, nr))
                      r = nr
                    }
                    return r
                  }

                  // ── Scenario multipliers ──
                  const scenarioMult = invScenario === 'bear' ? 0.80 : invScenario === 'bull' ? 1.20 : 1.0
                  const scenarioAppr = invScenario === 'bear' ? 0.03 : invScenario === 'bull' ? 0.09 : parseFloat(investorData.apreciacao)/100 || 0.04

                  // ── IMT Calculator (Habitação Investimento vs Outros Imóveis) ──
                  function calcIMTValue(p: number, tipo: 'residencial'|'comercial'): number {
                    if (p <= 0) return 0
                    if (tipo === 'comercial') return p * 0.065   // rústicos, terrenos, comerciais
                    // Habitação secundária/investimento 2025 (progressivo)
                    if (p > 633453) return p * 0.06              // taxa única 6%
                    if (p > 316772) return p * 0.08 - 11768.56
                    if (p > 182349) return p * 0.07 - 8600.84
                    if (p > 132774) return p * 0.05 - 4953.86
                    if (p > 97064)  return p * 0.02 - 970.64
                    return p * 0.01
                  }

                  // ── Acquisition costs ──
                  const imt = calcIMTValue(preco, tipoImovelInv)
                  const is = preco * 0.008
                  const notario = 1500
                  const registo = 500
                  const dueDiligence = 3000
                  const totalAcquisition = preco + imt + is + notario + registo + dueDiligence

                  // ── Rental & expense model (industry-grade, JLL/CBRE defaults) ──
                  const rendaMensal = (parseFloat(investorData.rendaMensal) || 0) * scenarioMult
                  const rendaAnual = rendaMensal * 12
                  const imi = preco * 0.0035           // 0.35% urban IMI
                  const mgmtFee = rendaAnual * 0.10    // 10% management fee
                  const insurance = preco * 0.0015     // 0.15% insurance
                  const manutencao = preco * 0.01      // 1% maintenance reserve
                  const vacancia = rendaAnual * 0.067  // ~5.8 weeks void/yr
                  const noi = Math.max(0, rendaAnual - imi - mgmtFee - insurance - manutencao - vacancia)
                  const rendaLiquida = noi
                  const yieldBruto = preco > 0 && rendaAnual > 0 ? (rendaAnual / totalAcquisition * 100) : 0
                  const yieldLiquido = preco > 0 && noi > 0 ? (noi / totalAcquisition * 100) : 0
                  const capRate = preco > 0 && noi > 0 ? (noi / preco * 100) : 0

                  // ── Risk Premium (JLL methodology) ──
                  const otBond10yr = 3.2
                  const riskPremium = yieldLiquido > 0 ? yieldLiquido - otBond10yr : 0

                  // ── Financing ──
                  const ltv = parseFloat(investorData.ltv) / 100 || 0.7
                  const spread = parseFloat(investorData.spread) || 1.0
                  const euribor = 2.80
                  const tanAnual = (euribor + spread) / 100
                  const emprestimo = preco * ltv
                  const entrada = totalAcquisition - emprestimo
                  const prazo = 30
                  const tanMensal = tanAnual / 12
                  const nPag = prazo * 12
                  const prestacao = emprestimo > 0 ? emprestimo * (tanMensal * Math.pow(1+tanMensal, nPag)) / (Math.pow(1+tanMensal, nPag)-1) : 0
                  const debtServiceAnual = prestacao * 12
                  const cashFlowAnual = noi - debtServiceAnual
                  const cashFlowMensal = cashFlowAnual / 12
                  const dscr = debtServiceAnual > 0 ? noi / debtServiceAnual : 0
                  const cashOnCash = entrada > 0 && cashFlowAnual > 0 ? (cashFlowAnual / entrada) * 100 : 0

                  // ── XIRR levered ──
                  const horizonte = parseInt(investorData.horizonte) || 10
                  const apreciacao = scenarioAppr
                  const exitValue = preco * Math.pow(1 + apreciacao, horizonte)
                  const capitalGain = exitValue - preco
                  let loanBal = emprestimo
                  for (let y = 0; y < horizonte; y++) {
                    const ip = loanBal * tanAnual; const pp = debtServiceAnual - ip; loanBal = Math.max(0, loanBal - pp)
                  }
                  const exitProceeds = exitValue - loanBal - exitValue * 0.01
                  const cfLev = [-entrada]; for (let y = 1; y <= horizonte; y++) cfLev.push(cashFlowAnual); cfLev[horizonte] += exitProceeds
                  const irrLevered = entrada > 0 && Math.abs(cashFlowAnual) > 10 ? calcXirr(cfLev) * 100 : 0
                  // Unlevered
                  const cfUnlev = [-totalAcquisition]; for (let y = 1; y <= horizonte; y++) cfUnlev.push(noi); cfUnlev[horizonte] += exitValue * 0.99
                  const irrUnlev = totalAcquisition > 0 && noi > 1 ? calcXirr(cfUnlev) * 100 : 0
                  // Equity Multiple
                  const totalCashReturned = cashFlowAnual * horizonte + exitProceeds
                  const equityMultiple = entrada > 0 && totalCashReturned > 0 ? totalCashReturned / entrada : 0
                  // ── Year-by-Year Projection ──
                  interface YearRow { y:number; noi:number; ds:number; cf:number; cumCF:number; lb:number; equity:number }
                  const yearRows: YearRow[] = []
                  {
                    let lb2 = emprestimo; let cumCF2 = -entrada
                    for (let y = 1; y <= Math.min(horizonte, 20); y++) {
                      const g = Math.pow(1 + apreciacao, y - 1)
                      const noiY = noi * g
                      const ip2 = lb2 * tanAnual
                      const pp2 = debtServiceAnual > ip2 ? debtServiceAnual - ip2 : 0
                      lb2 = Math.max(0, lb2 - pp2)
                      const cfY = noiY - debtServiceAnual
                      cumCF2 += cfY
                      const propY = preco * Math.pow(1 + apreciacao, y)
                      yearRows.push({ y, noi: noiY, ds: debtServiceAnual, cf: cfY, cumCF: cumCF2, lb: lb2, equity: propY - lb2 })
                    }
                  }

                  // ── NPV at Hurdle Rates ──
                  const hurdleRates = [0.06, 0.08, 0.10, 0.12]
                  const npvAtHurdles = hurdleRates.map(r => {
                    let npv = -totalAcquisition
                    for (let y = 1; y <= horizonte; y++) {
                      const noiY = noi * Math.pow(1 + apreciacao, y - 1)
                      npv += noiY / Math.pow(1 + r, y)
                    }
                    npv += exitValue * 0.99 / Math.pow(1 + r, horizonte)
                    return npv
                  })

                  // ── Break-even Analysis ──
                  // Min rent for positive levered CF after debt service
                  const netEfficiency = 1 - 0.10 - 0.067 // after mgmt + vacancy
                  const fixedCosts = imi + insurance + manutencao  // don't scale with rent
                  const rentBreakEven = rendaMensal > 0 || ltv > 0
                    ? Math.max(0, (debtServiceAnual + fixedCosts) / (12 * netEfficiency))
                    : 0
                  const occupancyBreakEven = rendaMensal > 0
                    ? Math.min(100, Math.max(0, (debtServiceAnual + fixedCosts) / (rendaAnual * netEfficiency + fixedCosts) * 100))
                    : 0

                  // ── Stress Test ──
                  function stressCF(rateDelta: number, rentDelta: number): number {
                    const newRate = tanAnual + rateDelta
                    const nm = newRate / 12
                    const newPrest = emprestimo > 0 ? emprestimo * (nm * Math.pow(1+nm, nPag)) / (Math.pow(1+nm, nPag)-1) : 0
                    const newRenda = rendaMensal * (1 + rentDelta)
                    const newRA = newRenda * 12
                    const newNOI = Math.max(0, newRA - imi - newRA*0.10 - insurance - manutencao - newRA*0.067)
                    return newNOI - newPrest * 12
                  }
                  const stressTests = [
                    { label:'Taxa +1%', cfNew: stressCF(0.01, 0), desc:'EURIBOR sobe 100bps' },
                    { label:'Taxa +2%', cfNew: stressCF(0.02, 0), desc:'EURIBOR sobe 200bps' },
                    { label:'Renda -10%', cfNew: stressCF(0, -0.10), desc:'Mercado arrendamento' },
                    { label:'Renda -20%', cfNew: stressCF(0, -0.20), desc:'Recessão severa' },
                  ]

                  // After-tax IRR
                  const cgTaxRate = taxRegime === 'ifici' ? 0 : 0.28
                  const rentalTaxRate = taxRegime === 'ifici' ? 0 : 0.28
                  const cgTax = Math.max(0, capitalGain) * cgTaxRate
                  const cfTax = [-entrada]; for (let y = 1; y <= horizonte; y++) cfTax.push(cashFlowAnual * (1-rentalTaxRate)); cfTax[horizonte] += exitProceeds - cgTax
                  const irrAfterTax = entrada > 0 && Math.abs(cashFlowAnual) > 10 ? calcXirr(cfTax) * 100 : 0
                  // IRR benchmark traffic light
                  const irrBenchmark = ltv > 0.5 ? {label:'Value-Add Levered',low:12,high:18} : {label:'Core Income',low:8,high:12}
                  const irrStatus = irrLevered >= irrBenchmark.high ? 'excellent' : irrLevered >= irrBenchmark.low ? 'good' : irrLevered > 0 ? 'below' : 'na'
                  const totalInvested = totalAcquisition
                  const irr = irrLevered
                  const totalReturn = totalCashReturned

                  // ── Sensitivity Matrix 5×5: Exit Cap Rate × Rental Growth → Levered IRR ──
                  const sensiCaps = [2,3,4,5,6]
                  const sensiGrowths = [4,3,2,1,0]
                  const sensiMatrix = sensiGrowths.map(rg => sensiCaps.map(ec => {
                    if (preco <= 0 || noi <= 1) return null
                    const noiExit = noi * Math.pow(1+rg/100, horizonte)
                    const exitP = noiExit / (ec/100)
                    let lb = emprestimo
                    for (let y = 0; y < horizonte; y++) { const ip = lb*tanAnual; lb = Math.max(0, lb-(debtServiceAnual-ip)) }
                    const ep = exitP - lb - exitP*0.01
                    const cf = [-entrada]; for (let y = 1; y <= horizonte; y++) cf.push(cashFlowAnual); cf[horizonte] += ep
                    return entrada > 0 && Math.abs(cashFlowAnual) > 10 ? calcXirr(cf)*100 : null
                  }))

                  // ── Hold Period Optimizer ──
                  const holdYears = [3,5,7,8,10,12,15]
                  const holdIrrs = holdYears.map(h => {
                    if (preco <= 0 || noi <= 1) return 0
                    const ev = preco * Math.pow(1+apreciacao, h)
                    let lb = emprestimo
                    for (let y = 0; y < h; y++) { const ip = lb*tanAnual; lb = Math.max(0, lb-(debtServiceAnual-ip)) }
                    const ep = ev - lb - ev*0.01
                    const cf = [-entrada]; for (let y = 1; y <= h; y++) cf.push(cashFlowAnual); cf[h] += ep
                    return entrada > 0 && Math.abs(cashFlowAnual) > 10 ? calcXirr(cf)*100 : 0
                  })
                  const optimalHoldIdx = holdIrrs.indexOf(Math.max(...holdIrrs))

                  return (
                    <div className="p-card" style={{padding:0,overflow:'hidden'}}>
                      {/* Deal Header */}
                      <div style={{padding:'16px 24px',borderBottom:'1px solid rgba(14,14,13,.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
                        <div>
                          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',color:'#0e0e0d'}}>{deal.imovel}</div>
                          <div style={{display:'flex',gap:'12px',marginTop:'4px',flexWrap:'wrap'}}>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.65rem',color:'#c9a96e'}}>{deal.valor}</span>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.08em',color:STAGE_COLOR[fase]||'#888'}}>{fase}</span>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.35)'}}>{deal.ref}</span>
                          </div>
                        </div>
                        {/* Progress bar + Risk Button */}
                        <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                          <button style={{padding:'7px 14px',background:dealRiskAnalysis?'rgba(224,84,84,.08)':'rgba(28,74,53,.06)',border:`1px solid ${dealRiskAnalysis?'rgba(224,84,84,.25)':'rgba(28,74,53,.18)'}`,color:dealRiskAnalysis?'#e05454':'#1c4a35',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap' as const}}
                            disabled={dealRiskLoading}
                            onClick={async()=>{
                              if (dealRiskAnalysis) { setDealRiskAnalysis(null); return }
                              setDealRiskLoading(true)
                              try {
                                const res = await fetch('/api/deal/risk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deal})})
                                const d = await res.json()
                                if (d.analysis) setDealRiskAnalysis(d.analysis)
                              } catch{} finally{setDealRiskLoading(false)}
                            }}>
                            {dealRiskLoading ? '✦ A analisar...' : dealRiskAnalysis ? '⚠ Fechar' : '⚠ Risco IA'}
                          </button>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>{STAGE_PCT[fase]||10}% concluído</div>
                            <div style={{width:'120px',height:'3px',background:'rgba(14,14,13,.08)',borderRadius:'2px',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${STAGE_PCT[fase]||10}%`,background:STAGE_COLOR[fase]||'#888',borderRadius:'2px'}}/>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Risk Analysis Panel */}
                      {dealRiskAnalysis && (() => {
                        const lvl = String(dealRiskAnalysis.riskLevel)
                        const lvlColor = lvl==='CRITICAL'?'#e05454':lvl==='HIGH'?'#f97316':lvl==='MEDIUM'?'#f59e0b':'#10b981'
                        const lvlBg = lvl==='CRITICAL'?'rgba(224,84,84,.06)':lvl==='HIGH'?'rgba(249,115,22,.05)':lvl==='MEDIUM'?'rgba(245,158,11,.04)':'rgba(16,185,129,.04)'
                        return (
                          <div style={{padding:'16px 24px',background:lvlBg,borderBottom:'1px solid rgba(14,14,13,.08)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px',flexWrap:'wrap' as const}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>⚠ Análise de Risco — Claude Opus</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',fontWeight:700,padding:'3px 10px',background:`${lvlColor}22`,color:lvlColor,border:`1px solid ${lvlColor}44`}}>
                                {lvl} · {String(dealRiskAnalysis.riskScore)}/100
                              </div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Riscos Identificados</div>
                                {(dealRiskAnalysis.risks as {category:string;description:string;severity:string}[]).map((r,i) => (
                                  <div key={i} style={{display:'flex',gap:'8px',alignItems:'flex-start',marginBottom:'8px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 5px',flexShrink:0,background:r.severity==='HIGH'?'rgba(224,84,84,.1)':r.severity==='MEDIUM'?'rgba(249,115,22,.1)':'rgba(14,14,13,.06)',color:r.severity==='HIGH'?'#e05454':r.severity==='MEDIUM'?'#f97316':'rgba(14,14,13,.5)',border:'1px solid currentColor'}}>{r.severity}</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.65)',lineHeight:1.4}}><strong style={{color:'rgba(14,14,13,.8)'}}>{r.category}:</strong> {r.description}</div>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Recomendações</div>
                                {(dealRiskAnalysis.recommendations as string[]).map((r,i) => (
                                  <div key={i} style={{display:'flex',gap:'6px',alignItems:'flex-start',marginBottom:'6px'}}>
                                    <span style={{color:'#1c4a35',flexShrink:0,fontWeight:700}}>→</span>
                                    <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.65)',lineHeight:1.4}}>{r}</span>
                                  </div>
                                ))}
                                {dealRiskAnalysis.nextCriticalAction && (
                                  <div style={{marginTop:'10px',padding:'8px 12px',background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.2)'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em',marginBottom:'3px'}}>ACÇÃO CRÍTICA</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'#1c4a35',fontWeight:500}}>{String(dealRiskAnalysis.nextCriticalAction)}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Tabs */}
                      <div style={{display:'flex',borderBottom:'1px solid rgba(14,14,13,.08)',padding:'0 24px'}}>
                        <button className={`deal-tab${dealTab==='checklist'?' active':''}`} onClick={()=>setDealTab('checklist')}>Checklist</button>
                        <button className={`deal-tab${dealTab==='investor'?' active':''}`} onClick={()=>setDealTab('investor')}>
                          Investor Dashboard {yieldBruto > 0 ? `· ${yieldBruto.toFixed(1)}%` : ''}
                        </button>
                        <button className={`deal-tab${dealTab==='dealroom'?' active':''}`} onClick={()=>setDealTab('dealroom')}>🏛 Deal Room</button>
                        <button className={`deal-tab${dealTab==='timeline'?' active':''}`} onClick={()=>setDealTab('timeline')}>Timeline</button>
                        <button className={`deal-tab${dealTab==='nego'?' active':''}`} onClick={()=>setDealTab('nego' as typeof dealTab)}>⚡ Negociação IA</button>
                      </div>

                      <div style={{padding:'24px'}}>

                        {/* ── CHECKLIST TAB ── */}
                        {dealTab === 'checklist' && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px'}}>
                            {/* Left: timeline */}
                            <div>
                              <div style={{fontFamily:"'Cormorant',serif",fontWeight:400,fontSize:'1rem',color:'#1c4a35',marginBottom:'12px'}}>Progresso do Deal</div>
                              <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
                                {PIPELINE_STAGES.map((s, idx) => {
                                  const phasePct = STAGE_PCT[s] || 0
                                  const currentPct = STAGE_PCT[fase] || 0
                                  const isDone = phasePct < currentPct
                                  const isCurrent = s === fase
                                  const checksDone = deal.checklist[s] ? deal.checklist[s].filter(Boolean).length : 0
                                  const checksTotal = CHECKLISTS[s]?.length || 0
                                  return (
                                    <div key={s} className="timeline-phase">
                                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0',marginTop:'4px'}}>
                                        <div className={`timeline-dot${isDone?' done':isCurrent?' current':''}`}></div>
                                        {idx < PIPELINE_STAGES.length - 1 && <div style={{width:'2px',height:'24px',background:isDone?'#1c4a35':'rgba(14,14,13,.1)',marginTop:'2px'}}></div>}
                                      </div>
                                      <div style={{paddingBottom:'16px'}}>
                                        <div style={{fontSize:'.8rem',color:isCurrent?'#1c4a35':isDone?'rgba(14,14,13,.6)':'rgba(14,14,13,.4)',fontWeight:isCurrent?500:400}}>{s}</div>
                                        {(isDone || isCurrent) && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.35)',marginTop:'2px',letterSpacing:'.06em'}}>{checksDone}/{checksTotal} itens</div>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            {/* Right: checklist */}
                            <div>
                              <div style={{fontFamily:"'Cormorant',serif",fontWeight:400,fontSize:'1rem',color:'#1c4a35',marginBottom:'12px'}}>Checklist — {fase}</div>
                              {CHECKLISTS[fase]?.map((item,idx)=>{
                                const done = deal.checklist[fase]?.[idx] || false
                                return (
                                  <div key={idx} className={`check-item${done?' done':''}`} onClick={()=>toggleCheck(deal.id,fase,idx)}>
                                    <div style={{width:'18px',height:'18px',border:`1.5px solid ${done?'#1c4a35':'rgba(14,14,13,.2)'}`,borderRadius:'3px',background:done?'#1c4a35':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s'}}>
                                      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f4f0e6" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </div>
                                    {item}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── INVESTOR DASHBOARD TAB (Institutional Grade) ── */}
                        {dealTab === 'investor' && (
                          <div>
                            {/* ── Scenario Toggle + Tax Regime ── */}
                            <div style={{display:'flex',gap:'12px',marginBottom:'20px',flexWrap:'wrap',alignItems:'center'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>Cenário:</div>
                              {([['bear','🔴 Bear','rgba(220,80,60,.1)','rgba(220,80,60,.6)'],['base','🟡 Base','rgba(201,169,110,.15)','#c9a96e'],['bull','🟢 Bull','rgba(74,156,122,.1)','#4a9c7a']] as const).map(([s,l,bg,col])=>(
                                <button key={s} onClick={()=>setInvScenario(s as 'bear'|'base'|'bull')} style={{padding:'6px 14px',background:invScenario===s?bg:'transparent',border:`1px solid ${invScenario===s?col:'rgba(14,14,13,.12)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.08em',color:invScenario===s?col:'rgba(14,14,13,.4)',cursor:'pointer',transition:'all .15s'}}>{l}</button>
                              ))}
                              <div style={{marginLeft:'auto',display:'flex',gap:'16px',alignItems:'center',flexWrap:'wrap'}}>
                                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',color:'rgba(14,14,13,.4)'}}>Tipo IMT:</div>
                                  {([['residencial','Residencial 6%'],['comercial','Comercial 6.5%']] as const).map(([t,l])=>(
                                    <button key={t} onClick={()=>setTipoImovelInv(t)} style={{padding:'5px 12px',background:tipoImovelInv===t?'rgba(201,169,110,.12)':'transparent',border:`1px solid ${tipoImovelInv===t?'#c9a96e':'rgba(14,14,13,.12)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:tipoImovelInv===t?'#8B6914':'rgba(14,14,13,.4)',cursor:'pointer',transition:'all .15s'}}>{l}</button>
                                  ))}
                                </div>
                                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',color:'rgba(14,14,13,.4)'}}>Fiscal:</div>
                                  {([['standard','Std 28%'],['ifici','IFICI 0%']] as const).map(([t,l])=>(
                                    <button key={t} onClick={()=>setTaxRegime(t)} style={{padding:'5px 12px',background:taxRegime===t?'rgba(28,74,53,.08)':'transparent',border:`1px solid ${taxRegime===t?'#1c4a35':'rgba(14,14,13,.12)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:taxRegime===t?'#1c4a35':'rgba(14,14,13,.4)',cursor:'pointer',transition:'all .15s'}}>{l}</button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* ── Row 1: Inputs + Tier 1 Metrics ── */}
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'16px'}}>
                              {/* Inputs */}
                              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>Parâmetros</div>
                                <div><label className="p-label">Renda Mensal Base (€)</label><input className="p-inp" type="number" placeholder="ex: 4500" value={investorData.rendaMensal} onChange={e=>setInvestorData(p=>({...p,rendaMensal:e.target.value}))}/></div>
                                <div><label className="p-label">Apreciação Base (%/ano)</label>
                                  <select className="p-sel" value={investorData.apreciacao} onChange={e=>setInvestorData(p=>({...p,apreciacao:e.target.value}))}>
                                    {[['2','2% — Conservador'],['3','3% — Moderado'],['4','4% — Base'],['5','5% — Optimista'],['7','7% — Bull'],['10','10% — Max']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                  </select>
                                </div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                                  <div><label className="p-label">Horizonte</label>
                                    <select className="p-sel" value={investorData.horizonte} onChange={e=>setInvestorData(p=>({...p,horizonte:e.target.value}))}>
                                      {[['3','3 anos'],['5','5 anos'],['7','7 anos'],['10','10 anos'],['15','15 anos']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </div>
                                  <div><label className="p-label">LTV</label>
                                    <select className="p-sel" value={investorData.ltv} onChange={e=>setInvestorData(p=>({...p,ltv:e.target.value}))}>
                                      {[['0','0% Cash'],['30','30%'],['50','50%'],['60','60%'],['70','70%'],['80','80%']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div><label className="p-label">Spread Bancário</label>
                                  <select className="p-sel" value={investorData.spread} onChange={e=>setInvestorData(p=>({...p,spread:e.target.value}))}>
                                    {[['0.75','0.75%'],['0.85','0.85%'],['1.0','1.0%'],['1.25','1.25%'],['1.5','1.5%'],['2.0','2.0%']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                  </select>
                                </div>
                                {/* Acquisition costs */}
                                <div style={{background:'#0c1f15',padding:'12px',marginTop:'4px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'8px'}}>Custo Total Aquisição</div>
                                  {[['Preço',preco],['IMT 6.5%',imt],['IS 0.8%',is],['Notário+Registo',notario+registo],['Due Diligence',dueDiligence]].map(([l,v])=>(
                                    <div key={String(l)} style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.35)'}}>{l}</span>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.65)'}}>€{Number(v).toLocaleString('pt-PT',{maximumFractionDigits:0})}</span>
                                    </div>
                                  ))}
                                  <div style={{borderTop:'1px solid rgba(201,169,110,.2)',marginTop:'6px',paddingTop:'6px',display:'flex',justifyContent:'space-between'}}>
                                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(201,169,110,.7)',textTransform:'uppercase'}}>Total</span>
                                    <span style={{fontFamily:"'Cormorant',serif",fontSize:'.95rem',color:'#c9a96e'}}>€{totalAcquisition.toLocaleString('pt-PT',{maximumFractionDigits:0})}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Tier 1 Metrics + Validation */}
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Performance — {invScenario.toUpperCase()} Scenario</div>
                                {/* Hero metrics */}
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
                                  {[
                                    {lbl:'IRR Levered',val:irrLevered>0?`${irrLevered.toFixed(1)}%`:'—',sub:`${horizonte}a · XIRR`,color:irrLevered>=15?'#4a9c7a':irrLevered>=8?'#c9a96e':'#888'},
                                    {lbl:'Equity Multiple',val:equityMultiple>0?`${equityMultiple.toFixed(2)}x`:'—',sub:`${horizonte} anos`,color:equityMultiple>=2?'#4a9c7a':equityMultiple>=1.5?'#c9a96e':'#888'},
                                    {lbl:'Net Yield',val:yieldLiquido>0?`${yieldLiquido.toFixed(2)}%`:'—',sub:'NOI / Total Cost',color:yieldLiquido>=4?'#4a9c7a':yieldLiquido>=2.5?'#c9a96e':'#888'},
                                    {lbl:'Cash-on-Cash',val:cashOnCash>0?`${cashOnCash.toFixed(1)}%`:'—',sub:'Ano 1',color:cashOnCash>=5?'#4a9c7a':cashOnCash>=2?'#c9a96e':'#888'},
                                    {lbl:'IRR Unlevered',val:irrUnlev>0?`${irrUnlev.toFixed(1)}%`:'—',sub:'Puro activo',color:irrUnlev>=8?'#4a9c7a':irrUnlev>=5?'#c9a96e':'#888'},
                                    {lbl:`IRR After-Tax`,val:irrAfterTax>0?`${irrAfterTax.toFixed(1)}%`:'—',sub:taxRegime==='ifici'?'IFICI 0%':'Std 28%',color:irrAfterTax>=12?'#4a9c7a':irrAfterTax>=6?'#c9a96e':'#888'},
                                  ].map(m=>(
                                    <div key={m.lbl} className="inv-metric">
                                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.5rem',color:m.color,lineHeight:1}}>{m.val}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.06em',color:'rgba(14,14,13,.5)',marginTop:'2px'}}>{m.lbl}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{m.sub}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* IRR Benchmark Traffic Light */}
                                {irrLevered > 0 && (
                                  <div style={{background:irrStatus==='excellent'?'rgba(74,156,122,.08)':irrStatus==='good'?'rgba(201,169,110,.08)':'rgba(220,80,60,.06)',border:`1px solid ${irrStatus==='excellent'?'rgba(74,156,122,.3)':irrStatus==='good'?'rgba(201,169,110,.3)':'rgba(220,80,60,.2)'}`,padding:'10px 12px',marginBottom:'10px'}}>
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                      <div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',color:'rgba(14,14,13,.4)',marginBottom:'3px'}}>IRR Benchmark — {irrBenchmark.label}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:irrStatus==='excellent'?'#4a9c7a':irrStatus==='good'?'#c9a96e':'#e05454'}}>
                                          {irrStatus==='excellent'?`✅ Acima do benchmark (>${irrBenchmark.high}%)`:irrStatus==='good'?`✓ Dentro benchmark (${irrBenchmark.low}–${irrBenchmark.high}%)`:`⚠ Abaixo benchmark (<${irrBenchmark.low}%)`}
                                        </div>
                                      </div>
                                      <div style={{textAlign:'right'}}>
                                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:irrStatus==='excellent'?'#4a9c7a':irrStatus==='good'?'#c9a96e':'#e05454'}}>{irrLevered.toFixed(1)}%</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)'}}>vs {irrBenchmark.low}–{irrBenchmark.high}%</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Risk Premium (JLL methodology) */}
                                {yieldLiquido > 0 && (
                                  <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.08)',padding:'10px 12px',marginBottom:'10px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Risk Premium (JLL methodology)</div>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:riskPremium>=1.5?'#4a9c7a':riskPremium>=0.5?'#c9a96e':'#888',lineHeight:1}}>{riskPremium>0?'+':''}{riskPremium.toFixed(2)}%</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)'}}>Net Yield {yieldLiquido.toFixed(2)}% − OT 10yr {otBond10yr}% = {Math.round(riskPremium*100)}bps spread</div>
                                    </div>
                                  </div>
                                )}

                                {/* DSCR + Cash Flow */}
                                {ltv > 0 && rendaMensal > 0 && (
                                  <div style={{background:'rgba(201,169,110,.05)',border:'1px solid rgba(201,169,110,.12)',padding:'10px 12px'}}>
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
                                      {[
                                        {l:'DSCR',v:dscr>0?dscr.toFixed(2):'—',c:dscr>=1.25?'#4a9c7a':dscr>=1?'#c9a96e':'#e05454',sub:dscr>=1.25?'Saudável':'Marginal'},
                                        {l:'CF/Mês',v:cashFlowMensal!==0?`€${Math.round(cashFlowMensal).toLocaleString('pt-PT')}`:'—',c:cashFlowMensal>=0?'#4a9c7a':'#e05454',sub:cashFlowMensal>=0?'Positivo':'Negativo'},
                                        {l:'Cap Rate',v:capRate>0?`${capRate.toFixed(2)}%`:'—',c:capRate>=4?'#4a9c7a':capRate>=2.5?'#c9a96e':'#888',sub:'NOI/Preço'},
                                      ].map(m=>(
                                        <div key={m.l}>
                                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:m.c,lineHeight:1}}>{m.v}</div>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.45)',marginTop:'2px'}}>{m.l}</div>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:m.c,marginTop:'1px'}}>{m.sub}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── NOI Breakdown ── */}
                            {rendaMensal > 0 && (
                              <div style={{background:'rgba(28,74,53,.03)',border:'1px solid rgba(28,74,53,.08)',padding:'12px 16px',marginBottom:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>NOI Breakdown — Despesas Industry-Standard</div>
                                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                                  {[['Renda Bruta/ano',rendaAnual,'#1c4a35'],['- IMI (0.35%)',-imi,'rgba(14,14,13,.45)'],['- Gestão (10%)',-mgmtFee,'rgba(14,14,13,.45)'],['- Seguro (0.15%)',-insurance,'rgba(14,14,13,.45)'],['- Manutenção (1%)',-manutencao,'rgba(14,14,13,.45)'],['- Vacância (6.7%)',-vacancia,'rgba(14,14,13,.45)']].map(([l,v,c])=>(
                                    <div key={String(l)} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.45)'}}>{l}</span>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:String(c)}}>{Number(v)>0?'':'-'}€{Math.abs(Number(v)).toLocaleString('pt-PT',{maximumFractionDigits:0})}</span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{borderTop:'1px solid rgba(28,74,53,.1)',marginTop:'8px',paddingTop:'8px',display:'flex',justifyContent:'space-between'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#1c4a35',textTransform:'uppercase',letterSpacing:'.08em'}}>NOI (Renda Líquida)</span>
                                  <span style={{fontFamily:"'Cormorant',serif",fontSize:'.95rem',color:'#1c4a35'}}>€{noi.toLocaleString('pt-PT',{maximumFractionDigits:0})}/ano</span>
                                </div>
                              </div>
                            )}

                            {/* ── Sensitivity Matrix ── */}
                            {rendaMensal > 0 && (
                              <div style={{background:'#0c1f15',padding:'16px',marginBottom:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'4px'}}>Sensitivity Matrix — IRR Levered (XIRR)</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.25)',marginBottom:'12px'}}>Rows: Rent Growth %/yr · Cols: Exit Cap Rate % · Hold: {horizonte}a</div>
                                <div style={{overflowX:'auto'}}>
                                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                                    <thead>
                                      <tr>
                                        <th style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.3)',padding:'4px 8px',textAlign:'left',borderBottom:'1px solid rgba(244,240,230,.06)'}}>↗ Rent / Cap→</th>
                                        {sensiCaps.map(ec=>(
                                          <th key={ec} style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.45)',padding:'4px 8px',textAlign:'center',borderBottom:'1px solid rgba(244,240,230,.06)'}}>{ec}%</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sensiGrowths.map((rg,ri)=>(
                                        <tr key={rg}>
                                          <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.45)',padding:'4px 8px',borderBottom:'1px solid rgba(244,240,230,.04)'}}>{rg}%/yr</td>
                                          {sensiMatrix[ri].map((v,ci)=>{
                                            const val = v ?? 0
                                            const bg = val>=20?'rgba(74,156,122,.3)':val>=15?'rgba(74,156,122,.18)':val>=10?'rgba(201,169,110,.2)':val>=6?'rgba(201,169,110,.1)':'rgba(220,80,60,.15)'
                                            const col = val>=15?'#4a9c7a':val>=8?'#c9a96e':'#e07070'
                                            const isCurrent = ri===2&&ci===2
                                            return (
                                              <td key={ci} style={{padding:'4px 8px',textAlign:'center',background:isCurrent?'rgba(201,169,110,.2)':bg,border:isCurrent?'1px solid rgba(201,169,110,.4)':'none',borderBottom:'1px solid rgba(244,240,230,.04)'}}>
                                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:col}}>{v!==null?`${val.toFixed(1)}%`:'—'}</span>
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.15)',marginTop:'8px'}}>🟢 &gt;20% · 🟡 10-20% · 🔴 &lt;10% · Highlighted = cenário base</div>
                              </div>
                            )}

                            {/* ── Hold Period Optimizer ── */}
                            {rendaMensal > 0 && (
                              <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',padding:'14px',marginBottom:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>Hold Period Optimizer — IRR por Ano de Saída</div>
                                <div style={{display:'flex',gap:'6px',alignItems:'flex-end',height:'60px'}}>
                                  {holdYears.map((h,i)=>{
                                    const irv = holdIrrs[i]
                                    const maxIrr = Math.max(...holdIrrs.filter(x=>x>0)) || 1
                                    const barH = irv > 0 ? Math.max(12, (irv / maxIrr) * 55) : 4
                                    const isOpt = i === optimalHoldIdx && irv > 0
                                    return (
                                      <div key={h} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',flex:1}}>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:isOpt?'#c9a96e':'rgba(14,14,13,.4)'}}>{irv>0?`${irv.toFixed(0)}%`:''}</div>
                                        <div style={{width:'100%',height:`${barH}px`,background:isOpt?'#c9a96e':irv>=15?'#4a9c7a':irv>=8?'rgba(201,169,110,.5)':'rgba(14,14,13,.1)',borderRadius:'2px 2px 0 0',transition:'height .3s'}}/>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:isOpt?'#c9a96e':'rgba(14,14,13,.35)',whiteSpace:'nowrap'}}>{h}a{isOpt?' ★':''}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {optimalHoldIdx >= 0 && holdIrrs[optimalHoldIdx] > 0 && (
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#c9a96e',marginTop:'8px'}}>
                                    ★ Saída óptima: {holdYears[optimalHoldIdx]} anos · IRR {holdIrrs[optimalHoldIdx].toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Exit Scenarios ── */}
                            <div style={{background:'#0c1f15',padding:'16px',marginBottom:'12px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'12px'}}>Cenários de Saída — {horizonte} Anos</div>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                                {[['Bear','3'],['Base','4'],['Bull','6'],['Max','9']].map(([label,pct])=>{
                                  const ap = parseFloat(pct)/100
                                  const ev = preco * Math.pow(1+ap, horizonte)
                                  let lb = emprestimo
                                  for (let y=0;y<horizonte;y++){const ip=lb*tanAnual;lb=Math.max(0,lb-(debtServiceAnual-ip))}
                                  const ep = ev - lb - ev*0.01
                                  const cf2=[-entrada]; for(let y=1;y<=horizonte;y++) cf2.push(cashFlowAnual); cf2[horizonte]+=ep
                                  const scIrr = entrada>0&&Math.abs(cashFlowAnual)>10 ? calcXirr(cf2)*100 : 0
                                  const scEM = ep+cashFlowAnual*horizonte
                                  const em = entrada>0&&scEM>0 ? scEM/entrada : 0
                                  const isBest = pct==='4'
                                  return (
                                    <div key={label} style={{background:isBest?'rgba(201,169,110,.1)':'rgba(244,240,230,.03)',border:`1px solid ${isBest?'rgba(201,169,110,.25)':'rgba(244,240,230,.06)'}`,padding:'12px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>{label} {pct}%/a</div>
                                      <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.3rem',color:isBest?'#c9a96e':'rgba(244,240,230,.65)',lineHeight:1}}>€{Math.round(ev/1e3)}K</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.35)',marginTop:'3px'}}>Exit value</div>
                                      {scIrr > 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:scIrr>=15?'#4a9c7a':scIrr>=8?'#c9a96e':'rgba(244,240,230,.4)',marginTop:'6px'}}>{scIrr.toFixed(1)}% IRR</div>}
                                      {em > 0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.3)',marginTop:'2px'}}>{em.toFixed(2)}x EM</div>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* ── Year-by-Year Projection Table ── */}
                            {rendaMensal > 0 && yearRows.length > 0 && (
                              <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',marginBottom:'12px',overflow:'hidden'}}>
                                <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(14,14,13,.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>Projecção Anual — {horizonte} Anos</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)'}}>NOI cresce com apreciação · Serviço dívida fixo</div>
                                </div>
                                <div style={{overflowX:'auto'}}>
                                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:'620px'}}>
                                    <thead>
                                      <tr style={{background:'rgba(14,14,13,.02)'}}>
                                        {['Ano','NOI/ano','Serv. Dívida','CF Anual','CF Acumulado','Saldo Crédito','Equity'].map(h=>(
                                          <th key={h} style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.08em',color:'rgba(14,14,13,.4)',padding:'7px 10px',textAlign:'right',borderBottom:'1px solid rgba(14,14,13,.06)',fontWeight:400,whiteSpace:'nowrap'}}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {yearRows.map((r,i)=>{
                                        const isHorizon = r.y === horizonte
                                        const cfColor = r.cf >= 0 ? '#1c4a35' : '#e05454'
                                        const cumColor = r.cumCF >= 0 ? '#1c4a35' : '#e05454'
                                        return (
                                          <tr key={r.y} style={{background:isHorizon?'rgba(201,169,110,.05)':i%2===0?'transparent':'rgba(14,14,13,.01)',borderBottom:`1px solid ${isHorizon?'rgba(201,169,110,.2)':'rgba(14,14,13,.04)'}`}}>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:isHorizon?'#c9a96e':'rgba(14,14,13,.5)',padding:'7px 10px',textAlign:'right',fontWeight:isHorizon?600:400}}>{r.y}{isHorizon?' ★':''}</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#1c4a35',padding:'7px 10px',textAlign:'right'}}>€{Math.round(r.noi/1000)}K</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.45)',padding:'7px 10px',textAlign:'right'}}>€{Math.round(r.ds/1000)}K</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:cfColor,padding:'7px 10px',textAlign:'right',fontWeight:500}}>{r.cf>=0?'+':''}€{Math.round(r.cf/1000)}K</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:cumColor,padding:'7px 10px',textAlign:'right'}}>{r.cumCF>=0?'+':''}€{Math.round(r.cumCF/1000)}K</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.45)',padding:'7px 10px',textAlign:'right'}}>€{Math.round(r.lb/1000)}K</td>
                                            <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:r.equity>0?'#1c4a35':'#e05454',padding:'7px 10px',textAlign:'right',fontWeight:500}}>€{Math.round(r.equity/1000)}K</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div style={{padding:'8px 16px',background:'rgba(28,74,53,.03)',borderTop:'1px solid rgba(28,74,53,.08)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>
                                  ★ Ano saída · Equity = Valor imóvel − Saldo crédito · NOI cresce {(apreciacao*100).toFixed(0)}%/ano
                                </div>
                              </div>
                            )}

                            {/* ── NPV at Hurdle Rates + Break-even ── */}
                            {rendaMensal > 0 && (
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>

                                {/* NPV at Multiple Discount Rates */}
                                <div style={{background:'#0c1f15',padding:'14px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'12px'}}>NPV por Taxa de Desconto</div>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                                    {hurdleRates.map((r,i)=>{
                                      const npv = npvAtHurdles[i]
                                      const isPos = npv >= 0
                                      return (
                                        <div key={r} style={{background:isPos?'rgba(74,156,122,.08)':'rgba(220,80,60,.08)',border:`1px solid ${isPos?'rgba(74,156,122,.2)':'rgba(220,80,60,.2)'}`,padding:'10px 12px'}}>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',color:'rgba(244,240,230,.4)',marginBottom:'4px'}}>{(r*100).toFixed(0)}% hurdle</div>
                                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:isPos?'#4a9c7a':'#e07070',lineHeight:1}}>
                                            {isPos?'+':''}€{Math.round(Math.abs(npv)/1000)}K
                                          </div>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(244,240,230,.25)',marginTop:'3px'}}>{isPos?'NPV positivo':'NPV negativo'}</div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.2)',marginTop:'8px'}}>NPV unlevered · {horizonte}a · Renda cresce c/ apreciação</div>
                                </div>

                                {/* Break-even Analysis */}
                                <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',padding:'14px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Break-even Analysis</div>
                                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                                    <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'10px 12px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',marginBottom:'4px',letterSpacing:'.06em'}}>RENDA MÍNIMA (CF ≥ 0)</div>
                                      <div style={{display:'flex',alignItems:'baseline',gap:'8px'}}>
                                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',color:rentBreakEven > 0 && rendaMensal >= rentBreakEven ? '#1c4a35' : '#e05454',lineHeight:1}}>€{Math.round(rentBreakEven).toLocaleString('pt-PT')}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>/mês</div>
                                      </div>
                                      {rendaMensal > 0 && (
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',marginTop:'4px',color:rendaMensal >= rentBreakEven ? '#1c4a35' : '#e05454'}}>
                                          {rendaMensal >= rentBreakEven ? `✓ Renda actual cobre (margem €${Math.round(rendaMensal - rentBreakEven)})` : `⚠ Deficit €${Math.round(rentBreakEven - rendaMensal)}/mês`}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'10px 12px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',marginBottom:'4px',letterSpacing:'.06em'}}>TAXA DE OCUPAÇÃO MÍNIMA</div>
                                      <div style={{display:'flex',alignItems:'baseline',gap:'8px'}}>
                                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',color:occupancyBreakEven <= 85 ? '#1c4a35' : '#e05454',lineHeight:1}}>{occupancyBreakEven > 0 ? occupancyBreakEven.toFixed(1) : '—'}%</div>
                                      </div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',marginTop:'4px',color:occupancyBreakEven <= 85 ? '#1c4a35' : 'rgba(14,14,13,.5)'}}>
                                        {occupancyBreakEven <= 85 ? `✓ Margem ${(100 - occupancyBreakEven).toFixed(1)}% acima do break-even` : 'Ocupação muito exigente'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Stress Test ── */}
                            {rendaMensal > 0 && ltv > 0 && (
                              <div style={{background:'rgba(220,80,60,.03)',border:'1px solid rgba(220,80,60,.1)',padding:'14px',marginBottom:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Stress Test — Impacto no Cash Flow Anual</div>
                                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                                  {stressTests.map(st=>{
                                    const delta = st.cfNew - cashFlowAnual
                                    const isPos = st.cfNew >= 0
                                    return (
                                      <div key={st.label} style={{background:isPos?'rgba(74,156,122,.05)':'rgba(220,80,60,.06)',border:`1px solid ${isPos?'rgba(74,156,122,.15)':'rgba(220,80,60,.2)'}`,padding:'12px'}}>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',color:'rgba(14,14,13,.5)',marginBottom:'6px',textTransform:'uppercase'}}>{st.label}</div>
                                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:isPos?'#1c4a35':'#e05454',lineHeight:1}}>
                                          {st.cfNew>=0?'+':''}€{Math.round(st.cfNew/12).toLocaleString('pt-PT')}/m
                                        </div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:delta>=0?'rgba(74,156,122,.7)':'rgba(220,80,60,.7)',marginTop:'4px'}}>
                                          {delta>=0?'▲':'-'}€{Math.abs(Math.round(delta/12)).toLocaleString('pt-PT')}/mês
                                        </div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{st.desc}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',marginTop:'8px'}}>
                                  EURIBOR base: {euribor}% · Renda base: €{rendaMensal.toLocaleString('pt-PT')}/mês · Prestação actual: €{Math.round(prestacao).toLocaleString('pt-PT')}/mês
                                </div>
                              </div>
                            )}

                            {/* ── Export ── */}
                            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                              <button className="p-btn p-btn-gold" style={{flex:1}}
                                onClick={()=>{
                                  const msg = `🏠 *${deal.imovel}*\n💰 ${deal.valor}\n\n📊 *Análise Institucional — Agency Group IPRI™*\nCenário: ${invScenario.toUpperCase()} · ${taxRegime==='ifici'?'IFICI 0%':'Std 28%'} · ${tipoImovelInv==='residencial'?'Residencial':'Comercial'}\n\n*Tier 1 — Returns*\n• IRR Levered (XIRR ${horizonte}a): ${irrLevered.toFixed(1)}%\n• Equity Multiple: ${equityMultiple.toFixed(2)}x\n• Net Yield: ${yieldLiquido.toFixed(2)}% | Cap Rate: ${capRate.toFixed(2)}%\n• Cash-on-Cash Ano 1: ${cashOnCash.toFixed(1)}%\n• IRR After-Tax: ${irrAfterTax.toFixed(1)}%\n• Risk Premium vs OT10: +${riskPremium.toFixed(2)}% (${Math.round(riskPremium*100)}bps)\n\n*Financiamento*\nAquisição total: €${Math.round(totalAcquisition/1000)}K · IMT ${tipoImovelInv==='residencial'?'6%':'6.5%'}: €${Math.round(imt/1000)}K\n${ltv>0?`Equity: €${Math.round(entrada/1000)}K · Prestação: €${Math.round(prestacao)}/mês\nDSCR: ${dscr.toFixed(2)} · CF Mensal: €${Math.round(cashFlowMensal)}\n`:''}${rendaMensal>0?`Break-even renda: €${Math.round(rentBreakEven)}/mês\n`:''}\n★ Saída óptima: ${holdYears[optimalHoldIdx]}a · IRR ${holdIrrs[optimalHoldIdx]?.toFixed(1)}%\nNPV @ 8%: ${npvAtHurdles[1]>=0?'+':''}€${Math.round(npvAtHurdles[1]/1000)}K\n\nAgency Group · AMI 22506 · agencygroup.pt`
                                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')
                                }}>
                                📱 Enviar Análise WA
                              </button>
                              <button className="p-btn" style={{flex:1,background:'rgba(28,74,53,.08)',color:'#1c4a35'}}
                                onClick={()=>{
                                  const txt = `${deal.imovel} · ${deal.valor}\nIRR Levered: ${irrLevered.toFixed(1)}% · EM: ${equityMultiple.toFixed(2)}x · Net Yield: ${yieldLiquido.toFixed(2)}%\nRisk Premium: +${riskPremium.toFixed(2)}% · DSCR: ${dscr.toFixed(2)} · Cash-on-Cash: ${cashOnCash.toFixed(1)}%\nAfter-Tax IRR (${taxRegime==='ifici'?'IFICI':'Std'}): ${irrAfterTax.toFixed(1)}% · Optimal Hold: ${holdYears[optimalHoldIdx]}a`
                                  navigator.clipboard.writeText(txt)
                                }}>
                                Copiar Resumo
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── DEAL ROOM TAB (Compass One) ── */}
                        {dealTab === 'dealroom' && (
                          <div>
                            {/* Deal Room Header */}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'8px'}}>
                              <div>
                                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.3rem',color:'#0e0e0d'}}>Deal Room — {deal.imovel}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',marginTop:'4px'}}>Espaço partilhado · Agente + Comprador + Advogado + Banco</div>
                              </div>
                              <div style={{display:'flex',gap:'8px'}}>
                                <button className="p-btn" style={{padding:'8px 16px',fontSize:'.42rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}}
                                  onClick={()=>{
                                    const link = `https://agencygroup.pt/deal/${deal.ref.toLowerCase()}`
                                    navigator.clipboard.writeText(link)
                                  }}>
                                  🔗 Copiar Link Cliente
                                </button>
                                <button className="p-btn p-btn-gold" style={{padding:'8px 16px',fontSize:'.42rem'}}
                                  onClick={()=>setMakeOfferOpen(true)}>
                                  ✍ Fazer Proposta
                                </button>
                              </div>
                            </div>

                            {/* Deal Team */}
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'16px'}}>
                              {[
                                {role:'Agente',name:agentName,sub:'Agency Group · AMI 22506',color:'#1c4a35',icon:'👤'},
                                {role:'Advogado',name:'A designar',sub:'Clique para adicionar',color:'rgba(14,14,13,.4)',icon:'⚖'},
                                {role:'Banco',name:'A designar',sub:'Financiamento pendente',color:'rgba(14,14,13,.4)',icon:'🏦'},
                                {role:'Notário',name:'A designar',sub:'Escritura pendente',color:'rgba(14,14,13,.4)',icon:'📋'},
                              ].map(m=>(
                                <div key={m.role} style={{background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.08)',padding:'12px',textAlign:'center',cursor:'pointer'}}>
                                  <div style={{fontSize:'1.2rem',marginBottom:'4px'}}>{m.icon}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>{m.role}</div>
                                  <div style={{fontSize:'.82rem',fontWeight:500,color:m.color}}>{m.name}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',marginTop:'2px'}}>{m.sub}</div>
                                </div>
                              ))}
                            </div>

                            {/* Document Status */}
                            <div style={{background:'rgba(28,74,53,.03)',border:'1px solid rgba(28,74,53,.08)',padding:'14px',marginBottom:'14px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Documentos — Estado</div>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                                {[
                                  {doc:'Caderneta Predial',status:'received',date:'12 Mar'},
                                  {doc:'Certidão Permanente',status:'received',date:'10 Mar'},
                                  {doc:'Licença Utilização',status:'pending',date:null},
                                  {doc:'Certificado Energético',status:'received',date:'08 Mar'},
                                  {doc:'Prova de Fundos',status:'pending',date:null},
                                  {doc:'CPCV Draft',status:'reviewing',date:'15 Mar'},
                                  {doc:'Avaliação Bancária',status:'pending',date:null},
                                  {doc:'Relatório Técnico',status:'pending',date:null},
                                ].map(d=>(
                                  <div key={d.doc} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'#fff',border:'1px solid rgba(14,14,13,.06)'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{width:'8px',height:'8px',borderRadius:'50%',background:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.15)',flexShrink:0}}/>
                                      <span style={{fontSize:'.8rem',color:'rgba(14,14,13,.7)'}}>{d.doc}</span>
                                    </div>
                                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:d.status==='received'?'#4a9c7a':d.status==='reviewing'?'#c9a96e':'rgba(14,14,13,.3)'}}>
                                      {d.status==='received'?`✓ ${d.date}`:d.status==='reviewing'?'Em revisão':'Pendente'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Private Matching — CRM Buyers compatible */}
                            <div style={{background:'#0c1f15',padding:'14px',marginBottom:'14px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'12px'}}>Private Matching — Compradores Compatíveis</div>
                              {crmContacts.filter(c=>{
                                const dealVal = parseFloat(deal.valor.replace(/[^0-9.]/g,''))||0
                                return dealVal >= c.budgetMin * 0.85 && dealVal <= c.budgetMax * 1.15
                              }).slice(0,4).map(c=>(
                                <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(244,240,230,.05)',cursor:'pointer'}} onClick={()=>{setSection('crm');setActiveCrmId(c.id)}}>
                                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                    <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'rgba(201,169,110,.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                      <span style={{fontFamily:"'Cormorant',serif",fontSize:'.9rem',color:'#c9a96e'}}>{c.name.charAt(0)}</span>
                                    </div>
                                    <div>
                                      <div style={{fontSize:'.82rem',color:'#f4f0e6',fontWeight:500}}>{c.name}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.4)'}}>€{(c.budgetMin/1e3).toFixed(0)}K–€{(c.budgetMax/1e3).toFixed(0)}K · {c.nationality}</div>
                                    </div>
                                  </div>
                                  <div style={{textAlign:'right'}}>
                                    <div style={{background:c.status==='vip'?'rgba(201,169,110,.2)':c.status==='cliente'?'rgba(74,156,122,.15)':'rgba(244,240,230,.06)',padding:'2px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:c.status==='vip'?'#c9a96e':c.status==='cliente'?'#4a9c7a':'rgba(244,240,230,.4)',textTransform:'uppercase'}}>{c.status}</div>
                                    <button style={{background:'none',border:'1px solid rgba(201,169,110,.3)',color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',padding:'3px 8px',cursor:'pointer',marginTop:'4px',letterSpacing:'.06em'}}
                                      onClick={e=>{e.stopPropagation();window.open(`https://wa.me/?text=${encodeURIComponent(`🏠 *Match Exclusivo*\n${deal.imovel} · ${deal.valor}\n\nOlá ${c.name}, temos uma oportunidade off-market que corresponde exactamente ao seu perfil.\n\nAgency Group · AMI 22506`)}`)}}
                                    >Notificar →</button>
                                  </div>
                                </div>
                              ))}
                              {crmContacts.filter(c=>{const dv=parseFloat(deal.valor.replace(/[^0-9.]/g,''))||0;return dv>=c.budgetMin*0.85&&dv<=c.budgetMax*1.15}).length === 0 && (
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.25)',textAlign:'center',padding:'12px'}}>Nenhum comprador compatível no CRM · Adicione mais contactos</div>
                              )}
                            </div>

                            {/* Commission Calculator */}
                            {(() => {
                              const dealVal = parseFloat(deal.valor.replace(/[^0-9.]/g,'')) || 0
                              if (dealVal <= 0) return null
                              const commBruta = dealVal * 0.05
                              const commCPCV = commBruta * 0.5
                              const commEscritura = commBruta * 0.5
                              const irsWithholding = commBruta * 0.25 // 25% retenção categoria B
                              const commLiquida = commBruta - irsWithholding
                              return (
                                <div style={{background:'rgba(201,169,110,.04)',border:'1px solid rgba(201,169,110,.12)',padding:'14px',marginBottom:'14px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>💰 Calculadora de Comissão — AMI 22506</div>
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px',marginBottom:'10px'}}>
                                    {[
                                      { label:'Valor do Deal', val:`€${dealVal.toLocaleString('pt-PT')}`, color:'#0e0e0d', bold:true },
                                      { label:'Comissão 5% (bruta)', val:`€${commBruta.toLocaleString('pt-PT')}`, color:'#1c4a35', bold:true },
                                      { label:'CPCV (50%)', val:`€${commCPCV.toLocaleString('pt-PT')}`, color:'#c9a96e', bold:false },
                                      { label:'Escritura (50%)', val:`€${commEscritura.toLocaleString('pt-PT')}`, color:'#c9a96e', bold:false },
                                      { label:'Retenção IRS 25%', val:`-€${irsWithholding.toLocaleString('pt-PT')}`, color:'#e05454', bold:false },
                                      { label:'Comissão Líquida', val:`€${Math.round(commLiquida).toLocaleString('pt-PT')}`, color:'#4a9c7a', bold:true },
                                    ].map(item => (
                                      <div key={item.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:item.bold?'rgba(14,14,13,.03)':'transparent',border:item.bold?'1px solid rgba(14,14,13,.06)':'none'}}>
                                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)'}}>{item.label}</span>
                                        <span style={{fontFamily:"'Cormorant',serif",fontSize:item.bold?'1.1rem':'.95rem',color:item.color,fontWeight:item.bold?400:300}}>{item.val}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',borderTop:'1px solid rgba(14,14,13,.06)',paddingTop:'8px'}}>
                                    Protocolo: 50% na assinatura do CPCV · 50% na escritura · IRS cat. B 25% ret. fonte · IVA isento (AMI)
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Make Offer Modal */}
                            {makeOfferOpen && (
                              <div style={{position:'fixed',inset:0,background:'rgba(12,31,21,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'20px'}}>
                                <div style={{background:'#f4f0e6',padding:'28px',maxWidth:'480px',width:'100%',borderRadius:'2px'}}>
                                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.5rem',color:'#0e0e0d',marginBottom:'6px'}}>Fazer Proposta</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>{deal.imovel} · {deal.valor}</div>
                                  <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                                    <input className="p-inp" placeholder="Valor proposto (€)" type="number" style={{fontSize:'.9rem'}}/>
                                    <input className="p-inp" placeholder="Condições (ex: 30% sinal, 60 dias CPCV)" style={{fontSize:'.9rem'}}/>
                                    <textarea className="p-inp" placeholder="Nota ao vendedor / advogado..." rows={3} value={offerMsg} onChange={e=>setOfferMsg(e.target.value)} style={{resize:'vertical',fontSize:'.9rem'}}/>
                                    <select className="p-sel" style={{width:'100%'}}>
                                      <option>Proposta formal (carta)</option>
                                      <option>Oferta verbal (confirmar depois)</option>
                                      <option>CPCV directo (sem proposta prévia)</option>
                                    </select>
                                  </div>
                                  <div style={{display:'flex',gap:'8px'}}>
                                    <button className="p-btn p-btn-gold" style={{flex:1}}
                                      onClick={()=>{
                                        window.open(`https://wa.me/?text=${encodeURIComponent(`📋 *Proposta Formal*\n${deal.imovel} · ${deal.valor}\n${offerMsg?'\n'+offerMsg:''}\n\nAgency Group · AMI 22506 · agencygroup.pt`)}`)
                                        setMakeOfferOpen(false)
                                      }}>
                                      Enviar WhatsApp
                                    </button>
                                    <button className="p-btn" style={{flex:1,background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.6)'}} onClick={()=>setMakeOfferOpen(false)}>Cancelar</button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Deal Messages */}
                            <div style={{background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.08)',padding:'14px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>Mensagens do Deal</div>
                              {[
                                {from:'Agente',msg:'Documentação recebida e verificada. CPCV em preparação.',time:'Hoje 14:32',own:true},
                                {from:'Advogado',msg:'Certidão permanente sem ónus. A analisar cláusula de financiamento.',time:'Hoje 11:15',own:false},
                              ].map((m,i)=>(
                                <div key={i} style={{display:'flex',gap:'8px',marginBottom:'10px',justifyContent:m.own?'flex-end':'flex-start'}}>
                                  <div style={{maxWidth:'80%',background:m.own?'#1c4a35':'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'8px 12px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:m.own?'rgba(244,240,230,.5)':'rgba(14,14,13,.4)',marginBottom:'4px'}}>{m.from} · {m.time}</div>
                                    <div style={{fontSize:'.84rem',color:m.own?'rgba(244,240,230,.9)':'rgba(14,14,13,.75)',lineHeight:1.5}}>{m.msg}</div>
                                  </div>
                                </div>
                              ))}
                              <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                                <input className="p-inp" placeholder="Escrever mensagem..." value={dealRoomMsg} onChange={e=>setDealRoomMsg(e.target.value)} style={{flex:1,fontSize:'.85rem'}}
                                  onKeyDown={e=>{if(e.key==='Enter'&&dealRoomMsg.trim()){setDealRoomMsg('')}}}/>
                                <button className="p-btn p-btn-gold" style={{padding:'0 16px',fontSize:'.44rem'}} onClick={()=>setDealRoomMsg('')}>Enviar</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── TIMELINE TAB ── */}
                        {dealTab === ('nego' as string) && (
                          <div>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'8px'}}>
                              <div>
                                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d'}}>Estratégia de Negociação IA</div>
                                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>Claude Opus · Baseado no perfil do deal e comprador</div>
                              </div>
                              <button style={{padding:'8px 18px',background:dealNego?'rgba(14,14,13,.06)':'linear-gradient(135deg,#0c1f15,#1c4a35)',color:dealNego?'rgba(14,14,13,.5)':'#c9a96e',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer',transition:'all .15s'}}
                                disabled={dealNegoLoading}
                                onClick={async()=>{
                                  if (dealNego) { setDealNego(null); return }
                                  setDealNegoLoading(true)
                                  const contact = crmContacts.find(c=>c.name===deal.comprador||c.dealRef===deal.ref)
                                  try {
                                    const res = await fetch('/api/deal/negotiation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deal,contact,agentName})})
                                    const d = await res.json()
                                    if (d.negotiation) setDealNego(d.negotiation)
                                  } catch{} finally{setDealNegoLoading(false)}
                                }}>
                                {dealNegoLoading ? '✦ A gerar...' : dealNego ? '↺ Regenerar' : '⚡ Gerar Estratégia IA'}
                              </button>
                            </div>
                            {!dealNego && !dealNegoLoading && (
                              <div style={{padding:'32px',textAlign:'center' as const,background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)'}}>
                                <div style={{fontSize:'2rem',marginBottom:'8px'}}>⚡</div>
                                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:'rgba(14,14,13,.5)',marginBottom:'6px'}}>Pronto para negociar</div>
                                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'rgba(14,14,13,.4)'}}>Clica em "Gerar Estratégia IA" para receber argumentos, concessões e script de fecho personalizado</div>
                              </div>
                            )}
                            {dealNego && (
                              <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                                {/* Strategy header */}
                                <div style={{background:'linear-gradient(135deg,#0c1f15,#1c4a35)',padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.5)',letterSpacing:'.12em',marginBottom:'3px'}}>ESTRATÉGIA</div>
                                    <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',color:'#f4f0e6',fontWeight:300}}>{String(dealNego.strategy)}</div>
                                  </div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.7)',background:'rgba(201,169,110,.1)',padding:'4px 10px',border:'1px solid rgba(201,169,110,.2)'}}>{deal.valor}</div>
                                </div>
                                <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',padding:'14px',borderLeft:'3px solid #1c4a35'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(28,74,53,.6)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Posição de Abertura</div>
                                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.85rem',color:'rgba(14,14,13,.75)',lineHeight:1.6}}>{String(dealNego.openingPosition)}</div>
                                </div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Argumentos-Chave</div>
                                    {(dealNego.keyArguments as string[]).map((a,i)=>(
                                      <div key={i} style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
                                        <span style={{color:'#4a9c7a',fontWeight:700,flexShrink:0}}>{i+1}.</span>
                                        <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.65)',lineHeight:1.4}}>{a}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Concessões Possíveis</div>
                                    {(dealNego.concessions as string[]).map((c2,i)=>(
                                      <div key={i} style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
                                        <span style={{color:'#f59e0b',flexShrink:0}}>◌</span>
                                        <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.65)',lineHeight:1.4}}>{c2}</span>
                                      </div>
                                    ))}
                                    <div style={{marginTop:'8px',padding:'8px',background:'rgba(224,84,84,.04)',border:'1px solid rgba(224,84,84,.15)'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'#e05454',marginBottom:'4px',letterSpacing:'.08em'}}>LINHAS VERMELHAS</div>
                                      {(dealNego.redLines as string[]).map((r,i)=>(
                                        <div key={i} style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(14,14,13,.6)',marginBottom:'3px'}}>✗ {r}</div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                {/* Closing script */}
                                <div style={{background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.2)',padding:'14px',borderLeft:'3px solid #c9a96e'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Script de Fecho</div>
                                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'rgba(14,14,13,.75)',lineHeight:1.7,fontStyle:'italic'}}>"{String(dealNego.closingScript)}"</div>
                                </div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                                  <div style={{padding:'10px 12px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.4)',marginBottom:'4px',letterSpacing:'.08em'}}>ORIENTAÇÃO DE PREÇO</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'#1c4a35',fontWeight:500}}>{String(dealNego.priceGuidance)}</div>
                                  </div>
                                  <div style={{padding:'10px 12px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.4)',marginBottom:'4px',letterSpacing:'.08em'}}>SE A NEGOCIAÇÃO FALHAR</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.65)'}}>{String(dealNego.alternativeIfFails)}</div>
                                  </div>
                                </div>
                                <div style={{display:'flex',gap:'8px'}}>
                                  <button style={{padding:'8px 16px',background:'#25d366',color:'#fff',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',letterSpacing:'.08em'}}
                                    onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(String(dealNego.closingScript))}`)}>
                                    💬 Enviar WA
                                  </button>
                                  <button style={{padding:'8px 16px',background:'rgba(14,14,13,.06)',border:'1px solid rgba(14,14,13,.1)',color:'rgba(14,14,13,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer'}}
                                    onClick={()=>navigator.clipboard.writeText(`ESTRATÉGIA: ${dealNego.strategy}\n\nABERTURA: ${dealNego.openingPosition}\n\nSCRIPT DE FECHO: ${dealNego.closingScript}\n\nPREÇO: ${dealNego.priceGuidance}`)}>
                                    📋 Copiar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {dealTab === 'timeline' && (
                          <div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.1rem',color:'#0e0e0d',marginBottom:'16px'}}>Progresso Completo — Todas as Fases</div>
                            {PIPELINE_STAGES.map((s, idx) => {
                              const phasePct = STAGE_PCT[s] || 0
                              const currentPct = STAGE_PCT[fase] || 0
                              const isDone = phasePct < currentPct
                              const isCurrent = s === fase
                              const checksDone = deal.checklist[s] ? deal.checklist[s].filter(Boolean).length : 0
                              const checksTotal = CHECKLISTS[s]?.length || 0
                              return (
                                <div key={s} style={{display:'flex',gap:'16px',paddingBottom:'0'}}>
                                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'24px',flexShrink:0}}>
                                    <div style={{width:'12px',height:'12px',borderRadius:'50%',border:`2px solid ${isDone?'#1c4a35':isCurrent?'#c9a96e':'rgba(14,14,13,.15)'}`,background:isDone?'#1c4a35':isCurrent?'#c9a96e':'transparent',marginTop:'2px',flexShrink:0}}/>
                                    {idx < PIPELINE_STAGES.length-1 && <div style={{width:'2px',flex:1,minHeight:'24px',background:isDone?'#1c4a35':'rgba(14,14,13,.08)',marginTop:'2px'}}/>}
                                  </div>
                                  <div style={{paddingBottom:'20px',flex:1}}>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                      <div style={{fontSize:'.85rem',fontWeight:isCurrent?500:400,color:isCurrent?'#1c4a35':isDone?'rgba(14,14,13,.7)':'rgba(14,14,13,.35)'}}>{s}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:isDone?'#4a9c7a':isCurrent?'#c9a96e':'rgba(14,14,13,.25)',letterSpacing:'.06em'}}>{isDone?'✓ Concluído':isCurrent?'Em curso':'Pendente'}</div>
                                    </div>
                                    {(isDone || isCurrent) && (
                                      <div style={{marginTop:'4px'}}>
                                        <div style={{height:'3px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden',marginBottom:'4px'}}>
                                          <div style={{height:'100%',width:`${checksTotal>0?(checksDone/checksTotal*100):0}%`,background:isDone?'#1c4a35':'#c9a96e'}}/>
                                        </div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.35)',letterSpacing:'.06em'}}>{checksDone}/{checksTotal} itens completados</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── MARKETING AI ── */}
            {section==='marketing' && (
              <div style={{maxWidth:'1100px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Voz · Vision AI · 12 Formatos · 5 Línguas · Personas · Calendar</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'20px'}}>Marketing <em style={{color:'#1c4a35'}}>AI Suite</em></div>

                <div style={{display:'grid',gridTemplateColumns:'400px 1fr',gap:'24px'}}>
                  {/* ── LEFT: Input ── */}
                  <div>
                    {/* Input tabs */}
                    <div style={{display:'flex',borderBottom:'1px solid rgba(14,14,13,.1)',marginBottom:'0',flexWrap:'wrap'}}>
                      {[
                        {id:'dados',label:'Imóvel'},
                        {id:'media',label:`Fotos ${mktPhotos.length>0?`(${mktPhotos.length})`:''}` },
                        {id:'url',label:'URL/Vídeo'},
                        {id:'tour',label:`Tour ${mktTourUrl?'✓':''}`},
                      ].map(t=>(
                        <button key={t.id} className={`mkt-input-tab${mktInputTab===t.id?' active':''}`}
                          onClick={()=>setMktInputTab(t.id as 'dados'|'media'|'url'|'tour')}
                          style={{color:t.id==='tour'&&mktTourUrl?'#1c4a35':undefined}}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-card" style={{borderTop:'none'}}>
                      {/* Tab: dados */}
                      {mktInputTab === 'dados' && (
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#0e0e0d'}}>Dados do Imóvel</div>
                            <button onClick={startVoice} style={{display:'flex',alignItems:'center',gap:'5px',background:isListening?'#c9a96e':'rgba(28,74,53,.08)',border:'none',padding:'6px 12px',cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',textTransform:'uppercase',color:isListening?'#0c1f15':'#1c4a35',transition:'all .2s'}}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                              {isListening?'A ouvir...':'Voz'}
                            </button>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                            <div><label className="p-label">Zona</label><input className="p-inp" placeholder="ex: Cascais" value={mktInput.zona} onChange={e=>setMktInput(p=>({...p,zona:e.target.value}))}/></div>
                            <div><label className="p-label">Tipologia</label><input className="p-inp" placeholder="ex: Villa T4" value={mktInput.tipo} onChange={e=>setMktInput(p=>({...p,tipo:e.target.value}))}/></div>
                            <div><label className="p-label">Área (m²)</label><input className="p-inp" placeholder="ex: 350" value={mktInput.area} onChange={e=>setMktInput(p=>({...p,area:e.target.value}))}/></div>
                            <div><label className="p-label">Preço (€)</label><input className="p-inp" placeholder="ex: 2800000" value={mktInput.preco} onChange={e=>setMktInput(p=>({...p,preco:e.target.value}))}/></div>
                            <div><label className="p-label">Quartos</label><input className="p-inp" placeholder="ex: 4" value={mktInput.quartos} onChange={e=>setMktInput(p=>({...p,quartos:e.target.value}))}/></div>
                            <div><label className="p-label">Características</label><input className="p-inp" placeholder="piscina, vista mar, garagem" value={mktInput.features} onChange={e=>setMktInput(p=>({...p,features:e.target.value}))}/></div>
                          </div>
                          <div style={{marginBottom:'8px'}}>
                            <label className="p-label">Descrição adicional</label>
                            <textarea className="p-inp" style={{minHeight:'72px',resize:'vertical'}} placeholder="Descreve o imóvel ou usa voz..." value={mktInput.descricao} onChange={e=>setMktInput(p=>({...p,descricao:e.target.value}))}/>
                          </div>
                        </div>
                      )}

                      {/* Tab: media */}
                      {mktInputTab === 'media' && (
                        <div>
                          <div
                            className={`photo-drop${dragOver?' drag':''}`}
                            onClick={()=>fileInputRef.current?.click()}
                            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                            onDragLeave={()=>setDragOver(false)}
                            onDrop={e=>{e.preventDefault();setDragOver(false);handlePhotoUpload(e.dataTransfer.files)}}
                          >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.25)" strokeWidth="1.5" style={{margin:'0 auto 8px',display:'block'}}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>Arrastar ou clicar</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',marginTop:'4px'}}>Máx. 10 fotos · A IA analisa as 4 primeiras</div>
                          </div>
                          <input type="file" accept="image/*" multiple ref={fileInputRef} style={{display:'none'}} onChange={e=>handlePhotoUpload(e.target.files)}/>
                          {mktPhotos.length > 0 && (
                            <>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#1c4a35',marginTop:'8px',letterSpacing:'.06em'}}>
                                ✦ IA irá analisar {Math.min(4,mktPhotos.length)} {mktPhotos.length===1?'foto':'fotos'} — extract espaços, materiais, luz e atmosfera
                              </div>
                              <div className="photo-grid">
                                {mktPhotos.map((src, i)=>(
                                  <div key={i} className="photo-thumb">
                                    <img src={src} alt={`foto ${i+1}`}/>
                                    {i < 4 && <div style={{position:'absolute',top:'2px',left:'2px',background:'#1c4a35',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'1px 4px'}}>IA</div>}
                                    <button className="photo-remove" onClick={e=>{e.stopPropagation();setMktPhotos(prev=>prev.filter((_,idx)=>idx!==i))}}>×</button>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Tab: url */}
                      {mktInputTab === 'url' && (
                        <div>
                          <div style={{marginBottom:'12px'}}>
                            <label className="p-label">URL do Anúncio (Idealista / Imovirtual)</label>
                            <div style={{display:'flex',gap:'8px'}}>
                              <input className="p-inp" placeholder="https://www.idealista.pt/imovel/..." value={mktListingUrl} onChange={e=>setMktListingUrl(e.target.value)} style={{flex:1}}/>
                              <button className="p-btn" onClick={autoFillFromUrl} disabled={mktAutoFilling || !mktListingUrl.trim()} style={{whiteSpace:'nowrap',padding:'10px 14px',fontSize:'.46rem'}}>
                                {mktAutoFilling ? '...' : 'Auto →'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="p-label">Link Vídeo (YouTube / Vimeo)</label>
                            <input className="p-inp" placeholder="https://youtube.com/watch?v=..." value={mktVideoUrl} onChange={e=>setMktVideoUrl(e.target.value)}/>
                          </div>
                        </div>
                      )}

                      {/* Tab: tour */}
                      {mktInputTab === 'tour' && (() => {
                        const detectPlatform = (url: string) => {
                          if (url.includes('matterport')) return 'matterport'
                          if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube'
                          if (url.includes('cloudpano')) return 'cloudpano'
                          if (url.includes('kuula')) return 'kuula'
                          return 'generic'
                        }
                        const platform = mktTourUrl ? detectPlatform(mktTourUrl) : null
                        const getEmbedUrl = (url: string) => {
                          if (!url) return ''
                          if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]?.split('?')[0]}`
                          if (url.includes('youtube.com/watch')) { const v = new URLSearchParams(url.split('?')[1]).get('v'); return v ? `https://www.youtube.com/embed/${v}` : url }
                          return url
                        }
                        const embedUrl = getEmbedUrl(mktTourUrl)
                        return (
                          <div>
                            <div style={{display:'flex',gap:'5px',marginBottom:'10px',flexWrap:'wrap'}}>
                              {[{id:'matterport',label:'Matterport',logo:'M'},{id:'youtube',label:'YouTube 360°',logo:'▶'},{id:'cloudpano',label:'CloudPano',logo:'☁'},{id:'kuula',label:'Kuula',logo:'◉'}].map(p=>(
                                <div key={p.id} style={{padding:'4px 12px',background:platform===p.id?'#1c4a35':'rgba(14,14,13,.04)',border:`1px solid ${platform===p.id?'#1c4a35':'rgba(14,14,13,.12)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',color:platform===p.id?'#f4f0e6':'rgba(14,14,13,.45)',textTransform:'uppercase',display:'flex',alignItems:'center',gap:'4px'}}><span>{p.logo}</span>{p.label}</div>
                              ))}
                            </div>
                            <input className="p-inp" placeholder="https://my.matterport.com/show/?m=..." value={mktTourUrl} onChange={e=>setMktTourUrl(e.target.value)}/>
                            {mktTourUrl && (
                              <div style={{marginTop:'12px'}}>
                                <div style={{position:'relative',paddingBottom:'56.25%',height:0,background:'#0c1f15',overflow:'hidden'}}>
                                  <iframe src={embedUrl || mktTourUrl} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} allow="xr-spatial-tracking; fullscreen; accelerometer; gyroscope; vr" allowFullScreen title="Tour Virtual"/>
                                </div>
                                <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                                  <button style={{flex:1,background:'rgba(28,74,53,.08)',border:'1px solid rgba(28,74,53,.2)',color:'#1c4a35',padding:'6px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',cursor:'pointer'}} onClick={()=>{navigator.clipboard.writeText(`<iframe src="${embedUrl||mktTourUrl}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`)}}>{'<>'} Embed</button>
                                  <button style={{flex:1,background:'#1c4a35',border:'none',color:'#f4f0e6',padding:'6px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',cursor:'pointer'}} onClick={()=>window.open(mktTourUrl,'_blank')}>⛶ Fullscreen</button>
                                </div>
                                <div style={{marginTop:'10px',display:'flex',alignItems:'center',gap:'12px'}}>
                                  <div className="tour-timer">
                                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#4a9c7a',animation:'pulse 1.5s ease-in-out infinite'}}/>
                                    {Math.floor(tourSeconds/60)}:{String(tourSeconds%60).padStart(2,'0')} em tour
                                  </div>
                                  {tourSeconds > 60 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.5)'}}>{tourSeconds<180?'🟡 Morno':tourSeconds<300?'🟠 Quente':'🔥 Hot Lead'}</div>}
                                  {tourHotAlert && <div className="tour-hot" onClick={()=>setSection('crm')}>🔥 +5min → CRM Lead Quente</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* ── Persona Selector ── */}
                    <div className="p-card" style={{marginTop:'12px',padding:'14px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Buyer Persona Target</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                        {PERSONAS.map(p=>(
                          <button key={p.id}
                            onClick={()=>setMktPersona(p.id)}
                            style={{padding:'8px 10px',textAlign:'left',background:mktPersona===p.id?'rgba(28,74,53,.08)':'transparent',border:`1px solid ${mktPersona===p.id?'#1c4a35':'rgba(14,14,13,.12)'}`,cursor:'pointer',transition:'all .15s'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:mktPersona===p.id?'#1c4a35':'rgba(14,14,13,.6)',fontWeight:mktPersona===p.id?600:400}}>{p.label}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{p.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Language Selector ── */}
                    <div className="p-card" style={{marginTop:'8px',padding:'12px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Idiomas (selecciona múltiplos)</div>
                      <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {[['pt','🇵🇹 PT'],['en','🇬🇧 EN'],['fr','🇫🇷 FR'],['de','🇩🇪 DE'],['zh','🇨🇳 ZH']].map(([l,label])=>{
                          const active = mktLangs.includes(l)
                          return (
                            <button key={l}
                              onClick={()=>setMktLangs(prev=>active?prev.filter(x=>x!==l):[...prev,l])}
                              style={{padding:'5px 12px',background:active?'#1c4a35':'transparent',border:`1px solid ${active?'#1c4a35':'rgba(14,14,13,.15)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:active?'#f4f0e6':'rgba(14,14,13,.45)',cursor:'pointer',transition:'all .15s'}}
                            >{label}</button>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Generate ── */}
                    <button className="p-btn p-btn-gold" style={{width:'100%',marginTop:'10px',padding:'14px',fontSize:'.6rem',letterSpacing:'.16em'}} onClick={runMarketing} disabled={mktLoading}>
                      {mktLoading ? `✦ A gerar ${FORMATS.length} formatos...` : `✦ Gerar ${FORMATS.length} Formatos AI`}
                    </button>
                    {mktLoading && (
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',textAlign:'center',marginTop:'6px',letterSpacing:'.08em'}}>
                        Vision AI + Neuromarketing + {mktLangs.length} língua{mktLangs.length>1?'s':''} · ~30-45s
                      </div>
                    )}
                  </div>

                  {/* ── RIGHT: Results ── */}
                  <div>
                    {mktResult ? (
                      <div>
                        {/* SEO Score + Photo insights banner */}
                        {(mktSeoScore !== null || mktPhotoInsights) && (
                          <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
                            {mktSeoScore !== null && (
                              <div style={{display:'flex',alignItems:'center',gap:'8px',background:mktSeoScore>=80?'rgba(74,156,122,.08)':mktSeoScore>=60?'rgba(201,169,110,.08)':'rgba(220,80,60,.06)',border:`1px solid ${mktSeoScore>=80?'rgba(74,156,122,.25)':mktSeoScore>=60?'rgba(201,169,110,.25)':'rgba(220,80,60,.2)'}`,padding:'8px 14px',flex:'0 0 auto'}}>
                                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.4rem',color:mktSeoScore>=80?'#4a9c7a':mktSeoScore>=60?'#c9a96e':'#e05454',lineHeight:1}}>{mktSeoScore}</div>
                                <div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>SEO Score</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)'}}>Idealista ranking</div>
                                </div>
                              </div>
                            )}
                            {mktPhotoInsights && (
                              <div style={{flex:1,background:'rgba(28,74,53,.05)',border:'1px solid rgba(28,74,53,.1)',padding:'8px 12px',cursor:'pointer'}} onClick={()=>alert(mktPhotoInsights)}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'2px'}}>✦ Vision AI — Fotos analisadas</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{mktPhotoInsights.substring(0,80)}... (clica para ver)</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Format tabs */}
                        <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
                          {FORMATS.map(f=>{
                            const cnt = mktCharCounts?.[f.id]?.[mktLang] || 0
                            const lim = f.charLimit
                            const over = cnt > lim
                            return (
                              <button key={f.id}
                                className={`mkt-tab${mktFormat===f.id?' active':''}`}
                                onClick={()=>setMktFormat(f.id)}
                                style={{position:'relative'}}>
                                {f.icon} {f.label}
                                {cnt > 0 && <span style={{marginLeft:'4px',fontSize:'.35rem',color:over?'#e05454':'rgba(14,14,13,.35)',background:over?'rgba(220,80,60,.08)':'transparent',padding:over?'0 3px':'0'}}>{cnt > 1000 ? `${(cnt/1000).toFixed(1)}K` : cnt}/{lim > 1000 ? `${(lim/1000).toFixed(0)}K` : lim}</span>}
                              </button>
                            )
                          })}
                        </div>

                        {/* Language tabs */}
                        <div style={{display:'flex',gap:'5px',marginBottom:'10px',alignItems:'center'}}>
                          {mktLangs.map(l=>{
                            const flags: Record<string,string> = {pt:'🇵🇹',en:'🇬🇧',fr:'🇫🇷',de:'🇩🇪',zh:'🇨🇳'}
                            return <button key={l} className={`mkt-tab${mktLang===l?' active':''}`} onClick={()=>setMktLang(l)}>{flags[l]||'🌐'} {l.toUpperCase()}</button>
                          })}
                          <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)',letterSpacing:'.08em'}}>
                            Persona: {PERSONAS.find(p=>p.id===mktPersona)?.label || mktPersona}
                          </div>
                        </div>

                        {/* Content display */}
                        {(() => {
                          const f = mktResult[mktFormat] as Record<string,string>|undefined
                          const content = f ? (f[mktLang] || f['pt'] || 'Conteúdo não disponível') : 'A gerar...'
                          const charCount = mktCharCounts?.[mktFormat]?.[mktLang] || content.length
                          const charLimit = FORMATS.find(fmt=>fmt.id===mktFormat)?.charLimit || 99999
                          const isOver = charCount > charLimit
                          return (
                            <div>
                              <div className="mkt-result" style={{whiteSpace:'pre-wrap'}}>
                                {content}
                              </div>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px',marginBottom:'8px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:isOver?'#e05454':'rgba(14,14,13,.35)',letterSpacing:'.06em'}}>
                                  {charCount.toLocaleString('pt-PT')} / {charLimit.toLocaleString('pt-PT')} chars {isOver?'⚠ acima do limite':''}
                                </div>
                                {mktPostingSchedule?.[mktFormat] && (
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',letterSpacing:'.06em'}}>
                                    📅 {mktPostingSchedule[mktFormat].day} · {mktPostingSchedule[mktFormat].time}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Action buttons */}
                        <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap'}}>
                          <button className="p-btn" style={{flex:1}} onClick={copyContent}>{copied ? '✓ Copiado!' : 'Copiar'}</button>
                          <button className="p-btn p-btn-gold" style={{flex:1}}
                            onClick={()=>{
                              const content = mktResult && mktResult[mktFormat] ? (mktResult[mktFormat] as Record<string,string>)[mktLang] || '' : ''
                              window.open(`https://wa.me/?text=${encodeURIComponent(content)}`, '_blank')
                            }}>WhatsApp →</button>
                          <button className="p-btn" style={{flex:1,background:'rgba(28,74,53,.08)',color:'#1c4a35'}}
                            onClick={()=>{
                              const content = mktResult && mktResult[mktFormat] ? (mktResult[mktFormat] as Record<string,string>)[mktLang] || '' : ''
                              if (navigator.share) navigator.share({ text: content }).catch(()=>{})
                              else navigator.clipboard.writeText(content)
                            }}>Partilhar</button>
                        </div>

                        {/* Content Calendar Toggle */}
                        {mktPostingSchedule && (
                          <div>
                            <button
                              onClick={()=>setMktCalendarOpen(o=>!o)}
                              style={{width:'100%',padding:'10px',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#1c4a35',cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span>📅 Content Calendar — Quando Postar</span>
                              <span>{mktCalendarOpen?'▲':'▼'}</span>
                            </button>
                            {mktCalendarOpen && (
                              <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',borderTop:'none',padding:'12px'}}>
                                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                                  {FORMATS.map(fmt=>{
                                    const sched = mktPostingSchedule[fmt.id]
                                    if (!sched) return null
                                    const isCurrent = fmt.id === mktFormat
                                    return (
                                      <div key={fmt.id}
                                        onClick={()=>setMktFormat(fmt.id)}
                                        style={{padding:'8px 10px',background:isCurrent?'rgba(28,74,53,.06)':'rgba(14,14,13,.02)',border:`1px solid ${isCurrent?'rgba(28,74,53,.2)':'rgba(14,14,13,.06)'}`,cursor:'pointer',transition:'all .15s'}}>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:isCurrent?'#1c4a35':'rgba(14,14,13,.5)',marginBottom:'4px',fontWeight:isCurrent?600:400}}>{fmt.icon} {fmt.label}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.6)',marginBottom:'2px'}}>{sched.day}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#c9a96e'}}>{sched.time}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.3)',marginTop:'3px',lineHeight:1.4}}>{sched.reason}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'400px',border:'1px dashed rgba(14,14,13,.12)',background:'rgba(14,14,13,.02)'}}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.18)" strokeWidth="1.5"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                        <p style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.14em',color:'rgba(14,14,13,.28)',textTransform:'uppercase',marginTop:'16px',textAlign:'center'}}>12 formatos · 5 línguas · Vision AI<br/>Selecciona persona e clica gerar</p>
                        <div style={{display:'flex',gap:'8px',marginTop:'20px',flexWrap:'wrap',justifyContent:'center'}}>
                          {FORMATS.slice(0,6).map(f=>(
                            <div key={f.id} style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.25)',background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.06)',padding:'4px 10px'}}>{f.icon} {f.label}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── HOME STAGING IA ── */}
            {section==='homestaging' && (()=>{
              const HS_STYLES = [
                { id:'moderno',      label:'Moderno',      emoji:'◼', desc:'Clean lines · Neutral palette' },
                { id:'escandinavo',  label:'Escandinavo',  emoji:'◻', desc:'Light wood · Hygge · Linen' },
                { id:'luxo',         label:'Luxo',         emoji:'✦', desc:'Marble · Gold · Bespoke' },
                { id:'minimalista',  label:'Minimalista',  emoji:'—', desc:'Zero clutter · Zen volumes' },
                { id:'industrial',   label:'Industrial',   emoji:'⬡', desc:'Brick · Steel · Edison' },
                { id:'mediterraneo', label:'Mediterrâneo', emoji:'○', desc:'Terracotta · Arches · Warm' },
                { id:'classico',     label:'Clássico',     emoji:'⬘', desc:'Elegant · Rich fabrics · Walnut' },
                { id:'japandi',      label:'Japandi',      emoji:'〇', desc:'Wabi-sabi · Natural · Muted' },
              ]
              const HS_ROOMS = [
                { id:'sala',       label:'Sala' },
                { id:'quarto',     label:'Quarto' },
                { id:'cozinha',    label:'Cozinha' },
                { id:'casa_banho', label:'Casa de Banho' },
                { id:'varanda',    label:'Varanda' },
                { id:'escritorio', label:'Escritório' },
                { id:'entrada',    label:'Entrada' },
                { id:'garagem',    label:'Garagem' },
              ]

              const handleHsFile = (file: File) => {
                if (!file.type.startsWith('image/')) return
                setHsImageName(file.name)
                const reader = new FileReader()
                reader.onload = (e) => {
                  setHsImage(e.target?.result as string)
                  setHsResults([])
                  setHsError(null)
                }
                reader.readAsDataURL(file)
              }

              const generateStaging = async () => {
                if (!hsImage) return
                setHsLoading(true)
                setHsError(null)
                setHsResults([])
                try {
                  const res = await fetch('/api/homestaging', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({
                      image_base64: hsImage,
                      style: hsStyle,
                      room_type: hsRoomType,
                      variations: hsVariations,
                      control_strength: hsStrength,
                    })
                  })
                  const data = await res.json() as { success?:boolean; images?:{base64:string;seed:number}[]; error?:string }
                  if (!res.ok || !data.success) {
                    setHsError(data.error ?? 'Erro a gerar staging')
                  } else {
                    setHsResults(data.images ?? [])
                    setHsSelected(0)
                    setHsSlider(50)
                  }
                } catch(e) {
                  setHsError(e instanceof Error ? e.message : 'Erro de rede')
                } finally {
                  setHsLoading(false)
                }
              }

              const downloadImage = (base64: string, idx: number) => {
                const a = document.createElement('a')
                a.href = `data:image/jpeg;base64,${base64}`
                a.download = `staging_${hsStyle}_${hsRoomType}_v${idx+1}.jpg`
                a.click()
              }

              const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
                const rect = hsSliderRef.current?.getBoundingClientRect()
                if (!rect) return
                const x = e.clientX - rect.left
                setHsSlider(Math.max(0, Math.min(100, (x / rect.width) * 100)))
              }

              const currentResult = hsResults[hsSelected]

              return (
                <div style={{maxWidth:'1200px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Stability AI Structure Control · 8 Estilos · Antes/Depois</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'4px'}}>Home Staging <em style={{color:'#1c4a35'}}>IA</em></div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginBottom:'24px'}}>Transforma qualquer divisão mantendo a geometria exacta — paredes, janelas, portas, áreas inalteradas</div>

                  <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:'24px',alignItems:'start'}}>
                    {/* ── LEFT CONTROLS ── */}
                    <div>
                      {/* Upload zone */}
                      <div className="p-card" style={{marginBottom:'16px',padding:'0'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',padding:'10px 14px 6px'}}>✦ Fotografia Original</div>
                        <div
                          onDragOver={e=>{e.preventDefault();setHsDragOver(true)}}
                          onDragLeave={()=>setHsDragOver(false)}
                          onDrop={e=>{e.preventDefault();setHsDragOver(false);const f=e.dataTransfer.files[0];if(f)handleHsFile(f)}}
                          onClick={()=>hsFileRef.current?.click()}
                          style={{
                            margin:'0 14px 14px',
                            border:`2px dashed ${hsDragOver?'#1c4a35':'rgba(14,14,13,.15)'}`,
                            background: hsDragOver?'rgba(28,74,53,.04)':'rgba(14,14,13,.02)',
                            cursor:'pointer',
                            minHeight: hsImage?'auto':'120px',
                            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                            transition:'all .2s',
                            overflow:'hidden',
                          }}>
                          {hsImage ? (
                            <div style={{position:'relative',width:'100%'}}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={hsImage} alt="original" style={{width:'100%',height:'180px',objectFit:'cover',display:'block'}}/>
                              <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,.5)',padding:'4px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <span>{hsImageName || 'Imagem carregada'}</span>
                                <span style={{color:'rgba(255,255,255,.6)'}}>clica para alterar</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.2)" strokeWidth="1.5"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.3)',marginTop:'8px',textAlign:'center',letterSpacing:'.06em'}}>Arrasta ou clica para carregar<br/>JPG · PNG · WEBP</div>
                            </>
                          )}
                        </div>
                        <input ref={hsFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleHsFile(f)}}/>
                      </div>

                      {/* Room Type */}
                      <div className="p-card" style={{marginBottom:'16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Tipo de Divisão</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                          {HS_ROOMS.map(r=>(
                            <button key={r.id} onClick={()=>setHsRoomType(r.id)}
                              style={{
                                fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.06em',
                                padding:'5px 10px',border:'1px solid',cursor:'pointer',transition:'all .15s',
                                background: hsRoomType===r.id?'#1c4a35':'transparent',
                                color: hsRoomType===r.id?'#fff':'rgba(14,14,13,.5)',
                                borderColor: hsRoomType===r.id?'#1c4a35':'rgba(14,14,13,.15)',
                              }}>{r.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Style Grid */}
                      <div className="p-card" style={{marginBottom:'16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Estilo de Decoração</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                          {HS_STYLES.map(s=>(
                            <button key={s.id} onClick={()=>setHsStyle(s.id)}
                              style={{
                                textAlign:'left',padding:'8px 10px',cursor:'pointer',transition:'all .15s',
                                background: hsStyle===s.id?'rgba(28,74,53,.08)':'transparent',
                                border:`1px solid ${hsStyle===s.id?'#1c4a35':'rgba(14,14,13,.1)'}`,
                              }}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:hsStyle===s.id?'#1c4a35':'rgba(14,14,13,.7)',fontWeight:hsStyle===s.id?600:400}}>
                                {s.emoji} {s.label}
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{s.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="p-card" style={{marginBottom:'16px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Opções</div>
                        <div style={{marginBottom:'10px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',marginBottom:'4px'}}>Variações: <strong style={{color:'#1c4a35'}}>{hsVariations}</strong></div>
                          <div style={{display:'flex',gap:'6px'}}>
                            {[1,2,3].map(n=>(
                              <button key={n} onClick={()=>setHsVariations(n)}
                                style={{flex:1,padding:'5px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',border:'1px solid',
                                  background: hsVariations===n?'#1c4a35':'transparent',
                                  color: hsVariations===n?'#fff':'rgba(14,14,13,.5)',
                                  borderColor: hsVariations===n?'#1c4a35':'rgba(14,14,13,.15)',
                                }}>{n}×</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',marginBottom:'4px',display:'flex',justifyContent:'space-between'}}>
                            <span>Fidelidade estrutural</span>
                            <strong style={{color:'#1c4a35'}}>{Math.round(hsStrength*100)}%</strong>
                          </div>
                          <input type="range" min="0.4" max="0.85" step="0.05" value={hsStrength}
                            onChange={e=>setHsStrength(Number(e.target.value))}
                            style={{width:'100%',accentColor:'#1c4a35'}}/>
                          <div style={{display:'flex',justifyContent:'space-between',fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(14,14,13,.3)'}}>
                            <span>Mais criativo</span><span>Mais fiel</span>
                          </div>
                        </div>
                      </div>

                      {/* Generate button */}
                      <button onClick={generateStaging} disabled={!hsImage||hsLoading}
                        style={{
                          width:'100%',padding:'13px',fontFamily:"'DM Mono',monospace",fontSize:'.5rem',
                          letterSpacing:'.14em',textTransform:'uppercase',cursor:(!hsImage||hsLoading)?'not-allowed':'pointer',
                          background: (!hsImage||hsLoading)?'rgba(14,14,13,.08)':'#1c4a35',
                          color: (!hsImage||hsLoading)?'rgba(14,14,13,.3)':'#fff',
                          border:'none',transition:'all .2s',
                        }}>
                        {hsLoading ? '◌ A gerar staging...' : '✦ Gerar Home Staging'}
                      </button>

                      {!process.env.NEXT_PUBLIC_STABILITY_CONFIGURED && (
                        <div style={{marginTop:'8px',padding:'8px 10px',background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.5)'}}>
                          Requer <strong>STABILITY_API_KEY</strong> no .env.local<br/>
                          <span style={{color:'rgba(14,14,13,.35)'}}>api.stability.ai · ~$0.04/imagem</span>
                        </div>
                      )}

                      {hsError && (
                        <div style={{marginTop:'8px',padding:'8px 10px',background:'rgba(220,38,38,.05)',border:'1px solid rgba(220,38,38,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#dc2626'}}>
                          {hsError}
                        </div>
                      )}
                    </div>

                    {/* ── RIGHT: Preview ── */}
                    <div>
                      {hsResults.length > 0 && currentResult ? (
                        <>
                          {/* Variation selector */}
                          {hsResults.length > 1 && (
                            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
                              {hsResults.map((_,i)=>(
                                <button key={i} onClick={()=>setHsSelected(i)}
                                  style={{
                                    flex:1,padding:'7px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.06em',
                                    textTransform:'uppercase',cursor:'pointer',border:'1px solid',
                                    background: hsSelected===i?'#1c4a35':'transparent',
                                    color: hsSelected===i?'#fff':'rgba(14,14,13,.5)',
                                    borderColor: hsSelected===i?'#1c4a35':'rgba(14,14,13,.15)',
                                  }}>Variação {i+1}</button>
                              ))}
                            </div>
                          )}

                          {/* Before/After Slider */}
                          <div style={{marginBottom:'8px',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span>◀ ANTES</span>
                            <span style={{color:'rgba(14,14,13,.25)'}}>— arrasta para comparar —</span>
                            <span>DEPOIS ▶</span>
                          </div>

                          <div
                            ref={hsSliderRef}
                            onMouseMove={e=>{if(e.buttons===1)handleSliderMove(e)}}
                            onClick={handleSliderMove}
                            style={{
                              position:'relative',width:'100%',aspectRatio:'16/9',
                              overflow:'hidden',cursor:'col-resize',userSelect:'none',
                              border:'1px solid rgba(14,14,13,.1)',
                            }}>
                            {/* DEPOIS (full width background) */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/jpeg;base64,${currentResult.base64}`}
                              alt="depois"
                              style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                            />
                            {/* ANTES (clipped left portion) */}
                            <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${hsSlider}%`,overflow:'hidden'}}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={hsImage!}
                                alt="antes"
                                style={{position:'absolute',top:0,left:0,height:'100%',width:`${100/hsSlider*100}%`,maxWidth:'none',objectFit:'cover'}}
                              />
                            </div>
                            {/* Divider line */}
                            <div style={{
                              position:'absolute',top:0,bottom:0,
                              left:`${hsSlider}%`,
                              width:'2px',background:'#fff',
                              boxShadow:'0 0 8px rgba(0,0,0,.4)',
                              transform:'translateX(-50%)',
                              pointerEvents:'none',
                            }}>
                              <div style={{
                                position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                                width:'32px',height:'32px',borderRadius:'50%',
                                background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.3)',
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#1c4a35',fontWeight:700,
                                pointerEvents:'none',
                              }}>⇔</div>
                            </div>
                            {/* Labels */}
                            <div style={{position:'absolute',top:'8px',left:'8px',background:'rgba(0,0,0,.55)',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#fff',letterSpacing:'.06em'}}>ANTES</div>
                            <div style={{position:'absolute',top:'8px',right:'8px',background:'rgba(28,74,53,.85)',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'#fff',letterSpacing:'.06em'}}>DEPOIS · {HS_STYLES.find(s=>s.id===hsStyle)?.label}</div>
                          </div>

                          {/* Action bar */}
                          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                            <button onClick={()=>downloadImage(currentResult.base64, hsSelected)}
                              style={{flex:1,padding:'9px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',background:'#1c4a35',color:'#fff',border:'none'}}>
                              ↓ Download JPG
                            </button>
                            <button onClick={()=>{
                              const link = document.createElement('a')
                              link.href = hsImage!
                              link.download = `original_${hsImageName||'foto'}`
                              link.click()
                            }}
                              style={{padding:'9px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',background:'transparent',border:'1px solid rgba(14,14,13,.15)',color:'rgba(14,14,13,.5)'}}>
                              ↓ Original
                            </button>
                            <button onClick={generateStaging} disabled={hsLoading}
                              style={{padding:'9px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',textTransform:'uppercase',cursor:hsLoading?'not-allowed':'pointer',background:'transparent',border:'1px solid rgba(28,74,53,.3)',color:'#1c4a35'}}>
                              ↻ Novo
                            </button>
                          </div>

                          {/* Info strip */}
                          <div style={{marginTop:'10px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
                            {[
                              {label:'Estilo', val: HS_STYLES.find(s=>s.id===hsStyle)?.label},
                              {label:'Divisão', val: HS_ROOMS.find(r=>r.id===hsRoomType)?.label},
                              {label:'Fidelidade', val: `${Math.round(hsStrength*100)}%`},
                              {label:'Seed', val: String(currentResult.seed)},
                            ].map(item=>(
                              <div key={item.label} style={{padding:'4px 10px',background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.07)'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(14,14,13,.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>{item.label}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#1c4a35',fontWeight:600}}>{item.val}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : hsLoading ? (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'400px',border:'1px solid rgba(14,14,13,.08)',background:'rgba(14,14,13,.02)'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#1c4a35',letterSpacing:'.1em',textTransform:'uppercase'}}>◌ A processar...</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',marginTop:'8px'}}>Stability AI · Structure Control · ~15-30s</div>
                          <div style={{marginTop:'20px',display:'flex',gap:'6px'}}>
                            {[0.2,0.4,0.6,0.8,1].map(o=>(
                              <div key={o} style={{width:'6px',height:'6px',borderRadius:'50%',background:`rgba(28,74,53,${o})`,animation:'pulse 1.4s ease-in-out infinite',animationDelay:`${o*0.2}s`}}/>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'400px',border:'1px dashed rgba(14,14,13,.12)',background:'rgba(14,14,13,.02)'}}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.12)" strokeWidth="1"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.2)',marginTop:'16px',textAlign:'center'}}>
                            Carrega uma foto · escolhe o estilo · gera
                          </div>
                          <div style={{marginTop:'12px',display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center',maxWidth:'320px'}}>
                            {['Moderno','Luxo','Japandi','Escandinavo','Industrial','Mediterrâneo'].map(s=>(
                              <div key={s} style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.2)',border:'1px solid rgba(14,14,13,.06)',padding:'3px 8px'}}>{s}</div>
                            ))}
                          </div>
                          <div style={{marginTop:'20px',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.18)',textAlign:'center',lineHeight:1.6}}>
                            Paredes · janelas · portas · áreas<br/>mantidos exactamente como estão
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── DOCUMENTOS ── */}
            {section==='documentos' && (
              <div style={{maxWidth:'800px'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Da angariação à escritura</div>
                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'20px'}}>Biblioteca <em style={{color:'#1c4a35'}}>Legal</em></div>

                {/* Search */}
                <div style={{marginBottom:'24px'}}>
                  <input
                    className="p-inp"
                    placeholder="Pesquisar documentos..."
                    value={docSearch}
                    onChange={e=>setDocSearch(e.target.value)}
                    style={{maxWidth:'400px'}}
                  />
                </div>

                {filteredDocs.map(cat=>(
                  <div key={cat.fase} style={{marginBottom:'24px'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'#1c4a35',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{width:'6px',height:'6px',background:'#c9a96e',borderRadius:'50%'}}></div>
                      {cat.fase}
                    </div>
                    <div className="p-card">
                      {cat.docs.map((doc,i)=>(
                        <div key={i} className="doc-item">
                          <div>
                            <div style={{fontSize:'.85rem',color:'#0e0e0d',fontWeight:500,marginBottom:'2px'}}>{doc.name}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(14,14,13,.4)',letterSpacing:'.06em'}}>{doc.desc}</div>
                          </div>
                          <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                            <button
                              style={{background:'none',border:'1px solid rgba(14,14,13,.15)',color:'rgba(14,14,13,.5)',padding:'6px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',cursor:'pointer',whiteSpace:'nowrap'}}
                              onClick={()=>doc.fileUrl ? window.open(doc.fileUrl,'_blank') : window.open(`mailto:geral@agencygroup.pt?subject=Solicitar: ${encodeURIComponent(doc.name)}`)}
                            >
                              Ver Modelo
                            </button>
                            <button
                              className="p-btn"
                              style={{padding:'6px 14px',fontSize:'.46rem'}}
                              onClick={()=>{ if(doc.fileUrl){ const a=document.createElement('a');a.href=doc.fileUrl;a.download=doc.fileUrl.split('/').pop()||doc.name;a.click() } else { window.open(`mailto:geral@agencygroup.pt?subject=Solicitar: ${encodeURIComponent(doc.name)}`) } }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredDocs.length === 0 && (
                  <div style={{textAlign:'center',padding:'48px',border:'1px dashed rgba(14,14,13,.12)'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'rgba(14,14,13,.3)',letterSpacing:'.14em',textTransform:'uppercase'}}>Sem resultados para &quot;{docSearch}&quot;</div>
                  </div>
                )}
              </div>
            )}

            {/* ── CRM CLIENTES ── */}
            {section==='crm' && (() => {
              const STATUS_CONFIG = {
                lead: { label:'Lead', bg:'rgba(136,136,136,.12)', color:'#888', avatar:'rgba(136,136,136,.15)' },
                prospect: { label:'Prospect', bg:'rgba(58,123,213,.1)', color:'#3a7bd5', avatar:'rgba(58,123,213,.12)' },
                cliente: { label:'Cliente', bg:'rgba(74,156,122,.1)', color:'#4a9c7a', avatar:'rgba(74,156,122,.12)' },
                vip: { label:'VIP', bg:'rgba(201,169,110,.12)', color:'#c9a96e', avatar:'rgba(201,169,110,.15)' },
              }
              const filtered = crmContacts.filter(c => {
                const searchMatch = !crmSearch || c.name.toLowerCase().includes(crmSearch.toLowerCase()) ||
                  c.email.toLowerCase().includes(crmSearch.toLowerCase()) ||
                  c.nationality.toLowerCase().includes(crmSearch.toLowerCase())
                const natMatch = !crmNatFilter || c.nationality.toLowerCase().includes(crmNatFilter.toLowerCase())
                const zonaMatch = !crmZonaFilter || c.zonas.some(z=>z.toLowerCase().includes(crmZonaFilter.toLowerCase()))
                const statusMatch = !crmStatusFilter || c.status === crmStatusFilter
                return searchMatch && natMatch && zonaMatch && statusMatch
              }).sort((a,b) => computeLeadScore(b).score - computeLeadScore(a).score)
              const activeContact = activeCrmId ? crmContacts.find(c=>c.id===activeCrmId) : null
              const vipCount = crmContacts.filter(c=>c.status==='vip').length
              const clienteCount = crmContacts.filter(c=>c.status==='cliente').length
              const totalBudget = crmContacts.reduce((s,c)=>s+(Number(c.budgetMax)||0),0)
              const followUps = crmContacts.filter(c=>c.nextFollowUp && new Date(c.nextFollowUp)<=new Date(Date.now()+3*86400000)).length
              return (
                <div>
                  {/* Header */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'6px'}}>Gestão de Clientes · World-Class Real Estate CRM</div>
                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d'}}>CRM <em style={{color:'#1c4a35'}}>Clientes</em></div>
                    </div>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                      {/* View toggle */}
                      <div style={{display:'flex',border:'1px solid rgba(14,14,13,.12)',overflow:'hidden'}}>
                        {(['list','kanban'] as const).map(v=>(
                          <button key={v} onClick={()=>setCrmView(v)}
                            style={{padding:'7px 14px',background:crmView===v?'#1c4a35':'transparent',color:crmView===v?'#f4f0e6':'rgba(14,14,13,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',border:'none',cursor:'pointer',textTransform:'uppercase'}}>
                            {v==='list'?'≡ Lista':'⬛ Kanban'}
                          </button>
                        ))}
                      </div>
                      <button onClick={()=>setCrmShowFilters(f=>!f)}
                        style={{padding:'7px 14px',background:crmShowFilters?'rgba(28,74,53,.1)':'transparent',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer'}}>
                        ⚙ Filtros {(crmNatFilter||crmZonaFilter||crmStatusFilter)?'●':''}
                      </button>
                      <button onClick={exportCrmCSV}
                        style={{padding:'7px 14px',background:'transparent',color:'rgba(14,14,13,.5)',border:'1px solid rgba(14,14,13,.12)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer'}}>
                        ↓ CSV
                      </button>
                      <button className="p-btn p-btn-gold" style={{padding:'8px 16px',fontSize:'.52rem'}} onClick={()=>setShowNewContact(true)}>+ Novo</button>
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  {crmShowFilters && (
                    <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',padding:'14px 16px',marginBottom:'16px',display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'flex-end'}}>
                      <div style={{flex:1,minWidth:'140px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'5px'}}>Nacionalidade</div>
                        <input className="p-inp" style={{fontSize:'.75rem',padding:'6px 8px'}} placeholder="ex: Francesa, Britânico..." value={crmNatFilter} onChange={e=>setCrmNatFilter(e.target.value)}/>
                      </div>
                      <div style={{flex:1,minWidth:'140px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'5px'}}>Zona</div>
                        <input className="p-inp" style={{fontSize:'.75rem',padding:'6px 8px'}} placeholder="ex: Cascais, Lisboa..." value={crmZonaFilter} onChange={e=>setCrmZonaFilter(e.target.value)}/>
                      </div>
                      <div style={{flex:1,minWidth:'120px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'5px'}}>Status</div>
                        <select className="p-sel" style={{fontSize:'.75rem',padding:'6px 8px'}} value={crmStatusFilter} onChange={e=>setCrmStatusFilter(e.target.value)}>
                          <option value=''>Todos</option>
                          {['lead','prospect','cliente','vip'].map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <button onClick={()=>{setCrmNatFilter('');setCrmZonaFilter('');setCrmStatusFilter('')}}
                        style={{padding:'6px 12px',background:'rgba(14,14,13,.06)',border:'1px solid rgba(14,14,13,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)',cursor:'pointer'}}>
                        Limpar
                      </button>
                    </div>
                  )}

                  {/* KPI bar */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
                    {[
                      {label:'Total Contactos',val:String(crmContacts.length),color:'#1c4a35'},
                      {label:'VIP / Clientes',val:`${vipCount+clienteCount}`,color:'#c9a96e'},
                      {label:'Follow-up Urgente',val:String(followUps),color:followUps>0?'#e05454':'#1c4a35'},
                      {label:'Budget Total',val:`€${(totalBudget/1e6).toFixed(0)}M`,color:'#1c4a35'},
                    ].map(k=>(
                      <div key={k.label} className="crm-stat-card">
                        <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:k.color,lineHeight:1}}>{k.val}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginTop:'4px'}}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* New Contact Modal */}
                  {showNewContact && (
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
                      <div style={{background:'#f4f0e6',padding:'32px',maxWidth:'520px',width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'8px'}}>
                          <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.5rem',color:'#0e0e0d'}}>Novo <em style={{color:'#1c4a35'}}>Contacto</em></div>
                          <button style={{padding:'6px 14px',background:showSmartImport?'rgba(28,74,53,.12)':'rgba(28,74,53,.06)',border:`1px solid rgba(28,74,53,.2)`,color:'#1c4a35',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',cursor:'pointer'}}
                            onClick={()=>setShowSmartImport(s=>!s)}>
                            {showSmartImport ? '× Fechar' : '✦ Import Inteligente IA'}
                          </button>
                        </div>
                        {/* Smart Import */}
                        {showSmartImport && (
                          <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.15)',padding:'14px',marginBottom:'14px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(28,74,53,.6)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>✦ Colar email, WA, LinkedIn ou texto livre — Claude extrai automaticamente</div>
                            <textarea style={{width:'100%',minHeight:'80px',border:'1px solid rgba(28,74,53,.15)',background:'#fff',color:'#0e0e0d',fontFamily:"'Jost',sans-serif",fontSize:'.8rem',padding:'8px',resize:'vertical',outline:'none',boxSizing:'border-box'}}
                              value={smartImportText}
                              onChange={e=>setSmartImportText(e.target.value)}
                              placeholder="Cole aqui o email, mensagem WhatsApp, perfil LinkedIn ou qualquer texto com informação do cliente..."/>
                            <button style={{marginTop:'8px',padding:'8px 18px',background:'#1c4a35',color:'#c9a96e',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',cursor:'pointer',transition:'all .15s'}}
                              disabled={smartImportLoading || !smartImportText.trim()}
                              onClick={async()=>{
                                setSmartImportLoading(true)
                                try {
                                  const res = await fetch('/api/crm/extract-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:smartImportText})})
                                  const d = await res.json()
                                  if (d.contact) {
                                    const c = d.contact
                                    setNewContact(p=>({
                                      ...p,
                                      name: c.name || p.name,
                                      email: c.email || p.email,
                                      phone: c.phone || p.phone,
                                      nationality: c.nationality || p.nationality,
                                      budgetMin: c.budgetMin ? String(c.budgetMin) : p.budgetMin,
                                      budgetMax: c.budgetMax ? String(c.budgetMax) : p.budgetMax,
                                      tipos: c.tipos?.join(', ') || p.tipos,
                                      zonas: c.zonas?.join(', ') || p.zonas,
                                      origin: c.origin || p.origin,
                                      notes: c.notes || p.notes,
                                      ...(c.status && {status: c.status}),
                                    }))
                                    setShowSmartImport(false)
                                    setSmartImportText('')
                                  }
                                } catch{} finally{setSmartImportLoading(false)}
                              }}>
                              {smartImportLoading ? '✦ A extrair...' : '✦ Extrair Dados'}
                            </button>
                          </div>
                        )}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                          <div><label className="p-label">Nome *</label><input className="p-inp" value={newContact.name} onChange={e=>setNewContact(p=>({...p,name:e.target.value}))} placeholder="Nome completo"/></div>
                          <div><label className="p-label">Email</label><input className="p-inp" value={newContact.email} onChange={e=>setNewContact(p=>({...p,email:e.target.value}))} placeholder="email@exemplo.com"/></div>
                          <div><label className="p-label">Telefone</label><input className="p-inp" value={newContact.phone} onChange={e=>setNewContact(p=>({...p,phone:e.target.value}))} placeholder="+351 9xx xxx xxx"/></div>
                          <div><label className="p-label">Nacionalidade</label><input className="p-inp" value={newContact.nationality} onChange={e=>setNewContact(p=>({...p,nationality:e.target.value}))} placeholder="🇬🇧 Britânico"/></div>
                          <div><label className="p-label">Budget Mín (€)</label><input type="number" className="p-inp" value={newContact.budgetMin} onChange={e=>setNewContact(p=>({...p,budgetMin:e.target.value}))} placeholder="500000"/></div>
                          <div><label className="p-label">Budget Máx (€)</label><input type="number" className="p-inp" value={newContact.budgetMax} onChange={e=>setNewContact(p=>({...p,budgetMax:e.target.value}))} placeholder="1500000"/></div>
                          <div><label className="p-label">Tipologias</label><input className="p-inp" value={newContact.tipos} onChange={e=>setNewContact(p=>({...p,tipos:e.target.value}))} placeholder="Villa, T4, Penthouse"/></div>
                          <div><label className="p-label">Zonas</label><input className="p-inp" value={newContact.zonas} onChange={e=>setNewContact(p=>({...p,zonas:e.target.value}))} placeholder="Cascais, Lisboa"/></div>
                          <div><label className="p-label">Origem</label>
                            <select className="p-sel" value={newContact.origin} onChange={e=>setNewContact(p=>({...p,origin:e.target.value}))}>
                              {['Website','WhatsApp','Email','Referência','Redes Sociais','Evento','Portal'].map(o=><option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div><label className="p-label">Status</label>
                            <select className="p-sel" value={(newContact as Record<string,string>).status||'lead'} onChange={e=>setNewContact(p=>({...p,status:e.target.value}))}>
                              {['lead','prospect','cliente','vip'].map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>
                          </div>
                        </div>
                        <div><label className="p-label">Notas</label><textarea className="p-inp" style={{minHeight:'60px',resize:'vertical'}} value={newContact.notes} onChange={e=>setNewContact(p=>({...p,notes:e.target.value}))} placeholder="Preferências, observações..."/></div>
                        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
                          <button className="p-btn p-btn-gold" style={{flex:1}}
                            onClick={()=>{
                              if (!newContact.name) return
                              const c: CRMContact = {
                                id: Date.now(),
                                name: newContact.name,
                                email: newContact.email,
                                phone: newContact.phone,
                                nationality: newContact.nationality,
                                budgetMin: parseInt(newContact.budgetMin)||0,
                                budgetMax: parseInt(newContact.budgetMax)||0,
                                tipos: newContact.tipos.split(',').map(s=>s.trim()).filter(Boolean),
                                zonas: newContact.zonas.split(',').map(s=>s.trim()).filter(Boolean),
                                status: ((newContact as Record<string,string>).status||'lead') as CRMContact['status'],
                                notes: newContact.notes,
                                lastContact: new Date().toISOString().split('T')[0],
                                nextFollowUp: '',
                                dealRef: '',
                                origin: newContact.origin,
                                createdAt: new Date().toISOString().split('T')[0],
                              }
                              saveCrmContacts([...crmContacts, c])
                              setNewContact({ name:'', email:'', phone:'', nationality:'', budgetMin:'', budgetMax:'', tipos:'', zonas:'', origin:'Website', notes:'' })
                              setShowNewContact(false)
                              setActiveCrmId(c.id)
                            }}>Guardar Contacto</button>
                          <button className="p-btn" style={{background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.6)'}} onClick={()=>setShowNewContact(false)}>Cancelar</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Templates Modal */}
                  {showWaModal && (() => {
                    const wc = waModalContact ? crmContacts.find(c=>c.id===waModalContact) : null
                    const templates = WA_TEMPLATES[waLang] || WA_TEMPLATES['PT']
                    return (
                      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
                        <div style={{background:'#f4f0e6',maxWidth:'540px',width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
                          <div style={{padding:'20px 24px',borderBottom:'1px solid rgba(14,14,13,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.3rem',color:'#0e0e0d'}}>📱 Templates <em style={{color:'#1c4a35'}}>WhatsApp</em>{wc?` — ${wc.name}`:''}</div>
                            <button onClick={()=>setShowWaModal(false)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'rgba(14,14,13,.4)'}}>×</button>
                          </div>
                          <div style={{padding:'16px 24px'}}>
                            {/* Language selector */}
                            <div style={{display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap'}}>
                              {(['PT','EN','FR','DE','AR'] as const).map(l=>(
                                <button key={l} onClick={()=>setWaLang(l)}
                                  style={{padding:'5px 12px',background:waLang===l?'#1c4a35':'transparent',color:waLang===l?'#f4f0e6':'rgba(14,14,13,.5)',border:'1px solid rgba(14,14,13,.15)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer'}}>
                                  {l}
                                </button>
                              ))}
                            </div>
                            {/* Templates */}
                            {Object.entries(templates).map(([key, tmpl])=>{
                              const msg = wc ? tmpl.msg.replace('{name}',wc.name.split(' ')[0]).replace('{agent}',agentName).replace('{property}',wc.dealRef||'[imóvel]').replace('{date}','[data]') : tmpl.msg
                              return (
                                <div key={key} style={{marginBottom:'12px',background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'14px'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#c9a96e',marginBottom:'6px'}}>{tmpl.label}</div>
                                  <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.83rem',color:'rgba(14,14,13,.7)',lineHeight:1.6,marginBottom:'10px'}}>{msg}</div>
                                  <div style={{display:'flex',gap:'8px'}}>
                                    <button onClick={()=>navigator.clipboard.writeText(msg)}
                                      style={{padding:'5px 12px',background:'rgba(14,14,13,.06)',border:'1px solid rgba(14,14,13,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer'}}>
                                      Copiar
                                    </button>
                                    {wc && <button onClick={()=>window.open(`https://wa.me/${wc.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`,'_blank')}
                                      style={{padding:'5px 12px',background:'#25D366',color:'#fff',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer'}}>
                                      Abrir WhatsApp ↗
                                    </button>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Kanban View */}
                  {crmView === 'kanban' && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
                      {(['lead','prospect','cliente','vip'] as const).map(status=>{
                        const sc = STATUS_CONFIG[status]
                        const statusContacts = filtered.filter(c=>c.status===status)
                        return (
                          <div key={status} style={{background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)',minHeight:'400px'}}>
                            <div style={{padding:'10px 14px',borderBottom:'2px solid '+sc.color,display:'flex',alignItems:'center',justifyContent:'space-between',background:sc.bg}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:sc.color,fontWeight:600}}>{sc.label}</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:sc.color,background:sc.avatar,padding:'2px 7px',borderRadius:'10px'}}>{statusContacts.length}</span>
                            </div>
                            <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:'6px'}}>
                              {statusContacts.map(c=>{
                                const ls = computeLeadScore(c)
                                const nextAct = getAINextAction(c)
                                const initials3 = c.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()
                                return (
                                  <div key={c.id} onClick={()=>{setActiveCrmId(c.id);setCrmProfileTab('overview');setCrmView('list')}}
                                    style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'10px',cursor:'pointer',transition:'box-shadow .2s',borderLeft:`3px solid ${ls.color}`}}
                                    onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow='0 2px 8px rgba(0,0,0,.08)'}}
                                    onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow='none'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'5px'}}>
                                      <div style={{width:'28px',height:'28px',borderRadius:'50%',background:sc.avatar,color:sc.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.42rem',fontWeight:600,flexShrink:0}}>{initials3}</div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:'.8rem',fontWeight:500,color:'#0e0e0d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nationality}</div>
                                      </div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:ls.color,fontWeight:600,flexShrink:0}}>{ls.score}</div>
                                    </div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#1c4a35',marginBottom:'4px'}}>{(Number(c.budgetMin)||0)>0?`€${((Number(c.budgetMin)||0)/1e6).toFixed(1)}M–€${((Number(c.budgetMax)||0)/1e6).toFixed(1)}M`:'Budget n/d'}</div>
                                    {nextAct.urgency !== 'low' && (
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:nextAct.urgency==='high'?'#e05454':'#c9a96e',background:nextAct.urgency==='high'?'rgba(224,84,84,.06)':'rgba(201,169,110,.06)',padding:'3px 6px',borderRadius:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                        {nextAct.urgency==='high'?'🔴':'🟡'} {nextAct.text}
                                      </div>
                                    )}
                                    <button onClick={e=>{e.stopPropagation();setWaModalContact(c.id);setWaLang((c.language as typeof waLang)||'PT');setShowWaModal(true)}}
                                      style={{marginTop:'6px',width:'100%',padding:'4px',background:'#25D366',color:'#fff',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.06em',cursor:'pointer',borderRadius:'2px'}}>
                                      📱 WhatsApp
                                    </button>
                                  </div>
                                )
                              })}
                              {statusContacts.length === 0 && (
                                <div style={{padding:'24px 12px',textAlign:'center',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.25)',letterSpacing:'.08em'}}>Sem contactos</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Main CRM layout */}
                  {crmView === 'list' && <div className="crm-layout" style={{display:'flex',gap:'0',background:'#fff',border:'1px solid rgba(14,14,13,.08)',minHeight:'500px'}}>

                    {/* Contact list */}
                    <div className="crm-list" style={{width:'320px',minWidth:'280px',borderRight:'1px solid rgba(14,14,13,.08)',display:'flex',flexDirection:'column'}}>
                      {/* Search */}
                      <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(14,14,13,.06)'}}>
                        <input
                          className="p-inp"
                          placeholder="Pesquisar contacto..."
                          value={crmSearch}
                          onChange={e=>setCrmSearch(e.target.value)}
                          style={{fontSize:'.78rem',padding:'8px 12px'}}
                        />
                      </div>
                      {/* Status filters */}
                      <div style={{display:'flex',gap:'4px',padding:'8px 12px',borderBottom:'1px solid rgba(14,14,13,.06)',flexWrap:'wrap',alignItems:'center'}}>
                        {Object.entries(STATUS_CONFIG).map(([k,v])=>(
                          <div key={k} style={{padding:'3px 8px',background:v.bg,fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:v.color,cursor:'pointer'}}
                            onClick={()=>setCrmSearch(k)}>
                            {v.label} {crmContacts.filter(c=>c.status===k).length}
                          </div>
                        ))}
                        {crmSearch && <div style={{padding:'3px 8px',background:'rgba(14,14,13,.06)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.4)',cursor:'pointer'}} onClick={()=>setCrmSearch('')}>× limpar</div>}
                        <div style={{marginLeft:'auto'}}>
                          <button onClick={()=>{setCrmBulkMode(b=>!b);setCrmSelectedIds(new Set())}} style={{padding:'3px 8px',background:crmBulkMode?'rgba(28,74,53,.12)':'rgba(14,14,13,.04)',border:`1px solid ${crmBulkMode?'rgba(28,74,53,.3)':'rgba(14,14,13,.1)'}`,color:crmBulkMode?'#1c4a35':'rgba(14,14,13,.4)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.06em'}}>
                            {crmBulkMode ? '✓ Bulk' : '☐ Bulk'}
                          </button>
                        </div>
                      </div>
                      {/* Bulk action bar */}
                      {crmBulkMode && crmSelectedIds.size > 0 && (
                        <div style={{padding:'8px 12px',background:'rgba(28,74,53,.06)',borderBottom:'1px solid rgba(28,74,53,.12)',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#1c4a35',fontWeight:700}}>{crmSelectedIds.size} selec.</div>
                          <button style={{padding:'4px 10px',background:'#25d366',color:'#fff',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.06em'}}
                            onClick={()=>{
                              const selected = crmContacts.filter(c => crmSelectedIds.has(c.id))
                              const phones = selected.map(c=>c.phone?.replace(/\D/g,'')).filter(Boolean)
                              if (phones.length === 1) window.open(`https://wa.me/${phones[0]}`)
                              else if (phones.length > 1) {
                                const names = selected.map(c=>c.name).join(', ')
                                alert(`Campanha WA para ${phones.length} contactos:\n${names}\n\nNota: O WhatsApp Web apenas suporta 1 contacto de cada vez. Abre cada contacto individualmente.`)
                                phones.forEach((p,i) => setTimeout(() => window.open(`https://wa.me/${p}`), i * 500))
                              }
                            }}>
                            💬 WA Campaign
                          </button>
                          <button style={{padding:'4px 10px',background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.5)',border:'1px solid rgba(14,14,13,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}}
                            onClick={()=>{
                              const today = new Date(); today.setDate(today.getDate()+3)
                              const dateStr = today.toISOString().split('T')[0]
                              const updated = crmContacts.map(c => crmSelectedIds.has(c.id) ? {...c, nextFollowUp: dateStr} : c)
                              saveCrmContacts(updated)
                              setCrmSelectedIds(new Set())
                            }}>
                            📅 Follow-up +3d
                          </button>
                          <button style={{padding:'4px 10px',background:'rgba(14,14,13,.04)',color:'rgba(14,14,13,.35)',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer'}} onClick={()=>setCrmSelectedIds(new Set())}>× Limpar</button>
                          <button style={{padding:'4px 10px',background:'rgba(14,14,13,.04)',color:'rgba(14,14,13,.35)',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',marginLeft:'auto'}}
                            onClick={()=>setCrmSelectedIds(new Set(filtered.map(c=>c.id)))}>
                            Todos ({filtered.length})
                          </button>
                        </div>
                      )}
                      {/* List */}
                      <div style={{flex:1,overflowY:'auto'}}>
                        {filtered.map(c=>{
                          const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['lead']
                          const initials2 = c.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()
                          const isOverdue = c.nextFollowUp && new Date(c.nextFollowUp) < new Date()
                          return (
                            <div
                              key={c.id}
                              className={`crm-contact-row${activeCrmId===c.id?' active':''}`}
                              style={{background: crmBulkMode && crmSelectedIds.has(c.id) ? 'rgba(28,74,53,.08)' : undefined}}
                              onClick={()=>{
                                if (crmBulkMode) {
                                  setCrmSelectedIds(prev => { const next = new Set(prev); next.has(c.id) ? next.delete(c.id) : next.add(c.id); return next })
                                } else {
                                  setActiveCrmId(c.id); setCrmProfileTab('overview')
                                }
                              }}
                            >
                              {crmBulkMode && (
                                <div style={{flexShrink:0,width:'18px',height:'18px',border:`2px solid ${crmSelectedIds.has(c.id)?'#1c4a35':'rgba(14,14,13,.2)'}`,background:crmSelectedIds.has(c.id)?'#1c4a35':'transparent',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'3px',transition:'all .15s'}}>
                                  {crmSelectedIds.has(c.id) && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                                </div>
                              )}
                              <div className="crm-avatar" style={{background:sc.avatar,color:sc.color}}>{initials2}</div>
                              <div style={{flex:1,minWidth:0}}>
                                {/* Lead Score Bar */}
                                {(() => {
                                  const ls2 = calcLeadScore({ budgetMax: c.budgetMax, budgetMin: c.budgetMin, phone: c.phone, email: c.email, source: c.origin, notes: c.notes })
                                  const barColor = ls2.color === 'emerald' ? '#10b981' : ls2.color === 'yellow' ? '#f59e0b' : ls2.color === 'orange' ? '#f97316' : '#9ca3af'
                                  return (
                                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                                      <div style={{flex:1,height:'3px',background:'rgba(14,14,13,.1)',borderRadius:'2px',overflow:'hidden'}}>
                                        <div style={{height:'100%',borderRadius:'2px',background:barColor,transition:'width .4s',width:`${ls2.score}%`}}/>
                                      </div>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',fontWeight:700,color:barColor,flexShrink:0,minWidth:'52px',textAlign:'right'}}>
                                        {ls2.score}/100 {ls2.label === 'Hot' ? '\uD83D\uDD25' : ls2.label === 'Warm' ? '\uD83C\uDF21\uFE0F' : ls2.label === 'Cool' ? '\u2744\uFE0F' : '\uD83D\uDCA4'}
                                      </span>
                                    </div>
                                  )
                                })()}
                                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                                  <span style={{fontWeight:500,fontSize:'.83rem',color:'#0e0e0d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                                  <span className="crm-status" style={{background:sc.bg,color:sc.color}}>{sc.label}</span>
                                </div>
                                {(() => {
                                  const ls = computeLeadScore(c)
                                  return (
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:ls.color,marginTop:'2px',display:'flex',alignItems:'center',gap:'4px'}}>
                                      <span>{ls.label}</span>
                                      <span style={{background:ls.score>=80?'rgba(224,84,84,.1)':ls.score>=60?'rgba(201,169,110,.12)':ls.score>=40?'rgba(74,156,122,.1)':'rgba(14,14,13,.06)',padding:'1px 6px',borderRadius:'2px',fontWeight:400}}>{ls.score}</span>
                                    </div>
                                  )
                                })()}
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nationality}</div>
                                <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'3px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#1c4a35'}}>{(Number(c.budgetMin)||0)>0?`€${((Number(c.budgetMin)||0)/1e6).toFixed(1)}M–€${((Number(c.budgetMax)||0)/1e6).toFixed(1)}M`:'Budget n/d'}</span>
                                  {isOverdue && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#e05454',background:'rgba(224,84,84,.08)',padding:'1px 5px'}}>Follow-up!</span>}
                                </div>
                              </div>
                              {(() => {
                                const dSince = c.lastContact ? Math.floor((Date.now() - new Date(c.lastContact).getTime()) / 86400000) : null
                                const dColor = dSince === null ? '#9ca3af' : dSince > 14 ? '#e05454' : dSince > 7 ? '#f97316' : dSince > 3 ? '#f59e0b' : '#10b981'
                                const dLabel = dSince === null ? '—' : dSince === 0 ? 'hoje' : `${dSince}d`
                                const dBar = dSince === null ? 0 : Math.min(100, (dSince / 21) * 100)
                                return (
                                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px',flexShrink:0,minWidth:'36px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',fontWeight:700,color:dColor}}>{dLabel}</div>
                                    <div style={{width:'32px',height:'3px',background:'rgba(14,14,13,.08)',borderRadius:'2px',overflow:'hidden'}}>
                                      <div style={{height:'100%',borderRadius:'2px',background:dColor,width:`${dBar}%`,transition:'width .4s'}}/>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })}
                        {filtered.length === 0 && (
                          <div style={{padding:'32px',textAlign:'center',fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(14,14,13,.3)',letterSpacing:'.1em',textTransform:'uppercase'}}>
                            Sem contactos
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact profile */}
                    {activeContact ? (
                      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
                        {/* Profile header */}
                        <div style={{padding:'20px 24px',borderBottom:'1px solid rgba(14,14,13,.08)',background:'#fff'}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:'16px',flexWrap:'wrap'}}>
                            <div className="crm-avatar" style={{width:'48px',height:'48px',background:(STATUS_CONFIG[activeContact.status]??STATUS_CONFIG['lead']).avatar,color:(STATUS_CONFIG[activeContact.status]??STATUS_CONFIG['lead']).color,fontSize:'.7rem',flexShrink:0}}>
                              {activeContact.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
                                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.4rem',color:'#0e0e0d'}}>{activeContact.name}</div>
                                <span className="crm-status" style={{background:(STATUS_CONFIG[activeContact.status]??STATUS_CONFIG['lead']).bg,color:(STATUS_CONFIG[activeContact.status]??STATUS_CONFIG['lead']).color,fontSize:'.46rem',padding:'3px 10px'}}>
                                  {(STATUS_CONFIG[activeContact.status]??STATUS_CONFIG['lead']).label}
                                </span>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.4)',marginTop:'3px',letterSpacing:'.06em'}}>{activeContact.nationality} · {activeContact.origin}</div>
                              <div style={{display:'flex',gap:'12px',marginTop:'8px',flexWrap:'wrap'}}>
                                {activeContact.email && <a href={`mailto:${activeContact.email}`} style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'#1c4a35',textDecoration:'none'}}>✉ {activeContact.email}</a>}
                                {activeContact.phone && <a href={`https://wa.me/${activeContact.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'#1c4a35',textDecoration:'none'}}>📱 {activeContact.phone}</a>}
                              </div>
                            </div>
                            <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                              {(['lead','prospect','cliente','vip'] as const).map(s=>(
                                <button key={s}
                                  style={{padding:'5px 10px',background:activeContact.status===s?STATUS_CONFIG[s].bg:'transparent',border:`1px solid ${activeContact.status===s?STATUS_CONFIG[s].color:'rgba(14,14,13,.12)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:activeContact.status===s?STATUS_CONFIG[s].color:'rgba(14,14,13,.4)',cursor:'pointer'}}
                                  onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,status:s}:c))}
                                >{s}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Profile tabs */}
                        <div style={{display:'flex',borderBottom:'1px solid rgba(14,14,13,.08)',padding:'0 24px',background:'#fff',overflowX:'auto'}}>
                          {[['overview','Perfil'],['timeline','Timeline'],['tasks','Tarefas'],['notes','Notas'],['matching','Matching']].map(([t,l])=>(
                            <button key={t} className={`crm-profile-tab${crmProfileTab===t?' active':''}`} onClick={()=>setCrmProfileTab(t as typeof crmProfileTab)}>{l}</button>
                          ))}
                          {activeContact && activeContact.status==='cliente'&&<button className={`crm-profile-tab${crmProfileTab==='postclosing'?' active':''}`} onClick={()=>setCrmProfileTab('postclosing' as typeof crmProfileTab)}>Post-Sale</button>}
                        </div>
                        {/* Tab content */}
                        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
                          {crmProfileTab === 'overview' && (
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                              {/* Budget */}
                              <div className="p-card">
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Budget</div>
                                <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.6rem',color:'#1c4a35',lineHeight:1}}>{(Number(activeContact.budgetMin)||0)>0?`€${((Number(activeContact.budgetMin)||0)/1e6).toFixed(1)}M`:'—'}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>{(Number(activeContact.budgetMax)||0)>0?`até €${((Number(activeContact.budgetMax)||0)/1e6).toFixed(1)}M`:'Budget não definido'}</div>
                                <div style={{marginTop:'10px',height:'4px',background:'rgba(14,14,13,.08)',borderRadius:'2px',overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(100,((Number(activeContact.budgetMax)||0)/10000000)*100)}%`,height:'100%',background:'#c9a96e',borderRadius:'2px'}}/>
                                </div>
                              </div>
                              {/* Preferências */}
                              <div className="p-card">
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Preferências</div>
                                <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
                                  {(activeContact.tipos||[]).map(t=><span key={t} style={{background:'rgba(28,74,53,.08)',color:'#1c4a35',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.06em'}}>{t}</span>)}
                                  {!(activeContact.tipos||[]).length && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.3)'}}>—</span>}
                                </div>
                                <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                                  {(activeContact.zonas||[]).map(z=><span key={z} style={{background:'rgba(201,169,110,.1)',color:'#c9a96e',padding:'3px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.06em'}}>{z}</span>)}
                                  {!(activeContact.zonas||[]).length && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.3)'}}>—</span>}
                                </div>
                              </div>
                              {/* Follow-up */}
                              <div className="p-card">
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Timeline</div>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.5)'}}>Último contacto</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'#1c4a35'}}>{activeContact.lastContact||'—'}</span>
                                </div>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.5)'}}>Próximo follow-up</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color: activeContact.nextFollowUp && new Date(activeContact.nextFollowUp)<new Date()?'#e05454':'#c9a96e'}}>{activeContact.nextFollowUp||'—'}</span>
                                </div>
                                <div style={{display:'flex',gap:'6px'}}>
                                  <input type="date" className="p-inp" style={{flex:1,fontSize:'.75rem',padding:'6px 8px'}} value={activeContact.nextFollowUp||''} onChange={e=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,nextFollowUp:e.target.value}:c))}/>
                                  <button className="p-btn" style={{padding:'6px 12px',fontSize:'.44rem'}}
                                    onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,lastContact:new Date().toISOString().split('T')[0]}:c))}>
                                    Contactado Hoje
                                  </button>
                                </div>
                              </div>
                              {/* Deal */}
                              <div className="p-card">
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Deal Associado</div>
                                {activeContact.dealRef ? (
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.65rem',color:'#c9a96e',marginBottom:'4px'}}>{activeContact.dealRef}</div>
                                    <button className="p-btn" style={{padding:'6px 14px',fontSize:'.44rem',width:'100%'}} onClick={()=>setSection('pipeline')}>Ver no Pipeline →</button>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(14,14,13,.3)',marginBottom:'8px'}}>Sem deal activo</div>
                                    <button className="p-btn" style={{padding:'6px 14px',fontSize:'.44rem',width:'100%',background:'rgba(28,74,53,.08)',color:'#1c4a35'}} onClick={()=>setSection('pipeline')}>Criar Deal →</button>
                                  </div>
                                )}
                              </div>
                              {/* AI Next Action */}
                              {(() => {
                                const na = getAINextAction(activeContact)
                                return (
                                  <div style={{gridColumn:'1/-1',padding:'12px 14px',background:na.urgency==='high'?'rgba(224,84,84,.05)':na.urgency==='medium'?'rgba(201,169,110,.05)':'rgba(28,74,53,.04)',border:`1px solid ${na.urgency==='high'?'rgba(224,84,84,.2)':na.urgency==='medium'?'rgba(201,169,110,.2)':'rgba(28,74,53,.12)'}`,display:'flex',alignItems:'center',gap:'10px'}}>
                                    <span style={{fontSize:'1rem',flexShrink:0}}>{na.urgency==='high'?'🔴':na.urgency==='medium'?'🟡':'🟢'}</span>
                                    <div style={{flex:1}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'2px'}}>IA · Próxima Acção</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:na.urgency==='high'?'#e05454':na.urgency==='medium'?'#c9a96e':'#1c4a35',fontWeight:600}}>{na.text}</div>
                                    </div>
                                    <button className="p-btn" style={{padding:'5px 12px',fontSize:'.42rem',flexShrink:0,background:'rgba(14,14,13,.06)'}}
                                      onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,lastContact:new Date().toISOString().split('T')[0]}:c))}>
                                      ✓ Feito
                                    </button>
                                  </div>
                                )
                              })()}
                              {/* Actions */}
                              <div className="p-card" style={{gridColumn:'1/-1'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'10px'}}>Acções Rápidas</div>
                                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                                  <button className="p-btn p-btn-gold" style={{padding:'8px 16px',fontSize:'.46rem'}}
                                    onClick={()=>{setWaModalContact(activeContact.id);setWaLang((activeContact.language as typeof waLang)||'PT');setShowWaModal(true)}}>
                                    📱 Templates WA
                                  </button>
                                  {activeContact.phone && <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem'}} onClick={()=>window.open(`https://wa.me/${activeContact.phone.replace(/\D/g,'')}`)}>📱 WhatsApp</button>}
                                  {activeContact.email && <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem'}} onClick={()=>window.open(`mailto:${activeContact.email}`)}>✉ Email</button>}
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}} onClick={()=>{setSection('avm')}}>📊 AVM</button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}} onClick={()=>setSection('nhr')}>🌍 NHR</button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'linear-gradient(135deg,#0c1f15,#1c4a35)',color:'#c9a96e',border:'1px solid rgba(201,169,110,.3)'}}
                                    disabled={crmNextStepLoading}
                                    onClick={async()=>{
                                      setCrmNextStepLoading(true); setCrmNextStep(null)
                                      try {
                                        const res = await fetch('/api/crm/next-step',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact:activeContact,deals,recentActivity:activeContact.notes})})
                                        const d = await res.json()
                                        setCrmNextStep(d)
                                      } catch{} finally{setCrmNextStepLoading(false)}
                                    }}>
                                    {crmNextStepLoading?'✦ A analisar...':'✦ IA Próxima Acção'}
                                  </button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(201,169,110,.1)',color:'#c9a96e',border:'1px solid rgba(201,169,110,.25)'}}
                                    onClick={()=>{setIpProperty(activeContact.id?String(activeContact.id):'');setSection('investorpitch')}}>
                                    📑 Investor Pitch
                                  </button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(28,74,53,.06)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)'}}
                                    disabled={emailDraftLoading}
                                    onClick={async()=>{
                                      setEmailDraftLoading(true); setEmailDraft(null)
                                      try {
                                        const res = await fetch('/api/crm/email-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact:activeContact,purpose:emailDraftPurpose,agentName:agentName})})
                                        const d = await res.json()
                                        if (d.draft) setEmailDraft(d.draft)
                                      } catch{} finally{setEmailDraftLoading(false)}
                                    }}>
                                    {emailDraftLoading?'✦ A gerar...':'✉ Draft Email IA'}
                                  </button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.55)',border:'1px solid rgba(14,14,13,.15)'}}
                                    disabled={meetingPrepLoading}
                                    onClick={async()=>{
                                      if (meetingPrep) { setMeetingPrep(null); return }
                                      setMeetingPrepLoading(true)
                                      try {
                                        const res = await fetch('/api/crm/meeting-prep',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact:activeContact,properties:imoveisList,deals,agentName})})
                                        const d = await res.json()
                                        if (d.briefing) setMeetingPrep(d.briefing)
                                      } catch{} finally{setMeetingPrepLoading(false)}
                                    }}>
                                    {meetingPrepLoading?'✦ A preparar...':meetingPrep?'× Fechar Briefing':'📋 Meeting Prep IA'}
                                  </button>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(224,84,84,.08)',color:'#e05454',border:'1px solid rgba(224,84,84,.2)'}}
                                    onClick={()=>{if(confirm(`Eliminar ${activeContact.name}?`)){saveCrmContacts(crmContacts.filter(c=>c.id!==activeContact.id));setActiveCrmId(null)}}}>
                                    🗑 Eliminar
                                  </button>
                                </div>
                              </div>
                              {/* AI Lead Score */}
                              {(() => {
                                const ls = computeLeadScore(activeContact)
                                return (
                                  <div style={{gridColumn:'1/-1',background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.08)',padding:'14px',marginTop:'12px'}}>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>AI Lead Score</div>
                                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                        <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',color:ls.color,lineHeight:1}}>{ls.score}</div>
                                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:ls.color}}>{ls.label}</div>
                                      </div>
                                    </div>
                                    {/* Score bar */}
                                    <div style={{height:'4px',background:'rgba(14,14,13,.08)',borderRadius:'2px',overflow:'hidden',marginBottom:'10px'}}>
                                      <div style={{height:'100%',width:`${ls.score}%`,background:ls.score>=80?'#e05454':ls.score>=60?'#c9a96e':'#4a9c7a',borderRadius:'2px',transition:'width .5s'}}/>
                                    </div>
                                    {/* Breakdown */}
                                    {ls.breakdown.map((b,i)=>(
                                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)'}}>{b.factor}</span>
                                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:b.pts>=15?'#4a9c7a':b.pts>=8?'#c9a96e':'rgba(14,14,13,.4)'}}>+{b.pts}pts</span>
                                      </div>
                                    ))}
                                    {ls.score >= 70 && (
                                      <div style={{marginTop:'8px',background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.2)',padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'#c9a96e'}}>
                                        ⚡ Acção recomendada: Contactar hoje · Alta probabilidade de transacção
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                              {/* IA Próxima Acção Result */}
                              {crmNextStep && (
                                <div style={{gridColumn:'1/-1',background:'linear-gradient(135deg,#0c1f15,#1c4a35)',border:'1px solid rgba(201,169,110,.2)',padding:'16px',marginTop:'12px',animation:'fadeIn .3s ease'}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.6)'}}>✦ IA Próxima Acção — Claude Analysis</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:700,color:'#c9a96e',background:'rgba(201,169,110,.12)',padding:'2px 8px'}}>Score: {String(crmNextStep.leadScore||'—')}/100</div>
                                  </div>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'4px'}}>Acção Recomendada</div>
                                      <div style={{fontFamily:"'Cormorant',serif",fontSize:'.95rem',color:'#f4f0e6',lineHeight:1.4}}>{String(crmNextStep.nextAction||'—')}</div>
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'4px'}}>Canal · Timing</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'#c9a96e'}}>{String(crmNextStep.channel||'—').toUpperCase()} · {String(crmNextStep.timing||'—')}</div>
                                    </div>
                                  </div>
                                  {crmNextStep.nextActionDetail && <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(244,240,230,.6)',lineHeight:1.6,marginBottom:'12px'}}>{String(crmNextStep.nextActionDetail)}</div>}
                                  {crmNextStep.messageTemplate && (
                                    <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(244,240,230,.08)',padding:'10px 12px',marginBottom:'10px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(244,240,230,.3)',marginBottom:'4px',letterSpacing:'.08em',textTransform:'uppercase'}}>Template Pronto a Enviar</div>
                                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(244,240,230,.75)',lineHeight:1.6}}>{String(crmNextStep.messageTemplate)}</div>
                                    </div>
                                  )}
                                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                                    {crmNextStep.messageTemplate&&<button className="p-btn p-btn-gold" style={{padding:'6px 14px',fontSize:'.42rem'}} onClick={()=>window.open(`https://wa.me/${activeContact.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(String(crmNextStep.messageTemplate||''))}`)}>💬 Enviar WA</button>}
                                    <button style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(244,240,230,.12)',color:'rgba(244,240,230,.6)',padding:'6px 14px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',cursor:'pointer'}} onClick={()=>setCrmNextStep(null)}>✕ Fechar</button>
                                    {crmNextStep.riskFlag&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#e05454',background:'rgba(224,84,84,.08)',border:'1px solid rgba(224,84,84,.2)',padding:'4px 8px',display:'flex',alignItems:'center'}}>⚠ {String(crmNextStep.riskFlag)}</div>}
                                  </div>
                                </div>
                              )}
                              {/* Email Draft IA Result */}
                              {emailDraft && (
                                <div style={{gridColumn:'1/-1',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.18)',padding:'18px',marginTop:'14px',animation:'fadeIn .3s ease'}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(28,74,53,.5)'}}>✉ Draft Email IA</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.8)',background:'rgba(201,169,110,.1)',padding:'2px 7px',border:'1px solid rgba(201,169,110,.2)'}}>Claude Opus</div>
                                    </div>
                                    <button onClick={()=>setEmailDraft(null)} style={{background:'none',border:'none',color:'rgba(14,14,13,.3)',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:'2px 4px',fontFamily:"'DM Mono',monospace"}}>✕</button>
                                  </div>
                                  {/* Subject line */}
                                  <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.05rem',fontWeight:700,color:'#1c4a35',marginBottom:'14px',lineHeight:1.3}}>{emailDraft.subject}</div>
                                  {/* Email body */}
                                  <div style={{background:'#fff',border:'1px solid rgba(14,14,13,.08)',padding:'16px 18px',borderRadius:'1px',marginBottom:'12px'}}>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'rgba(14,14,13,.75)',lineHeight:1.75,whiteSpace:'pre-wrap'}}>
                                      {emailDraft.greeting}{'\n\n'}{emailDraft.body}{'\n\n'}{emailDraft.cta}{'\n\n'}{emailDraft.signature}
                                    </div>
                                  </div>
                                  {/* CTA highlight */}
                                  <div style={{background:'rgba(201,169,110,.06)',border:'1px solid rgba(201,169,110,.2)',padding:'8px 12px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',flexShrink:0}}>CTA</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'#1c4a35',fontWeight:500}}>{emailDraft.cta}</div>
                                  </div>
                                  {/* Actions */}
                                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                                    <button className="p-btn p-btn-gold" style={{padding:'7px 16px',fontSize:'.42rem'}}
                                      onClick={()=>navigator.clipboard.writeText(`${emailDraft.subject}\n\n${emailDraft.greeting}\n\n${emailDraft.body}\n\n${emailDraft.cta}\n\n${emailDraft.signature}`)}>
                                      📋 Copiar Email
                                    </button>
                                    {activeContact.email && (
                                      <button className="p-btn" style={{padding:'7px 16px',fontSize:'.42rem',background:'rgba(28,74,53,.08)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)'}}
                                        onClick={()=>window.open(`mailto:${activeContact.email}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.greeting+'\n\n'+emailDraft.body+'\n\n'+emailDraft.cta+'\n\n'+emailDraft.signature)}`)}>
                                        ✉ Abrir no Mail
                                      </button>
                                    )}
                                    <button className="p-btn" style={{padding:'7px 16px',fontSize:'.42rem',background:'rgba(28,74,53,.08)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)'}}
                                      onClick={()=>{setEmailDraft(null);setEmailDraftLoading(false)}}>
                                      ✕ Fechar
                                    </button>
                                  </div>
                                </div>
                              )}
                              {/* Meeting Prep IA Result */}
                              {meetingPrep && (
                                <div style={{gridColumn:'1/-1',background:'linear-gradient(135deg,#0c1f15,#1a3d2a)',padding:'18px',marginTop:'14px',border:'1px solid rgba(201,169,110,.12)'}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(201,169,110,.5)'}}>📋 Meeting Prep IA</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.7)',background:'rgba(201,169,110,.08)',padding:'2px 7px',border:'1px solid rgba(201,169,110,.15)'}}>Claude Opus</div>
                                    </div>
                                    <button style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(244,240,230,.12)',color:'rgba(244,240,230,.5)',padding:'4px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',cursor:'pointer'}} onClick={()=>setMeetingPrep(null)}>× Fechar</button>
                                  </div>
                                  {/* Opening line */}
                                  <div style={{background:'rgba(201,169,110,.08)',border:'1px solid rgba(201,169,110,.15)',padding:'10px 14px',marginBottom:'12px',fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'#f4f0e6',lineHeight:1.6,fontStyle:'italic'}}>
                                    "{String(meetingPrep.openingLine)}"
                                  </div>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(201,169,110,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Key Insights</div>
                                      {(meetingPrep.keyInsights as string[]).map((ins,i)=>(
                                        <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px'}}>
                                          <span style={{color:'#c9a96e',flexShrink:0}}>★</span>
                                          <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(244,240,230,.6)',lineHeight:1.4}}>{ins}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(201,169,110,.4)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'6px'}}>Perguntas a Fazer</div>
                                      {(meetingPrep.questionsToAsk as string[]).map((q,i)=>(
                                        <div key={i} style={{display:'flex',gap:'6px',marginBottom:'5px'}}>
                                          <span style={{color:'#4a9c7a',flexShrink:0,fontWeight:700}}>?</span>
                                          <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(244,240,230,.6)',lineHeight:1.4}}>{q}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {meetingPrep.closingStrategy && (
                                    <div style={{padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(244,240,230,.08)',marginBottom:'10px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'rgba(244,240,230,.3)',letterSpacing:'.08em',marginBottom:'3px'}}>ESTRATÉGIA DE FECHO DA REUNIÃO</div>
                                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(244,240,230,.65)',lineHeight:1.4}}>{String(meetingPrep.closingStrategy)}</div>
                                    </div>
                                  )}
                                  <div style={{display:'flex',gap:'8px'}}>
                                    <button style={{padding:'6px 14px',background:'rgba(201,169,110,.12)',border:'1px solid rgba(201,169,110,.2)',color:'#c9a96e',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.08em'}}
                                      onClick={()=>{
                                        const t = `BRIEFING: ${activeContact.name}\n\nAbertura: ${meetingPrep.openingLine}\n\nInsights:\n${(meetingPrep.keyInsights as string[]).map(i=>`• ${i}`).join('\n')}\n\nPerguntas:\n${(meetingPrep.questionsToAsk as string[]).map(q=>`• ${q}`).join('\n')}\n\nFecho: ${meetingPrep.closingStrategy}`
                                        navigator.clipboard.writeText(t)
                                      }}>
                                      📋 Copiar Briefing
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {crmProfileTab === 'timeline' && (
                            <div>
                              {/* Activity Heatmap — GitHub-style 12-week grid */}
                              {(() => {
                                const acts = activeContact.activities || []
                                const today2 = new Date()
                                // Build 12 weeks × 7 days grid
                                const weeks = 12
                                const totalDays = weeks * 7
                                // Map dates to activity counts
                                const countMap: Record<string,number> = {}
                                acts.forEach(a => { countMap[a.date] = (countMap[a.date]||0)+1 })
                                // Generate cells from 84 days ago to today
                                const cells: {date:string;count:number}[] = []
                                for (let i = totalDays-1; i >= 0; i--) {
                                  const d = new Date(today2); d.setDate(d.getDate()-i)
                                  const ds = d.toISOString().split('T')[0]
                                  cells.push({date:ds, count:countMap[ds]||0})
                                }
                                const maxActs = Math.max(1,...Object.values(countMap))
                                const getColor = (n:number) => {
                                  if (n===0) return 'rgba(14,14,13,.06)'
                                  const pct = n/maxActs
                                  if (pct>=.75) return '#1c4a35'
                                  if (pct>=.5) return '#2d7a56'
                                  if (pct>=.25) return '#4a9c7a'
                                  return '#7abfa3'
                                }
                                return (
                                  <div style={{background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.08)',padding:'14px',marginBottom:'16px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.35)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'10px'}}>Actividade — 12 semanas</div>
                                    <div style={{display:'grid',gridTemplateColumns:`repeat(${weeks},1fr)`,gap:'2px'}}>
                                      {Array.from({length:weeks},(_,wi)=>(
                                        <div key={wi} style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                                          {cells.slice(wi*7,wi*7+7).map(cell=>(
                                            <div key={cell.date} title={`${cell.date}: ${cell.count} actividade${cell.count!==1?'s':''}`} style={{width:'100%',aspectRatio:'1',background:getColor(cell.count),borderRadius:'2px',cursor:'default'}}/>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'8px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)'}}>Menos</div>
                                      {['rgba(14,14,13,.06)','#7abfa3','#4a9c7a','#2d7a56','#1c4a35'].map(c=><div key={c} style={{width:'10px',height:'10px',background:c,borderRadius:'1px'}}/>)}
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)'}}>Mais</div>
                                      <div style={{marginLeft:'auto',fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.45)'}}>{acts.length} total · {Object.keys(countMap).length} dias activos</div>
                                    </div>
                                  </div>
                                )
                              })()}
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)'}}>Timeline de Actividades</div>
                                <button onClick={()=>setShowAddActivity(a=>!a)}
                                  style={{padding:'6px 14px',background:'rgba(28,74,53,.08)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'pointer'}}>
                                  + Actividade
                                </button>
                              </div>
                              {/* Add activity form */}
                              {showAddActivity && (
                                <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',padding:'14px',marginBottom:'14px'}}>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Tipo</div>
                                      <select className="p-sel" style={{fontSize:'.75rem',padding:'6px 8px'}} value={newActivity.type} onChange={e=>setNewActivity(a=>({...a,type:e.target.value as Activity['type']}))}>
                                        {[['call','📞 Chamada'],['whatsapp','📱 WhatsApp'],['email','✉ Email'],['visit','🏡 Visita'],['note','📝 Nota'],['proposal','📋 Proposta'],['cpcv','✍ CPCV']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Data</div>
                                      <input type="date" className="p-inp" style={{fontSize:'.75rem',padding:'6px 8px'}} value={newActivity.date} onChange={e=>setNewActivity(a=>({...a,date:e.target.value}))}/>
                                    </div>
                                  </div>
                                  <div style={{marginBottom:'8px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Nota</div>
                                    <input className="p-inp" style={{fontSize:'.8rem',padding:'6px 8px'}} placeholder="Resumo da actividade..." value={newActivity.note} onChange={e=>setNewActivity(a=>({...a,note:e.target.value}))}/>
                                  </div>
                                  <div style={{display:'flex',gap:'8px'}}>
                                    <button className="p-btn p-btn-gold" style={{padding:'6px 14px',fontSize:'.44rem'}}
                                      onClick={()=>{
                                        if (!newActivity.note.trim()) return
                                        const act: Activity = { id: Date.now(), ...newActivity }
                                        saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,activities:[act,...(c.activities||[])],lastContact:newActivity.date}:c))
                                        setNewActivity({ type:'call', note:'', date: new Date().toISOString().split('T')[0] })
                                        setShowAddActivity(false)
                                      }}>Guardar</button>
                                    <button className="p-btn" style={{padding:'6px 12px',fontSize:'.44rem',background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.5)'}} onClick={()=>setShowAddActivity(false)}>Cancelar</button>
                                  </div>
                                </div>
                              )}
                              {/* Activities list */}
                              {(!activeContact.activities || activeContact.activities.length === 0) ? (
                                <div style={{padding:'32px',textAlign:'center',border:'1px dashed rgba(14,14,13,.1)'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(14,14,13,.3)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Sem actividades registadas</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.2)'}}>Regista chamadas, visitas, emails e propostas</div>
                                </div>
                              ) : (
                                <div style={{display:'flex',flexDirection:'column',gap:'0',position:'relative'}}>
                                  <div style={{position:'absolute',left:'16px',top:'0',bottom:'0',width:'1px',background:'rgba(14,14,13,.08)'}}/>
                                  {activeContact.activities.map((act,i)=>{
                                    const icons: Record<string,string> = { call:'📞', whatsapp:'📱', email:'✉️', visit:'🏡', note:'📝', proposal:'📋', cpcv:'✍️' }
                                    const colors: Record<string,string> = { call:'#1c4a35', whatsapp:'#25D366', email:'#3a7bd5', visit:'#c9a96e', note:'rgba(14,14,13,.4)', proposal:'#c9a96e', cpcv:'#e05454' }
                                    return (
                                      <div key={act.id} style={{display:'flex',gap:'16px',paddingBottom:'16px',position:'relative'}}>
                                        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#fff',border:`2px solid ${colors[act.type]||'rgba(14,14,13,.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,fontSize:'.7rem'}}>
                                          {icons[act.type]||'•'}
                                        </div>
                                        <div style={{flex:1,paddingTop:'4px'}}>
                                          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.08em',textTransform:'uppercase',color:colors[act.type]||'rgba(14,14,13,.5)',fontWeight:600}}>{act.type}</span>
                                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)'}}>{act.date}</span>
                                          </div>
                                          <div style={{fontSize:'.82rem',color:'rgba(14,14,13,.75)',lineHeight:1.5}}>{act.note}</div>
                                        </div>
                                        <button onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,activities:(c.activities||[]).filter((_,idx)=>idx!==i)}:c))}
                                          style={{background:'none',border:'none',cursor:'pointer',color:'rgba(14,14,13,.2)',fontSize:'.8rem',padding:'0 4px',flexShrink:0}}
                                          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#e05454'}}
                                          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='rgba(14,14,13,.2)'}}>×</button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {crmProfileTab === 'tasks' && (
                            <div>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)'}}>Tarefas</div>
                                <button onClick={()=>setShowAddTask(a=>!a)}
                                  style={{padding:'6px 14px',background:'rgba(28,74,53,.08)',color:'#1c4a35',border:'1px solid rgba(28,74,53,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'pointer'}}>
                                  + Tarefa
                                </button>
                              </div>
                              {/* Add task form */}
                              {showAddTask && (
                                <div style={{background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.12)',padding:'14px',marginBottom:'14px'}}>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                                    <div style={{gridColumn:'1/3'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Tarefa</div>
                                      <input className="p-inp" style={{fontSize:'.8rem',padding:'6px 8px'}} placeholder="Descreve a tarefa..." value={newTask.title} onChange={e=>setNewTask(t=>({...t,title:e.target.value}))}/>
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Prazo</div>
                                      <input type="date" className="p-inp" style={{fontSize:'.75rem',padding:'6px 8px'}} value={newTask.dueDate} onChange={e=>setNewTask(t=>({...t,dueDate:e.target.value}))}/>
                                    </div>
                                  </div>
                                  <div style={{marginBottom:'8px'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'4px'}}>Tipo</div>
                                    <select className="p-sel" style={{fontSize:'.75rem',padding:'6px 8px'}} value={newTask.type} onChange={e=>setNewTask(t=>({...t,type:e.target.value as Task['type']}))}>
                                      {[['call','Chamada'],['visit','Visita'],['email','Email'],['proposal','Proposta'],['other','Outro']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </div>
                                  <div style={{display:'flex',gap:'8px'}}>
                                    <button className="p-btn p-btn-gold" style={{padding:'6px 14px',fontSize:'.44rem'}}
                                      onClick={()=>{
                                        if (!newTask.title.trim()) return
                                        const task: Task = { id: Date.now(), ...newTask, done: false }
                                        saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,tasks:[...(c.tasks||[]),task]}:c))
                                        setNewTask({ title:'', dueDate:'', type:'call' })
                                        setShowAddTask(false)
                                      }}>Guardar</button>
                                    <button className="p-btn" style={{padding:'6px 12px',fontSize:'.44rem',background:'rgba(14,14,13,.06)',color:'rgba(14,14,13,.5)'}} onClick={()=>setShowAddTask(false)}>Cancelar</button>
                                  </div>
                                </div>
                              )}
                              {/* Tasks list */}
                              {(!activeContact.tasks || activeContact.tasks.length === 0) ? (
                                <div style={{padding:'32px',textAlign:'center',border:'1px dashed rgba(14,14,13,.1)'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(14,14,13,.3)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Sem tarefas</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.2)'}}>Cria tarefas para este contacto</div>
                                </div>
                              ) : (
                                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                                  {activeContact.tasks.map((task,i)=>{
                                    const isOverdueTask = task.dueDate && !task.done && new Date(task.dueDate) < new Date()
                                    return (
                                      <div key={task.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'#fff',border:'1px solid rgba(14,14,13,.08)',opacity:task.done?0.5:1}}>
                                        <input type="checkbox" checked={task.done} onChange={e=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,tasks:(c.tasks||[]).map((t,idx)=>idx===i?{...t,done:e.target.checked}:t)}:c))} style={{cursor:'pointer',width:'15px',height:'15px',flexShrink:0}}/>
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:'.83rem',color:'#0e0e0d',textDecoration:task.done?'line-through':'none'}}>{task.title}</div>
                                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:isOverdueTask?'#e05454':'rgba(14,14,13,.35)',marginTop:'2px',textTransform:'uppercase',letterSpacing:'.06em'}}>
                                            {task.type} {task.dueDate ? `· ${isOverdueTask?'OVERDUE — ':''}${task.dueDate}` : ''}
                                          </div>
                                        </div>
                                        <button onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,tasks:(c.tasks||[]).filter((_,idx)=>idx!==i)}:c))}
                                          style={{background:'none',border:'none',cursor:'pointer',color:'rgba(14,14,13,.2)',fontSize:'.8rem',padding:'0 4px',flexShrink:0}}
                                          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#e05454'}}
                                          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='rgba(14,14,13,.2)'}}>×</button>
                                      </div>
                                    )
                                  })}
                                  {activeContact.tasks.filter(t=>t.done).length > 0 && (
                                    <button onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,tasks:(c.tasks||[]).filter(t=>!t.done)}:c))}
                                      style={{marginTop:'4px',padding:'5px 12px',background:'rgba(14,14,13,.04)',border:'1px dashed rgba(14,14,13,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',cursor:'pointer',letterSpacing:'.08em',textTransform:'uppercase'}}>
                                      Limpar concluídas ({activeContact.tasks.filter(t=>t.done).length})
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {crmProfileTab === 'notes' && (
                            <div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'12px'}}>Notas &amp; Histórico</div>
                              {/* Voice Notes */}
                              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'12px'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)'}}>Notas por Voz</div>
                                <button
                                  style={{
                                    display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',
                                    background:voiceActive?'rgba(224,84,84,.1)':'rgba(28,74,53,.06)',
                                    border:`1px solid ${voiceActive?'rgba(224,84,84,.4)':'rgba(28,74,53,.2)'}`,
                                    fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',
                                    color:voiceActive?'#e05454':'#1c4a35',cursor:'pointer',transition:'all .2s'
                                  }}
                                  onClick={()=>{
                                    if (voiceActive) {
                                      setVoiceActive(false)
                                      return
                                    }
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                                    if (!SpeechRecognition) { alert('Browser não suporta reconhecimento de voz'); return }
                                    const recognition = new SpeechRecognition()
                                    recognition.lang = 'pt-PT'
                                    recognition.continuous = false
                                    recognition.interimResults = false
                                    setVoiceActive(true)
                                    recognition.start()
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    recognition.onresult = (e: any) => {
                                      const transcript = e.results[0][0].transcript
                                      setVoiceText(transcript)
                                      setVoiceActive(false)
                                    }
                                    recognition.onerror = () => setVoiceActive(false)
                                    recognition.onend = () => setVoiceActive(false)
                                  }}
                                >
                                  <span style={{fontSize:'.8rem'}}>{voiceActive ? '⏹' : '🎤'}</span>
                                  {voiceActive ? 'A gravar...' : 'Gravar nota'}
                                </button>
                                {voiceText && (
                                  <button style={{padding:'5px 10px',background:'rgba(74,156,122,.08)',border:'1px solid rgba(74,156,122,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#4a9c7a',cursor:'pointer'}} onClick={()=>setVoiceText('')}>Limpar</button>
                                )}
                              </div>
                              {voiceText && (
                                <div style={{background:'rgba(74,156,122,.06)',border:'1px solid rgba(74,156,122,.15)',padding:'10px 12px',marginBottom:'10px',fontFamily:"'Jost',sans-serif",fontSize:'.86rem',color:'rgba(14,14,13,.7)',lineHeight:1.6}}>
                                  🎤 &ldquo;{voiceText}&rdquo;
                                </div>
                              )}
                              <textarea
                                className="p-inp"
                                style={{minHeight:'200px',resize:'vertical',fontSize:'.84rem',lineHeight:1.7}}
                                value={activeContact.notes}
                                onChange={e=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,notes:e.target.value}:c))}
                                placeholder="Adiciona notas, preferências detalhadas, histórico de visitas..."
                              />
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.3)',marginTop:'6px',letterSpacing:'.06em'}}>Guardado automaticamente · Criado em {activeContact.createdAt}</div>
                            </div>
                          )}
                          {crmProfileTab === 'matching' && (
                            <div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'4px'}}>Smart Matching — Pipeline + Carteira</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.3)',marginBottom:'14px'}}>Budget ±20% · Zonas · Tipologias</div>
                              {/* Pipeline deals matching */}
                              {deals.filter(d=>{
                                const budget = parseFloat(d.valor.replace(/[^0-9.]/g,''))
                                const bMin = Number(activeContact.budgetMin)||0
                                const bMax = Number(activeContact.budgetMax)||0
                                if (!bMin && !bMax) return true
                                return budget >= bMin * 0.8 && budget <= bMax * 1.2
                              }).map(d=>{
                                const budget = parseFloat(d.valor.replace(/[^0-9.]/g,''))
                                const inBudget = budget >= activeContact.budgetMin && budget <= activeContact.budgetMax
                                const matchScore = inBudget ? 100 : 80
                                return (
                                  <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px',background:'#fff',border:'1px solid rgba(14,14,13,.08)',marginBottom:'8px',borderLeft:`3px solid ${inBudget?'#4a9c7a':'#c9a96e'}`}}>
                                    <div>
                                      <div style={{fontSize:'.83rem',fontWeight:500,color:'#0e0e0d'}}>{d.imovel}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'#c9a96e',marginTop:'2px'}}>{d.valor} · {d.fase}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:inBudget?'#4a9c7a':'#c9a96e',marginTop:'2px'}}>
                                        {inBudget ? '✓ Budget ideal' : '~ Budget ajustado'} · Match {matchScore}%
                                      </div>
                                    </div>
                                    <div style={{display:'flex',gap:'6px',flexDirection:'column',alignItems:'flex-end'}}>
                                      <div style={{background:inBudget?'rgba(74,156,122,.1)':'rgba(201,169,110,.1)',color:inBudget?'#4a9c7a':'#c9a96e',padding:'4px 10px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.08em'}}>{inBudget?'✓ Match':'≈ Próximo'}</div>
                                      <button className="p-btn" style={{padding:'6px 12px',fontSize:'.44rem'}}
                                        onClick={()=>saveCrmContacts(crmContacts.map(c=>c.id===activeContact.id?{...c,dealRef:d.ref}:c))}>
                                        Associar
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                              {/* Carteira matching */}
                              {imoveisList.filter(im=>{
                                const bMin = Number(activeContact.budgetMin)||0
                                const bMax = Number(activeContact.budgetMax)||0
                                const inBudget = (!bMin && !bMax) || (im.preco >= bMin * 0.8 && im.preco <= bMax * 1.2)
                                const zonas = activeContact.zonas||[]
                                const tipos = activeContact.tipos||[]
                                const zonaMatch = zonas.length===0 || zonas.some(z=>im.zona?.toLowerCase().includes(z.toLowerCase())||z.toLowerCase().includes(im.zona?.toLowerCase()||''))
                                const tipoMatch = tipos.length===0 || tipos.some(t=>im.tipo?.toLowerCase().includes(t.toLowerCase())||t.toLowerCase().includes(im.tipo?.toLowerCase()||''))
                                return inBudget && (zonaMatch || tipoMatch)
                              }).slice(0,5).map(im=>{
                                const bMin = Number(activeContact.budgetMin)||0
                                const bMax = Number(activeContact.budgetMax)||0
                                const inBudget = bMin>0 && bMax>0 && im.preco >= bMin && im.preco <= bMax
                                const zonaMatch = (activeContact.zonas||[]).some(z=>im.zona?.toLowerCase().includes(z.toLowerCase()))
                                const tipoMatch = (activeContact.tipos||[]).some(t=>im.tipo?.toLowerCase().includes(t.toLowerCase()))
                                let matchScore = 60
                                if (inBudget) matchScore += 20
                                if (zonaMatch) matchScore += 10
                                if (tipoMatch) matchScore += 10
                                return (
                                  <div key={im.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px',background:'#fff',border:'1px solid rgba(28,74,53,.12)',marginBottom:'8px',borderLeft:'3px solid #1c4a35'}}>
                                    <div>
                                      <div style={{fontSize:'.83rem',fontWeight:500,color:'#0e0e0d'}}>{im.nome}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'#c9a96e',marginTop:'2px'}}>€{(im.preco/1e6).toFixed(2)}M · {im.zona} · {im.tipo}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.4)',marginTop:'2px',display:'flex',gap:'6px'}}>
                                        {inBudget && <span style={{color:'#4a9c7a'}}>✓ Budget</span>}
                                        {zonaMatch && <span style={{color:'#4a9c7a'}}>✓ Zona</span>}
                                        {tipoMatch && <span style={{color:'#4a9c7a'}}>✓ Tipo</span>}
                                        <span>· {matchScore}% match</span>
                                      </div>
                                    </div>
                                    <button className="p-btn" style={{padding:'6px 12px',fontSize:'.44rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}}
                                      onClick={()=>window.open(`https://wa.me/${activeContact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${activeContact.name.split(' ')[0]}! Encontrei um imóvel que pode ser do seu interesse: ${im.nome} — €${(im.preco/1e6).toFixed(2)}M, ${im.zona}. Agency Group.`)}`)}>
                                      📱 Enviar WA
                                    </button>
                                  </div>
                                )
                              })}
                              {deals.filter(d=>{ const b=parseFloat(d.valor.replace(/[^0-9.]/g,'')); const bMin2=Number(activeContact.budgetMin)||0; const bMax2=Number(activeContact.budgetMax)||0; return !bMin2&&!bMax2 ? true : b>=bMin2*0.8&&b<=bMax2*1.2 }).length === 0 &&
                               imoveisList.filter(im=>{ const bMin2=Number(activeContact.budgetMin)||0; const bMax2=Number(activeContact.budgetMax)||0; return !bMin2&&!bMax2 ? false : im.preco>=bMin2*0.8&&im.preco<=bMax2*1.2 }).length === 0 && (
                                <div style={{textAlign:'center',padding:'32px',border:'1px dashed rgba(14,14,13,.1)'}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'rgba(14,14,13,.3)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'8px'}}>Sem imóveis correspondentes</div>
                                  <button className="p-btn" style={{padding:'8px 16px',fontSize:'.46rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}} onClick={()=>setSection('radar')}>Analisar Novo Imóvel →</button>
                                </div>
                              )}
                            </div>
                          )}
                          {crmProfileTab === 'postclosing' && (
                            <div>
                              <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.2rem',color:'#0e0e0d',marginBottom:'6px'}}>Post-Sale Care — {activeContact.name}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>Plano de acompanhamento após escritura · Fidelização e referências</div>
                              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                                {POST_CLOSING_TASKS.map((task,i)=>(
                                  <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'#fff',border:'1px solid rgba(14,14,13,.08)'}}>
                                    <div style={{width:'44px',height:'44px',borderRadius:'50%',background:task.type==='anniversary'?'rgba(201,169,110,.15)':task.type==='financial'||task.type==='opportunity'?'rgba(28,74,53,.08)':'rgba(14,14,13,.04)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                      <div style={{fontFamily:"'Cormorant',serif",fontSize:'.9rem',fontWeight:500,color:task.type==='anniversary'?'#c9a96e':task.type==='financial'||task.type==='opportunity'?'#1c4a35':'rgba(14,14,13,.4)'}}>{task.days}d</div>
                                    </div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:'.83rem',color:'#0e0e0d',fontWeight:500}}>{task.label}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)',marginTop:'2px',textTransform:'uppercase',letterSpacing:'.08em'}}>{task.type}</div>
                                    </div>
                                    <button className="p-btn" style={{padding:'6px 12px',fontSize:'.4rem',background:'rgba(28,74,53,.08)',color:'#1c4a35'}}
                                      onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Olá ${activeContact.name}! ${task.label}.\n\nAgency Group · AMI 22506`)}`)}>
                                      WhatsApp
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px',background:'rgba(14,14,13,.015)'}}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.2)" strokeWidth="1.2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',color:'rgba(14,14,13,.3)',letterSpacing:'.14em',textTransform:'uppercase'}}>Selecciona um contacto</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.25)',letterSpacing:'.06em'}}>ou cria um novo</div>
                      </div>
                    )}
                  </div>}
                </div>
              )
            })()}

            {/* ── INVESTOR PITCH IA ── */}
            {section==='investorpitch' && (() => {
              const INVESTOR_TYPES = [
                { id:'private', label:'Privado / HNW', desc:'Compra directa · Capital próprio' },
                { id:'family_office', label:'Family Office', desc:'Portfolio · Longo prazo' },
                { id:'institutional', label:'Institucional', desc:'REIT · Fund · Asset manager' },
                { id:'hnwi', label:'HNWI Internacional', desc:'NHR · Golden Visa · Offshore' },
              ]
              const pitchProperty = imoveisList.find(p=>String(p.id)===ipProperty) || imoveisList[0]
              const r = ipResult as Record<string,unknown>|null
              const fm = r?.financialModel as Record<string,unknown>|undefined

              const runPitch = async () => {
                if (!pitchProperty) return
                setIpLoading(true); setIpResult(null); setIpError(null)
                try {
                  const res = await fetch('/api/investor-pitch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({property:pitchProperty,investorType:ipInvestorType,horizon:ipHorizon,irrTarget:ipIrr,language:ipLang,budget:pitchProperty.preco})})
                  const d = await res.json()
                  if(d.success) setIpResult(d.pitch)
                  else setIpError(d.error||'Erro a gerar pitch')
                } catch(e){ setIpError(e instanceof Error?e.message:'Erro de rede') }
                finally { setIpLoading(false) }
              }

              return (
                <div style={{maxWidth:'1100px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Claude Opus · Goldman Sachs Style · PT/EN/FR/AR</div>
                  <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d',marginBottom:'4px'}}>Investor Pitch <em style={{color:'#1c4a35'}}>IA</em></div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.35)',marginBottom:'28px'}}>Investment Memorandum completo · IRR · Yield · Risk Matrix · Comparables · Executive Summary</div>

                  <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:'24px',alignItems:'start'}}>
                    {/* LEFT: Config */}
                    <div>
                      {/* Property selector */}
                      <div className="p-card" style={{marginBottom:'14px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Imóvel</div>
                        <select className="p-sel" value={ipProperty} onChange={e=>setIpProperty(e.target.value)}>
                          {imoveisList.map(p=><option key={p.id} value={String(p.id)}>{p.nome} — €{(p.preco/1e6).toFixed(2)}M</option>)}
                        </select>
                        {pitchProperty && (
                          <div style={{marginTop:'10px',padding:'10px',background:'rgba(28,74,53,.04)',border:'1px solid rgba(28,74,53,.1)'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',lineHeight:1.7}}>
                              📍 {pitchProperty.zona} · {pitchProperty.bairro}<br/>
                              🏠 {pitchProperty.tipo} · {pitchProperty.area}m² · T{pitchProperty.quartos}<br/>
                              💰 €{pitchProperty.preco.toLocaleString('pt-PT')} · €{Math.round(pitchProperty.preco/pitchProperty.area).toLocaleString('pt-PT')}/m²<br/>
                              {pitchProperty.badge && <span style={{background:'#c9a96e',color:'#0c1f15',padding:'0 4px',fontSize:'.32rem',fontWeight:700}}>{pitchProperty.badge}</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Investor type */}
                      <div className="p-card" style={{marginBottom:'14px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Perfil do Investidor</div>
                        {INVESTOR_TYPES.map(t=>(
                          <button key={t.id} onClick={()=>setIpInvestorType(t.id as typeof ipInvestorType)}
                            style={{width:'100%',textAlign:'left',padding:'8px 10px',marginBottom:'5px',cursor:'pointer',border:`1px solid ${ipInvestorType===t.id?'#1c4a35':'rgba(14,14,13,.1)'}`,background:ipInvestorType===t.id?'rgba(28,74,53,.08)':'transparent',transition:'all .15s'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:ipInvestorType===t.id?'#1c4a35':'rgba(14,14,13,.6)',fontWeight:ipInvestorType===t.id?600:400}}>{t.label}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(14,14,13,.35)',marginTop:'2px'}}>{t.desc}</div>
                          </button>
                        ))}
                      </div>

                      {/* Horizon + IRR */}
                      <div className="p-card" style={{marginBottom:'14px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>✦ Horizonte & IRR Target</div>
                        <div style={{marginBottom:'12px'}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',marginBottom:'5px'}}>Horizonte de Investimento</div>
                          <div style={{display:'flex',gap:'5px'}}>
                            {([3,5,10] as const).map(h=>(
                              <button key={h} onClick={()=>setIpHorizon(h)} style={{flex:1,padding:'7px',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',cursor:'pointer',border:'1px solid',background:ipHorizon===h?'#1c4a35':'transparent',color:ipHorizon===h?'#fff':'rgba(14,14,13,.5)',borderColor:ipHorizon===h?'#1c4a35':'rgba(14,14,13,.15)'}}>{h}A</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.5)',marginBottom:'5px'}}>IRR Target mínimo</div>
                          <div style={{display:'flex',gap:'5px'}}>
                            {([8,12,15,20] as const).map(irr=>(
                              <button key={irr} onClick={()=>setIpIrr(irr)} style={{flex:1,padding:'6px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',border:'1px solid',background:ipIrr===irr?'#c9a96e':'transparent',color:ipIrr===irr?'#0c1f15':'rgba(14,14,13,.5)',borderColor:ipIrr===irr?'#c9a96e':'rgba(14,14,13,.15)'}}>{irr}%+</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Language */}
                      <div className="p-card" style={{marginBottom:'14px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'8px'}}>✦ Língua do Pitch</div>
                        <div style={{display:'flex',gap:'5px'}}>
                          {(['PT','EN','FR','AR'] as const).map(l=>(
                            <button key={l} onClick={()=>setIpLang(l)} style={{flex:1,padding:'7px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,cursor:'pointer',border:'1px solid',background:ipLang===l?'#1c4a35':'transparent',color:ipLang===l?'#fff':'rgba(14,14,13,.5)',borderColor:ipLang===l?'#1c4a35':'rgba(14,14,13,.15)'}}>{l}</button>
                          ))}
                        </div>
                      </div>

                      <button onClick={runPitch} disabled={ipLoading||!pitchProperty}
                        style={{width:'100%',padding:'14px',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',cursor:ipLoading?'not-allowed':'pointer',background:ipLoading?'rgba(14,14,13,.06)':'linear-gradient(135deg,#0c1f15,#1c4a35)',color:ipLoading?'rgba(14,14,13,.3)':'#c9a96e',border:'none',transition:'all .3s'}}>
                        {ipLoading?'✦ A gerar memorandum...':'✦ Gerar Investment Memorandum'}
                      </button>
                      {ipError&&<div style={{marginTop:'8px',padding:'8px',background:'rgba(220,38,38,.05)',border:'1px solid rgba(220,38,38,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'#dc2626'}}>{ipError}</div>}
                    </div>

                    {/* RIGHT: Pitch Output */}
                    <div>
                      {ipResult ? (
                        <div style={{animation:'fadeIn .4s ease'}}>
                          {/* Header */}
                          <div style={{background:'linear-gradient(135deg,#0c1f15,#1a3d28)',padding:'28px',marginBottom:'16px',border:'1px solid rgba(201,169,110,.2)'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.15em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'8px'}}>INVESTMENT MEMORANDUM · CONFIDENCIAL · AGENCY GROUP AMI 22506</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>{String(r?.title||'')}</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontStyle:'italic',fontSize:'1rem',color:'#c9a96e',marginBottom:'16px'}}>{String(r?.tagline||'')}</div>
                            <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.5)',background:'rgba(255,255,255,.05)',padding:'4px 10px'}}>{String(r?.recommendation||'')}</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#c9a96e',background:'rgba(201,169,110,.1)',padding:'4px 10px'}}>Confiança: {String(r?.confidenceScore||'—')}/100</span>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.4)',padding:'4px 10px'}}>IRR Target: {ipIrr}%+ · {ipHorizon}A</span>
                            </div>
                          </div>

                          {/* Financial Model */}
                          {fm && (
                            <div className="p-card" style={{marginBottom:'14px',borderTop:'3px solid #c9a96e'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Modelo Financeiro</div>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'12px'}}>
                                {[
                                  ['Renda Mensal',`€${Number(fm.estimatedRent||0).toLocaleString('pt-PT')}`,'#4a9c7a'],
                                  ['Yield Bruto',`${Number(fm.yieldBruto||0).toFixed(2)}%`,'#22c55e'],
                                  ['Yield Líquido',`${Number(fm.yieldLiquido||0).toFixed(2)}%`,'#86efac'],
                                  ['IRR Estimado',`${Number(fm.irr||0).toFixed(1)}%`,'#c9a96e'],
                                  ['Cash-on-Cash',`${Number(fm.cashOnCash||0).toFixed(2)}%`,'#60a5fa'],
                                  [`Valor ${ipHorizon}A`,`€${Number(fm[`projectedValue${ipHorizon}Y`]||0).toLocaleString('pt-PT')}`,'#c9a96e'],
                                  ['Return Total',`+${Number(fm.totalReturn||0).toFixed(0)}%`,'#22c55e'],
                                  ['Saída',String(fm.exitStrategy||'—'),'rgba(14,14,13,.5)'],
                                ].map(([l,v,c])=>(
                                  <div key={String(l)} style={{background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.06)',padding:'10px',textAlign:'center'}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'4px'}}>{l}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.58rem',fontWeight:700,color:String(c),lineHeight:1}}>{v}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Executive Summary */}
                          <div className="p-card" style={{marginBottom:'14px'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Executive Summary</div>
                            <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.84rem',lineHeight:1.8,color:'rgba(14,14,13,.7)',whiteSpace:'pre-wrap'}}>{String(r?.executiveSummary||'')}</div>
                          </div>

                          {/* Investment Thesis */}
                          <div className="p-card" style={{marginBottom:'14px',background:'rgba(12,31,21,.03)',borderLeft:'3px solid #1c4a35'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Investment Thesis</div>
                            <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.84rem',lineHeight:1.8,color:'rgba(14,14,13,.7)',whiteSpace:'pre-wrap'}}>{String(r?.investmentThesis||'')}</div>
                          </div>

                          {/* Risk Matrix */}
                          {Array.isArray(r?.riskMatrix) && (
                            <div className="p-card" style={{marginBottom:'14px'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>Risk Matrix</div>
                              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 2fr',gap:'0'}}>
                                {['Risco','Probabilidade','Impacto','Mitigação'].map(h=>(
                                  <div key={h} style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase',padding:'6px 10px',borderBottom:'2px solid rgba(14,14,13,.08)',background:'rgba(14,14,13,.02)'}}>{h}</div>
                                ))}
                                {(r?.riskMatrix as {risk:string;probability:string;impact:string;mitigation:string}[]).map((risk,i)=>(
                                  <>
                                    <div key={`r${i}`} style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.7)',padding:'8px 10px',borderBottom:'1px solid rgba(14,14,13,.04)'}}>{risk.risk}</div>
                                    <div key={`p${i}`} style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,padding:'8px 10px',borderBottom:'1px solid rgba(14,14,13,.04)',color:risk.probability==='Alta'?'#dc2626':risk.probability==='Média'?'#c9a96e':'#4a9c7a'}}>{risk.probability}</div>
                                    <div key={`im${i}`} style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:600,padding:'8px 10px',borderBottom:'1px solid rgba(14,14,13,.04)',color:risk.impact==='Alto'?'#dc2626':risk.impact==='Médio'?'#c9a96e':'#4a9c7a'}}>{risk.impact}</div>
                                    <div key={`m${i}`} style={{fontFamily:"'Jost',sans-serif",fontSize:'.78rem',color:'rgba(14,14,13,.6)',padding:'8px 10px',borderBottom:'1px solid rgba(14,14,13,.04)'}}>{risk.mitigation}</div>
                                  </>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* USPs + Tax Advantages + Action Plan */}
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>
                            <div className="p-card">
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>Unique Selling Points</div>
                              {Array.isArray(r?.uniqueSellingPoints)&&(r?.uniqueSellingPoints as string[]).map((u,i)=>(
                                <div key={i} style={{display:'flex',gap:'8px',marginBottom:'6px',fontSize:'.82rem',color:'rgba(14,14,13,.7)'}}>
                                  <span style={{color:'#1c4a35',fontWeight:700,flexShrink:0}}>✓</span>{u}
                                </div>
                              ))}
                            </div>
                            <div className="p-card">
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'10px'}}>Vantagens Fiscais</div>
                              {Array.isArray(r?.taxAdvantages)&&(r?.taxAdvantages as string[]).map((t,i)=>(
                                <div key={i} style={{display:'flex',gap:'8px',marginBottom:'6px',fontSize:'.82rem',color:'rgba(14,14,13,.7)'}}>
                                  <span style={{color:'#c9a96e',fontWeight:700,flexShrink:0}}>€</span>{t}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action Plan */}
                          {Array.isArray(r?.actionPlan)&&(
                            <div className="p-card" style={{marginBottom:'14px',background:'#0c1f15',border:'1px solid rgba(201,169,110,.15)'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(201,169,110,.6)',marginBottom:'10px'}}>Plano de Acção</div>
                              {(r?.actionPlan as string[]).map((step,i)=>(
                                <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',marginBottom:'8px'}}>
                                  <span style={{fontFamily:"'Cormorant',serif",fontSize:'1.1rem',color:'#c9a96e',lineHeight:1,flexShrink:0,minWidth:'20px'}}>{i+1}.</span>
                                  <span style={{fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'rgba(244,240,230,.7)',lineHeight:1.5}}>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Share buttons */}
                          <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                            <button className="p-btn p-btn-gold" onClick={()=>{
                              const text = `INVESTMENT MEMORANDUM — Agency Group\n${String(r?.title||'')}\n\n${String(r?.tagline||'')}\n\nRecomendação: ${String(r?.recommendation||'')}\nIRR: ${Number(fm?.irr||0).toFixed(1)}% · Yield: ${Number(fm?.yieldBruto||0).toFixed(2)}%\n\n${String(r?.executiveSummary||'').substring(0,400)}...\n\nAgency Group · AMI 22506 · +351919948986`
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank')
                            }}>💬 Enviar por WhatsApp</button>
                            <button className="p-btn" style={{background:'transparent',color:'#1c4a35',border:'1px solid #1c4a35'}} onClick={()=>{
                              const text = JSON.stringify(r,null,2)
                              navigator.clipboard.writeText(text)
                            }}>📋 Copiar JSON</button>
                            <button className="p-btn" style={{background:'transparent',color:'rgba(14,14,13,.5)',border:'1px solid rgba(14,14,13,.15)'}} onClick={()=>setIpResult(null)}>Novo Pitch</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'400px',border:'1px dashed rgba(14,14,13,.1)',background:'rgba(14,14,13,.01)'}}>
                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'2.5rem',color:'rgba(14,14,13,.1)',marginBottom:'12px'}}>Goldman</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',color:'rgba(14,14,13,.25)',textTransform:'uppercase',textAlign:'center',lineHeight:2}}>
                            Selecciona o imóvel<br/>
                            Configura o perfil do investidor<br/>
                            Claude gera o memorandum completo
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── SOFIA AVATAR IA ── */}
            {section==='sofia' && (() => {
              const SOFIA_PRESETS: {label:string; icon:string; textPT:string; textEN:string; textFR:string; textAR:string}[] = [
                { label:'Abertura', icon:'👋',
                  textPT:'Olá! Sou a Sofia, consultora da Agency Group. Especializo-me em imobiliário de luxo em Portugal, de Lisboa ao Algarve. Estou aqui para guiá-lo em cada passo desta jornada — desde a primeira visita até à escritura. Como posso ajudá-lo hoje?',
                  textEN:'Hello! I\'m Sofia, a consultant at Agency Group. I specialise in luxury real estate across Portugal, from Lisbon to the Algarve. I\'m here to guide you every step of the way — from first viewing to completion. How may I help you today?',
                  textFR:'Bonjour! Je suis Sofia, consultante chez Agency Group. Je me spécialise dans l\'immobilier de luxe au Portugal. Je suis là pour vous accompagner à chaque étape. Comment puis-je vous aider aujourd\'hui?',
                  textAR:'مرحباً! أنا سوفيا، مستشارة في Agency Group. أتخصص في العقارات الفاخرة في البرتغال. أنا هنا لإرشادك في كل خطوة. كيف يمكنني مساعدتك اليوم؟' },
                { label:'Apresentação', icon:'🏛️',
                  textPT:'Permita-me apresentar-lhe esta propriedade extraordinária. Uma oportunidade única no mercado de luxo português, com localização privilegiada e acabamentos de excelência. Os nossos imóveis são seleccionados com rigor para clientes que exigem o melhor.',
                  textEN:'Allow me to present this extraordinary property. A unique opportunity in the Portuguese luxury market, with a privileged location and excellent finishes. Our properties are carefully selected for clients who demand the very best.',
                  textFR:'Permettez-moi de vous présenter cette propriété extraordinaire. Une opportunité unique sur le marché du luxe portugais, avec un emplacement privilégié et des finitions d\'excellence.',
                  textAR:'اسمحوا لي أن أقدم لكم هذا العقار الاستثنائي. فرصة فريدة في سوق الفخامة البرتغالي، بموقع متميز وتشطيبات راقية.' },
                { label:'Follow-Up', icon:'📞',
                  textPT:'Obrigada pelo seu interesse no imóvel. Queria verificar se tem alguma questão após a visita. Tenho disponibilidade para agendar uma segunda visita ou preparar uma proposta personalizada. A sua satisfação é a nossa prioridade.',
                  textEN:'Thank you for your interest in the property. I wanted to check if you have any questions following your viewing. I\'m available to arrange a second visit or prepare a personalised proposal. Your satisfaction is our priority.',
                  textFR:'Merci pour votre intérêt pour la propriété. Je voulais vérifier si vous avez des questions suite à votre visite. Je suis disponible pour organiser une deuxième visite.',
                  textAR:'شكراً لاهتمامك بالعقار. أردت التحقق مما إذا كان لديك أي أسئلة بعد الزيارة. أنا متاحة لترتيب زيارة ثانية.' },
                { label:'Investimento', icon:'📊',
                  textPT:'Portugal posiciona-se em 2026 entre os cinco mercados imobiliários de luxo mais atractivos do mundo, segundo a Savills. Com valorização de dezassete vírgula seis por cento no último ano e compradores internacionais em crescimento, o momento de investir é agora.',
                  textEN:'Portugal ranks among the world\'s top five most attractive luxury real estate markets in 2026, according to Savills. With seventeen point six percent appreciation over the last year and growing international demand, now is the time to invest.',
                  textFR:'Le Portugal se positionne en 2026 parmi les cinq marchés immobiliers de luxe les plus attractifs du monde selon Savills. Avec une valorisation de dix-sept virgule six pour cent l\'année dernière, le moment d\'investir est maintenant.',
                  textAR:'تحتل البرتغال مكانة بين أفضل خمسة أسواق عقارية فاخرة في العالم عام 2026 وفقاً لسافيلز. مع ارتفاع الأسعار بنسبة سبعة عشر فاصل ستة بالمئة العام الماضي، الوقت المناسب للاستثمار هو الآن.' },
              ]

              const activePresetText = (p: typeof SOFIA_PRESETS[0]) => {
                if (sofiaLang === 'PT') return p.textPT
                if (sofiaLang === 'FR') return p.textFR
                if (sofiaLang === 'AR') return p.textAR
                return p.textEN
              }

              const startSofia = async () => {
                setSofiaLoading(true); setSofiaError(null)
                try {
                  const sessRes = await fetch('/api/heygen/session', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quality: 'high' })
                  })
                  const sessData = await sessRes.json()
                  if (!sessRes.ok || sessData.error) {
                    setSofiaError(sessData.error || 'Erro ao criar sessão HeyGen. Verifica HEYGEN_API_KEY no .env.local')
                    return
                  }
                  const d = sessData.data || sessData
                  const sessionId = d.session_id
                  const sdpOffer = d.sdp
                  const iceServers = d.ice_servers2 || d.ice_servers || []
                  setSofiaSessionId(sessionId)

                  const pc = new RTCPeerConnection({ iceServers })
                  sofiaPeerRef.current = pc

                  pc.ontrack = (event) => {
                    if (sofiaVideoRef.current && event.streams[0]) {
                      sofiaVideoRef.current.srcObject = event.streams[0]
                      setSofiaConnected(true)
                    }
                  }

                  await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer))
                  const answer = await pc.createAnswer()
                  await pc.setLocalDescription(answer)

                  await fetch('/api/heygen/start', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, sdp: answer })
                  })

                  pc.onicecandidate = async (evt) => {
                    if (evt.candidate) {
                      await fetch('/api/heygen/ice', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, candidate: evt.candidate })
                      })
                    }
                  }
                } catch (e) {
                  setSofiaError('Erro WebRTC: ' + String(e))
                } finally {
                  setSofiaLoading(false)
                }
              }

              const stopSofia = async () => {
                if (sofiaSessionId) {
                  await fetch('/api/heygen/session', {
                    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: sofiaSessionId })
                  })
                }
                sofiaPeerRef.current?.close()
                sofiaPeerRef.current = null
                setSofiaSessionId(null); setSofiaConnected(false)
                if (sofiaVideoRef.current) sofiaVideoRef.current.srcObject = null
              }

              const sofiaSpeak = async (text: string) => {
                if (!sofiaSessionId || !text.trim()) return
                setSofiaSpeaking(true)
                try {
                  await fetch('/api/heygen/task', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: sofiaSessionId, text: text.trim() })
                  })
                } finally {
                  setSofiaSpeaking(false)
                }
              }

              const generateScript = async () => {
                const prop = imoveisList.find(p => String(p.id) === sofiaPropSel)
                if (!prop) return
                setSofiaScriptLoading(true)
                try {
                  const res = await fetch('/api/sofia/script', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ property: prop, language: sofiaLang, purpose: 'Apresentação do imóvel' })
                  })
                  const data = await res.json()
                  if (data.script) setSofiaText(data.script)
                } catch { /* ignore */ }
                finally { setSofiaScriptLoading(false) }
              }

              return (
                <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
                  {/* Header */}
                  <div style={{background:'linear-gradient(135deg,#0c1f15,#1a3d2a)',padding:'28px 32px',borderBottom:'1px solid rgba(201,169,110,.15)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'16px'}}>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.22em',textTransform:'uppercase',color:'#c9a96e',marginBottom:'6px'}}>HeyGen · Streaming Avatar</div>
                        <h2 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'#f4f0e6',margin:0}}>Sofia Avatar IA</h2>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(244,240,230,.4)',marginTop:'6px',letterSpacing:'.06em'}}>Apresentações de imóveis em vídeo · 4 idiomas · WebRTC streaming</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        {(['PT','EN','FR','AR'] as const).map(l => (
                          <button key={l} onClick={()=>setSofiaLang(l)}
                            style={{padding:'6px 14px',border:'1px solid',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',cursor:'pointer',transition:'all .2s',
                              background:sofiaLang===l?'#c9a96e':'transparent',
                              borderColor:sofiaLang===l?'#c9a96e':'rgba(201,169,110,.3)',
                              color:sofiaLang===l?'#0c1f15':'rgba(201,169,110,.6)'}}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',minHeight:'calc(100vh - 200px)'}}>
                    {/* Left: Controls */}
                    <div style={{padding:'28px 32px',borderRight:'1px solid rgba(14,14,13,.08)',display:'flex',flexDirection:'column',gap:'24px',overflowY:'auto'}}>

                      {/* Session control */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'12px'}}>Sessão</div>
                        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
                          {!sofiaConnected ? (
                            <button onClick={startSofia} disabled={sofiaLoading}
                              style={{padding:'12px 24px',background:sofiaLoading?'rgba(14,14,13,.06)':'linear-gradient(135deg,#0c1f15,#1c4a35)',color:sofiaLoading?'rgba(14,14,13,.3)':'#c9a96e',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',cursor:sofiaLoading?'not-allowed':'pointer',transition:'all .3s'}}>
                              {sofiaLoading ? '⟳ A conectar...' : '▶ Iniciar Sofia'}
                            </button>
                          ) : (
                            <>
                              <div style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',padding:'8px 16px'}}>
                                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10b981',animation:'pulse 2s ease-in-out infinite'}}/>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#10b981',letterSpacing:'.1em'}}>LIVE</span>
                              </div>
                              <button onClick={stopSofia}
                                style={{padding:'8px 18px',background:'rgba(224,84,84,.08)',border:'1px solid rgba(224,84,84,.25)',color:'#e05454',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer'}}>
                                ■ Terminar
                              </button>
                            </>
                          )}
                        </div>
                        {sofiaError && (
                          <div style={{marginTop:'12px',padding:'12px 16px',background:'rgba(224,84,84,.06)',border:'1px solid rgba(224,84,84,.2)',borderLeft:'3px solid #e05454'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#e05454'}}>{sofiaError}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',marginTop:'6px'}}>Verifica HEYGEN_API_KEY + HEYGEN_AVATAR_ID no .env.local</div>
                          </div>
                        )}
                      </div>

                      {/* Property selector for script gen */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'10px'}}>Imóvel para Script IA</div>
                        <div style={{display:'flex',gap:'8px'}}>
                          <select value={sofiaPropSel} onChange={e=>setSofiaPropSel(e.target.value)}
                            style={{flex:1,padding:'8px 12px',border:'1px solid rgba(14,14,13,.12)',background:'#fff',fontFamily:"'DM Mono',monospace",fontSize:'.48rem',color:'#0e0e0d',outline:'none'}}>
                            <option value=''>Seleccionar imóvel...</option>
                            {imoveisList.map(p => (
                              <option key={p.id as string} value={String(p.id)}>{String(p.nome)} — {String(p.zona)}</option>
                            ))}
                          </select>
                          <button onClick={generateScript} disabled={!sofiaPropSel||sofiaScriptLoading}
                            style={{padding:'8px 16px',background:'#1c4a35',color:'#c9a96e',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',cursor:!sofiaPropSel||sofiaScriptLoading?'not-allowed':'pointer',opacity:!sofiaPropSel||sofiaScriptLoading?.5:1}}>
                            {sofiaScriptLoading?'⟳':'✦ IA'}
                          </button>
                        </div>
                      </div>

                      {/* Script presets */}
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'10px'}}>Scripts Pré-definidos</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                          {SOFIA_PRESETS.map(p => (
                            <button key={p.label} onClick={()=>setSofiaText(activePresetText(p))}
                              style={{padding:'12px',background:'rgba(14,14,13,.02)',border:'1px solid rgba(14,14,13,.1)',textAlign:'left',cursor:'pointer',transition:'all .2s'}}
                              onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#1c4a35'}}
                              onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(14,14,13,.1)'}}>
                              <div style={{fontSize:'1.1rem',marginBottom:'4px'}}>{p.icon}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',fontWeight:700,color:'#0e0e0d',letterSpacing:'.08em'}}>{p.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom text input */}
                      <div style={{flex:1,display:'flex',flexDirection:'column',gap:'8px'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(14,14,13,.35)'}}>Texto Personalizado</div>
                        <textarea
                          value={sofiaText}
                          onChange={e=>setSofiaText(e.target.value)}
                          placeholder='Escreve ou gera o texto que a Sofia irá falar...'
                          rows={7}
                          style={{padding:'14px',border:'1px solid rgba(14,14,13,.12)',background:'#fff',fontFamily:"'Jost',sans-serif",fontSize:'.82rem',color:'#0e0e0d',outline:'none',resize:'vertical',lineHeight:1.6}}
                          onFocus={e=>{e.currentTarget.style.borderColor='#1c4a35'}}
                          onBlur={e=>{e.currentTarget.style.borderColor='rgba(14,14,13,.12)'}}
                        />
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.3)'}}>{sofiaText.length} caracteres</span>
                          <button onClick={()=>sofiaSpeak(sofiaText)} disabled={!sofiaConnected||sofiaSpeaking||!sofiaText.trim()}
                            style={{padding:'12px 28px',background:!sofiaConnected?'rgba(14,14,13,.06)':'linear-gradient(135deg,#0c1f15,#1c4a35)',color:!sofiaConnected?'rgba(14,14,13,.3)':'#c9a96e',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',cursor:!sofiaConnected||sofiaSpeaking||!sofiaText.trim()?'not-allowed':'pointer',transition:'all .3s'}}>
                            {sofiaSpeaking ? '◎ A falar...' : '▶ Falar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Video */}
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0c1f15',position:'relative',minHeight:'500px'}}>
                      {sofiaConnected ? (
                        <video
                          ref={sofiaVideoRef}
                          autoPlay playsInline
                          style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}
                        />
                      ) : (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'20px',padding:'40px'}}>
                          {/* Avatar placeholder */}
                          <div style={{width:'120px',height:'120px',borderRadius:'50%',background:'linear-gradient(135deg,#1c4a35,#2d6e53)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid rgba(201,169,110,.3)'}}>
                            <span style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2.5rem',color:'#c9a96e'}}>S</span>
                          </div>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.6rem',color:'#f4f0e6',marginBottom:'6px'}}>Sofia</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.3)',letterSpacing:'.12em',textTransform:'uppercase'}}>Agency Group · AI Consultant</div>
                          </div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(244,240,230,.35)',textAlign:'center',lineHeight:1.8,maxWidth:'280px'}}>
                            {sofiaLoading ? 'A estabelecer ligação WebRTC...' : 'Inicia a sessão para activar a apresentação em vídeo em tempo real'}
                          </div>
                          {!sofiaError && (
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(201,169,110,.4)',textAlign:'center',marginTop:'8px',letterSpacing:'.08em'}}>
                              Powered by HeyGen Streaming API · WebRTC
                            </div>
                          )}
                        </div>
                      )}
                      {sofiaSpeaking && (
                        <div style={{position:'absolute',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'rgba(12,31,21,.9)',border:'1px solid rgba(201,169,110,.3)',padding:'8px 20px',display:'flex',alignItems:'center',gap:'8px'}}>
                          <div style={{display:'flex',gap:'3px',alignItems:'center'}}>
                            {[0,1,2,3].map(i => (
                              <div key={i} style={{width:'3px',background:'#c9a96e',borderRadius:'2px',animation:`soundBar 0.8s ease-in-out ${i*0.15}s infinite alternate`,height:'12px'}}/>
                            ))}
                          </div>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#c9a96e',letterSpacing:'.1em'}}>SOFIA A FALAR</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Setup instructions */}
                  <div style={{padding:'20px 32px',background:'rgba(12,31,21,.04)',borderTop:'1px solid rgba(14,14,13,.06)'}}>
                    <div style={{display:'flex',gap:'32px',flexWrap:'wrap',alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(14,14,13,.3)',marginBottom:'6px'}}>Configuração necessária</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)',lineHeight:1.8}}>
                          HEYGEN_API_KEY=hg_xxx · HEYGEN_AVATAR_ID=seu-avatar-id · HEYGEN_VOICE_ID=sua-voz-id
                        </div>
                      </div>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(14,14,13,.3)',marginBottom:'6px'}}>Capacidades</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',color:'rgba(14,14,13,.5)',lineHeight:1.8}}>
                          PT · EN · FR · AR · Streaming real-time · Scripts IA · Presets por persona
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── CONSULTOR JURÍDICO IA ── */}
            {section==='juridico' && (
              <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#f4f0e6'}}>

                {/* Sugestões rápidas */}
                <div style={{padding:'10px 20px',background:'#fff',borderBottom:'1px solid rgba(14,14,13,.08)',display:'flex',gap:'5px',flexWrap:'wrap',flexShrink:0,alignItems:'center'}}>
                  {JUR_SUGGESTIONS.map(s=>(
                    <button key={s.label}
                      onClick={()=>{ if (!jurLoading) enviarJuridico(s.q) }}
                      style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.09em',color: s.q.startsWith('MEMO:') ? '#8B6914' : '#1c4a35',border:`1px solid ${s.q.startsWith('MEMO:') ? 'rgba(139,105,20,.25)' : 'rgba(28,74,53,.2)'}`,padding:'4px 10px',cursor:'pointer',background: s.q.startsWith('MEMO:') ? 'rgba(201,169,110,.06)' : 'transparent',transition:'all .2s',whiteSpace:'nowrap'}}
                      onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.background=s.q.startsWith('MEMO:')? '#c9a96e' : '#1c4a35';(e.currentTarget as HTMLButtonElement).style.color='#fff'}}
                      onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.background=s.q.startsWith('MEMO:')? 'rgba(201,169,110,.06)' : 'transparent';(e.currentTarget as HTMLButtonElement).style.color=s.q.startsWith('MEMO:')? '#8B6914' : '#1c4a35'}}
                    >{s.label}</button>
                  ))}
                  <div style={{display:'flex',gap:'6px',marginLeft:'auto',flexShrink:0}}>
                    <button
                      onClick={exportarJuridico}
                      title="Exportar conversa"
                      style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.09em',color:'rgba(14,14,13,.4)',border:'1px solid rgba(14,14,13,.12)',padding:'4px 10px',cursor:'pointer',background:'transparent'}}
                    >↓ exportar</button>
                    <button
                      onClick={()=>setJurMsgs([{ role:'assistant', content:'Nova conversa iniciada. Como posso ajudar?\n\nPrefixo **MEMO:** para relatório jurídico estruturado completo.', ts: new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) }])}
                      style={{fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.09em',color:'rgba(14,14,13,.4)',border:'1px solid rgba(14,14,13,.12)',padding:'4px 10px',cursor:'pointer',background:'transparent'}}
                    >↺ nova</button>
                  </div>
                </div>

                {/* Mensagens */}
                <div style={{flex:1,overflowY:'auto',padding:'24px 32px',display:'flex',flexDirection:'column',gap:'16px'}}
                  ref={(el)=>{ if(el) { jurBottomRef.current = el.querySelector('[data-jur-bottom]') as HTMLDivElement | null } }}>
                  {jurMsgs.map((m,i)=>(
                    <div key={i} style={{display:'flex',flexDirection:'column',maxWidth:'82%',alignSelf:m.role==='user'?'flex-end':'flex-start'}}>
                      {m.role==='user'
                        ? (
                          <div style={{padding:'12px 16px',fontSize:'.84rem',lineHeight:1.65,whiteSpace:'pre-wrap',fontFamily:"'Jost',sans-serif",background:'#1c4a35',color:'#f4f0e6'}}>
                            {m.mode==='memo' && <span style={{display:'inline-block',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',background:'rgba(201,169,110,.25)',color:'#c9a96e',padding:'1px 6px',marginBottom:'6px',marginRight:'6px'}}>MEMO</span>}
                            {m.content.replace(/^MEMO:\s*/,'').replace(/^MEMO\s*/,'')}
                          </div>
                        ) : (
                          <div
                            style={{padding:'16px 20px',fontSize:'.84rem',lineHeight:1.75,fontFamily:"'Jost',sans-serif",background:'#fff',color:'#0e0e0d',borderLeft:'3px solid #c9a96e'}}
                            dangerouslySetInnerHTML={{__html: renderJurMarkdown(m.content)}}
                          />
                        )
                      }
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'4px'}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',color:'rgba(14,14,13,.3)'}}>{m.ts}</span>
                        {m.webSearch && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.12em',textTransform:'uppercase',color:'#c9a96e',background:'rgba(201,169,110,.1)',padding:'1px 6px'}}>fontes actualizadas</span>}
                        {m.role==='assistant' && (
                          <button
                            onClick={()=>navigator.clipboard.writeText(m.content)}
                            style={{background:'none',border:'none',cursor:'pointer',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.1em',color:'rgba(14,14,13,.28)',padding:'1px 6px',transition:'color .2s'}}
                            onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.color='#1c4a35'}}
                            onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.color='rgba(14,14,13,.28)'}}
                          >copiar</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {jurLoading && (
                    jurWebSearch
                      ? <div style={{alignSelf:'flex-start',fontFamily:"'DM Mono',monospace",fontSize:'.48rem',letterSpacing:'.14em',textTransform:'uppercase',color:'#c9a96e',padding:'10px 18px',background:'rgba(201,169,110,.08)',borderLeft:'3px solid #c9a96e',animation:'pulse 1.5s ease-in-out infinite'}}>
                          A consultar fontes actuais...
                        </div>
                      : <div style={{alignSelf:'flex-start',background:'#fff',padding:'14px 18px',borderLeft:'3px solid #c9a96e',display:'flex',gap:'4px',alignItems:'center'}}>
                          {[0,1,2].map(i=>(
                            <div key={i} style={{width:'5px',height:'5px',background:'rgba(14,14,13,.25)',borderRadius:'50%',animation:`jdot 1.2s ease-in-out ${i*0.2}s infinite`}}/>
                          ))}
                        </div>
                  )}

                  <div data-jur-bottom ref={el=>{ if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth'}),50) }}/>
                </div>

                {/* Disclaimer */}
                <div style={{padding:'5px 32px',background:'#0c1f15',textAlign:'center',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.12em',color:'rgba(244,240,230,.22)',flexShrink:0}}>
                  Informação jurídica para apoio a agentes · Não substitui aconselhamento jurídico profissional · AMI 22506
                </div>

                {/* Input */}
                <div style={{padding:'12px 20px',background:'#fff',borderTop:'2px solid #1c4a35',display:'flex',gap:'8px',flexShrink:0,alignItems:'flex-end'}}>
                  {/* Mode toggle */}
                  <div style={{display:'flex',flexDirection:'column',gap:'3px',flexShrink:0}}>
                    {(['rapido','memo'] as const).map(m=>(
                      <button key={m} onClick={()=>setJurMode(m)}
                        style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.08em',padding:'3px 8px',border:'1px solid',cursor:'pointer',transition:'all .2s',
                          ...(jurMode===m
                            ? {background: m==='memo' ? '#c9a96e' : '#1c4a35', color:'#fff', borderColor: m==='memo' ? '#c9a96e' : '#1c4a35'}
                            : {background:'transparent', color:'rgba(14,14,13,.4)', borderColor:'rgba(14,14,13,.15)'})
                        }}
                      >{m==='rapido'?'⚡ Rápido':'📄 Memo'}</button>
                    ))}
                  </div>
                  <textarea
                    value={jurInput}
                    onChange={e=>setJurInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarJuridico()}}}
                    placeholder={jurMode==='memo' ? 'Descreva o caso para memo jurídico completo... (Enter envia · Shift+Enter nova linha)' : 'Questão jurídica ou processual... (Enter envia · Shift+Enter nova linha)'}
                    disabled={jurLoading}
                    rows={2}
                    style={{flex:1,border:'none',borderBottom:`2px solid rgba(14,14,13,.1)`,background:'transparent',fontFamily:"'Jost',sans-serif",fontSize:'.84rem',color:'#0e0e0d',padding:'6px 0',outline:'none',transition:'border-color .25s',resize:'none',lineHeight:1.5}}
                    onFocus={e=>{e.currentTarget.style.borderBottomColor='#1c4a35'}}
                    onBlur={e=>{e.currentTarget.style.borderBottomColor='rgba(14,14,13,.1)'}}
                  />
                  <button
                    onClick={()=>enviarJuridico()}
                    disabled={jurLoading || !jurInput.trim()}
                    className="p-btn"
                    style={{padding:'10px 22px',fontSize:'.56rem',flexShrink:0,alignSelf:'flex-end'}}
                  >{jurLoading?'..':'Enviar →'}</button>
                </div>

              </div>
            )}

            {/* ── IMÓVEIS ── */}
            {section==='imoveis' && (
              <div style={{}}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px', flexWrap:'wrap', gap:'16px' }}>
                  <div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.42rem', letterSpacing:'.2em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'6px' }}>Gestão de Carteira</div>
                    <h2 style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'2rem', color:'#f4f0e6' }}>Imóveis</h2>
                  </div>
                  <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    {([['lista','Carteira'],['adicionar','+ Adicionar'],['stats','Estatísticas'],['comparar','⇄ Comparar']] as const).map(([t,l]) => (
                      <button key={t} onClick={() => setImoveisTab(t)} style={{ background: imoveisTab===t ? '#c9a96e' : 'rgba(201,169,110,.1)', color: imoveisTab===t ? '#0c1f15' : '#c9a96e', border:'1px solid rgba(201,169,110,.3)', padding:'8px 20px', fontFamily:"'DM Mono',monospace", fontSize:'.4rem', letterSpacing:'.12em', textTransform:'uppercase', cursor:'pointer' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LISTA TAB */}
                {imoveisTab === 'lista' && (
                  <div>
                    {/* Stats bar */}
                    {(() => {
                      const today = new Date()
                      const staleCount = imoveisList.filter(p => {
                        const ld = (p as Record<string,unknown>).listingDate as string|undefined
                        if (!ld) return false
                        return Math.floor((today.getTime() - new Date(ld).getTime()) / 86400000) > 60
                      }).length
                      return (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'16px', marginBottom:'24px' }}>
                          {[
                            { label:'Total Carteira', value: imoveisList.length.toString(), color:'#c9a96e', alert:false },
                            { label:'Valor Total', value: '€' + (imoveisList.reduce((s,p) => s+p.preco,0)/1000000).toFixed(1) + 'M', color:'#c9a96e', alert:false },
                            { label:'Off-Market', value: imoveisList.filter(p => p.badge==='Off-Market').length.toString(), color:'#c9a96e', alert:false },
                            { label:'Exclusivos', value: imoveisList.filter(p => p.badge==='Exclusivo').length.toString(), color:'#c9a96e', alert:false },
                            { label:'Stale >60d', value: staleCount.toString(), color: staleCount > 0 ? '#e05454' : '#c9a96e', alert: staleCount > 0 },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.alert ? 'rgba(224,84,84,.06)' : 'rgba(201,169,110,.06)', border:`1px solid ${s.alert ? 'rgba(224,84,84,.2)' : 'rgba(201,169,110,.12)'}`, padding:'20px', borderTop:`2px solid ${s.color}` }}>
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', color: s.alert ? 'rgba(224,84,84,.6)' : 'rgba(244,240,230,.4)', marginBottom:'8px', textTransform:'uppercase' }}>{s.label}</div>
                              <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.8rem', color: s.color, fontWeight:300 }}>{s.value}</div>
                              {s.alert && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(224,84,84,.6)',marginTop:'4px'}}>Rever preço / estratégia</div>}
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Search + Filter bar */}
                    <div style={{ display:'flex', gap:'12px', marginBottom:'24px', flexWrap:'wrap', alignItems:'center' }}>
                      <input value={imoveisSearch} onChange={e => setImoveisSearch(e.target.value)} placeholder="Pesquisar imóvel..." style={{ flex:1, minWidth:'200px', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none' }} />
                      <select value={imoveisZona} onChange={e => setImoveisZona(e.target.value)} style={{ background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', cursor:'pointer' }}>
                        <option value=''>Todas as zonas</option>
                        {['Lisboa','Cascais','Comporta','Porto','Algarve','Madeira','Sintra','Ericeira'].map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                      <button onClick={()=>setImoveisStaleOnly(s=>!s)} style={{padding:'10px 16px',background:imoveisStaleOnly?'rgba(224,84,84,.15)':'rgba(244,240,230,.05)',border:`1px solid ${imoveisStaleOnly?'rgba(224,84,84,.4)':'rgba(201,169,110,.2)'}`,color:imoveisStaleOnly?'#e05454':'rgba(244,240,230,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.08em',cursor:'pointer',whiteSpace:'nowrap' as const}}>
                        ⚠ Stale {imoveisStaleOnly ? '✓' : ''}
                      </button>
                    </div>

                    {/* Properties grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px,1fr))', gap:'20px' }}>
                      {imoveisList
                        .filter(p => {
                          const matchSearch = !imoveisSearch || p.nome.toLowerCase().includes(imoveisSearch.toLowerCase()) || p.bairro.toLowerCase().includes(imoveisSearch.toLowerCase())
                          const matchZona = !imoveisZona || p.zona === imoveisZona
                          const ld = (p as Record<string,unknown>).listingDate as string|undefined
                          const daysListed = ld ? Math.floor((Date.now() - new Date(ld).getTime()) / 86400000) : 0
                          const matchStale = !imoveisStaleOnly || daysListed > 60
                          return matchSearch && matchZona && matchStale
                        })
                        .map(p => (
                          <div key={p.id} style={{ background:'rgba(244,240,230,.04)', border:'1px solid rgba(201,169,110,.12)', position:'relative', overflow:'hidden' }}>
                            {/* Hero photo */}
                            {((p as Record<string,unknown>).heroPhoto || ((p as Record<string,unknown>).photos as string[])?.[0]) ? (
                              <div onClick={() => setShowcaseImovel(p as Record<string,unknown>)} style={{ position:'relative', height:'180px', overflow:'hidden', cursor:'pointer' }}>
                                <img src={((p as Record<string,unknown>).heroPhoto || ((p as Record<string,unknown>).photos as string[])?.[0]) as string} alt={p.nome} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .4s' }} onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1.05)'} onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1)'} />
                                <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(12,31,21,.7))' }} />
                                <div style={{ position:'absolute', top:'10px', right:'10px', background:'rgba(12,31,21,.7)', backdropFilter:'blur(4px)', color:'rgba(244,240,230,.6)', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.08em', padding:'3px 8px' }}>
                                  {((p as Record<string,unknown>).photos as string[])?.length || 1} fotos
                                </div>
                                {p.badge && <div style={{ position:'absolute', top:'10px', left:'10px', background: p.badge==='Off-Market' ? '#c9a96e' : p.badge==='Exclusivo' ? '#1c4a35' : 'rgba(201,169,110,.2)', color: p.badge==='Off-Market' ? '#0c1f15' : '#c9a96e', fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.1em', padding:'4px 10px', textTransform:'uppercase' }}>{p.badge}</div>}
                              </div>
                            ) : (
                              <div onClick={() => setShowcaseImovel(p as Record<string,unknown>)} style={{ height:'140px', background:'rgba(12,31,21,.4)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                                <svg width="32" height="32" fill="none" stroke="rgba(201,169,110,.2)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                                {p.badge && <div style={{ position:'absolute', top:'10px', right:'10px', background: p.badge==='Off-Market' ? '#c9a96e' : p.badge==='Exclusivo' ? '#1c4a35' : 'rgba(201,169,110,.2)', color: p.badge==='Off-Market' ? '#0c1f15' : '#c9a96e', fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.1em', padding:'4px 10px', textTransform:'uppercase' }}>{p.badge}</div>}
                              </div>
                            )}
                            <div style={{ padding:'20px' }}>
                            {(() => {
                              const ld = (p as Record<string,unknown>).listingDate as string|undefined
                              const daysListed = ld ? Math.floor((Date.now() - new Date(ld).getTime()) / 86400000) : null
                              const isStale = daysListed !== null && daysListed > 60
                              const isWarm = daysListed !== null && daysListed > 30 && !isStale
                              return (
                                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px',flexWrap:'wrap'}}>
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.3)', letterSpacing:'.1em' }}>{p.ref}</div>
                                  {isStale && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 7px',background:'rgba(224,84,84,.12)',color:'#e05454',border:'1px solid rgba(224,84,84,.25)',letterSpacing:'.08em'}}>⚠ {daysListed}d STALE</div>}
                                  {isWarm && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',padding:'2px 7px',background:'rgba(249,115,22,.08)',color:'#f97316',border:'1px solid rgba(249,115,22,.2)',letterSpacing:'.08em'}}>{daysListed}d mercado</div>}
                                  {!isStale && !isWarm && daysListed !== null && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.3rem',color:'rgba(244,240,230,.25)'}}>{daysListed}d</div>}
                                </div>
                              )
                            })()}
                            <div style={{ fontFamily:"'Cormorant',serif", fontWeight:400, fontSize:'1.15rem', color:'#f4f0e6', marginBottom:'4px', paddingRight:'80px' }}>{p.nome}</div>
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)', marginBottom:'16px' }}>{p.bairro} · {p.zona}</div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
                              <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.4rem', color:'#c9a96e', fontWeight:300, lineHeight:1 }}>€{(p.preco/1000000).toFixed(p.preco>=1000000?1:0)}{p.preco>=1000000?'M':''}</div>
                              {/* Buyer match count */}
                              {(() => {
                                const matchCount = crmContacts.filter(c => {
                                  const budgetOk = Number(c.budgetMin) <= p.preco && p.preco <= Number(c.budgetMax) * 1.2
                                  const zonaOk = !c.zonas || c.zonas.length === 0 || c.zonas.some((z:string) => z.includes(p.zona) || p.zona.includes(z.split('—')[0].trim()))
                                  const tipoOk = !c.tipos || c.tipos.length === 0 || c.tipos.includes(p.tipo)
                                  return budgetOk && (zonaOk || tipoOk)
                                }).length
                                if (matchCount === 0) return null
                                return (
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',padding:'3px 8px',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.25)',color:'#10b981',letterSpacing:'.06em',cursor:'pointer'}}
                                    onClick={()=>setSection('crm')} title="Ver contactos correspondentes no CRM">
                                    👥 {matchCount} match{matchCount!==1?'es':''}
                                  </div>
                                )
                              })()}
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.34rem',color:'rgba(244,240,230,.3)'}}>€{Math.round(p.preco/p.area).toLocaleString('pt-PT')}/m²</div>
                            </div>
                            <div style={{ display:'flex', gap:'16px', marginBottom:'16px', flexWrap:'wrap' }}>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.4)' }}>{p.area}m²</span>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.4)' }}>T{p.quartos}</span>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.4)' }}>{p.tipo}</span>
                              {p.piscina && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)' }}>Piscina</span>}
                              {p.garagem && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)' }}>Garagem</span>}
                            </div>
                            <div style={{ display:'flex', gap:'8px' }}>
                              <button onClick={() => setShowcaseImovel(p as Record<string,unknown>)} style={{ flex:1, background:'rgba(201,169,110,.1)', color:'#c9a96e', border:'1px solid rgba(201,169,110,.2)', padding:'8px', fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.1em', cursor:'pointer' }}>Showcase ↗</button>
                              <a href={`/imoveis/${p.id}`} target='_blank' rel='noopener' style={{ flex:1, background:'rgba(201,169,110,.1)', color:'#c9a96e', border:'1px solid rgba(201,169,110,.2)', padding:'8px', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.1em', textDecoration:'none', display:'block' }}>Ver Página →</a>
                              <button onClick={() => { const updated = imoveisList.map(im => im.id===p.id ? {...im, status: im.status==='Ativo'?'Vendido':'Ativo'} : im); saveImoveis(updated) }} style={{ background: p.status==='Ativo'?'rgba(44,122,86,.2)':'rgba(201,169,110,.08)', color: p.status==='Ativo'?'#2d7a56':'rgba(244,240,230,.4)', border:`1px solid ${p.status==='Ativo'?'rgba(44,122,86,.4)':'rgba(244,240,230,.1)'}`, padding:'8px 12px', fontFamily:"'DM Mono',monospace", fontSize:'.35rem', cursor:'pointer', letterSpacing:'.08em' }}>{p.status==='Ativo'?'Ativo':'Vendido'}</button>
                            </div>
                            {/* Price reduction tip for stale properties */}
                            {(() => {
                              const ld = (p as Record<string,unknown>).listingDate as string|undefined
                              const days = ld ? Math.floor((Date.now() - new Date(ld).getTime()) / 86400000) : 0
                              if (days < 60) return null
                              const pctSug = days > 90 ? 8 : days > 75 ? 5 : 3
                              const newPrice = Math.round(p.preco * (1 - pctSug/100) / 1000) * 1000
                              return (
                                <div style={{marginTop:'10px',padding:'10px 12px',background:'rgba(249,115,22,.06)',border:'1px solid rgba(249,115,22,.18)',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                                  <div style={{fontSize:'.75rem',flexShrink:0,marginTop:'1px'}}>💡</div>
                                  <div style={{flex:1}}>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.35rem',color:'#f97316',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'3px'}}>Sugestão Estratégica</div>
                                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.75rem',color:'rgba(244,240,230,.65)',lineHeight:1.4}}>{days}d mercado — redução de <strong style={{color:'#f97316'}}>{pctSug}%</strong> sugerida. Novo preço: <strong style={{color:'#c9a96e'}}>€{newPrice.toLocaleString('pt-PT')}</strong></div>
                                  </div>
                                  <button style={{flexShrink:0,background:'rgba(249,115,22,.12)',border:'1px solid rgba(249,115,22,.25)',color:'#f97316',padding:'4px 8px',fontFamily:"'DM Mono',monospace",fontSize:'.34rem',cursor:'pointer',letterSpacing:'.06em'}}
                                    onClick={()=>{ const updated = imoveisList.map(im => im.id===p.id ? {...im,preco:newPrice}:im); saveImoveis(updated) }}>
                                    Aplicar
                                  </button>
                                </div>
                              )
                            })()}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ADICIONAR TAB — AI PUBLISHER */}
                {imoveisTab === 'adicionar' && (
                  <div style={{ maxWidth:'900px' }}>
                    {/* Stepper */}
                    <div style={{ display:'flex', gap:'0', marginBottom:'40px', position:'relative' }}>
                      <div style={{ position:'absolute', top:'16px', left:'12%', right:'12%', height:'2px', background:'rgba(201,169,110,.15)', zIndex:0 }} />
                      {[
                        { n:1, label:'Fotos' },
                        { n:2, label:'AI Análise' },
                        { n:3, label:'Detalhes' },
                        { n:4, label:'Publicar' },
                      ].map(s => (
                        <div key={s.n} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', cursor: s.n < publishStep ? 'pointer' : 'default', position:'relative', zIndex:1 }} onClick={() => s.n < publishStep && setPublishStep(s.n as 1|2|3|4)}>
                          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background: publishStep >= s.n ? '#c9a96e' : 'rgba(201,169,110,.1)', border: publishStep >= s.n ? 'none' : '1px solid rgba(201,169,110,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", fontSize:'.45rem', color: publishStep >= s.n ? '#0c1f15' : 'rgba(201,169,110,.4)', fontWeight:700, transition:'all .3s' }}>{s.n}</div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.35rem', letterSpacing:'.12em', textTransform:'uppercase', color: publishStep >= s.n ? '#c9a96e' : 'rgba(201,169,110,.3)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {imovelSaved && <div style={{ background:'rgba(44,122,86,.15)', border:'1px solid rgba(44,122,86,.4)', color:'#2d7a56', padding:'16px', fontFamily:"'Jost',sans-serif", marginBottom:'24px', borderRadius:'4px', display:'flex', alignItems:'center', gap:'12px' }}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      Imóvel publicado com sucesso!
                    </div>}

                    {/* STEP 1: UPLOAD PHOTOS */}
                    {publishStep === 1 && (
                      <div>
                        <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'1.6rem', color:'#f4f0e6', marginBottom:'8px' }}>Upload de Fotografias</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.4)', marginBottom:'28px' }}>A AI vai analisar cada foto, identificar o espaço e escolher a melhor foto principal automaticamente.</div>

                        {/* Drop zone */}
                        <label htmlFor="photo-upload" style={{ display:'block', border:'2px dashed rgba(201,169,110,.3)', borderRadius:'4px', padding:'48px', textAlign:'center', cursor:'pointer', marginBottom:'24px', transition:'border-color .2s', background:'rgba(201,169,110,.02)' }}
                          onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor='#c9a96e' }}
                          onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(201,169,110,.3)' }}
                          onDrop={e => {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).style.borderColor='rgba(201,169,110,.3)'
                            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                            files.forEach(file => {
                              const reader = new FileReader()
                              reader.onload = ev => {
                                const dataUrl = ev.target?.result as string
                                setAiPhotos(prev => [...prev, { url: dataUrl, b64: dataUrl }])
                              }
                              reader.readAsDataURL(file)
                            })
                          }}>
                          <input id="photo-upload" type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e => {
                            const files = Array.from(e.target.files || [])
                            files.forEach(file => {
                              const reader = new FileReader()
                              reader.onload = ev => {
                                const dataUrl = ev.target?.result as string
                                setAiPhotos(prev => [...prev, { url: dataUrl, b64: dataUrl }])
                              }
                              reader.readAsDataURL(file)
                            })
                          }} />
                          <svg width="40" height="40" fill="none" stroke="rgba(201,169,110,.4)" viewBox="0 0 24 24" style={{ margin:'0 auto 16px' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.2rem', color:'rgba(244,240,230,.6)', marginBottom:'8px' }}>Arraste as fotos aqui</div>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', color:'rgba(201,169,110,.5)', textTransform:'uppercase' }}>ou clique para selecionar · JPG, PNG, WebP · Múltiplas fotos</div>
                        </label>

                        {/* Photo previews */}
                        {aiPhotos.length > 0 && (
                          <div>
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', marginBottom:'16px' }}>{aiPhotos.length} foto{aiPhotos.length>1?'s':''} selecionada{aiPhotos.length>1?'s':''}</div>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'8px', marginBottom:'24px' }}>
                              {aiPhotos.map((p, i) => (
                                <div key={i} style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden', background:'rgba(0,0,0,.3)' }}>
                                  <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  <button onClick={() => setAiPhotos(prev => prev.filter((_,idx) => idx !== i))} style={{ position:'absolute', top:'4px', right:'4px', background:'rgba(0,0,0,.7)', border:'none', color:'#fff', width:'20px', height:'20px', borderRadius:'50%', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>×</button>
                                </div>
                              ))}
                            </div>

                            <button onClick={async () => {
                              setAiAnalyzing(true)
                              try {
                                const r = await fetch('/api/properties/analyze-photos', {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({ photos: aiPhotos.map(p => p.b64) })
                                })
                                const d = await r.json()
                                if (d.analyses) {
                                  setAiPhotos(prev => prev.map((p, i) => ({ ...p, analysis: d.analyses.find((a: Record<string,unknown>) => a.index === i) })))
                                  setAiHeroIndex(d.heroIndex || 0)
                                  setAiSummary(d.summary || null)
                                  setPublishStep(2)
                                }
                              } catch(e) { console.error(e) }
                              setAiAnalyzing(false)
                            }} disabled={aiAnalyzing} style={{ background: aiAnalyzing ? 'rgba(201,169,110,.3)' : '#c9a96e', color:'#0c1f15', border:'none', padding:'14px 40px', fontFamily:"'DM Mono',monospace", fontSize:'.44rem', letterSpacing:'.15em', textTransform:'uppercase', cursor: aiAnalyzing ? 'not-allowed' : 'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:'12px' }}>
                              {aiAnalyzing ? (
                                <>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
                                  A Analisar com Claude AI...
                                </>
                              ) : (
                                <>
                                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                                  Analisar Fotos com Claude AI
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 2: AI PHOTO ANALYSIS — WORLD CLASS */}
                    {publishStep === 2 && (
                      <div>
                        <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'1.6rem', color:'#f4f0e6', marginBottom:'8px' }}>Análise AI das Fotografias</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.4)', marginBottom:'24px' }}>Claude Vision analisou cada fotografia. Clique para definir foto principal. Setas para reordenar.</div>

                        {/* Quality Summary Dashboard */}
                        {aiSummary && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'24px' }}>
                            {[
                              { label:'Qualidade Média', value: `${(aiSummary as Record<string,unknown>).avgQuality}/10`, color: Number((aiSummary as Record<string,unknown>).avgQuality) >= 7.5 ? '#4a9c7a' : Number((aiSummary as Record<string,unknown>).avgQuality) >= 5.5 ? '#c9a96e' : '#e87070' },
                              { label:'Grau', value: String((aiSummary as Record<string,unknown>).qualityGrade), color: '#c9a96e' },
                              { label:'Foto Hero', value: `${(aiSummary as Record<string,unknown>).heroQuality}/10`, color: Number((aiSummary as Record<string,unknown>).heroQuality) >= 7 ? '#4a9c7a' : '#e87070' },
                              { label:'Precisam Melhoria', value: String((aiSummary as Record<string,unknown>).photosNeedingWork), color: Number((aiSummary as Record<string,unknown>).photosNeedingWork) > 0 ? '#e87070' : '#4a9c7a' },
                              { label:'Candidatas Staging', value: String((aiSummary as Record<string,unknown>).stagingCandidates), color: Number((aiSummary as Record<string,unknown>).stagingCandidates) > 0 ? '#c9a96e' : 'rgba(244,240,230,.4)' },
                            ].map(s => (
                              <div key={s.label} style={{ background:'rgba(244,240,230,.04)', border:'1px solid rgba(201,169,110,.1)', padding:'14px', textAlign:'center' }}>
                                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(244,240,230,.3)', marginBottom:'6px' }}>{s.label}</div>
                                <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.3rem', color: s.color }}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quality Gate Warning */}
                        {aiSummary && Number((aiSummary as Record<string,unknown>).heroQuality) < 7 && (
                          <div style={{ background:'rgba(232,112,112,.08)', border:'1px solid rgba(232,112,112,.3)', borderLeft:'3px solid #e87070', padding:'14px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px' }}>
                            <svg width="16" height="16" fill="none" stroke="#e87070" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            <span style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(232,112,112,.9)' }}>
                              Foto principal com qualidade {(aiSummary as Record<string,unknown>).heroQuality}/10 — abaixo do standard profissional (7+). Recomendamos substituir antes de publicar.
                            </span>
                          </div>
                        )}

                        {/* Staging Recommendations */}
                        {aiSummary && Number((aiSummary as Record<string,unknown>).stagingCandidates) > 0 && (
                          <div style={{ background:'rgba(74,156,122,.06)', border:'1px solid rgba(74,156,122,.25)', borderLeft:'3px solid #4a9c7a', padding:'14px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px' }}>
                            <svg width="16" height="16" fill="none" stroke="#4a9c7a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                            <span style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(74,156,122,.9)' }}>
                              {(aiSummary as Record<string,unknown>).stagingCandidates} divisão(ões) identificadas como candidatas a virtual staging — aumenta valor percebido em 15-20%.
                            </span>
                          </div>
                        )}

                        {/* Hero photo highlight */}
                        {aiPhotos[aiHeroIndex] && (
                          <div style={{ marginBottom:'28px', position:'relative', overflow:'hidden', background:'rgba(0,0,0,.4)', cursor:'pointer' }} onClick={() => openLightbox(aiPhotos.map(p => ({ url: p.url, label: String((p.analysis as Record<string,unknown>)?.roomType || '') })), aiHeroIndex)}>
                            <img src={aiPhotos[aiHeroIndex].url} alt="" style={{ width:'100%', maxHeight:'420px', objectFit:'cover' }} />
                            <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 55%, rgba(0,0,0,.75))' }} />
                            <div style={{ position:'absolute', top:'16px', left:'16px', background:'#c9a96e', color:'#0c1f15', fontFamily:"'DM Mono',monospace", fontSize:'.36rem', letterSpacing:'.14em', textTransform:'uppercase', padding:'6px 16px', fontWeight:700 }}>★ Foto Principal · AI Selection</div>
                            <div style={{ position:'absolute', top:'16px', right:'16px', background:'rgba(0,0,0,.5)', color:'rgba(244,240,230,.7)', fontFamily:"'DM Mono',monospace", fontSize:'.34rem', padding:'4px 10px', letterSpacing:'.08em' }}>🔍 Ver em grande</div>
                            {aiPhotos[aiHeroIndex].analysis && (
                              <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px 20px 16px' }}>
                                <div style={{ display:'flex', gap:'16px', alignItems:'center', marginBottom:'8px' }}>
                                  <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.2rem', color:'#f4f0e6' }}>{String((aiPhotos[aiHeroIndex].analysis as Record<string,unknown>)?.roomType || '')}</div>
                                  {['qualityScore','heroScore','lightingScore'].map(k => (
                                    <div key={k} style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.06em', background:'rgba(0,0,0,.4)', padding:'3px 8px' }}>
                                      <span style={{ color:'rgba(244,240,230,.35)' }}>{k==='qualityScore'?'QLD':k==='heroScore'?'HERO':'LIGHT'} </span>
                                      <span style={{ color: Number((aiPhotos[aiHeroIndex].analysis as Record<string,unknown>)?.[k]) >= 7 ? '#4a9c7a' : '#c9a96e' }}>{String((aiPhotos[aiHeroIndex].analysis as Record<string,unknown>)?.[k])}/10</span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                  {((aiPhotos[aiHeroIndex].analysis as Record<string,unknown>)?.highlights as string[] || []).map((h,i) => (
                                    <span key={i} style={{ background:'rgba(201,169,110,.2)', color:'#c9a96e', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.06em', padding:'3px 8px' }}>{h}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sequence + grid header */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.36rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.35)' }}>
                            {aiPhotos.length} Fotografias · Clique = foto principal · ↕ Reordenar
                          </div>
                          {aiSummary && (aiSummary as Record<string,unknown>).recommendedSequence && (
                            <button onClick={() => {
                              const seq = (aiSummary as Record<string,unknown>).recommendedSequence as number[]
                              if (seq) setAiPhotos(prev => seq.map(i => prev[i]).filter(Boolean))
                            }} style={{ background:'rgba(201,169,110,.1)', color:'#c9a96e', border:'1px solid rgba(201,169,110,.3)', padding:'6px 16px', fontFamily:"'DM Mono',monospace", fontSize:'.34rem', letterSpacing:'.1em', cursor:'pointer', textTransform:'uppercase' }}>
                              ✦ Aplicar Sequência AI
                            </button>
                          )}
                        </div>

                        {/* Photos grid */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px,1fr))', gap:'10px', marginBottom:'32px' }}>
                          {aiPhotos.map((p, i) => {
                            const a = p.analysis as Record<string,unknown> | undefined
                            const qScore = Number(a?.qualityScore || 0)
                            const hScore = Number(a?.heroScore || 0)
                            const isHero = i === aiHeroIndex
                            const hasIssues = (a?.conditionIssues as string[] || []).length > 0
                            const needsStaging = a?.stagingNeeded === true
                            const luxuries = (a?.luxuryIndicators as string[] || [])
                            return (
                              <div key={i} style={{ border: isHero ? '2px solid #c9a96e' : hasIssues ? '2px solid rgba(232,112,112,.4)' : '2px solid rgba(244,240,230,.06)', overflow:'hidden', background:'rgba(0,0,0,.3)', transition:'border-color .2s', position:'relative', cursor:'pointer' }}
                                onClick={() => setAiHeroIndex(i)}>
                                <div style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden' }}>
                                  <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .3s', filter: isHero ? 'none' : 'brightness(0.78)' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1.06)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1)'}
                                    onClick={e => { e.stopPropagation(); openLightbox(aiPhotos.map(ph => ({ url: ph.url, label: String((ph.analysis as Record<string,unknown>)?.roomType || '') })), i) }}
                                  />
                                  {isHero && <div style={{ position:'absolute', top:'6px', right:'6px', background:'#c9a96e', color:'#0c1f15', width:'22px', height:'22px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700 }}>★</div>}
                                  {needsStaging && !isHero && <div style={{ position:'absolute', top:'6px', left:'6px', background:'rgba(74,156,122,.8)', color:'#fff', fontFamily:"'DM Mono',monospace", fontSize:'.28rem', letterSpacing:'.06em', padding:'2px 6px' }}>STAGING</div>}
                                  {hasIssues && <div style={{ position:'absolute', bottom:'6px', right:'6px', background:'rgba(232,112,112,.8)', color:'#fff', fontFamily:"'DM Mono',monospace", fontSize:'.28rem', letterSpacing:'.06em', padding:'2px 6px' }}>⚠</div>}
                                  {/* Reorder arrows */}
                                  <div style={{ position:'absolute', top:'50%', left:0, right:0, transform:'translateY(-50%)', display:'flex', justifyContent:'space-between', padding:'0 4px', opacity:0, transition:'opacity .2s' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='1'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='0'}>
                                    {i > 0 && <button onClick={e => { e.stopPropagation(); setAiPhotos(prev => { const arr=[...prev]; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; if(aiHeroIndex===i)setAiHeroIndex(i-1); else if(aiHeroIndex===i-1)setAiHeroIndex(i); return arr }) }} style={{ background:'rgba(0,0,0,.7)', border:'none', color:'#fff', width:'28px', height:'28px', cursor:'pointer', fontSize:'14px' }}>←</button>}
                                    {i < aiPhotos.length-1 && <button onClick={e => { e.stopPropagation(); setAiPhotos(prev => { const arr=[...prev]; [arr[i],arr[i+1]]=[arr[i+1],arr[i]]; if(aiHeroIndex===i)setAiHeroIndex(i+1); else if(aiHeroIndex===i+1)setAiHeroIndex(i); return arr }) }} style={{ background:'rgba(0,0,0,.7)', border:'none', color:'#fff', width:'28px', height:'28px', cursor:'pointer', fontSize:'14px', marginLeft:'auto' }}>→</button>}
                                  </div>
                                </div>
                                <div style={{ padding:'8px 10px', background:'rgba(12,31,21,.95)' }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px' }}>
                                    <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.78rem', color:'#f4f0e6', fontWeight:500, lineHeight:1.2 }}>{String(a?.roomType || '—')}</div>
                                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.28rem', color:'rgba(244,240,230,.25)', flexShrink:0 }}>#{i+1}</div>
                                  </div>
                                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.04em', color: qScore >= 8 ? '#4a9c7a' : qScore >= 6 ? '#c9a96e' : '#e87070' }}>Q {qScore}/10</span>
                                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.04em', color: hScore >= 8 ? '#4a9c7a' : hScore >= 6 ? '#c9a96e' : '#e87070' }}>H {hScore}/10</span>
                                    {(a?.lightingScore as number) > 0 && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.04em', color:'rgba(244,240,230,.35)' }}>L {String(a?.lightingScore)}/10</span>}
                                  </div>
                                  {luxuries.length > 0 && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.28rem', color:'rgba(201,169,110,.5)', marginTop:'4px', textTransform:'uppercase', letterSpacing:'.06em' }}>{luxuries.slice(0,2).join(' · ')}</div>}
                                  {hasIssues && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.28rem', color:'rgba(232,112,112,.7)', marginTop:'3px' }}>⚠ {(a?.conditionIssues as string[]).slice(0,2).join(', ')}</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <button onClick={() => setPublishStep(3)} style={{ background:'#c9a96e', color:'#0c1f15', border:'none', padding:'14px 40px', fontFamily:"'DM Mono',monospace", fontSize:'.44rem', letterSpacing:'.15em', textTransform:'uppercase', cursor:'pointer', fontWeight:600 }}>
                          Continuar → Detalhes do Imóvel
                        </button>
                      </div>
                    )}

                    {/* STEP 3: PROPERTY DETAILS + AI DESCRIPTION */}
                    {publishStep === 3 && (
                      <div>
                        <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'1.6rem', color:'#f4f0e6', marginBottom:'8px' }}>Detalhes + Descrição AI</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.4)', marginBottom:'28px' }}>Preencha os dados do imóvel. A AI gera a descrição com neuromarketing de elite.</div>

                        {/* Form */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                          {[
                            { label:'Nome do Imóvel', key:'nome', placeholder:'Villa Quinta da Marinha' },
                            { label:'Bairro / Localização', key:'bairro', placeholder:'Príncipe Real' },
                          ].map(f => (
                            <div key={f.key}>
                              <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>{f.label}</label>
                              <input value={(newImovel as Record<string,unknown>)[f.key] as string} onChange={e => setNewImovel(prev => ({...prev, [f.key]: e.target.value}))} placeholder={f.placeholder} style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                          <div>
                            <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>Zona</label>
                            <select value={newImovel.zona} onChange={e => setNewImovel(p => ({...p, zona:e.target.value}))} style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }}>
                              {['Lisboa','Cascais','Comporta','Porto','Algarve','Madeira','Sintra','Ericeira'].map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>Tipo</label>
                            <select value={newImovel.tipo} onChange={e => setNewImovel(p => ({...p, tipo:e.target.value}))} style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }}>
                              {['Apartamento','Moradia','Villa','Herdade','Quinta','Terreno'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>Badge</label>
                            <select value={newImovel.badge} onChange={e => setNewImovel(p => ({...p, badge:e.target.value}))} style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }}>
                              <option value=''>Nenhum</option>
                              {['Destaque','Novo','Exclusivo','Off-Market'].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                          {[
                            { label:'Preço (€)', key:'preco', placeholder:'1500000' },
                            { label:'Área (m²)', key:'area', placeholder:'200' },
                            { label:'Quartos', key:'quartos', placeholder:'3' },
                            { label:'Casas de Banho', key:'casasBanho', placeholder:'2' },
                            { label:'Andar', key:'andar', placeholder:'4º' },
                          ].map(f => (
                            <div key={f.key}>
                              <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>{f.label}</label>
                              <input type={f.key==='andar'?'text':'number'} value={(newImovel as Record<string,unknown>)[f.key] as string|number} onChange={e => setNewImovel(prev => ({...prev, [f.key]: f.key==='andar' ? e.target.value : Number(e.target.value)}))} placeholder={f.placeholder} style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                          <div>
                            <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>Vista</label>
                            <input value={newImovel.vista} onChange={e => setNewImovel(p => ({...p, vista:e.target.value}))} placeholder='Mar, Rio, Serra, Cidade...' style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                          <div>
                            <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>URL Tour Virtual</label>
                            <input value={newImovel.tourUrl} onChange={e => setNewImovel(p => ({...p, tourUrl:e.target.value}))} placeholder='https://...' style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', boxSizing:'border-box' as const }} />
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'20px', marginBottom:'24px', flexWrap:'wrap' }}>
                          {[{k:'piscina',l:'Piscina'},{k:'garagem',l:'Garagem'},{k:'jardim',l:'Jardim'},{k:'terraco',l:'Terraço'},{k:'condominio',l:'Condomínio'}].map(f => (
                            <label key={f.k} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.7)' }}>
                              <input type='checkbox' checked={(newImovel as Record<string,unknown>)[f.k] as boolean} onChange={e => setNewImovel(p => ({...p, [f.k]:e.target.checked}))} />
                              {f.l}
                            </label>
                          ))}
                        </div>

                        {/* AI Description Generator */}
                        <div style={{ background:'rgba(28,74,53,.1)', border:'1px solid rgba(28,74,53,.4)', borderLeft:'3px solid #1c4a35', padding:'24px', marginBottom:'24px' }}>
                          {/* Header row */}
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', gap:'16px', flexWrap:'wrap' }}>
                            <div>
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.15em', textTransform:'uppercase', color:'#4a9c7a', marginBottom:'4px' }}>Claude AI · Sotheby&apos;s-Level Copy Engine</div>
                              <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.1rem', color:'#f4f0e6' }}>Descrição Multi-Formato com Contexto de Mercado</div>
                            </div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                              {/* Persona selector */}
                              <select value={descPersona} onChange={e => setDescPersona(e.target.value)} style={{ background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', padding:'8px 12px', fontFamily:"'DM Mono',monospace", fontSize:'.34rem', letterSpacing:'.08em', outline:'none', cursor:'pointer' }}>
                                {['HNWI Global','Americano','Francês','Britânico','Brasileiro','Investidor PT','Médio Oriente','Alemão','Chinês'].map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <button onClick={async () => {
                                if (!newImovel.nome || !newImovel.preco) { alert('Preencha pelo menos o nome e o preço primeiro.'); return }
                                setAiGenerating(true)
                                try {
                                  const r = await fetch('/api/properties/generate-description', {
                                    method:'POST',
                                    headers:{'Content-Type':'application/json'},
                                    body: JSON.stringify({
                                      property: newImovel,
                                      photoAnalyses: aiPhotos.map(p => p.analysis).filter(Boolean),
                                      persona: descPersona,
                                    })
                                  })
                                  const d = await r.json()
                                  if (d.description) {
                                    setAiDesc(d.description)
                                    setAiDescMeta(d.meta || null)
                                    setNewImovel(prev => ({ ...prev, desc: d.description.descriptionMain || prev.desc }))
                                  }
                                } catch(e) { console.error(e) }
                                setAiGenerating(false)
                              }} disabled={aiGenerating} style={{ background: aiGenerating ? 'rgba(74,156,122,.3)' : '#1c4a35', color:'#c9a96e', border:'1px solid rgba(201,169,110,.3)', padding:'10px 24px', fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', cursor: aiGenerating ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:'8px', whiteSpace:'nowrap' as const }}>
                                {aiGenerating ? (
                                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>A Gerar...</>
                                ) : '✦ Gerar com AI'}
                              </button>
                            </div>
                          </div>

                          {/* Market context pill */}
                          {aiDescMeta && (
                            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
                              {[
                                { label: (aiDescMeta as Record<string,unknown>).pricePositioning as string },
                                { label: `+${((aiDescMeta as Record<string,unknown>).zoneData as Record<string,unknown>)?.appreciation5y}% em 5 anos` },
                                { label: `Procura: ${((aiDescMeta as Record<string,unknown>).zoneData as Record<string,unknown>)?.demandLevel}` },
                                { label: `€${Number((aiDescMeta as Record<string,unknown>).pricePerM2).toLocaleString('pt-PT')}/m²` },
                              ].filter(b => b.label).map((b,i) => (
                                <span key={i} style={{ background:'rgba(201,169,110,.08)', color:'rgba(201,169,110,.7)', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.08em', padding:'4px 10px', border:'1px solid rgba(201,169,110,.15)' }}>{b.label}</span>
                              ))}
                            </div>
                          )}

                          {aiDesc && (
                            <div style={{ borderTop:'1px solid rgba(201,169,110,.15)', paddingTop:'20px' }}>
                              {/* Headline + subheadline */}
                              <div style={{ marginBottom:'20px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.4)' }}>Headline</div>
                                  <button onClick={() => copyToClipboard(`${aiDesc.headline}\n${aiDesc.subheadline}`, 'headline')} style={{ background:'none', border:'1px solid rgba(201,169,110,.2)', color:'rgba(201,169,110,.5)', fontFamily:"'DM Mono',monospace", fontSize:'.28rem', letterSpacing:'.06em', padding:'3px 8px', cursor:'pointer' }}>{copiedKey==='headline' ? '✓ Copiado' : 'Copiar'}</button>
                                </div>
                                <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.4rem', color:'#c9a96e', fontStyle:'italic', marginBottom:'6px' }}>{aiDesc.headline as string}</div>
                                <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.6)' }}>{aiDesc.subheadline as string}</div>
                              </div>

                              {/* Key Features */}
                              {Array.isArray(aiDesc.keyFeatures) && (
                                <div style={{ marginBottom:'20px' }}>
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'8px' }}>Features-Chave</div>
                                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                                    {(aiDesc.keyFeatures as string[]).map((f,i) => (
                                      <div key={i} style={{ display:'flex', gap:'8px', padding:'6px 8px', background:'rgba(244,240,230,.03)', border:'1px solid rgba(201,169,110,.1)' }}>
                                        <span style={{ color:'#c9a96e', flexShrink:0 }}>✦</span>
                                        <span style={{ fontFamily:"'Jost',sans-serif", fontSize:'.78rem', color:'rgba(244,240,230,.65)' }}>{f}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Multi-format tabs */}
                              <div style={{ marginTop:'20px' }}>
                                <div style={{ display:'flex', gap:'4px', marginBottom:'0', flexWrap:'wrap' }}>
                                  {([
                                    { id:'main', label:'📝 Descrição' },
                                    { id:'instagram', label:'📸 Instagram' },
                                    { id:'linkedin', label:'💼 LinkedIn' },
                                    { id:'whatsapp', label:'💬 WhatsApp' },
                                    { id:'email', label:'📧 Email' },
                                  ] as const).map(t => (
                                    <button key={t.id} onClick={() => setDescTab(t.id)} style={{ background: descTab===t.id ? 'rgba(201,169,110,.15)' : 'transparent', color: descTab===t.id ? '#c9a96e' : 'rgba(201,169,110,.4)', border:'1px solid rgba(201,169,110,.2)', borderBottom: descTab===t.id ? '1px solid rgba(28,74,53,.1)' : '1px solid rgba(201,169,110,.2)', padding:'7px 14px', fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.06em', cursor:'pointer', marginBottom:'-1px' }}>
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ background:'rgba(244,240,230,.02)', border:'1px solid rgba(201,169,110,.2)', padding:'16px', position:'relative' }}>
                                  <button onClick={() => {
                                    const txt = descTab==='main' ? aiDesc.descriptionMain as string
                                      : descTab==='instagram' ? `${aiDesc.instagram}\n\n${(aiDesc.instagramHashtags as string[])?.join(' ')}` as string
                                      : descTab==='linkedin' ? aiDesc.linkedin as string
                                      : descTab==='whatsapp' ? aiDesc.whatsapp as string
                                      : `${aiDesc.emailSubject}\n\n${aiDesc.emailBody}` as string
                                    copyToClipboard(txt, descTab)
                                  }} style={{ position:'absolute', top:'10px', right:'10px', background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'rgba(201,169,110,.6)', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.06em', padding:'4px 10px', cursor:'pointer' }}>
                                    {copiedKey===descTab ? '✓ Copiado!' : '📋 Copiar'}
                                  </button>

                                  {descTab === 'main' && <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.65)', lineHeight:1.85, whiteSpace:'pre-line', paddingRight:'60px' }}>{aiDesc.descriptionMain as string}</div>}
                                  {descTab === 'instagram' && (
                                    <div>
                                      <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.65)', lineHeight:1.8, whiteSpace:'pre-line', marginBottom:'12px', paddingRight:'60px' }}>{aiDesc.instagram as string}</div>
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                                        {(aiDesc.instagramHashtags as string[] || []).map((h,i) => <span key={i} style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', color:'#4a9c7a' }}>{h}</span>)}
                                      </div>
                                    </div>
                                  )}
                                  {descTab === 'linkedin' && <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.65)', lineHeight:1.85, whiteSpace:'pre-line', paddingRight:'60px' }}>{aiDesc.linkedin as string}</div>}
                                  {descTab === 'whatsapp' && <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.65)', lineHeight:1.8, whiteSpace:'pre-line', paddingRight:'60px' }}>{aiDesc.whatsapp as string}</div>}
                                  {descTab === 'email' && (
                                    <div>
                                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.1em', color:'rgba(201,169,110,.5)', textTransform:'uppercase', marginBottom:'8px' }}>Subject: {aiDesc.emailSubject as string}</div>
                                      <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.65)', lineHeight:1.85, whiteSpace:'pre-line', paddingRight:'60px' }}>{aiDesc.emailBody as string}</div>
                                    </div>
                                  )}
                                </div>

                                {/* Lifestyle story */}
                                {aiDesc.lifestyleStory && (
                                  <div style={{ marginTop:'12px', background:'rgba(12,31,21,.4)', border:'1px solid rgba(28,74,53,.3)', borderLeft:'2px solid #1c4a35', padding:'14px 16px' }}>
                                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(74,156,122,.6)', marginBottom:'6px' }}>Lifestyle Story · Para Uso em Apresentações</div>
                                    <div style={{ fontFamily:"'Cormorant',serif", fontSize:'.95rem', color:'rgba(244,240,230,.6)', fontStyle:'italic', lineHeight:1.75 }}>{aiDesc.lifestyleStory as string}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Manual description textarea */}
                        <div style={{ marginBottom:'24px' }}>
                          <label style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(244,240,230,.4)', display:'block', marginBottom:'8px' }}>Descrição Completa {aiDesc ? '(gerada pela AI — editável)' : ''}</label>
                          <textarea value={newImovel.desc} onChange={e => setNewImovel(p => ({...p, desc:e.target.value}))} rows={8} placeholder='A AI irá gerar a descrição, ou escreva manualmente...' style={{ width:'100%', background:'rgba(244,240,230,.05)', border:'1px solid rgba(201,169,110,.2)', color:'#f4f0e6', padding:'10px 16px', fontFamily:"'Jost',sans-serif", fontSize:'.85rem', outline:'none', resize:'vertical', boxSizing:'border-box' as const, lineHeight:1.7 }} />
                        </div>

                        <button onClick={() => setPublishStep(4)} style={{ background:'#c9a96e', color:'#0c1f15', border:'none', padding:'14px 40px', fontFamily:"'DM Mono',monospace", fontSize:'.44rem', letterSpacing:'.15em', textTransform:'uppercase', cursor:'pointer', fontWeight:600 }}>
                          Continuar → Preview &amp; Publicar
                        </button>
                      </div>
                    )}

                    {/* STEP 4: PREVIEW + PUBLISH */}
                    {publishStep === 4 && (
                      <div>
                        <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'1.6rem', color:'#f4f0e6', marginBottom:'8px' }}>Preview &amp; Publicar</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.82rem', color:'rgba(244,240,230,.4)', marginBottom:'28px' }}>Verifique como ficará o imóvel e publique.</div>

                        {/* Mini showcase preview */}
                        <div style={{ border:'1px solid rgba(201,169,110,.2)', marginBottom:'32px', overflow:'hidden' }}>
                          {/* Hero */}
                          {aiPhotos[aiHeroIndex] && (
                            <div style={{ position:'relative', height:'300px', overflow:'hidden' }}>
                              <img src={aiPhotos[aiHeroIndex].url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 50%, rgba(12,31,21,.9))' }} />
                              <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'24px' }}>
                                {newImovel.badge && <div style={{ display:'inline-block', background:'#c9a96e', color:'#0c1f15', fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.1em', textTransform:'uppercase', padding:'4px 12px', marginBottom:'8px' }}>{newImovel.badge}</div>}
                                <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.6rem', color:'#f4f0e6', fontStyle:'italic' }}>{aiDesc?.headline as string || newImovel.nome}</div>
                                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.5)', letterSpacing:'.1em', marginTop:'4px' }}>{newImovel.bairro} · {newImovel.zona}</div>
                              </div>
                            </div>
                          )}
                          {/* Details row */}
                          <div style={{ padding:'20px 24px', background:'rgba(12,31,21,.6)', display:'flex', gap:'32px', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
                            <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.8rem', color:'#c9a96e' }}>€{Number(newImovel.preco).toLocaleString('pt-PT')}</div>
                            <div style={{ display:'flex', gap:'24px' }}>
                              {newImovel.area > 0 && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.5)' }}>{newImovel.area}m²</span>}
                              {newImovel.quartos > 0 && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.5)' }}>T{newImovel.quartos}</span>}
                              {newImovel.piscina && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)' }}>Piscina</span>}
                              {newImovel.jardim && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)' }}>Jardim</span>}
                              {newImovel.terraco && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(201,169,110,.6)' }}>Terraço</span>}
                            </div>
                          </div>
                          {/* Photo strip */}
                          {aiPhotos.length > 1 && (
                            <div style={{ display:'flex', gap:'4px', padding:'4px', background:'rgba(0,0,0,.3)', overflowX:'auto' }}>
                              {aiPhotos.slice(0,8).map((p,i) => (
                                <div key={i} style={{ flexShrink:0, width:'80px', height:'56px', overflow:'hidden', opacity: i === aiHeroIndex ? 1 : 0.6, border: i === aiHeroIndex ? '2px solid #c9a96e' : '2px solid transparent' }}>
                                  <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Description preview */}
                          {newImovel.desc && (
                            <div style={{ padding:'24px', background:'rgba(244,240,230,.02)' }}>
                              <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.6)', lineHeight:1.8, whiteSpace:'pre-line' }}>{newImovel.desc.slice(0,400)}{newImovel.desc.length>400?'…':''}</div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (!newImovel.nome || !newImovel.preco) return
                            const photos = aiPhotos.map(p => p.url)
                            const imovel = {
                              ...newImovel,
                              id: newImovel.nome.replace(/\s+/g,'-').toLowerCase() + '-' + Date.now(),
                              ref: 'AG-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4),
                              casasBanho: newImovel.casasBanho || 0,
                              photos,
                              heroPhoto: photos[aiHeroIndex] || '',
                              photoAnalyses: aiPhotos.map(p => p.analysis),
                              aiDescription: aiDesc,
                              grad: 'from-emerald-900 to-stone-800',
                              lat: 0, lng: 0,
                              lifestyle: [],
                              features: newImovel.features ? newImovel.features.split(',').map((f:string) => f.trim()) : [],
                            }
                            saveImoveis([...imoveisList, imovel])
                            setImovelSaved(true)
                            setAiPhotos([])
                            setAiDesc(null)
                            setPublishStep(1)
                            setNewImovel({ nome:'', zona:'Lisboa', bairro:'', tipo:'Apartamento', preco:0, area:0, quartos:0, casasBanho:0, andar:'', energia:'A', vista:'', piscina:false, garagem:false, jardim:false, terraco:false, condominio:false, badge:'', status:'Ativo', desc:'', features:'', tourUrl:'' })
                            setTimeout(() => { setImovelSaved(false); setImoveisTab('lista') }, 2000)
                          }}
                          style={{ background:'#c9a96e', color:'#0c1f15', border:'none', padding:'16px 48px', fontFamily:"'DM Mono',monospace", fontSize:'.48rem', letterSpacing:'.15em', textTransform:'uppercase', cursor:'pointer', fontWeight:700 }}
                        >
                          ✦ Publicar Imóvel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* STATS TAB */}
                {imoveisTab === 'stats' && (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
                      {/* By Zone */}
                      <div style={{ background:'rgba(244,240,230,.04)', border:'1px solid rgba(201,169,110,.12)', padding:'24px' }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.4rem', letterSpacing:'.15em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'20px' }}>Por Zona</div>
                        {Object.entries(
                          imoveisList.reduce((acc, p) => { acc[p.zona] = (acc[p.zona]||0)+1; return acc }, {} as Record<string,number>)
                        ).sort(([,a],[,b]) => b-a).map(([zona, count]) => (
                          <div key={zona} style={{ marginBottom:'12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                              <span style={{ fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.7)' }}>{zona}</span>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'#c9a96e' }}>{count}</span>
                            </div>
                            <div style={{ height:'3px', background:'rgba(244,240,230,.08)', borderRadius:'2px' }}>
                              <div style={{ height:'100%', background:'#c9a96e', width:`${(count/imoveisList.length*100).toFixed(0)}%`, borderRadius:'2px', transition:'width .4s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* By Type */}
                      <div style={{ background:'rgba(244,240,230,.04)', border:'1px solid rgba(201,169,110,.12)', padding:'24px' }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.4rem', letterSpacing:'.15em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'20px' }}>Por Tipo</div>
                        {Object.entries(
                          imoveisList.reduce((acc, p) => { acc[p.tipo] = (acc[p.tipo]||0)+1; return acc }, {} as Record<string,number>)
                        ).sort(([,a],[,b]) => b-a).map(([tipo, count]) => (
                          <div key={tipo} style={{ marginBottom:'12px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                              <span style={{ fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.7)' }}>{tipo}</span>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'#c9a96e' }}>{count}</span>
                            </div>
                            <div style={{ height:'3px', background:'rgba(244,240,230,.08)', borderRadius:'2px' }}>
                              <div style={{ height:'100%', background:'#1c4a35', width:`${(count/imoveisList.length*100).toFixed(0)}%`, borderRadius:'2px', transition:'width .4s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Value breakdown */}
                    <div style={{ marginTop:'24px', background:'rgba(244,240,230,.04)', border:'1px solid rgba(201,169,110,.12)', padding:'24px' }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.4rem', letterSpacing:'.15em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'20px' }}>Valor por Zona</div>
                      {Object.entries(
                        imoveisList.reduce((acc, p) => { acc[p.zona] = (acc[p.zona]||0)+p.preco; return acc }, {} as Record<string,number>)
                      ).sort(([,a],[,b]) => b-a).map(([zona, total]) => (
                        <div key={zona} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(244,240,230,.05)' }}>
                          <span style={{ fontFamily:"'Jost',sans-serif", color:'rgba(244,240,230,.7)' }}>{zona}</span>
                          <span style={{ fontFamily:"'Cormorant',serif", fontSize:'1.1rem', color:'#c9a96e' }}>€{(total/1000000).toFixed(1)}M</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* COMPARAR TAB */}
                {imoveisTab === 'comparar' && (
                  <div>
                    {/* Property selector */}
                    <div style={{marginBottom:'24px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(201,169,110,.5)',marginBottom:'12px'}}>Selecciona até 3 imóveis para comparar</div>
                      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'16px'}}>
                        {imoveisList.slice(0,12).map(p => {
                          const isSelected = compareIds.includes(String(p.id))
                          return (
                            <button key={p.id as string}
                              onClick={()=>{
                                const sid = String(p.id)
                                if (isSelected) setCompareIds(prev=>prev.filter(x=>x!==sid))
                                else if (compareIds.length < 3) setCompareIds(prev=>[...prev,sid])
                              }}
                              style={{padding:'6px 14px',border:`1px solid ${isSelected?'#c9a96e':'rgba(201,169,110,.2)'}`,background:isSelected?'rgba(201,169,110,.15)':'transparent',color:isSelected?'#c9a96e':'rgba(244,240,230,.5)',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',transition:'all .15s',letterSpacing:'.06em'}}>
                              {isSelected ? '✓ ' : ''}{String(p.nome).substring(0,20)}
                            </button>
                          )
                        })}
                        {compareIds.length > 0 && (
                          <button onClick={()=>setCompareIds([])}
                            style={{padding:'6px 14px',border:'1px solid rgba(224,84,84,.3)',background:'rgba(224,84,84,.08)',color:'#e05454',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',cursor:'pointer',letterSpacing:'.06em'}}>
                            × Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comparison table */}
                    {compareIds.length >= 2 ? (() => {
                      const selected = compareIds.map(id => imoveisList.find(p=>String(p.id)===id)).filter(Boolean) as typeof imoveisList
                      const pm2s = selected.map(p => p.area > 0 ? Math.round(Number(p.preco)/Number(p.area)) : 0)
                      const maxPm2 = Math.max(...pm2s)
                      const rows: { label: string; vals: (p: typeof imoveisList[0]) => string; highlight?: 'min'|'max'|'none' }[] = [
                        { label:'Preço', vals: p => `€${(Number(p.preco)/1e6).toFixed(3)}M`, highlight:'min' },
                        { label:'Área', vals: p => `${p.area}m²`, highlight:'max' },
                        { label:'€/m²', vals: p => `€${p.area>0?Math.round(Number(p.preco)/Number(p.area)).toLocaleString('pt-PT'):'—'}`, highlight:'min' },
                        { label:'Quartos', vals: p => `T${p.quartos}`, highlight:'max' },
                        { label:'WC', vals: p => String(p.casasBanho||'—'), highlight:'none' },
                        { label:'Zona', vals: p => String(p.zona), highlight:'none' },
                        { label:'Tipo', vals: p => String(p.tipo), highlight:'none' },
                        { label:'Piscina', vals: p => p.piscina ? '✓' : '—', highlight:'none' },
                        { label:'Garagem', vals: p => p.garagem ? '✓' : '—', highlight:'none' },
                        { label:'Terraço', vals: p => p.terraco ? '✓' : '—', highlight:'none' },
                        { label:'Energia', vals: p => String(p.energia||'—'), highlight:'none' },
                        { label:'Badge', vals: p => String(p.badge||'Standard'), highlight:'none' },
                        { label:'Comissão 5%', vals: p => `€${Math.round(Number(p.preco)*0.05/1000)}K`, highlight:'none' },
                      ]
                      return (
                        <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',background:'rgba(244,240,230,.03)'}}>
                            <thead>
                              <tr>
                                <th style={{padding:'12px 16px',textAlign:'left',fontFamily:"'DM Mono',monospace",fontSize:'.38rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(201,169,110,.4)',borderBottom:'1px solid rgba(201,169,110,.15)',minWidth:'100px'}}>Atributo</th>
                                {selected.map(p => (
                                  <th key={String(p.id)} style={{padding:'12px 16px',textAlign:'center',borderBottom:'1px solid rgba(201,169,110,.15)'}}>
                                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1rem',color:'#f4f0e6',marginBottom:'2px'}}>{String(p.nome).substring(0,24)}</div>
                                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(201,169,110,.5)'}}>{String(p.zona)} · {String(p.ref||'')}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, rowIdx) => {
                                const vals = selected.map(p => row.vals(p))
                                const numVals = vals.map(v => parseFloat(v.replace(/[^0-9.]/g,'')))
                                const maxVal = Math.max(...numVals.filter(n=>!isNaN(n)))
                                const minVal = Math.min(...numVals.filter(n=>!isNaN(n)))
                                return (
                                  <tr key={row.label} style={{background:rowIdx%2===0?'rgba(244,240,230,.02)':'transparent'}}>
                                    <td style={{padding:'10px 16px',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(244,240,230,.4)',letterSpacing:'.06em',borderBottom:'1px solid rgba(201,169,110,.06)'}}>{row.label}</td>
                                    {selected.map((p, i) => {
                                      const val = row.vals(p)
                                      const num = parseFloat(val.replace(/[^0-9.]/g,''))
                                      const isBest = !isNaN(num) && row.highlight === 'max' && num === maxVal
                                      const isWorst = !isNaN(num) && row.highlight === 'min' && num === minVal
                                      return (
                                        <td key={String(p.id)} style={{padding:'10px 16px',textAlign:'center',fontFamily:"'DM Mono',monospace",fontSize:'.46rem',borderBottom:'1px solid rgba(201,169,110,.06)',
                                          color:isBest?'#10b981':isWorst?'#c9a96e':'rgba(244,240,230,.7)',
                                          background:isBest?'rgba(16,185,129,.06)':isWorst?'rgba(201,169,110,.06)':'transparent',
                                          fontWeight:isBest||isWorst?700:400}}>
                                          {val} {isBest&&<span style={{fontSize:'.3rem',marginLeft:'4px'}}>★</span>}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {/* Share comparison */}
                          <div style={{marginTop:'16px',display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                            <button onClick={()=>{
                              const text = `Comparativo Agency Group\n\n${selected.map(p=>`${String(p.nome)} — ${String(p.zona)}\nPreço: €${(Number(p.preco)/1e6).toFixed(2)}M · ${p.area}m² · €${p.area>0?Math.round(Number(p.preco)/Number(p.area)):0}/m²\nT${p.quartos}${p.casasBanho?' · '+p.casasBanho+' WC':''} · ${p.tipo}`).join('\n\n')}\n\nAgency Group · AMI 22506`
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank')
                            }} style={{padding:'10px 22px',background:'#c9a96e',color:'#0c1f15',border:'none',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer',fontWeight:700}}>
                              💬 Enviar por WA
                            </button>
                            <button onClick={()=>{
                              const text = `Comparativo Agency Group\n\n${selected.map(p=>`${String(p.nome)} — €${(Number(p.preco)/1e6).toFixed(2)}M · ${p.area}m² · €${p.area>0?Math.round(Number(p.preco)/Number(p.area)):0}/m²`).join('\n')}\n\nAgency Group · AMI 22506`
                              navigator.clipboard.writeText(text)
                            }} style={{padding:'10px 22px',background:'rgba(244,240,230,.08)',color:'rgba(244,240,230,.7)',border:'1px solid rgba(201,169,110,.2)',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.1em',cursor:'pointer'}}>
                              Copiar
                            </button>
                          </div>
                        </div>
                      )
                    })() : (
                      <div style={{textAlign:'center',padding:'60px 0',border:'1px dashed rgba(201,169,110,.2)'}}>
                        <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'2rem',color:'rgba(201,169,110,.2)',marginBottom:'12px'}}>⇄</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',color:'rgba(244,240,230,.25)',letterSpacing:'.12em',textTransform:'uppercase'}}>Selecciona 2 ou 3 imóveis para comparar</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CAMPANHAS EMAIL ── */}
            {section==='campanhas' && (()=>{
              interface DripEmail { day:number; subject:string; preview:string; openRate:string }
              const DRIP_SEQ: Record<string, DripEmail[]> = {
                d1: [
                  { day:0, subject:'Bem-vindo \u00e0 Agency Group', preview:'Obrigado pelo seu contacto. Sou o Carlos Oliveira e estou pessoalmente dedicado a encontrar o im\u00f3vel perfeito para si...', openRate:'58%' },
                  { day:2, subject:'Os Melhores Im\u00f3veis em [Zona] Esta Semana', preview:'Seleccionei para si 3 im\u00f3veis que correspondem exactamente ao seu perfil...', openRate:'44%' },
                  { day:5, subject:'Relat\u00f3rio de Mercado: [Zona] Q1 2026', preview:'O mercado imobili\u00e1rio em [Zona] continua a mostrar uma valoriza\u00e7\u00e3o de...', openRate:'38%' },
                  { day:9, subject:'Visita Privada Esta Semana?', preview:'Tenho disponibilidade esta semana para uma visita exclusiva...', openRate:'42%' },
                  { day:14, subject:'Posso Ajud\u00e1-lo a Encontrar o Im\u00f3vel Ideal?', preview:'Ap\u00f3s duas semanas, quero garantir que...', openRate:'31%' },
                ],
                d2: [
                  { day:0, subject:'Obrigado pelo seu interesse em [Im\u00f3vel]', preview:'Foi um prazer mostrar-lhe este im\u00f3vel excepcional. Aqui ficam os detalhes completos...', openRate:'62%' },
                  { day:3, subject:'Informa\u00e7\u00e3o Adicional sobre [Im\u00f3vel]', preview:'Conforme prometido, segue informa\u00e7\u00e3o adicional sobre o im\u00f3vel, incluindo planta e certid\u00e3o...', openRate:'41%' },
                  { day:6, subject:'Comparativo de Mercado \u2014 Im\u00f3veis Similares', preview:'Para o ajudar a tomar a decis\u00e3o certa, preparei um comparativo com 3 im\u00f3veis semelhantes...', openRate:'35%' },
                  { day:10, subject:'\u00daltima Oportunidade \u2014 [Im\u00f3vel] Continua Dispon\u00edvel', preview:'Quero inform\u00e1-lo que o im\u00f3vel ainda se encontra dispon\u00edvel. Temos interesse de outros compradores...', openRate:'29%' },
                ],
                d3: [
                  { day:0, subject:'Novidades Exclusivas \u2014 Volt\u00e1mos a Contact\u00e1-lo', preview:'Tem sido algum tempo desde o nosso \u00faltimo contacto. Temos novidades exclusivas no mercado que combinam com o seu perfil...', openRate:'38%' },
                  { day:10, subject:'Mercado Imobili\u00e1rio PT 2026 \u2014 O que Mudou', preview:'O mercado em Portugal registou uma valoriza\u00e7\u00e3o de 17,6% em 2025. Aqui est\u00e3o as zonas com maior potencial...', openRate:'32%' },
                  { day:21, subject:'Ser\u00e1 que posso ajud\u00e1-lo de outra forma?', preview:'Se os seus planos mudaram, estou aqui para ajudar. Seja para arrendar, investir ou simplesmente obter um relat\u00f3rio de mercado...', openRate:'24%' },
                ],
              }
              const sCfg: Record<string,{label:string;bg:string;color:string}> = {
                active: { label:'Activa', bg:'rgba(28,74,53,.1)', color:'#1c4a35' },
                paused: { label:'Pausada', bg:'rgba(201,169,110,.1)', color:'#c9a96e' },
                draft: { label:'Rascunho', bg:'rgba(136,136,136,.1)', color:'#888' },
              }
              const WA_STATS = [
                { template:'Contacto Inicial', sent:127, delivered:124, read:89, response:34, responseRate:'27%', lang:'PT/EN/FR' },
                { template:'Follow-up', sent:98, delivered:97, read:71, response:29, responseRate:'30%', lang:'PT/EN' },
                { template:'Proposta Formal', sent:45, delivered:45, read:41, response:31, responseRate:'69%', lang:'PT/EN/FR/AR' },
                { template:'Confirmação Visita', sent:62, delivered:62, read:60, response:57, responseRate:'92%', lang:'PT/EN' },
                { template:'CPCV Pronto', sent:18, delivered:18, read:18, response:16, responseRate:'89%', lang:'PT' },
              ]
              return (
                <div style={{maxWidth:'960px'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.5rem',letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,13,.35)',marginBottom:'8px'}}>Automação · Email + WhatsApp · Luxury Real Estate</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
                    <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.8rem',color:'#0e0e0d'}}>Campanhas <em style={{color:'#1c4a35'}}>& Automação</em></div>
                    <div style={{display:'flex',gap:'6px'}}>
                      {([['email','📧 Email'],['whatsapp','💬 WhatsApp']] as const).map(([t,l])=>(
                        <button key={t} onClick={()=>setCampTab(t)}
                          style={{padding:'8px 20px',border:'1px solid',fontFamily:"'DM Mono',monospace",fontSize:'.46rem',letterSpacing:'.1em',cursor:'pointer',transition:'all .2s',
                            background:campTab===t?'#1c4a35':'transparent',
                            borderColor:campTab===t?'#1c4a35':'rgba(14,14,13,.15)',
                            color:campTab===t?'#f4f0e6':'rgba(14,14,13,.5)'}}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* KPI row */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'12px',marginBottom:'28px'}}>
                    {campTab === 'email'
                      ? [{label:'Emails Enviados',val:'1.247',color:'#1c4a35'},{label:'Taxa Abertura',val:'38%',color:'#c9a96e'},{label:'Taxa Click',val:'12%',color:'#4a9c7a'},{label:'Conversões',val:'23',color:'#1c4a35'},{label:'Campanhas Activas',val:'1',color:'#c9a96e'}]
                      : [{label:'WA Enviados',val:'350',color:'#25D366'},{label:'Entregues',val:'346',color:'#1c4a35'},{label:'Lidos',val:'279',color:'#c9a96e'},{label:'Respostas',val:'167',color:'#4a9c7a'},{label:'Taxa Resposta',val:'48%',color:'#c9a96e'}]
                    }.map(k=>(
                      <div key={k.label} className="kpi-card" style={{padding:'14px 16px'}}>
                        <div className="kpi-val" style={{color:k.color,fontSize:'1.4rem'}}>{k.val}</div>
                        <div className="kpi-label" style={{fontSize:'.4rem'}}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* WhatsApp Tab */}
                  {campTab === 'whatsapp' && (
                    <div>
                      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'24px'}}>
                        {WA_STATS.map((wa, idx) => (
                          <div key={idx} className="p-card" style={{padding:'16px 20px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
                              <div style={{flex:1,minWidth:'160px'}}>
                                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
                                  <span style={{fontSize:'.9rem',fontWeight:500,color:'#0e0e0d'}}>{wa.template}</span>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',background:'rgba(37,211,102,.12)',color:'#25D366',padding:'2px 7px',letterSpacing:'.08em'}}>{wa.lang}</span>
                                </div>
                                {/* Funnel bars */}
                                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                                  {[
                                    { label:'Enviados', val:wa.sent, pct:100, color:'rgba(14,14,13,.15)' },
                                    { label:'Entregues', val:wa.delivered, pct:Math.round(wa.delivered/wa.sent*100), color:'#4a9c7a' },
                                    { label:'Lidos', val:wa.read, pct:Math.round(wa.read/wa.sent*100), color:'#c9a96e' },
                                    { label:'Respostas', val:wa.response, pct:Math.round(wa.response/wa.sent*100), color:'#1c4a35' },
                                  ].map(row => (
                                    <div key={row.label} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',width:'60px',flexShrink:0}}>{row.label}</div>
                                      <div style={{flex:1,height:'4px',background:'rgba(14,14,13,.06)',borderRadius:'2px',overflow:'hidden'}}>
                                        <div style={{height:'100%',background:row.color,width:`${row.pct}%`,borderRadius:'2px',transition:'width .5s'}}/>
                                      </div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',minWidth:'48px',textAlign:'right'}}>{row.val} · {row.pct}%</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{textAlign:'right',flexShrink:0}}>
                                <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.8rem',color:'#1c4a35',lineHeight:1}}>{wa.responseRate}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',letterSpacing:'.08em'}}>taxa resposta</div>
                                <button style={{marginTop:'8px',padding:'5px 12px',background:'rgba(37,211,102,.08)',border:'1px solid rgba(37,211,102,.3)',color:'#25D366',fontFamily:"'DM Mono',monospace",fontSize:'.4rem',cursor:'pointer',letterSpacing:'.08em'}}
                                  onClick={()=>{const t=WA_TEMPLATES['PT'][Object.keys(WA_TEMPLATES['PT'])[idx]];if(t)window.open(`https://wa.me/?text=${encodeURIComponent(t.msg)}`,'_blank')}}>
                                  Enviar Template
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* WA Quick Blast */}
                      <div className="p-card" style={{background:'linear-gradient(135deg,rgba(37,211,102,.04),rgba(28,74,53,.04))',border:'1px solid rgba(37,211,102,.2)'}}>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'12px'}}>💬 Quick Blast — Enviar a Segmento</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px'}}>
                          {[
                            { label:'VIPs', desc:`${crmContacts.filter(c=>c.status==='vip').length} contactos`, color:'#c9a96e' },
                            { label:'Prospects', desc:`${crmContacts.filter(c=>c.status==='prospect').length} contactos`, color:'#4a9c7a' },
                            { label:'Follow-up Overdue', desc:`${crmContacts.filter(c=>c.nextFollowUp&&c.nextFollowUp<=new Date().toISOString().split('T')[0]).length} contactos`, color:'#e05454' },
                            { label:'Leads Frios (>14d)', desc:`${crmContacts.filter(c=>{const d=Math.floor((Date.now()-new Date(c.lastContact).getTime())/86400000);return d>14}).length} contactos`, color:'rgba(14,14,13,.4)' },
                          ].map(seg => (
                            <div key={seg.label} style={{padding:'12px',background:'rgba(255,255,255,.6)',border:`1px solid ${seg.color}22`,cursor:'pointer',transition:'all .2s'}}
                              onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=seg.color}}
                              onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=`${seg.color}22`}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.46rem',fontWeight:700,color:seg.color,marginBottom:'2px'}}>{seg.label}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)'}}>{seg.desc}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.35)'}}>
                          Selecciona um segmento e usa o modal WhatsApp do CRM para enviar o template
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Tab — Campaign list */}
                  {campTab === 'email' && <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                    {dripCampaigns.map(drip=>{
                      const sc3 = sCfg[drip.status] || sCfg['draft']
                      const seq3 = DRIP_SEQ[drip.id] || []
                      const isExp = expandedDrip === drip.id
                      return (
                        <div key={drip.id} className="p-card" style={{padding:'0',overflow:'hidden',border:'1px solid rgba(14,14,13,.08)'}}>
                          <div style={{padding:'18px 22px',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
                            <div style={{flex:1,minWidth:'180px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
                                <span style={{fontSize:'.9rem',fontWeight:500,color:'#0e0e0d'}}>{drip.name}</span>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',letterSpacing:'.1em',textTransform:'uppercase',background:sc3.bg,color:sc3.color,padding:'2px 8px'}}>{sc3.label}</span>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',display:'flex',gap:'14px',flexWrap:'wrap'}}>
                                <span>{drip.emails} emails</span>
                                <span>{drip.days} dias</span>
                                <span style={{color:'#1c4a35'}}>Benchmark abertura: {drip.openRate}</span>
                              </div>
                            </div>
                            <div style={{display:'flex',gap:'8px',alignItems:'center',flexShrink:0}}>
                              <button onClick={()=>setDripCampaigns(prev=>prev.map(d=>d.id===drip.id?{...d,status:(d.status==='active'?'paused':'active') as 'active'|'paused'|'draft'}:d))}
                                style={{padding:'6px 14px',background:drip.status==='active'?'rgba(28,74,53,.1)':'rgba(201,169,110,.1)',color:drip.status==='active'?'#1c4a35':'#c9a96e',border:`1px solid ${drip.status==='active'?'rgba(28,74,53,.25)':'rgba(201,169,110,.25)'}`,fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'pointer'}}>
                                {drip.status==='active'?'\u23f8 Pausar':'\u25b6 Activar'}
                              </button>
                              <button onClick={()=>setExpandedDrip(isExp?null:drip.id)}
                                style={{padding:'6px 14px',background:'rgba(14,14,13,.04)',color:'rgba(14,14,13,.6)',border:'1px solid rgba(14,14,13,.1)',fontFamily:"'DM Mono',monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'pointer'}}>
                                {isExp?'\u25b2 Fechar':'\u25bc Ver Sequ\u00eancia'}
                              </button>
                            </div>
                          </div>
                          <div style={{height:'3px',background:'rgba(14,14,13,.06)'}}>
                            <div style={{height:'100%',background:drip.status==='active'?'#1c4a35':drip.status==='paused'?'#c9a96e':'rgba(14,14,13,.12)',width:`${drip.status==='active'?65:drip.status==='paused'?40:0}%`,transition:'width .4s'}}/>
                          </div>
                          {isExp && seq3.length > 0 && (
                            <div style={{borderTop:'1px solid rgba(14,14,13,.08)',padding:'18px 22px',background:'rgba(14,14,13,.02)'}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'14px'}}>Sequ\u00eancia de Emails</div>
                              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                                {seq3.map((em,i)=>(
                                  <div key={i} style={{display:'flex',gap:'14px',alignItems:'flex-start',padding:'12px 14px',background:'#fff',border:'1px solid rgba(14,14,13,.07)'}}>
                                    <div style={{flexShrink:0,width:'48px',height:'48px',background:'rgba(28,74,53,.07)',border:'1px solid rgba(28,74,53,.15)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase'}}>Dia</span>
                                      <span style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',color:'#1c4a35',lineHeight:1}}>{em.day}</span>
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:'.85rem',fontWeight:500,color:'#0e0e0d',marginBottom:'3px'}}>{em.subject}</div>
                                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'rgba(14,14,13,.55)',lineHeight:1.6,marginBottom:'5px'}}>{em.preview}</div>
                                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'#4a9c7a'}}>Benchmark abertura: {em.openRate}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Add new */}
                  <div style={{marginTop:'20px',padding:'20px',border:'2px dashed rgba(14,14,13,.1)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
                    <div>
                      <div style={{fontSize:'.85rem',fontWeight:500,color:'#0e0e0d',marginBottom:'3px'}}>Criar Nova Campanha</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)'}}>Personaliza a sequ\u00eancia para o teu segmento de clientes</div>
                    </div>
                    <button className="p-btn p-btn-gold" style={{padding:'10px 22px',fontSize:'.5rem'}}
                      onClick={()=>{const n=prompt('Nome da campanha:');if(!n)return;setDripCampaigns(prev=>[...prev,{id:`d${Date.now()}`,name:n,status:'draft' as const,emails:3,days:14,openRate:'\u2014'}])}}>
                      + Nova Campanha
                    </button>
                  </div>
                  </div>}
                </div>
              )
            })()}

            {/* ── AGENDA SEMANAL ── */}
            {section==='agenda' && (()=>{
              const today = new Date('2026-04-03')
              const todayDay = today.getDay() // 5 = Friday
              // Get Monday of current week
              const monday = new Date(today)
              monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

              const weekDays = Array.from({length:7},(_,i)=>{
                const d = new Date(monday)
                d.setDate(monday.getDate() + i)
                return d
              })

              const DAY_LABELS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']

              type AgendaEvent = {
                type: 'followup' | 'meeting' | 'deal' | 'task'
                label: string
                sub: string
                color: string
                icon: string
                time?: string
              }

              // Build events per day
              const eventsByDay: AgendaEvent[][] = weekDays.map((day, dayIdx) => {
                const events: AgendaEvent[] = []
                const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`

                // Follow-ups from CRM contacts
                crmContacts.forEach(c => {
                  if (!c.lastContact) return
                  const last = new Date(c.lastContact)
                  const diff = Math.floor((day.getTime() - last.getTime()) / 86400000)
                  if (diff === 3 || diff === 7 || diff === 14 || diff === 30) {
                    events.push({
                      type:'followup',
                      label:`Follow-up: ${c.name}`,
                      sub:`${diff}d sem contacto · ${c.status?.toUpperCase() || 'LEAD'} · ${c.nationality || ''}`,
                      color:'#3a7bd5',
                      icon:'📞',
                      time: diff <= 7 ? '09:00' : '11:00'
                    })
                  }
                })

                // Deal deadlines
                deals.forEach(d => {
                  if (d.cpcvDate === iso) {
                    events.push({
                      type:'deal',
                      label:`CPCV: ${d.imovel}`,
                      sub:`${d.comprador} · ${d.valor}`,
                      color:'#c9a96e',
                      icon:'📋',
                      time:'14:00'
                    })
                  }
                  if (d.escrituraDate === iso) {
                    events.push({
                      type:'deal',
                      label:`✅ Escritura: ${d.imovel}`,
                      sub:`${d.comprador} · ${d.valor}`,
                      color:'#1c4a35',
                      icon:'🏠',
                      time:'15:00'
                    })
                  }
                })

                // Tasks from CRM contacts
                crmContacts.forEach(c => {
                  if (!c.tasks) return
                  ;(c.tasks as {text:string;date:string;done:boolean}[]).forEach(t => {
                    if (!t.done && t.date === iso) {
                      events.push({
                        type:'task',
                        label: t.text,
                        sub:`${c.name} · Tarefa pendente`,
                        color:'#4a9c7a',
                        icon:'✓',
                        time:'10:00'
                      })
                    }
                  })
                })

                // Default weekly patterns
                if (dayIdx === 0) events.push({ type:'meeting', label:'Reunião de equipa AG', sub:'Pipeline review semanal · Sala principal', color:'#7c3aed', icon:'👥', time:'08:30' })
                if (dayIdx === 4) events.push({ type:'task', label:'Relatório semanal IA', sub:'Gerar e enviar relatório de performance', color:'#4a9c7a', icon:'📊', time:'17:00' })
                if (dayIdx === 6) events.push({ type:'task', label:'Planeamento semana seguinte', sub:'Prioridades, contactos, visitas', color:'#888', icon:'📅', time:'10:00' })

                return events.sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'))
              })

              const totalEvents = eventsByDay.reduce((s,ev) => s + ev.length, 0)
              const followupCount = eventsByDay.flat().filter(e=>e.type==='followup').length
              const dealCount = eventsByDay.flat().filter(e=>e.type==='deal').length
              const todayEvents = eventsByDay[((today.getDay()+6)%7)] || []

              const TYPE_CFG: Record<string,{bg:string;border:string;dot:string;label:string}> = {
                followup: { bg:'rgba(58,123,213,.07)', border:'rgba(58,123,213,.2)', dot:'#3a7bd5', label:'Follow-up' },
                meeting:  { bg:'rgba(124,58,237,.07)', border:'rgba(124,58,237,.2)', dot:'#7c3aed', label:'Reunião' },
                deal:     { bg:'rgba(201,169,110,.07)', border:'rgba(201,169,110,.25)', dot:'#c9a96e', label:'Deal' },
                task:     { bg:'rgba(74,156,122,.07)', border:'rgba(74,156,122,.2)', dot:'#4a9c7a', label:'Tarefa' },
              }

              return (
                <div>
                  {/* Header */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'16px',marginBottom:'32px'}}>
                    <div>
                      <div style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.6rem',color:'#0e0e0d',letterSpacing:'-.01em',marginBottom:'6px'}}>Agenda Semanal</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)',letterSpacing:'.1em',textTransform:'uppercase'}}>
                        {monday.toLocaleDateString('pt-PT',{day:'numeric',month:'long'})} — {weekDays[6].toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'})}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                      {[
                        { label:'Total Esta Semana', value:totalEvents.toString(), color:'#0e0e0d' },
                        { label:'Follow-ups', value:followupCount.toString(), color:'#3a7bd5' },
                        { label:'Deals / Escrituras', value:dealCount.toString(), color:'#c9a96e' },
                        { label:'Hoje', value:todayEvents.length.toString(), color:'#1c4a35' },
                      ].map(s=>(
                        <div key={s.label} style={{textAlign:'center',padding:'12px 18px',background:'rgba(14,14,13,.03)',border:'1px solid rgba(14,14,13,.07)'}}>
                          <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.5rem',fontWeight:600,color:s.color,lineHeight:1}}>{s.value}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase',letterSpacing:'.08em',marginTop:'4px'}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{display:'flex',gap:'16px',flexWrap:'wrap',marginBottom:'24px'}}>
                    {Object.entries(TYPE_CFG).map(([k,v])=>(
                      <div key={k} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <div style={{width:'8px',height:'8px',borderRadius:'50%',background:v.dot}}/>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',textTransform:'uppercase',letterSpacing:'.08em'}}>{v.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Week grid */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px',marginBottom:'32px'}}>
                    {weekDays.map((day,i)=>{
                      const isToday = day.toDateString()===today.toDateString()
                      const isPast = day < today && !isToday
                      const events = eventsByDay[i]
                      return (
                        <div key={i} style={{border:`1px solid ${isToday?'#1c4a35':'rgba(14,14,13,.08)'}`,background:isToday?'rgba(28,74,53,.04)':isPast?'rgba(14,14,13,.01)':'#fff',minHeight:'180px',position:'relative',transition:'all .2s'}}>
                          {/* Day header */}
                          <div style={{padding:'10px 12px',borderBottom:`1px solid ${isToday?'rgba(28,74,53,.2)':'rgba(14,14,13,.06)'}`,background:isToday?'#1c4a35':isPast?'rgba(14,14,13,.03)':'transparent'}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',textTransform:'uppercase',letterSpacing:'.1em',color:isToday?'rgba(244,240,230,.6)':isPast?'rgba(14,14,13,.3)':'rgba(14,14,13,.4)'}}>{DAY_LABELS[i]}</div>
                            <div style={{fontFamily:"'Cormorant',serif",fontSize:'1.2rem',fontWeight:isToday?600:400,color:isToday?'#f4f0e6':isPast?'rgba(14,14,13,.3)':'#0e0e0d',lineHeight:1.1}}>{day.getDate()}</div>
                            {isToday && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:'#c9a96e',letterSpacing:'.1em',marginTop:'2px'}}>HOJE</div>}
                          </div>
                          {/* Events */}
                          <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:'4px'}}>
                            {events.length===0 && (
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.2)',padding:'8px 4px',textAlign:'center'}}>—</div>
                            )}
                            {events.map((ev,ei)=>{
                              const cfg = TYPE_CFG[ev.type]
                              return (
                                <div key={ei} style={{background:cfg.bg,border:`1px solid ${cfg.border}`,padding:'5px 7px',borderLeft:`2px solid ${cfg.dot}`,opacity:isPast?.6:1}}>
                                  {ev.time && <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.32rem',color:cfg.dot,marginBottom:'2px'}}>{ev.time}</div>}
                                  <div style={{fontSize:'.72rem',fontWeight:500,color:'#0e0e0d',lineHeight:1.3,marginBottom:'1px'}}>{ev.icon} {ev.label}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.33rem',color:'rgba(14,14,13,.45)',lineHeight:1.4}}>{ev.sub}</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Today spotlight */}
                  {todayEvents.length > 0 && (
                    <div style={{marginBottom:'32px'}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>▸ Hoje em Destaque</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
                        {todayEvents.map((ev,i)=>{
                          const cfg = TYPE_CFG[ev.type]
                          return (
                            <div key={i} style={{background:'#fff',border:`1px solid ${cfg.border}`,borderLeft:`3px solid ${cfg.dot}`,padding:'16px 18px',display:'flex',gap:'14px',alignItems:'flex-start'}}>
                              <div style={{fontSize:'1.4rem',flexShrink:0}}>{ev.icon}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                                  {ev.time && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:cfg.dot,flexShrink:0}}>{ev.time}</span>}
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',padding:'2px 7px',background:cfg.bg,color:cfg.dot,border:`1px solid ${cfg.border}`,textTransform:'uppercase',letterSpacing:'.06em'}}>{cfg.label}</span>
                                </div>
                                <div style={{fontSize:'.88rem',fontWeight:600,color:'#0e0e0d',marginBottom:'4px'}}>{ev.label}</div>
                                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'rgba(14,14,13,.55)',lineHeight:1.5}}>{ev.sub}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Upcoming follow-ups — next 7 days from CRM */}
                  <div style={{marginBottom:'32px'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>▸ Follow-ups Prioritários</div>
                    <div style={{border:'1px solid rgba(14,14,13,.08)',overflow:'hidden'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto auto',background:'rgba(14,14,13,.03)',borderBottom:'1px solid rgba(14,14,13,.08)',padding:'10px 16px',gap:'16px'}}>
                        {['Contacto','Status','Budget','Última Vez','Ação'].map(h=>(
                          <div key={h} style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                        ))}
                      </div>
                      {crmContacts
                        .filter(c=>c.lastContact)
                        .map(c=>({ c, days:Math.floor((today.getTime()-new Date(c.lastContact!).getTime())/86400000) }))
                        .filter(({days})=>days>=2 && days<=30)
                        .sort((a,b)=>b.days-a.days)
                        .slice(0,8)
                        .map(({c,days},i)=>{
                          const urgency = days>=14?'#e05454':days>=7?'#c9a96e':'#4a9c7a'
                          return (
                            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto auto auto auto',padding:'12px 16px',gap:'16px',alignItems:'center',borderBottom:'1px solid rgba(14,14,13,.05)',background:i%2===0?'#fff':'rgba(14,14,13,.01)'}}>
                              <div>
                                <div style={{fontSize:'.85rem',fontWeight:500,color:'#0e0e0d'}}>{c.nationality && <span style={{marginRight:'6px'}}>{c.nationality.split(' ')[0]}</span>}{c.name}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:'rgba(14,14,13,.4)',marginTop:'2px'}}>{c.email || c.phone || '—'}</div>
                              </div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',padding:'3px 8px',background:`rgba(${c.status==='vip'?'201,169,110':c.status==='cliente'?'28,74,53':'136,136,136'},.1)`,color:c.status==='vip'?'#c9a96e':c.status==='cliente'?'#1c4a35':'#888',border:'1px solid currentColor',textTransform:'uppercase',letterSpacing:'.06em',whiteSpace:'nowrap'}}>{c.status||'lead'}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:'rgba(14,14,13,.5)',whiteSpace:'nowrap'}}>€{((Number(c.budgetMin)||0)/1e6).toFixed(1)}M–€{((Number(c.budgetMax)||0)/1e6).toFixed(1)}M</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.4rem',color:urgency,whiteSpace:'nowrap',fontWeight:600}}>{days}d atrás</div>
                              <div style={{display:'flex',gap:'6px'}}>
                                <button style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',padding:'4px 10px',background:'rgba(58,123,213,.08)',color:'#3a7bd5',border:'1px solid rgba(58,123,213,.2)',cursor:'pointer',whiteSpace:'nowrap'}}
                                  onClick={()=>{ setSection('crm'); setActiveCrmId(c.id); setCrmProfileTab('overview') }}>→ CRM</button>
                                {c.phone && <a href={`https://wa.me/${c.phone.replace(/\s+/g,'')}`} target='_blank' rel='noopener' style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',padding:'4px 10px',background:'rgba(37,211,102,.08)',color:'#25d366',border:'1px solid rgba(37,211,102,.2)',textDecoration:'none',whiteSpace:'nowrap'}}>WA</a>}
                              </div>
                            </div>
                          )
                        })}
                      {crmContacts.filter(c=>c.lastContact&&Math.floor((today.getTime()-new Date(c.lastContact).getTime())/86400000)>=2&&Math.floor((today.getTime()-new Date(c.lastContact).getTime())/86400000)<=30).length===0 && (
                        <div style={{padding:'24px',textAlign:'center',fontFamily:"'Jost',sans-serif",fontSize:'.85rem',color:'rgba(14,14,13,.4)'}}>Sem follow-ups pendentes esta semana.</div>
                      )}
                    </div>
                  </div>

                  {/* Deal deadlines this week */}
                  <div style={{marginBottom:'32px'}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(14,14,13,.4)',marginBottom:'16px'}}>▸ Deadlines de Deals Esta Semana</div>
                    {deals.filter(d=>{
                      const hasDeadline = d.cpcvDate || d.escrituraDate
                      if (!hasDeadline) return false
                      const deadlineDate = new Date(d.escrituraDate || d.cpcvDate)
                      return deadlineDate >= weekDays[0] && deadlineDate <= weekDays[6]
                    }).length === 0 ? (
                      <div style={{padding:'24px',background:'rgba(28,74,53,.03)',border:'1px solid rgba(28,74,53,.1)',textAlign:'center',fontFamily:"'Jost',sans-serif",fontSize:'.85rem',color:'rgba(14,14,13,.4)'}}>
                        Sem deadlines de deals esta semana. ✓
                      </div>
                    ) : (
                      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                        {deals.filter(d=>(d.cpcvDate||d.escrituraDate)).map((d,i)=>{
                          const hasCPCV = d.cpcvDate && new Date(d.cpcvDate) >= weekDays[0] && new Date(d.cpcvDate) <= weekDays[6]
                          const hasEsc = d.escrituraDate && new Date(d.escrituraDate) >= weekDays[0] && new Date(d.escrituraDate) <= weekDays[6]
                          if (!hasCPCV && !hasEsc) return null
                          return (
                            <div key={i} style={{display:'flex',alignItems:'center',gap:'16px',padding:'14px 18px',background:'#fff',border:`1px solid ${hasEsc?'rgba(28,74,53,.2)':'rgba(201,169,110,.2)'}`,borderLeft:`3px solid ${hasEsc?'#1c4a35':'#c9a96e'}`}}>
                              <div style={{fontSize:'1.2rem'}}>{hasEsc?'🏠':'📋'}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:'.88rem',fontWeight:600,color:'#0e0e0d'}}>{d.imovel}</div>
                                <div style={{fontFamily:"'Jost',sans-serif",fontSize:'.8rem',color:'rgba(14,14,13,.5)',marginTop:'2px'}}>{d.comprador} · {d.valor}</div>
                              </div>
                              <div style={{textAlign:'right'}}>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.38rem',color:hasEsc?'#1c4a35':'#c9a96e',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'2px'}}>{hasEsc?'Escritura':'CPCV'}</div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'#0e0e0d',fontWeight:600}}>{new Date(hasEsc?d.escrituraDate!:d.cpcvDate!).toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short'})}</div>
                              </div>
                              <button className="p-btn" style={{fontSize:'.4rem',padding:'6px 14px'}} onClick={()=>{setSection('pipeline');setActiveDeal(d.id)}}>Ver Deal →</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick add event */}
                  <div style={{padding:'20px 24px',border:'2px dashed rgba(14,14,13,.1)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',flexWrap:'wrap'}}>
                    <div>
                      <div style={{fontSize:'.85rem',fontWeight:500,color:'#0e0e0d',marginBottom:'3px'}}>Adicionar Evento</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.44rem',color:'rgba(14,14,13,.4)'}}>Sincronize com Google Calendar ou adicione manualmente</div>
                    </div>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <button className="p-btn" style={{fontSize:'.44rem',padding:'8px 16px'}} onClick={()=>alert('Integração Google Calendar — em breve')}>
                        📅 Sync Google Cal
                      </button>
                      <button className="p-btn p-btn-gold" style={{fontSize:'.44rem',padding:'8px 16px'}} onClick={()=>{
                        const label = prompt('Descrição do evento:')
                        if (label) alert(`Evento "${label}" adicionado — funcionalidade de persistência em breve.`)
                      }}>+ Novo Evento</button>
                    </div>
                  </div>
                </div>
              )
            })()}

          </main>
        </div>
      </div>

      {/* ── CMD+K SEARCH MODAL ── */}
      {cmdkOpen && (
        <div style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(12,31,21,.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'15vh'}}
          onClick={()=>setCmdkOpen(false)}>
          <div style={{width:'560px',maxWidth:'90vw',background:'#fff',boxShadow:'0 20px 60px rgba(12,31,21,.25)',overflow:'hidden'}}
            onClick={e=>e.stopPropagation()}>
            {/* Search input */}
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px 20px',borderBottom:'1px solid rgba(14,14,13,.08)'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#1c4a35" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input autoFocus value={cmdkQuery} onChange={e=>setCmdkQuery(e.target.value)}
                placeholder="Pesquisar secções, imóveis, contactos..."
                style={{flex:1,border:'none',outline:'none',fontFamily:"'Jost',sans-serif",fontSize:'.9rem',color:'#0e0e0d',background:'transparent'}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.25)',background:'rgba(14,14,13,.06)',padding:'3px 8px',borderRadius:'3px'}}>ESC</span>
            </div>
            {/* Results */}
            <div style={{maxHeight:'60vh',overflowY:'auto'}}>
              {/* Section shortcuts */}
              {(cmdkQuery === '' || 'secções'.includes(cmdkQuery.toLowerCase())) && (
                <div style={{padding:'8px 0'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.3)',padding:'6px 20px',marginBottom:'2px'}}>Secções</div>
                  {NAV.filter(n=>cmdkQuery===''||n.label.toLowerCase().includes(cmdkQuery.toLowerCase())).map(n=>(
                    <div key={n.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 20px',cursor:'pointer',transition:'background .15s'}}
                      onClick={()=>{setSection(n.id);setCmdkOpen(false)}}
                      onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.background='rgba(28,74,53,.04)'}}
                      onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.background='transparent'}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#1c4a35" strokeWidth="1.5" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" d={n.icon}/></svg>
                      <span style={{fontSize:'.82rem',color:'#0e0e0d'}}>{n.label}</span>
                      {n.group && <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.3)',marginLeft:'auto'}}>{n.group}</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Property search */}
              {cmdkQuery.length >= 2 && (
                <div style={{padding:'8px 0',borderTop:'1px solid rgba(14,14,13,.06)'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.3)',padding:'6px 20px',marginBottom:'2px'}}>Imóveis</div>
                  {imoveisList.filter(p=>String(p.nome).toLowerCase().includes(cmdkQuery.toLowerCase())||String(p.zona).toLowerCase().includes(cmdkQuery.toLowerCase())).slice(0,4).map(p=>(
                    <div key={p.id as string} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 20px',cursor:'pointer',transition:'background .15s'}}
                      onClick={()=>{setSection('imoveis');setCmdkOpen(false)}}
                      onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.background='rgba(201,169,110,.04)'}}
                      onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.background='transparent'}}>
                      <span style={{fontSize:'.9rem'}}>🏠</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'.8rem',color:'#0e0e0d',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{String(p.nome)}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>{String(p.zona)} · €{(Number(p.preco)/1e6).toFixed(2)}M</div>
                      </div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'#c9a96e',flexShrink:0}}>{String(p.badge||'')}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Contact search */}
              {cmdkQuery.length >= 2 && (
                <div style={{padding:'8px 0',borderTop:'1px solid rgba(14,14,13,.06)'}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(14,14,13,.3)',padding:'6px 20px',marginBottom:'2px'}}>Contactos CRM</div>
                  {crmContacts.filter(c=>c.name.toLowerCase().includes(cmdkQuery.toLowerCase())||c.email.toLowerCase().includes(cmdkQuery.toLowerCase())).slice(0,3).map(c=>(
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 20px',cursor:'pointer',transition:'background .15s'}}
                      onClick={()=>{setActiveCrmId(c.id);setSection('crm');setCmdkOpen(false)}}
                      onMouseOver={e=>{(e.currentTarget as HTMLDivElement).style.background='rgba(201,169,110,.04)'}}
                      onMouseOut={e=>{(e.currentTarget as HTMLDivElement).style.background='transparent'}}>
                      <span style={{fontSize:'.9rem'}}>{c.status==='vip'?'⭐':c.status==='cliente'?'✅':'👤'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'.8rem',color:'#0e0e0d',fontWeight:500}}>{c.name}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.4)'}}>{c.nationality} · €{((c.budgetMin||0)/1e6).toFixed(1)}M–€{((c.budgetMax||0)/1e6).toFixed(1)}M</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{padding:'8px 20px',borderTop:'1px solid rgba(14,14,13,.06)',display:'flex',gap:'16px',alignItems:'center'}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.25)'}}>↑↓ navegar</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.25)'}}>↵ abrir</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.25)'}}>Esc fechar</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:'.36rem',color:'rgba(14,14,13,.2)',marginLeft:'auto'}}>⌘K</span>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING ACTION BUTTON ── */}
      <div style={{position:'fixed',bottom:'28px',right:'28px',zIndex:8000,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'10px'}}>
        {fabOpen && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',alignItems:'flex-end'}}>
            {[
              { label:'⌘K Pesquisa Rápida', action:()=>{setCmdkOpen(true);setFabOpen(false)} },
              { label:'👤 Novo Contacto CRM', action:()=>{setSection('crm');setShowNewContact(true);setFabOpen(false)} },
              { label:'+ Novo Deal', action:()=>{setSection('pipeline');setShowNewDeal(true);setFabOpen(false)} },
              { label:'✦ Investor Pitch', action:()=>{setSection('investorpitch');setFabOpen(false)} },
              { label:'🎬 Sofia Avatar', action:()=>{setSection('sofia');setFabOpen(false)} },
              { label:'⚖ Jurídico IA', action:()=>{setSection('juridico');setFabOpen(false)} },
              { label:'📊 AVM Avaliação', action:()=>{setSection('avm');setFabOpen(false)} },
              { label:'📈 Dashboard', action:()=>{setSection('dashboard');setFabOpen(false)} },
            ].map(item=>(
              <button key={item.label} onClick={item.action}
                style={{background:'#0c1f15',color:'#f4f0e6',border:'1px solid rgba(201,169,110,.2)',padding:'9px 18px',fontFamily:"'DM Mono',monospace",fontSize:'.44rem',letterSpacing:'.08em',cursor:'pointer',boxShadow:'0 4px 16px rgba(12,31,21,.3)',transition:'all .15s',whiteSpace:'nowrap'}}
                onMouseOver={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#c9a96e';(e.currentTarget as HTMLButtonElement).style.color='#c9a96e'}}
                onMouseOut={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(201,169,110,.2)';(e.currentTarget as HTMLButtonElement).style.color='#f4f0e6'}}>
                {item.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={()=>setFabOpen(o=>!o)}
          style={{width:'52px',height:'52px',borderRadius:'50%',background:fabOpen?'#c9a96e':'#0c1f15',border:'2px solid rgba(201,169,110,.3)',color:fabOpen?'#0c1f15':'#c9a96e',fontSize:'1.3rem',cursor:'pointer',boxShadow:'0 6px 24px rgba(12,31,21,.35)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .25s',transform:fabOpen?'rotate(45deg)':'rotate(0deg)'}}>
          {fabOpen ? '×' : '⚡'}
        </button>
      </div>

      {/* FULLSCREEN LIGHTBOX */}
      {lightboxOpen && lightboxPhotos.length > 0 && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.97)', display:'flex', flexDirection:'column', userSelect:'none' }} onClick={() => setLightboxOpen(false)}>
          {/* Top bar */}
          <div style={{ padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.15em', color:'rgba(255,255,255,.3)' }}>
              {lightboxPhotos[lightboxIdx]?.label || ''}
            </div>
            <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.1em', color:'rgba(255,255,255,.4)' }}>{lightboxIdx + 1} / {lightboxPhotos.length}</div>
              <button onClick={() => setLightboxOpen(false)} style={{ background:'none', border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.5)', padding:'6px 16px', fontFamily:"'DM Mono',monospace", fontSize:'.34rem', letterSpacing:'.1em', cursor:'pointer' }}>✕ ESC</button>
            </div>
          </div>

          {/* Main image */}
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', minHeight:0 }} onClick={e => e.stopPropagation()}>
            {/* Prev arrow */}
            {lightboxIdx > 0 && (
              <button onClick={() => setLightboxIdx(i => i-1)} style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.7)', width:'48px', height:'80px', cursor:'pointer', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, transition:'background .2s' }} onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,.14)'} onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,.07)'}>‹</button>
            )}
            <img
              src={lightboxPhotos[lightboxIdx]?.url}
              alt={lightboxPhotos[lightboxIdx]?.label || ''}
              style={{ maxWidth:'calc(100% - 120px)', maxHeight:'100%', objectFit:'contain', display:'block', transition:'opacity .2s' }}
            />
            {/* Next arrow */}
            {lightboxIdx < lightboxPhotos.length - 1 && (
              <button onClick={() => setLightboxIdx(i => i+1)} style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.7)', width:'48px', height:'80px', cursor:'pointer', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, transition:'background .2s' }} onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,.14)'} onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,.07)'}>›</button>
            )}
          </div>

          {/* Label below image */}
          {lightboxPhotos[lightboxIdx]?.label && (
            <div style={{ textAlign:'center', padding:'10px', fontFamily:"'Cormorant',serif", fontSize:'1rem', color:'rgba(255,255,255,.35)', fontStyle:'italic', flexShrink:0 }} onClick={e => e.stopPropagation()}>
              {lightboxPhotos[lightboxIdx].label}
            </div>
          )}

          {/* Thumbnail strip */}
          <div style={{ display:'flex', gap:'4px', padding:'8px 16px 16px', overflowX:'auto', flexShrink:0, justifyContent:'center' }} onClick={e => e.stopPropagation()}>
            {lightboxPhotos.map((p, i) => (
              <div key={i} onClick={() => setLightboxIdx(i)} style={{ flexShrink:0, width:'64px', height:'44px', overflow:'hidden', cursor:'pointer', opacity: i === lightboxIdx ? 1 : 0.35, border: i === lightboxIdx ? '2px solid #c9a96e' : '2px solid transparent', transition:'opacity .2s, border .2s' }}>
                <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROPERTY SHOWCASE MODAL */}
      {showcaseImovel && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(5,14,9,.96)', backdropFilter:'blur(20px)', overflowY:'auto' }} onClick={e => { if (e.target === e.currentTarget) setShowcaseImovel(null) }}>
          <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 0 80px' }}>
            {/* Close */}
            <div style={{ position:'sticky', top:0, zIndex:10, padding:'20px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(5,14,9,.9)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)' }}>Agency Group · Showcase</div>
              <button onClick={() => setShowcaseImovel(null)} style={{ background:'none', border:'1px solid rgba(201,169,110,.2)', color:'rgba(244,240,230,.5)', padding:'8px 20px', fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.1em', cursor:'pointer' }}>✕ Fechar</button>
            </div>

            {/* Hero Carousel */}
            {(() => {
              const photos = (showcaseImovel.photos as string[]) || []
              const hero = (showcaseImovel.heroPhoto as string) || photos[0]
              const allPhotos = hero && !photos.includes(hero) ? [hero, ...photos] : photos.length > 0 ? photos : hero ? [hero] : []
              const currentPhoto = allPhotos[showcaseCarouselIdx] || hero
              if (!currentPhoto) return null
              const analyses = (showcaseImovel.photoAnalyses as Record<string,unknown>[]) || []
              const currentAnalysis = analyses[showcaseCarouselIdx]
              return (
                <div style={{ position:'relative' }}>
                  {/* Main hero */}
                  <div style={{ position:'relative', height:'clamp(380px,55vw,580px)', overflow:'hidden', cursor:'pointer' }} onClick={() => openLightbox(allPhotos.map((u,i) => ({ url: u, label: String(analyses[i]?.roomType || '') })), showcaseCarouselIdx)}>
                    <img src={currentPhoto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'opacity .3s' }} />
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(5,14,9,.15) 0%, transparent 35%, rgba(5,14,9,.75) 100%)' }} />
                    {/* Expand hint */}
                    <div style={{ position:'absolute', top:'20px', right:'20px', background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)', color:'rgba(255,255,255,.6)', fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.1em', padding:'5px 12px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                      {allPhotos.length} fotos
                    </div>
                    {/* Nav arrows */}
                    {showcaseCarouselIdx > 0 && <button onClick={e => { e.stopPropagation(); setShowcaseCarouselIdx(i => i-1) }} style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,.4)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.8)', width:'44px', height:'44px', cursor:'pointer', fontSize:'20px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>}
                    {showcaseCarouselIdx < allPhotos.length - 1 && <button onClick={e => { e.stopPropagation(); setShowcaseCarouselIdx(i => i+1) }} style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,.4)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.8)', width:'44px', height:'44px', cursor:'pointer', fontSize:'20px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>}
                    {/* Overlay content */}
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'40px 48px 36px' }}>
                      {(showcaseImovel.badge as string) && <div style={{ display:'inline-block', background:'#c9a96e', color:'#0c1f15', fontFamily:"'DM Mono',monospace", fontSize:'.34rem', letterSpacing:'.14em', textTransform:'uppercase', padding:'5px 14px', marginBottom:'12px', fontWeight:700 }}>{showcaseImovel.badge as string}</div>}
                      <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'clamp(1.8rem,4vw,2.8rem)', color:'#f4f0e6', lineHeight:1.1, marginBottom:'8px', fontStyle:'italic' }}>
                        {((showcaseImovel.aiDescription as Record<string,unknown>)?.headline as string) || (showcaseImovel.nome as string)}
                      </div>
                      {(showcaseImovel.aiDescription as Record<string,unknown>)?.subheadline && (
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.88rem', color:'rgba(244,240,230,.6)', maxWidth:'560px' }}>{(showcaseImovel.aiDescription as Record<string,unknown>).subheadline as string}</div>
                      )}
                      <div style={{ display:'flex', gap:'16px', alignItems:'center', marginTop:'12px', flexWrap:'wrap' }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.36rem', color:'rgba(201,169,110,.6)', letterSpacing:'.1em' }}>{showcaseImovel.bairro as string}{showcaseImovel.bairro ? ' · ' : ''}{showcaseImovel.zona as string}</div>
                        {currentAnalysis?.roomType && <div style={{ background:'rgba(201,169,110,.15)', color:'#c9a96e', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', letterSpacing:'.08em', padding:'3px 8px' }}>{String(currentAnalysis.roomType)}</div>}
                      </div>
                    </div>
                    {/* Dot indicators */}
                    {allPhotos.length > 1 && (
                      <div style={{ position:'absolute', bottom:'14px', right:'20px', display:'flex', gap:'4px' }}>
                        {allPhotos.slice(0, 12).map((_,i) => (
                          <div key={i} onClick={e => { e.stopPropagation(); setShowcaseCarouselIdx(i) }} style={{ width: i===showcaseCarouselIdx ? '20px' : '6px', height:'6px', borderRadius:'3px', background: i===showcaseCarouselIdx ? '#c9a96e' : 'rgba(255,255,255,.3)', cursor:'pointer', transition:'all .25s' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Thumbnail strip */}
                  {allPhotos.length > 1 && (
                    <div style={{ display:'flex', gap:'3px', background:'rgba(0,0,0,.6)' }}>
                      {allPhotos.slice(0,10).map((p,i) => (
                        <div key={i} onClick={() => setShowcaseCarouselIdx(i)} style={{ flex:1, height:'56px', overflow:'hidden', cursor:'pointer', opacity: i===showcaseCarouselIdx ? 1 : 0.45, border: i===showcaseCarouselIdx ? '2px solid #c9a96e' : '2px solid transparent', transition:'opacity .2s, border .2s', position:'relative' }}>
                          <img src={p} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          {analyses[i]?.roomType && <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.6)', fontFamily:"'DM Mono',monospace", fontSize:'.25rem', letterSpacing:'.04em', color:'rgba(255,255,255,.5)', padding:'2px 4px', textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(analyses[i].roomType)}</div>}
                        </div>
                      ))}
                      {allPhotos.length > 10 && <div style={{ flex:1, height:'56px', background:'rgba(201,169,110,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", fontSize:'.3rem', color:'rgba(201,169,110,.6)', cursor:'pointer' }} onClick={() => openLightbox(allPhotos.map((u,i)=>({url:u,label:String(analyses[i]?.roomType||'')})),0)}>+{allPhotos.length-10}</div>}
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ padding:'0 48px' }}>
              {/* Price + Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'48px', alignItems:'start', padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                <div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.15em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'8px' }}>Preço Pedido</div>
                  <div style={{ fontFamily:"'Cormorant',serif", fontSize:'2.8rem', color:'#c9a96e', fontWeight:300 }}>€{Number(showcaseImovel.preco).toLocaleString('pt-PT')}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.36rem', color:'rgba(244,240,230,.3)', marginTop:'4px' }}>€{Math.round(Number(showcaseImovel.preco)/Number(showcaseImovel.area)).toLocaleString('pt-PT')}/m²</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px' }}>
                  {[
                    { label:'Área', value: `${showcaseImovel.area}m²` },
                    { label:'Tipologia', value: `T${showcaseImovel.quartos}` },
                    { label:'Casas Banho', value: String(showcaseImovel.casasBanho || '—') },
                    { label:'Tipo', value: showcaseImovel.tipo as string },
                  ].map(s => (
                    <div key={s.label} style={{ background:'rgba(244,240,230,.03)', border:'1px solid rgba(201,169,110,.1)', padding:'16px' }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.32rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.35)', marginBottom:'8px' }}>{s.label}</div>
                      <div style={{ fontFamily:"'Cormorant',serif", fontSize:'1.3rem', color:'#f4f0e6' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo Gallery */}
              {(showcaseImovel.photos as string[])?.length > 1 && (
                <div style={{ padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'20px' }}>Galeria · {(showcaseImovel.photos as string[]).length} Fotografias</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'6px' }}>
                    {(showcaseImovel.photos as string[]).map((photo, i) => {
                      const analysis = (showcaseImovel.photoAnalyses as Record<string,unknown>[])?.[i]
                      const qScore = Number(analysis?.qualityScore || 0)
                      const luxuries = (analysis?.luxuryIndicators as string[] || [])
                      return (
                        <div key={i} onClick={() => openLightbox((showcaseImovel.photos as string[]).map((u,j) => ({ url: u, label: String((showcaseImovel.photoAnalyses as Record<string,unknown>[])?.[j]?.roomType || '') })), i)}
                          style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden', cursor:'pointer', border: i === showcaseCarouselIdx ? '2px solid #c9a96e' : '2px solid transparent', transition:'border-color .2s' }}>
                          <img src={photo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .35s' }} onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1.07)'} onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform='scale(1)'} />
                          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 55%, rgba(5,14,9,.8))' }} />
                          {analysis && (
                            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 10px 8px' }}>
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.28rem', letterSpacing:'.08em', textTransform:'uppercase', color:'rgba(201,169,110,.75)', marginBottom:'3px' }}>{analysis.roomType as string}</div>
                              {luxuries.length > 0 && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.24rem', color:'rgba(255,255,255,.35)', letterSpacing:'.04em' }}>{luxuries.slice(0,2).join(' · ')}</div>}
                            </div>
                          )}
                          {qScore >= 8 && <div style={{ position:'absolute', top:'6px', right:'6px', background:'rgba(74,156,122,.8)', color:'#fff', fontFamily:"'DM Mono',monospace", fontSize:'.25rem', padding:'2px 5px' }}>★ {qScore}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              {(showcaseImovel.desc as string) && (
                <div style={{ padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'24px' }}>Descrição</div>
                  {(showcaseImovel.aiDescription as Record<string,unknown>)?.headline && (
                    <div style={{ fontFamily:"'Cormorant',serif", fontStyle:'italic', fontSize:'1.5rem', color:'#c9a96e', marginBottom:'12px' }}>{(showcaseImovel.aiDescription as Record<string,unknown>).headline as string}</div>
                  )}
                  <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.88rem', lineHeight:1.9, color:'rgba(244,240,230,.65)', whiteSpace:'pre-line', columnCount:1 }}>{showcaseImovel.desc as string}</div>
                </div>
              )}

              {/* Key Features */}
              {(showcaseImovel.aiDescription as Record<string,unknown>)?.keyFeatures && (
                <div style={{ padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'20px' }}>Características de Destaque</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:'12px' }}>
                    {((showcaseImovel.aiDescription as Record<string,unknown>).keyFeatures as string[]).map((f, i) => (
                      <div key={i} style={{ display:'flex', gap:'12px', alignItems:'flex-start', padding:'14px 16px', background:'rgba(244,240,230,.03)', border:'1px solid rgba(201,169,110,.1)' }}>
                        <div style={{ color:'#c9a96e', flexShrink:0, marginTop:'2px' }}>✦</div>
                        <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.83rem', color:'rgba(244,240,230,.65)', lineHeight:1.5 }}>{f}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amenities */}
              <div style={{ padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'20px' }}>Comodidades</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
                  {[
                    showcaseImovel.piscina && '🏊 Piscina',
                    showcaseImovel.jardim && '🌿 Jardim',
                    showcaseImovel.terraco && '🌅 Terraço',
                    showcaseImovel.garagem && '🚗 Garagem',
                    showcaseImovel.condominio && '🏢 Condomínio Fechado',
                    showcaseImovel.vista && `👁 Vista ${showcaseImovel.vista}`,
                    showcaseImovel.energia && `⚡ Classe Energética ${showcaseImovel.energia}`,
                    showcaseImovel.tourUrl && '🔮 Tour Virtual 3D',
                  ].filter(Boolean).map((a, i) => (
                    <div key={i} style={{ background:'rgba(28,74,53,.15)', border:'1px solid rgba(28,74,53,.3)', color:'rgba(244,240,230,.75)', fontFamily:"'Jost',sans-serif", fontSize:'.82rem', padding:'8px 16px' }}>{a as string}</div>
                  ))}
                </div>
              </div>

              {/* Investment angle */}
              {(showcaseImovel.aiDescription as Record<string,unknown>)?.investmentAngle && (
                <div style={{ padding:'40px 0', borderBottom:'1px solid rgba(201,169,110,.1)' }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'16px' }}>Ângulo de Investimento</div>
                  <div style={{ background:'rgba(201,169,110,.05)', border:'1px solid rgba(201,169,110,.15)', borderLeft:'3px solid #c9a96e', padding:'20px 24px' }}>
                    <div style={{ fontFamily:"'Jost',sans-serif", fontSize:'.85rem', color:'rgba(244,240,230,.65)', lineHeight:1.8 }}>{(showcaseImovel.aiDescription as Record<string,unknown>).investmentAngle as string}</div>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div style={{ padding:'40px 0', textAlign:'center' }}>
                <div style={{ fontFamily:"'Cormorant',serif", fontWeight:300, fontSize:'1.6rem', color:'#f4f0e6', marginBottom:'8px', fontStyle:'italic' }}>
                  {((showcaseImovel.aiDescription as Record<string,unknown>)?.ctaText as string) || 'Agende uma visita privada'}
                </div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:'.38rem', color:'rgba(244,240,230,.35)', marginBottom:'32px', letterSpacing:'.1em' }}>Agency Group · AMI 22506 · Comissão 5%</div>
                <div style={{ display:'flex', gap:'16px', justifyContent:'center', flexWrap:'wrap' }}>
                  <a href="tel:+351919191919" style={{ background:'#c9a96e', color:'#0c1f15', fontFamily:"'DM Mono',monospace", fontSize:'.44rem', letterSpacing:'.15em', textTransform:'uppercase', padding:'14px 36px', textDecoration:'none', fontWeight:700 }}>Ligar Agora</a>
                  <a href={`/imoveis/${showcaseImovel.id as string}`} target='_blank' rel='noopener' style={{ background:'transparent', color:'#c9a96e', border:'1px solid rgba(201,169,110,.4)', fontFamily:"'DM Mono',monospace", fontSize:'.44rem', letterSpacing:'.15em', textTransform:'uppercase', padding:'14px 36px', textDecoration:'none' }}>Ver Página Completa</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
