import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

const IMTSchema = z.object({
  valor:     z.number().positive('Valor deve ser positivo'),
  tipo:      z.enum(['hpp', 'second', 'invest']),
  comprador: z.enum(['singular', 'empresa']),
});

interface IMTRequest {
  valor: number;
  tipo: 'hpp' | 'second' | 'invest';
  comprador: 'singular' | 'empresa';
}

interface Bracket {
  max: number;
  rate: number;
  deduction: number;
  flat?: boolean;
}

// Portaria 306-A/2025 — brackets effective 2025
const HPP_BRACKETS: Bracket[] = [
  { max: 97064,    rate: 0.00, deduction: 0,         flat: false },
  { max: 132774,   rate: 0.02, deduction: 1941.28,   flat: false },
  { max: 182349,   rate: 0.05, deduction: 5924.50,   flat: false },
  { max: 316772,   rate: 0.07, deduction: 9569.48,   flat: false },
  { max: 633453,   rate: 0.08, deduction: 12736.97,  flat: false },
  { max: Infinity, rate: 0.06, deduction: 0,         flat: true  },
];

const SECOND_BRACKETS: Bracket[] = [
  { max: 97064,    rate: 0.01, deduction: 0,         flat: false },
  { max: 132774,   rate: 0.02, deduction: 970.64,    flat: false },
  { max: 182349,   rate: 0.05, deduction: 4954.50,   flat: false },
  { max: 316772,   rate: 0.07, deduction: 8596.98,   flat: false },
  { max: 633453,   rate: 0.08, deduction: 11764.47,  flat: false },
  { max: 1050400,  rate: 0.06, deduction: 0,         flat: true  },
  { max: Infinity, rate: 0.075, deduction: 0,        flat: true  },
];

function calcIMT(valor: number, brackets: Bracket[]): number {
  for (const bracket of brackets) {
    if (valor <= bracket.max) {
      if (bracket.flat) {
        return valor * bracket.rate;
      }
      return valor * bracket.rate - bracket.deduction;
    }
  }
  return 0;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = IMTSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }
    const { valor, tipo, comprador } = parsed.data;

    // Empresas pagam sempre como second/invest
    const isHPP = tipo === 'hpp' && comprador === 'singular';

    const brackets = isHPP ? HPP_BRACKETS : SECOND_BRACKETS;
    const imt = Math.max(0, calcIMT(valor, brackets));

    const isento = isHPP && valor <= 97064;

    const is = valor * 0.008;
    // Conservatória do Registo Predial: scales with property value (Portaria 322-B/2001 actualizada)
    // ~€375 base + 0.01% above €200K, capped at €1,800
    const registro = Math.min(1800, Math.round(375 + Math.max(0, valor - 200000) * 0.0001));
    // Notário / Escritura: scales with value, typically €500–€1,200 for most transactions
    const notario = Math.min(1200, Math.round(500 + Math.max(0, valor - 300000) * 0.00025));
    const advogado = valor * 0.01;

    const totalSemAdvogado = imt + is + registro + notario;
    const total = totalSemAdvogado + advogado;

    // Savings vs second home if tipo=hpp
    let savings = 0;
    if (tipo === 'hpp' && comprador === 'singular') {
      const imtSecond = Math.max(0, calcIMT(valor, SECOND_BRACKETS));
      savings = Math.max(0, imtSecond - imt);
    }

    const taxaEfetiva = ((imt / valor) * 100).toFixed(2) + '%';

    const safePct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0.0%';
    const breakdown = [
      { label: 'IMT', value: imt, pct: safePct(imt) },
      { label: 'Imposto de Selo (0,8%)', value: is, pct: safePct(is) },
      { label: 'Registo Predial', value: registro, pct: safePct(registro) },
      { label: 'Notário', value: notario, pct: safePct(notario) },
      { label: 'Advogado (1%)', value: advogado, pct: safePct(advogado) },
    ];

    const result = {
      imt: parseFloat(fmt(imt)),
      is: parseFloat(fmt(is)),
      registro,
      notario,
      advogado: parseFloat(fmt(advogado)),
      total: parseFloat(fmt(total)),
      totalSemAdvogado: parseFloat(fmt(totalSemAdvogado)),
      breakdown,
      taxaEfetiva,
      isento,
      savings: parseFloat(fmt(savings)),
    };

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[IMT] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
