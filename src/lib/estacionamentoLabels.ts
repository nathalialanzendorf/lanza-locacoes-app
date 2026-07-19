/**
 * Estacionamento ← SigaPay (portal/app Zona Azul Brasil)
 *
 * - Categoria do débito / filtros API: `Estacionamento`
 * - Rótulo do portal na UI: `SigaPay`
 */
export const CATEGORIA_ESTACIONAMENTO = "Estacionamento";

export const ROTULO_SIGAPAY = "SigaPay";

/** @deprecated Use ROTULO_SIGAPAY */
export const ROTULO_ESTACIONAMENTO_SIGAPAY = ROTULO_SIGAPAY;

export function isCategoriaEstacionamento(categoria: string | undefined | null): boolean {
  const c = (categoria ?? "").trim();
  return (
    c === CATEGORIA_ESTACIONAMENTO ||
    c === "Estacionamento rotativo SigaPay" ||
    c === ROTULO_SIGAPAY
  );
}

/** Rótulo do portal ou origem `sigapay`. */
export function rotuloEstacionamentoRotativo(valor?: string | null): string {
  const v = (valor ?? "").trim();
  if (!v || v === "sigapay" || isCategoriaEstacionamento(v)) return ROTULO_SIGAPAY;
  return v;
}

export function rotuloCategoriaDespesa(categoria?: string | null): string {
  if (isCategoriaEstacionamento(categoria)) return CATEGORIA_ESTACIONAMENTO;
  return categoria?.trim() || "—";
}
