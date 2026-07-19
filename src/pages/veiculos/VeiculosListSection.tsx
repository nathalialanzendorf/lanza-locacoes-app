import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ParceiroSelect, VeiculoSelect } from "@/components/EntitySelects";
import { ListToolbar } from "@/components/ListToolbar";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import { useParceiros, useVeiculos, useVinculosParceiro, useContratos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatPlaca, statusClass, statusLabel } from "@/lib/format";
import { ordenarAtivoDepoisAlfabetico, registroAtivo } from "@/lib/listagemCadastro";
import {
  placasComContratoAtivo,
  situacaoLocacaoVeiculo,
  situacaoVeiculoClass,
  situacaoVeiculoLabel,
} from "@/lib/statusVeiculo";
import type { Veiculo } from "@/api/types";

export function VeiculosListSection() {
  const qc = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [togglingAtivoId, setTogglingAtivoId] = useState<string | null>(null);
  const query = useVeiculos();
  const contratosQuery = useContratos({ status: "ativo" });
  const parceirosQuery = useParceiros();
  const vinculosQuery = useVinculosParceiro();

  const { parceiroPorVeiculoId, parceiroIdPorVeiculoId } = useMemo(() => {
    const nomes = new Map((parceirosQuery.data?.items ?? []).map((p) => [p.id, p.nome]));
    const parceiroPorVeiculoId = new Map<string, string>();
    const parceiroIdPorVeiculoId = new Map<string, string>();
    for (const v of vinculosQuery.data?.items ?? []) {
      parceiroIdPorVeiculoId.set(v.veiculoId, v.parceiroId);
      const nome = nomes.get(v.parceiroId);
      if (nome) parceiroPorVeiculoId.set(v.veiculoId, nome);
    }
    return { parceiroPorVeiculoId, parceiroIdPorVeiculoId };
  }, [parceirosQuery.data, vinculosQuery.data]);

  const placasContratoAtivo = useMemo(
    () => placasComContratoAtivo(contratosQuery.data?.items ?? []),
    [contratosQuery.data],
  );

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const filtrados = items.filter((v) => {
      if (veiculoId && v.id !== veiculoId) return false;
      if (parceiroId && parceiroIdPorVeiculoId.get(v.id) !== parceiroId) return false;
      return true;
    });
    return ordenarAtivoDepoisAlfabetico(filtrados, {
      ativoDe: (v) => registroAtivo(v.ativo),
      rotuloDe: (v) => formatPlaca(v.placa ?? v.id),
    });
  }, [query.data, veiculoId, parceiroId, parceiroIdPorVeiculoId]);

  const temFiltro = Boolean(veiculoId || parceiroId);

  function parceiroDoVeiculo(veiculo: Veiculo): string {
    return parceiroPorVeiculoId.get(veiculo.id) ?? "—";
  }

  async function inativar(veiculo: Veiculo) {
    const label = formatPlaca(veiculo.placa ?? veiculo.id);
    if (!window.confirm(`Inativar o veículo ${label}?`)) return;
    setTogglingAtivoId(veiculo.id);
    try {
      await lanzaApi.atualizarVeiculo(veiculo.id, { ativo: false });
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      void qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao inativar veículo.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function habilitar(veiculo: Veiculo) {
    const label = formatPlaca(veiculo.placa ?? veiculo.id);
    if (!window.confirm(`Reativar o veículo ${label}?`)) return;
    setTogglingAtivoId(veiculo.id);
    try {
      await lanzaApi.atualizarVeiculo(veiculo.id, { ativo: true });
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      void qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao reativar veículo.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function excluir(veiculo: Veiculo) {
    const label = formatPlaca(veiculo.placa ?? veiculo.id);
    if (!window.confirm(`Excluir o veículo ${label}? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(veiculo.id);
    try {
      await lanzaApi.removerVeiculo(veiculo.id);
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      void qc.invalidateQueries({ queryKey: ["parceiros-vinculos"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir veículo.");
    } finally {
      setExcluindoId(null);
    }
  }

  const loadingExtra = parceirosQuery.isLoading || vinculosQuery.isLoading;

  return (
    <>
      <ListToolbar addTo="/veiculos/novo" importTo="/veiculos/importar" />

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              variant="filtro"
            />
          </label>
          <label className="field">
            <span className="field__label">Parceiro</span>
            <ParceiroSelect value={parceiroId} onChange={setParceiroId} variant="filtro" />
          </label>
        </div>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} veículo{rows.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </section>

      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar veículos."}
        />
      ) : null}
      <DataTable
        loading={query.isLoading || loadingExtra}
        rows={rows}
        keyFn={(v) => v.id}
        rowClassName={(v) =>
          registroAtivo(v.ativo) ? undefined : "row--inativo row--inativo-amber"
        }
        emptyMessage={
          temFiltro ? "Nenhum veículo corresponde aos filtros." : "Nenhum veículo registado."
        }
        columns={[
          { key: "placa", header: "Placa", sortValue: (v) => formatPlaca(v.placa), render: (v) => <strong>{formatPlaca(v.placa)}</strong> },
          { key: "marcaModelo", header: "Marca / modelo", sortValue: (v) => v.marcaModelo ?? "", render: (v) => v.marcaModelo ?? "—" },
          { key: "ano", header: "Ano", sortValue: (v) => v.anoModelo ?? "", render: (v) => v.anoModelo ?? "—" },
          { key: "parceiro", header: "Parceiro", sortValue: (v) => parceiroDoVeiculo(v), render: (v) => parceiroDoVeiculo(v) },
          {
            key: "status",
            header: "Status",
            sortValue: (v) => statusLabel(v.ativo),
            render: (v) => (
              <span className={statusClass(v.ativo)}>{statusLabel(v.ativo)}</span>
            ),
          },
          {
            key: "situacao",
            header: "Situação",
            sortValue: (v) => situacaoVeiculoLabel(situacaoLocacaoVeiculo(v, placasContratoAtivo)),
            render: (v) => {
              const situacao = situacaoLocacaoVeiculo(v, placasContratoAtivo);
              return (
                <span className={situacaoVeiculoClass(situacao)}>
                  {situacaoVeiculoLabel(situacao)}
                </span>
              );
            },
          },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (v) => (
              <RowActions
                editTo={`/veiculos/${v.id}/editar`}
                toggleAtivoMode="inativar"
                ativo={registroAtivo(v.ativo)}
                onAtivoChange={(next) => void (next ? habilitar(v) : inativar(v))}
                togglingAtivo={togglingAtivoId === v.id}
                deleting={excluindoId === v.id}
                onDelete={() => void excluir(v)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
