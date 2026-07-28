import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/DataTable";
import { ParceiroSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";
import { QueryError } from "@/components/PageHeader";
import { FlashError } from "@/context/ScreenFlashContext";
import { ResultPanel } from "@/components/ResultPanel";
import {
  PERIODO_VAZIO,
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import {
  CATEGORIAS_IPVA_LICENCIAMENTO,
  type CategoriaIpvaLicenciamento,
} from "@/lib/parceiroDespesaCategorias";
import {
  STATUS_DESPESA_FILTRO_OPCOES,
  StatusDespesaFiltro,
  filtroPagamentoParaEmAberto,
  type StatusDespesaFiltroValor,
} from "@/lib/domain";
import type { ParceiroDespesa } from "@/api/types";

function situacaoLabel(d: ParceiroDespesa): { text: string; className: string } {
  if (d.baixa?.trim()) {
    return { text: "Pago", className: "badge badge--ok" };
  }
  return { text: "Em aberto", className: "badge badge--warn" };
}

export function RelatorioIpvaLicenciamentoSection() {
  const queryClient = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaIpvaLicenciamento | "">("");
  const [pagamento, setPagamento] = useState<StatusDespesaFiltroValor>(StatusDespesaFiltro.EmAberto);
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>(PERIODO_VAZIO);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<unknown>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const placaFiltro = useMemo(() => {
    if (!veiculoId) return undefined;
    return veiculosQuery.data?.items.find((v) => v.id === veiculoId)?.placa;
  }, [veiculoId, veiculosQuery.data]);

  const baseParams = {
    emAberto: filtroPagamentoParaEmAberto(pagamento),
    parceiroId: parceiroId || undefined,
    veiculoId: veiculoId || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
    ativo: true,
  };

  const categoriasConsulta = categoria ? [categoria] : [...CATEGORIAS_IPVA_LICENCIAMENTO];

  const queries = useQueries({
    queries: categoriasConsulta.map((cat) => ({
      queryKey: ["despesas-parceiro", { ...baseParams, categoria: cat }],
      queryFn: () => lanzaApi.listarDespesasParceiro({ ...baseParams, categoria: cat }),
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const queryError = queries.find((q) => q.isError)?.error;

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const merged: ParceiroDespesa[] = [];
    for (const q of queries) {
      for (const d of q.data?.items ?? []) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }, [queries]);

  const total = useMemo(() => rows.reduce((sum, d) => sum + (Number(d.valor) || 0), 0), [rows]);

  const temFiltro =
    pagamento !== StatusDespesaFiltro.EmAberto ||
    Boolean(parceiroId || veiculoId || categoria || periodoPreenchido(periodo));

  async function sincronizarIpvaLicenciamento() {
    setSyncLoading(true);
    setSyncError(null);
    try {
      const r = await lanzaApi.executarSync("ipva-licenciamento", {
        syncRastreame: false,
        placa: placaFiltro?.trim() || undefined,
      });
      setSyncResult(r);
      await queryClient.invalidateQueries({ queryKey: ["despesas-parceiro"] });
    } catch (err) {
      setSyncError(err instanceof LanzaApiError ? err.message : "Falha ao sincronizar IPVA/Licenciamento.");
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <>
      {!loading ? (
        <p className="relatorio-infracoes__resumo">
          <span className="badge badge--muted">
            {rows.length} registo{rows.length === 1 ? "" : "s"} · {formatBrl(total)}
          </span>
        </p>
      ) : null}

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <FieldLike label="Veículo">
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              ativo
              tipoFrota={TipoVeiculoFrota.Locacao}
              parceiroId={parceiroId || undefined}
              variant="filtro"
            />
          </FieldLike>
          <FieldLike label="Parceiro">
            <ParceiroSelect value={parceiroId} onChange={setParceiroId} ativo variant="filtro" />
          </FieldLike>
          <FieldLike label="Categoria">
            <NativeSelect
              value={categoria}
              onChange={(v) => setCategoria(v as CategoriaIpvaLicenciamento | "")}
              variant="filtro"
              aria-label="Categoria"
            >
              <option value="">{SELECT_LABEL_TODOS}</option>
              {CATEGORIAS_IPVA_LICENCIAMENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </FieldLike>
          <FieldLike label="Pagamento">
            <NativeSelect
              value={pagamento}
              onChange={(v) => setPagamento(v as StatusDespesaFiltroValor)}
              variant="filtro"
              allowEmpty={false}
              aria-label="Pagamento"
            >
              {STATUS_DESPESA_FILTRO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value === StatusDespesaFiltro.Todos ? SELECT_LABEL_TODOS : opt.label}
                </option>
              ))}
            </NativeSelect>
          </FieldLike>
          <RelatorioPeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            hint="Filtra pela data de vencimento"
          />
        </div>
      </section>

      <section className="form-card">
        <p className="field__hint">
          Débitos sincronizados do DETRAN (SC/RS) — responsabilidade do parceiro/dono do veículo. Use{" "}
          <Link to="/sync/ipva-licenciamento">Syncs › IPVA/Licenciamento</Link> para atualizar a frota.
        </p>
      </section>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={syncLoading}
          onClick={() => void sincronizarIpvaLicenciamento()}
        >
          Sincronizar IPVA/Licenciamento
        </button>
      </div>

      <FlashError message={syncError} />
      <ResultPanel title="Sincronização IPVA/Licenciamento" data={syncResult} />

      {queryError ? (
        <QueryError
          message={
            queryError instanceof LanzaApiError
              ? queryError.message
              : "Falha ao listar débitos de IPVA/Licenciamento."
          }
        />
      ) : null}

      <DataTable
        loading={loading}
        rows={rows}
        keyFn={(d) => d.id}
        emptyMessage={
          temFiltro
            ? "Nenhum débito corresponde aos filtros."
            : "Nenhum débito de IPVA ou Licenciamento encontrado."
        }
        columns={[
          {
            key: "veiculo",
            header: "Veículo",
            sortValue: (d) => d.veiculoLabel?.trim() ?? d.placa ?? "",
            render: (d) => d.veiculoLabel?.trim() || d.placa || "—",
          },
          {
            key: "categoria",
            header: "Categoria",
            sortValue: (d) => d.categoria ?? "",
            render: (d) => d.categoria ?? "—",
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (d) => d.descricao ?? "",
            render: (d) => (
              <span className="infracao-desc" title={d.descricao}>
                {d.descricao ?? "—"}
              </span>
            ),
          },
          {
            key: "vencimento",
            header: "Vencimento",
            sortValue: (d) => d.vencimentoBr?.trim() || d.data?.trim() || "",
            render: (d) => d.vencimentoBr?.trim() || d.data?.trim() || "—",
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (d) => Number(d.valor) || 0,
            render: (d) => formatBrl(Number(d.valor) || 0),
          },
          {
            key: "situacao",
            header: "Situação",
            sortValue: (d) => situacaoLabel(d).text,
            render: (d) => {
              const s = situacaoLabel(d);
              return <span className={s.className}>{s.text}</span>;
            },
          },
          {
            key: "baixa",
            header: "Baixa",
            sortValue: (d) => d.baixa?.trim() ?? "",
            render: (d) => d.baixa?.trim() || "—",
          },
        ]}
      />
    </>
  );
}

function FieldLike({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
