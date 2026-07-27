import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { DataTable, type Column } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { PageHeader, QueryError } from "@/components/PageHeader";
import { IconRecebimento, IconRenovar } from "@/components/icons";
import {
  useResumo,
  useContratos,
  useDespesasCliente,
  useDespesasParceiro,
  useDashboardRecebimentosTotais,
  useDashboardRecebimentosAtrasados,
} from "@/api/hooks";
import { CategoriaDespesaCliente, StatusContrato } from "@/lib/domain";
import { formatBrl, formatPlaca, clienteExibicaoPorId } from "@/lib/format";
import { LABEL } from "@/lib/labels";
import { urlLancarRecebimento } from "@/lib/recebimentoUrl";
import {
  PROXIMO_VENCER_DIAS,
  alertaVencimentoContrato,
  dataFimPrevistaContrato,
  hojeDataBr,
  hojeIsoBr,
  nomeDiaSemanaBr,
  ordenarContratosRenovacao,
  rotuloAlertaVencimento,
  rowClassVencimentoContrato,
} from "@/lib/contratoVencimento";
import { LanzaApiError } from "@/api/client";
import type {
  ClienteDespesa,
  Contrato,
  DashboardRecebimentoLinha,
  DashboardRecebimentosTotaisResponse,
} from "@/api/types";

function despesaParaLinhaRecebimento(d: ClienteDespesa): DashboardRecebimentoLinha {
  return {
    clienteId: d.clienteId ?? d.condutorId ?? null,
    clienteNome: d.clienteNome ?? null,
    placa: d.placa ?? "",
    veiculo: d.veiculoLabel ?? d.placa ?? "",
    despesaId: d.id,
    descricao: d.descricao ?? null,
    valor: Number(d.valorMulta) || 0,
    vencimentoBr: d.vencimentoBr ?? null,
  };
}

const RECEBIMENTOS_TOTAIS_VAZIO: DashboardRecebimentosTotaisResponse = {
  dataReferenciaBr: "—",
  tituloPagamentoSemanal: "Pagamento semanal",
  totais: { venceHoje: 0, atrasado: 0, semanal: 0, caucao: 0, renegociacao: 0 },
  contagens: { venceHoje: 0, atrasados: 0 },
};

function vencimentoRecebimentoLinha(l: DashboardRecebimentoLinha): string {
  if (l.vencimentosBr?.length) return l.vencimentosBr.join(", ");
  return l.vencimentoBr?.trim() || "—";
}

function alertaAtrasoRecebimento(l: DashboardRecebimentoLinha): ReactNode {
  const dias = l.diasAtraso;
  if (dias == null || dias <= 0) return "—";
  return <span className="badge badge--danger">Vencido há {dias} dia(s)</span>;
}

function chaveClienteLinha(l: DashboardRecebimentoLinha): string {
  const id = l.clienteId?.trim();
  if (id) return `id:${id}`;
  return `nome:${(l.clienteNome ?? "").trim().toLocaleLowerCase("pt-BR")}`;
}

/** Índice de grupo por cliente (0, 0, 1, 1, 2…) para zebra na tabela. */
function indiceGrupoPorCliente(linhas: DashboardRecebimentoLinha[]): number[] {
  const indices: number[] = [];
  let grupo = -1;
  let ultimoCliente: string | null = null;
  for (const l of linhas) {
    const chave = chaveClienteLinha(l);
    if (chave !== ultimoCliente) {
      grupo += 1;
      ultimoCliente = chave;
    }
    indices.push(grupo);
  }
  return indices;
}

function RecebimentosTable({
  titulo,
  linhas,
  colunasExtra,
  colunaVeiculo = "Placa",
  mostrarAcaoRecebimento = false,
  mostrarDescricao = true,
  acoesCompactas = false,
  dataReferenciaBr,
  zebraPorCliente = false,
  emptyMessage = "Nenhum registo para hoje.",
}: {
  titulo: string;
  linhas: DashboardRecebimentoLinha[];
  colunasExtra?: Array<{
    key: string;
    header: string;
    className?: string;
    sortValue?: (l: DashboardRecebimentoLinha) => string | number;
    render: (l: DashboardRecebimentoLinha) => ReactNode;
  }>;
  colunaVeiculo?: "Placa" | "Veículo";
  mostrarAcaoRecebimento?: boolean;
  mostrarDescricao?: boolean;
  acoesCompactas?: boolean;
  dataReferenciaBr?: string;
  zebraPorCliente?: boolean;
  emptyMessage?: string;
}) {
  const gruposCliente = zebraPorCliente ? indiceGrupoPorCliente(linhas) : null;

  const rowIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    linhas.forEach((l, i) => {
      map.set(l.despesaId ?? `${l.clienteId ?? "—"}-${l.placa}-${l.vencimentoBr ?? ""}`, i);
    });
    return map;
  }, [linhas]);

  const columns = useMemo(() => {
    const cols: Column<DashboardRecebimentoLinha>[] = [
      {
        key: "cliente",
        header: "Cliente",
        sortValue: (l) => l.clienteNome?.trim() || "—",
        render: (l) => l.clienteNome?.trim() || "—",
      },
      {
        key: "veiculo",
        header: colunaVeiculo,
        sortValue: (l) => (colunaVeiculo === "Veículo" ? l.veiculo ?? l.placa : l.placa),
        render: (l) => (colunaVeiculo === "Veículo" ? l.veiculo ?? l.placa : l.placa),
      },
    ];
    if (mostrarDescricao) {
      cols.push({
        key: "descricao",
        header: "Descrição",
        sortValue: (l) => l.descricao?.trim() || "",
        render: (l) => l.descricao?.trim() || "—",
      });
    }
    for (const col of colunasExtra ?? []) {
      cols.push({
        key: col.key,
        header: col.header,
        className: col.className,
        sortValue: col.sortValue ?? ((l) => String(col.render(l) ?? "")),
        render: col.render,
      });
    }
    cols.push({
      key: "valor",
      header: "Valor",
      className: "num",
      sortValue: (l) => l.valor,
      render: (l) => formatBrl(l.valor),
    });
    if (mostrarAcaoRecebimento) {
      cols.push({
        key: "acoes",
        header: "Ação",
        className: "col-acoes",
        sortable: false,
        render: (l) => {
          const recebimentoTo = urlLancarRecebimento(l, dataReferenciaBr);
          return recebimentoTo ? (
            <Link
              to={recebimentoTo}
              className="btn btn--icon btn--icon-ok"
              aria-label={LABEL.lancarRecebimento}
              title={LABEL.lancarRecebimento}
            >
              <IconRecebimento className="row-actions__icon" />
            </Link>
          ) : (
            "—"
          );
        },
      });
    }
    return cols;
  }, [
    colunaVeiculo,
    colunasExtra,
    dataReferenciaBr,
    mostrarAcaoRecebimento,
    mostrarDescricao,
  ]);

  return (
    <section
      className={`form-card dashboard-recebimentos${acoesCompactas ? " dashboard-recebimentos--acoes-compactas" : ""}${zebraPorCliente ? " dashboard-recebimentos--zebra-cliente" : ""}`}
    >
      <header className="dashboard-recebimentos__head">
        <h3 className="form-card__title">{titulo}</h3>
        <span className="field__hint">{linhas.length} locatário(s)</span>
      </header>
      <DataTable
        rows={linhas}
        columns={columns}
        keyFn={(l) => l.despesaId ?? `${l.clienteId ?? "—"}-${l.placa}-${l.vencimentoBr ?? ""}`}
        emptyMessage={emptyMessage}
        rowClassName={(l) => {
          if (!zebraPorCliente || !gruposCliente) return undefined;
          const key = l.despesaId ?? `${l.clienteId ?? "—"}-${l.placa}-${l.vencimentoBr ?? ""}`;
          const index = rowIndexByKey.get(key);
          if (index == null) return undefined;
          return gruposCliente[index] % 2 === 1 ? "row--cliente-alt" : undefined;
        }}
      />
    </section>
  );
}

function ContratosVencimentoTable({
  titulo,
  linhas,
  hojeIso,
  vazio,
  clientes,
}: {
  titulo: string;
  linhas: Contrato[];
  hojeIso: string;
  vazio: string;
  clientes?: { id: string; nome?: string; ativo?: boolean }[];
}) {
  return (
    <section className="form-card dashboard-recebimentos">
      <header className="dashboard-recebimentos__head">
        <h3 className="form-card__title">{titulo}</h3>
        <span className="field__hint">{linhas.length} contrato{linhas.length === 1 ? "" : "s"}</span>
      </header>
      <DataTable
        rows={linhas}
        keyFn={(c) => c.id}
        emptyMessage={vazio}
        rowClassName={(c) => rowClassVencimentoContrato(c, hojeIso)}
        columns={[
          {
            key: "cliente",
            header: "Cliente",
            sortValue: (c) => clienteExibicaoPorId(clientes, c.clienteId, c.clienteNome),
            render: (c) => clienteExibicaoPorId(clientes, c.clienteId, c.clienteNome),
          },
          {
            key: "placa",
            header: "Placa",
            sortValue: (c) => formatPlaca(c.placa ?? c.veiculo?.placa ?? undefined),
            render: (c) => formatPlaca(c.placa ?? c.veiculo?.placa ?? undefined),
          },
          {
            key: "fim",
            header: "Fim previsto",
            sortValue: (c) => dataFimPrevistaContrato(c) ?? "",
            render: (c) => dataFimPrevistaContrato(c) ?? "—",
          },
          {
            key: "alerta",
            header: "Alerta",
            sortValue: (c) => rotuloAlertaVencimento(dataFimPrevistaContrato(c), hojeIso) ?? "",
            render: (c) => {
              const fim = dataFimPrevistaContrato(c);
              const alerta = alertaVencimentoContrato(fim, hojeIso);
              const rotulo = rotuloAlertaVencimento(fim, hojeIso);
              return rotulo ? (
                <span className={alerta === "vencido" ? "badge badge--danger" : "badge badge--warn"}>
                  {rotulo}
                </span>
              ) : (
                "—"
              );
            },
          },
          {
            key: "acoes",
            header: "Ação",
            className: "col-acoes",
            sortable: false,
            render: (c) => (
              <Link
                to={`/contratos/renovar?id=${encodeURIComponent(c.id)}`}
                className="btn btn--icon"
                aria-label="Renovar"
                title="Renovar"
              >
                <IconRenovar className="row-actions__icon" />
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

export function DashboardPage() {
  const resumo = useResumo();
  const contratosQuery = useContratos({ status: StatusContrato.Ativo });
  const despesasClienteQuery = useDespesasCliente({ ativo: true, emAberto: true });
  const despesasParceiroQuery = useDespesasParceiro({ emAberto: true });
  const recebimentosTotaisQuery = useDashboardRecebimentosTotais();
  const recebimentosAtrasadosQuery = useDashboardRecebimentosAtrasados();
  const rec = recebimentosTotaisQuery.data ?? RECEBIMENTOS_TOTAIS_VAZIO;
  const hojeIso = hojeIsoBr();
  const hojeBr = hojeDataBr(hojeIso);
  const tituloPagamentoSemanal = `Pagamento semanal (${nomeDiaSemanaBr()})`;

  const despesasVenceHojeQuery = useDespesasCliente({
    ativo: true,
    emAberto: true,
    categoria: CategoriaDespesaCliente.LocacaoSemanal,
    dataInicial: hojeBr,
    dataFinal: hojeBr,
  });

  const linhasVenceHoje = useMemo(
    () => (despesasVenceHojeQuery.data?.items ?? []).map(despesaParaLinhaRecebimento),
    [despesasVenceHojeQuery.data],
  );

  const totalVenceHoje = useMemo(
    () => linhasVenceHoje.reduce((s, l) => s + l.valor, 0),
    [linhasVenceHoje],
  );

  const contratosVencimento = useMemo(() => {
    const vencidos: Contrato[] = [];
    const aVencer: Contrato[] = [];
    for (const c of contratosQuery.data?.items ?? []) {
      const alerta = alertaVencimentoContrato(dataFimPrevistaContrato(c), hojeIso);
      if (alerta === "vencido") vencidos.push(c);
      else if (alerta === "proximo") aVencer.push(c);
    }
    vencidos.sort((a, b) => ordenarContratosRenovacao(a, b, hojeIso));
    aVencer.sort((a, b) => ordenarContratosRenovacao(a, b, hojeIso));
    return { vencidos, aVencer };
  }, [contratosQuery.data, hojeIso]);

  const totaisDespesasCliente = useMemo(() => {
    const items = despesasClienteQuery.data?.items ?? [];
    return {
      emAberto: items.length,
      valorEmAberto: items.reduce((s, d) => s + (Number(d.valorMulta) || 0), 0),
    };
  }, [despesasClienteQuery.data]);

  const totaisDespesasParceiro = useMemo(() => {
    const items = despesasParceiroQuery.data?.items ?? [];
    return {
      emAberto: items.length,
      valorEmAberto: items.reduce((s, d) => s + (Number(d.valor) || 0), 0),
    };
  }, [despesasParceiroQuery.data]);

  const contratosAtivos = contratosQuery.data?.items.length ?? 0;

  return (
    <PageHeader
      title="Dashboard"
      description="Visão geral da frota, contratos e pendências financeiras."
    >
      {resumo.isError ? (
        <QueryError
          message={
            resumo.error instanceof LanzaApiError
              ? resumo.error.message
              : "Falha ao carregar totais do dashboard."
          }
        />
      ) : null}

      <section className="dashboard-section">
        <header className="dashboard-section__head">
          <h2 className="dashboard-section__title">Veículos</h2>
        </header>
        <div className="stat-grid stat-grid--compact">
          <StatCard
            title="Veículos locados"
            value={resumo.data ? `${resumo.data.veiculos.locados}` : "—"}
            hint={
              resumo.data
                ? `${resumo.data.veiculos.ativos} operacionais`
                : undefined
            }
            tone="ok"
          />
          <StatCard
            title="Veículos não locados"
            value={resumo.data ? `${resumo.data.veiculos.naoLocados}` : "—"}
            hint={
              resumo.data
                ? `${resumo.data.veiculos.ativos} operacionais`
                : undefined
            }
          />
          <StatCard
            title="Infrações autuadas"
            value={resumo.data ? `${resumo.data.infracoes.notificadas}` : "—"}
            hint="sem boleto"
            tone="warn"
          />
          <StatCard
            title="Infrações notificada"
            value={resumo.data ? `${resumo.data.infracoes.emAbertoDebito}` : "—"}
            hint="boleto gerado"
            tone="warn"
          />
          <StatCard
            title="Infrações sem responsável"
            value={resumo.data ? `${resumo.data.infracoes.semResponsavel}` : "—"}
            hint={
              resumo.data ? `${resumo.data.infracoes.emAberto} no total` : undefined
            }
            tone="warn"
          />
        </div>
      </section>

      <section className="dashboard-section">
        <header className="dashboard-section__head">
          <h2 className="dashboard-section__title">Valores</h2>
        </header>
        {despesasClienteQuery.isLoading || despesasParceiroQuery.isLoading ? (
          <p className="field__hint">A carregar débitos…</p>
        ) : despesasClienteQuery.isError || despesasParceiroQuery.isError ? (
          <QueryError
            message={
              despesasClienteQuery.error instanceof LanzaApiError
                ? despesasClienteQuery.error.message
                : despesasParceiroQuery.error instanceof LanzaApiError
                  ? despesasParceiroQuery.error.message
                  : "Falha ao carregar débitos em aberto."
            }
          />
        ) : (
          <div className="stat-grid stat-grid--compact">
            <StatCard
              title="Débitos cliente em aberto"
              value={formatBrl(totaisDespesasCliente.valorEmAberto)}
              hint={`${totaisDespesasCliente.emAberto} lançamentos`}
              tone="warn"
            />
            <StatCard
              title="Despesas parceiro em aberto"
              value={formatBrl(totaisDespesasParceiro.valorEmAberto)}
              hint={`${totaisDespesasParceiro.emAberto} lançamentos`}
            />
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <header className="dashboard-section__head">
          <h2 className="dashboard-section__title">Contratos</h2>
        </header>
        {contratosQuery.isLoading ? (
          <p className="field__hint">A carregar contratos…</p>
        ) : contratosQuery.isError ? (
          <QueryError
            message={
              contratosQuery.error instanceof LanzaApiError
                ? contratosQuery.error.message
                : "Falha ao listar contratos."
            }
          />
        ) : (
          <>
            <div className="stat-grid stat-grid--compact">
              <StatCard
                title="Contratos ativos"
                value={`${contratosAtivos}`}
                tone="ok"
              />
              <StatCard
                title="Vencidos"
                value={`${contratosVencimento.vencidos.length}`}
                tone="warn"
              />
              <StatCard
                title={`A vencer (${PROXIMO_VENCER_DIAS} dias)`}
                value={`${contratosVencimento.aVencer.length}`}
                tone="warn"
              />
            </div>
            <ContratosVencimentoTable
              titulo="Vencidos"
              linhas={contratosVencimento.vencidos}
              hojeIso={hojeIso}
              vazio="Nenhum contrato ativo vencido."
            />
            <ContratosVencimentoTable
              titulo={`A vencer (próximos ${PROXIMO_VENCER_DIAS} dias)`}
              linhas={contratosVencimento.aVencer}
              hojeIso={hojeIso}
              vazio="Nenhum contrato a vencer nos próximos 14 dias."
            />
          </>
        )}
      </section>

      {recebimentosTotaisQuery.isLoading ? (
        <p className="field__hint">A carregar recebimentos…</p>
      ) : recebimentosTotaisQuery.isError ? (
        <QueryError
          message={
            recebimentosTotaisQuery.error instanceof LanzaApiError
              ? recebimentosTotaisQuery.error.message
              : "Falha ao carregar totais de recebimentos."
          }
        />
      ) : (
        <>
          <section className="dashboard-section">
            <header className="dashboard-section__head">
              <h2 className="dashboard-section__title">
                Recebimentos — {hojeBr}
              </h2>
            </header>
            <div className="stat-grid stat-grid--compact">
              <StatCard
                title="Total vence hoje"
                value={formatBrl(totalVenceHoje)}
                hint={`${linhasVenceHoje.length} locatário(s)`}
                tone="ok"
              />
              <StatCard
                title="Total em atraso"
                value={formatBrl(rec.totais.atrasado)}
                hint={`${rec.contagens.atrasados} locatário(s)`}
                tone="warn"
              />
              <StatCard
                title="Semanal em aberto"
                value={formatBrl(rec.totais.semanal)}
                hint="Parcelas semanais (nominal)"
              />
              <StatCard
                title="Caução em aberto"
                value={formatBrl(rec.totais.caucao)}
              />
              <StatCard
                title="Renegociação em aberto"
                value={formatBrl(rec.totais.renegociacao)}
              />
            </div>

            {despesasVenceHojeQuery.isLoading ? (
              <p className="field__hint">A carregar pagamentos de hoje…</p>
            ) : despesasVenceHojeQuery.isError ? (
              <QueryError
                message={
                  despesasVenceHojeQuery.error instanceof LanzaApiError
                    ? despesasVenceHojeQuery.error.message
                    : "Falha ao listar pagamentos semanais de hoje."
                }
              />
            ) : (
              <RecebimentosTable
                titulo={tituloPagamentoSemanal}
                linhas={linhasVenceHoje}
                colunaVeiculo="Veículo"
                mostrarAcaoRecebimento
                mostrarDescricao={false}
                dataReferenciaBr={hojeBr}
              />
            )}

            {recebimentosAtrasadosQuery.isLoading ? (
              <p className="field__hint">A carregar recebimentos em atraso…</p>
            ) : recebimentosAtrasadosQuery.isError ? (
              <QueryError
                message={
                  recebimentosAtrasadosQuery.error instanceof LanzaApiError
                    ? recebimentosAtrasadosQuery.error.message
                    : "Falha ao listar recebimentos em atraso."
                }
              />
            ) : (
              <RecebimentosTable
                titulo="Em atraso"
                linhas={recebimentosAtrasadosQuery.data?.items ?? []}
                colunaVeiculo="Veículo"
                mostrarAcaoRecebimento
                acoesCompactas
                zebraPorCliente
                dataReferenciaBr={hojeBr}
                emptyMessage="Nenhum recebimento em atraso."
                colunasExtra={[
                  {
                    key: "vencimento",
                    header: "Vencimento",
                    sortValue: vencimentoRecebimentoLinha,
                    render: vencimentoRecebimentoLinha,
                  },
                  {
                    key: "alerta",
                    header: "Alerta",
                    sortValue: (l) => l.diasAtraso ?? 0,
                    render: alertaAtrasoRecebimento,
                  },
                ]}
              />
            )}
          </section>
        </>
      )}
    </PageHeader>
  );
}
