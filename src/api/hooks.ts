import { useQuery } from "@tanstack/react-query";
import { lanzaApi } from "./endpoints";
import type { StatusContratoValor, CategoriaMovimentacaoValor } from "@/lib/domain";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => lanzaApi.health(),
    retry: 1,
    staleTime: 30_000,
  });
}

export function useResumo() {
  return useQuery({
    queryKey: ["resumo"],
    queryFn: () => lanzaApi.resumo(),
    staleTime: 60_000,
  });
}

export function useDashboardRecebimentosTotais() {
  return useQuery({
    queryKey: ["dashboard", "recebimentos", "totais"],
    queryFn: () => lanzaApi.dashboardRecebimentosTotais(),
    staleTime: 60_000,
  });
}

export function useDashboardRecebimentosAtrasados() {
  return useQuery({
    queryKey: ["dashboard", "recebimentos", "atrasados"],
    queryFn: () => lanzaApi.dashboardRecebimentosAtrasados(),
    staleTime: 60_000,
  });
}

export function useClientes(opts?: { ativo?: boolean; cpf?: string; nome?: string; q?: string }) {
  return useQuery({
    queryKey: ["clientes", opts ?? {}],
    queryFn: () => lanzaApi.listarClientes(opts),
  });
}

export function useVeiculos(params?: { ativo?: boolean; placa?: string; particular?: boolean; tipoFrota?: string }) {
  return useQuery({
    queryKey: ["veiculos", params],
    queryFn: () => lanzaApi.listarVeiculos(params),
  });
}

export function useVeiculo(id: string | undefined) {
  return useQuery({
    queryKey: ["veiculos", id],
    queryFn: () => lanzaApi.obterVeiculo(id!),
    enabled: Boolean(id),
  });
}

export function useContratos(
  params?: {
    status?: StatusContratoValor;
    placa?: string;
    clienteId?: string;
    veiculoId?: string;
    dataInicial?: string;
    dataFinal?: string;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["contratos", params],
    queryFn: () => lanzaApi.listarContratos(params),
    enabled: options?.enabled ?? true,
  });
}

export function useDespesasCliente(
  params?: {
    emAberto?: boolean;
    ativo?: boolean;
    clienteId?: string;
    veiculoId?: string;
    placa?: string;
    categoria?: string;
    competencia?: string;
    semCliente?: boolean;
    dataInicial?: string;
    dataFinal?: string;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["despesas-cliente", params],
    queryFn: () => lanzaApi.listarDespesasCliente(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useRenegociacaoResumo(
  params?: { clienteId?: string; veiculoId?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["renegociacao-resumo", params],
    queryFn: () => lanzaApi.resumoRenegociacao(params ?? {}),
    enabled: options?.enabled ?? Boolean(params?.clienteId?.trim()),
    staleTime: 30_000,
  });
}

export function useDespesasParceiro(params?: {
  emAberto?: boolean;
  ativo?: boolean;
  parceiroId?: string;
  veiculoId?: string;
  placa?: string;
  categoria?: string;
  competencia?: string;
  dataInicial?: string;
  dataFinal?: string;
}) {
  return useQuery({
    queryKey: ["despesas-parceiro", params],
    queryFn: () => lanzaApi.listarDespesasParceiro(params),
  });
}

export function useVendas(params?: {
  veiculoId?: string;
  clienteId?: string;
  placa?: string;
  ativo?: boolean;
  dataInicial?: string;
  dataFinal?: string;
}) {
  return useQuery({
    queryKey: ["vendas", params],
    queryFn: () => lanzaApi.listarVendas(params),
  });
}

export function useVenda(id: string | undefined) {
  return useQuery({
    queryKey: ["vendas", id],
    queryFn: () => lanzaApi.obterVenda(id!),
    enabled: Boolean(id),
  });
}

export function useLocacoes(params?: {
  abertas?: boolean;
  veiculoId?: string;
  placa?: string;
  situacao?: CategoriaMovimentacaoValor;
  clienteId?: string;
  dataInicial?: string;
  dataFinal?: string;
}) {
  return useQuery({
    queryKey: ["locacoes", params],
    queryFn: () => lanzaApi.listarLocacoes(params),
  });
}

export function useParceiros(opts?: { ativo?: boolean; nome?: string; q?: string }) {
  return useQuery({
    queryKey: ["parceiros", opts ?? {}],
    queryFn: () => lanzaApi.listarParceiros(opts),
  });
}

export function useVinculosParceiro(params?: { veiculoId?: string; parceiroId?: string }) {
  return useQuery({
    queryKey: ["parceiros-vinculos", params],
    queryFn: () => lanzaApi.listarVinculosParceiro(params),
  });
}

export function useInfracoes(
  params?: {
    placa?: string;
    veiculoId?: string;
    clienteId?: string;
    parceiroId?: string;
    dataInicial?: string;
    dataFinal?: string;
    emAberto?: boolean;
    semCliente?: boolean;
    ativo?: boolean;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["infracoes", params],
    queryFn: () => lanzaApi.listarInfracoes(params),
    enabled: options?.enabled ?? true,
  });
}

export function useSyncMeta() {
  return useQuery({
    queryKey: ["sync-meta"],
    queryFn: () => lanzaApi.metaSync(),
    staleTime: 60_000,
  });
}

export function useSyncJobs(limit = 25) {
  return useQuery({
    queryKey: ["sync-jobs", limit],
    queryFn: () => lanzaApi.listarSyncJobs(limit),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const active = jobs.some((j) => j.status === "pending" || j.status === "running");
      return active ? 3000 : false;
    },
  });
}
