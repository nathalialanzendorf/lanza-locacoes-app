import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ClienteSelect, VeiculoSelect } from "@/components/EntitySelects";
import { ListToolbar } from "@/components/ListToolbar";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import { useClientes, useVeiculos, useVendas } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl, formatPlaca } from "@/lib/format";
import { ordenarAtivoDepoisAlfabetico, registroAtivo } from "@/lib/listagemCadastro";
import { TipoVeiculoFrota } from "@/lib/domain";
import { classeStatusVeiculoVenda, rotuloStatusVeiculoVenda } from "@/lib/statusVeiculoVenda";
import type { Venda } from "@/api/types";

export function VendasListSection() {
  const qc = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [togglingAtivoId, setTogglingAtivoId] = useState<string | null>(null);

  const query = useVendas({
    veiculoId: veiculoId || undefined,
    clienteId: clienteId || undefined,
  });
  const clientesQuery = useClientes();
  const veiculosQuery = useVeiculos({ tipoFrota: TipoVeiculoFrota.Venda });

  const nomesCliente = useMemo(
    () => new Map((clientesQuery.data?.items ?? []).map((c) => [c.id, c.nome ?? c.id])),
    [clientesQuery.data],
  );

  const veiculoPorId = useMemo(
    () => new Map((veiculosQuery.data?.items ?? []).map((v) => [v.id, v])),
    [veiculosQuery.data],
  );

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return ordenarAtivoDepoisAlfabetico(items, {
      ativoDe: (v) => registroAtivo(v.ativo),
      rotuloDe: (v) => v.dataVenda ?? v.id,
    }).sort((a, b) => String(b.dataVenda ?? "").localeCompare(String(a.dataVenda ?? "")));
  }, [query.data]);

  function compradorLabel(v: Venda): string {
    if (v.clienteId) return nomesCliente.get(v.clienteId) ?? v.compradorNome ?? "—";
    return v.compradorNome?.trim() || "—";
  }

  function veiculoLabel(v: Venda): string {
    const veiculo = v.veiculoId ? veiculoPorId.get(v.veiculoId) : undefined;
    const placa = formatPlaca(v.placa ?? veiculo?.placa);
    const modelo = veiculo?.marcaModelo?.trim();
    return modelo ? `${placa} — ${modelo}` : placa;
  }

  async function inativar(venda: Venda) {
    if (!window.confirm(`Cancelar a venda de ${formatPlaca(venda.placa)}?`)) return;
    setTogglingAtivoId(venda.id);
    try {
      await lanzaApi.atualizarVenda(venda.id, { ativo: false });
      void qc.invalidateQueries({ queryKey: ["vendas"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao cancelar venda.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function reativar(venda: Venda) {
    setTogglingAtivoId(venda.id);
    try {
      await lanzaApi.atualizarVenda(venda.id, { ativo: true });
      void qc.invalidateQueries({ queryKey: ["vendas"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao reativar venda.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function excluir(venda: Venda) {
    if (!window.confirm(`Excluir a venda de ${formatPlaca(venda.placa)}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setExcluindoId(venda.id);
    try {
      await lanzaApi.removerVenda(venda.id);
      void qc.invalidateQueries({ queryKey: ["vendas"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir venda.");
    } finally {
      setExcluindoId(null);
    }
  }

  const temFiltro = Boolean(veiculoId || clienteId);

  return (
    <>
      <ListToolbar addTo="/venda/novo" />

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
              tipoFrota={TipoVeiculoFrota.Venda}
            />
          </label>
          <label className="field">
            <span className="field__label">Comprador</span>
            <ClienteSelect value={clienteId} onChange={setClienteId} variant="filtro" />
          </label>
        </div>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} venda{rows.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </section>

      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar vendas."}
        />
      ) : null}

      <DataTable
        loading={query.isLoading}
        rows={rows}
        keyFn={(v) => v.id}
        rowClassName={(v) => (registroAtivo(v.ativo) ? undefined : "row--inativo row--inativo-amber")}
        emptyMessage={temFiltro ? "Nenhuma venda corresponde aos filtros." : "Nenhuma venda registada."}
        columns={[
          {
            key: "data",
            header: "Data",
            sortValue: (v) => v.dataVenda ?? "",
            render: (v) => v.dataVenda ?? "—",
          },
          {
            key: "veiculo",
            header: "Veículo",
            sortValue: (v) => veiculoLabel(v),
            render: (v) => <strong>{veiculoLabel(v)}</strong>,
          },
          {
            key: "comprador",
            header: "Cliente",
            sortValue: (v) => compradorLabel(v),
            render: (v) => compradorLabel(v),
          },
          {
            key: "valor",
            header: "Total",
            sortValue: (v) => v.valorVenda ?? 0,
            render: (v) => (v.valorVenda != null ? formatBrl(v.valorVenda) : "—"),
          },
          {
            key: "entrada",
            header: "Entrada",
            sortValue: (v) => v.valorEntrada ?? 0,
            render: (v) => (v.valorEntrada != null ? formatBrl(v.valorEntrada) : "—"),
          },
          {
            key: "parcelas",
            header: "Parcelas",
            sortValue: (v) => v.quantidadeParcelas ?? 0,
            render: (v) => {
              if (v.quantidadeParcelas == null && v.valorParcela == null) return "—";
              const qtd = v.quantidadeParcelas != null ? `${v.quantidadeParcelas}x` : "—";
              const val = v.valorParcela != null ? formatBrl(v.valorParcela) : "—";
              return `${qtd} ${val}`;
            },
          },
          {
            key: "vencimento",
            header: "1ª parcela",
            sortValue: (v) => v.dataPagamentoParcelas ?? "",
            render: (v) => v.dataPagamentoParcelas ?? "—",
          },
          {
            key: "statusVeiculo",
            header: "Status veículo",
            sortValue: (v) => {
              const veiculo = v.veiculoId ? veiculoPorId.get(v.veiculoId) : undefined;
              return rotuloStatusVeiculoVenda(veiculo?.ativo);
            },
            render: (v) => {
              const veiculo = v.veiculoId ? veiculoPorId.get(v.veiculoId) : undefined;
              return (
                <span className={classeStatusVeiculoVenda(veiculo?.ativo)}>
                  {rotuloStatusVeiculoVenda(veiculo?.ativo)}
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
                editTo={`/venda/${v.id}/editar`}
                toggleAtivoMode="inativar"
                ativo={registroAtivo(v.ativo)}
                onAtivoChange={(next) => void (next ? reativar(v) : inativar(v))}
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
