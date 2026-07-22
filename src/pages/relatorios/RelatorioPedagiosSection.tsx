import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { ClienteSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";
import { ResponsavelDebitoCell } from "@/components/relatorios/ResponsavelDebitoCell";
import { QueryError } from "@/components/PageHeader";
import { FlashError } from "@/context/ScreenFlashContext";
import { ResultPanel } from "@/components/ResultPanel";
import {
  PERIODO_VAZIO,
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { useDespesasCliente, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl, formatPlaca } from "@/lib/format";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import { CATEGORIA_PEDAGIO, rotuloPedagioDigital } from "@/lib/pedagioLabels";
import type { ClienteDespesa } from "@/api/types";

type FiltroSituacao = "em_aberto" | "quitado" | "todos";

function valorPedagio(d: ClienteDespesa): number {
  return Number(d.valorMulta) || 0;
}

function situacaoLabel(d: ClienteDespesa): { text: string; className: string } {
  if (d.paga) {
    return { text: "Pago", className: "badge badge--ok" };
  }
  const raw = d.situacao ?? "";
  if (/pago|quitad/i.test(raw)) {
    return { text: raw, className: "badge badge--ok" };
  }
  if (/aberto|atrasad/i.test(raw) || /ATRASADO/i.test(d.descricao ?? "")) {
    return { text: raw || "Em aberto", className: "badge badge--warn" };
  }
  return { text: raw || "—", className: "badge badge--muted" };
}

export function RelatorioPedagiosSection() {
  const queryClient = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>(PERIODO_VAZIO);
  const [situacao, setSituacao] = useState<FiltroSituacao>("em_aberto");
  const [semResponsavel, setSemResponsavel] = useState(false);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [atribuirResult, setAtribuirResult] = useState<unknown>(null);
  const [portalResult, setPortalResult] = useState<unknown>(null);
  const [syncResult, setSyncResult] = useState<unknown>(null);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const emAberto = situacao === "em_aberto" ? true : situacao === "quitado" ? false : undefined;

  const query = useDespesasCliente({
    categoria: CATEGORIA_PEDAGIO,
    veiculoId: veiculoId || undefined,
    clienteId: clienteId || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
    emAberto,
    semCliente: semResponsavel || undefined,
    ativo: true,
  });
  const veiculosQuery = useVeiculos({ ativo: true });

  const placaFiltro = useMemo(() => {
    if (!veiculoId) return undefined;
    return veiculosQuery.data?.items.find((v) => v.id === veiculoId)?.placa;
  }, [veiculoId, veiculosQuery.data]);

  const rows = query.data?.items ?? [];
  const temFiltro = Boolean(
    veiculoId ||
      clienteId ||
      situacao !== "em_aberto" ||
      semResponsavel ||
      periodoPreenchido(periodo),
  );

  const total = useMemo(() => rows.reduce((sum, d) => sum + valorPedagio(d), 0), [rows]);

  const loading = query.isLoading;

  async function atribuirResponsaveis(dryRun: boolean) {
    setAcaoLoading(dryRun ? "preview" : "atribuir");
    setAcaoError(null);
    try {
      const r = await lanzaApi.atribuirClientesDespesas({
        dryRun,
        veiculoId: veiculoId || undefined,
        escopo: "pedagio",
      });
      setAtribuirResult(r);
      if (!dryRun) {
        await queryClient.invalidateQueries({ queryKey: ["despesas-cliente"] });
      }
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao atribuir responsáveis.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function sincronizarPedagios() {
    setAcaoLoading("sync");
    setAcaoError(null);
    try {
      const r = await lanzaApi.executarSync("pedagios", { syncRastreame: false });
      setSyncResult(r);
      await queryClient.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao sincronizar pedágios.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function consultarPortal() {
    if (!placaFiltro?.trim()) {
      setAcaoError("Selecione um veículo para consultar passagens no portal.");
      return;
    }
    setAcaoLoading("portal");
    setAcaoError(null);
    try {
      const r = await lanzaApi.pedagioPassagens(placaFiltro, "aberto");
      setPortalResult(r);
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portal.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function conferirPlacas(registrar: boolean) {
    setAcaoLoading(registrar ? "registrar" : "conferir");
    setAcaoError(null);
    try {
      const r = await lanzaApi.pedagioConferir(registrar);
      setPortalResult(r);
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao conferir placas.");
    } finally {
      setAcaoLoading(null);
    }
  }

  return (
    <>
      {!loading ? (
        <p className="relatorio-infracoes__resumo">
          <span className="badge badge--muted">
            {query.data?.total ?? 0} passagem{(query.data?.total ?? 0) === 1 ? "" : "ns"} ·{" "}
            {formatBrl(total)}
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
              variant="filtro"
            />
          </FieldLike>
          <FieldLike label="Cliente">
            <ClienteSelect value={clienteId} onChange={setClienteId} ativo variant="filtro" />
          </FieldLike>
          <RelatorioPeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            hint="Filtra pela data da passagem"
          />
          <FieldLike label="Situação">
            <NativeSelect
              value={situacao}
              onChange={(v) => setSituacao(v as FiltroSituacao)}
              variant="filtro"
              allowEmpty={false}
              aria-label="Situação"
            >
              <option value="em_aberto">Em aberto</option>
              <option value="quitado">Pagas</option>
              <option value="todos">{SELECT_LABEL_TODOS}</option>
            </NativeSelect>
          </FieldLike>
          <FieldLike label="Responsável">
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={semResponsavel}
                onChange={(e) => setSemResponsavel(e.target.checked)}
              />
              Só sem confirmação
            </label>
          </FieldLike>
        </div>
      </section>

      <section className="form-card">
        <p className="field__hint">
          Mesmas regras das multas (contrato, manutenção, reserva). «Inferir» grava sugestão de cliente
          ou parceiro; confirme na linha ou escolha outro responsável. Só após confirmar parceiro o
          débito espelha em Despesas → Parceiro.
        </p>
      </section>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void sincronizarPedagios()}
        >
          {acaoLoading === "sync" ? "Sincronizando…" : "Sync portal → despesas"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void conferirPlacas(false)}
        >
          {acaoLoading === "conferir" ? "Conferindo…" : "Conferir veículos no portal"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading) || !placaFiltro}
          onClick={() => void consultarPortal()}
        >
          {acaoLoading === "portal" ? "Consultando…" : "Passagens abertas (portal)"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void atribuirResponsaveis(true)}
        >
          {acaoLoading === "preview" ? "Calculando…" : "Preview inferir"}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={Boolean(acaoLoading)}
          onClick={() => void atribuirResponsaveis(false)}
        >
          {acaoLoading === "atribuir" ? "Inferindo…" : "Inferir responsáveis"}
        </button>
      </div>

      <FlashError message={acaoError} />
      <AtribuicaoResumo data={atribuirResult} />
      <ResultPanel title="Detalhe inferência" data={atribuirResult} />
      <ResultPanel title="Sync pedágios" data={syncResult} />
      <ResultPanel title="Portal pedágio digital" data={portalResult} />

      {query.isError ? (
        <QueryError
          message={
            query.error instanceof LanzaApiError
              ? query.error.message
              : "Falha ao listar pedágios."
          }
        />
      ) : null}

      <DataTable
        loading={loading}
        rows={rows}
        keyFn={(d) => d.id}
        emptyMessage={
          temFiltro
            ? "Nenhum pedágio corresponde aos filtros."
            : "Nenhum pedágio sincronizado. Use «Sync portal → despesas»."
        }
        columns={[
          {
            key: "ref",
            header: "Ref.",
            sortValue: (d) => d.autoInfracao ?? d.id.slice(0, 8),
            render: (d) => <strong>{d.autoInfracao ?? d.id.slice(0, 8)}</strong>,
          },
          {
            key: "placa",
            header: "Placa",
            sortValue: (d) => formatPlaca(d.placa ?? d.veiculoId),
            render: (d) => formatPlaca(d.placa ?? d.veiculoId),
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (d) => d.descricao ?? d.titulo ?? "",
            render: (d) => (
              <span className="infracao-desc" title={d.descricao}>
                {d.descricao ?? d.titulo ?? "—"}
              </span>
            ),
          },
          {
            key: "data",
            header: "Passagem",
            sortValue: (d) => d.dataAutuacao?.slice(0, 16) ?? "",
            render: (d) => d.dataAutuacao?.slice(0, 16) ?? "—",
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (d) => valorPedagio(d),
            render: (d) => formatBrl(valorPedagio(d)),
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
            key: "responsavel",
            header: "Responsável",
            render: (d) => (
              <ResponsavelDebitoCell
                tipo="pedagio"
                despesaId={d.id}
                autoInfracao={d.autoInfracao ?? d.id}
                item={d}
                onConfirmed={() =>
                  void queryClient.invalidateQueries({ queryKey: ["despesas-cliente"] })
                }
              />
            ),
          },
          {
            key: "origem",
            header: "Origem",
            sortValue: (d) => d.origem ?? "pedagio-digital",
            render: (d) => (
              <span className="badge badge--muted">{rotuloPedagioDigital(d.origem)}</span>
            ),
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

function AtribuicaoResumo({ data }: { data: unknown }) {
  const payload = (data as { data?: Record<string, unknown> } | null)?.data;
  if (!payload || typeof payload !== "object") return null;

  const vinculados = Number(payload.vinculados) || 0;
  const parceiro =
    (Number(payload.naoIdentificados) || 0) + (Number(payload.parceiroEspelhados) || 0);
  const pendentes = Number(payload.clienteFaltando) || 0;
  const semData = Number(payload.semData) || 0;
  if (!vinculados && !parceiro && !pendentes && !semData) return null;

  return (
    <p className="relatorio-infracoes__resumo">
      {vinculados ? (
        <span className="badge badge--ok">{vinculados} cliente(s) sugerido(s)</span>
      ) : null}{" "}
      {parceiro ? (
        <span className="badge badge--muted">{parceiro} parceiro(s) sugerido(s)</span>
      ) : null}{" "}
      {pendentes ? (
        <span className="badge badge--warn">{pendentes} pendente(s)</span>
      ) : null}{" "}
      {semData ? <span className="badge badge--danger">{semData} sem data</span> : null}
    </p>
  );
}
