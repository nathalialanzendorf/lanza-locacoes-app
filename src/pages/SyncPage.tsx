import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { PageHeader, QueryError } from "@/components/PageHeader";
import { VeiculoSelect } from "@/components/EntitySelects";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { useSyncJobs, useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { bodySyncGlobal, direcaoEfetiva, opcoesSyncCompleto, ordenarSyncsPorDirecao, syncAtivo } from "@/lib/syncUi";
import { LABEL } from "@/lib/labels";
import type { SyncCatalogEntry, SyncJob } from "@/api/types";

const SKILL_ALIASES: Record<string, string> = {
  motoristas: "sync-cliente",
  rastreaveis: "sync-veículo",
  "rastreaveis-enviar": "sync-veículo",
  fipe: "sync-fipe",
  infracoes: "sync-infracoes",
  "ipva-licenciamento": "sync-ipva-licenciamento",
  pedagios: "sync-pedagios",
  seguro: "sync-seguro",
  recebimentos: "sync-recebimentos",
  "detran-rs": "sync-detran-rs",
  manutencao: "sync-manutencao",
};

function statusBadge(status: SyncJob["status"]) {
  switch (status) {
    case "completed":
      return "badge badge--ok";
    case "failed":
      return "badge badge--danger";
    case "running":
      return "badge badge--warn";
    default:
      return "badge badge--muted";
  }
}

type SyncCardProps = {
  sync: SyncCatalogEntry;
  running: boolean;
  disabled: boolean;
  onExecutar: () => void;
};

function SyncCard({ sync, running, disabled, onExecutar }: SyncCardProps) {
  const direcao = direcaoEfetiva(sync);
  const acao = direcao === "enviar" ? "Enviar" : "Buscar";
  const depreciado = !syncAtivo(sync);

  return (
    <article className={`sync-card${depreciado ? " sync-card--deprecated" : ""}`}>
      <header className="sync-card__head">
        <h3>{sync.rotulo}</h3>
        <code className="sync-card__skill">{SKILL_ALIASES[sync.id] ?? sync.id}</code>
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

type SyncSectionProps = {
  titulo: string;
  descricao: string;
  syncs: SyncCatalogEntry[];
  runningId: string | null;
  onExecutar: (id: string) => void;
  deprecated?: boolean;
};

function SyncSection({ titulo, descricao, syncs, runningId, onExecutar, deprecated }: SyncSectionProps) {
  if (syncs.length === 0) return null;

  return (
    <section className={`sync-section${deprecated ? " sync-section--deprecated" : ""}`}>
      <header className="sync-section__head">
        <h2 className="form-card__title">{titulo}</h2>
        <p className="field__hint">{descricao}</p>
      </header>
      <div className="sync-grid">
        {syncs.map((s) => (
          <SyncCard
            key={s.id}
            sync={s}
            running={runningId === s.id}
            disabled={runningId !== null}
            onExecutar={() => onExecutar(s.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function SyncPage() {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const [dryRun, setDryRun] = useState(false);
  const [asyncMode, setAsyncMode] = useState(true);
  const [placa, setPlaca] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);

  const jobsQuery = useSyncJobs();
  const jobs = jobsQuery.data?.jobs ?? [];

  const syncs = metaQuery.data?.syncs ?? [];
  const syncsBuscar = useMemo(() => ordenarSyncsPorDirecao(syncs, "buscar"), [syncs]);
  const syncsEnviar = useMemo(() => ordenarSyncsPorDirecao(syncs, "enviar"), [syncs]);
  const syncsBuscarAtivos = useMemo(() => syncsBuscar.filter(syncAtivo), [syncsBuscar]);
  const syncsEnviarAtivos = useMemo(() => syncsEnviar.filter(syncAtivo), [syncsEnviar]);
  const syncsBuscarDepreciados = useMemo(() => syncsBuscar.filter((s) => !syncAtivo(s)), [syncsBuscar]);
  const syncsEnviarDepreciados = useMemo(() => syncsEnviar.filter((s) => !syncAtivo(s)), [syncsEnviar]);

  const globalOpts = useMemo(() => ({ dryRun, placa }), [dryRun, placa]);
  const usarAsync = asyncMode && !dryRun;

  async function disparar(label: string, fn: () => Promise<unknown>) {
    setRunningId(label);
    setError(null);
    setLastResult(null);
    try {
      const r = await fn();
      setLastResult(r);
      void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao executar sync.");
    } finally {
      setRunningId(null);
    }
  }

  function executarSync(id: string) {
    const entry = syncs.find((s) => s.id === id);
    if (entry && !syncAtivo(entry)) return;
    void disparar(id, () => lanzaApi.executarSync(id, bodySyncGlobal(globalOpts), { async: usarAsync }));
  }

  function executarCompleto() {
    void disparar("completo", () =>
      lanzaApi.executarSyncCompleto(
        {
          ...bodySyncGlobal(globalOpts),
          opcoes: opcoesSyncCompleto(syncs, globalOpts),
        },
        { async: usarAsync },
      ),
    );
  }

  function toggleDryRun(checked: boolean) {
    setDryRun(checked);
    if (checked) setAsyncMode(false);
  }

  return (
    <PageHeader
      title="Sincronizações"
      description="Buscar dados de fontes externas (DETRAN, pedágio, FIPE, seguro). Integração Rastreame descontinuada."
    >
      <section className="form-card sync-options">
        <h2 className="form-card__title">Opções globais</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo (opcional)</span>
            <VeiculoSelect
              value={placa}
              onChange={setPlaca}
              valueField="placa"
              variant="filtro"
            />
            <span className="field__hint">Infrações, IPVA, pedágio e FIPE — um veículo</span>
          </label>
          <Toggle
            className="field"
            checked={asyncMode}
            onChange={setAsyncMode}
            disabled={dryRun}
            label="Executar em background (recomendado)"
          />
          <Toggle
            className="field"
            checked={dryRun}
            onChange={toggleDryRun}
            label="Dry-run (simular, não grava)"
          />
        </div>
        {dryRun ? (
          <p className="field__hint sync-dryrun-hint">
            Dry-run executa em modo síncrono e exibe o resultado JSON abaixo — nada é gravado.
          </p>
        ) : null}
      </section>

      <section className="sync-completo">
        <div>
          <h2 className="form-card__title">Sync completo</h2>
          <p className="field__hint">
            DETRAN, pedágio, FIPE e seguro — na ordem definida. Syncs Rastreame não entram mais no lote.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={runningId !== null}
          onClick={executarCompleto}
        >
          {runningId === "completo" ? LABEL.processando : "Executar sync completo"}
        </button>
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

      {error ? <p className="form-card__error">{error}</p> : null}

      {metaQuery.isLoading ? (
        <p className="field__hint">A carregar syncs…</p>
      ) : (
        <>
          <SyncSection
            titulo="Buscar dados"
            descricao="Puxa informações para o database local (DETRAN, pedágio, FIPE, seguro)."
            syncs={syncsBuscarAtivos}
            runningId={runningId}
            onExecutar={executarSync}
          />
          {syncsEnviarAtivos.length > 0 ? (
            <SyncSection
              titulo="Enviar dados"
              descricao="Syncs ativos de envio."
              syncs={syncsEnviarAtivos}
              runningId={runningId}
              onExecutar={executarSync}
            />
          ) : null}
          {syncsBuscarDepreciados.length > 0 || syncsEnviarDepreciados.length > 0 ? (
            <SyncSection
              titulo="Rastreame (descontinuado)"
              descricao="Mantidos só por compatibilidade — não enviar nem buscar dados do Rastreame."
              syncs={[...syncsBuscarDepreciados, ...syncsEnviarDepreciados]}
              runningId={runningId}
              onExecutar={executarSync}
              deprecated
            />
          ) : null}
        </>
      )}

      <ResultPanel title={dryRun ? "Resultado (dry-run)" : "Última resposta"} data={lastResult} />

      <section className="form-card">
        <h2 className="form-card__title">Jobs recentes</h2>
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
                render: (j) => <span className={statusBadge(j.status)}>{j.status}</span>,
              },
              {
                key: "createdAt",
                header: "Criado",
                sortValue: (j) => j.createdAt,
                render: (j) => new Date(j.createdAt).toLocaleString("pt-BR"),
              },
              {
                key: "error",
                header: "Erro",
                sortValue: (j) => j.error ?? "",
                render: (j) => <span className="sync-job-error">{j.error ?? "—"}</span>,
              },
            ]}
          />
        )}
      </section>
    </PageHeader>
  );
}
