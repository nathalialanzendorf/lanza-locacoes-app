import { useEffect, useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError, getApiBaseUrl, getStoredApiKey } from "@/api/client";
import { getStoredToken } from "@/api/authClient";
import type {
  DetranScCapturaState,
  DetranScSessaoStatus,
  VeiculoConsultaFonte,
  VeiculoConsultaPortaisResultado,
} from "@/api/types";
import {
  bridgeCapturaIniciar,
  bridgeCapturaStatus,
  bridgeHealth,
  bridgeStartHint,
} from "@/lib/detranScCaptureBridge";
import { formatBrl, formatPlaca } from "@/lib/format";

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

const PORTAIS_EXTERNOS = {
  detranSc: {
    label: "DETRAN SC",
    url: "https://servicos.detran.sc.gov.br/",
  },
  detranRs: {
    label: "DETRAN RS",
    url: "https://pcsdetran.rs.gov.br/",
  },
  pedagio: {
    label: "Pedágio Digital",
    url: "https://pedagiodigital.com/",
  },
  sigapay: {
    label: "SigaPay",
    url: "https://sigapay.com.br/",
  },
} as const;

const FONTES_CONSULTA: {
  id: VeiculoConsultaFonte;
  label: string;
  hint: string;
  portalKey: keyof typeof PORTAIS_EXTERNOS;
  titulo: string;
  origem: string;
  colData: string;
}[] = [
  {
    id: "detran-sc",
    label: "DETRAN SC",
    hint: "Gov.br · débitos em aberto",
    portalKey: "detranSc",
    titulo: "DETRAN SC — infrações",
    origem: "Portal DETRAN SC (consulta live)",
    colData: "Autuação",
  },
  {
    id: "detran-rs",
    label: "DETRAN RS",
    hint: "Gov.br · débitos em aberto",
    portalKey: "detranRs",
    titulo: "DETRAN RS — infrações",
    origem: "Portal DETRAN RS (consulta live)",
    colData: "Autuação",
  },
  {
    id: "pedagio",
    label: "Pedágio Digital",
    hint: "CPF e senha · passagens em aberto",
    portalKey: "pedagio",
    titulo: "Pedágio Digital",
    origem: "Portal Pedágio Digital",
    colData: "Passagem",
  },
  {
    id: "sigapay",
    label: "SigaPay",
    hint: "Conta SigaPay · avisos em aberto",
    portalKey: "sigapay",
    titulo: "SigaPay — estacionamento rotativo",
    origem: "Portal SigaPay",
    colData: "Aviso",
  },
];

function compactPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function compactRenavam(renavam: string): string {
  return renavam.replace(/\D/g, "");
}

function buscaValida(placaInput: string, renavamInput: string): boolean {
  return compactPlaca(placaInput).length >= 7 || compactRenavam(renavamInput).length >= 9;
}

function abrirPortal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function secaoPorFonte(
  resultado: VeiculoConsultaPortaisResultado,
  fonte: VeiculoConsultaFonte,
): PortalSecao | undefined {
  switch (fonte) {
    case "detran-sc":
      return resultado.detranSc;
    case "detran-rs":
      return resultado.detranRs;
    case "pedagio":
      return resultado.pedagio;
    case "sigapay":
      return resultado.estacionamento;
  }
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
  portaisManual,
}: {
  titulo: string;
  origem: string;
  secao?: PortalSecao;
  loading?: boolean;
  colData: string;
  portaisManual?: readonly { label: string; url: string }[];
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
      {secao?.error ? (
        <p className="form-card__error">
          {secao.error}
          {portaisManual?.length ? (
            <>
              {" "}
              Consulte manualmente:{" "}
              {portaisManual.map((p, i) => (
                <span key={p.url}>
                  {i > 0 ? " · " : null}
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.label}
                  </a>
                </span>
              ))}
            </>
          ) : null}
        </p>
      ) : null}
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
  const [fonte, setFonte] = useState<VeiculoConsultaFonte>("detran-sc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<VeiculoConsultaPortaisResultado | null>(null);
  const [detranScSessao, setDetranScSessao] = useState<DetranScSessaoStatus | null>(null);
  const [captura, setCaptura] = useState<DetranScCapturaState | null>(null);
  const [bridgeAtivo, setBridgeAtivo] = useState<boolean | null>(null);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [detranScAuthInput, setDetranScAuthInput] = useState("");
  const [detranScEmpresaInput, setDetranScEmpresaInput] = useState("");
  const [sessaoLoading, setSessaoLoading] = useState(false);
  const [sessaoMsg, setSessaoMsg] = useState<string | null>(null);
  const [sessaoError, setSessaoError] = useState<string | null>(null);

  const fonteConfig = FONTES_CONSULTA.find((f) => f.id === fonte) ?? FONTES_CONSULTA[0];
  const portalSelecionado = PORTAIS_EXTERNOS[fonteConfig.portalKey];
  const detranSelecionado = fonte === "detran-sc" || fonte === "detran-rs";
  const capturaEmCurso = captura?.status === "starting" || captura?.status === "waiting";

  async function recarregarSessaoDetranSc() {
    const r = await lanzaApi.statusDetranScSessao();
    setDetranScSessao(r.data);
    if (r.data.empresa) {
      setDetranScEmpresaInput((prev) => prev || r.data.empresa || "");
    }
  }

  useEffect(() => {
    if (fonte !== "detran-sc") return;
    let cancelled = false;
    void (async () => {
      setSessaoLoading(true);
      setSessaoError(null);
      try {
        const bridge = await bridgeHealth();
        if (!cancelled) setBridgeAtivo(bridge);
        await recarregarSessaoDetranSc();
      } catch (err) {
        if (!cancelled) {
          setSessaoError(
            err instanceof LanzaApiError ? err.message : "Falha ao carregar sessão DETRAN SC.",
          );
        }
      } finally {
        if (!cancelled) setSessaoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fonte]);

  useEffect(() => {
    if (fonte !== "detran-sc" || !capturaEmCurso) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          let estado: DetranScCapturaState | null = null;
          if (bridgeAtivo) {
            estado = await bridgeCapturaStatus();
          } else {
            const r = await lanzaApi.statusCapturaDetranSc();
            estado = r.data;
          }
          if (!estado) return;
          setCaptura(estado);
          if (estado.status === "captured") {
            setSessaoMsg(estado.message ?? "Sessão capturada.");
            await recarregarSessaoDetranSc();
          } else if (estado.status === "error") {
            setSessaoError(estado.message ?? "Falha na captura.");
          }
        } catch {
          /* polling silencioso */
        }
      })();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [fonte, capturaEmCurso, bridgeAtivo]);

  async function iniciarCapturaAutomatica() {
    setSessaoLoading(true);
    setSessaoError(null);
    setSessaoMsg(null);
    try {
      const apiUrl =
        getApiBaseUrl().trim() || "https://api.lanzalocacoes.vercel.app";
      const bridgeOpts = {
        apiUrl,
        bearer: getStoredToken().trim() || undefined,
        apiKey: getStoredApiKey().trim() || undefined,
      };

      let data: DetranScCapturaState | null = null;
      const bridge = bridgeAtivo ?? (await bridgeHealth());
      setBridgeAtivo(bridge);

      if (bridge) {
        data = await bridgeCapturaIniciar(bridgeOpts);
        if (!data) {
          throw new Error("Bridge local respondeu mas não iniciou a captura.");
        }
      } else {
        try {
          const r = await lanzaApi.iniciarCapturaDetranSc();
          data = r.data;
        } catch (err) {
          if (err instanceof LanzaApiError && err.status === 501) {
            throw new Error(
              `Bridge local não detectado. ${bridgeStartHint()} — depois clique em Capturar sessão automaticamente.`,
            );
          }
          throw err;
        }
      }

      setCaptura(data);
      setSessaoMsg(
        data.message ??
          "Chrome aberto — faça login Gov.br; o token será enviado à API após a primeira consulta.",
      );
    } catch (err) {
      setSessaoError(
        err instanceof LanzaApiError ? err.message : err instanceof Error ? err.message : "Falha.",
      );
    } finally {
      setSessaoLoading(false);
    }
  }

  async function gravarSessaoDetranSc() {
    setSessaoLoading(true);
    setSessaoError(null);
    setSessaoMsg(null);
    try {
      const r = await lanzaApi.gravarDetranScSessao({
        auth: detranScAuthInput.trim(),
        empresa: detranScEmpresaInput.trim(),
      });
      setDetranScSessao(r.data);
      setDetranScAuthInput("");
      setSessaoMsg("Sessão DETRAN SC guardada no servidor.");
    } catch (err) {
      setSessaoError(err instanceof LanzaApiError ? err.message : "Falha ao guardar sessão.");
    } finally {
      setSessaoLoading(false);
    }
  }

  async function removerSessaoDetranSc() {
    setSessaoLoading(true);
    setSessaoError(null);
    setSessaoMsg(null);
    try {
      await lanzaApi.removerDetranScSessao();
      setDetranScSessao({ configured: false, origem: "store" });
      setDetranScAuthInput("");
      setSessaoMsg("Sessão DETRAN SC removida.");
    } catch (err) {
      setSessaoError(err instanceof LanzaApiError ? err.message : "Falha ao remover sessão.");
    } finally {
      setSessaoLoading(false);
    }
  }

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
        fonte,
      });
      setResultado(r.data);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Consulta por veículo</h2>
        <p className="field__hint">
          Consulta live em um portal por vez — não usa dados do banco local. Informe placa e/ou
          renavam (DETRAN exige renavam quando o veículo não está cadastrado na frota).
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
          <FieldLike
            label="Renavam"
            hint={
              detranSelecionado
                ? "Obrigatório para DETRAN se placa não estiver na frota"
                : "Opcional — usado para identificar veículo na frota"
            }
          >
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
        </div>

        <fieldset className="field veiculo-dados-fontes">
          <legend className="field__label">Órgão / portal</legend>
          <p className="field__hint">Escolha onde consultar débitos em aberto.</p>
          <div className="radio-group">
            {FONTES_CONSULTA.map((opt) => (
              <label key={opt.id} className="radio-option">
                <input
                  type="radio"
                  name="fonte-consulta-veiculo"
                  value={opt.id}
                  checked={fonte === opt.id}
                  onChange={() => setFonte(opt.id)}
                  disabled={loading}
                />
                <span className="radio-option__text">
                  <strong>{opt.label}</strong>
                  <span className="radio-option__hint">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {fonte === "detran-sc" ? (
          <section className="form-section veiculo-dados-sessao">
            <h3 className="form-section-title">Sessão DETRAN SC</h3>
            <p className="field__hint">
              A captura abre o Chrome no portal oficial, escuta a rede e grava o JWT no servidor
              automaticamente — sem copiar do DevTools. Com certificado A1 no Windows, o login
              Gov.br costuma ser quase automático. O perfil fica em cache para renovações (~5 h).
            </p>
            {bridgeAtivo ? (
              <p className="field__hint">
                <span className="badge badge--ok">Bridge local ativo</span> — captura via máquina
                local.
              </p>
            ) : null}
            {detranScSessao?.configured ? (
              <p className="field__hint">
                <span className="badge badge--ok">Configurada</span>
                {detranScSessao.origem === "env" ? " (variáveis de ambiente do servidor)" : null}
                {detranScSessao.authPreview ? ` · token ${detranScSessao.authPreview}` : null}
                {detranScSessao.empresa ? ` · empresa ${detranScSessao.empresa}` : null}
                {detranScSessao.updatedAt && detranScSessao.updatedAt !== new Date(0).toISOString()
                  ? ` · atualizada ${new Date(detranScSessao.updatedAt).toLocaleString("pt-BR")}`
                  : null}
              </p>
            ) : (
              <p className="field__hint">
                <span className="badge badge--warn">Não configurada</span> — inicie a captura antes
                de consultar.
              </p>
            )}
            {captura?.message && capturaEmCurso ? (
              <p className="field__hint">{captura.message}</p>
            ) : null}
            {detranScSessao?.origem !== "env" ? (
              <div className="form-card__action-row">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void iniciarCapturaAutomatica()}
                  disabled={loading || sessaoLoading || capturaEmCurso}
                >
                  {sessaoLoading
                    ? "A iniciar…"
                    : capturaEmCurso
                      ? "Capturando…"
                      : "Capturar sessão automaticamente"}
                </button>
                {detranScSessao?.configured && detranScSessao.origem === "store" ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void removerSessaoDetranSc()}
                    disabled={loading || sessaoLoading || capturaEmCurso}
                  >
                    Remover sessão
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setMostrarManual((v) => !v)}
                  disabled={loading || sessaoLoading}
                >
                  {mostrarManual ? "Ocultar colagem manual" : "Colagem manual"}
                </button>
              </div>
            ) : null}
            {mostrarManual && detranScSessao?.origem !== "env" ? (
              <>
                <div className="form-grid">
                  <FieldLike label="Token JWT (Authorization)" hint="Cole com ou sem prefixo Bearer">
                    <input
                      className="input"
                      type="password"
                      value={detranScAuthInput}
                      onChange={(e) => setDetranScAuthInput(e.target.value)}
                      placeholder="eyJhbG…"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={loading || sessaoLoading}
                    />
                  </FieldLike>
                  <FieldLike label="X-Empresa" hint="Header X-Empresa do mesmo pedido">
                    <input
                      className="input"
                      type="text"
                      value={detranScEmpresaInput}
                      onChange={(e) => setDetranScEmpresaInput(e.target.value)}
                      placeholder="Identificador da empresa"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={loading || sessaoLoading}
                    />
                  </FieldLike>
                </div>
                <div className="form-card__action-row">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => void gravarSessaoDetranSc()}
                    disabled={
                      loading ||
                      sessaoLoading ||
                      !detranScAuthInput.trim() ||
                      !detranScEmpresaInput.trim()
                    }
                  >
                    Guardar sessão manualmente
                  </button>
                </div>
              </>
            ) : null}
            {sessaoMsg ? <p className="field__hint">{sessaoMsg}</p> : null}
            {sessaoError ? <p className="form-card__error">{sessaoError}</p> : null}
          </section>
        ) : null}

        <div className="form-card__action-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void buscar()}
            disabled={loading || !buscaValida(placaInput, renavamInput)}
          >
            {loading ? "Consultando portal…" : `Buscar em ${fonteConfig.label}`}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => abrirPortal(portalSelecionado.url)}
            disabled={loading}
          >
            Abrir {fonteConfig.label}
          </button>
        </div>
        <p className="field__hint">
          O botão &quot;Abrir&quot; lança uma nova aba para login e consulta manual. A busca
          automática usa credenciais configuradas no servidor — não compartilha a sessão do seu
          navegador.
        </p>
        {error ? <p className="form-card__error">{error}</p> : null}
      </section>

      {!resultado && !loading ? (
        <p className="muted">Digite placa e/ou renavam, escolha o portal e clique em Buscar.</p>
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
              <div>
                <dt>Portal consultado</dt>
                <dd>{fonteConfig.label}</dd>
              </div>
            </dl>
          </section>

          <SecaoPortal
            titulo={fonteConfig.titulo}
            origem={fonteConfig.origem}
            secao={secaoPorFonte(resultado, resultado.fonte)}
            loading={loading}
            colData={fonteConfig.colData}
            portaisManual={[portalSelecionado]}
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
