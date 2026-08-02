import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { FipeConsultaForm } from "@/components/FipeConsultaForm";
import { VeiculoSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import { LABEL } from "@/lib/labels";
import { abasSync, rotuloAbaSync, syncTemRegistros, tiposRegistrosSync } from "@/lib/syncUi";
import {
  SyncJobsTable,
  SyncOpcoesGlobais,
  executarSyncId,
  useSyncDisparo,
  useSyncOpcoes,
} from "@/pages/sync/syncShared";
import { FipeSyncResultadosPanel } from "@/pages/sync/FipeSyncResultadosPanel";
import { SyncRegistrosTable } from "@/pages/sync/SyncRegistrosTable";
import { useSyncRegistrosLinhas } from "@/pages/sync/useSyncRegistrosLinhas";

type Props = {
  syncId: string;
};

export function SyncTipoSection({ syncId }: Props) {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const sync = metaQuery.data?.syncs.find((s) => s.id === syncId);
  const opcoes = useSyncOpcoes();
  const { runningId, error, lastResult, disparar } = useSyncDisparo();
  const [veiculoId, setVeiculoId] = useState("");
  const [semConfirmacao, setSemConfirmacao] = useState(false);
  const [inferirLoading, setInferirLoading] = useState(false);
  const [inferirResult, setInferirResult] = useState<unknown>(null);
  const [inferirError, setInferirError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [placaFipe, setPlacaFipe] = useState("");

  const isFipe = syncId === "fipe";
  const placaFipeUrl = isFipe ? searchParams.get("placa")?.trim() ?? "" : "";
  const marcaFipeUrl = isFipe ? searchParams.get("marcaModelo")?.trim() ?? "" : "";
  const anoFipeUrl = isFipe ? searchParams.get("anoModelo")?.trim() ?? "" : "";

  useEffect(() => {
    if (!isFipe) return;
    if (placaFipeUrl) setPlacaFipe(placaFipeUrl.toUpperCase());
  }, [isFipe, placaFipeUrl]);

  const tipos = tiposRegistrosSync(syncId);
  const temRegistros = syncTemRegistros(syncId);
  const { linhas, total, loading, placaSync, veiculoIdFiltro, infracoesQuery, despesasQuery } =
    useSyncRegistrosLinhas({
      veiculoId: temRegistros ? veiculoId : undefined,
      semConfirmacao: temRegistros ? semConfirmacao : false,
      tipos,
    });

  const placaExecucao = isFipe ? placaFipe : temRegistros ? placaSync : opcoes.placa;
  const globalOpts = useMemo(
    () => ({ dryRun: isFipe ? false : opcoes.dryRun, placa: placaExecucao }),
    [isFipe, opcoes.dryRun, placaExecucao],
  );

  function invalidarListagem() {
    void qc.invalidateQueries({ queryKey: ["infracoes"] });
    void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
  }

  function executar() {
    if (!sync) return;
    const usarAsync = isFipe ? true : opcoes.usarAsync;
    void disparar(syncId, () =>
      executarSyncId(metaQuery.data?.syncs ?? [], syncId, globalOpts, usarAsync),
    ).then(() => {
      if (!globalOpts.dryRun && temRegistros) invalidarListagem();
      if (isFipe) void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
    });
  }

  async function inferirResponsaveis() {
    setInferirLoading(true);
    setInferirError(null);
    setInferirResult(null);
    try {
      if (syncId === "infracoes" || syncId === "pedagios") {
        const r = await lanzaApi.atribuirClientesInfracoes({
          veiculoId: veiculoIdFiltro,
          incluirPedagios: syncId === "pedagios",
        });
        setInferirResult(r);
      } else if (syncId === "estacionamento") {
        const r = await lanzaApi.atribuirClientesDespesas({
          veiculoId: veiculoIdFiltro,
          escopo: "estacionamento",
        });
        setInferirResult(r);
      }
      invalidarListagem();
    } catch (err) {
      setInferirError(err instanceof LanzaApiError ? err.message : "Falha ao inferir responsáveis.");
    } finally {
      setInferirLoading(false);
    }
  }

  if (metaQuery.isLoading) {
    return <p className="field__hint">A carregar sync…</p>;
  }

  if (!sync) {
    return <p className="field__hint">Sync não encontrado.</p>;
  }

  return (
    <>
      <section className="form-card">
        <header className="sync-section__head">
          <h2 className="form-card__title">{sync.rotulo}</h2>
          <p className="field__hint">{sync.destino}</p>
          {sync.nota ? <p className="field__hint">{sync.nota}</p> : null}
          {isFipe ? (
            <p className="field__hint">
              Use a consulta abaixo para visualizar FIPE de qualquer placa. O sync grava no PostgreSQL
              para todos os veículos da base.
            </p>
          ) : null}
        </header>
        {!isFipe ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={runningId !== null}
            onClick={executar}
          >
            {runningId === syncId ? LABEL.processando : "Executar sync"}
          </button>
        ) : null}
      </section>

      {temRegistros ? (
        <section className="form-card">
          <h2 className="form-card__title">Veículo</h2>
          <label className="field">
            <span className="field__label">Filtrar registos e sync</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              ativo
              variant="filtro"
            />
            <span className="field__hint">
              ---Todos--- = frota inteira. Um veículo limita o sync e a listagem.
            </span>
          </label>
        </section>
      ) : isFipe ? (
        <>
          <FipeConsultaForm
            title="Consultar FIPE (visualização)"
            hint="Digite a placa de qualquer veículo. Se não estiver na frota, informe marca/modelo e ano — nada é gravado nesta consulta."
            showPersistOption={false}
            modoSelecao="placa"
            initialPlaca={placaFipeUrl || placaFipe}
            initialMarcaModelo={marcaFipeUrl || undefined}
            initialAnoModelo={anoFipeUrl || undefined}
          />
          <section className="form-card sync-options">
            <h2 className="form-card__title">Atualizar FIPE no PostgreSQL</h2>
            <p className="field__hint">
              Consulta a Tabela FIPE e grava em <code>lanza.veiculo_fipe</code>. Placa vazia = todos os
              veículos da base (ativos e inativos). Sem dry-run — sempre grava. Executa em background
              com progresso na tabela de jobs.
            </p>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Placa (opcional)</span>
                <input
                  className="input"
                  value={placaFipe}
                  onChange={(e) => setPlacaFipe(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                />
                <span className="field__hint">Vazio = frota completa no PostgreSQL.</span>
              </label>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={runningId !== null}
              onClick={executar}
            >
              {runningId === syncId ? LABEL.processando : "Executar sync"}
            </button>
          </section>
        </>
      ) : (
        <SyncOpcoesGlobais
          placa={opcoes.placa}
          onPlacaChange={opcoes.setPlaca}
          asyncMode={opcoes.asyncMode}
          onAsyncModeChange={opcoes.setAsyncMode}
          dryRun={opcoes.dryRun}
          onDryRunChange={opcoes.toggleDryRun}
        />
      )}

      {temRegistros ? (
        <SyncOpcoesGlobais
          placa={placaExecucao}
          onPlacaChange={() => {}}
          asyncMode={opcoes.asyncMode}
          onAsyncModeChange={opcoes.setAsyncMode}
          dryRun={opcoes.dryRun}
          onDryRunChange={opcoes.toggleDryRun}
          hideVeiculo
        />
      ) : null}

      {temRegistros ? (
        <>
          <section className="form-card">
            <h2 className="form-card__title">Registos em aberto</h2>
            <label className="field checkbox-inline">
              <input
                type="checkbox"
                checked={semConfirmacao}
                onChange={(e) => setSemConfirmacao(e.target.checked)}
              />
              Só registos sem confirmação de responsável
            </label>
            {!loading ? (
              <p className="field__hint">
                {linhas.length} registo{linhas.length === 1 ? "" : "s"} · {formatBrl(total)}
              </p>
            ) : null}
          </section>

          {(syncId === "infracoes" || syncId === "pedagios" || syncId === "estacionamento") && (
            <div className="despesas-toolbar">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={inferirLoading || runningId !== null}
                onClick={() => void inferirResponsaveis()}
              >
                {inferirLoading ? "Inferindo…" : "Inferir responsáveis"}
              </button>
            </div>
          )}

          <FlashError message={inferirError} />
          <ResultPanel title="Inferência de responsáveis" data={inferirResult} />

          {infracoesQuery.isError || despesasQuery.isError ? (
            <QueryError
              message={
                infracoesQuery.error instanceof LanzaApiError
                  ? infracoesQuery.error.message
                  : despesasQuery.error instanceof LanzaApiError
                    ? despesasQuery.error.message
                    : "Falha ao listar registos."
              }
            />
          ) : null}

          <SyncRegistrosTable
            loading={loading}
            linhas={linhas}
            veiculoIdFiltro={veiculoIdFiltro}
            onConfirmed={invalidarListagem}
          />
        </>
      ) : null}

      <FlashError message={error} />
      {isFipe ? <FipeSyncResultadosPanel /> : null}
      {!isFipe ? (
        <ResultPanel
          title={opcoes.dryRun ? "Resultado (dry-run)" : "Última resposta"}
          data={lastResult}
        />
      ) : null}
      <SyncJobsTable syncId={syncId} />
    </>
  );
}

export function SyncLegadoSection() {
  const metaQuery = useSyncMeta();
  const opcoes = useSyncOpcoes();
  const { error, lastResult } = useSyncDisparo();
  const { legado } = abasSync(metaQuery.data?.syncs ?? []);

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Integrações Rastreame (descontinuadas)</h2>
        <p className="field__hint">
          Mantidas só por compatibilidade — não enviar nem buscar dados do Rastreame.
        </p>
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

      {metaQuery.isLoading ? (
        <p className="field__hint">A carregar syncs…</p>
      ) : (
        <div className="sync-grid">
          {legado.map((s) => (
            <article key={s.id} className="sync-card sync-card--deprecated">
              <header className="sync-card__head">
                <h3>{s.rotulo}</h3>
                <code className="sync-card__skill">{s.id}</code>
              </header>
              <p className="sync-card__destino">{s.destino}</p>
              {s.nota ? <p className="sync-card__nota">{s.nota}</p> : null}
              <span className="badge badge--muted">Descontinuado</span>
              <button
                type="button"
                className="btn btn--primary sync-card__btn"
                disabled
              >
                Indisponível
              </button>
            </article>
          ))}
        </div>
      )}

      <ResultPanel title={opcoes.dryRun ? "Resultado (dry-run)" : "Última resposta"} data={lastResult} />
      <SyncJobsTable />
    </>
  );
}

export { rotuloAbaSync };
