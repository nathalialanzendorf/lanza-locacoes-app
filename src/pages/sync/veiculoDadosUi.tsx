import type { ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import type { VeiculoConsultaFonte, VeiculoConsultaPortaisResultado } from "@/api/types";
import { formatBrl, formatPlaca } from "@/lib/format";

export type PortalItem = {
  id: string;
  ref?: string;
  placa?: string;
  descricao: string;
  local?: string | null;
  data?: string | null;
  valor: number;
  situacao: string;
  emAberto?: boolean;
  fonte?: string;
};

export type PortalSecao = {
  total: number;
  valorTotal: number;
  items: PortalItem[];
  error?: string;
  avisos?: string[];
};

export type SecaoConfig = {
  key: keyof Pick<
    VeiculoConsultaPortaisResultado,
    "detranSc" | "detranRs" | "pedagio" | "estacionamento"
  >;
  titulo: string;
  origem: string;
  colData: string;
};

export const SECOES_PORTAL: SecaoConfig[] = [
  {
    key: "detranSc",
    titulo: "DETRAN SC — infrações",
    origem: "Portal DETRAN SC (consulta live)",
    colData: "Autuação",
  },
  {
    key: "detranRs",
    titulo: "DETRAN RS — débitos",
    origem: "Portal DETRAN RS (consulta live)",
    colData: "Data / competência",
  },
  {
    key: "pedagio",
    titulo: "Pedágio Digital",
    origem: "Portal Pedágio Digital (consulta live)",
    colData: "Passagem",
  },
  {
    key: "estacionamento",
    titulo: "SigaPay — estacionamento",
    origem: "Portal SigaPay (consulta live)",
    colData: "Aviso",
  },
];

export const SECOES_POSTGRES: SecaoConfig[] = [
  {
    key: "detranSc",
    titulo: "DETRAN SC — infrações",
    origem: "PostgreSQL · lanza.infracoes (sync DETRAN SC)",
    colData: "Autuação",
  },
  {
    key: "detranRs",
    titulo: "DETRAN RS — débitos",
    origem: "PostgreSQL · infrações RS + parceiro-despesas (sync DETRAN RS)",
    colData: "Data / competência",
  },
  {
    key: "pedagio",
    titulo: "Pedágio Digital",
    origem: "PostgreSQL · cliente-despesas (sync Pedágio)",
    colData: "Passagem",
  },
  {
    key: "estacionamento",
    titulo: "SigaPay — estacionamento",
    origem: "PostgreSQL · cliente-despesas (sync SigaPay)",
    colData: "Aviso",
  },
];

export function compactPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function buscaFrota(placaInput: string): boolean {
  return !compactPlaca(placaInput);
}

export function situacaoBadge(text: string, emAberto?: boolean): { text: string; className: string } {
  const raw = text.toLowerCase();
  if (emAberto === false || /pago|quitad|baixad/.test(raw)) {
    return { text, className: "badge badge--ok" };
  }
  if (emAberto === true || /aberto|vencid|atrasad|notificad/.test(raw)) {
    return { text, className: "badge badge--warn" };
  }
  return { text: text || "—", className: "badge badge--muted" };
}

export function SecaoDados({
  titulo,
  origem,
  secao,
  loading,
  colData,
  mostrarPlaca = false,
  emptyMessage,
}: {
  titulo: string;
  origem: string;
  secao?: PortalSecao;
  loading?: boolean;
  colData: string;
  mostrarPlaca?: boolean;
  emptyMessage?: string;
}) {
  const items = secao?.items ?? [];
  const columns = [
    ...(mostrarPlaca
      ? [
          {
            key: "placa",
            header: "Placa",
            sortValue: (r: PortalItem) => r.placa ?? "",
            render: (r: PortalItem) => (r.placa ? formatPlaca(r.placa) : "—"),
          },
        ]
      : []),
    {
      key: "ref",
      header: "Ref.",
      sortValue: (r: PortalItem) => r.ref ?? r.id,
      render: (r: PortalItem) => <strong>{r.ref ?? r.id}</strong>,
    },
    {
      key: "desc",
      header: "Descrição",
      sortValue: (r: PortalItem) => r.descricao,
      render: (r: PortalItem) => (
        <span className="infracao-desc" title={r.descricao}>
          {r.descricao}
        </span>
      ),
    },
    {
      key: "local",
      header: "Local",
      sortValue: (r: PortalItem) => r.local ?? "",
      render: (r: PortalItem) => r.local ?? "—",
    },
    {
      key: "data",
      header: colData,
      sortValue: (r: PortalItem) => r.data ?? "",
      render: (r: PortalItem) => r.data ?? "—",
    },
    {
      key: "valor",
      header: "Valor",
      className: "num",
      sortValue: (r: PortalItem) => r.valor,
      render: (r: PortalItem) => (r.valor > 0 ? formatBrl(r.valor) : "—"),
    },
    {
      key: "situacao",
      header: "Situação",
      sortValue: (r: PortalItem) => r.situacao,
      render: (r: PortalItem) => {
        const s = situacaoBadge(r.situacao, r.emAberto);
        return <span className={s.className}>{s.text}</span>;
      },
    },
  ];

  return (
    <section className="form-section veiculo-dados-secao">
      <div className="veiculo-dados-secao__head">
        <h3 className="form-section-title">{titulo}</h3>
        <p className="form-section__lead">
          {origem}
          {secao ? (
            <>
              {" "}
              · {secao.total} registo{secao.total === 1 ? "" : "s"} · {formatBrl(secao.valorTotal)}
            </>
          ) : null}
        </p>
      </div>
      {secao?.error ? <p className="form-card__error">{secao.error}</p> : null}
      {secao?.avisos?.map((a) => (
        <p key={a} className="form-card__error form-card__error--soft">
          {a}
        </p>
      ))}
      <DataTable
        loading={loading}
        rows={items}
        keyFn={(r) => r.id}
        emptyMessage={emptyMessage ?? `Nenhum registo (${titulo}).`}
        columns={columns}
      />
    </section>
  );
}

export function IdentificacaoVeiculo({
  resultado,
  origemLabel,
}: {
  resultado: VeiculoConsultaPortaisResultado;
  origemLabel: string;
}) {
  return (
    <section className="form-card veiculo-dados-veiculo">
      <h2 className="form-card__title">Identificação</h2>
      <dl className="veiculo-dados-resumo">
        <div>
          <dt>Alcance</dt>
          <dd>
            <strong>
              {resultado.modo === "frota"
                ? `Frota activa (${resultado.veiculosConsultados ?? "—"} veículo(s))`
                : formatPlaca(resultado.placa)}
            </strong>
          </dd>
        </div>
        {resultado.modo === "veiculo" ? (
          <>
            <div>
              <dt>Renavam</dt>
              <dd>{resultado.renavam ?? "—"}</dd>
            </div>
            <div>
              <dt>UF registro</dt>
              <dd>{resultado.ufRegistro ?? "—"}</dd>
            </div>
            <div>
              <dt>Cadastro frota</dt>
              <dd>
                <span
                  className={
                    resultado.veiculoCadastrado ? "badge badge--ok" : "badge badge--muted"
                  }
                >
                  {resultado.veiculoCadastrado ? "Cadastrado" : "Não cadastrado"}
                </span>
              </dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Origem</dt>
          <dd>{origemLabel}</dd>
        </div>
      </dl>
    </section>
  );
}

export function FieldLike({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {hint ? <span className="field__hint">{hint}</span> : null}
      {children}
    </label>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PORTAL_JOB_LABEL: Record<string, string> = {
  "detran-sc": "DETRAN SC",
  "detran-rs": "DETRAN RS",
  pedagio: "Pedágio Digital",
  sigapay: "SigaPay",
};

function emptyPortalSecao(): PortalSecao {
  return { total: 0, valorTotal: 0, items: [] };
}

function mergePortalSecao(sections: PortalSecao[]): PortalSecao {
  const withItems = sections.find((s) => s.items.length > 0);
  const withError = sections.find((s) => s.error);
  const withAvisos = sections.find((s) => s.avisos?.length);
  const pick = withItems ?? withError ?? withAvisos ?? sections[0];
  return pick ?? emptyPortalSecao();
}

function mergeConsultaPortais(
  results: VeiculoConsultaPortaisResultado[],
): VeiculoConsultaPortaisResultado {
  const base = results.find((r) => r) ?? results[0];
  if (!base) {
    throw new LanzaApiError(500, "Nenhum portal devolveu resultado.");
  }
  return {
    modo: base.modo,
    placa: base.placa,
    renavam: base.renavam,
    ufRegistro: base.ufRegistro,
    veiculoCadastrado: base.veiculoCadastrado,
    veiculosConsultados: Math.max(...results.map((r) => r.veiculosConsultados ?? 0)),
    fonte: "todos",
    detranSc: mergePortalSecao(results.map((r) => r.detranSc)),
    detranRs: mergePortalSecao(results.map((r) => r.detranRs)),
    pedagio: mergePortalSecao(results.map((r) => r.pedagio)),
    estacionamento: mergePortalSecao(results.map((r) => r.estacionamento)),
  };
}

function erroConsultaParcial(
  fonte: VeiculoConsultaFonte,
  error: string,
  placa?: string,
  frota?: boolean,
): VeiculoConsultaPortaisResultado {
  const sec: PortalSecao = { total: 0, valorTotal: 0, items: [], error };
  const empty = emptyPortalSecao();
  return {
    modo: frota ? "frota" : "veiculo",
    placa: frota ? "Frota activa" : placa ?? "—",
    renavam: null,
    ufRegistro: null,
    veiculoCadastrado: true,
    veiculosConsultados: frota ? 0 : 1,
    fonte,
    detranSc: fonte === "detran-sc" ? sec : empty,
    detranRs: fonte === "detran-rs" ? sec : empty,
    pedagio: fonte === "pedagio" ? sec : empty,
    estacionamento: fonte === "sigapay" ? sec : empty,
  };
}

async function aguardarSyncJob(
  jobId: string,
  opts?: { onProgress?: (msg: string) => void; label?: string },
): Promise<VeiculoConsultaPortaisResultado> {
  const deadline = Date.now() + 5 * 60 * 1000 + 15_000;
  const prefix = opts?.label ? `${opts.label}: ` : "";
  while (Date.now() < deadline) {
    await sleep(2000);
    const job = await lanzaApi.obterSyncJob(jobId);
    if (job.status === "completed" && job.result != null) {
      return job.result as VeiculoConsultaPortaisResultado;
    }
    if (job.status === "failed") {
      throw new LanzaApiError(500, job.error ?? `${prefix}consulta falhou.`);
    }
    if (job.status === "cancelled") {
      throw new LanzaApiError(499, job.error ?? `${prefix}consulta cancelada.`);
    }
    const fase = job.progress?.fase;
    if (fase) opts?.onProgress?.(`${prefix}${fase}`);
  }
  throw new LanzaApiError(0, `${prefix}timeout aguardando job (5 min).`);
}

/** Consulta live nos portais; frota / todos disparam jobs async (1 por portal). */
export async function consultarVeiculoPortaisLive(opts: {
  placa?: string;
  renavam?: string;
  fonte?: VeiculoConsultaFonte;
  frota?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<VeiculoConsultaPortaisResultado> {
  const fonte = opts.fonte ?? "todos";
  const frota = opts.frota ?? (!opts.placa?.trim() && !opts.renavam?.trim());
  const asyncMode = frota || fonte === "todos";

  const r = await lanzaApi.consultarVeiculoPortaisSync({
    placa: opts.placa,
    renavam: opts.renavam,
    fonte,
    async: asyncMode,
  });

  if (r.jobs?.length) {
    opts.onProgress?.(
      `${r.jobs.length} job(s) em background (1 por portal) — acompanhe na tabela abaixo.`,
    );
    const settled = await Promise.allSettled(
      r.jobs.map((j) =>
        aguardarSyncJob(j.jobId, {
          label: PORTAL_JOB_LABEL[j.fonte] ?? j.fonte,
          onProgress: opts.onProgress,
        }),
      ),
    );

    const results: VeiculoConsultaPortaisResultado[] = [];
    let hardFail = 0;
    for (let i = 0; i < settled.length; i++) {
      const entry = settled[i]!;
      const jobMeta = r.jobs[i]!;
      if (entry.status === "fulfilled") {
        results.push(entry.value);
        continue;
      }
      hardFail++;
      const msg =
        entry.reason instanceof LanzaApiError
          ? entry.reason.message
          : entry.reason instanceof Error
            ? entry.reason.message
            : String(entry.reason);
      results.push(erroConsultaParcial(jobMeta.fonte, msg, opts.placa, opts.frota));
    }

    const merged = mergeConsultaPortais(results);
    if (hardFail === r.jobs.length) {
      throw new LanzaApiError(500, "Todos os portais falharam na consulta.");
    }
    return merged;
  }

  if (r.jobId) {
    const label = PORTAL_JOB_LABEL[fonte] ?? fonte;
    opts.onProgress?.(`${label} em background…`);
    return aguardarSyncJob(r.jobId, { label, onProgress: opts.onProgress });
  }

  if (!r.data) throw new LanzaApiError(500, "Resposta da API sem dados.");
  return r.data;
}
