import { useMemo, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ResultPanel } from "@/components/ResultPanel";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { ROTULO_SIGAPAY } from "@/lib/estacionamentoLabels";
import type { SigapayAvisoPortal, SigapayAvisosResposta } from "@/api/types";
import { useVeiculos } from "@/api/hooks";

type StatusFiltro = "aberto" | "pago" | "todos";

/** Consulta ACT/avisos directamente no portal SigaPay (antes ou depois do sync). */
export function SigapayPortalPanel() {
  const [veiculoId, setVeiculoId] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("aberto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<SigapayAvisosResposta | null>(null);
  const [conferir, setConferir] = useState<unknown>(null);

  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const placa = useMemo(() => {
    if (!veiculoId) return undefined;
    return veiculosQuery.data?.items.find((v) => v.id === veiculoId)?.placa;
  }, [veiculoId, veiculosQuery.data]);

  const total = useMemo(
    () => (avisos?.items ?? []).reduce((s, a) => s + (Number(a.valor) || 0), 0),
    [avisos],
  );

  async function consultarPortal() {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.estacionamentoAvisos(placa, status);
      setAvisos(r);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portal SigaPay.");
    } finally {
      setLoading(false);
    }
  }

  async function conferirPlacas() {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.estacionamentoConferir(false);
      setConferir(r);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao conferir placas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">Dados do portal {ROTULO_SIGAPAY}</h2>
      <p className="field__hint">
        Consulta ACT/avisos em tempo real no site (requer sessão activa acima). Use antes do sync
        para ver o que o portal devolve.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Veículo</span>
          <VeiculoSelect
            value={veiculoId}
            onChange={setVeiculoId}
            valueField="id"
            ativo
            tipoFrota={TipoVeiculoFrota.Locacao}
            variant="filtro"
          />
          <span className="field__hint">Vazio = frota activa inteira</span>
        </label>
        <label className="field">
          <span className="field__label">Situação</span>
          <NativeSelect
            value={status}
            onChange={(v) => setStatus(v as StatusFiltro)}
            variant="filtro"
            allowEmpty={false}
            aria-label="Situação"
          >
            <option value="aberto">Em aberto</option>
            <option value="pago">Pagos</option>
            <option value="todos">Todos</option>
          </NativeSelect>
        </label>
      </div>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading}
          onClick={() => void consultarPortal()}
        >
          {loading ? "Consultando…" : "Consultar avisos no portal"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={loading}
          onClick={() => void conferirPlacas()}
        >
          Conferir veículos cadastrados
        </button>
      </div>

      <FlashError message={error} />

      {avisos ? (
        <p className="field__hint">
          <span className="badge badge--muted">
            {avisos.total} aviso{avisos.total === 1 ? "" : "s"} · {formatBrl(total)}
          </span>
          {avisos.placa ? ` · placa ${avisos.placa}` : null}
          {avisos.placas?.length ? ` · ${avisos.placas.length} veículo(s) na frota` : null}
        </p>
      ) : null}

      <DataTable
        loading={loading && !avisos}
        rows={avisos?.items ?? []}
        keyFn={(a: SigapayAvisoPortal) => `${a.id}-${a.placa}`}
        emptyMessage="Nenhum aviso — clique em Consultar avisos no portal."
        columns={[
          {
            key: "placa",
            header: "Placa",
            sortValue: (a) => a.placa,
            render: (a) => <strong>{a.placa}</strong>,
          },
          {
            key: "data",
            header: "Data/hora",
            sortValue: (a) => a.dataHoraIso ?? a.dataHoraRaw,
            render: (a) => a.dataHoraRaw || a.dataHoraIso || "—",
          },
          {
            key: "valor",
            header: "Valor",
            sortValue: (a) => a.valor,
            render: (a) => formatBrl(a.valor),
          },
          {
            key: "local",
            header: "Local",
            sortValue: (a) => a.local ?? "",
            render: (a) => a.local ?? "—",
          },
          {
            key: "id",
            header: "Ref.",
            sortValue: (a) => a.id,
            render: (a) => <code>{a.id}</code>,
          },
        ]}
      />

      {conferir ? <ResultPanel title="Conferência de placas" data={conferir} /> : null}
    </section>
  );
}

export function SigapayAvisosFromResult({ data }: { data: unknown }) {
  const portal = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    const p = (data as { portal?: SigapayAvisosResposta }).portal;
    if (!p?.items?.length) return null;
    return p;
  }, [data]);

  if (!portal) return null;

  return (
    <section className="form-card">
      <h2 className="form-card__title">Avisos retornados do portal</h2>
      <p className="field__hint">
        {portal.total} aviso{portal.total === 1 ? "" : "s"} consultados no sync
      </p>
      <DataTable
        rows={portal.items}
        keyFn={(a) => `${a.id}-${a.placa}`}
        columns={[
          { key: "placa", header: "Placa", sortValue: (a) => a.placa, render: (a) => a.placa },
          {
            key: "data",
            header: "Data",
            sortValue: (a) => a.dataHoraRaw,
            render: (a) => a.dataHoraRaw,
          },
          {
            key: "valor",
            header: "Valor",
            sortValue: (a) => a.valor,
            render: (a) => formatBrl(a.valor),
          },
          {
            key: "local",
            header: "Local",
            sortValue: (a) => a.local ?? "",
            render: (a) => a.local ?? "—",
          },
        ]}
      />
    </section>
  );
}
