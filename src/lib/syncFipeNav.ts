/** URL da aba FIPE em Syncs, com placa e renavam opcionais. */
export function syncFipePath(placa?: string, renavam?: string): string {
  const params = new URLSearchParams();
  const p = placa?.trim();
  const r = renavam?.trim();
  if (p) params.set("placa", p);
  if (r) params.set("renavam", r);
  const q = params.toString();
  return q ? `/sync/fipe?${q}` : "/sync/fipe";
}
