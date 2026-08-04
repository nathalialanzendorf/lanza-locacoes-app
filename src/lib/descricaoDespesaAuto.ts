import { normalizeHoraBr } from "@/components/TimeInput";
import { brToIsoDate } from "@/lib/dateBr";
import { CategoriaDespesaCliente, type CategoriaDespesaClienteCadastro } from "@/lib/domain";
import { descricaoPagamentoSemanalDeVencimentoBr } from "@/lib/pagamentoSemanal";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Tipos curtos alinhados ao classificador DETRAN (`tipoInfracao`). */
export const TIPOS_INFRACAO_CADASTRO = [
  "velocidade",
  "sinal",
  "estacionamento",
  "parada",
  "cinto",
  "farol",
  "celular",
  "conversão",
  "acostamento",
  "alcoolemia",
  "capacete",
  "rodízio",
  "documento",
  "faixa",
  "trânsito",
] as const;

/** `dd/mm/aaaa HH:mm` a partir do vencimento e hora (HH:MM). */
export function dataHoraBrDeVencimento(
  vencimentoBr: string,
  horaBr: string,
): string | null {
  const iso = brToIsoDate(vencimentoBr);
  const hora = normalizeHoraBr(horaBr);
  if (!iso || !hora) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return `${pad2(d)}/${pad2(mo)}/${y} ${hora}`;
}

export function descricaoPagamentoCaucao(opts?: {
  parcela?: number | null;
  totalParcelas?: number | null;
}): string {
  const n = opts?.parcela;
  const total = opts?.totalParcelas;
  if (
    n != null &&
    total != null &&
    Number.isFinite(n) &&
    Number.isFinite(total) &&
    n >= 1 &&
    total >= 1
  ) {
    return `Pagamento caução - ${n}x${total}`;
  }
  return "Pagamento caução";
}

export function descricaoPagamentoRenegociacao(
  parcela: number,
  totalParcelas: number,
): string | null {
  if (
    !Number.isFinite(parcela) ||
    !Number.isFinite(totalParcelas) ||
    parcela < 1 ||
    totalParcelas < 1
  ) {
    return null;
  }
  return `Pagamento renegociação ${parcela}x${totalParcelas}`;
}

export function descricaoPagamentoPedagio(
  vencimentoBr: string,
  horaBr: string,
): string | null {
  const dh = dataHoraBrDeVencimento(vencimentoBr, horaBr);
  return dh ? `Pagamento pedágio ${dh}` : null;
}

export function descricaoPagamentoEstacionamento(
  vencimentoBr: string,
  horaBr: string,
): string | null {
  const dh = dataHoraBrDeVencimento(vencimentoBr, horaBr);
  return dh ? `Pagamento estacionamento ${dh}` : null;
}

export function descricaoPagamentoInfracao(
  tipo: string,
  vencimentoBr: string,
  horaBr: string,
): string | null {
  const t = tipo.trim();
  const dh = dataHoraBrDeVencimento(vencimentoBr, horaBr);
  if (!t || !dh) return null;
  return `Pagamento infração ${t} ${dh}`;
}

export type DescricaoDespesaAutoInput = {
  categoria: CategoriaDespesaClienteCadastro;
  vencimentoBr: string;
  horaBr?: string;
  parcela?: number | null;
  totalParcelas?: number | null;
  tipoInfracao?: string | null;
};

/** Descrição sugerida no cadastro (null = sem autofill para a categoria). */
export function descricaoDespesaAuto(input: DescricaoDespesaAutoInput): string | null {
  const {
    categoria,
    vencimentoBr,
    horaBr = "",
    parcela,
    totalParcelas,
    tipoInfracao,
  } = input;
  switch (categoria) {
    case CategoriaDespesaCliente.LocacaoSemanal:
      return descricaoPagamentoSemanalDeVencimentoBr(vencimentoBr);
    case CategoriaDespesaCliente.Caucao:
      return descricaoPagamentoCaucao({ parcela, totalParcelas });
    case CategoriaDespesaCliente.Renegociacao:
      return parcela != null && totalParcelas != null
        ? descricaoPagamentoRenegociacao(parcela, totalParcelas)
        : null;
    case CategoriaDespesaCliente.Pedagio:
      return descricaoPagamentoPedagio(vencimentoBr, horaBr);
    case CategoriaDespesaCliente.Estacionamento:
      return descricaoPagamentoEstacionamento(vencimentoBr, horaBr);
    case CategoriaDespesaCliente.Infracao:
      return tipoInfracao?.trim()
        ? descricaoPagamentoInfracao(tipoInfracao, vencimentoBr, horaBr)
        : null;
    default:
      return null;
  }
}

export function categoriaUsaHoraDescricao(
  categoria: CategoriaDespesaClienteCadastro,
): boolean {
  return (
    categoria === CategoriaDespesaCliente.Pedagio ||
    categoria === CategoriaDespesaCliente.Estacionamento ||
    categoria === CategoriaDespesaCliente.Infracao
  );
}

export function categoriaUsaParcelaDescricao(
  categoria: CategoriaDespesaClienteCadastro,
): boolean {
  return (
    categoria === CategoriaDespesaCliente.Renegociacao ||
    categoria === CategoriaDespesaCliente.Caucao
  );
}

export function categoriaUsaTipoInfracao(
  categoria: CategoriaDespesaClienteCadastro,
): boolean {
  return categoria === CategoriaDespesaCliente.Infracao;
}
