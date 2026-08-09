export const CategoriaDespesaVenda = {
  Entrada: "Venda entrada",
  Parcela: "Venda parcela",
} as const;

export type CategoriaDespesaVendaValor =
  (typeof CategoriaDespesaVenda)[keyof typeof CategoriaDespesaVenda];

export const CATEGORIAS_DESPESA_VENDA: string[] = [
  CategoriaDespesaVenda.Entrada,
  CategoriaDespesaVenda.Parcela,
];

export function isCategoriaVenda(categoria: string | undefined | null): boolean {
  const c = String(categoria ?? "").trim().toLowerCase();
  return CATEGORIAS_DESPESA_VENDA.some((cat) => cat.toLowerCase() === c);
}
