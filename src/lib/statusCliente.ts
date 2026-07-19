import type { Cliente, Contrato } from "@/api/types";

function normCpf(cpf?: string | null): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/** Contrato em locação ativa (status ativo e sem data de encerramento). */
export function contratoOperacionalAtivo(
  c: Pick<Contrato, "status" | "dataEncerramento">,
): boolean {
  if (c.status !== "ativo") return false;
  return !String(c.dataEncerramento ?? "").trim();
}

export type ContratosAtivosPorCliente = {
  porClienteId: Map<string, Contrato>;
  porCpf: Map<string, Contrato>;
};

export function indexarContratosOperacionaisAtivos(
  contratos: Contrato[] | undefined,
): ContratosAtivosPorCliente {
  const porClienteId = new Map<string, Contrato>();
  const porCpf = new Map<string, Contrato>();
  for (const c of contratos ?? []) {
    if (!contratoOperacionalAtivo(c)) continue;
    if (c.clienteId) porClienteId.set(c.clienteId, c);
    const cpf = normCpf(c.cpf);
    if (cpf) porCpf.set(cpf, c);
  }
  return { porClienteId, porCpf };
}

export function contratoOperacionalDoCliente(
  cliente: Pick<Cliente, "id" | "cpf">,
  index: ContratosAtivosPorCliente,
): Contrato | undefined {
  return index.porClienteId.get(cliente.id) ?? index.porCpf.get(normCpf(cliente.cpf));
}

/** Cliente ativo na operação = possui contrato operacional ativo. */
export function clienteOperacionalAtivo(
  cliente: Pick<Cliente, "id" | "cpf">,
  index: ContratosAtivosPorCliente,
): boolean {
  return Boolean(contratoOperacionalDoCliente(cliente, index));
}
