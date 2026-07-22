import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { ClienteSelect, ParceiroSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ResponsavelDebitoCell } from "@/components/relatorios/ResponsavelDebitoCell";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";
import { QueryError } from "@/components/PageHeader";
import { FlashError } from "@/context/ScreenFlashContext";
import { ResultPanel } from "@/components/ResultPanel";
import {
  PERIODO_VAZIO,
  RelatorioPeriodoFiltro,
  type RelatorioPeriodo,
} from "@/components/relatorios/RelatorioPeriodoFiltro";
import { useInfracoes } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl, formatPlaca } from "@/lib/format";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import type { Infracao } from "@/api/types";

type FiltroSituacao = "em_aberto" | "quitado" | "todos";

function valorInfracao(i: Infracao): number {
  return Number(i.valorMulta ?? i.valor) || 0;
}

function situacaoLabel(i: Infracao): { text: string; className: string } {
  if (i.quitadaDetran) {
    return { text: "Quitada DETRAN", className: "badge badge--ok" };
  }
  const raw = i.situacao ?? i.status ?? "";
  if (/quitad|pago|paga/i.test(raw)) {
    return { text: raw, className: "badge badge--ok" };
  }
  if (/aberto|notificad|autua/i.test(raw)) {
    return { text: raw || "Em aberto", className: "badge badge--warn" };
  }
  return { text: raw || "—", className: "badge badge--muted" };
}

export function RelatorioInfracoesSection() {
  const queryClient = useQueryClient();
  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>(PERIODO_VAZIO);
  const [situacao, setSituacao] = useState<FiltroSituacao>("em_aberto");
  const [atribuirLoading, setAtribuirLoading] = useState(false);
  const [atribuirResult, setAtribuirResult] = useState<unknown>(null);
  const [atribuirError, setAtribuirError] = useState<string | null>(null);

  const emAberto = situacao === "em_aberto" ? true : situacao === "quitado" ? false : undefined;

  const query = useInfracoes({
    veiculoId: veiculoId || undefined,
    clienteId: clienteId || undefined,
    parceiroId: parceiroId || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
    emAberto,
    ativo: true,
  });
  const rows = query.data?.items ?? [];
  const temFiltro = Boolean(
    veiculoId || clienteId || parceiroId || situacao !== "em_aberto" || periodoPreenchido(periodo),
  );

  const total = useMemo(() => rows.reduce((sum, i) => sum + valorInfracao(i), 0), [rows]);

  const loading = query.isLoading;

  async function atribuirClientes(dryRun: boolean) {
    setAtribuirLoading(true);
    setAtribuirError(null);
    try {
      const r = await lanzaApi.atribuirClientesInfracoes({
        dryRun,
        veiculoId: veiculoId || undefined,
      });
      setAtribuirResult(r);
      if (!dryRun) {
        await queryClient.invalidateQueries({ queryKey: ["infracoes"] });
      }
    } catch (err) {
      setAtribuirError(err instanceof LanzaApiError ? err.message : "Falha ao atribuir clientes.");
    } finally {
      setAtribuirLoading(false);
    }
  }

  return (
    <>
      {!loading ? (
        <p className="relatorio-infracoes__resumo">
          <span className="badge badge--muted">
            {query.data?.total ?? 0} registo{(query.data?.total ?? 0) === 1 ? "" : "s"} ·{" "}
            {formatBrl(total)}
          </span>
        </p>
      ) : null}

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <FieldLike label="Veículo">
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              ativo
              parceiroId={parceiroId || undefined}
              variant="filtro"
            />
          </FieldLike>
          <FieldLike label="Cliente">
            <ClienteSelect value={clienteId} onChange={setClienteId} ativo variant="filtro" />
          </FieldLike>
          <FieldLike label="Parceiro">
            <ParceiroSelect value={parceiroId} onChange={setParceiroId} ativo variant="filtro" />
          </FieldLike>
          <RelatorioPeriodoFiltro
            value={periodo}
            onChange={setPeriodo}
            hint="Filtra pela data de autuação"
          />
          <FieldLike label="Situação">
            <NativeSelect
              value={situacao}
              onChange={(v) => setSituacao(v as FiltroSituacao)}
              variant="filtro"
              allowEmpty={false}
              aria-label="Situação"
            >
              <option value="em_aberto">Em aberto</option>
              <option value="quitado">Quitadas / pagas</option>
              <option value="todos">{SELECT_LABEL_TODOS}</option>
            </NativeSelect>
          </FieldLike>
        </div>
      </section>

      <section className="form-card">
        <p className="field__hint">
          «Inferir responsáveis» aplica as mesmas regras de contrato/manutenção/reserva para multas e
          pedágios. Cliente ou parceiro ficam como <strong>sugestão</strong> até confirmar na linha
          (ou escolher outro responsável).
        </p>
      </section>

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={atribuirLoading}
          onClick={() => void atribuirClientes(true)}
        >
          Preview inferir
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={atribuirLoading}
          onClick={() => void atribuirClientes(false)}
        >
          Inferir responsáveis
        </button>
      </div>

      <FlashError message={atribuirError} />
      <ResultPanel title="Inferência de responsáveis" data={atribuirResult} />

      {query.isError ? (
        <QueryError
          message={
            query.error instanceof LanzaApiError
              ? query.error.message
              : "Falha ao listar infrações."
          }
        />
      ) : null}

      <DataTable
        loading={loading}
        rows={rows}
        keyFn={(i) => i.id}
        emptyMessage={
          temFiltro ? "Nenhuma infração corresponde aos filtros." : "Nenhuma infração encontrada."
        }
        columns={[
          {
            key: "auto",
            header: "Auto",
            sortValue: (i) => i.numeroAuto ?? "",
            render: (i) => <strong>{i.numeroAuto}</strong>,
          },
          {
            key: "placa",
            header: "Placa",
            sortValue: (i) => formatPlaca(i.veiculoId),
            render: (i) => formatPlaca(i.veiculoId),
          },
          {
            key: "desc",
            header: "Descrição",
            sortValue: (i) => i.descricao ?? "",
            render: (i) => (
              <span className="infracao-desc" title={i.descricao}>
                {i.descricao ?? "—"}
              </span>
            ),
          },
          {
            key: "data",
            header: "Autuação",
            sortValue: (i) => i.dataAutuacao?.slice(0, 16) ?? "",
            render: (i) => i.dataAutuacao?.slice(0, 16) ?? "—",
          },
          {
            key: "valor",
            header: "Valor",
            className: "num",
            sortValue: (i) => valorInfracao(i),
            render: (i) => formatBrl(valorInfracao(i)),
          },
          {
            key: "situacao",
            header: "Situação",
            sortValue: (i) => situacaoLabel(i).text,
            render: (i) => {
              const s = situacaoLabel(i);
              return <span className={s.className}>{s.text}</span>;
            },
          },
          {
            key: "cliente",
            header: "Responsável",
            render: (i) => (
              <ResponsavelDebitoCell
                tipo="infracao"
                chave={i.numeroAuto}
                item={i}
                onConfirmed={() => void queryClient.invalidateQueries({ queryKey: ["infracoes"] })}
              />
            ),
          },
          {
            key: "despesa",
            header: "Despesa",
            sortValue: (i) => (i.clienteDespesaId ? 1 : 0),
            render: (i) =>
              i.clienteDespesaId ? (
                <span className="badge badge--ok">Vinculada</span>
              ) : (
                <span className="badge badge--muted">—</span>
              ),
          },
        ]}
      />
    </>
  );
}

function FieldLike({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
