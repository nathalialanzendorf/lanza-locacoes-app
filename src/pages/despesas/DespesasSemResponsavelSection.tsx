import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ResponsavelDebitoCell } from "@/components/relatorios/ResponsavelDebitoCell";
import {
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { QueryError } from "@/components/PageHeader";
import { useDespesasCliente, useVeiculos } from "@/api/hooks";
import { LanzaApiError } from "@/api/client";
import { hojeDataBr } from "@/lib/contratoVencimento";
import { formatBrl, formatVeiculoLabel } from "@/lib/format";
import { rotuloCategoriaDespesa } from "@/lib/pedagioLabels";
import {
  ordenarDespesasPorVencimentoDesc,
  vencimentoDespesaSortMs,
} from "@/lib/despesaVencimentoSort";
import { precisaConfirmacao } from "@/lib/responsavelDebitoUi";
import {
  CATEGORIAS_DESPESA_CLIENTE_CADASTRO,
  STATUS_DESPESA_FILTRO_PARCEIRO_OPCOES,
  StatusDespesaFiltro,
  filtroStatusCobranca,
  type StatusDespesaFiltroValor,
} from "@/lib/domain";
import type { ClienteDespesa, Veiculo } from "@/api/types";

/** Padrão: data final = hoje (pendências com vencimento até hoje). */
function periodoPadrao(): RelatorioPeriodo {
  return { dataInicial: "", dataFinal: hojeDataBr() };
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

export function DespesasSemResponsavelSection() {
  const qc = useQueryClient();
  const [pagamento, setPagamento] = useState<StatusDespesaFiltroValor>(StatusDespesaFiltro.EmAberto);
  const [veiculoId, setVeiculoId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>(periodoPadrao);

  const query = useDespesasCliente({
    statusCobranca: filtroStatusCobranca(pagamento),
    veiculoId: veiculoId || undefined,
    categoria: categoria || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
    semCliente: true,
  });
  const veiculosQuery = useVeiculos();
  const veiculos = veiculosQuery.data?.items;

  const rows = useMemo(() => {
    const items = (query.data?.items ?? []).filter(precisaConfirmacao);
    return ordenarDespesasPorVencimentoDesc(items);
  }, [query.data]);

  const total = useMemo(
    () => rows.reduce((sum, d) => sum + (Number(d.valorMulta) || 0), 0),
    [rows],
  );

  function onConfirmed() {
    void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <p className="field__hint">
          Débitos sem cliente nem parceiro confirmados. Confirme o responsável na linha — ou escolha
          outro cliente/parceiro.
        </p>
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
            <span className="field__label">Categoria</span>
            <NativeSelect
              value={categoria}
              onChange={setCategoria}
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
              onChange={(v) => setPagamento(v as StatusDespesaFiltroValor)}
              variant="filtro"
              allowEmpty={false}
              aria-label="Status"
            >
              {STATUS_DESPESA_FILTRO_PARCEIRO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <RelatorioPeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            hint="Por vencimento — padrão: até hoje"
          />
        </div>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} pendência{rows.length === 1 ? "" : "s"} · {formatBrl(total)}
          </p>
        ) : null}
      </section>

      {query.isError ? (
        <QueryError
          message={
            query.error instanceof LanzaApiError
              ? query.error.message
              : "Falha ao listar despesas sem responsável."
          }
        />
      ) : null}

      <DataTable
        loading={query.isLoading}
        rows={rows}
        keyFn={(d) => d.id}
        defaultSort={{ key: "vencimento", direction: "desc" }}
        rowClassName={() => "row--em-aberto"}
        emptyMessage="Nenhuma despesa pendente de confirmação de responsável."
        columns={[
          {
            key: "veiculo",
            header: "Veículo",
            sortValue: (d) => d.veiculoLabel?.trim() || veiculoDespesa(d, veiculos),
            render: (d) => d.veiculoLabel?.trim() || veiculoDespesa(d, veiculos),
          },
          {
            key: "categoria",
            header: "Categoria",
            sortValue: (d) => rotuloCategoriaDespesa(d.categoria),
            render: (d) => rotuloCategoriaDespesa(d.categoria),
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (d) => d.descricao?.trim() || "",
            render: (d) => d.descricao?.trim() || "—",
          },
          {
            key: "vencimento",
            header: "Vencimento",
            sortValue: (d) => vencimentoDespesaSortMs(d.vencimentoBr),
            render: (d) => d.vencimentoBr?.trim() || "—",
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (d) => Number(d.valorMulta) || 0,
            render: (d) => formatBrl(Number(d.valorMulta) || 0),
          },
          {
            key: "responsavel",
            header: "Responsável",
            render: (d) => (
              <ResponsavelDebitoCell
                tipo="pedagio"
                despesaId={d.id}
                autoInfracao={d.autoInfracao ?? d.id}
                item={d}
                onConfirmed={onConfirmed}
              />
            ),
          },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (d) => (
              <Link to={`/despesas/cliente/${d.id}/editar`} className="btn btn--ghost">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
