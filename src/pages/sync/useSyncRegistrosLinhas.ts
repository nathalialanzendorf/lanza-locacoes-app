import { useMemo } from "react";

import { useDespesasCliente, useInfracoes, useVeiculos } from "@/api/hooks";
import { isCategoriaEstacionamento } from "@/lib/estacionamentoLabels";
import { formatPlaca, formatVeiculoLabel } from "@/lib/format";
import { isCategoriaPedagio } from "@/lib/pedagioLabels";
import { CategoriaDespesaCliente, TipoVeiculoFrota } from "@/lib/domain";
import type { SyncRegistroTipo } from "@/lib/syncUi";
import type { ClienteDespesa, Infracao, Veiculo } from "@/api/types";

export type SyncRegistroLinha = {
  id: string;
  tipo: SyncRegistroTipo;
  placa: string;
  veiculo: string;
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

function compactPlaca(placa: string | null | undefined): string {
  return (placa ?? "").replace(/-/g, "").trim().toUpperCase();
}

function labelVeiculo(
  ref: string | null | undefined,
  veiculos: Veiculo[] | undefined,
  veiculoLabel?: string | null,
): string {
  if (veiculoLabel?.trim()) return veiculoLabel.trim();
  const key = compactPlaca(ref);
  const v = veiculos?.find((x) => x.id === ref || compactPlaca(x.placa) === key);
  if (v) return formatVeiculoLabel(v);
  return formatVeiculoLabel({ placa: ref || undefined });
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
  tipos?: SyncRegistroTipo[] | null;
};

export function useSyncRegistrosLinhas({ veiculoId, tipos }: Params) {
  const veiculoIdFiltro = veiculoId?.trim() || undefined;
  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const veiculos = veiculosQuery.data?.items;

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
          veiculo: labelVeiculo(i.veiculoId, veiculos),
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
          veiculo: labelVeiculo(d.placa ?? d.veiculoId, veiculos, d.veiculoLabel),
          ref: d.autoInfracao ?? d.id.slice(0, 8),
          descricao: d.descricao?.trim() || d.titulo?.trim() || "—",
          data: d.dataAutuacao?.slice(0, 16) ?? d.vencimentoBr?.trim() ?? "—",
          valor: valorDespesa(d),
          despesa: d,
        });
      }
    }

    out.sort((a, b) => {
      const pc = a.veiculo.localeCompare(b.veiculo, "pt-BR");
      if (pc !== 0) return pc;
      return a.tipo.localeCompare(b.tipo, "pt-BR");
    });

    return out;
  }, [infracoesQuery.data, despesasQuery.data, tipos, incluirInfracoes, incluirDespesas, veiculos]);

  const total = useMemo(() => linhas.reduce((s, l) => s + l.valor, 0), [linhas]);

  const loading =
    (incluirInfracoes && infracoesQuery.isLoading) ||
    (incluirDespesas && despesasQuery.isLoading) ||
    veiculosQuery.isLoading;

  const placaSync = useMemo(() => {
    if (!veiculoIdFiltro) return "";
    return veiculos?.find((v) => v.id === veiculoIdFiltro)?.placa?.trim() ?? "";
  }, [veiculoIdFiltro, veiculos]);

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
