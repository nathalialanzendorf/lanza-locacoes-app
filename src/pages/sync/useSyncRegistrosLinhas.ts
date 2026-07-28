import { useMemo } from "react";

import { useDespesasCliente, useInfracoes, useVeiculos } from "@/api/hooks";
import { isCategoriaEstacionamento } from "@/lib/estacionamentoLabels";
import { formatPlaca } from "@/lib/format";
import { isCategoriaPedagio } from "@/lib/pedagioLabels";
import { CategoriaDespesaCliente } from "@/lib/domain";
import { precisaConfirmacao } from "@/lib/responsavelDebitoUi";
import type { SyncRegistroTipo } from "@/lib/syncUi";
import type { ClienteDespesa, Infracao } from "@/api/types";

export type SyncRegistroLinha = {
  id: string;
  tipo: SyncRegistroTipo;
  placa: string;
  ref: string;
  descricao: string;
  data: string;
  valor: number;
  infracao?: Infracao;
  despesa?: ClienteDespesa;
};

function valorInfracao(i: Infracao): number {
  return Number(i.valorMulta ?? i.valor) || 0;
}

function valorDespesa(d: ClienteDespesa): number {
  return Number(d.valorMulta) || 0;
}

function categoriaDespesaSync(
  d: ClienteDespesa,
): typeof CategoriaDespesaCliente.Pedagio | typeof CategoriaDespesaCliente.Estacionamento | null {
  if (isCategoriaPedagio(d.categoria)) return CategoriaDespesaCliente.Pedagio;
  if (isCategoriaEstacionamento(d.categoria)) return CategoriaDespesaCliente.Estacionamento;
  return null;
}

type Params = {
  veiculoId?: string;
  semConfirmacao?: boolean;
  tipos?: SyncRegistroTipo[] | null;
};

export function useSyncRegistrosLinhas({ veiculoId, semConfirmacao, tipos }: Params) {
  const veiculoIdFiltro = veiculoId?.trim() || undefined;
  const veiculosQuery = useVeiculos({ ativo: true });

  const incluirInfracoes = !tipos || tipos.includes(CategoriaDespesaCliente.Infracao);
  const incluirDespesas =
    !tipos ||
    tipos.includes(CategoriaDespesaCliente.Pedagio) ||
    tipos.includes(CategoriaDespesaCliente.Estacionamento);

  const infracoesQuery = useInfracoes(
    {
      veiculoId: veiculoIdFiltro,
      emAberto: true,
      ativo: true,
    },
    { enabled: incluirInfracoes },
  );

  const despesasQuery = useDespesasCliente(
    {
      veiculoId: veiculoIdFiltro,
      emAberto: true,
      ativo: true,
    },
    { enabled: incluirDespesas },
  );

  const linhas = useMemo(() => {
    const out: SyncRegistroLinha[] = [];

    if (incluirInfracoes) {
      for (const i of infracoesQuery.data?.items ?? []) {
        out.push({
          id: `infracao:${i.numeroAuto ?? i.id}`,
          tipo: CategoriaDespesaCliente.Infracao,
          placa: formatPlaca(i.veiculoId),
          ref: i.numeroAuto ?? i.id,
          descricao: i.descricao?.trim() || "—",
          data: i.dataAutuacao?.slice(0, 16) ?? "—",
          valor: valorInfracao(i),
          infracao: i,
        });
      }
    }

    if (incluirDespesas) {
      for (const d of despesasQuery.data?.items ?? []) {
        const cat = categoriaDespesaSync(d);
        if (!cat) continue;
        if (tipos && !tipos.includes(cat)) continue;
        out.push({
          id: `despesa:${d.id}`,
          tipo: cat,
          placa: formatPlaca(d.placa ?? d.veiculoId),
          ref: d.autoInfracao ?? d.id.slice(0, 8),
          descricao: d.descricao?.trim() || d.titulo?.trim() || "—",
          data: d.dataAutuacao?.slice(0, 16) ?? d.vencimentoBr?.trim() ?? "—",
          valor: valorDespesa(d),
          despesa: d,
        });
      }
    }

    out.sort((a, b) => {
      const pc = a.placa.localeCompare(b.placa, "pt-BR");
      if (pc !== 0) return pc;
      return a.tipo.localeCompare(b.tipo, "pt-BR");
    });

    if (!semConfirmacao) return out;

    return out.filter((l) => {
      const item = l.infracao ?? l.despesa;
      return item ? precisaConfirmacao(item) : false;
    });
  }, [infracoesQuery.data, despesasQuery.data, semConfirmacao, tipos, incluirInfracoes, incluirDespesas]);

  const total = useMemo(() => linhas.reduce((s, l) => s + l.valor, 0), [linhas]);

  const loading =
    (incluirInfracoes && infracoesQuery.isLoading) ||
    (incluirDespesas && despesasQuery.isLoading) ||
    veiculosQuery.isLoading;

  const placaSync = useMemo(() => {
    if (!veiculoIdFiltro) return "";
    return veiculosQuery.data?.items.find((v) => v.id === veiculoIdFiltro)?.placa?.trim() ?? "";
  }, [veiculoIdFiltro, veiculosQuery.data]);

  return {
    linhas,
    total,
    loading,
    placaSync,
    veiculoIdFiltro,
    infracoesQuery,
    despesasQuery,
  };
}
