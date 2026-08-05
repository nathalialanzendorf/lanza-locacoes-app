import { useEffect, useState } from "react";

import { getApiBaseUrl, getStoredApiKey, LanzaApiError } from "@/api/client";
import { getStoredToken } from "@/api/authClient";
import { lanzaApi } from "@/api/endpoints";
import type { SigapayCapturaState, SigapaySessaoStatus } from "@/api/types";
import { FlashError } from "@/context/ScreenFlashContext";
import {
  sigapayBridgeCapturaIniciar,
  sigapayBridgeCapturaStatus,
  sigapayBridgeHealth,
  sigapayBridgeStartHint,
} from "@/lib/sigapayCaptureBridge";

const SIGAPAY_PORTAL = "https://sigapay.com.br/";

/** Sessão SigaPay + captura via bridge local (produção Vercel). */
export function SigapaySessaoPanel() {
  const [sessao, setSessao] = useState<SigapaySessaoStatus | null>(null);
  const [captura, setCaptura] = useState<SigapayCapturaState | null>(null);
  const [bridgeAtivo, setBridgeAtivo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capturaEmCurso = captura?.status === "starting" || captura?.status === "waiting";

  async function recarregarSessao() {
    const r = await lanzaApi.statusSigapaySessao();
    setSessao(r.data);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const bridge = await sigapayBridgeHealth();
        if (!cancelled) setBridgeAtivo(bridge);
        await recarregarSessao();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof LanzaApiError ? err.message : "Falha ao carregar sessão SigaPay.",
          );
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
          let estado: SigapayCapturaState | null = null;
          if (bridgeAtivo) {
            estado = await sigapayBridgeCapturaStatus();
          } else {
            const r = await lanzaApi.statusCapturaSigapay();
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
      const bridgeOpts = {
        apiUrl,
        bearer: getStoredToken().trim() || undefined,
        apiKey: getStoredApiKey().trim() || undefined,
      };

      let data: SigapayCapturaState | null = null;
      const bridge = bridgeAtivo ?? (await sigapayBridgeHealth());
      setBridgeAtivo(bridge);

      if (bridge) {
        data = await sigapayBridgeCapturaIniciar(bridgeOpts);
        if (!data) throw new Error("Bridge local respondeu mas não iniciou a captura.");
      } else {
        try {
          const r = await lanzaApi.iniciarCapturaSigapay();
          data = r.data;
        } catch (err) {
          if (err instanceof LanzaApiError && err.status === 501) {
            throw new Error(
              `Bridge local não detectado. ${sigapayBridgeStartHint()} — depois clique em Capturar sessão.`,
            );
          }
          throw err;
        }
      }

      setCaptura(data);
      setMsg(
        data.message ??
          "Chrome aberto — faça login no SigaPay; a sessão será enviada à API automaticamente.",
      );
    } catch (err) {
      setError(
        err instanceof LanzaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removerSessao() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      await lanzaApi.removerSigapaySessao();
      setSessao({ configured: false, origem: "store" });
      setMsg("Sessão SigaPay removida.");
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao remover sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">Sessão SigaPay</h2>
      <p className="field__hint">
        Em produção, rode no PC{" "}
        <code>npm run sigapay-capture-bridge</code> e use <strong>Capturar sessão</strong> — o
        Chrome abre, você faz login e a sessão vai para a API.
      </p>

      {sessao?.configured ? (
        <p className="field__hint">
          Sessão activa
          {sessao.origem === "env" ? " (variáveis de ambiente)" : " (store)"}
          {sessao.updatedAt
            ? ` · ${new Date(sessao.updatedAt).toLocaleString("pt-BR")}`
            : ""}
          {sessao.tokenPreview ? ` · token ${sessao.tokenPreview}` : ""}
          {sessao.cookiePreview ? ` · cookie ${sessao.cookiePreview}` : ""}
        </p>
      ) : (
        <p className="field__hint">Nenhuma sessão configurada — o sync falha sem cookie/token.</p>
      )}

      {capturaEmCurso && captura?.message ? (
        <p className="field__hint">{captura.message}</p>
      ) : null}
      {msg ? <p className="field__hint">{msg}</p> : null}
      <FlashError message={error} />

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading || capturaEmCurso}
          onClick={() => void iniciarCaptura()}
        >
          {capturaEmCurso ? "A capturar…" : "Capturar sessão"}
        </button>
        <a
          className="btn btn--ghost"
          href={SIGAPAY_PORTAL}
          target="_blank"
          rel="noreferrer"
        >
          Abrir SigaPay
        </a>
        {sessao?.configured && sessao.origem !== "env" ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loading || capturaEmCurso}
            onClick={() => void removerSessao()}
          >
            Remover sessão
          </button>
        ) : null}
      </div>
    </section>
  );
}
