import { useMemo } from "react";

import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { RastreameEspelhoToggle } from "@/components/RastreameEspelhoToggle";
import { useSyncMeta } from "@/api/hooks";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { LABEL } from "@/lib/labels";
import { abasSync, direcaoEfetiva } from "@/lib/syncUi";
import {
  SyncCard,
  SyncJobsTable,
  SyncOpcoesGlobais,
  executarSyncId,
  useSyncDisparo,
  useSyncOpcoes,
} from "@/pages/sync/syncShared";
import { RastreameAuthPanel } from "@/pages/sync/RastreameAuthPanel";

export function SyncRastreameSection() {
  const metaQuery = useSyncMeta();
  const opcoes = useSyncOpcoes();
  const { runningId, error, lastResult, disparar } = useSyncDisparo();

  const { rastreame } = abasSync(metaQuery.data?.syncs ?? []);
  const buscar = useMemo(
    () => rastreame.filter((s) => direcaoEfetiva(s) === "buscar"),
    [rastreame],
  );
  const enviar = useMemo(
    () => rastreame.filter((s) => direcaoEfetiva(s) === "enviar"),
    [rastreame],
  );

  const globalOpts = useMemo(() => ({ dryRun: opcoes.dryRun }), [opcoes.dryRun]);

  function executar(syncId: string) {
    void disparar(syncId, () =>
      executarSyncId(metaQuery.data?.syncs ?? [], syncId, globalOpts, opcoes.usarAsync),
    );
  }

  async function executarTodos() {
    for (const s of rastreame) {
      await disparar(s.id, () =>
        executarSyncId(metaQuery.data?.syncs ?? [], s.id, globalOpts, opcoes.usarAsync),
      );
    }
  }

  return (
    <>
      <section className="form-card">
        <header className="sync-section__head">
          <h2 className="form-card__title">Integração Rastreame</h2>
          <p className="field__hint">
            Buscar rastreáveis do Rastreame e enviar clientes, veículos, gastos e manutenção.
            A base Lanza continua sendo a fonte da verdade.
          </p>
        </header>
        <RastreameEspelhoToggle variant="panel" />
      </section>

      <RastreameAuthPanel disabled={runningId !== null} />

      <SyncOpcoesGlobais
        asyncMode={opcoes.asyncMode}
        onAsyncModeChange={opcoes.setAsyncMode}
        dryRun={opcoes.dryRun}
        onDryRunChange={opcoes.toggleDryRun}
      />

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
      ) : rastreame.length === 0 ? (
        <p className="field__hint">Nenhum sync Rastreame disponível.</p>
      ) : (
        <>
          <div className="despesas-toolbar">
            <button
              type="button"
              className="btn btn--primary"
              disabled={runningId !== null}
              onClick={() => void executarTodos()}
            >
              {runningId !== null ? LABEL.processando : "Executar todos"}
            </button>
          </div>

          {buscar.length > 0 ? (
            <section className="sync-rastreame-grupo">
              <h3 className="sync-rastreame-grupo__titulo">Buscar do Rastreame</h3>
              <div className="sync-grid">
                {buscar.map((s) => (
                  <SyncCard
                    key={s.id}
                    sync={s}
                    running={runningId === s.id}
                    disabled={runningId !== null}
                    onExecutar={() => executar(s.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {enviar.length > 0 ? (
            <section className="sync-rastreame-grupo">
              <h3 className="sync-rastreame-grupo__titulo">Enviar para o Rastreame</h3>
              <div className="sync-grid">
                {enviar.map((s) => (
                  <SyncCard
                    key={s.id}
                    sync={s}
                    running={runningId === s.id}
                    disabled={runningId !== null}
                    onExecutar={() => executar(s.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {opcoes.dryRun ? <ResultPanel title="Resultado (dry-run)" data={lastResult} /> : null}
      <SyncJobsTable title="Jobs Rastreame" />
    </>
  );
}
