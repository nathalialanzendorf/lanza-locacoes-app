import { useMemo, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ResultPanel } from "@/components/ResultPanel";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { ROTULO_PEDAGIO_DIGITAL } from "@/lib/pedagioLabels";
import type { PedagioPassagemPortal, PedagioPassagensResposta } from "@/api/types";
import { useVeiculos } from "@/api/hooks";

type StatusFiltro = "aberto" | "pago" | "todos";

/** Consulta passagens CCR / Pedágio Digital em tempo real (antes ou depois do sync). */
export function PedagioPortalPanel() {
  const [veiculoId, setVeiculoId] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("aberto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passagens, setPassagens] = useState<PedagioPassagensResposta | null>(null);
  const [conferir, setConferir] = useState<unknown>(null);

  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const placa = useMemo(() => {
    if (!veiculoId) return undefined;
    return veiculosQuery.data?.items.find((v) => v.id === veiculoId)?.placa;
  }, [veiculoId, veiculosQuery.data]);

  const total = useMemo(
    () => (passagens?.items ?? []).reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [passagens],
  );

  async function consultarPortal() {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.pedagioPassagens(placa, status);
      setPassagens(r);
    } catch (err) {
      setError(
        err instanceof LanzaApiError ? err.message : "Falha ao consultar Pedágio Digital (CCR).",
      );
    } finally {
      setLoading(false);
    }
  }

  async function conferirPlacas() {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.pedagioConferir(false);
      setConferir(r);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao conferir placas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">Dados do portal {ROTULO_PEDAGIO_DIGITAL}</h2>
      <p className="field__hint">
        Consulta passagens em tempo real no pedagiodigital.com (CCR Via Costeira e demais
        concessionárias). Requer sessão activa no servidor. Use antes do sync para ver o que o portal
        devolve.
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
            <option value="pago">Pagas</option>
            <option value="todos">Todas</option>
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
          {loading ? "Consultando…" : "Consultar passagens no portal"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={loading}
          onClick={() => void conferirPlacas()}
        >
          Conferir veículos cadastrados
        </button>
        <a
          className="btn btn--ghost"
          href="https://pedagiodigital.com/"
          target="_blank"
          rel="noreferrer"
        >
          Abrir pedagiodigital.com
        </a>
      </div>

      <FlashError message={error} />

      {passagens ? (
        <p className="field__hint">
          <span className="badge badge--muted">
            {passagens.total} passagem{passagens.total === 1 ? "" : "ns"} · {formatBrl(total)}
          </span>
          {passagens.placa ? ` · placa ${passagens.placa}` : null}
          {passagens.placas?.length ? ` · ${passagens.placas.length} veículo(s) na frota` : null}
        </p>
      ) : null}

      <DataTable
        loading={loading && !passagens}
        rows={passagens?.items ?? []}
        keyFn={(p: PedagioPassagemPortal) => `${p.id}-${p.placa}`}
        emptyMessage="Nenhuma passagem — clique em Consultar passagens no portal."
        columns={[
          {
            key: "placa",
            header: "Placa",
            sortValue: (p) => p.placa,
            render: (p) => <strong>{p.placa}</strong>,
          },
          {
            key: "data",
            header: "Data/hora",
            sortValue: (p) => p.dataHoraIso ?? p.dataHoraRaw,
            render: (p) => p.dataHoraRaw || p.dataHoraIso || "—",
          },
          {
            key: "valor",
            header: "Valor",
            sortValue: (p) => p.valor,
            render: (p) => formatBrl(p.valor),
          },
          {
            key: "praca",
            header: "Praça / CCR",
            sortValue: (p) => p.praca ?? "",
            render: (p) => p.praca ?? p.rodovia ?? "—",
          },
          {
            key: "id",
            header: "Ref.",
            sortValue: (p) => p.id,
            render: (p) => <code>{p.id}</code>,
          },
        ]}
      />

      {conferir ? <ResultPanel title="Conferência de placas" data={conferir} /> : null}
    </section>
  );
}
