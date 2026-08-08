import type { ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import type { VeiculoConsultaPortaisResultado } from "@/api/types";
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
        <p key={a} className="field__hint">
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
