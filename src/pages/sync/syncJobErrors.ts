import type { SyncJob } from "@/api/types";

type PortalSecao = {
  error?: string;
  avisos?: string[];
};

type SyncItem = {
  placa?: string;
  avisos?: string[];
};

function collectSecaoMessages(secao: PortalSecao | undefined): string[] {
  if (!secao) return [];
  const msgs: string[] = [];
  if (secao.error?.trim()) msgs.push(secao.error.trim());
  if (secao.avisos?.length) msgs.push(...secao.avisos.filter(Boolean));
  return msgs;
}

function collectItemAvisos(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const lines: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as SyncItem;
    if (!item.avisos?.length) continue;
    for (const aviso of item.avisos) {
      if (!aviso) continue;
      lines.push(item.placa ? `${item.placa}: ${aviso}` : aviso);
    }
  }
  return lines;
}

/** Linhas de falha extraídas do job (error, result, progress). */
export function extractJobFailureLines(job: SyncJob): string[] {
  const lines: string[] = [];
  if (job.error?.trim()) lines.push(job.error.trim());

  const r = job.result as Record<string, unknown> | undefined;
  if (r && typeof r === "object") {
    for (const key of ["detranSc", "detranRs", "pedagio", "estacionamento"]) {
      lines.push(...collectSecaoMessages(r[key] as PortalSecao | undefined));
    }
    lines.push(...collectItemAvisos(r.items));
    const resultado = r.resultado;
    if (resultado && typeof resultado === "object") {
      const res = resultado as { error?: string; avisos?: string[] };
      if (res.error?.trim()) lines.push(res.error.trim());
      if (res.avisos?.length) lines.push(...res.avisos.filter(Boolean));
    }
  }

  if (!lines.length && job.progress?.falhas && job.progress.falhas > 0) {
    lines.push(`${job.progress.falhas} falha(s) — veja detalhes no resultado do job`);
  }

  return [...new Set(lines.map((l) => l.trim()).filter(Boolean))];
}

export function jobFailureSummary(job: SyncJob): string | null {
  const lines = extractJobFailureLines(job);
  if (!lines.length) return null;
  const max = 3;
  const head = lines.slice(0, max).join(" · ");
  return lines.length > max ? `${head} · (+${lines.length - max} mais)` : head;
}

export function jobHasPartialFailures(job: SyncJob): boolean {
  return (
    job.status === "failed" ||
    Boolean(job.error?.trim()) ||
    (job.progress?.falhas ?? 0) > 0 ||
    extractJobFailureLines(job).length > 0
  );
}
