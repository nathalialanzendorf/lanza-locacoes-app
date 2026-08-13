import { useMemo } from "react";

import { DataTable } from "@/components/DataTable";
import { useSyncJobs } from "@/api/hooks";
import type { FipeSyncLinha, SyncJob } from "@/api/types";

function linhasDoJob(job: SyncJob | undefined): FipeSyncLinha[] {
  if (!job) return [];
  const fromProgress = job.progress?.resultados;
  if (fromProgress?.length) return fromProgress;

  const result = job.result as { resultados?: FipeSyncLinha[] } | null | undefined;
  if (result && Array.isArray(result.resultados)) return result.resultados;
  return [];
}

function jobFipeAtivo(jobs: SyncJob[]): SyncJob | undefined {
  const fipe = jobs.filter((j) => j.sync === "fipe");
  return (
    fipe.find((j) => j.status === "running" || j.status === "pending") ??
    fipe.find((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled")
  );
}

export function FipeSyncResultadosPanel() {
  const jobsQuery = useSyncJobs();
  const job = useMemo(() => jobFipeAtivo(jobsQuery.data?.jobs ?? []), [jobsQuery.data]);
  const linhas = useMemo(() => linhasDoJob(job), [job]);
  const progress = job?.progress;

  if (!job) return null;

  return (
    <section className="form-card">
      <h2 className="form-card__title">Resultado</h2>
      <p className="field__hint">
        {job.status === "running" || job.status === "pending"
          ? "Atualizando em tempo real…"
          : job.status === "completed"
            ? "Sync concluído."
            : "Sync com falha."}
        {progress
          ? ` ${progress.done}/${progress.total} · ${progress.percent}% · ok ${progress.sucesso} · falhas ${progress.falhas}`
          : null}
      </p>
      {linhas.length === 0 ? (
        <p className="field__hint">Aguardando primeira consulta…</p>
      ) : (
        <DataTable
          rows={linhas}
          keyFn={(r) => `${r.placa}|${r.fipeCodigo ?? ""}|${r.ok ? "ok" : r.erro ?? "err"}`}
          columns={[
            {
              key: "placa",
              header: "Placa",
              sortValue: (r) => r.placa,
              render: (r) => <strong>{r.placa}</strong>,
            },
            {
              key: "marca",
              header: "Marca / modelo",
              sortValue: (r) => r.marcaModelo ?? "",
              render: (r) => r.marcaModelo ?? "—",
            },
            {
              key: "ano",
              header: "Ano",
              sortValue: (r) => r.anoModelo ?? "",
              render: (r) => r.anoModelo ?? "—",
            },
            {
              key: "fipeModelo",
              header: "Modelo FIPE",
              sortValue: (r) => r.fipeModelo ?? "",
              render: (r) => r.fipeModelo ?? "—",
            },
            {
              key: "fipeCodigo",
              header: "Código",
              sortValue: (r) => r.fipeCodigo ?? "",
              render: (r) => r.fipeCodigo ?? "—",
            },
            {
              key: "fipeValor",
              header: "Valor",
              sortValue: (r) => r.fipeValor ?? "",
              render: (r) =>
                r.ok ? (
                  <span>{r.fipeValor ?? "—"}</span>
                ) : (
                  <span className="badge badge--danger">Falhou</span>
                ),
            },
            {
              key: "ref",
              header: "Referência",
              sortValue: (r) => r.fipeReferencia ?? "",
              render: (r) => r.fipeReferencia ?? "—",
            },
            {
              key: "fonte",
              header: "Fonte",
              sortValue: (r) => r.fonte ?? "",
              render: (r) =>
                r.fonte === "placafipebrasil" || r.fipe?.includes("placafipebrasil") ? (
                  <a href={r.fipe ?? "#"} target="_blank" rel="noreferrer">
                    Placa FIPE Brasil
                  </a>
                ) : r.fonte === "parallelum" ? (
                  "FIPE"
                ) : (
                  "—"
                ),
            },
            {
              key: "status",
              header: "Status",
              sortValue: (r) => (r.ok ? "ok" : r.erro ?? "erro"),
              render: (r) =>
                r.ok ? (
                  <span className="badge badge--ok">OK</span>
                ) : (
                  <span className="sync-job-error" title={r.erro}>
                    {r.erro ?? "Erro"}
                    {r.fipe?.includes("placafipebrasil") ? (
                      <>
                        {" "}
                        <a href={r.fipe} target="_blank" rel="noreferrer">
                          site
                        </a>
                      </>
                    ) : null}
                  </span>
                ),
            },
          ]}
        />
      )}
    </section>
  );
}
