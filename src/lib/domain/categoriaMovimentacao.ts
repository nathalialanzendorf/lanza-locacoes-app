/** Categoria gravada em `locacoes.situacao` (locado, reserva, manutenção). */
export const CategoriaMovimentacao = {
  Locado: "locado",
  Reserva: "reserva",
  Manutencao: "manutencao",
} as const;

export type CategoriaMovimentacaoValor =
  (typeof CategoriaMovimentacao)[keyof typeof CategoriaMovimentacao];

const CATEGORIAS_MOVIMENTACAO_VALIDAS = new Set<string>(Object.values(CategoriaMovimentacao));

export function isCategoriaMovimentacaoValor(
  raw: string | null | undefined,
): raw is CategoriaMovimentacaoValor {
  return CATEGORIAS_MOVIMENTACAO_VALIDAS.has(String(raw ?? "").trim());
}

export const RotuloCategoriaMovimentacao = {
  Locado: "Locado",
  Reserva: "Reserva",
  Manutencao: "Manutenção",
} as const;

export const CATEGORIA_MOVIMENTACAO_OPCOES = [
  { value: CategoriaMovimentacao.Locado, label: RotuloCategoriaMovimentacao.Locado },
  { value: CategoriaMovimentacao.Reserva, label: RotuloCategoriaMovimentacao.Reserva },
  { value: CategoriaMovimentacao.Manutencao, label: RotuloCategoriaMovimentacao.Manutencao },
] as const;

export function rotuloCategoriaMovimentacao(valor: CategoriaMovimentacaoValor): string {
  switch (valor) {
    case CategoriaMovimentacao.Locado:
      return RotuloCategoriaMovimentacao.Locado;
    case CategoriaMovimentacao.Reserva:
      return RotuloCategoriaMovimentacao.Reserva;
    case CategoriaMovimentacao.Manutencao:
      return RotuloCategoriaMovimentacao.Manutencao;
  }
}

/** @deprecated Use {@link CategoriaMovimentacao}. */
export const SituacaoLocacao = CategoriaMovimentacao;

/** @deprecated Use {@link CategoriaMovimentacaoValor}. */
export type SituacaoLocacaoValor = CategoriaMovimentacaoValor;

/** @deprecated Use {@link isCategoriaMovimentacaoValor}. */
export const isSituacaoLocacaoValor = isCategoriaMovimentacaoValor;

/** @deprecated Use {@link CATEGORIA_MOVIMENTACAO_OPCOES}. */
export const SITUACAO_LOCACAO_OPCOES = CATEGORIA_MOVIMENTACAO_OPCOES;
