import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ClienteSelect, ParceiroSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ListToolbar } from "@/components/ListToolbar";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import {
  PERIODO_VAZIO,
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { useClientes, useLocacoes, useParceiros, useVeiculos, useVinculosParceiro } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatPlaca, formatClienteLabel, formatClienteNomeExibicao } from "@/lib/format";
import { clienteNomeDe } from "@/lib/clienteCampo";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import type { Locacao, Veiculo } from "@/api/types";

function normPlaca(placa?: string | null): string {
  return (placa ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function veiculoDaLocacaoFromMaps(
  locacao: Locacao,
  veiculoPorId: Map<string, Veiculo>,
  veiculoPorPlaca: Map<string, Veiculo>,
): Veiculo | undefined {
  if (locacao.veiculoId && veiculoPorId.has(locacao.veiculoId)) {
    return veiculoPorId.get(locacao.veiculoId);
  }
  if (locacao.placa) return veiculoPorPlaca.get(normPlaca(locacao.placa));
  return undefined;
}

export function MovimentacaoListSection() {
  const qc = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>(PERIODO_VAZIO);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const query = useLocacoes({
    veiculoId: veiculoId || undefined,
    situacao: situacao || undefined,
    clienteId: clienteId || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
  });
  const clientesQuery = useClientes();
  const veiculosQuery = useVeiculos();
  const parceirosQuery = useParceiros();
  const vinculosQuery = useVinculosParceiro();

  const nomesCliente = useMemo(
    () =>
      new Map(
        (clientesQuery.data?.items ?? [])
          .filter((c) => c.nome)
          .map((c) => [c.id, formatClienteLabel(c)]),
      ),
    [clientesQuery.data],
  );

  const veiculoPorId = useMemo(() => {
    const map = new Map<string, Veiculo>();
    for (const v of veiculosQuery.data?.items ?? []) {
      map.set(v.id, v);
    }
    return map;
  }, [veiculosQuery.data]);

  const veiculoPorPlaca = useMemo(() => {
    const map = new Map<string, Veiculo>();
    for (const v of veiculosQuery.data?.items ?? []) {
      if (v.placa) map.set(normPlaca(v.placa), v);
    }
    return map;
  }, [veiculosQuery.data]);

  const parceiroPorVeiculoId = useMemo(() => {
    const nomes = new Map((parceirosQuery.data?.items ?? []).map((p) => [p.id, p.nome]));
    const map = new Map<string, string>();
    for (const v of vinculosQuery.data?.items ?? []) {
      const nome = nomes.get(v.parceiroId);
      if (nome) map.set(v.veiculoId, nome);
    }
    return map;
  }, [parceirosQuery.data, vinculosQuery.data]);

  const parceiroIdPorVeiculoId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vinculosQuery.data?.items ?? []) {
      map.set(v.veiculoId, v.parceiroId);
    }
    return map;
  }, [vinculosQuery.data]);

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!parceiroId) return items;
    return items.filter((l) => {
      const veiculo = veiculoDaLocacaoFromMaps(l, veiculoPorId, veiculoPorPlaca);
      if (!veiculo) return false;
      return parceiroIdPorVeiculoId.get(veiculo.id) === parceiroId;
    });
  }, [query.data, parceiroId, veiculoPorId, veiculoPorPlaca, parceiroIdPorVeiculoId]);

  const temFiltro = Boolean(
    veiculoId || parceiroId || situacao || clienteId || periodoPreenchido(periodo),
  );

  function veiculoDaLocacao(locacao: Locacao): Veiculo | undefined {
    return veiculoDaLocacaoFromMaps(locacao, veiculoPorId, veiculoPorPlaca);
  }

  function parceiroDaLocacao(locacao: Locacao): string {
    const veiculo = veiculoDaLocacao(locacao);
    if (!veiculo) return "—";
    return parceiroPorVeiculoId.get(veiculo.id) ?? "—";
  }

  function clienteDaLocacao(locacao: Locacao): string {
    if (locacao.clienteId && nomesCliente.has(locacao.clienteId)) {
      return nomesCliente.get(locacao.clienteId)!;
    }
    const nome = clienteNomeDe(locacao);
    if (nome?.trim()) return formatClienteNomeExibicao(nome);
    return "—";
  }

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    if (!id) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
    if (v) setParceiroId(parceiroIdPorVeiculoId.get(v.id) ?? "");
  }

  function onParceiroChange(id: string) {
    setParceiroId(id);
    if (!id || !veiculoId) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === veiculoId);
    if (v && parceiroIdPorVeiculoId.get(v.id) !== id) setVeiculoId("");
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    if (!id || !veiculoId) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === veiculoId);
    if (v?.clienteVinculadoId && v.clienteVinculadoId !== id) setVeiculoId("");
  }

  async function excluir(locacao: Locacao) {
    const label = `${locacao.situacao ?? "movimentação"} · ${formatPlaca(locacao.placa)}`;
    if (!window.confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(locacao.id);
    try {
      await lanzaApi.removerLocacao(locacao.id);
      void qc.invalidateQueries({ queryKey: ["locacoes"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir movimentação.");
    } finally {
      setExcluindoId(null);
    }
  }

  const loadingExtra =
    clientesQuery.isLoading ||
    veiculosQuery.isLoading ||
    parceirosQuery.isLoading ||
    vinculosQuery.isLoading;

  return (
    <>
      <ListToolbar addTo="/movimentacao/novo" />

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={onVeiculoChange}
              valueField="id"
              clienteId={clienteId || undefined}
              parceiroId={parceiroId || undefined}
              variant="filtro"
            />
          </label>
          <label className="field">
            <span className="field__label">Parceiro</span>
            <ParceiroSelect value={parceiroId} onChange={onParceiroChange} variant="filtro" />
          </label>
          <label className="field">
            <span className="field__label">Cliente</span>
            <ClienteSelect value={clienteId} onChange={onClienteChange} variant="filtro" />
          </label>
          <label className="field">
            <span className="field__label">Tipo</span>
            <NativeSelect
              value={situacao}
              onChange={setSituacao}
              variant="filtro"
              aria-label="Tipo"
            >
              <option value="locado">Locado</option>
              <option value="reserva">Reserva</option>
              <option value="manutencao">Manutenção</option>
            </NativeSelect>
          </label>
          <RelatorioPeriodoFiltro value={periodo} onChange={setPeriodo} />
        </div>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} movimentaç{rows.length === 1 ? "ão" : "ões"}
          </p>
        ) : null}
      </section>

      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar movimentações."}
        />
      ) : null}
      <DataTable
        loading={query.isLoading || loadingExtra}
        rows={rows}
        keyFn={(l) => l.id}
        emptyMessage={temFiltro ? "Nenhuma movimentação corresponde aos filtros." : "Nenhuma movimentação registada."}
        columns={[
          { key: "placa", header: "Placa", sortValue: (l) => formatPlaca(l.placa), render: (l) => <strong>{formatPlaca(l.placa)}</strong> },
          {
            key: "marcaModelo",
            header: "Marca / modelo",
            sortValue: (l) => veiculoDaLocacao(l)?.marcaModelo ?? "",
            render: (l) => veiculoDaLocacao(l)?.marcaModelo ?? "—",
          },
          {
            key: "ano",
            header: "Ano",
            sortValue: (l) => veiculoDaLocacao(l)?.anoModelo ?? "",
            render: (l) => veiculoDaLocacao(l)?.anoModelo ?? "—",
          },
          { key: "parceiro", header: "Parceiro", sortValue: (l) => parceiroDaLocacao(l), render: (l) => parceiroDaLocacao(l) },
          { key: "situacao", header: "Situação", sortValue: (l) => l.situacao ?? l.tipo ?? "", render: (l) => l.situacao ?? l.tipo ?? "—" },
          { key: "inicio", header: "Início", sortValue: (l) => l.inicio ?? "", render: (l) => l.inicio ?? "—" },
          { key: "fim", header: "Fim", sortValue: (l) => l.fim ?? "Em aberto", render: (l) => l.fim ?? "Em aberto" },
          { key: "cliente", header: "Cliente", sortValue: (l) => clienteDaLocacao(l), render: (l) => clienteDaLocacao(l) },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (l) => (
              <RowActions
                editTo={`/movimentacao/${l.id}/editar`}
                deleting={excluindoId === l.id}
                onDelete={() => void excluir(l)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
