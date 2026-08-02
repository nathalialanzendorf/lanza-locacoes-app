/** URL da aba FIPE em Syncs, com placa e dados opcionais para pré-preencher a consulta. */
export function syncFipePath(
  placa?: string,
  opts?: { marcaModelo?: string; anoModelo?: string },
): string {
  const params = new URLSearchParams();
  const p = placa?.trim();
  const marca = opts?.marcaModelo?.trim();
  const ano = opts?.anoModelo?.trim();
  if (p) params.set("placa", p);
  if (marca) params.set("marcaModelo", marca);
  if (ano) params.set("anoModelo", ano);
  const q = params.toString();
  return q ? `/sync/fipe?${q}` : "/sync/fipe";
}
