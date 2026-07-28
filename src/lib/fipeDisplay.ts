export type FipeCampos = {
  fipe?: string | null;
  fipeModelo?: string | null;
  fipeCodigo?: string | null;
  fipeValor?: string | null;
  fipeReferencia?: string | null;
};

export function fipeCamposDeVeiculo(v: Record<string, unknown>): FipeCampos {
  return {
    fipe: typeof v.fipe === "string" ? v.fipe : undefined,
    fipeModelo: typeof v.fipeModelo === "string" ? v.fipeModelo : undefined,
    fipeCodigo: typeof v.fipeCodigo === "string" ? v.fipeCodigo : undefined,
    fipeValor: typeof v.fipeValor === "string" ? v.fipeValor : undefined,
    fipeReferencia: typeof v.fipeReferencia === "string" ? v.fipeReferencia : undefined,
  };
}

export function temDadosFipe(fipe: FipeCampos): boolean {
  return [fipe.fipeValor, fipe.fipeModelo, fipe.fipeCodigo, fipe.fipeReferencia, fipe.fipe].some(
    (v) => String(v ?? "").trim() !== "",
  );
}
