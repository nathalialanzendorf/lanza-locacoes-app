import { useCallback, useEffect, useState } from "react";

import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import type { RastreameAuthStatus } from "@/api/types";

const PORTAL_URL = "https://rastreame.com.br/";

function metodoLabel(metodo: RastreameAuthStatus["metodo"]): string {
  switch (metodo) {
    case "token":
      return "Token em cache (RASTREAME_AUTH)";
    case "login":
      return "Login automático (RASTREAME_LOGIN + SENHA)";
    case "login_pendente":
      return "Credenciais no servidor — login pendente";
    default:
      return "Não configurado";
  }
}

/** Estado da autenticação Rastreame no servidor (sync consulta o portal; relatório não). */
export function RastreameAuthPanel({ disabled }: { disabled?: boolean }) {
  const [status, setStatus] = useState<RastreameAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.rastreameAuthStatus();
      setStatus(r);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao verificar autenticação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function testarLogin(gravar = false) {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await lanzaApi.rastreameLogin(gravar);
      setMsg(
        r.gravado
          ? "Login OK — token gravado em RASTREAME_AUTH (Windows)."
          : r.ok
            ? "Login OK — token válido nesta sessão."
            : "Login concluído.",
      );
      await carregar();
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha no login Rastreame.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <header className="sync-section__head">
        <h2 className="form-card__title">Autenticação Rastreame</h2>
        <p className="field__hint">
          O sync usa credenciais no servidor (<code>RASTREAME_AUTH</code> ou{" "}
          <code>RASTREAME_LOGIN</code> + <code>RASTREAME_SENHA</code>). Abra o{" "}
          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
            portal Rastreame
          </a>{" "}
          para renovar o token manualmente (DevTools → Network → header{" "}
          <code>x-r2f-auth</code>).
        </p>
      </header>

      {status ? (
        <p className="field__hint">
          {status.configurado ? (
            <span className="badge badge--ok">Autenticado</span>
          ) : (
            <span className="badge badge--warn">Não autenticado</span>
          )}{" "}
          · {metodoLabel(status.metodo)}
          {status.loginDisponivel && !status.configurado
            ? " · credenciais de login disponíveis no servidor"
            : null}
        </p>
      ) : loading ? (
        <p className="field__hint">A verificar…</p>
      ) : null}

      <div className="form-card__action-row">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void carregar()}
          disabled={Boolean(disabled || loading)}
        >
          {loading ? "A verificar…" : "Verificar autenticação"}
        </button>
        {status?.loginDisponivel ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void testarLogin(false)}
              disabled={Boolean(disabled || loading)}
            >
              Testar login
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void testarLogin(true)}
              disabled={Boolean(disabled || loading)}
              title="Grava RASTREAME_AUTH no env do utilizador Windows (API local)"
            >
              Login e gravar token (local)
            </button>
          </>
        ) : null}
      </div>

      <p className="field__hint">
        Na Vercel: defina <code>RASTREAME_LOGIN</code> e <code>RASTREAME_SENHA</code> nas variáveis
        do projeto. Localmente: <code>npx tsx scripts/capturarRastreameCdp.ts</code> ou{" "}
        <code>.\scripts\login-rastreame.ps1</code>.
      </p>

      {msg ? <p className="field__hint">{msg}</p> : null}
      {error ? <p className="form-card__error">{error}</p> : null}
    </section>
  );
}
