'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocCategory = 'Contratos' | 'Jurídico' | 'Fiscal' | 'Marketing' | 'Templates' | 'Due Diligence'
type DocFileType = 'PDF' | 'DOCX' | 'XLSX' | 'Template'
type DocTab = 'biblioteca' | 'checklists' | 'templates' | 'gerador'

interface DocItem {
  id: string
  name: string
  category: DocCategory
  type: DocFileType
  size: string
  date: string
  downloads: number
  description: string
}

interface ChecklistItem {
  id: string
  name: string
  responsible: 'Comprador' | 'Vendedor' | 'AG' | 'Advogado' | 'Banco'
  deadline: string
  required: boolean
}

interface ChecklistStage {
  id: string
  label: string
  items: ChecklistItem[]
}

interface Template {
  id: string
  name: string
  category: string
  description: string
  content: string
  langs?: string[]
  popular?: boolean
}

interface GeneratorDocType {
  id: string
  label: string
  fields: { id: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] }[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: DocItem[] = [
  { id: 'd1',  name: 'CPCV Standard — Habitação 2026',         category: 'Contratos',     type: 'DOCX', size: '124 KB', date: '2026-03-15', downloads: 47, description: 'Contrato promessa compra e venda com cláusulas 2026' },
  { id: 'd2',  name: 'Contrato Mediação Exclusiva',            category: 'Contratos',     type: 'PDF',  size: '89 KB',  date: '2026-03-10', downloads: 32, description: 'AMI 22506 — angariação em exclusividade' },
  { id: 'd3',  name: 'Contrato Mediação Não-Exclusiva',        category: 'Contratos',     type: 'PDF',  size: '85 KB',  date: '2026-03-10', downloads: 18, description: 'AMI 22506 — angariação não exclusiva' },
  { id: 'd4',  name: 'Minuta Distrate Hipoteca',               category: 'Contratos',     type: 'DOCX', size: '67 KB',  date: '2026-02-28', downloads: 9,  description: 'Cancelamento de hipoteca bancária na escritura' },
  { id: 'd5',  name: 'Certidão Permanente — Guia Prático',     category: 'Jurídico',      type: 'PDF',  size: '210 KB', date: '2026-03-20', downloads: 63, description: 'Como obter, interpretar e validar a certidão predial' },
  { id: 'd6',  name: 'Guia NHR / IFICI 2026',                  category: 'Jurídico',      type: 'PDF',  size: '340 KB', date: '2026-03-18', downloads: 88, description: 'Regime fiscal de residentes não habituais actualizado' },
  { id: 'd7',  name: 'Guia Golden Visa / ARI 2026',            category: 'Jurídico',      type: 'PDF',  size: '280 KB', date: '2026-03-01', downloads: 55, description: 'Procedimentos, requisitos e prazos actualizados' },
  { id: 'd8',  name: 'Obrigações AML — Due Diligence',         category: 'Jurídico',      type: 'PDF',  size: '195 KB', date: '2026-02-15', downloads: 29, description: 'Anti-branqueamento: obrigações do mediador imobiliário' },
  { id: 'd9',  name: 'Simulador IMT — Tabelas 2026',           category: 'Fiscal',        type: 'XLSX', size: '88 KB',  date: '2026-01-05', downloads: 124,description: 'Escalões IMT habitação própria permanente, secundária, comercial' },
  { id: 'd10', name: 'Custos de Transacção — Calculadora',     category: 'Fiscal',        type: 'XLSX', size: '112 KB', date: '2026-01-10', downloads: 97, description: 'IMT + IS + Notário + Registo + Comissão AG' },
  { id: 'd11', name: 'Declaração Rendimentos Arrendamento',    category: 'Fiscal',        type: 'PDF',  size: '78 KB',  date: '2026-02-01', downloads: 34, description: 'IRS categoria F — rendimentos prediais 2025' },
  { id: 'd12', name: 'Ficha de Imóvel Premium — A4',           category: 'Marketing',     type: 'DOCX', size: '450 KB', date: '2026-03-22', downloads: 41, description: 'Template apresentação imóvel para clientes premium' },
  { id: 'd13', name: 'Deal Memo Investidor EN',                category: 'Marketing',     type: 'DOCX', size: '230 KB', date: '2026-03-12', downloads: 28, description: 'Investment summary in English for international buyers' },
  { id: 'd14', name: 'Apresentação Portfólio Agency Group',    category: 'Marketing',     type: 'PDF',  size: '8.2 MB', date: '2026-03-08', downloads: 15, description: 'Credenciais e portfólio 2026 para novos clientes' },
  { id: 'd15', name: 'Proposta Angariação Exclusiva',          category: 'Templates',     type: 'DOCX', size: '145 KB', date: '2026-03-19', downloads: 52, description: 'Proposta formal para captação de imóvel em exclusividade' },
  { id: 'd16', name: 'Template Follow-Up Pós-Visita',          category: 'Templates',     type: 'DOCX', size: '68 KB',  date: '2026-03-14', downloads: 39, description: 'Email + WhatsApp sequência após visita a imóvel' },
  { id: 'd17', name: 'Sequência Captação Off-Market',          category: 'Templates',     type: 'DOCX', size: '92 KB',  date: '2026-03-05', downloads: 23, description: '5 toques para abordagem de imóveis fora de mercado' },
  { id: 'd18', name: 'Relatório Due Diligence Premium',        category: 'Due Diligence', type: 'DOCX', size: '380 KB', date: '2026-03-17', downloads: 19, description: 'Template completo para imóveis acima de €500K' },
  { id: 'd19', name: 'Checklist Auditoria Condomínio',         category: 'Due Diligence', type: 'PDF',  size: '156 KB', date: '2026-02-22', downloads: 11, description: 'Dívidas, obras pendentes, regulamento, fracções' },
  { id: 'd20', name: 'Relatório AVM — Avaliação de Mercado',   category: 'Due Diligence', type: 'DOCX', size: '290 KB', date: '2026-03-03', downloads: 36, description: 'Template de avaliação automática de valor de mercado' },
]

const DEAL_CHECKLISTS: ChecklistStage[] = [
  {
    id: 'qualificacao',
    label: 'Qualificação do Comprador',
    items: [
      { id: 'q1', name: 'Documentos de identidade (CC/Passaporte)', responsible: 'Comprador', deadline: 'No 1º contacto', required: true },
      { id: 'q2', name: 'NIF Português (ou em processo)', responsible: 'Comprador', deadline: 'Antes da visita', required: true },
      { id: 'q3', name: 'Comprovativo de capacidade financeira', responsible: 'Comprador', deadline: 'Antes da proposta', required: true },
      { id: 'q4', name: 'Declaração de origem dos fundos (AML)', responsible: 'Comprador', deadline: 'Antes do CPCV', required: true },
      { id: 'q5', name: 'Carta de pré-aprovação bancária (se financia)', responsible: 'Banco', deadline: 'Antes da proposta', required: false },
      { id: 'q6', name: 'Procurador em Portugal (se não-residente)', responsible: 'Comprador', deadline: 'Antes do CPCV', required: false },
      { id: 'q7', name: 'Ficha de Cliente AG preenchida', responsible: 'AG', deadline: '24h após 1º contacto', required: true },
      { id: 'q8', name: 'Assinatura RGPD / Consentimento dados', responsible: 'Comprador', deadline: 'No 1º contacto', required: true },
    ],
  },
  {
    id: 'due_diligence',
    label: 'Due Diligence Imóvel',
    items: [
      { id: 'dd1',  name: 'Certidão Predial Permanente (CRP)',        responsible: 'AG',       deadline: 'Antes da proposta', required: true },
      { id: 'dd2',  name: 'Caderneta Predial Actualizada (AT)',        responsible: 'Vendedor', deadline: 'Antes da proposta', required: true },
      { id: 'dd3',  name: 'Licença de Habitação / Utilização',         responsible: 'Vendedor', deadline: 'Antes do CPCV',    required: true },
      { id: 'dd4',  name: 'Certificado Energético (CE) válido',        responsible: 'Vendedor', deadline: 'Antes do CPCV',    required: true },
      { id: 'dd5',  name: 'Planta do Imóvel aprovada pela CM',         responsible: 'Vendedor', deadline: 'Antes da proposta', required: true },
      { id: 'dd6',  name: 'Ficha Técnica de Habitação (pós-2004)',     responsible: 'Vendedor', deadline: 'Antes do CPCV',    required: false },
      { id: 'dd7',  name: 'Declaração sem dívidas ao condomínio',      responsible: 'Vendedor', deadline: '3 dias antes CPCV', required: true },
      { id: 'dd8',  name: 'Declaração de não dívidas à AT (IMI)',      responsible: 'Vendedor', deadline: 'Antes da escritura', required: true },
      { id: 'dd9',  name: 'Verificação de ónus / hipotecas (CRP)',     responsible: 'Advogado', deadline: 'Antes da proposta', required: true },
      { id: 'dd10', name: 'Relatório de Avaliação AVM',                responsible: 'AG',       deadline: 'Antes da proposta', required: false },
      { id: 'dd11', name: 'Licença de Construção (se obras recentes)', responsible: 'Vendedor', deadline: 'Antes do CPCV',    required: false },
      { id: 'dd12', name: 'Seguro Multirriscos (se AL activo)',        responsible: 'Vendedor', deadline: 'Antes da escritura', required: false },
    ],
  },
  {
    id: 'cpcv',
    label: 'CPCV — Documentos Necessários',
    items: [
      { id: 'c1',  name: 'Minutas CPCV redigidas por advogado',        responsible: 'Advogado', deadline: '5 dias antes CPCV',  required: true },
      { id: 'c2',  name: 'CC/Passaporte do Comprador (cópia)',          responsible: 'Comprador', deadline: 'Dia do CPCV',       required: true },
      { id: 'c3',  name: 'NIF do Comprador',                            responsible: 'Comprador', deadline: 'Dia do CPCV',       required: true },
      { id: 'c4',  name: 'CC + NIF do Vendedor',                        responsible: 'Vendedor',  deadline: 'Dia do CPCV',       required: true },
      { id: 'c5',  name: 'Certidão Predial (≤ 30 dias)',               responsible: 'AG',        deadline: 'Dia do CPCV',       required: true },
      { id: 'c6',  name: 'Comprovativo de pagamento de sinal',          responsible: 'Comprador', deadline: 'Dia do CPCV',       required: true },
      { id: 'c7',  name: 'Procuração (se representado)',                responsible: 'Comprador', deadline: '3 dias antes CPCV', required: false },
      { id: 'c8',  name: 'Promessa de financiamento (carta banco)',     responsible: 'Banco',     deadline: 'Dia do CPCV',       required: false },
      { id: 'c9',  name: 'NIF Não-Residente (se aplicável)',            responsible: 'Comprador', deadline: '5 dias antes CPCV', required: false },
      { id: 'c10', name: 'Certidão de casamento / estado civil (se pedido)', responsible: 'Comprador', deadline: 'Dia do CPCV', required: false },
    ],
  },
  {
    id: 'escritura',
    label: 'Escritura — Checklist Final',
    items: [
      { id: 'e1', name: 'Guia IMT liquidado (DUC)',                    responsible: 'Comprador', deadline: '1 dia antes',       required: true },
      { id: 'e2', name: 'Guia Imposto de Selo (0,8%) liquidado',      responsible: 'Comprador', deadline: '1 dia antes',       required: true },
      { id: 'e3', name: 'Certidão Predial válida no dia',              responsible: 'Advogado',  deadline: 'Dia da escritura',  required: true },
      { id: 'e4', name: 'Certificado Energético (nº CE para notário)', responsible: 'Vendedor',  deadline: 'Dia da escritura',  required: true },
      { id: 'e5', name: 'Licença de Utilização original',              responsible: 'Vendedor',  deadline: 'Dia da escritura',  required: true },
      { id: 'e6', name: 'Distrate de hipoteca (se existir)',           responsible: 'Banco',     deadline: 'Dia da escritura',  required: false },
      { id: 'e7', name: 'Certidão comercial + acta (se empresa)',      responsible: 'Vendedor',  deadline: '3 dias antes',      required: false },
      { id: 'e8', name: 'Comissão AG — transferência confirmada',      responsible: 'AG',        deadline: 'Dia da escritura',  required: true },
    ],
  },
  {
    id: 'pos_escritura',
    label: 'Pós-Escritura',
    items: [
      { id: 'p1', name: 'Registo predial da aquisição (CRP)',          responsible: 'Advogado',  deadline: '30 dias após',      required: true },
      { id: 'p2', name: 'Actualização caderneta predial (AT)',         responsible: 'Comprador', deadline: '60 dias após',      required: true },
      { id: 'p3', name: 'Notificação de seguro multirriscos',         responsible: 'Comprador', deadline: '15 dias após',      required: false },
      { id: 'p4', name: 'Envio de documentos ao contabilista',        responsible: 'Comprador', deadline: '30 dias após',      required: false },
      { id: 'p5', name: 'Actualização registo condomínio',            responsible: 'AG',        deadline: '15 dias após',      required: true },
    ],
  },
]

const TEMPLATES: Template[] = [
  { id: 't1',  name: 'Carta de Apresentação Premium',          category: 'Prospecção',  popular: true,  description: 'Carta formal de apresentação da Agency Group para proprietários premium', langs: ['PT'],           content: 'Exmo(a) Sr(a). {nome},\n\nÉ com grande prazer que nos apresentamos...\n\nO imóvel em {morada} tem potencial de venda no valor de {preco}.\n\nAtenciosamente,\n{consultor}\nAgency Group — AMI 22506' },
  { id: 't2',  name: 'Proposta de Angariação Exclusiva',       category: 'Angariação',  popular: true,  description: 'Proposta formal para captação em exclusividade com condições claras', langs: ['PT'],           content: 'PROPOSTA DE ANGARIAÇÃO EXCLUSIVA\n\nImóvel: {imovel}\nEndereço: {morada}\nValor Proposto: {preco}\nPrazo de Exclusividade: {prazo}\nComissão: 5% + IVA\n\nA Agency Group (AMI 22506) compromete-se a...' },
  { id: 't3',  name: 'Deal Memo Investidor',                   category: 'Investimento',popular: true,  description: 'Memorando de investimento estruturado para investidores internacionais', langs: ['PT', 'EN', 'FR'], content: 'INVESTMENT MEMORANDUM\n\nProperty: {imovel}\nAsking Price: {preco}\nExpected Yield: {yield}%\nLocation: {morada}\n\nExecutive Summary:\nThis property represents...' },
  { id: 't4',  name: 'NDA — Acordo de Confidencialidade',      category: 'Jurídico',    popular: false, description: 'Non-Disclosure Agreement para partilha de informação sensível off-market', langs: ['PT', 'EN'],     content: 'ACORDO DE CONFIDENCIALIDADE\n\nEntre: Agency Group (AMI 22506)\nE: {nome}\n\nO signatário compromete-se a manter absoluta confidencialidade sobre {imovel}...' },
  { id: 't5',  name: 'Carta Outreach Off-Market',              category: 'Prospecção',  popular: false, description: 'Abordagem a proprietários de imóveis fora do mercado identificados', langs: ['PT'],            content: 'Exmo(a) Sr(a). {nome},\n\nTemos um comprador qualificado com disponibilidade imediata interessado especificamente na zona de {zona}...' },
  { id: 't6',  name: 'Relatório de Avaliação AVM',             category: 'Avaliação',   popular: false, description: 'Template de relatório de avaliação automática de valor de mercado', langs: ['PT'],            content: 'RELATÓRIO DE AVALIAÇÃO\n\nImóvel: {imovel}\nData: {data}\nAreaBruta: {area} m²\nValor Estimado: {preco}\n\nMetodologia: Comparáveis de mercado...' },
  { id: 't7',  name: 'Termo de Responsabilidade Visita',       category: 'Legal',       popular: false, description: 'Declaração de responsabilidade a assinar pelo cliente antes de visita', langs: ['PT'],            content: 'TERMO DE RESPONSABILIDADE\n\nDeclaro que {nome}, titular do CC nº {cc}, visita o imóvel {imovel} em {data}...' },
  { id: 't8',  name: 'Email Follow-Up Pós-Visita',             category: 'Follow-Up',   popular: true,  description: 'Email de seguimento enviado até 2h após cada visita realizada', langs: ['PT', 'EN'],     content: 'Assunto: Obrigado pela visita — {imovel}\n\nCaro/a {nome},\n\nFoi um prazer recebê-lo hoje em {morada}. Conforme conversámos...' },
  { id: 't9',  name: 'WhatsApp Sequência Captação',            category: 'Prospecção',  popular: false, description: 'Sequência de 5 mensagens WA para captação de novos imóveis', langs: ['PT'],            content: 'MSG 1: Bom dia {nome}! Sou o/a {consultor} da Agency Group...\nMSG 2: Gostava de lhe apresentar uma análise gratuita do valor do seu imóvel...' },
  { id: 't10', name: 'CPCV Template Básico',                   category: 'Contratos',   popular: true,  description: 'Contrato promessa de compra e venda simplificado — revisão jurídica recomendada', langs: ['PT'], content: 'CONTRATO PROMESSA COMPRA E VENDA\n\nComprador: {comprador}\nVendedor: {vendedor}\nImóvel: {imovel}, descrito na CRP sob o artigo {artigo}\nPreço: {preco}...' },
  { id: 't11', name: 'Certidão Permanente — Guia',             category: 'Legal',       popular: false, description: 'Como obter a certidão predial permanente online — passo a passo', langs: ['PT'],            content: 'GUIA — CERTIDÃO PREDIAL PERMANENTE\n\n1. Aceder a predial.rnpc.mj.pt\n2. Registar ou fazer login\n3. Pesquisar por {morada} ou artigo matricial...' },
  { id: 't12', name: 'Simulação de Financiamento',             category: 'Financeiro',  popular: false, description: 'Template de simulação de crédito habitação para apresentar a compradores', langs: ['PT'],    content: 'SIMULAÇÃO CRÉDITO HABITAÇÃO\n\nValor Imóvel: {preco}\nEntrada (20%): {entrada}\nMontante Financiado: {financiamento}\nPrazo: {prazo} anos\nTaxa Estimada: {taxa}%\nPrestação Estimada: {prestacao}/mês' },
  { id: 't13', name: 'Relatório Semanal ao Proprietário',      category: 'Reporting',   popular: false, description: 'Relatório semanal de actividade de venda enviado ao proprietário', langs: ['PT'],            content: 'RELATÓRIO SEMANAL — SEMANA {semana}\n\nImóvel: {imovel}\nVisitas realizadas: {visitas}\nContactos gerados: {contactos}\nFeedback geral: {feedback}\n\nPróximos passos...' },
  { id: 't14', name: 'Deal Memo Família / Herança',            category: 'Legal',       popular: false, description: 'Memorando para negócios de partilha de herança ou divórcio com múltiplos titulares', langs: ['PT'], content: 'MEMORANDO INTERNO — HERANÇA/PARTILHA\n\nImóvel: {imovel}\nTitulares: {vendedor}\nValor Acordado: {preco}\nQuota de cada titular: {quota}%\n\nCondições especiais...' },
  { id: 't15', name: 'Carta Reactivação de Lead',              category: 'Follow-Up',   popular: false, description: 'Reactivar leads que pararam de responder há 30–90 dias', langs: ['PT', 'EN'],     content: 'Assunto: {imovel} — novidade que pode interessar\n\nCaro/a {nome},\n\nEspero que esteja bem. Sei que têm passado alguns meses desde o nosso último contacto...' },
]

const GENERATOR_TYPES: GeneratorDocType[] = [
  {
    id: 'cpcv',
    label: 'CPCV — Contrato Promessa',
    fields: [
      { id: 'comprador', label: 'Nome do Comprador', type: 'text' },
      { id: 'vendedor',  label: 'Nome do Vendedor',  type: 'text' },
      { id: 'imovel',    label: 'Descrição do Imóvel', type: 'text' },
      { id: 'preco',     label: 'Preço (€)', type: 'number' },
      { id: 'sinal',     label: 'Sinal (€)', type: 'number' },
      { id: 'data_cpcv', label: 'Data do CPCV', type: 'date' },
      { id: 'prazo',     label: 'Prazo p/ Escritura (dias)', type: 'number' },
    ],
  },
  {
    id: 'proposta',
    label: 'Proposta de Compra',
    fields: [
      { id: 'comprador', label: 'Nome do Comprador',    type: 'text' },
      { id: 'imovel',    label: 'Imóvel (morada)',      type: 'text' },
      { id: 'preco',     label: 'Valor da Proposta (€)', type: 'number' },
      { id: 'condicoes', label: 'Condições Suspensivas', type: 'select', options: ['Nenhuma', 'Sujeito a financiamento', 'Sujeito a vistoria', 'Sujeito a venda de imóvel'] },
      { id: 'validade',  label: 'Validade da Proposta', type: 'select', options: ['48h', '72h', '5 dias úteis', '7 dias'] },
    ],
  },
  {
    id: 'mediacao',
    label: 'Contrato de Mediação',
    fields: [
      { id: 'vendedor',    label: 'Proprietário / Vendedor', type: 'text' },
      { id: 'imovel',      label: 'Descrição do Imóvel',    type: 'text' },
      { id: 'preco',       label: 'Valor de Venda Pedido (€)', type: 'number' },
      { id: 'exclusividade', label: 'Tipo de Mandato', type: 'select', options: ['Exclusivo', 'Não Exclusivo'] },
      { id: 'prazo',       label: 'Duração (meses)', type: 'select', options: ['3 meses', '6 meses', '12 meses'] },
      { id: 'comissao',    label: 'Comissão (%)', type: 'number' },
    ],
  },
  {
    id: 'deal_memo',
    label: 'Deal Memo Investidor',
    fields: [
      { id: 'imovel',      label: 'Imóvel (morada completa)', type: 'text' },
      { id: 'preco',       label: 'Preço Pedido (€)',          type: 'number' },
      { id: 'area',        label: 'Área (m²)',                 type: 'number' },
      { id: 'rendimento',  label: 'Rendimento Estimado (€/ano)', type: 'number' },
      { id: 'perfil',      label: 'Perfil do Investidor',      type: 'select', options: ['Family Office', 'HNWI Individual', 'Fundo Imobiliário', 'Investidor Privado'] },
    ],
  },
]

const RESPONSIBLE_COLORS: Record<string, { bg: string; color: string }> = {
  Comprador: { bg: 'rgba(58,123,213,.1)',  color: '#3a7bd5' },
  Vendedor:  { bg: 'rgba(201,169,110,.12)', color: '#a07a38' },
  AG:        { bg: 'rgba(28,74,53,.1)',    color: '#1c4a35' },
  Advogado:  { bg: 'rgba(124,58,237,.1)', color: '#7c3aed' },
  Banco:     { bg: 'rgba(14,14,13,.07)',  color: '#444' },
}

const FILE_TYPE_COLORS: Record<DocFileType, { bg: string; color: string; icon: string }> = {
  PDF:      { bg: 'rgba(220,38,38,.08)',  color: '#dc2626', icon: 'PDF' },
  DOCX:     { bg: 'rgba(37,99,235,.08)', color: '#2563eb', icon: 'DOC' },
  XLSX:     { bg: 'rgba(22,163,74,.08)', color: '#16a34a', icon: 'XLS' },
  Template: { bg: 'rgba(201,169,110,.1)', color: '#a07a38', icon: 'TPL' },
}

const CAT_COLORS: Record<DocCategory, string> = {
  Contratos:     '#1c4a35',
  Jurídico:      '#7c3aed',
  Fiscal:        '#2563eb',
  Marketing:     '#c9a96e',
  Templates:     '#059669',
  'Due Diligence': '#dc2626',
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconDoc = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const IconShare = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

const IconUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.2)" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" width="9" height="9">
    <path d="M2 6l3 3 5-5" />
  </svg>
)

const IconAI = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
)

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StorageBar() {
  const used = 2.3
  const total = 10
  const pct = (used / total) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.07)', borderRadius: '8px', marginBottom: '20px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.4)" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m0 4.875c0 2.278 3.694 4.125 8.25 4.125s8.25-1.847 8.25-4.125" />
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.45)' }}>Armazenamento</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600 }}>{used}GB de {total}GB utilizado</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(14,14,13,.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#dc2626' : '#1c4a35', borderRadius: '2px', transition: 'width .5s' }} />
        </div>
      </div>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>{(total - used).toFixed(1)}GB livres</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalDocumentos() {
  const [activeTab, setActiveTab] = useState<DocTab>('biblioteca')

  // Biblioteca state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCat, setFilterCat] = useState<DocCategory | 'Todas'>('Todas')
  const [filterType, setFilterType] = useState<DocFileType | 'Todos'>('Todos')
  const [sharedLink, setSharedLink] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Checklists state
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({})
  const [activeStage, setActiveStage] = useState<string>('qualificacao')
  const [selectedDeal, setSelectedDeal] = useState('Deal #AG-2401')

  // Templates state
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null)
  const [templateContent, setTemplateContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [activeLang, setActiveLang] = useState('PT')
  const [copied, setCopied] = useState(false)

  // Generator state
  const [genType, setGenType] = useState<string>('cpcv')
  const [genFields, setGenFields] = useState<Record<string, string>>({})
  const [genPreview, setGenPreview] = useState<string | null>(null)
  const [genCopied, setGenCopied] = useState(false)

  // Load checklist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_documents_checklist')
      if (saved) setChecklistState(JSON.parse(saved) as Record<string, boolean>)
    } catch { /* ignore */ }
  }, [])

  const toggleCheckItem = useCallback((itemId: string) => {
    setChecklistState(prev => {
      const next = { ...prev, [itemId]: !prev[itemId] }
      try { localStorage.setItem('ag_documents_checklist', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const getStageProgress = (stage: ChecklistStage) => {
    const required = stage.items.filter(i => i.required)
    const done = required.filter(i => checklistState[i.id]).length
    return { done, total: required.length, pct: required.length ? Math.round(done / required.length * 100) : 0 }
  }

  const filteredDocs = MOCK_DOCUMENTS.filter(d => {
    const matchCat  = filterCat  === 'Todas' || d.category === filterCat
    const matchType = filterType === 'Todos' || d.type === filterType
    const matchQ    = !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchType && matchQ
  })

  const handleShareDoc = (doc: DocItem) => {
    const link = `https://docs.agencygroup.pt/share/${doc.id}?token=${Math.random().toString(36).slice(2)}`
    setSharedLink(link)
    navigator.clipboard.writeText(link).catch(() => { /* ignore */ })
    setTimeout(() => setSharedLink(null), 3000)
  }

  const useTemplate = (tpl: Template) => {
    setActiveTemplate(tpl)
    setTemplateContent(tpl.content)
    setActiveLang('PT')
  }

  const simulateAIFill = async () => {
    if (!activeTemplate) return
    setAiLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    const filled = templateContent
      .replace(/{nome}/g, 'Dr. Alexandre Ferreira')
      .replace(/{imovel}/g, 'Apartamento T3 — Príncipe Real, Lisboa')
      .replace(/{morada}/g, 'Rua Dom Pedro V, 45, 1250-097 Lisboa')
      .replace(/{preco}/g, '€ 1.250.000')
      .replace(/{consultor}/g, 'Sofia Mendes — Agency Group')
      .replace(/{prazo}/g, '90 dias')
      .replace(/{yield}/g, '4.2')
      .replace(/{area}/g, '185')
      .replace(/{vendedor}/g, 'Maria José Silva')
      .replace(/{comprador}/g, 'Dr. Alexandre Ferreira')
      .replace(/{zona}/g, 'Chiado / Príncipe Real')
      .replace(/{data}/g, new Date().toLocaleDateString('pt-PT'))
      .replace(/{quota}/g, '50')
      .replace(/{semana}/g, '14/2026')
      .replace(/{visitas}/g, '3')
      .replace(/{contactos}/g, '7')
      .replace(/{feedback}/g, 'Muito positivo — interesse acima da média')
    setTemplateContent(filled)
    setAiLoading(false)
  }

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(templateContent).catch(() => { /* ignore */ })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generateDocument = () => {
    const docType = GENERATOR_TYPES.find(t => t.id === genType)
    if (!docType) return
    let preview = ''
    if (genType === 'cpcv') {
      preview = `CONTRATO PROMESSA DE COMPRA E VENDA\n${'─'.repeat(50)}\n\nEntre:\n\nVENDEDOR: ${genFields.vendedor || '[Vendedor]'}\nCOMPRADOR: ${genFields.comprador || '[Comprador]'}\n\nOBJECTO:\nO imóvel designado por ${genFields.imovel || '[Imóvel]'}.\n\nPREÇO E CONDIÇÕES DE PAGAMENTO:\n— Preço Total: € ${Number(genFields.preco || 0).toLocaleString('pt-PT')}\n— Sinal: € ${Number(genFields.sinal || 0).toLocaleString('pt-PT')} (pago na data da assinatura)\n— Remanescente: € ${(Number(genFields.preco || 0) - Number(genFields.sinal || 0)).toLocaleString('pt-PT')} (na data da escritura)\n\nPRAZO PARA ESCRITURA:\nAs partes obrigam-se a celebrar a escritura de compra e venda no prazo de ${genFields.prazo || '90'} dias a contar da data do presente contrato.\n\nDATA DO PRESENTE CONTRATO: ${genFields.data_cpcv || new Date().toLocaleDateString('pt-PT')}\n\n${'─'.repeat(50)}\nAgency Group — AMI 22506\nDocumento gerado automaticamente — sujeito a revisão jurídica.`
    } else if (genType === 'proposta') {
      preview = `PROPOSTA DE COMPRA\n${'─'.repeat(50)}\n\nSenhor(a) Proprietário/a,\n\nO/A signatário/a ${genFields.comprador || '[Comprador]'} vem por este meio apresentar proposta formal para aquisição do imóvel sito em:\n\n${genFields.imovel || '[Imóvel]'}\n\nVALOR PROPOSTO: € ${Number(genFields.preco || 0).toLocaleString('pt-PT')}\n\nCONDIÇÕES: ${genFields.condicoes || 'Nenhuma'}\n\nVALIDADE: ${genFields.validade || '48h'} a partir da data de envio\n\nAgency Group — AMI 22506`
    } else if (genType === 'mediacao') {
      preview = `CONTRATO DE MEDIAÇÃO IMOBILIÁRIA\n${'─'.repeat(50)}\n\nPARTES:\n— Proprietário: ${genFields.vendedor || '[Proprietário]'}\n— Mediador: Agency Group, Lda. — AMI 22506\n\nIMÓVEL: ${genFields.imovel || '[Imóvel]'}\nVALOR DE VENDA: € ${Number(genFields.preco || 0).toLocaleString('pt-PT')}\nTIPO: ${genFields.exclusividade || 'Exclusivo'}\nDURAÇÃO: ${genFields.prazo || '6 meses'}\nCOMISSÃO: ${genFields.comissao || '5'}% + IVA sobre o preço de venda\n\nAgency Group — AMI 22506`
    } else if (genType === 'deal_memo') {
      const yield_pct = genFields.rendimento && genFields.preco ? ((Number(genFields.rendimento) / Number(genFields.preco)) * 100).toFixed(2) : '—'
      preview = `INVESTMENT MEMORANDUM\n${'─'.repeat(50)}\n\nPROPERTY: ${genFields.imovel || '[Property]'}\nASKING PRICE: € ${Number(genFields.preco || 0).toLocaleString('pt-PT')}\nAREA: ${genFields.area || '—'} m²\nPRICE/m²: € ${genFields.area && genFields.preco ? Math.round(Number(genFields.preco) / Number(genFields.area)).toLocaleString('pt-PT') : '—'}\n\nINVESTMENT THESIS:\nGross Yield: ${yield_pct}%\nAnnual Income: € ${Number(genFields.rendimento || 0).toLocaleString('pt-PT')}\nInvestor Profile: ${genFields.perfil || '—'}\n\nPrepared by Agency Group — AMI 22506\nFor qualified investors only.`
    }
    setGenPreview(preview)
  }

  const handleGenCopy = async () => {
    if (!genPreview) return
    await navigator.clipboard.writeText(genPreview).catch(() => { /* ignore */ })
    setGenCopied(true)
    setTimeout(() => setGenCopied(false), 2000)
  }

  const handlePrintPreview = () => {
    if (!genPreview) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Documento AG</title><style>body{font-family:monospace;padding:40px;max-width:700px;margin:0 auto;white-space:pre-wrap;line-height:1.7;font-size:13px;color:#0e0e0d}</style></head><body>${genPreview.replace(/\n/g, '<br>')}</body></html>`)
    win.document.close()
    win.print()
  }

  const TABS: { id: DocTab; label: string }[] = [
    { id: 'biblioteca', label: 'Biblioteca' },
    { id: 'checklists', label: 'Checklists' },
    { id: 'templates',  label: 'Templates' },
    { id: 'gerador',    label: 'Gerador' },
  ]

  const activeStageData = DEAL_CHECKLISTS.find(s => s.id === activeStage)

  return (
    <div style={{ maxWidth: '1040px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>
            Intelligence Documental
          </div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.9rem', color: '#0e0e0d', lineHeight: 1.1 }}>
            Documentos & <em style={{ color: '#1c4a35' }}>Templates</em>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '5px', letterSpacing: '.04em' }}>
            {MOCK_DOCUMENTS.length} documentos · {DEAL_CHECKLISTS.length} checklists · {TEMPLATES.length} templates · Gerador de documentos
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button"
            className="p-btn"
            style={{ fontSize: '.52rem', padding: '8px 18px', borderRadius: '6px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            + Carregar Documento
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px', gap: '0' }}>
        {TABS.map(t => (
          <button type="button"
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 22px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === t.id ? '#1c4a35' : 'transparent'}`,
              color: activeTab === t.id ? '#1c4a35' : 'rgba(14,14,13,.4)',
              fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all .15s', marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: BIBLIOTECA ───────────────────────────────────────────────────── */}
      {activeTab === 'biblioteca' && (
        <div>
          <StorageBar />

          {/* Search + Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.3)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="p-inp"
                style={{ paddingLeft: '36px' }}
                placeholder="Pesquisar documentos, contratos, fiscalidade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="p-sel" value={filterCat} onChange={e => setFilterCat(e.target.value as DocCategory | 'Todas')} style={{ minWidth: '160px' }}>
              <option value="Todas">Todas as categorias</option>
              {(['Contratos', 'Jurídico', 'Fiscal', 'Marketing', 'Templates', 'Due Diligence'] as DocCategory[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="p-sel" value={filterType} onChange={e => setFilterType(e.target.value as DocFileType | 'Todos')} style={{ minWidth: '110px' }}>
              <option value="Todos">Todos os tipos</option>
              {(['PDF', 'DOCX', 'XLSX', 'Template'] as DocFileType[]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Category pills summary */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {(['Contratos', 'Jurídico', 'Fiscal', 'Marketing', 'Templates', 'Due Diligence'] as DocCategory[]).map(cat => {
              const count = MOCK_DOCUMENTS.filter(d => d.category === cat).length
              return (
                <button type="button"
                  key={cat}
                  onClick={() => setFilterCat(filterCat === cat ? 'Todas' : cat)}
                  style={{
                    padding: '4px 12px', border: `1px solid ${filterCat === cat ? CAT_COLORS[cat] : 'rgba(14,14,13,.1)'}`,
                    background: filterCat === cat ? `${CAT_COLORS[cat]}12` : 'transparent',
                    color: filterCat === cat ? CAT_COLORS[cat] : 'rgba(14,14,13,.45)',
                    fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em',
                    cursor: 'pointer', transition: 'all .15s', borderRadius: '4px',
                  }}
                >
                  {cat} <span style={{ opacity: 0.6 }}>({count})</span>
                </button>
              )
            })}
          </div>

          {/* Shared link toast */}
          {sharedLink && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(28,74,53,.07)', border: '1px solid rgba(28,74,53,.2)', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1c4a35" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sharedLink}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', opacity: 0.6 }}>Copiado!</span>
            </div>
          )}

          {/* Document grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {filteredDocs.map(doc => {
              const typeConfig = FILE_TYPE_COLORS[doc.type]
              const catColor = CAT_COLORS[doc.category]
              return (
                <div
                  key={doc.id}
                  style={{
                    border: '1px solid rgba(14,14,13,.08)', background: '#fff',
                    padding: '16px', transition: 'all .2s', cursor: 'default',
                    borderTop: `2px solid ${catColor}`, borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {/* Doc header */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                    <div style={{
                      width: '36px', height: '44px', background: typeConfig.bg,
                      border: `1px solid ${typeConfig.color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: typeConfig.color, fontWeight: 700, letterSpacing: '.04em' }}>{typeConfig.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '3px', lineHeight: 1.3 }}>{doc.name}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', lineHeight: 1.5 }}>{doc.description}</div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', background: `${catColor}10`, color: catColor, fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', textTransform: 'uppercase', borderRadius: '4px' }}>
                      {doc.category}
                    </span>
                    <span style={{ padding: '2px 8px', background: typeConfig.bg, color: typeConfig.color, fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', borderRadius: '4px' }}>
                      {doc.type}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginLeft: 'auto' }}>
                      {doc.size}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                      {new Date(doc.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <IconDownload />
                      {doc.downloads}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" style={{
                      flex: 1, padding: '6px 8px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.12)',
                      color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em',
                      cursor: 'pointer', transition: 'all .2s', borderRadius: '6px',
                    }}>Ver</button>
                    <button type="button" style={{
                      flex: 1, padding: '6px 8px', background: '#1c4a35', border: 'none',
                      color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em',
                      cursor: 'pointer', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: '6px',
                    }}>
                      <IconDownload />Download
                    </button>
                    <button type="button"
                      style={{
                        padding: '6px 10px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)',
                        color: 'rgba(14,14,13,.4)', cursor: 'pointer', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: '4px',
                        fontFamily: "'DM Mono',monospace", fontSize: '.52rem', borderRadius: '6px',
                      }}
                      onClick={() => handleShareDoc(doc)}
                    >
                      <IconShare />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredDocs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(14,14,13,.3)', fontFamily: "'Cormorant',serif", fontSize: '1.2rem' }}>
              Nenhum documento encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.
            </div>
          )}

          {/* Upload Drop Zone */}
          <div
            style={{
              marginTop: '24px', border: `2px dashed ${dragOver ? '#1c4a35' : 'rgba(14,14,13,.12)'}`,
              background: dragOver ? 'rgba(28,74,53,.04)' : 'transparent',
              padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all .2s',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false) }}
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Arraste documentos aqui
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)' }}>
              PDF · DOCX · XLSX · PNG — até 50MB por ficheiro
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CHECKLISTS ───────────────────────────────────────────────────── */}
      {activeTab === 'checklists' && (
        <div>
          {/* Deal selector */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.08em' }}>Deal activo:</div>
            <select className="p-sel" value={selectedDeal} onChange={e => setSelectedDeal(e.target.value)} style={{ minWidth: '200px' }}>
              {['Deal #AG-2401', 'Deal #AG-2398', 'Deal #AG-2387', 'Deal #AG-2376'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
              {selectedDeal} — Apartamento T3 Príncipe Real
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {/* Stage sidebar */}
            <div style={{ width: '230px', flexShrink: 0 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
                Fase do Negócio
              </div>
              {DEAL_CHECKLISTS.map((stage, idx) => {
                const prog = getStageProgress(stage)
                const isActive = activeStage === stage.id
                const allDone = prog.pct === 100
                return (
                  <div
                    key={stage.id}
                    onClick={() => setActiveStage(stage.id)}
                    style={{
                      padding: '11px 14px', marginBottom: '6px', cursor: 'pointer', transition: 'all .15s',
                      background: isActive ? '#1c4a35' : allDone ? 'rgba(34,197,94,.05)' : 'rgba(14,14,13,.02)',
                      border: `1px solid ${isActive ? '#1c4a35' : allDone ? 'rgba(34,197,94,.2)' : 'rgba(14,14,13,.08)'}`, borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isActive ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.35)', background: isActive ? 'rgba(255,255,255,.1)' : 'rgba(14,14,13,.06)', padding: '2px 5px', borderRadius: '4px' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', fontWeight: 500, color: isActive ? '#f4f0e6' : '#0e0e0d', flex: 1, lineHeight: 1.2 }}>
                        {stage.label}
                      </span>
                      {allDone && !isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="none"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm4.77-1.07a1 1 0 010 1.41l-5.5 5.5a1 1 0 01-1.42 0l-2.5-2.5a1 1 0 011.42-1.42l1.79 1.79 4.79-4.79a1 1 0 011.42.01z" /></svg>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '3px', background: isActive ? 'rgba(255,255,255,.15)' : 'rgba(14,14,13,.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${prog.pct}%`, background: isActive ? '#c9a96e' : allDone ? '#22c55e' : '#1c4a35', transition: 'width .4s' }} />
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isActive ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.3)', whiteSpace: 'nowrap' }}>
                        {prog.done}/{prog.total}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Checklist detail */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeStageData && (() => {
                const prog = getStageProgress(activeStageData)
                return (
                  <div className="p-card">
                    {/* Header */}
                    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#0e0e0d', fontWeight: 300 }}>
                          {activeStageData.label}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: prog.pct === 100 ? '#22c55e' : '#1c4a35', fontWeight: 600 }}>
                            {prog.pct}% completo
                          </span>
                          <button type="button"
                            style={{
                              padding: '5px 14px', background: '#1c4a35', border: 'none', color: '#f4f0e6',
                              fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em',
                              textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px',
                            }}
                            onClick={() => alert('Função de export PDF — integração com API de geração em breve.')}
                          >
                            Gerar PDF
                          </button>
                        </div>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(14,14,13,.07)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.pct === 100 ? '#22c55e' : '#1c4a35', transition: 'width .5s ease', borderRadius: '3px' }} />
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>
                        {prog.done} de {prog.total} itens obrigatórios concluídos · {activeStageData.items.filter(i => !i.required).length} opcionais
                      </div>
                    </div>

                    {/* Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {activeStageData.items.map(item => {
                        const checked = checklistState[item.id] || false
                        const resp = RESPONSIBLE_COLORS[item.responsible] || { bg: 'rgba(14,14,13,.06)', color: '#666' }
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleCheckItem(item.id)}
                            style={{
                              display: 'flex', gap: '12px', padding: '11px 14px', cursor: 'pointer',
                              background: checked ? 'rgba(28,74,53,.03)' : 'transparent',
                              border: `1px solid ${checked ? 'rgba(28,74,53,.12)' : 'rgba(14,14,13,.06)'}`,
                              transition: 'all .15s', borderRadius: '8px',
                            }}
                          >
                            {/* Checkbox */}
                            <div style={{
                              width: '18px', height: '18px', flexShrink: 0, border: `2px solid ${checked ? '#1c4a35' : 'rgba(14,14,13,.2)'}`,
                              background: checked ? '#1c4a35' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', marginTop: '1px',
                            }}>
                              {checked && <IconCheck />}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontFamily: "'Jost',sans-serif", fontSize: '.82rem',
                                  fontWeight: checked ? 400 : 500,
                                  color: checked ? 'rgba(14,14,13,.4)' : '#0e0e0d',
                                  textDecoration: checked ? 'line-through' : 'none',
                                }}>
                                  {item.name}
                                </span>
                                {item.required && !checked && (
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#dc2626', background: 'rgba(220,38,38,.07)', padding: '1px 6px', letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0, borderRadius: '4px' }}>
                                    Obrigatório
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>
                                  {item.deadline}
                                </span>
                                <span style={{ padding: '1px 7px', background: resp.bg, color: resp.color, fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', borderRadius: '4px' }}>
                                  {item.responsible}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {prog.pct === 100 && (
                      <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(34,197,94,.07)', border: '1px solid rgba(34,197,94,.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#22c55e', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          Fase documentalmente completa
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TEMPLATES ────────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div>
          {!activeTemplate ? (
            <div>
              {/* Disclaimer */}
              <div style={{ marginBottom: '18px', padding: '10px 14px', background: 'rgba(201,169,110,.07)', border: '1px solid rgba(201,169,110,.2)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a07a38" strokeWidth="2" style={{ marginTop: '1px', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#a07a38', lineHeight: 1.5 }}>
                  Templates de referência interna. Recomendamos revisão por advogado ou solicitador antes de qualquer uso legal.
                </span>
              </div>

              {/* Search */}
              <input
                className="p-inp"
                style={{ marginBottom: '16px' }}
                placeholder="Pesquisar templates..."
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
              />

              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {TEMPLATES.filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.category.toLowerCase().includes(templateSearch.toLowerCase())).map(tpl => (
                  <div
                    key={tpl.id}
                    style={{
                      border: '1px solid rgba(14,14,13,.08)', background: '#fff', padding: '16px', cursor: 'pointer',
                      transition: 'all .2s', position: 'relative', borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#1c4a35')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(14,14,13,.08)')}
                    onClick={() => useTemplate(tpl)}
                  >
                    {tpl.popular && (
                      <div style={{ position: 'absolute', top: '0', right: '0', padding: '3px 8px', background: '#c9a96e', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', borderRadius: '0 12px 0 4px' }}>
                        POPULAR
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '44px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconDoc color="#1c4a35" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', fontWeight: 600, color: '#0e0e0d', marginBottom: '3px', paddingRight: tpl.popular ? '48px' : '0' }}>
                          {tpl.name}
                        </div>
                        <span style={{ padding: '2px 7px', background: 'rgba(28,74,53,.06)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', borderRadius: '4px' }}>
                          {tpl.category}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.75rem', color: 'rgba(14,14,13,.5)', marginBottom: '12px', lineHeight: 1.5 }}>
                      {tpl.description}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(tpl.langs || ['PT']).map(lang => (
                          <span key={lang} style={{ padding: '2px 6px', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.04em', borderRadius: '4px' }}>
                            {lang}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', letterSpacing: '.06em' }}>
                        Usar →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Template editor */
            <div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button type="button"
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', letterSpacing: '.06em', borderRadius: '6px' }}
                  onClick={() => setActiveTemplate(null)}
                >
                  ← Voltar
                </button>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: '#0e0e0d', fontWeight: 300 }}>
                  {activeTemplate.name}
                </div>
                {activeTemplate.langs && activeTemplate.langs.length > 1 && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                    {activeTemplate.langs.map(lang => (
                      <button type="button"
                        key={lang}
                        onClick={() => setActiveLang(lang)}
                        style={{
                          padding: '4px 10px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                          cursor: 'pointer', border: '1px solid',
                          background: activeLang === lang ? '#1c4a35' : 'transparent',
                          color: activeLang === lang ? '#fff' : 'rgba(14,14,13,.45)',
                          borderColor: activeLang === lang ? '#1c4a35' : 'rgba(14,14,13,.15)', borderRadius: '6px',
                        }}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {/* Variable hints */}
                <div style={{ padding: '10px 14px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>Variáveis:</span>
                  {['{nome}', '{imovel}', '{preco}', '{morada}', '{consultor}', '{data}', '{prazo}'].map(v => (
                    <span
                      key={v}
                      style={{ padding: '2px 8px', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#a07a38', cursor: 'pointer', borderRadius: '4px' }}
                      onClick={() => setTemplateContent(prev => prev + v)}
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <textarea
                  value={templateContent}
                  onChange={e => setTemplateContent(e.target.value)}
                  style={{
                    width: '100%', minHeight: '320px', padding: '16px', fontFamily: "'DM Mono',monospace",
                    fontSize: '.44rem', lineHeight: 1.8, color: '#0e0e0d', background: '#fff',
                    border: '1px solid rgba(14,14,13,.12)', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button"
                    className="p-btn-gold p-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.52rem', padding: '8px 18px', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={simulateAIFill}
                    disabled={aiLoading}
                  >
                    <IconAI />
                    {aiLoading ? 'A preencher...' : 'Preencher com IA'}
                  </button>
                  <button type="button"
                    className="p-btn"
                    style={{ fontSize: '.52rem', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={handleCopyTemplate}
                  >
                    {copied ? '✓ Copiado!' : 'Copiar Texto'}
                  </button>
                  <button type="button"
                    style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={() => { setActiveTemplate(null); setTemplateContent('') }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: GERADOR ──────────────────────────────────────────────────────── */}
      {activeTab === 'gerador' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left: Form */}
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>Tipo de Documento</label>
              <select
                className="p-sel"
                value={genType}
                onChange={e => { setGenType(e.target.value); setGenFields({}); setGenPreview(null) }}
                style={{ width: '100%' }}
              >
                {GENERATOR_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {GENERATOR_TYPES.find(t => t.id === genType)?.fields.map(field => (
              <div key={field.id} style={{ marginBottom: '14px' }}>
                <label className="p-label" style={{ display: 'block', marginBottom: '6px' }}>{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    className="p-sel"
                    value={genFields[field.id] || ''}
                    onChange={e => setGenFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seleccionar...</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="p-inp"
                    type={field.type}
                    value={genFields[field.id] || ''}
                    onChange={e => setGenFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ))}

            <button type="button"
              className="p-btn"
              style={{ width: '100%', marginTop: '4px', background: '#1c4a35', color: '#f4f0e6', padding: '12px', fontSize: '.52rem', letterSpacing: '.1em', borderRadius: '6px', transition: 'all .2s' }}
              onClick={generateDocument}
            >
              Gerar Documento
            </button>
          </div>

          {/* Right: Preview */}
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '12px' }}>
              Pré-visualização
            </div>
            {genPreview ? (
              <div>
                <pre style={{
                  fontFamily: "'DM Mono',monospace", fontSize: '.52rem', lineHeight: 1.8,
                  color: '#0e0e0d', background: '#fff', border: '1px solid rgba(14,14,13,.1)',
                  padding: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: '480px', overflowY: 'auto', margin: '0 0 12px', borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
                }}>
                  {genPreview}
                </pre>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button"
                    className="p-btn"
                    style={{ flex: 1, background: '#1c4a35', color: '#f4f0e6', fontSize: '.52rem', padding: '9px', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={handlePrintPreview}
                  >
                    Download PDF
                  </button>
                  <button type="button"
                    style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid rgba(14,14,13,.12)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', cursor: 'pointer', letterSpacing: '.06em', borderRadius: '6px', transition: 'all .2s' }}
                    onClick={handleGenCopy}
                  >
                    {genCopied ? '✓ Copiado!' : 'Copiar Texto'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', border: '1px dashed rgba(14,14,13,.1)', background: 'rgba(14,14,13,.02)', gap: '10px' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.15)" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8 }}>
                  Preenche o formulário<br />e clica em Gerar
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
