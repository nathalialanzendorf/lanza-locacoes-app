import { useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { NativeSelect } from "@/components/EntitySelects";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl, formatPlaca } from "@/lib/format";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";

type FiltroSituacao = "em_aberto" | "todos";

type PortalItem = {
  id: string;
  ref?: string;
  descricao: string;
  local?: string | null;
  data?: string | null;
  valor: number;
  situacao: string;
  emAberto?: boolean;
  fonte?: string;
};

type PortalSecao = {
  total: number;
  valorTotal: number;
  items: PortalItem[];
  error?: string;
  avisos?: string[];
};

type ConsultaResultado = {
  placa: string;
  renavam?: string | null;
  ufRegistro?: string | null;
  veiculoCadastrado: boolean;
  detran: PortalSecao;
  pedagio: PortalSecao;
  estacionamento: PortalSecao;
};

function compactPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function compactRenavam(renavam: string): string {
  return renavam.replace(/\D/g, "");
}

function buscaValida(placaInput: string, renavamInput: string): boolean {
  return compactPlaca(placaInput).length >= 7 || compactRenavam(renavamInput).length >= 9;
}

function situacaoBadge(text: string, emAberto?: boolean): { text: string; className: string } {
  const raw = text.toLowerCase();
  if (emAberto === false || /pago|quitad/.test(raw)) {
    return { text, className: "badge badge--ok" };
  }
  if (emAberto === true || /aberto|vencid|atrasad|notificad/.test(raw)) {
    return { text, className: "badge badge--warn" };
  }
  return { text: text || "—", className: "badge badge--muted" };
}

function SecaoPortal({
  titulo,
  origem,
  secao,
  loading,
  colData,
}: {
  titulo: string;
  origem: string;
  secao?: PortalSecao;
  loading?: boolean;
  colData: string;
}) {
  const items = secao?.items ?? [];
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
        emptyMessage={
          secao?.error ? "Consulta indisponível." : `Nenhum registo no portal (${titulo}).`
        }
        columns={[
          {
            key: "ref",
            header: "Ref.",
            sortValue: (r) => r.ref ?? r.id,
            render: (r) => <strong>{r.ref ?? r.id}</strong>,
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (r) => r.descricao,
            render: (r) => (
              <span className="infracao-desc" title={r.descricao}>
                {r.descricao}
              </span>
            ),
          },
          {
            key: "local",
            header: "Local",
            sortValue: (r) => r.local ?? "",
            render: (r) => r.local ?? "—",
          },
          {
            key: "data",
            header: colData,
            sortValue: (r) => r.data ?? "",
            render: (r) => r.data ?? "—",
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (r) => r.valor,
            render: (r) => (r.valor > 0 ? formatBrl(r.valor) : "—"),
          },
          {
            key: "situacao",
            header: "Situação",
            sortValue: (r) => r.situacao,
            render: (r) => {
              const s = situacaoBadge(r.situacao, r.emAberto);
              return <span className={s.className}>{s.text}</span>;
            },
          },
        ]}
      />
    </section>
  );
}

export function RelatorioVeiculoDadosSection() {
  const [placaInput, setPlacaInput] = useState("");
  const [renavamInput, setRenavamInput] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("em_aberto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null);

  async function buscar() {
    if (!buscaValida(placaInput, renavamInput)) {
      setError("Informe a placa (7 caracteres) ou o renavam (9+ dígitos).");
      return;
    }
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await lanzaApi.consultarVeiculoPortais({
        placa: placaInput.trim() || undefined,
        renavam: renavamInput.trim() || undefined,
        status: situacao,
      });
      setResultado(r.data);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portais.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Consulta por veículo</h2>
        <p className="field__hint">
          Consulta live nos portais DETRAN, Pedágio Digital e SigaPay — não usa dados do banco
          local. Informe placa e/ou renavam (DETRAN exige renavam quando o veículo não está
          cadastrado na frota).
        </p>
        <div className="form-grid">
          <FieldLike label="Placa" hint="Ex.: ABC1D23 ou ABC-1234">
            <input
              className="input"
              type="text"
              value={placaInput}
              onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") void buscar();
              }}
              placeholder="Digite a placa"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </FieldLike>
          <FieldLike label="Renavam" hint="Obrigatório para DETRAN se placa não estiver na frota">
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={renavamInput}
              onChange={(e) => setRenavamInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void buscar();
              }}
              placeholder="Somente números"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </FieldLike>
          <FieldLike label="Situação">
            <NativeSelect
              value={situacao}
              onChange={(v) => setSituacao(v as FiltroSituacao)}
              variant="filtro"
              allowEmpty={false}
              disabled={loading}
              aria-label="Situação"
            >
              <option value="em_aberto">Em aberto</option>
              <option value="todos">{SELECT_LABEL_TODOS}</option>
            </NativeSelect>
          </FieldLike>
        </div>
        <div className="form-card__action-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void buscar()}
            disabled={loading || !buscaValida(placaInput, renavamInput)}
          >
            {loading ? "Consultando portais…" : "Buscar nos portais"}
          </button>
        </div>
        {error ? <p className="form-card__error">{error}</p> : null}
      </section>

      {!resultado && !loading ? (
        <p className="muted">Digite placa e/ou renavam e clique em Buscar nos portais.</p>
      ) : null}

      {resultado ? (
        <>
          <section className="form-card veiculo-dados-veiculo">
            <h2 className="form-card__title">Identificação</h2>
            <dl className="veiculo-dados-resumo">
              <div>
                <dt>Placa</dt>
                <dd>
                  <strong>{formatPlaca(resultado.placa)}</strong>
                </dd>
              </div>
              <div>
                <dt>Renavam</dt>
                <dd>{resultado.renavam ?? "—"}</dd>
              </div>
              <div>
                <dt>UF registro</dt>
                <dd>{resultado.ufRegistro ?? "—"}</dd>
              </div>
              <div>
                <dt>Frota Lanza</dt>
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
            </dl>
          </section>

          <SecaoPortal
            titulo="DETRAN — infrações"
            origem="Portal DETRAN (consulta live)"
            secao={resultado.detran}
            loading={loading}
            colData="Autuação"
          />
          <SecaoPortal
            titulo="Pedágio Digital"
            origem="Portal Pedágio Digital"
            secao={resultado.pedagio}
            loading={loading}
            colData="Passagem"
          />
          <SecaoPortal
            titulo="SigaPay — estacionamento rotativo"
            origem="Portal SigaPay"
            secao={resultado.estacionamento}
            loading={loading}
            colData="Aviso"
          />
        </>
      ) : null}
    </>
  );
}

function FieldLike({
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
