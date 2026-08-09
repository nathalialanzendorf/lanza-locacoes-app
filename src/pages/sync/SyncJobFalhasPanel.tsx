import { useMemo } from "react";

import { DataTable } from "@/components/DataTable";
import { useSyncJobs } from "@/api/hooks";
import type { SyncJob } from "@/api/types";
import { extractJobFailureLines } from "@/pages/sync/syncJobErrors";

type FalhaLinha = { id: string; mensagem: string };

function linhasDoJob(job: SyncJob | undefined): FalhaLinha[] {
  if (!job) return [];
  return extractJobFailureLines(job).map((mensagem, i) => ({
    id: `${job.id}-${i}`,
    mensagem,
  }));
}

type Props = {
  syncId?: string;
  syncIdPrefix?: string;
  title?: string;
};

export function SyncJobFalhasPanel({
  syncId,
  syncIdPrefix,
  title = "Falhas do job",
}: Props) {
  const jobsQuery = useSyncJobs();
  const job = useMemo(() => {
    const list = jobsQuery.data?.jobs ?? [];
    const filtered = syncIdPrefix
      ? list.filter((j) => j.sync.startsWith(syncIdPrefix))
      : syncId
        ? list.filter((j) => j.sync === syncId)
        : list;
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [jobsQuery.data, syncId, syncIdPrefix]);

  const linhas = useMemo(() => linhasDoJob(job), [job]);

  if (!job || linhas.length === 0) return null;

  return (
    <section className="form-card sync-falhas-panel">
      <h2 className="form-card__title">{title}</h2>
      <p className="field__hint">
        Job <strong>{job.sync}</strong> · {job.status}
        {job.progress?.falhas ? ` · ${job.progress.falhas} falha(s)` : null}
      </p>
      <DataTable
        rows={linhas}
        keyFn={(r) => r.id}
        columns={[
          {
            key: "mensagem",
            header: "Detalhe",
            sortValue: (r) => r.mensagem,
            render: (r) => (
              <span className="sync-job-error" title={r.mensagem}>
                {r.mensagem}
              </span>
            ),
          },
        ]}
      />
    </section>
  );
}
