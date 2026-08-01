import { SituacaoDespesa, type SituacaoDespesaValor } from "@/lib/domain/situacaoDespesa";
import { brToIsoDate } from "@/lib/dateBr";

/** Valor interno de filtro/cadastro (UI). */
export const StatusDespesaFiltro = {
  EmAberto: "em_aberto",
  Pago: "pago",
  Todos: "todos",
} as const;

export type StatusDespesaFiltroValor =
  (typeof StatusDespesaFiltro)[keyof typeof StatusDespesaFiltro];

/** Alias usado em formulários de cadastro de despesa. */
export type StatusDespesaCadastro =
  | typeof StatusDespesaFiltro.EmAberto
  | typeof StatusDespesaFiltro.Pago;

export const STATUS_DESPESA_CADASTRO_OPCOES = [
  { value: StatusDespesaFiltro.EmAberto, label: SituacaoDespesa.EmAberto },
  { value: StatusDespesaFiltro.Pago, label: SituacaoDespesa.Pago },
] as const;

export const STATUS_DESPESA_FILTRO_OPCOES = [
  { value: StatusDespesaFiltro.EmAberto, label: SituacaoDespesa.EmAberto },
  { value: StatusDespesaFiltro.Pago, label: SituacaoDespesa.Pago },
  { value: StatusDespesaFiltro.Todos, label: "Todos" },
] as const;

export function statusCadastroDeDespesa(d: {
  paga?: boolean;
  situacao?: string | null;
}): StatusDespesaCadastro {
  if (d.paga === true) return StatusDespesaFiltro.Pago;
  const sit = String(d.situacao ?? "")
    .trim()
    .toLowerCase();
  if (sit === "pago" || sit === "registrado") return StatusDespesaFiltro.Pago;
  return StatusDespesaFiltro.EmAberto;
}

export function pagaEmIsoDeCadastro(pagaEmAtual?: string | null): string {
  const br = pagaEmAtual?.trim() || new Date().toLocaleDateString("pt-BR");
  const isoDate = brToIsoDate(br);
  if (!isoDate) return new Date().toISOString();
  return new Date(`${isoDate}T12:00:00-03:00`).toISOString();
}

export function camposStatusDespesaDeCadastro(
  status: StatusDespesaCadastro,
  pagaEmAtual?: string | null,
): { paga: boolean; situacao: SituacaoDespesaValor; pagaEm: string | null } {
  if (status === StatusDespesaFiltro.Pago) {
    return {
      paga: true,
      situacao: SituacaoDespesa.Pago,
      pagaEm: pagaEmIsoDeCadastro(pagaEmAtual),
    };
  }
  return { paga: false, situacao: SituacaoDespesa.EmAberto, pagaEm: null };
}

export function filtroPagamentoParaEmAberto(
  filtro: StatusDespesaFiltroValor,
): boolean | undefined {
  if (filtro === StatusDespesaFiltro.EmAberto) return true;
  if (filtro === StatusDespesaFiltro.Pago) return false;
  return undefined;
}
