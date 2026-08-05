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
import { useInfracoes, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl, formatVeiculoLabel } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { periodoPreenchido } from "@/lib/periodoRelatorio";
import { statusResponsavel } from "@/lib/responsavelDebitoUi";
import type { Infracao, Veiculo } from "@/api/types";

/** Situações DETRAN + agrupamentos usados no filtro. */
type FiltroSituacao =
  | "em_aberto"
  | "notificada"
  | "paga"
  | "advertida"
  | "justificada"
  | "cancelada"
  | "todos";

type FiltroResponsavel = "" | "parceiro_confirmado" | "cliente_confirmado" | "nao_confirmado";

type ChaveSituacao =
  | "em_aberto"
  | "notificada"
  | "paga"
  | "advertida"
  | "justificada"
  | "cancelada";

function valorInfracao(i: Infracao): number {
  return Number(i.valorMulta ?? i.valor) || 0;
}

function compactPlaca(placa: string | null | undefined): string {
  return (placa ?? "").replace(/-/g, "").trim().toUpperCase();
}

function veiculoInfracao(i: Infracao, veiculos: Veiculo[] | undefined): string {
  const ref = String(i.veiculoId ?? "").trim();
  const placaKey = compactPlaca(ref);
  const v = veiculos?.find((x) => x.id === ref || compactPlaca(x.placa) === placaKey);
  if (v) return formatVeiculoLabel(v);
  return formatVeiculoLabel({ placa: ref || undefined });
}

function normStatus(s?: string | null): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function chaveSituacaoInfracao(i: Infracao): ChaveSituacao {
  if (i.quitadaDetran === true) return "paga";

  const statusInfracao = normStatus(i.statusInfracao);
  const statusDetran = normStatus(i.statusDetran);
  const status = normStatus(i.status);
  const situacao = normStatus(i.situacao);
  const raw = statusInfracao || statusDetran || status || situacao;

  if (raw === "advertida" || raw === "advertido") return "advertida";
  if (raw === "justificada") return "justificada";
  if (raw === "cancelada" || raw === "cancelado") return "cancelada";
  if (raw === "paga" || /quitad|pago/.test(raw)) return "paga";
  if (raw === "notificada" || /notificad|autua|penalidade/.test(raw)) return "notificada";
  if (raw === "em aberto" || /aberto/.test(raw)) return "em_aberto";
  return "em_aberto";
}

function passaFiltroSituacao(i: Infracao, filtro: FiltroSituacao): boolean {
  if (filtro === "todos") return true;
  const chave = chaveSituacaoInfracao(i);
  if (filtro === "em_aberto") {
    return chave === "em_aberto" || chave === "notificada";
  }
  return chave === filtro;
}

function passaFiltroResponsavel(i: Infracao, filtro: FiltroResponsavel): boolean {
  if (!filtro) return true;
  const status = statusResponsavel(i);
  if (filtro === "parceiro_confirmado") return status === "confirmado-parceiro";
  if (filtro === "cliente_confirmado") return status === "confirmado-cliente";
  return status !== "confirmado-parceiro" && status !== "confirmado-cliente";
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
  const [responsavel, setResponsavel] = useState<FiltroResponsavel>("");
  const [atribuirLoading, setAtribuirLoading] = useState(false);
  const [atribuirResult, setAtribuirResult] = useState<unknown>(null);
  const [atribuirError, setAtribuirError] = useState<string | null>(null);

  const emAberto =
    situacao === "em_aberto" ? true : situacao === "paga" ? false : undefined;

  const query = useInfracoes({
    veiculoId: veiculoId || undefined,
    clienteId: clienteId || undefined,
    parceiroId: parceiroId || undefined,
    dataInicial: periodo.dataInicial.trim() || undefined,
    dataFinal: periodo.dataFinal.trim() || undefined,
    emAberto,
    ativo: true,
  });
  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const veiculos = veiculosQuery.data?.items;

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return items.filter(
      (i) => passaFiltroSituacao(i, situacao) && passaFiltroResponsavel(i, responsavel),
    );
  }, [query.data?.items, situacao, responsavel]);

  const temFiltro = Boolean(
    veiculoId ||
      clienteId ||
      parceiroId ||
      situacao !== "em_aberto" ||
      responsavel ||
      periodoPreenchido(periodo),
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
            {rows.length} registo{rows.length === 1 ? "" : "s"} · {formatBrl(total)}
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
              tipoFrota={TipoVeiculoFrota.Locacao}
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
              <option value="notificada">Notificada</option>
              <option value="paga">Paga</option>
              <option value="advertida">Advertida</option>
              <option value="justificada">Justificada</option>
              <option value="cancelada">Cancelada</option>
              <option value="todos">{SELECT_LABEL_TODOS}</option>
            </NativeSelect>
          </FieldLike>
          <FieldLike label="Responsável">
            <NativeSelect
              value={responsavel}
              onChange={(v) => setResponsavel(v as FiltroResponsavel)}
              variant="filtro"
              allowEmpty
              emptyLabel={SELECT_LABEL_TODOS}
              aria-label="Responsável"
            >
              <option value="parceiro_confirmado">Parceiro confirmado</option>
              <option value="cliente_confirmado">Cliente confirmado</option>
              <option value="nao_confirmado">Não confirmado</option>
            </NativeSelect>
          </FieldLike>
        </div>
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
            key: "veiculo",
            header: "Veículo",
            sortValue: (i) => veiculoInfracao(i, veiculos),
            render: (i) => veiculoInfracao(i, veiculos),
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
