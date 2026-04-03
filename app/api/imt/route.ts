import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

const HPP_BRACKETS: Bracket[] = [
  { max: 97064,   rate: 0.00, deduction: 0,         flat: false },
  { max: 132774,  rate: 0.02, deduction: 1941.28,   flat: false },
  { max: 181034,  rate: 0.05, deduction: 5924.50,   flat: false },
  { max: 301688,  rate: 0.07, deduction: 9545.18,   flat: false },
  { max: 603289,  rate: 0.08, deduction: 12562.06,  flat: false },
  { max: Infinity, rate: 0.06, deduction: 0,        flat: true  },
];

const SECOND_BRACKETS: Bracket[] = [
  { max: 97064,    rate: 0.01, deduction: 0,         flat: false },
  { max: 132774,   rate: 0.02, deduction: 971.28,    flat: false },
  { max: 181034,   rate: 0.05, deduction: 4953.22,   flat: false },
  { max: 301688,   rate: 0.07, deduction: 8573.90,   flat: false },
  { max: 578598,   rate: 0.08, deduction: 11590.78,  flat: false },
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
    const body: IMTRequest = await req.json();
    const { valor, tipo, comprador } = body;

    if (!valor || !tipo || !comprador) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: valor, tipo, comprador' }, { status: 400 });
    }

    // Empresas pagam sempre como second/invest
    const isHPP = tipo === 'hpp' && comprador === 'singular';

    const brackets = isHPP ? HPP_BRACKETS : SECOND_BRACKETS;
    const imt = Math.max(0, calcIMT(valor, brackets));

    const isento = isHPP && valor <= 97064;

    const is = valor * 0.008;
    const registro = 250;
    const notario = 500;
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

    const breakdown = [
      { label: 'IMT', value: imt, pct: ((imt / total) * 100).toFixed(1) + '%' },
      { label: 'Imposto de Selo (0,8%)', value: is, pct: ((is / total) * 100).toFixed(1) + '%' },
      { label: 'Registo Predial', value: registro, pct: ((registro / total) * 100).toFixed(1) + '%' },
      { label: 'Notário', value: notario, pct: ((notario / total) * 100).toFixed(1) + '%' },
      { label: 'Advogado (1%)', value: advogado, pct: ((advogado / total) * 100).toFixed(1) + '%' },
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
