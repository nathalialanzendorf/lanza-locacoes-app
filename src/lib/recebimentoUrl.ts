import type { ClienteDespesa, DashboardRecebimentoLinha } from "@/api/types";

/** Link para baixa manual com cliente, despesa, valor e data pré-preenchidos. */
export function urlLancarRecebimento(
  linha: DashboardRecebimentoLinha,
  dataReferenciaBr?: string | null,
): string | null {
  const clienteId = linha.clienteId?.trim();
  if (!clienteId) return null;

  const params = new URLSearchParams();
  params.set("clienteId", clienteId);

  if (Number.isFinite(linha.valor) && linha.valor > 0) {
    params.set("valor", String(linha.valor));
  }

  const despesaId = linha.despesaId?.trim();
  if (despesaId) params.set("despesaId", despesaId);

  const data = dataReferenciaBr?.trim();
  if (data && data !== "—") params.set("dataBr", data);

  return `/recebimentos?${params.toString()}`;
}

/** Link para baixa manual a partir de uma despesa do cliente (listagem Despesas). */
export function urlLancarRecebimentoDespesa(
  d: ClienteDespesa,
  dataReferenciaBr?: string | null,
): string | null {
  const clienteId = (d.clienteId ?? d.condutorId)?.trim();
  if (!clienteId) return null;

  const params = new URLSearchParams();
  params.set("clienteId", clienteId);

  const valor = Number(d.valorMulta);
  if (Number.isFinite(valor) && valor > 0) {
    params.set("valor", String(valor));
  }

  const despesaId = d.id?.trim();
  if (despesaId) params.set("despesaId", despesaId);

  const data = (dataReferenciaBr ?? d.vencimentoBr)?.trim();
  if (data && data !== "—") params.set("dataBr", data);

  return `/recebimentos?${params.toString()}`;
}
