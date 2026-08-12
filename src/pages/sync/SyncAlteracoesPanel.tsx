import { useMemo } from "react";

import { DataTable } from "@/components/DataTable";
import { formatBrl } from "@/lib/format";
import type { SyncAlteracaoLinha, SyncAlteracaoStatus } from "@/api/types";

const STATUS_LABEL: Record<SyncAlteracaoStatus, string> = {
  cadastrado: "Cadastrado",
  alterado: "Alterado",
  excluido: "Excluído",
  nao_alterado: "Não alterado",
  ignorado: "Ignorado",
};

const ENTIDADE_LABEL: Record<SyncAlteracaoLinha["entidade"], string> = {
  infracao: "Infração",
  cobranca: "Cobrança cliente",
  despesa_parceiro: "Despesa parceiro",
  pedagio: "Pedágio",
  estacionamento: "Estacionamento",
  fipe: "FIPE",
  detran_rs: "DETRAN RS",
};

function statusBadge(status: SyncAlteracaoStatus): string {
  switch (status) {
    case "cadastrado":
      return "badge badge--ok";
    case "alterado":
      return "badge badge--warn";
    case "excluido":
      return "badge badge--danger";
    case "ignorado":
      return "badge badge--muted";
    default:
      return "badge badge--muted";
  }
}

function isAlteracaoLinha(v: unknown): v is SyncAlteracaoLinha {
  if (!v || typeof v !== "object") return false;
  const o = v as SyncAlteracaoLinha;
  return (
    typeof o.placa === "string" &&
    typeof o.referencia === "string" &&
    typeof o.status === "string" &&
    typeof o.entidade === "string"
  );
}

/** Desembrulha resposta sync (job, dry-run síncrono ou `{ data: … }`). */
export function normalizeSyncResultPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const root = data as Record<string, unknown>;
  if (Array.isArray(root.alteracoes) || Array.isArray(root.items) || root.resultado != null) {
    return root;
  }
  if (root.data != null && typeof root.data === "object") {
    return normalizeSyncResultPayload(root.data);
  }
  return root;
}

/** Extrai linhas de alteração do resultado do job (top-level ou por veículo). */
export function extractAlteracoesFromSyncResult(data: unknown): SyncAlteracaoLinha[] {
  const root = normalizeSyncResultPayload(data);
  if (!root || typeof root !== "object") return [];
  const o = root as Record<string, unknown>;

  if (Array.isArray(o.alteracoes)) {
    return o.alteracoes.filter(isAlteracaoLinha);
  }

  const resultado = o.resultado;
  if (
    resultado &&
    typeof resultado === "object" &&
    Array.isArray((resultado as { alteracoes?: unknown[] }).alteracoes)
  ) {
    return ((resultado as { alteracoes: unknown[] }).alteracoes).filter(isAlteracaoLinha);
  }

  if (Array.isArray(o.items)) {
    return o.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const alt = (item as { alteracoes?: unknown[] }).alteracoes;
      return Array.isArray(alt) ? alt.filter(isAlteracaoLinha) : [];
    });
  }

  return [];
}

export function hasSyncAlteracoes(data: unknown): boolean {
  return extractAlteracoesFromSyncResult(data).length > 0;
}

/** @deprecated Use hasSyncAlteracoes */
export const hasDetranSyncAlteracoes = hasSyncAlteracoes;

type Props = {
  data: unknown;
  title?: string;
};

export function SyncAlteracoesFromResult({ data, title = "Resultados" }: Props) {
  const linhas = useMemo(() => extractAlteracoesFromSyncResult(data), [data]);

  const resumo = useMemo(() => {
    const c: Record<SyncAlteracaoStatus, number> = {
      cadastrado: 0,
      alterado: 0,
      excluido: 0,
      nao_alterado: 0,
      ignorado: 0,
    };
    for (const l of linhas) c[l.status]++;
    return c;
  }, [linhas]);

  if (linhas.length === 0) return null;

  return (
    <section className="form-card">
      <header className="sync-section__head">
        <h2 className="form-card__title">{title}</h2>
        <p className="field__hint">
          {resumo.cadastrado} cadastrado{resumo.cadastrado === 1 ? "" : "s"}
          {" · "}
          {resumo.alterado} alterado{resumo.alterado === 1 ? "" : "s"}
          {" · "}
          {resumo.excluido} excluído{resumo.excluido === 1 ? "" : "s"}
          {resumo.nao_alterado > 0
            ? ` · ${resumo.nao_alterado} não alterado${resumo.nao_alterado === 1 ? "" : "s"}`
            : ""}
          {resumo.ignorado > 0
            ? ` · ${resumo.ignorado} ignorado${resumo.ignorado === 1 ? "" : "s"}`
            : ""}
        </p>
      </header>

      <DataTable
          rows={linhas}
          keyFn={(l) => `${l.placa}-${l.entidade}-${l.referencia}-${l.status}`}
          columns={[
            {
              key: "placa",
              header: "Placa",
              sortValue: (l) => l.placa,
              render: (l) => <strong>{l.placa}</strong>,
            },
            {
              key: "entidade",
              header: "Tipo",
              sortValue: (l) => l.entidade,
              render: (l) => ENTIDADE_LABEL[l.entidade] ?? l.entidade,
            },
            {
              key: "referencia",
              header: "Referência",
              sortValue: (l) => l.referencia,
              render: (l) => <code>{l.referencia}</code>,
            },
            {
              key: "descricao",
              header: "Descrição",
              sortValue: (l) => l.descricao,
              render: (l) => l.descricao || "—",
            },
            {
              key: "valor",
              header: "Valor",
              sortValue: (l) => l.valor ?? -1,
              render: (l) => (l.valor != null && l.valor > 0 ? formatBrl(l.valor) : "—"),
            },
            {
              key: "data",
              header: "Data",
              sortValue: (l) => l.data ?? "",
              render: (l) => l.data || "—",
            },
            {
              key: "status",
              header: "Status sync",
              sortValue: (l) => l.status,
              render: (l) => (
                <span className={statusBadge(l.status)}>{STATUS_LABEL[l.status] ?? l.status}</span>
              ),
            },
            {
              key: "aviso",
              header: "Aviso",
              sortValue: (l) => l.aviso ?? "",
              render: (l) =>
                l.aviso ? <span className="sync-job-error">{l.aviso}</span> : <span className="field__hint">—</span>,
            },
          ]}
        />
    </section>
  );
}

/** @deprecated Use SyncAlteracoesFromResult */
export const DetranScAlteracoesFromResult = SyncAlteracoesFromResult;
