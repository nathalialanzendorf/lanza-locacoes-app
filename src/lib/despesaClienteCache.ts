import type { QueryClient } from "@tanstack/react-query";

import type { ClienteDespesa } from "@/api/types";

type DespesasListCache = { total: number; items: ClienteDespesa[] };

/** Atualiza caches de listagem sem refetch imediato (resposta do PATCH/POST). */
export function mergeDespesaClienteNoCache(qc: QueryClient, updated: ClienteDespesa): void {
  qc.setQueriesData<DespesasListCache>({ queryKey: ["despesas-cliente"] }, (old) => {
    if (!old?.items) return old;
    const idx = old.items.findIndex((d) => d.id === updated.id);
    if (idx < 0) {
      return { total: old.total + 1, items: [updated, ...old.items] };
    }
    const items = [...old.items];
    items[idx] = { ...items[idx]!, ...updated };
    return { ...old, items };
  });
}
