import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { useSyncMeta } from "@/api/hooks";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { LABEL } from "@/lib/labels";
import { abasSync, rotuloAbaSync } from "@/lib/syncUi";
import { SyncJobFalhasPanel } from "@/pages/sync/SyncJobFalhasPanel";
import {
  SyncJobsTable,
  SyncStatusBanner,
  executarSyncId,
  useSyncDisparo,
  useSyncOpcoes,
} from "@/pages/sync/syncShared";
import { FipeSyncPanel } from "@/pages/sync/FipeSyncPanel";
import { PedagioPortalPanel } from "@/pages/sync/PedagioPortalPanel";
import { SigapayPortalPanel } from "@/pages/sync/SigapayPortalPanel";
import { SigapayPixPanel } from "@/pages/sync/SigapayPixPanel";
import { SeguroUploadPanel } from "@/pages/sync/SeguroUploadPanel";
import { SyncAlteracoesFromResult, hasSyncAlteracoes } from "@/pages/sync/SyncAlteracoesPanel";

type Props = {
  syncId: string;
};

export function SyncTipoSection({ syncId }: Props) {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const sync = metaQuery.data?.syncs.find((s) => s.id === syncId);
  const opcoes = useSyncOpcoes();
  const { runningId, activeJobId, error, lastResult, disparar, releaseRunning } = useSyncDisparo();
  const [searchParams] = useSearchParams();

  const isFipe = syncId === "fipe";
  const placaFipeUrl = isFipe ? searchParams.get("placa")?.trim() ?? "" : "";
  const marcaFipeUrl = isFipe ? searchParams.get("marcaModelo")?.trim() ?? "" : "";
  const anoFipeUrl = isFipe ? searchParams.get("anoModelo")?.trim() ?? "" : "";

  const globalOpts = useMemo(() => ({ dryRun: opcoes.dryRun }), [opcoes.dryRun]);

  function invalidarListagem() {
    void qc.invalidateQueries({ queryKey: ["infracoes"] });
    void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    void qc.invalidateQueries({ queryKey: ["despesas-parceiro"] });
  }

  function executar() {
    if (!sync || isFipe) return;
    void disparar(syncId, () =>
      executarSyncId(metaQuery.data?.syncs ?? [], syncId, globalOpts, opcoes.usarAsync),
    ).then(() => {
      if (!opcoes.dryRun) invalidarListagem();
    });
  }

  if (metaQuery.isLoading) {
    return <p className="field__hint">A carregar sync…</p>;
  }

  if (!sync) {
    return <p className="field__hint">Sync não encontrado.</p>;
  }

  return (
    <>
      {!isFipe ? (
        <>
          <section className="form-card">
            <header className="sync-section__head">
              <h2 className="form-card__title">{sync.rotulo}</h2>
              <p className="field__hint">{sync.destino}</p>
              {sync.nota ? <p className="field__hint">{sync.nota}</p> : null}
            </header>

            <div className="form-grid sync-executar-opcoes">
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
                Dry-run simula o sync sem gravar — a tabela abaixo mostra o que seria cadastrado, alterado ou
                excluído.
              </p>
            ) : null}

            <div className="despesas-toolbar">
              <button
                type="button"
                className="btn btn--primary"
                disabled={runningId !== null}
                onClick={executar}
              >
                {runningId === syncId ? LABEL.processando : "Executar sync"}
              </button>
            </div>
          </section>
          <SyncStatusBanner
            syncId={syncId}
            activeJobId={activeJobId}
            onJobFinished={releaseRunning}
            hideWhileRunning={syncId === "infracoes" || syncId === "pedagios"}
            hideResultPanel={syncId === "infracoes" || syncId === "seguro"}
          />
          {syncId === "pedagios" ? <PedagioPortalPanel /> : null}
          {syncId === "seguro" ? (
            <SeguroUploadPanel dryRun={opcoes.dryRun} onSynced={invalidarListagem} />
          ) : null}
          {syncId === "estacionamento" ? (
            <>
              <SigapayPortalPanel />
              <SigapayPixPanel />
            </>
          ) : null}
        </>
      ) : (
        <FipeSyncPanel
          initialPlaca={placaFipeUrl || undefined}
          initialMarcaModelo={marcaFipeUrl || undefined}
          initialAnoModelo={anoFipeUrl || undefined}
        />
      )}

      <FlashError message={error} />
      {!isFipe && opcoes.dryRun ? (
        <>
          <SyncAlteracoesFromResult
            data={lastResult}
            title="Alterações do sync (dry-run)"
          />
          {syncId !== "infracoes" && syncId !== "seguro" && !hasSyncAlteracoes(lastResult) ? (
            <ResultPanel title="Resultado (dry-run)" data={lastResult} />
          ) : null}
        </>
      ) : null}
      <SyncJobFalhasPanel syncId={syncId} title={`Falhas — ${sync.rotulo}`} />
      <SyncJobsTable syncId={syncId} />
    </>
  );
}

export function SyncLegadoSection() {
  const metaQuery = useSyncMeta();
  const opcoes = useSyncOpcoes();
  const { error, lastResult } = useSyncDisparo();
  const { legado } = abasSync(metaQuery.data?.syncs ?? []);

  return (
    <>
      <section className="form-card">
        <header className="sync-section__head">
          <h2 className="form-card__title">Integrações Rastreame (descontinuadas)</h2>
          <p className="field__hint">
            Mantidas só por compatibilidade — não enviar nem buscar dados do Rastreame.
          </p>
        </header>

        <div className="form-grid sync-executar-opcoes">
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
      </section>

      {metaQuery.isError ? (
        <QueryError
          message={
            metaQuery.error instanceof LanzaApiError
              ? metaQuery.error.message
              : "Falha ao carregar catálogo de syncs."
          }
        />
      ) : null}

      <FlashError message={error} />

      {metaQuery.isLoading ? (
        <p className="field__hint">A carregar syncs…</p>
      ) : (
        <div className="sync-grid">
          {legado.map((s) => (
            <article key={s.id} className="sync-card sync-card--deprecated">
              <header className="sync-card__head">
                <h3>{s.rotulo}</h3>
                <code className="sync-card__skill">{s.id}</code>
              </header>
              <p className="sync-card__destino">{s.destino}</p>
              {s.nota ? <p className="sync-card__nota">{s.nota}</p> : null}
              <span className="badge badge--muted">Descontinuado</span>
              <button
                type="button"
                className="btn btn--primary sync-card__btn"
                disabled
              >
                Indisponível
              </button>
            </article>
          ))}
        </div>
      )}

      {opcoes.dryRun ? <ResultPanel title="Resultado (dry-run)" data={lastResult} /> : null}
      <SyncJobsTable />
    </>
  );
}

export { rotuloAbaSync };
