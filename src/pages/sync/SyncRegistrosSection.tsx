import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { VeiculoSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import { CATEGORIA_ESTACIONAMENTO } from "@/lib/estacionamentoLabels";
import { CATEGORIA_PEDAGIO } from "@/lib/pedagioLabels";
import { bodySyncGlobal, opcoesSyncCompleto } from "@/lib/syncUi";
import { SyncJobsTable } from "@/pages/sync/syncShared";
import { SyncRegistrosTable } from "@/pages/sync/SyncRegistrosTable";
import { useSyncRegistrosLinhas } from "@/pages/sync/useSyncRegistrosLinhas";

export function SyncRegistrosSection() {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const [veiculoId, setVeiculoId] = useState("");
  const [semConfirmacao, setSemConfirmacao] = useState(false);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<unknown>(null);
  const [inferirResult, setInferirResult] = useState<unknown>(null);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const { linhas, total, loading, placaSync, veiculoIdFiltro, infracoesQuery, despesasQuery } =
    useSyncRegistrosLinhas({ veiculoId, semConfirmacao });

  async function sincronizarFrota() {
    setAcaoLoading("sync");
    setAcaoError(null);
    setSyncResult(null);
    try {
      const syncs = metaQuery.data?.syncs ?? [];
      const r = await lanzaApi.executarSyncCompleto({
        ...bodySyncGlobal({ dryRun: false, placa: placaSync }),
        opcoes: opcoesSyncCompleto(syncs, { dryRun: false, placa: placaSync }),
      });
      setSyncResult(r);
      invalidarListagem();
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao sincronizar.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function inferirResponsaveis() {
    setAcaoLoading("inferir");
    setAcaoError(null);
    setInferirResult(null);
    try {
      const rInf = await lanzaApi.atribuirClientesInfracoes({
        veiculoId: veiculoIdFiltro,
        incluirPedagios: true,
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, estacionamento: rEst });
      invalidarListagem();
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao inferir responsáveis.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function sincronizarEInferir() {
    setAcaoLoading("tudo");
    setAcaoError(null);
    setSyncResult(null);
    setInferirResult(null);
    try {
      const syncs = metaQuery.data?.syncs ?? [];
      const rSync = await lanzaApi.executarSyncCompleto({
        ...bodySyncGlobal({ dryRun: false, placa: placaSync }),
        opcoes: opcoesSyncCompleto(syncs, { dryRun: false, placa: placaSync }),
      });
      setSyncResult(rSync);
      const rInf = await lanzaApi.atribuirClientesInfracoes({
        veiculoId: veiculoIdFiltro,
        incluirPedagios: true,
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, estacionamento: rEst });
      invalidarListagem();
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha no sync e inferência.");
    } finally {
      setAcaoLoading(null);
    }
  }

  function invalidarListagem() {
    void qc.invalidateQueries({ queryKey: ["infracoes"] });
    void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Visão geral</h2>
        <p className="field__hint">
          Multas, {CATEGORIA_PEDAGIO.toLowerCase()} e {CATEGORIA_ESTACIONAMENTO.toLowerCase()} em aberto.
          Use as abas individuais para executar um sync específico.
        </p>
      </section>

      <section className="form-card">
        <h2 className="form-card__title">Veículo</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              ativo
              variant="filtro"
            />
            <span className="field__hint">
              ---Todos--- sincroniza e lista a frota ativa. Um veículo limita pedágio, SigaPay, DETRAN e
              FIPE a esse veículo.
            </span>
          </label>
          <label className="field checkbox-inline">
            <input
              type="checkbox"
              checked={semConfirmacao}
              onChange={(e) => setSemConfirmacao(e.target.checked)}
            />
            Só registos sem confirmação de responsável
          </label>
        </div>
        {!loading ? (
          <p className="field__hint">
            {linhas.length} registo{linhas.length === 1 ? "" : "s"} · {formatBrl(total)}
          </p>
        ) : null}
      </section>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void sincronizarFrota()}
        >
          {acaoLoading === "sync" ? "Sincronizando…" : "Sync completo"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void inferirResponsaveis()}
        >
          {acaoLoading === "inferir" ? "Inferindo…" : "Inferir responsáveis"}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={Boolean(acaoLoading)}
          onClick={() => void sincronizarEInferir()}
        >
          {acaoLoading === "tudo" ? "A processar…" : "Sync completo e inferir"}
        </button>
      </div>

      <FlashError message={acaoError} />
      <ResultPanel title="Resultado sync" data={syncResult} />
      <ResultPanel title="Inferência de responsáveis" data={inferirResult} />

      {infracoesQuery.isError || despesasQuery.isError ? (
        <QueryError
          message={
            infracoesQuery.error instanceof LanzaApiError
              ? infracoesQuery.error.message
              : despesasQuery.error instanceof LanzaApiError
                ? despesasQuery.error.message
                : "Falha ao listar registos."
          }
        />
      ) : null}

      <SyncRegistrosTable
        loading={loading}
        linhas={linhas}
        veiculoIdFiltro={veiculoIdFiltro}
        onConfirmed={invalidarListagem}
      />

      <SyncJobsTable />
    </>
  );
}
