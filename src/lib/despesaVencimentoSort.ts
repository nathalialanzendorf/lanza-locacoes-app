/** Timestamp UTC para ordenar vencimentos DD/MM/AAAA (mais recente primeiro). */
export function vencimentoDespesaSortMs(vencimentoBr?: string | null): number {
  const m = String(vencimentoBr ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const [, dd, mm, yyyy] = m;
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
}

export function ordenarDespesasPorVencimentoDesc<T extends { vencimentoBr?: string | null; id?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = vencimentoDespesaSortMs(a.vencimentoBr);
    const tb = vencimentoDespesaSortMs(b.vencimentoBr);
    if (ta !== tb) return tb - ta;
    return (b.id ?? "").localeCompare(a.id ?? "", "pt-BR");
  });
}

export function vencimentoParceiroSortMs(d: {
  vencimentoBr?: string | null;
  data?: string | null;
}): number {
  return vencimentoDespesaSortMs(d.vencimentoBr?.trim() || d.data?.trim() || null);
}

export function ordenarDespesasParceiroPorVencimentoDesc<
  T extends { vencimentoBr?: string | null; data?: string | null; id?: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = vencimentoParceiroSortMs(a);
    const tb = vencimentoParceiroSortMs(b);
    if (ta !== tb) return tb - ta;
    return (b.id ?? "").localeCompare(a.id ?? "", "pt-BR");
  });
}
