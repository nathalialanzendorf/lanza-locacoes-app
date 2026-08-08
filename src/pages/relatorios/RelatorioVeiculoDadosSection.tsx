import { useEffect, useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect } from "@/components/EntitySelects";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError, getApiBaseUrl, getStoredApiKey } from "@/api/client";
import { getStoredToken } from "@/api/authClient";
import type {
  DetranScCapturaState,
  DetranScSessaoStatus,
  VeiculoConsultaPortaisResultado,
} from "@/api/types";
import {
  bridgeCapturaIniciar,
  bridgeCapturaStatus,
  bridgeHealth,
  bridgeStartHint,
} from "@/lib/detranScCaptureBridge";
import { formatBrl, formatPlaca } from "@/lib/format";
import { SyncJobsTable } from "@/pages/sync/syncShared";

type PortalItem = {
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

type PortalSecao = {
  total: number;
  valorTotal: number;
  items: PortalItem[];
  error?: string;
  avisos?: string[];
};

import {
  DETRAN_SC_GOV_CERT_LOGIN_URL,
  DETRAN_SC_PORTAL_URL,
} from "@/lib/detranScPortais";

const PORTAIS_EXTERNOS = {
  detranSc: {
    label: "DETRAN SC",
    url: DETRAN_SC_PORTAL_URL,
    govCertUrl: DETRAN_SC_GOV_CERT_LOGIN_URL,
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

const SECOES_PORTAL: {
  key: keyof Pick<
    VeiculoConsultaPortaisResultado,
    "detranSc" | "detranRs" | "pedagio" | "estacionamento"
  >;
  label: string;
  portalKey: keyof typeof PORTAIS_EXTERNOS;
  titulo: string;
  origem: string;
  colData: string;
}[] = [
  {
    key: "detranSc",
    label: "DETRAN SC",
    portalKey: "detranSc",
    titulo: "DETRAN SC — infrações",
    origem: "Portal DETRAN SC (consulta live)",
    colData: "Autuação",
  },
  {
    key: "detranRs",
    label: "DETRAN RS",
    portalKey: "detranRs",
    titulo: "DETRAN RS — infrações",
    origem: "Portal DETRAN RS (consulta live)",
    colData: "Autuação",
  },
  {
    key: "pedagio",
    label: "Pedágio Digital",
    portalKey: "pedagio",
    titulo: "Pedágio Digital",
    origem: "Portal Pedágio Digital",
    colData: "Passagem",
  },
  {
    key: "estacionamento",
    label: "SigaPay",
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

function buscaFrota(placaInput: string, renavamInput: string): boolean {
  return !compactPlaca(placaInput) && !compactRenavam(renavamInput);
}

function buscaValida(placaInput: string, renavamInput: string): boolean {
  return buscaFrota(placaInput, renavamInput) || compactPlaca(placaInput).length >= 7 || compactRenavam(renavamInput).length >= 9;
}

function abrirPortal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
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
  mostrarPlaca = false,
}: {
  titulo: string;
  origem: string;
  secao?: PortalSecao;
  loading?: boolean;
  colData: string;
  portaisManual?: readonly { label: string; url: string }[];
  mostrarPlaca?: boolean;
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
        columns={columns}
      />
    </section>
  );
}

export function RelatorioVeiculoDadosSection() {
  const [placaInput, setPlacaInput] = useState("");
  const [renavamInput, setRenavamInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
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

  const consultaFrota = buscaFrota(placaInput, renavamInput);
  const capturaEmCurso = captura?.status === "starting" || captura?.status === "waiting";

  async function recarregarSessaoDetranSc() {
    const r = await lanzaApi.statusDetranScSessao();
    setDetranScSessao(r.data);
    if (r.data.empresa) {
      setDetranScEmpresaInput((prev) => prev || r.data.empresa || "");
    }
  }

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!capturaEmCurso) return;
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
  }, [capturaEmCurso, bridgeAtivo]);

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
      setError("Informe a placa (7 caracteres), o renavam (9+ dígitos) ou deixe vazio para consultar a frota.");
      return;
    }
    setLoading(true);
    setLoadingHint(
      consultaFrota
        ? "Consultando frota nos 4 portais — pode demorar alguns minutos (DETRAN consulta veículo a veículo)…"
        : "Consultando DETRAN SC, DETRAN RS, Pedágio Digital e SigaPay…",
    );
    setError(null);
    setResultado(null);
    try {
      const r = await lanzaApi.consultarVeiculoPortais({
        placa: placaInput.trim() || undefined,
        renavam: renavamInput.trim() || undefined,
      });
      setResultado(r.data);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portais.");
    } finally {
      setLoading(false);
      setLoadingHint(null);
    }
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Consulta por veículo</h2>
        <p className="field__hint">
          Consulta live em todos os portais — não usa dados do banco local. Deixe placa e renavam
          vazios para buscar <strong>toda a frota activa</strong>, ou informe um veículo específico
          (DETRAN exige renavam quando não está cadastrado na frota).
        </p>
        <div className="form-grid">
          <FieldLike label="Placa" hint="Vazio = frota activa inteira">
            <VeiculoSelect
              value={placaInput}
              onChange={setPlacaInput}
              allowEmpty
              ativo
              emptyLabel="Toda a frota activa"
              disabled={loading}
            />
          </FieldLike>
          <FieldLike
            label="Renavam"
            hint={
              consultaFrota
                ? "Opcional na consulta da frota"
                : "Obrigatório para DETRAN se placa não estiver na frota"
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

        <section className="form-section veiculo-dados-sessao">
            <h3 className="form-section-title">Sessão DETRAN SC</h3>
            <p className="field__hint">
              Login Gov.br do DETRAN SC (certificado A1):{" "}
              <a href={DETRAN_SC_GOV_CERT_LOGIN_URL} target="_blank" rel="noopener noreferrer">
                certificado.sso.acesso.gov.br
              </a>
              . Se aparecer erro de link expirado, abra primeiro o{" "}
              <a href={DETRAN_SC_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                portal DETRAN
              </a>{" "}
              e clique em Entrar com gov.br — o{" "}
              <code>authorization_id</code> muda a cada sessão.
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
                  onClick={() => abrirPortal(DETRAN_SC_GOV_CERT_LOGIN_URL)}
                  disabled={loading || sessaoLoading || capturaEmCurso}
                >
                  Abrir login Gov.br (certificado)
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => abrirPortal(DETRAN_SC_PORTAL_URL)}
                  disabled={loading || sessaoLoading || capturaEmCurso}
                >
                  Abrir portal DETRAN SC
                </button>
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

        <div className="form-card__action-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void buscar()}
            disabled={loading || !buscaValida(placaInput, renavamInput)}
          >
            {loading
              ? "Consultando portais…"
              : consultaFrota
                ? "Buscar frota nos portais"
                : "Buscar nos portais"}
          </button>
        </div>
        <p className="field__hint">
          A busca consulta DETRAN SC, DETRAN RS, Pedágio Digital e SigaPay em paralelo, usando
          credenciais configuradas no servidor.
        </p>
        {loadingHint ? <p className="field__hint">{loadingHint}</p> : null}
        {error ? <p className="form-card__error">{error}</p> : null}
      </section>

      {!resultado && !loading ? (
        <p className="muted">
          Clique em Buscar — vazio consulta toda a frota activa em todos os portais.
        </p>
      ) : null}

      {resultado ? (
        <>
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
                </>
              ) : null}
              <div>
                <dt>Portais</dt>
                <dd>Todos (DETRAN SC, DETRAN RS, Pedágio, SigaPay)</dd>
              </div>
            </dl>
          </section>

          {SECOES_PORTAL.map((sec) => (
            <SecaoPortal
              key={sec.key}
              titulo={sec.titulo}
              origem={sec.origem}
              secao={resultado[sec.key]}
              loading={loading}
              colData={sec.colData}
              portaisManual={[PORTAIS_EXTERNOS[sec.portalKey]]}
              mostrarPlaca={resultado.modo === "frota"}
            />
          ))}
        </>
      ) : null}

      <SyncJobsTable title="Jobs recentes (todas as integrações)" />
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
