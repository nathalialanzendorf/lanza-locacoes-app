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
} from "@/api/hooks";
import { StatusContrato } from "@/lib/domain";
import { formatBrl, formatPlaca, clienteExibicaoPorId } from "@/lib/format";
import { LABEL } from "@/lib/labels";
import { urlLancarRecebimento } from "@/lib/recebimentoUrl";
import {
  CATEGORIAS_RECEBIMENTO_DASHBOARD,
  classificarRecebimentosPorCategoria,
  totalLinhasRecebimento,
  type RecebimentoCategoriaClassificado,
} from "@/lib/dashboardRecebimentosDespesas";
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
  Contrato,
  DashboardRecebimentoLinha,
} from "@/api/types";

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

const COLUNAS_ATRASO: Array<{
  key: string;
  header: string;
  className?: string;
  sortValue?: (l: DashboardRecebimentoLinha) => string | number;
  render: (l: DashboardRecebimentoLinha) => ReactNode;
}> = [
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
];

function contagemLancamentosRecebimento(dados: RecebimentoCategoriaClassificado): string {
  const comVencimento = dados.venceHoje.length + dados.atrasados.length;
  if (dados.totalEmAberto <= 0) return "nenhum lançamento";
  if (comVencimento === 0) return "com vencimento futuro";
  return `${comVencimento} com vencimento hoje ou atrasado`;
}

function RecebimentosCategoriaSection({
  titulo,
  dados,
  hojeBr,
  tituloVenceHoje,
}: {
  titulo: string;
  dados: RecebimentoCategoriaClassificado;
  hojeBr: string;
  tituloVenceHoje: string;
}) {
  return (
    <div className="dashboard-recebimentos-categoria">
      <header className="dashboard-section__head dashboard-recebimentos-categoria__head">
        <h3 className="dashboard-section__title">{titulo} (em aberto)</h3>
      </header>
      <div className="stat-grid stat-grid--compact">
        <StatCard
          title={`Total ${titulo.toLowerCase()}`}
          value={formatBrl(dados.totalEmAberto)}
          hint={contagemLancamentosRecebimento(dados)}
        />
        <StatCard
          title="Vence hoje"
          value={formatBrl(totalLinhasRecebimento(dados.venceHoje))}
          hint={`${dados.venceHoje.length} locatário(s)`}
          tone="ok"
        />
        <StatCard
          title="Em atraso"
          value={formatBrl(totalLinhasRecebimento(dados.atrasados))}
          hint={`${dados.atrasados.length} locatário(s)`}
          tone="warn"
        />
      </div>

      <RecebimentosTable
        titulo={tituloVenceHoje}
        linhas={dados.venceHoje}
        colunaVeiculo="Veículo"
        mostrarAcaoRecebimento
        mostrarDescricao={false}
        dataReferenciaBr={hojeBr}
        emptyMessage={`Nenhum ${titulo.toLowerCase()} com vencimento hoje.`}
      />

      <RecebimentosTable
        titulo="Em atraso"
        linhas={dados.atrasados}
        colunaVeiculo="Veículo"
        mostrarAcaoRecebimento
        acoesCompactas
        zebraPorCliente
        dataReferenciaBr={hojeBr}
        emptyMessage={`Nenhum ${titulo.toLowerCase()} em atraso.`}
        colunasExtra={COLUNAS_ATRASO}
      />
    </div>
  );
}

export function DashboardPage() {
  const resumo = useResumo();
  const contratosQuery = useContratos({ status: StatusContrato.Ativo });
  const despesasQuery = useDespesasCliente({
    ativo: true,
    emAberto: true,
  });
  const hojeIso = hojeIsoBr();
  const hojeBr = hojeDataBr(hojeIso);
  const tituloPagamentoSemanal = `Pagamento semanal (${nomeDiaSemanaBr()})`;

  const recebimentosPorCategoria = useMemo(
    () =>
      classificarRecebimentosPorCategoria(
        despesasQuery.data?.items ?? [],
        hojeBr,
        hojeIso,
      ),
    [despesasQuery.data, hojeBr, hojeIso],
  );

  const { totalVenceHoje, totalAtrasado } = useMemo(() => {
    let venceHoje = 0;
    let atrasado = 0;
    for (const cat of CATEGORIAS_RECEBIMENTO_DASHBOARD) {
      const dados = recebimentosPorCategoria[cat.id];
      venceHoje += totalLinhasRecebimento(dados.venceHoje);
      atrasado += totalLinhasRecebimento(dados.atrasados);
    }
    return { totalVenceHoje: venceHoje, totalAtrasado: atrasado };
  }, [recebimentosPorCategoria]);

  const despesasCarregando = despesasQuery.isFetching;

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
        <div className="stat-grid stat-grid--compact dashboard-stat-row--valores">
          <StatCard
            title="Débitos cliente em aberto"
            value={
              resumo.data
                ? formatBrl(resumo.data.despesasCliente.valorEmAberto)
                : "—"
            }
            hint={
              resumo.data
                ? `${resumo.data.despesasCliente.emAberto} lançamentos`
                : resumo.isLoading
                  ? "A carregar…"
                  : undefined
            }
            tone="warn"
          />
          <StatCard
            title="Despesas parceiro em aberto"
            value={
              resumo.data
                ? formatBrl(resumo.data.despesasParceiro.valorEmAberto)
                : "—"
            }
            hint={
              resumo.data
                ? `${resumo.data.despesasParceiro.emAberto} lançamentos`
                : resumo.isLoading
                  ? "A carregar…"
                  : undefined
            }
          />
        </div>
      </section>

      <section className="dashboard-section">
        <header className="dashboard-section__head">
          <h2 className="dashboard-section__title">Contratos</h2>
        </header>
        {contratosQuery.isLoading ? (
          <p className="field__hint">A carregar listagem de contratos…</p>
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

      <section className="dashboard-section">
        <header className="dashboard-section__head">
          <h2 className="dashboard-section__title">
            Recebimentos — {hojeBr}
            {despesasCarregando ? (
              <span className="field__hint dashboard-section__loading">A carregar…</span>
            ) : null}
          </h2>
        </header>
        {despesasQuery.isError ? (
          <QueryError
            message={
              despesasQuery.error instanceof LanzaApiError
                ? despesasQuery.error.message
                : "Falha ao carregar despesas em aberto."
            }
          />
        ) : null}
        <div className="stat-grid stat-grid--compact">
          <StatCard
            title="Total vence hoje"
            value={formatBrl(totalVenceHoje)}
            hint="Semanal, caução e renegociação"
            tone="ok"
          />
          <StatCard
            title="Total em atraso"
            value={formatBrl(totalAtrasado)}
            hint="Semanal, caução e renegociação"
            tone="warn"
          />
        </div>

        {CATEGORIAS_RECEBIMENTO_DASHBOARD.map((cat) => (
          <RecebimentosCategoriaSection
            key={cat.id}
            titulo={cat.titulo}
            dados={recebimentosPorCategoria[cat.id]}
            hojeBr={hojeBr}
            tituloVenceHoje={cat.id === "semanal" ? tituloPagamentoSemanal : "Vence hoje"}
          />
        ))}
      </section>
    </PageHeader>
  );
}
