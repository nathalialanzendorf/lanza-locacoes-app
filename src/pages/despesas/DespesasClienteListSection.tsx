import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ClienteSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";
import {
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { ListToolbar } from "@/components/ListToolbar";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import { useClientes, useDespesasCliente, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { hojeDataBr } from "@/lib/contratoVencimento";
import { clienteExibicaoPorId, formatBrl, formatVeiculoLabel } from "@/lib/format";
import {
  badgeStatusDespesaCliente,
  despesaCobravelCliente,
  despesaElegivelBaixaCliente,
  rotuloStatusDespesaCliente,
} from "@/lib/despesaClienteStatus";
import { urlLancarRecebimentoDespesa } from "@/lib/recebimentoUrl";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import { rotuloCategoriaDespesa } from "@/lib/pedagioLabels";
import {
  ordenarDespesasPorVencimentoDesc,
  vencimentoDespesaSortMs,
} from "@/lib/despesaVencimentoSort";
import { useSessionJsonState } from "@/lib/useSessionJsonState";
import {
  CATEGORIAS_DESPESA_CLIENTE_CADASTRO,
  STATUS_DESPESA_FILTRO_OPCOES,
  StatusDespesaFiltro,
  filtroStatusCobranca,
  type StatusDespesaFiltroValor,
} from "@/lib/domain";
import type { ClienteDespesa, Veiculo } from "@/api/types";

type FiltrosDespesasCliente = {
  pagamento: StatusDespesaFiltroValor;
  clienteId: string;
  veiculoId: string;
  categoria: string;
  periodo: RelatorioPeriodo;
};

/** Padrão: sem data inicial, data final = hoje (só despesas com vencimento até hoje). */
function filtrosPadraoDespesasCliente(): FiltrosDespesasCliente {
  return {
    pagamento: StatusDespesaFiltro.EmAberto,
    clienteId: "",
    veiculoId: "",
    categoria: "",
    periodo: { dataInicial: "", dataFinal: hojeDataBr() },
  };
}

function compactPlaca(placa: string | null | undefined): string {
  return (placa ?? "").replace(/-/g, "").trim().toUpperCase();
}

function veiculoDespesa(d: ClienteDespesa, veiculos: Veiculo[] | undefined): string {
  const placaKey = compactPlaca(d.placa ?? d.veiculoId);
  const v = veiculos?.find(
    (x) => x.id === d.veiculoId || compactPlaca(x.placa) === placaKey,
  );
  if (v) return formatVeiculoLabel(v);
  return formatVeiculoLabel({ placa: d.placa ?? d.veiculoId });
}

export function DespesasClienteListSection() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useSessionJsonState(
    "despesas-cliente-filtros",
    filtrosPadraoDespesasCliente,
  );
  const { pagamento, clienteId, veiculoId, categoria, periodo } = filtros;
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const query = useDespesasCliente({
    statusCobranca: filtroStatusCobranca(pagamento),
    clienteId: clienteId || undefined,
    veiculoId: veiculoId || undefined,
    categoria: categoria || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
  });
  const clientesQuery = useClientes();
  const clientes = clientesQuery.data?.items;
  const veiculosQuery = useVeiculos();
  const veiculos = veiculosQuery.data?.items;

  const rows = useMemo(
    () => ordenarDespesasPorVencimentoDesc(query.data?.items ?? []),
    [query.data],
  );
  const temFiltro = Boolean(
    pagamento !== StatusDespesaFiltro.EmAberto ||
      clienteId ||
      veiculoId ||
      categoria ||
      periodoPreenchido(periodo),
  );

  const total = useMemo(
    () => rows.reduce((sum, d) => sum + (Number(d.valorMulta) || 0), 0),
    [rows],
  );

  async function excluir(despesa: ClienteDespesa) {
    const label = despesa.descricao ?? despesa.categoria ?? despesa.id;
    if (!window.confirm(`Excluir a despesa "${label}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(despesa.id);
    try {
      await lanzaApi.removerDespesaCliente(despesa.id);
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir despesa.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <>
      <ListToolbar addTo="/despesas/cliente/novo" />

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={(id) => setFiltros((f) => ({ ...f, veiculoId: id }))}
              valueField="id"
              clienteId={clienteId || undefined}
              variant="filtro"
            />
          </label>
          <label className="field">
            <span className="field__label">Cliente</span>
            <ClienteSelect
              value={clienteId}
              onChange={(id) => setFiltros((f) => ({ ...f, clienteId: id }))}
              variant="filtro"
            />
          </label>
          <label className="field">
            <span className="field__label">Categoria</span>
            <NativeSelect
              value={categoria}
              onChange={(v) => setFiltros((f) => ({ ...f, categoria: v }))}
              variant="filtro"
              aria-label="Categoria"
            >
              {CATEGORIAS_DESPESA_CLIENTE_CADASTRO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <NativeSelect
              value={pagamento}
              onChange={(v) =>
                setFiltros((f) => ({ ...f, pagamento: v as StatusDespesaFiltroValor }))
              }
              variant="filtro"
              allowEmpty={false}
              aria-label="Status"
            >
              {STATUS_DESPESA_FILTRO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === StatusDespesaFiltro.Todos ? SELECT_LABEL_TODOS : opt.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <RelatorioPeriodoFiltro
            value={periodo}
            onChange={(p) => setFiltros((f) => ({ ...f, periodo: p }))}
            hint="Por vencimento — padrão: até hoje"
          />
        </div>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} lançamento{rows.length === 1 ? "" : "s"} · {formatBrl(total)}
          </p>
        ) : null}
      </section>

      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar débitos do cliente."}
        />
      ) : null}

      <DataTable
        loading={query.isLoading}
        rows={rows}
        keyFn={(d) => d.id}
        defaultSort={{ key: "vencimento", direction: "desc" }}
        rowClassName={(d) => (despesaCobravelCliente(d) ? "row--em-aberto" : undefined)}
        emptyMessage={temFiltro ? "Nenhuma despesa corresponde aos filtros." : "Nenhuma despesa registada."}
        columns={[
          {
            key: "veiculo",
            header: "Veículo",
            sortValue: (d) => d.veiculoLabel?.trim() || veiculoDespesa(d, veiculos),
            render: (d) => d.veiculoLabel?.trim() || veiculoDespesa(d, veiculos),
          },
          {
            key: "cliente",
            header: "Cliente",
            sortValue: (d) =>
              clienteExibicaoPorId(clientes, d.clienteId ?? d.condutorId, d.clienteNome),
            render: (d) =>
              clienteExibicaoPorId(
                clientes,
                d.clienteId ?? d.condutorId,
                d.clienteNome,
              ),
          },
          { key: "desc", header: "Descrição", sortValue: (d) => d.descricao?.trim() || "", render: (d) => d.descricao?.trim() || "—" },
          { key: "categoria", header: "Categoria", sortValue: (d) => rotuloCategoriaDespesa(d.categoria), render: (d) => rotuloCategoriaDespesa(d.categoria) },
          { key: "vencimento", header: "Vencimento", sortValue: (d) => vencimentoDespesaSortMs(d.vencimentoBr), render: (d) => d.vencimentoBr?.trim() || "—" },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (d) => Number(d.valorMulta) || 0,
            render: (d) => formatBrl(Number(d.valorMulta) || 0),
          },
          {
            key: "status",
            header: "Status",
            sortValue: (d) => rotuloStatusDespesaCliente(d),
            render: (d) => {
              const tone = badgeStatusDespesaCliente(d);
              return (
                <span className={`badge badge--${tone}`}>{rotuloStatusDespesaCliente(d)}</span>
              );
            },
          },
          {
            key: "pagoEm",
            header: "Pago em",
            sortValue: (d) => (d.paga === true ? d.pagaEmBr?.trim() || "" : ""),
            render: (d) => (d.paga === true ? d.pagaEmBr?.trim() || "—" : "—"),
          },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (d) => (
              <RowActions
                recebimentoTo={
                  despesaElegivelBaixaCliente(d) ? urlLancarRecebimentoDespesa(d) : null
                }
                editTo={`/despesas/cliente/${d.id}/editar`}
                deleting={excluindoId === d.id}
                onDelete={() => void excluir(d)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
