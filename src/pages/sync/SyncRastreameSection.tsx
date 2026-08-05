import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import type { RastreameAuthStatus } from "@/api/types";
import { FlashError } from "@/context/ScreenFlashContext";
import { useRastreameEspelho } from "@/hooks/useRastreameEspelho";
import { LABEL } from "@/lib/labels";
import { abasSync, direcaoEfetiva } from "@/lib/syncUi";
import {
  SyncCard,
  SyncJobsTable,
  SyncOpcoesGlobais,
  executarSyncId,
  useSyncDisparo,
  useSyncOpcoes,
} from "@/pages/sync/syncShared";

function rotuloAuthRastreame(auth: RastreameAuthStatus | undefined): string {
  if (!auth) return "A verificar…";
  if (auth.configurado) {
    if (auth.metodo === "token") return "Autenticado (token em cache)";
    if (auth.metodo === "login") return "Autenticado (login/senha)";
  }
  if (auth.loginDisponivel) return "Login/senha configurados — testar conexão";
  return "Credenciais ausentes no servidor";
}

export function SyncRastreameSection() {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const opcoes = useSyncOpcoes();
  const { ativo: espelhoAtivo } = useRastreameEspelho();
  const { runningId, error, lastResult, disparar } = useSyncDisparo();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginOk, setLoginOk] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: ["rastreame-auth"],
    queryFn: () => lanzaApi.rastreameAuthStatus(),
    staleTime: 30_000,
  });

  const { rastreame } = abasSync(metaQuery.data?.syncs ?? []);
  const buscar = useMemo(
    () => rastreame.filter((s) => direcaoEfetiva(s) === "buscar"),
    [rastreame],
  );
  const enviar = useMemo(
    () => rastreame.filter((s) => direcaoEfetiva(s) === "enviar"),
    [rastreame],
  );

  const globalOpts = useMemo(
    () => ({ dryRun: opcoes.dryRun, placa: opcoes.placa }),
    [opcoes.dryRun, opcoes.placa],
  );

  const authOk = authQuery.data?.configurado === true;

  function executar(syncId: string) {
    void disparar(syncId, () =>
      executarSyncId(metaQuery.data?.syncs ?? [], syncId, globalOpts, opcoes.usarAsync),
    );
  }

  async function executarTodos() {
    for (const s of rastreame) {
      await disparar(s.id, () =>
        executarSyncId(metaQuery.data?.syncs ?? [], s.id, globalOpts, opcoes.usarAsync),
      );
    }
  }

  async function testarLogin() {
    setLoginLoading(true);
    setLoginError(null);
    setLoginOk(null);
    try {
      await lanzaApi.rastreameLogin(false);
      setLoginOk("Login no Rastreame OK.");
      void qc.invalidateQueries({ queryKey: ["rastreame-auth"] });
    } catch (err) {
      setLoginError(err instanceof LanzaApiError ? err.message : "Falha ao autenticar no Rastreame.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <>
      <section className="form-card">
        <header className="sync-section__head">
          <h2 className="form-card__title">Integração Rastreame</h2>
          <p className="field__hint">
            Buscar rastreáveis do Rastreame e enviar clientes, veículos, gastos e manutenção.
            A base Lanza continua sendo a fonte da verdade.
          </p>
          {!espelhoAtivo ? (
            <p className="field__hint sync-rastreame-aviso">
              Espelho desligado — ligue <strong>Espelhar no Rastreame</strong> no cabeçalho ou
              defina <code>LANZA_RASTREAME_ESPELHO=true</code>.
            </p>
          ) : null}
        </header>
      </section>

      <section className="form-card sync-rastreame-auth">
        <h3 className="form-card__title">Autenticação</h3>
        <p className="field__hint">
          O Rastreame usa <strong>login e senha</strong> do site — não usa API key. Configure no
          servidor (variáveis de ambiente):
        </p>
        <ul className="field__hint sync-rastreame-auth__vars">
          <li>
            <code>RASTREAME_LOGIN</code> + <code>RASTREAME_SENHA</code> — login automático
          </li>
          <li>
            <code>RASTREAME_AUTH</code> — token JWT em cache (opcional; gerado após login)
          </li>
        </ul>
        <p className="field__hint">
          A <strong>API key</strong> do menu lateral é só para autenticar na API Lanza — não tem
          relação com o Rastreame.
        </p>
        <p className="sync-rastreame-auth__status">
          <span className={`badge ${authOk ? "badge--ok" : "badge--warn"}`}>
            {rotuloAuthRastreame(authQuery.data)}
          </span>
        </p>
        {authQuery.isError ? (
          <QueryError
            message={
              authQuery.error instanceof LanzaApiError
                ? authQuery.error.message
                : "Falha ao verificar autenticação Rastreame."
            }
          />
        ) : null}
        <FlashError message={loginError} />
        {loginOk ? <p className="field__hint sync-rastreame-auth__ok">{loginOk}</p> : null}
        <div className="despesas-toolbar">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loginLoading || !authQuery.data?.loginDisponivel}
            onClick={() => void testarLogin()}
          >
            {loginLoading ? LABEL.processando : "Testar login"}
          </button>
        </div>
      </section>

      <SyncOpcoesGlobais
        placa={opcoes.placa}
        onPlacaChange={opcoes.setPlaca}
        asyncMode={opcoes.asyncMode}
        onAsyncModeChange={opcoes.setAsyncMode}
        dryRun={opcoes.dryRun}
        onDryRunChange={opcoes.toggleDryRun}
      />

      {metaQuery.isError ? (
        <QueryError
          message={
            metaQuery.error instanceof LanzaApiError
              ? metaQuery.error.message
              : "Falha ao carregar catálogo de syncs."
          }
        />
      ) : null}

      <FlashError message={error} />

      {!authOk && authQuery.isSuccess ? (
        <p className="field__hint sync-rastreame-aviso">
          Defina <code>RASTREAME_LOGIN</code> e <code>RASTREAME_SENHA</code> no servidor antes de
          executar os syncs.
        </p>
      ) : null}

      {metaQuery.isLoading ? (
        <p className="field__hint">A carregar syncs…</p>
      ) : rastreame.length === 0 ? (
        <p className="field__hint">Nenhum sync Rastreame disponível.</p>
      ) : (
        <>
          <div className="despesas-toolbar">
            <button
              type="button"
              className="btn btn--primary"
              disabled={runningId !== null || !authOk}
              onClick={() => void executarTodos()}
            >
              {runningId !== null ? LABEL.processando : "Executar todos"}
            </button>
          </div>

          {buscar.length > 0 ? (
            <section className="sync-rastreame-grupo">
              <h3 className="sync-rastreame-grupo__titulo">Buscar do Rastreame</h3>
              <div className="sync-grid">
                {buscar.map((s) => (
                  <SyncCard
                    key={s.id}
                    sync={s}
                    running={runningId === s.id}
                    disabled={runningId !== null || !authOk}
                    onExecutar={() => executar(s.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {enviar.length > 0 ? (
            <section className="sync-rastreame-grupo">
              <h3 className="sync-rastreame-grupo__titulo">Enviar para o Rastreame</h3>
              <div className="sync-grid">
                {enviar.map((s) => (
                  <SyncCard
                    key={s.id}
                    sync={s}
                    running={runningId === s.id}
                    disabled={runningId !== null || !authOk}
                    onExecutar={() => executar(s.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {opcoes.dryRun ? <ResultPanel title="Resultado (dry-run)" data={lastResult} /> : null}
      <SyncJobsTable title="Jobs Rastreame" />
    </>
  );
}
