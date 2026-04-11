// ─── Homepage Content — Single Source of Truth ────────────────────────────────
// ALL copy, data, and structured content for the homepage lives here.
// Both the desktop page (page.tsx) and MobileHome.tsx consume this file.
// Updating any value here propagates automatically to both renderings.
// DO NOT hardcode homepage content elsewhere.

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const HOME_HERO = {
  eyebrow:      'Lisboa · Portugal · AMI 22506',
  title1:       'Off-Market.',
  titleEm:      'Discrição',
  title3:       'e execução.',
  subtitle:     'Acesso a compradores qualificados. Processos controlados. Resultados sem exposição pública.',
  ctaPrimary:   { text: 'Ver Oportunidades', href: '#imoveis' },
  ctaSecondary: { text: 'Falar com Consultor →', href: '#avaliacao' },
  stats: [
    { n: '169', em: 'K',   label: 'Transacções 2025'          },
    { n: '+17', em: '%',   label: 'Valorização · 2025'         },
    { n: '44',  em: '%',   label: 'Compradores Internacionais' },
  ],
} as const

// ─── Marquee ticker ───────────────────────────────────────────────────────────

export const HOME_MARQUEE = [
  { zona: 'Lisboa',        val: '€6.538/m²' },
  { zona: 'Cascais',       val: '€6.638/m²' },
  { zona: 'Comporta',      val: '€11.000/m²' },
  { zona: 'Porto',         val: '€4.528/m²' },
  { zona: 'Algarve',       val: '€5.200/m²' },
  { zona: 'Madeira',       val: '€3.959/m²' },
  { zona: 'Sintra',        val: '€3.600/m²' },
  { zona: 'Arrábida',      val: '€4.500/m²' },
  { zona: 'Portugal 2025', val: '+17.6%'     },
]

// ─── Zone cards ───────────────────────────────────────────────────────────────

export const HOME_ZONES = [
  { c: 'z1', nome: 'Lisboa',   pais: 'Portugal', pm2: '€6.538/m²',  yoy: '+19%', tag: 'The city that reinvented itself',     photo: '/zones/lisboa.jpg'   },
  { c: 'z2', nome: 'Cascais',  pais: 'Portugal', pm2: '€6.638/m²',  yoy: '+14%', tag: 'Where old money meets the Atlantic',  photo: '/zones/cascais.jpg'  },
  { c: 'z3', nome: 'Comporta', pais: 'Portugal', pm2: '€11.000/m²', yoy: '+28%', tag: "Europe's last unhurried place",       photo: '/zones/comporta.jpg' },
  { c: 'z4', nome: 'Porto',    pais: 'Portugal', pm2: '€4.528/m²',  yoy: '+12%', tag: 'The river that seduces everyone',     photo: '/zones/porto.jpg'    },
  { c: 'z5', nome: 'Algarve',  pais: 'Portugal', pm2: '€5.200/m²',  yoy: '+10%', tag: '300 mornings of light',               photo: '/zones/algarve.jpg'  },
  { c: 'z6', nome: 'Madeira',  pais: 'Portugal', pm2: '€3.760/m²',  yoy: '+20%', tag: 'The island that needs nothing',       photo: '/zones/madeira.jpg'  },
  { c: 'z7', nome: 'Sintra',   pais: 'Portugal', pm2: '€3.600/m²',  yoy: '+13%', tag: 'Where history forgot to leave',       photo: '/zones/sintra.jpg'   },
  { c: 'z8', nome: 'Arrábida', pais: 'Portugal', pm2: '€4.500/m²',  yoy: '+19%', tag: 'The coast nobody found yet',          photo: '/zones/arrabida.jpg' },
  { c: 'z9', nome: 'Ericeira', pais: 'Portugal', pm2: '€3.200/m²',  yoy: '+15%', tag: 'World surf reserve. Naturally',       photo: '/zones/ericeira.jpg' },
]

// ─── Market data ticker ───────────────────────────────────────────────────────

export const HOME_MARKET_TICKER = [
  { label: 'Mercado PT 2026',   value: '+17.6%',     desc: 'Valorização média'       },
  { label: 'Transacções',       value: '169.812',    desc: 'Vendas totais'            },
  { label: 'Preço Mediana',     value: '€3.076/m²',  desc: 'Portugal'                 },
  { label: 'Lisboa Prime',      value: '€7.500/m²',  desc: 'Chiado · Príncipe Real'   },
  { label: 'Cascais',           value: '€6.638/m²',  desc: 'Quinta da Marinha'        },
  { label: 'Comporta',          value: '€11.000/m²', desc: 'Zona mais valorizada'     },
  { label: 'Algarve',           value: '€5.200/m²',  desc: '+10% YoY'                 },
  { label: 'Madeira',           value: '€3.760/m²',  desc: '+44% tendência'           },
  { label: 'Top 5 Mundial',     value: 'Lisboa',     desc: 'Savills Luxury 2026'      },
  { label: 'Compradores int.',  value: '44%',         desc: 'Mercados prime'           },
  { label: 'NHR/IFICI',         value: '10 anos',    desc: 'Isenção fiscal'           },
  { label: 'IMT HPP isenção',   value: '€97K',       desc: 'Limiar 2026'              },
]

// ─── Credentials stats ────────────────────────────────────────────────────────

export const HOME_CRED_STATS = [
  { n: '169', sup: 'K',   label: 'Transacções em Portugal',    desc: 'O mercado mais activo da história.'      },
  { n: '+17', sup: '%',   label: 'Valorização 2025',           desc: 'Quarto máximo histórico consecutivo.'   },
  { n: '44',  sup: '%',   label: 'Compradores Internacionais', desc: 'O mundo descobriu Portugal.'            },
  { n: 'Top', sup: '5',   label: 'Luxo Mundial',               desc: 'Lisboa. As 5 melhores do mundo.'        },
]

// ─── Testimonials ─────────────────────────────────────────────────────────────

export const HOME_TESTIMONIALS = [
  { name: 'James & Sarah Mitchell',    country: '🇬🇧 Reino Unido',    zone: 'Cascais',  rating: 5, quote: 'Três semanas. Villa de sonho. Escritura assinada. Nunca pensámos que seria tão simples — nem que Cascais seria para sempre.',                              property: 'Villa T5 · Cascais · €2.4M',       date: 'Janeiro 2026'   },
  { name: 'Mohammed Al-Rashidi',       country: '🇸🇦 Arábia Saudita', zone: 'Lisboa',   rating: 5, quote: 'Penthouse no Príncipe Real como investimento. O retorno superou todas as projecções. Lisboa está a crescer — e nós estamos dentro.',                   property: 'Penthouse T4 · Lisboa · €3.1M',    date: 'Dezembro 2025'  },
  { name: 'Chen Wei & Li Ming',        country: '🇨🇳 China',          zone: 'Comporta', rating: 5, quote: 'A Comporta era o nosso sonho. Encontraram a propriedade certa. Trataram de tudo. No dia da escritura, soubemos que tínhamos chegado.',                   property: 'Quinta T6 · Comporta · €5.2M',     date: 'Novembro 2025'  },
  { name: 'Marc & Isabelle Fontaine',  country: '🇫🇷 França',         zone: 'Porto',    rating: 5, quote: 'Investidores há 15 anos. Nunca trabalhámos com uma equipa assim. 5.1% de rentabilidade no primeiro ano. O Porto foi a melhor decisão.',                  property: 'Apartamento T3 · Porto · €890K',   date: 'Outubro 2025'   },
  { name: 'Robert & Anna Schneider',   country: '🇩🇪 Alemanha',       zone: 'Algarve',  rating: 5, quote: 'Comparámos 6 agências. Escolhemos a Agency Group. A villa no Algarve é exactamente o que imaginámos — e o processo foi impecável.',                      property: 'Villa T5 · Algarve · €1.8M',       date: 'Setembro 2025'  },
  { name: 'David & Rachel Goldstein',  country: '🇺🇸 Estados Unidos',  zone: 'Madeira',  rating: 5, quote: 'Viemos para a Madeira com o NHR. Trataram de tudo — imóvel, advogado, escola para os filhos. Hoje dizemos que a vida começou aqui.',                    property: 'Moradia T4 · Madeira · €1.2M',     date: 'Agosto 2025'    },
]

export const HOME_REVIEW_STATS = [
  { val: '4.9/5',   label: 'Avaliação Média'        },
  { val: '47+',     label: 'Famílias Acompanhadas'    },
  { val: '100%',    label: 'Recomendariam'           },
  { val: '€285M+',  label: 'Volume Transacionado'    },
]
