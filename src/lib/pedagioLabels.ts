/**
 * Pedágio ← Pedágio Digital (portal pedagiodigital.com)
 *
 * - Categoria do débito / filtros API: `Pedágio`
 * - Rótulo do portal na UI: `Pedágio Digital`
 */
export const CATEGORIA_PEDAGIO = "Pedágio";

export const ROTULO_PEDAGIO_DIGITAL = "Pedágio Digital";

export function isCategoriaPedagio(categoria: string | undefined | null): boolean {
  const c = (categoria ?? "").trim();
  return c === CATEGORIA_PEDAGIO || c === ROTULO_PEDAGIO_DIGITAL;
}

/** Rótulo do portal ou origem `pedagio-digital`. */
export function rotuloPedagioDigital(valor?: string | null): string {
  const v = (valor ?? "").trim();
  if (!v || v === "pedagio-digital" || isCategoriaPedagio(v)) return ROTULO_PEDAGIO_DIGITAL;
  return v;
}

/** Exibição da categoria na listagem de despesas. */
export function rotuloCategoriaDespesa(categoria?: string | null): string {
  if (isCategoriaPedagio(categoria)) return CATEGORIA_PEDAGIO;
  return categoria?.trim() || "—";
}
