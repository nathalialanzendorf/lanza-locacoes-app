import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { ResponsavelDebitoCell } from "@/components/relatorios/ResponsavelDebitoCell";
import { useDespesasCliente, useInfracoes, useSyncMeta, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { CATEGORIA_ESTACIONAMENTO, isCategoriaEstacionamento } from "@/lib/estacionamentoLabels";
import { formatBrl, formatPlaca } from "@/lib/format";
import { CATEGORIA_PEDAGIO, isCategoriaPedagio } from "@/lib/pedagioLabels";
import { precisaConfirmacao } from "@/lib/responsavelDebitoUi";
import { bodySyncGlobal, opcoesSyncCompleto } from "@/lib/syncUi";
import type { ClienteDespesa, Infracao } from "@/api/types";

type SyncRegistroLinha = {
  id: string;
  tipo: "Infração" | "Pedágio" | "Estacionamento";
  placa: string;
  ref: string;
  descricao: string;
  data: string;
  valor: number;
  infracao?: Infracao;
  despesa?: ClienteDespesa;
};

function valorInfracao(i: Infracao): number {
  return Number(i.valorMulta ?? i.valor) || 0;
}

function valorDespesa(d: ClienteDespesa): number {
  return Number(d.valorMulta) || 0;
}

function categoriaDespesaSync(d: ClienteDespesa): "Pedágio" | "Estacionamento" | null {
  if (isCategoriaPedagio(d.categoria)) return "Pedágio";
  if (isCategoriaEstacionamento(d.categoria)) return "Estacionamento";
  return null;
}

export function SyncRegistrosSection() {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const [placa, setPlaca] = useState("");
  const [semConfirmacao, setSemConfirmacao] = useState(false);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<unknown>(null);
  const [inferirResult, setInferirResult] = useState<unknown>(null);
  const [acaoError, setAcaoError] = useState<string | null>(null);

  const placaFiltro = placa.trim() || undefined;
  const veiculosQuery = useVeiculos({ ativo: true });

  const veiculoId = useMemo(() => {
    if (!placaFiltro) return undefined;
    const alvo = placaFiltro.replace(/-/g, "").toUpperCase();
    return veiculosQuery.data?.items.find(
      (v) => (v.placa ?? "").replace(/-/g, "").toUpperCase() === alvo,
    )?.id;
  }, [placaFiltro, veiculosQuery.data]);

  const infracoesQuery = useInfracoes({
    veiculoId,
    placa: !veiculoId ? placaFiltro : undefined,
    emAberto: true,
    ativo: true,
  });

  const despesasQuery = useDespesasCliente({
    veiculoId,
    placa: !veiculoId ? placaFiltro : undefined,
    emAberto: true,
    ativo: true,
  });

  const linhas = useMemo(() => {
    const out: SyncRegistroLinha[] = [];

    for (const i of infracoesQuery.data?.items ?? []) {
      out.push({
        id: `infracao:${i.numeroAuto ?? i.id}`,
        tipo: "Infração",
        placa: formatPlaca(i.veiculoId),
        ref: i.numeroAuto ?? i.id,
        descricao: i.descricao?.trim() || "—",
        data: i.dataAutuacao?.slice(0, 16) ?? "—",
        valor: valorInfracao(i),
        infracao: i,
      });
    }

    for (const d of despesasQuery.data?.items ?? []) {
      const cat = categoriaDespesaSync(d);
      if (!cat) continue;
      out.push({
        id: `despesa:${d.id}`,
        tipo: cat,
        placa: formatPlaca(d.placa ?? d.veiculoId),
        ref: d.autoInfracao ?? d.id.slice(0, 8),
        descricao: d.descricao?.trim() || d.titulo?.trim() || "—",
        data: d.dataAutuacao?.slice(0, 16) ?? d.vencimentoBr?.trim() ?? "—",
        valor: valorDespesa(d),
        despesa: d,
      });
    }

    out.sort((a, b) => {
      const pc = a.placa.localeCompare(b.placa, "pt-BR");
      if (pc !== 0) return pc;
      return a.tipo.localeCompare(b.tipo, "pt-BR");
    });

    if (!semConfirmacao) return out;

    return out.filter((l) => {
      const item = l.infracao ?? l.despesa;
      return item ? precisaConfirmacao(item) : false;
    });
  }, [infracoesQuery.data, despesasQuery.data, semConfirmacao]);

  const total = useMemo(() => linhas.reduce((s, l) => s + l.valor, 0), [linhas]);

  const loading =
    infracoesQuery.isLoading || despesasQuery.isLoading || veiculosQuery.isLoading;

  async function sincronizarFrota() {
    setAcaoLoading("sync");
    setAcaoError(null);
    setSyncResult(null);
    try {
      const syncs = metaQuery.data?.syncs ?? [];
      const r = await lanzaApi.executarSyncCompleto({
        ...bodySyncGlobal({ dryRun: false, placa }),
        opcoes: opcoesSyncCompleto(syncs, { dryRun: false, placa }),
      });
      setSyncResult(r);
      await qc.invalidateQueries({ queryKey: ["infracoes"] });
      await qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao sincronizar.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function inferirResponsaveis() {
    setAcaoLoading("inferir");
    setAcaoError(null);
    setInferirResult(null);
    try {
      const rInf = await lanzaApi.atribuirClientesInfracoes({
        placa: placaFiltro,
        incluirPedagios: true,
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        placa: placaFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, estacionamento: rEst });
      await qc.invalidateQueries({ queryKey: ["infracoes"] });
      await qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha ao inferir responsáveis.");
    } finally {
      setAcaoLoading(null);
    }
  }

  async function sincronizarEInferir() {
    setAcaoLoading("tudo");
    setAcaoError(null);
    setSyncResult(null);
    setInferirResult(null);
    try {
      const syncs = metaQuery.data?.syncs ?? [];
      const rSync = await lanzaApi.executarSyncCompleto({
        ...bodySyncGlobal({ dryRun: false, placa }),
        opcoes: opcoesSyncCompleto(syncs, { dryRun: false, placa }),
      });
      setSyncResult(rSync);
      const rInf = await lanzaApi.atribuirClientesInfracoes({
        placa: placaFiltro,
        incluirPedagios: true,
      });
      const rEst = await lanzaApi.atribuirClientesDespesas({
        placa: placaFiltro,
        escopo: "estacionamento",
      });
      setInferirResult({ infracoes: rInf, estacionamento: rEst });
      await qc.invalidateQueries({ queryKey: ["infracoes"] });
      await qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setAcaoError(err instanceof LanzaApiError ? err.message : "Falha no sync e inferência.");
    } finally {
      setAcaoLoading(null);
    }
  }

  function invalidarListagem() {
    void qc.invalidateQueries({ queryKey: ["infracoes"] });
    void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Veículo</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Placa</span>
            <VeiculoSelect
              value={placa}
              onChange={setPlaca}
              valueField="placa"
              ativo
              variant="filtro"
            />
            <span className="field__hint">
              ---Todos--- sincroniza e lista a frota ativa. Uma placa limita pedágio, SigaPay, DETRAN e
              FIPE a esse veículo.
            </span>
          </label>
          <label className="field checkbox-inline">
            <input
              type="checkbox"
              checked={semConfirmacao}
              onChange={(e) => setSemConfirmacao(e.target.checked)}
            />
            Só registos sem confirmação de responsável
          </label>
        </div>
        {!loading ? (
          <p className="field__hint">
            {linhas.length} registo{linhas.length === 1 ? "" : "s"} · {formatBrl(total)}
          </p>
        ) : null}
      </section>

      <section className="form-card">
        <p className="field__hint">
          Sincronize com os portais (DETRAN, pedágio, SigaPay), depois infira cliente ou parceiro
          responsável. Confirme na tabela abaixo — multas, {CATEGORIA_PEDAGIO.toLowerCase()} e{" "}
          {CATEGORIA_ESTACIONAMENTO.toLowerCase()}.
        </p>
      </section>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void sincronizarFrota()}
        >
          {acaoLoading === "sync" ? "Sincronizando…" : "Sincronizar"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(acaoLoading)}
          onClick={() => void inferirResponsaveis()}
        >
          {acaoLoading === "inferir" ? "Inferindo…" : "Inferir responsáveis"}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={Boolean(acaoLoading)}
          onClick={() => void sincronizarEInferir()}
        >
          {acaoLoading === "tudo" ? "A processar…" : "Sincronizar e inferir"}
        </button>
      </div>

      {acaoError ? <p className="form-card__error">{acaoError}</p> : null}
      <ResultPanel title="Resultado sync" data={syncResult} />
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

      <DataTable
        loading={loading}
        rows={linhas}
        keyFn={(l) => l.id}
        emptyMessage={
          placaFiltro
            ? "Nenhum registo em aberto para esta placa. Use «Sincronizar e inferir»."
            : "Nenhum registo em aberto. Selecione a frota ou uma placa e sincronize."
        }
        columns={[
          {
            key: "tipo",
            header: "Tipo",
            sortValue: (l) => l.tipo,
            render: (l) => <span className="badge badge--muted">{l.tipo}</span>,
          },
          {
            key: "ref",
            header: "Ref.",
            sortValue: (l) => l.ref,
            render: (l) => <strong>{l.ref}</strong>,
          },
          {
            key: "placa",
            header: "Placa",
            sortValue: (l) => l.placa,
            render: (l) => l.placa,
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (l) => l.descricao,
            render: (l) => (
              <span className="infracao-desc" title={l.descricao}>
                {l.descricao}
              </span>
            ),
          },
          {
            key: "data",
            header: "Data",
            sortValue: (l) => l.data,
            render: (l) => l.data,
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (l) => l.valor,
            render: (l) => formatBrl(l.valor),
          },
          {
            key: "responsavel",
            header: "Responsável",
            render: (l) => {
              if (l.infracao) {
                return (
                  <ResponsavelDebitoCell
                    tipo="infracao"
                    chave={l.infracao.numeroAuto ?? l.infracao.id}
                    item={l.infracao}
                    onConfirmed={invalidarListagem}
                  />
                );
              }
              if (l.despesa) {
                return (
                  <ResponsavelDebitoCell
                    tipo="pedagio"
                    despesaId={l.despesa.id}
                    autoInfracao={l.despesa.autoInfracao ?? l.despesa.id}
                    item={l.despesa}
                    onConfirmed={invalidarListagem}
                  />
                );
              }
              return "—";
            },
          },
        ]}
      />
    </>
  );
}
