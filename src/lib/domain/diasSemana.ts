/** Dia da semana (Date.getDay(): 0 = domingo … 6 = sábado). */
export const DiaSemanaJs = {
  Domingo: 0,
  Segunda: 1,
  Terca: 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  Sabado: 6,
} as const;

export type DiaSemanaJsValor = (typeof DiaSemanaJs)[keyof typeof DiaSemanaJs];

export type DiaSemanaDef = {
  jsDay: DiaSemanaJsValor;
  /** Ex.: "Segunda-feira" */
  label: string;
  /** Ex.: "Segunda" — usado em "Pagamento semanal - Quarta 15" */
  labelCurto: string;
  /** Valor da cláusula 3.2 do contrato (select de dia de pagamento). */
  contratoClausula: string;
  /** Chave normalizada para inferir dia a partir de texto livre. */
  chave: string;
};

export const DIAS_SEMANA: readonly DiaSemanaDef[] = [
  {
    jsDay: DiaSemanaJs.Domingo,
    label: "Domingo",
    labelCurto: "Domingo",
    contratoClausula: "todos os domingos",
    chave: "domingo",
  },
  {
    jsDay: DiaSemanaJs.Segunda,
    label: "Segunda-feira",
    labelCurto: "Segunda",
    contratoClausula: "todas as segundas-feiras",
    chave: "segunda",
  },
  {
    jsDay: DiaSemanaJs.Terca,
    label: "Terça-feira",
    labelCurto: "Terça",
    contratoClausula: "todas as terças-feiras",
    chave: "terca",
  },
  {
    jsDay: DiaSemanaJs.Quarta,
    label: "Quarta-feira",
    labelCurto: "Quarta",
    contratoClausula: "todas as quartas-feiras",
    chave: "quarta",
  },
  {
    jsDay: DiaSemanaJs.Quinta,
    label: "Quinta-feira",
    labelCurto: "Quinta",
    contratoClausula: "todas as quintas-feiras",
    chave: "quinta",
  },
  {
    jsDay: DiaSemanaJs.Sexta,
    label: "Sexta-feira",
    labelCurto: "Sexta",
    contratoClausula: "todas as sextas-feiras",
    chave: "sexta",
  },
  {
    jsDay: DiaSemanaJs.Sabado,
    label: "Sábado",
    labelCurto: "Sábado",
    contratoClausula: "todos os sábados",
    chave: "sabado",
  },
] as const;

/** Ordem do select de dia de pagamento semanal no cadastro de contrato. */
export const DIAS_PAGAMENTO_SEMANAL_ORDEM: readonly DiaSemanaJsValor[] = [
  DiaSemanaJs.Sabado,
  DiaSemanaJs.Segunda,
  DiaSemanaJs.Terca,
  DiaSemanaJs.Quarta,
  DiaSemanaJs.Quinta,
  DiaSemanaJs.Sexta,
  DiaSemanaJs.Domingo,
];

export const DIAS_PAGAMENTO_SEMANAL = DIAS_PAGAMENTO_SEMANAL_ORDEM.map((jsDay) => {
  const dia = DIAS_SEMANA[jsDay]!;
  return { value: dia.contratoClausula, label: dia.label };
});

export const DIA_PAGAMENTO_POR_CHAVE: Record<string, string> = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.chave, d.contratoClausula]),
);

export function diaSemanaPorJsDay(jsDay: number): DiaSemanaDef | null {
  return DIAS_SEMANA[jsDay] ?? null;
}

export function labelCurtoDiaSemana(jsDay: number): string | null {
  return diaSemanaPorJsDay(jsDay)?.labelCurto ?? null;
}
