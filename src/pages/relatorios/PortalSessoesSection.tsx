import { useEffect, useState, type ReactNode } from "react";

import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError, getApiBaseUrl, getStoredApiKey } from "@/api/client";
import { getStoredToken } from "@/api/authClient";
import type {
  DetranRsSessaoStatus,
  DetranScSessaoStatus,
  PedagioSessaoStatus,
  PortalCapturaState,
  SigapaySessaoStatus,
} from "@/api/types";
import {
  bridgeCapturaIniciar as detranScBridgeIniciar,
  bridgeCapturaStatus as detranScBridgeStatus,
  bridgeHealth as detranScBridgeHealth,
  bridgeStartHint as detranScBridgeHint,
} from "@/lib/detranScCaptureBridge";
import {
  detranRsBridgeCapturaIniciar,
  detranRsBridgeCapturaStatus,
  detranRsBridgeHealth,
  detranRsBridgeStartHint,
} from "@/lib/detranRsCaptureBridge";
import {
  pedagioBridgeCapturaIniciar,
  pedagioBridgeCapturaStatus,
  pedagioBridgeHealth,
  pedagioBridgeStartHint,
} from "@/lib/pedagioCaptureBridge";
import {
  sigapayBridgeCapturaIniciar,
  sigapayBridgeCapturaStatus,
  sigapayBridgeHealth,
  sigapayBridgeStartHint,
} from "@/lib/sigapayCaptureBridge";
import {
  DETRAN_SC_GOV_CERT_LOGIN_URL,
  DETRAN_SC_PORTAL_URL,
} from "@/lib/detranScPortais";

type SessaoStatus =
  | DetranScSessaoStatus
  | DetranRsSessaoStatus
  | PedagioSessaoStatus
  | SigapaySessaoStatus;

type PortalApi = {
  statusSessao: () => Promise<{ data: SessaoStatus }>;
  gravarSessao: (body: Record<string, string>) => Promise<{ data: SessaoStatus }>;
  removerSessao: () => Promise<unknown>;
  iniciarCaptura: () => Promise<{ data: PortalCapturaState }>;
  statusCaptura: () => Promise<{ data: PortalCapturaState }>;
};

type BridgeApi = {
  health: () => Promise<boolean>;
  capturaStatus: () => Promise<PortalCapturaState | null>;
  capturaIniciar: (opts: {
    apiUrl: string;
    bearer?: string;
    apiKey?: string;
  }) => Promise<PortalCapturaState | null>;
  startHint: string;
};

function abrirPortal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
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

function PortalSessaoPanel({
  titulo,
  descricao,
  portalUrl,
  portalLabel,
  extraLinks,
  disabled,
  api,
  bridge,
  renderStatus,
  renderManualFields,
  canGravarManual,
  onGravarManual,
  waitingMessage,
}: {
  titulo: string;
  descricao: ReactNode;
  portalUrl: string;
  portalLabel: string;
  extraLinks?: ReactNode;
  disabled?: boolean;
  api: PortalApi;
  bridge: BridgeApi;
  renderStatus: (sessao: SessaoStatus | null) => ReactNode;
  renderManualFields: (props: {
    values: Record<string, string>;
    setValue: (key: string, value: string) => void;
    disabled: boolean;
  }) => ReactNode;
  canGravarManual: (values: Record<string, string>) => boolean;
  onGravarManual: (values: Record<string, string>) => Record<string, string>;
  waitingMessage: string;
}) {
  const [sessao, setSessao] = useState<SessaoStatus | null>(null);
  const [captura, setCaptura] = useState<PortalCapturaState | null>(null);
  const [bridgeAtivo, setBridgeAtivo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [manual, setManual] = useState<Record<string, string>>({});

  const capturaEmCurso = captura?.status === "starting" || captura?.status === "waiting";

  async function recarregarSessao() {
    const r = await api.statusSessao();
    setSessao(r.data);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const ok = await bridge.health();
        if (!cancelled) setBridgeAtivo(ok);
        await recarregarSessao();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof LanzaApiError ? err.message : `Falha ao carregar sessão ${titulo}.`);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
          let estado: PortalCapturaState | null = null;
          if (bridgeAtivo) {
            estado = await bridge.capturaStatus();
          } else {
            const r = await api.statusCaptura();
            estado = r.data;
          }
          if (!estado) return;
          setCaptura(estado);
          if (estado.status === "captured") {
            setMsg(estado.message ?? "Sessão capturada.");
            await recarregarSessao();
          } else if (estado.status === "error") {
            setError(estado.message ?? "Falha na captura.");
          }
        } catch {
          /* polling silencioso */
        }
      })();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [capturaEmCurso, bridgeAtivo]);

  async function iniciarCaptura() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const apiUrl = getApiBaseUrl().trim() || "https://api.lanzalocacoes.vercel.app";
      const opts = {
        apiUrl,
        bearer: getStoredToken().trim() || undefined,
        apiKey: getStoredApiKey().trim() || undefined,
      };
      const ok = bridgeAtivo ?? (await bridge.health());
      setBridgeAtivo(ok);

      let data: PortalCapturaState | null = null;
      if (ok) {
        data = await bridge.capturaIniciar(opts);
        if (!data) throw new Error("Bridge local respondeu mas não iniciou a captura.");
      } else {
        try {
          const r = await api.iniciarCaptura();
          data = r.data;
        } catch (err) {
          if (err instanceof LanzaApiError && err.status === 501) {
            throw new Error(
              `Bridge local não detectado. ${bridge.startHint} — depois clique em Capturar sessão.`,
            );
          }
          throw err;
        }
      }

      setCaptura(data);
      setMsg(data.message ?? waitingMessage);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : err instanceof Error ? err.message : "Falha.");
    } finally {
      setLoading(false);
    }
  }

  async function gravarManual() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const body = onGravarManual(manual);
      const r = await api.gravarSessao(body);
      setSessao(r.data);
      setManual({});
      setMsg(`Sessão ${titulo} guardada no servidor.`);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao guardar sessão.");
    } finally {
      setLoading(false);
    }
  }

  async function removerSessao() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      await api.removerSessao();
      setSessao({ configured: false, origem: "store" });
      setManual({});
      setMsg(`Sessão ${titulo} removida.`);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao remover sessão.");
    } finally {
      setLoading(false);
    }
  }

  const bloqueado = Boolean(disabled || loading || capturaEmCurso);
  const origemEnv = sessao?.origem === "env";

  return (
    <section className="form-section veiculo-dados-sessao">
      <h3 className="form-section-title">{titulo}</h3>
      <p className="field__hint">{descricao}</p>
      {bridgeAtivo ? (
        <p className="field__hint">
          <span className="badge badge--ok">Bridge local ativo</span>
        </p>
      ) : null}
      {renderStatus(sessao)}
      {captura?.message && capturaEmCurso ? <p className="field__hint">{captura.message}</p> : null}
      {!origemEnv ? (
        <>
          <div className="form-card__action-row">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => void iniciarCaptura()}
              disabled={bloqueado}
            >
              {loading ? "A iniciar…" : capturaEmCurso ? "Capturando…" : "Capturar sessão automaticamente"}
            </button>
            {sessao?.configured && sessao.origem === "store" ? (
              <button type="button" className="btn btn--ghost" onClick={() => void removerSessao()} disabled={bloqueado}>
                Remover sessão
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={() => abrirPortal(portalUrl)} disabled={bloqueado}>
              Abrir {portalLabel}
            </button>
            {extraLinks}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setMostrarManual((v) => !v)}
              disabled={Boolean(disabled || loading)}
            >
              {mostrarManual ? "Ocultar colagem manual" : "Colagem manual"}
            </button>
          </div>
          {mostrarManual ? (
            <>
              <div className="form-grid">
                {renderManualFields({
                  values: manual,
                  setValue: (key, value) => setManual((prev) => ({ ...prev, [key]: value })),
                  disabled: Boolean(disabled || loading),
                })}
              </div>
              <div className="form-card__action-row">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void gravarManual()}
                  disabled={Boolean(disabled || loading || !canGravarManual(manual))}
                >
                  Guardar sessão manualmente
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {msg ? <p className="field__hint">{msg}</p> : null}
      {error ? <p className="form-card__error">{error}</p> : null}
    </section>
  );
}

export function DetranScSessaoPanel({ disabled }: { disabled?: boolean }) {
  return (
    <PortalSessaoPanel
        titulo="Sessão DETRAN SC"
        portalUrl={DETRAN_SC_PORTAL_URL}
        portalLabel="portal DETRAN SC"
        disabled={disabled}
        waitingMessage="Chrome aberto — faça login Gov.br; o token será enviado à API após a consulta."
        descricao={
          <>
            Login Gov.br do DETRAN SC (certificado A1):{" "}
            <a href={DETRAN_SC_GOV_CERT_LOGIN_URL} target="_blank" rel="noopener noreferrer">
              certificado.sso.acesso.gov.br
            </a>
            . Abra o{" "}
            <a href={DETRAN_SC_PORTAL_URL} target="_blank" rel="noopener noreferrer">
              portal DETRAN
            </a>{" "}
            e clique em Entrar com gov.br.
          </>
        }
        extraLinks={
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => abrirPortal(DETRAN_SC_GOV_CERT_LOGIN_URL)}
            disabled={disabled}
          >
            Abrir login Gov.br (certificado)
          </button>
        }
        api={{
          statusSessao: () => lanzaApi.statusDetranScSessao(),
          gravarSessao: (body) =>
            lanzaApi.gravarDetranScSessao({
              auth: body.auth ?? "",
              empresa: body.empresa ?? "",
            }),
          removerSessao: () => lanzaApi.removerDetranScSessao(),
          iniciarCaptura: () => lanzaApi.iniciarCapturaDetranSc(),
          statusCaptura: () => lanzaApi.statusCapturaDetranSc(),
        }}
        bridge={{
          health: detranScBridgeHealth,
          capturaStatus: detranScBridgeStatus,
          capturaIniciar: detranScBridgeIniciar,
          startHint: detranScBridgeHint(),
        }}
        renderStatus={(s) => {
          const sessao = s as DetranScSessaoStatus | null;
          if (sessao?.configured) {
            return (
              <p className="field__hint">
                <span className="badge badge--ok">Configurada</span>
                {sessao.origem === "env" ? " (variáveis de ambiente)" : null}
                {sessao.authPreview ? ` · token ${sessao.authPreview}` : null}
                {sessao.empresa ? ` · empresa ${sessao.empresa}` : null}
                {sessao.updatedAt && sessao.updatedAt !== new Date(0).toISOString()
                  ? ` · ${new Date(sessao.updatedAt).toLocaleString("pt-BR")}`
                  : null}
              </p>
            );
          }
          return (
            <p className="field__hint">
              <span className="badge badge--warn">Não configurada</span>
            </p>
          );
        }}
        renderManualFields={({ values, setValue, disabled: d }) => (
          <>
            <FieldLike label="Token JWT (Authorization)" hint="Cole com ou sem prefixo Bearer">
              <input
                className="input"
                type="password"
                value={values.auth ?? ""}
                onChange={(e) => setValue("auth", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
            <FieldLike label="X-Empresa">
              <input
                className="input"
                type="text"
                value={values.empresa ?? ""}
                onChange={(e) => setValue("empresa", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
          </>
        )}
        canGravarManual={(v) => Boolean(v.auth?.trim() && v.empresa?.trim())}
        onGravarManual={(v) => ({ auth: v.auth!.trim(), empresa: v.empresa!.trim() })}
      />
  );
}

export function DetranRsSessaoPanel({ disabled }: { disabled?: boolean }) {
  return (
    <PortalSessaoPanel
        titulo="Sessão DETRAN RS"
        portalUrl="https://pcsdetran.rs.gov.br/"
        portalLabel="portal DETRAN RS"
        disabled={disabled}
        waitingMessage="Chrome aberto — faça login Gov.br e consulte um veículo RS."
        descricao="Captura Bearer + X-User-Id a partir do portal pcsdetran.rs.gov.br (login Gov.br)."
        api={{
          statusSessao: () => lanzaApi.statusDetranRsSessao(),
          gravarSessao: (body) =>
            lanzaApi.gravarDetranRsSessao({ auth: body.auth ?? "", userId: body.userId ?? "" }),
          removerSessao: () => lanzaApi.removerDetranRsSessao(),
          iniciarCaptura: () => lanzaApi.iniciarCapturaDetranRs(),
          statusCaptura: () => lanzaApi.statusCapturaDetranRs(),
        }}
        bridge={{
          health: detranRsBridgeHealth,
          capturaStatus: detranRsBridgeCapturaStatus,
          capturaIniciar: detranRsBridgeCapturaIniciar,
          startHint: detranRsBridgeStartHint(),
        }}
        renderStatus={(s) => {
          const sessao = s as DetranRsSessaoStatus | null;
          if (sessao?.configured) {
            return (
              <p className="field__hint">
                <span className="badge badge--ok">Configurada</span>
                {sessao.origem === "env" ? " (variáveis de ambiente)" : null}
                {sessao.authPreview ? ` · token ${sessao.authPreview}` : null}
                {sessao.userIdPreview ? ` · userId ${sessao.userIdPreview}` : null}
              </p>
            );
          }
          return (
            <p className="field__hint">
              <span className="badge badge--warn">Não configurada</span>
            </p>
          );
        }}
        renderManualFields={({ values, setValue, disabled: d }) => (
          <>
            <FieldLike label="Authorization (Bearer)">
              <input
                className="input"
                type="password"
                value={values.auth ?? ""}
                onChange={(e) => setValue("auth", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
            <FieldLike label="X-User-Id" hint="Base64 do CPF (DevTools → Network)">
              <input
                className="input"
                type="text"
                value={values.userId ?? ""}
                onChange={(e) => setValue("userId", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
          </>
        )}
        canGravarManual={(v) => Boolean(v.auth?.trim() && v.userId?.trim())}
        onGravarManual={(v) => ({ auth: v.auth!.trim(), userId: v.userId!.trim() })}
      />
  );
}

export function PedagioSessaoPanel({ disabled }: { disabled?: boolean }) {
  return (
    <PortalSessaoPanel
        titulo="Sessão Pedágio Digital"
        portalUrl="https://pedagiodigital.com/"
        portalLabel="Pedágio Digital"
        disabled={disabled}
        waitingMessage="Chrome aberto — faça login (CPF/senha + reCAPTCHA); cookie e CSRF serão capturados."
        descricao="Login em pedagiodigital.com com CPF/senha. Resolve o reCAPTCHA na janela do Chrome."
        api={{
          statusSessao: () => lanzaApi.statusPedagioSessao(),
          gravarSessao: (body) =>
            lanzaApi.gravarPedagioSessao({ cookie: body.cookie ?? "", csrf: body.csrf ?? "" }),
          removerSessao: () => lanzaApi.removerPedagioSessao(),
          iniciarCaptura: () => lanzaApi.iniciarCapturaPedagio(),
          statusCaptura: () => lanzaApi.statusCapturaPedagio(),
        }}
        bridge={{
          health: pedagioBridgeHealth,
          capturaStatus: pedagioBridgeCapturaStatus,
          capturaIniciar: pedagioBridgeCapturaIniciar,
          startHint: pedagioBridgeStartHint(),
        }}
        renderStatus={(s) => {
          const sessao = s as PedagioSessaoStatus | null;
          if (sessao?.configured) {
            return (
              <p className="field__hint">
                <span className="badge badge--ok">Configurada</span>
                {sessao.origem === "env" ? " (variáveis de ambiente)" : null}
                {sessao.cookiePreview ? ` · cookie ${sessao.cookiePreview}` : null}
                {sessao.csrfPreview ? ` · csrf ${sessao.csrfPreview}` : null}
              </p>
            );
          }
          return (
            <p className="field__hint">
              <span className="badge badge--warn">Não configurada</span>
            </p>
          );
        }}
        renderManualFields={({ values, setValue, disabled: d }) => (
          <>
            <FieldLike label="Cookie (header Cookie completo)">
              <input
                className="input"
                type="password"
                value={values.cookie ?? ""}
                onChange={(e) => setValue("cookie", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
            <FieldLike label="CSRF (x-csrf-token / bff-csrf)">
              <input
                className="input"
                type="password"
                value={values.csrf ?? ""}
                onChange={(e) => setValue("csrf", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
          </>
        )}
        canGravarManual={(v) => Boolean(v.cookie?.trim() && v.csrf?.trim())}
        onGravarManual={(v) => ({ cookie: v.cookie!.trim(), csrf: v.csrf!.trim() })}
      />
  );
}

export function SigapaySessaoPanel({ disabled }: { disabled?: boolean }) {
  return (
    <PortalSessaoPanel
        titulo="Sessão SigaPay"
        portalUrl="https://sigapay.com.br/"
        portalLabel="SigaPay"
        disabled={disabled}
        waitingMessage="Chrome aberto — faça login e abra avisos/placas no portal."
        descricao="Login em sigapay.com.br. Após entrar, abra avisos ou placas para a captura detectar cookie/token."
        api={{
          statusSessao: () => lanzaApi.statusSigapaySessao(),
          gravarSessao: (body) =>
            lanzaApi.gravarSigapaySessao({
              cookie: body.cookie?.trim() || undefined,
              token: body.token?.trim() || undefined,
            }),
          removerSessao: () => lanzaApi.removerSigapaySessao(),
          iniciarCaptura: () => lanzaApi.iniciarCapturaSigapay(),
          statusCaptura: () => lanzaApi.statusCapturaSigapay(),
        }}
        bridge={{
          health: sigapayBridgeHealth,
          capturaStatus: sigapayBridgeCapturaStatus,
          capturaIniciar: sigapayBridgeCapturaIniciar,
          startHint: sigapayBridgeStartHint(),
        }}
        renderStatus={(s) => {
          const sessao = s as SigapaySessaoStatus | null;
          if (sessao?.configured) {
            return (
              <p className="field__hint">
                <span className="badge badge--ok">Configurada</span>
                {sessao.origem === "env" ? " (variáveis de ambiente)" : null}
                {sessao.cookiePreview ? ` · cookie ${sessao.cookiePreview}` : null}
                {sessao.tokenPreview ? ` · token ${sessao.tokenPreview}` : null}
              </p>
            );
          }
          return (
            <p className="field__hint">
              <span className="badge badge--warn">Não configurada</span>
            </p>
          );
        }}
        renderManualFields={({ values, setValue, disabled: d }) => (
          <>
            <FieldLike label="Cookie">
              <input
                className="input"
                type="password"
                value={values.cookie ?? ""}
                onChange={(e) => setValue("cookie", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
            <FieldLike label="Token (Authorization)">
              <input
                className="input"
                type="password"
                value={values.token ?? ""}
                onChange={(e) => setValue("token", e.target.value)}
                disabled={d}
                autoComplete="off"
              />
            </FieldLike>
          </>
        )}
        canGravarManual={(v) => Boolean(v.cookie?.trim() || v.token?.trim())}
        onGravarManual={(v) => ({
          cookie: v.cookie?.trim() ?? "",
          token: v.token?.trim() ?? "",
        })}
      />
  );
}

export function PortalSessoesSection({ disabled }: { disabled?: boolean }) {
  return (
    <>
      <p className="field__hint">
        Configure a sessão de cada portal antes de consultar. Localmente (Windows):{" "}
        <code>npm run detran-capture-bridge</code>, <code>npm run detran-rs-capture-bridge</code>,{" "}
        <code>npm run pedagio-capture-bridge</code>, <code>npm run sigapay-capture-bridge</code>.
      </p>
      <DetranScSessaoPanel disabled={disabled} />
      <DetranRsSessaoPanel disabled={disabled} />
      <PedagioSessaoPanel disabled={disabled} />
      <SigapaySessaoPanel disabled={disabled} />
    </>
  );
}
