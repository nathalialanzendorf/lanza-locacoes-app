import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { VeiculoSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { CATEGORIA_ESTACIONAMENTO } from "@/lib/estacionamentoLabels";
import { CATEGORIA_PEDAGIO } from "@/lib/pedagioLabels";
import { bodySyncGlobal, opcoesSyncCompleto } from "@/lib/syncUi";
import { SyncJobsTable, SyncStatusBanner, useSyncOpcoes } from "@/pages/sync/syncShared";
import { SyncRegistrosTable } from "@/pages/sync/SyncRegistrosTable";
import { useSyncRegistrosLinhas } from "@/pages/sync/useSyncRegistrosLinhas";

export function SyncRegistrosSection() {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const opcoes = useSyncOpcoes();
  const [veiculoId, setVeiculoId] = useState("");
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<unknown>(null);
  const [inferirResult, setInferirResult] = useState<unknown>(null);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const { linhas, total, loading, placaSync, veiculoIdFiltro, infracoesQuery, despesasQuery } =
    useSyncRegistrosLinhas({ veiculoId });

  async function sincronizarFrota() {
    setAcaoLoading("sync");
    setAcaoError(null);
    setSyncResult(null);
    try {
      const syncs = metaQuery.data?.syncs ?? [];
      const opts = { dryRun: opcoes.dryRun, placa: placaSync };
      const r = await lanzaApi.executarSyncCompleto(
        {
          ...bodySyncGlobal(opts),
          opcoes: opcoesSyncCompleto(syncs, opts),
        },
        { async: opcoes.usarAsync },
      );
      setSyncResult(r);
      if (!opcoes.dryRun) invalidarListagem();
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
      });
      const rPed = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "pedagio",
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, pedagios: rPed, estacionamento: rEst });
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
      const opts = { dryRun: opcoes.dryRun, placa: placaSync };
      const rSync = await lanzaApi.executarSyncCompleto(
        {
          ...bodySyncGlobal(opts),
          opcoes: opcoesSyncCompleto(syncs, opts),
        },
        { async: opcoes.usarAsync },
      );
      setSyncResult(rSync);
      if (opcoes.dryRun) return;
      const rInf = await lanzaApi.atribuirClientesInfracoes({
        veiculoId: veiculoIdFiltro,
      });
      const rPed = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "pedagio",
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        veiculoId: veiculoIdFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, pedagios: rPed, estacionamento: rEst });
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
        <header className="sync-section__head">
          <h2 className="form-card__title">Registros</h2>
          <p className="field__hint">
            Multas, {CATEGORIA_PEDAGIO.toLowerCase()} e {CATEGORIA_ESTACIONAMENTO.toLowerCase()} em
            aberto. Use as abas individuais para um sync específico.
          </p>
        </header>

        <div className="form-grid sync-executar-opcoes">
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
            <span className="field__hint">
              ---Todos--- = frota inteira. Um veículo limita o sync e a listagem.
            </span>
          </label>
          <Toggle
            className="field"
            checked={opcoes.asyncMode}
            onChange={opcoes.setAsyncMode}
            disabled={opcoes.dryRun}
            label="Executar em background (recomendado)"
          />
          <Toggle
            className="field"
            checked={opcoes.dryRun}
            onChange={opcoes.toggleDryRun}
            label="Dry-run (simular, não grava)"
          />
        </div>
        {opcoes.dryRun ? (
          <p className="field__hint sync-dryrun-hint">
            Dry-run executa em modo síncrono e exibe o resultado JSON abaixo — nada é gravado.
          </p>
        ) : null}
        {!loading ? (
          <p className="field__hint">
            {linhas.length} registo{linhas.length === 1 ? "" : "s"} · {formatBrl(total)}
          </p>
        ) : null}

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
            disabled={Boolean(acaoLoading) || opcoes.dryRun}
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
      </section>

      <FlashError message={acaoError} />
      <SyncStatusBanner />
      {opcoes.dryRun ? <ResultPanel title="Resultado (dry-run)" data={syncResult} /> : null}
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
