import { SituacaoDespesa, type SituacaoDespesaValor } from "@/lib/domain/situacaoDespesa";
import { brToIsoDate } from "@/lib/dateBr";

/** Status de cobrança persistido (`statusCobranca`). */
export const StatusCobrancaDespesa = {
  EmAberto: "em_aberto",
  Pago: "pago",
  Baixado: "baixado",
} as const;

export type StatusCobrancaDespesaValor =
  (typeof StatusCobrancaDespesa)[keyof typeof StatusCobrancaDespesa];

/** Valor interno de filtro/cadastro (UI). */
export const StatusDespesaFiltro = {
  EmAberto: "em_aberto",
  Pago: "pago",
  Baixado: "baixado",
  Todos: "todos",
} as const;

export type StatusDespesaFiltroValor =
  (typeof StatusDespesaFiltro)[keyof typeof StatusDespesaFiltro];

/** Alias usado em formulários de cadastro de despesa. */
export type StatusDespesaCadastro =
  | typeof StatusDespesaFiltro.EmAberto
  | typeof StatusDespesaFiltro.Pago
  | typeof StatusDespesaFiltro.Baixado;

export const STATUS_DESPESA_CADASTRO_OPCOES = [
  { value: StatusDespesaFiltro.EmAberto, label: SituacaoDespesa.EmAberto },
  { value: StatusDespesaFiltro.Pago, label: SituacaoDespesa.Pago },
  { value: StatusDespesaFiltro.Baixado, label: SituacaoDespesa.Baixado },
] as const;

export const STATUS_DESPESA_FILTRO_OPCOES = [
  { value: StatusDespesaFiltro.EmAberto, label: SituacaoDespesa.EmAberto },
  { value: StatusDespesaFiltro.Pago, label: SituacaoDespesa.Pago },
  { value: StatusDespesaFiltro.Baixado, label: SituacaoDespesa.Baixado },
  { value: StatusDespesaFiltro.Todos, label: "Todos" },
] as const;

/** Parceiro usa baixa por data — sem status "baixado" (caução). */
export const STATUS_DESPESA_FILTRO_PARCEIRO_OPCOES = [
  { value: StatusDespesaFiltro.EmAberto, label: SituacaoDespesa.EmAberto },
  { value: StatusDespesaFiltro.Pago, label: SituacaoDespesa.Pago },
  { value: StatusDespesaFiltro.Todos, label: "Todos" },
] as const;

export function isStatusCobrancaDespesaValor(
  v: string | null | undefined,
): v is StatusCobrancaDespesaValor {
  const s = String(v ?? "").trim();
  return (
    s === StatusCobrancaDespesa.EmAberto ||
    s === StatusCobrancaDespesa.Pago ||
    s === StatusCobrancaDespesa.Baixado
  );
}

export function resolverStatusCobranca(d: {
  statusCobranca?: string | null;
  paga?: boolean;
}): StatusCobrancaDespesaValor {
  if (isStatusCobrancaDespesaValor(d.statusCobranca)) {
    return d.statusCobranca;
  }
  return d.paga === true ? StatusCobrancaDespesa.Pago : StatusCobrancaDespesa.EmAberto;
}

export function statusCadastroDeDespesa(d: {
  statusCobranca?: string | null;
  paga?: boolean;
  situacao?: string | null;
}): StatusDespesaCadastro {
  const cobranca = resolverStatusCobranca(d);
  if (cobranca === StatusCobrancaDespesa.Baixado) return StatusDespesaFiltro.Baixado;
  if (cobranca === StatusCobrancaDespesa.Pago) return StatusDespesaFiltro.Pago;
  const sit = String(d.situacao ?? "")
    .trim()
    .toLowerCase();
  if (sit === "baixado") return StatusDespesaFiltro.Baixado;
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
): {
  paga: boolean;
  statusCobranca: StatusCobrancaDespesaValor;
  situacao: SituacaoDespesaValor;
  pagaEm: string | null;
} {
  if (status === StatusDespesaFiltro.Pago) {
    return {
      paga: true,
      statusCobranca: StatusCobrancaDespesa.Pago,
      situacao: SituacaoDespesa.Pago,
      pagaEm: pagaEmIsoDeCadastro(pagaEmAtual),
    };
  }
  if (status === StatusDespesaFiltro.Baixado) {
    return {
      paga: false,
      statusCobranca: StatusCobrancaDespesa.Baixado,
      situacao: SituacaoDespesa.Baixado,
      pagaEm: null,
    };
  }
  return {
    paga: false,
    statusCobranca: StatusCobrancaDespesa.EmAberto,
    situacao: SituacaoDespesa.EmAberto,
    pagaEm: null,
  };
}

/** Legado: em aberto / pago via boolean. Preferir `filtroStatusCobranca`. */
export function filtroPagamentoParaEmAberto(
  filtro: StatusDespesaFiltroValor,
): boolean | undefined {
  if (filtro === StatusDespesaFiltro.EmAberto) return true;
  if (filtro === StatusDespesaFiltro.Pago) return false;
  return undefined;
}

/** Filtro canónico de status de cobrança (cliente). */
export function filtroStatusCobranca(
  filtro: StatusDespesaFiltroValor,
): StatusCobrancaDespesaValor | undefined {
  if (filtro === StatusDespesaFiltro.EmAberto) return StatusCobrancaDespesa.EmAberto;
  if (filtro === StatusDespesaFiltro.Pago) return StatusCobrancaDespesa.Pago;
  if (filtro === StatusDespesaFiltro.Baixado) return StatusCobrancaDespesa.Baixado;
  return undefined;
}
