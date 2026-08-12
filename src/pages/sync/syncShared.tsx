import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { useSyncJobs } from "@/api/hooks";
import { extractJobFailureLines, jobFailureSummary, jobHasPartialFailures } from "@/pages/sync/syncJobErrors";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { bodySyncGlobal, direcaoEfetiva, syncAtivo, type SyncGlobalOpts } from "@/lib/syncUi";
import { LABEL } from "@/lib/labels";
import type { SyncCatalogEntry, SyncJob } from "@/api/types";
import {
  SyncAlteracoesFromResult,
  hasSyncAlteracoes,
  normalizeSyncResultPayload,
} from "@/pages/sync/SyncAlteracoesPanel";

export function useSyncDisparo() {
  const qc = useQueryClient();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);

  async function disparar(label: string, fn: () => Promise<unknown>) {
    setRunningId(label);
    setError(null);
    setLastResult(null);
    setActiveJobId(null);
    try {
      const raw = (await fn()) as { jobId?: string; status?: string; data?: unknown } | null;
      if (raw?.jobId) {
        setLastResult(raw);
        setActiveJobId(raw.jobId);
      } else {
        setLastResult(normalizeSyncResultPayload(raw));
        setRunningId(null);
      }
      void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
      return raw;
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao executar sync.");
      setRunningId(null);
      throw err;
    }
  }

  function releaseRunning() {
    setRunningId(null);
  }

  function clearActiveJob() {
    setActiveJobId(null);
    setRunningId(null);
  }

  return { runningId, activeJobId, error, lastResult, disparar, setError, releaseRunning, clearActiveJob };
}

export function useSyncOpcoes() {
  const [dryRun, setDryRun] = useState(false);
  const [asyncMode, setAsyncMode] = useState(true);

  const globalOpts = useMemo(() => ({ dryRun }), [dryRun]);
  const usarAsync = asyncMode && !dryRun;

  function toggleDryRun(checked: boolean) {
    setDryRun(checked);
    if (checked) setAsyncMode(false);
  }

  return {
    dryRun,
    asyncMode,
    globalOpts,
    usarAsync,
    setAsyncMode,
    toggleDryRun,
  };
}

type SyncOpcoesProps = {
  asyncMode: boolean;
  onAsyncModeChange: (checked: boolean) => void;
  dryRun: boolean;
  onDryRunChange: (checked: boolean) => void;
};

export function SyncOpcoesGlobais({
  asyncMode,
  onAsyncModeChange,
  dryRun,
  onDryRunChange,
}: SyncOpcoesProps) {
  return (
    <section className="form-card sync-options">
      <div className="form-grid sync-executar-opcoes">
        <Toggle
          className="field"
          checked={asyncMode}
          onChange={onAsyncModeChange}
          disabled={dryRun}
          label="Executar em background (recomendado)"
        />
        <Toggle
          className="field"
          checked={dryRun}
          onChange={onDryRunChange}
          label="Dry-run (simular, não grava)"
        />
      </div>
      {dryRun ? (
        <p className="field__hint sync-dryrun-hint">
          Dry-run executa em modo síncrono e exibe o resultado JSON abaixo — nada é gravado.
        </p>
      ) : null}
    </section>
  );
}

const SYNC_STATUS_LABEL: Record<SyncJob["status"], string> = {
  pending: "Na fila",
  running: "Executando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function jobTerminal(status: SyncJob["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function statusSyncLabel(status: SyncJob["status"]): string {
  return SYNC_STATUS_LABEL[status] ?? status;
}

function statusBadge(status: SyncJob["status"]) {
  switch (status) {
    case "completed":
      return "badge badge--ok";
    case "failed":
      return "badge badge--danger";
    case "cancelled":
      return "badge badge--muted";
    case "running":
      return "badge badge--warn";
    default:
      return "badge badge--muted";
  }
}

/** Último job do sync (status, progresso e erro) — substitui o JSON da resposta. */
export function SyncStatusBanner({
  syncId,
  activeJobId,
  onJobFinished,
  hideWhileRunning = false,
  hideResultPanel = false,
}: {
  syncId?: string;
  activeJobId?: string | null;
  onJobFinished?: () => void;
  /** Oculta o banner enquanto pending/running (progresso fica só em Jobs recentes). */
  hideWhileRunning?: boolean;
  /** Oculta o JSON bruto (Resultado / Dados) após concluir. */
  hideResultPanel?: boolean;
}) {
  const qc = useQueryClient();
  const jobsQuery = useSyncJobs(25, activeJobId);
  const [trackedJob, setTrackedJob] = useState<SyncJob | null>(null);
  const [pollErro, setPollErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    if (!activeJobId) return;
    setTrackedJob(null);
    setPollErro(null);
  }, [activeJobId]);

  async function cancelarJob() {
    if (!activeJobId || cancelando) return;
    setCancelando(true);
    try {
      const r = await lanzaApi.cancelarSyncJob(activeJobId);
      setTrackedJob(r.job);
      void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
      onJobFinished?.();
    } catch (err) {
      setPollErro(err instanceof LanzaApiError ? err.message : "Falha ao cancelar job.");
    } finally {
      setCancelando(false);
    }
  }

  useEffect(() => {
    if (!activeJobId) return;
    const jobId = activeJobId;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const job = await lanzaApi.obterSyncJob(jobId);
        if (cancelled) return;
        setPollErro(null);
        setTrackedJob(job);
        void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
        if (jobTerminal(job.status)) {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          onJobFinished?.();
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof LanzaApiError && err.status === 404
            ? "Job não encontrado nesta instância da API (jobs em memória ou migration pendente)."
            : null;
        if (msg) setPollErro(msg);
      }
    }

    void poll();
    timer = setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [activeJobId, onJobFinished, qc]);

  const job = useMemo(() => {
    if (trackedJob && (!syncId || trackedJob.sync === syncId)) return trackedJob;
    const list = jobsQuery.data?.jobs ?? [];
    const doSync = syncId ? list.filter((j) => j.sync === syncId) : list;
    return [...doSync].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [jobsQuery.data, syncId, trackedJob]);

  if (!job) return null;

  const p = job.progress;
  const emCurso = job.status === "pending" || job.status === "running";
  const terminal = jobTerminal(job.status);

  if (hideWhileRunning && emCurso) return null;

  // Só acompanha o job activo — evita "Concluído" de execuções passadas ao reabrir a aba.
  if (activeJobId && job.id !== activeJobId) return null;
  if (!activeJobId && terminal) return null;

  function renderResultadoConcluido() {
    if (job!.status !== "completed" || job!.result == null) return null;
    return (
      <>
        <SyncAlteracoesFromResult data={job!.result} />
        {!hideResultPanel && !hasSyncAlteracoes(job!.result) ? (
          <ResultPanel title="Resultado" data={job!.result} />
        ) : null}
      </>
    );
  }

  if (job.status === "completed" && !job.error) {
    const resultado = renderResultadoConcluido();
    if (jobHasPartialFailures(job)) {
      return (
        <>
          {resultado}
          <section className="form-card sync-status sync-status--erro">
            <ul className="sync-status__falhas">
              {extractJobFailureLines(job).map((line) => (
                <li key={line} className="sync-status__erro">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </>
      );
    }
    return resultado;
  }

  return (
    <section
      className={`form-card sync-status${job.status === "failed" || job.status === "cancelled" || (job.status === "completed" && jobHasPartialFailures(job)) ? " sync-status--erro" : ""}`}
    >
      <p className="sync-status__linha">
        <span className={statusBadge(job.status)}>{statusSyncLabel(job.status)}</span>
        <span className="field__hint">
          {new Date(job.finishedAt ?? job.startedAt ?? job.createdAt).toLocaleString("pt-BR")}
          {p?.fase ? ` · ${p.fase}` : ""}
          {p ? ` · ${p.done}/${p.total} (${p.percent}%)` : ""}
          {p && p.falhas > 0 ? ` · ${p.sucesso} ok, ${p.falhas} com falha` : ""}
        </span>
      </p>
      {job.error ? <p className="sync-status__erro">{job.error}</p> : null}
      {!job.error && job.status === "completed" && jobHasPartialFailures(job) ? (
        <ul className="sync-status__falhas">
          {extractJobFailureLines(job).map((line) => (
            <li key={line} className="sync-status__erro">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {pollErro && emCurso ? <p className="sync-status__erro">{pollErro}</p> : null}
      {emCurso ? (
        <>
          <p className="field__hint">
            A execução continua em background (máx. 5 min) — o status actualiza sozinho.
          </p>
          <div className="form-card__action-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void cancelarJob()}
              disabled={cancelando}
            >
              {cancelando ? "A cancelar…" : "Cancelar job"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

type SyncJobsProps = {
  syncId?: string;
  /** Ex.: `veiculo-portais` inclui veiculo-portais-detran-sc, etc. */
  syncIdPrefix?: string;
  title?: string;
};

export function SyncJobsTable({
  syncId,
  syncIdPrefix,
  title = "Jobs recentes",
}: SyncJobsProps) {
  const qc = useQueryClient();
  const jobsQuery = useSyncJobs();
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const seenFipeDone = useRef(new Set<string>());
  const jobs = useMemo(() => {
    const list = jobsQuery.data?.jobs ?? [];
    if (syncIdPrefix) return list.filter((j) => j.sync.startsWith(syncIdPrefix));
    if (!syncId) return list;
    return list.filter((j) => j.sync === syncId);
  }, [jobsQuery.data, syncId, syncIdPrefix]);

  useEffect(() => {
    for (const j of jobsQuery.data?.jobs ?? []) {
      if (j.sync !== "fipe" || j.status !== "completed" || !j.finishedAt) continue;
      const key = `${j.id}:${j.finishedAt}`;
      if (seenFipeDone.current.has(key)) continue;
      seenFipeDone.current.add(key);
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
    }
  }, [jobsQuery.data, qc]);

  async function cancelarJob(id: string) {
    setCancelandoId(id);
    try {
      await lanzaApi.cancelarSyncJob(id);
      void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
    } finally {
      setCancelandoId(null);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">{title}</h2>
      {jobs.length === 0 ? (
        <p className="field__hint">Nenhum job nesta instância da API.</p>
      ) : (
        <DataTable
          rows={jobs}
          keyFn={(j) => j.id}
          columns={[
            {
              key: "sync",
              header: "Sync",
              sortValue: (j) => j.sync,
              render: (j) => (
                <>
                  <strong>{j.sync}</strong>
                  <br />
                  <span className="field__hint">{j.id.slice(0, 8)}…</span>
                </>
              ),
            },
            {
              key: "status",
              header: "Status",
              sortValue: (j) => j.status,
              render: (j) => (
                <span className={statusBadge(j.status)}>{statusSyncLabel(j.status)}</span>
              ),
            },
            {
              key: "progress",
              header: "Progresso",
              sortValue: (j) => j.progress?.percent ?? -1,
              render: (j) => {
                const p = j.progress;
                if (!p) return <span className="field__hint">—</span>;
                return (
                  <span>
                    {p.fase ? (
                      <>
                        {p.fase}
                        <br />
                      </>
                    ) : null}
                    {p.done}/{p.total} · {p.percent}%
                    {p.falhas > 0 ? (
                      <>
                        <br />
                        <span className="sync-job-error">
                          ok {p.sucesso} · falhas {p.falhas}
                        </span>
                      </>
                    ) : null}
                  </span>
                );
              },
            },
            {
              key: "createdAt",
              header: "Criado",
              sortValue: (j) => j.createdAt,
              render: (j) => new Date(j.createdAt).toLocaleString("pt-BR"),
            },
            {
              key: "error",
              header: "Erro / avisos",
              sortValue: (j) => jobFailureSummary(j) ?? "",
              render: (j) => {
                const msg = jobFailureSummary(j);
                if (!msg) return <span className="field__hint">—</span>;
                return (
                  <span className="sync-job-error" title={extractJobFailureLines(j).join("\n")}>
                    {msg}
                  </span>
                );
              },
            },
            {
              key: "acoes",
              header: "",
              render: (j) =>
                j.status === "pending" || j.status === "running" ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={cancelandoId === j.id}
                    onClick={() => void cancelarJob(j.id)}
                  >
                    {cancelandoId === j.id ? "…" : "Cancelar"}
                  </button>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      )}
    </section>
  );
}

type SyncCardProps = {
  sync: SyncCatalogEntry;
  running: boolean;
  disabled: boolean;
  onExecutar: () => void;
};

export function SyncCard({ sync, running, disabled, onExecutar }: SyncCardProps) {
  const direcao = direcaoEfetiva(sync);
  const acao = direcao === "enviar" ? "Enviar" : "Buscar";
  const depreciado = !syncAtivo(sync);

  return (
    <article className={`sync-card${depreciado ? " sync-card--deprecated" : ""}`}>
      <header className="sync-card__head">
        <h3>{sync.rotulo}</h3>
        <code className="sync-card__skill">{sync.id}</code>
      </header>
      <p className="sync-card__destino">{sync.destino}</p>
      {sync.nota ? <p className="sync-card__nota">{sync.nota}</p> : null}
      <div className="sync-card__badges">
        {depreciado ? (
          <span className="badge badge--muted">Descontinuado</span>
        ) : (
          <span className={direcao === "enviar" ? "badge badge--warn" : "badge badge--ok"}>{acao}</span>
        )}
        {!depreciado && sync.interativo ? (
          <span className="badge badge--muted">Interativo</span>
        ) : null}
        {!depreciado && !sync.interativo ? (
          <span className="badge badge--muted">Automático</span>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn--primary sync-card__btn"
        disabled={disabled || depreciado}
        onClick={onExecutar}
      >
        {depreciado ? "Indisponível" : running ? LABEL.processando : acao}
      </button>
    </article>
  );
}

export function executarSyncId(
  syncs: SyncCatalogEntry[],
  id: string,
  globalOpts: SyncGlobalOpts,
  usarAsync: boolean,
) {
  const entry = syncs.find((s) => s.id === id);
  if (entry && !syncAtivo(entry)) {
    throw new Error("Sync descontinuado.");
  }
  return lanzaApi.executarSync(id, bodySyncGlobal(globalOpts), { async: usarAsync });
}
