import type { Contrato } from "@/api/types";
import { brToIsoDate, isoDateToBr } from "@/lib/dateBr";
import {
  DIA_PAGAMENTO_POR_CHAVE,
  DIAS_PAGAMENTO_SEMANAL,
} from "@/lib/domain";
import { hojeIsoBr } from "@/lib/contratoVencimento";

export const PERIODOS_CONTRATO = [
  { value: "semana", label: "1 semana", dias: 7 },
  { value: "15 dias", label: "15 dias", dias: 15 },
  { value: "3 meses", label: "3 meses", dias: 90 },
  { value: "6 meses", label: "6 meses", dias: 180 },
  { value: "1 ano", label: "1 ano", dias: 365 },
] as const;

export type PeriodoContratoValue = (typeof PERIODOS_CONTRATO)[number]["value"];

const PERIODO_DIAS: Record<string, number> = Object.fromEntries(
  PERIODOS_CONTRATO.map((p) => [p.value, p.dias]),
);

export function hojeDataBr(): string {
  return isoDateToBr(hojeIsoBr());
}

export function periodoParaDias(periodo: string): number | null {
  const key = periodo.trim().toLowerCase();
  const dias = PERIODO_DIAS[key];
  return dias ?? null;
}

/** Mapeia duração em dias para a opção padrão do select, se houver correspondência exata. */
export function periodoDeDias(dias: number): PeriodoContratoValue | "" {
  const n = Math.round(dias);
  const match = PERIODOS_CONTRATO.find((p) => p.dias === n);
  return match?.value ?? "";
}

export function somarDiasDataBr(inicioBr: string, dias: number): string {
  const iso = brToIsoDate(inicioBr);
  if (!iso || !Number.isFinite(dias)) return "";
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + Math.round(dias));
  return isoDateToBr(d.toISOString().slice(0, 10));
}

export function diasEntreDatasBr(inicioBr: string, fimBr: string): number | null {
  const ini = brToIsoDate(inicioBr);
  const fim = brToIsoDate(fimBr);
  if (!ini || !fim) return null;
  const a = new Date(`${ini}T12:00:00`);
  const b = new Date(`${fim}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function dataFimDePeriodo(inicioBr: string, periodo: string): string {
  const dias = periodoParaDias(periodo);
  if (!dias) return "";
  return somarDiasDataBr(inicioBr, dias);
}

export type PrazoRenovacaoPreenchido = {
  dataInicio: string;
  dataFim: string;
  periodo: string;
  periodoPersonalizado: boolean;
  prazoDias: number | null;
};

/** Preenche início, fim e tempo do contrato a partir do registro anterior (renovação). */
export function preencherPrazoRenovacao(c: {
  dataInicio?: string | null;
  dataFimPrevista?: string | null;
  dataFim?: string | null;
  prazoDias?: number | null;
}): PrazoRenovacaoPreenchido {
  const inicio = c.dataInicio?.trim() || hojeDataBr();
  const fimInformado = c.dataFimPrevista?.trim() || c.dataFim?.trim() || "";

  let prazoDias: number | null =
    c.prazoDias != null && c.prazoDias > 0 ? Math.round(c.prazoDias) : null;
  if (prazoDias == null && inicio && fimInformado) {
    prazoDias = diasEntreDatasBr(inicio, fimInformado);
  }

  let periodo = prazoDias != null ? periodoDeDias(prazoDias) : "";
  let periodoPersonalizado = false;

  if (!periodo && inicio && fimInformado) {
    periodoPersonalizado = true;
    periodo = "";
  } else if (!periodo) {
    periodo = "3 meses";
    prazoDias = prazoDias ?? periodoParaDias(periodo);
  }

  const dataFim =
    fimInformado ||
    (periodo && !periodoPersonalizado ? dataFimDePeriodo(inicio, periodo) : "");

  return { dataInicio: inicio, dataFim, periodo, periodoPersonalizado, prazoDias };
}

/** Rótulo do tempo de contrato para exibição (select ou dias personalizados). */
export function labelTempoContrato(periodo: string, prazoDias: number | null): string {
  if (periodo.trim()) {
    const opt = PERIODOS_CONTRATO.find((p) => p.value === periodo);
    return opt?.label ?? periodo;
  }
  if (prazoDias != null && prazoDias > 0) return `${prazoDias} dias`;
  return "—";
}

/** Texto da cláusula 3.2 — `--dia-pagamento` / `montarDadosContrato`. */
export { DIAS_PAGAMENTO_SEMANAL };

/** Rótulo curto do dia de pagamento semanal (ex.: "Segunda-feira"). */
export function labelDiaPagamentoSemanal(raw: string | null | undefined): string {
  if (!String(raw ?? "").trim()) return "—";
  const value = diaPagamentoSemanaParaSelect(raw);
  const opt = DIAS_PAGAMENTO_SEMANAL.find((d) => d.value === value);
  return opt?.label ?? String(raw).trim();
}

/** Exibição do pagamento do contrato (semanal, mensal ou texto livre). */
export function pagamentoContratoExibicao(
  contrato:
    | Pick<Contrato, "diaPagamentoSemana" | "diaPagamentoMes" | "diaPagamentoTexto">
    | null
    | undefined,
): string {
  if (!contrato) return "—";
  if (contrato.diaPagamentoMes != null) return `Dia ${contrato.diaPagamentoMes}`;
  if (contrato.diaPagamentoSemana?.trim()) {
    return labelDiaPagamentoSemanal(contrato.diaPagamentoSemana);
  }
  const texto = contrato.diaPagamentoTexto?.trim();
  return texto || "—";
}

/** Converte `diaPagamentoSemana` do contrato para valor do select. */
export function diaPagamentoSemanaParaSelect(raw: string | null | undefined): string {
  const t = String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (!t) return DIAS_PAGAMENTO_SEMANAL[0]!.value;
  for (const opt of DIAS_PAGAMENTO_SEMANAL) {
    if (opt.value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() === t) {
      return opt.value;
    }
  }
  for (const [key, value] of Object.entries(DIA_PAGAMENTO_POR_CHAVE)) {
    if (t.includes(key)) return value;
  }
  return DIAS_PAGAMENTO_SEMANAL[0]!.value;
}
