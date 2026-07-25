import { useMemo, useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { useDespesasCliente, useInfracoes, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { CATEGORIA_ESTACIONAMENTO } from "@/lib/estacionamentoLabels";
import { formatBrl, formatPlaca } from "@/lib/format";
import { CATEGORIA_PEDAGIO } from "@/lib/pedagioLabels";
import { labelStatusResponsavel, statusResponsavel } from "@/lib/responsavelDebitoUi";
import { SELECT_LABEL_TODOS } from "@/lib/selectLabels";
import type { ClienteDespesa, Infracao, Veiculo } from "@/api/types";

type FiltroSituacao = "em_aberto" | "todos";

type PortalPassagem = {
  id: string;
  placa: string;
  dataHoraRaw?: string;
  dataHoraIso?: string | null;
  valor: number;
  praca?: string | null;
  rodovia?: string | null;
  emAberto?: boolean;
};

type PortalAviso = {
  id: string;
  placa: string;
  dataHoraRaw?: string;
  dataHoraIso?: string | null;
  valor: number;
  local?: string | null;
  emAberto?: boolean;
};

function valorInfracao(i: Infracao): number {
  return Number(i.valorMulta ?? i.valor) || 0;
}

function valorDespesa(d: ClienteDespesa): number {
  return Number(d.valorMulta) || 0;
}

function situacaoInfracao(i: Infracao): { text: string; className: string } {
  if (i.quitadaDetran) return { text: "Quitada DETRAN", className: "badge badge--ok" };
  const raw = i.situacao ?? i.status ?? "";
  if (/quitad|pago|paga/i.test(raw)) return { text: raw, className: "badge badge--ok" };
  if (/aberto|notificad|autua/i.test(raw)) return { text: raw || "Em aberto", className: "badge badge--warn" };
  return { text: raw || "—", className: "badge badge--muted" };
}

function situacaoDespesa(d: ClienteDespesa): { text: string; className: string } {
  if (d.paga) return { text: "Pago", className: "badge badge--ok" };
  const raw = d.situacao ?? "";
  if (/pago|quitad/i.test(raw)) return { text: raw, className: "badge badge--ok" };
  if (/aberto|atrasad/i.test(raw) || /ATRASADO/i.test(d.descricao ?? "")) {
    return { text: raw || "Em aberto", className: "badge badge--warn" };
  }
  return { text: raw || "—", className: "badge badge--muted" };
}

function situacaoPortal(emAberto?: boolean): { text: string; className: string } {
  if (emAberto === false) return { text: "Pago", className: "badge badge--ok" };
  if (emAberto === true) return { text: "Em aberto", className: "badge badge--warn" };
  return { text: "—", className: "badge badge--muted" };
}

function ResponsavelReadonly({ item }: { item: Infracao | ClienteDespesa }) {
  const badge = labelStatusResponsavel(statusResponsavel(item));
  return <span className={badge.className}>{badge.text}</span>;
}

function dataPortalItem(item: { dataHoraIso?: string | null; dataHoraRaw?: string }): string {
  return item.dataHoraIso?.slice(0, 16) ?? item.dataHoraRaw?.slice(0, 16) ?? "—";
}

function VeiculoResumo({ veiculo }: { veiculo: Veiculo }) {
  return (
    <dl className="veiculo-dados-resumo">
      <div>
        <dt>Placa</dt>
        <dd>
          <strong>{formatPlaca(veiculo.placa)}</strong>
        </dd>
      </div>
      <div>
        <dt>Marca / modelo</dt>
        <dd>{veiculo.marcaModelo ?? "—"}</dd>
      </div>
      <div>
        <dt>Ano</dt>
        <dd>{veiculo.anoModelo ?? "—"}</dd>
      </div>
      <div>
        <dt>Renavam</dt>
        <dd>{veiculo.renavam ?? "—"}</dd>
      </div>
      <div>
        <dt>Cor</dt>
        <dd>{veiculo.cor ?? "—"}</dd>
      </div>
      <div>
        <dt>UF registro</dt>
        <dd>{veiculo.ufRegistro ?? "—"}</dd>
      </div>
      <div>
        <dt>Parceiro</dt>
        <dd>{veiculo.parceiroNome ?? "—"}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <span className={veiculo.ativo !== false ? "badge badge--ok" : "badge badge--amber"}>
            {veiculo.ativo !== false ? "Ativo" : "Inativo"}
          </span>
        </dd>
      </div>
    </dl>
  );
}

function SecaoTitulo({
  titulo,
  total,
  valor,
  origem,
}: {
  titulo: string;
  total: number;
  valor: number;
  origem: string;
}) {
  return (
    <div className="veiculo-dados-secao__head">
      <h3 className="form-section-title">{titulo}</h3>
      <p className="form-section__lead">
        {origem} · {total} registo{total === 1 ? "" : "s"} · {formatBrl(valor)}
      </p>
    </div>
  );
}

export function RelatorioVeiculoDadosSection() {
  const [veiculoId, setVeiculoId] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("em_aberto");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [passagensPortal, setPassagensPortal] = useState<PortalPassagem[] | null>(null);
  const [avisosPortal, setAvisosPortal] = useState<PortalAviso[] | null>(null);

  const veiculoIdFiltro = veiculoId.trim() || undefined;
  const emAberto = situacao === "em_aberto" ? true : undefined;
  const portalStatus = situacao === "em_aberto" ? "aberto" : "todos";

  const veiculosQuery = useVeiculos();
  const veiculo = useMemo(
    () => veiculosQuery.data?.items.find((v) => v.id === veiculoIdFiltro),
    [veiculosQuery.data, veiculoIdFiltro],
  );
  const placa = veiculo?.placa?.trim();

  const infracoesQuery = useInfracoes(
    { veiculoId: veiculoIdFiltro, emAberto, ativo: true },
    { enabled: Boolean(veiculoIdFiltro) },
  );
  const pedagioQuery = useDespesasCliente(
    { veiculoId: veiculoIdFiltro, categoria: CATEGORIA_PEDAGIO, emAberto, ativo: true },
    { enabled: Boolean(veiculoIdFiltro) },
  );
  const estacionamentoQuery = useDespesasCliente(
    { veiculoId: veiculoIdFiltro, categoria: CATEGORIA_ESTACIONAMENTO, emAberto, ativo: true },
    { enabled: Boolean(veiculoIdFiltro) },
  );

  const infracoes = infracoesQuery.data?.items ?? [];
  const pedagios = pedagioQuery.data?.items ?? [];
  const estacionamentos = estacionamentoQuery.data?.items ?? [];

  const totalInfracoes = useMemo(() => infracoes.reduce((s, i) => s + valorInfracao(i), 0), [infracoes]);
  const totalPedagioSync = useMemo(() => pedagios.reduce((s, d) => s + valorDespesa(d), 0), [pedagios]);
  const totalEstacionamentoSync = useMemo(
    () => estacionamentos.reduce((s, d) => s + valorDespesa(d), 0),
    [estacionamentos],
  );
  const totalPedagioPortal = useMemo(
    () => (passagensPortal ?? []).reduce((s, p) => s + (Number(p.valor) || 0), 0),
    [passagensPortal],
  );
  const totalEstacionamentoPortal = useMemo(
    () => (avisosPortal ?? []).reduce((s, a) => s + (Number(a.valor) || 0), 0),
    [avisosPortal],
  );

  const loading =
    Boolean(veiculoIdFiltro) &&
    (infracoesQuery.isLoading || pedagioQuery.isLoading || estacionamentoQuery.isLoading);

  function limparPortal() {
    setPassagensPortal(null);
    setAvisosPortal(null);
    setPortalError(null);
  }

  function handleVeiculoChange(id: string) {
    setVeiculoId(id);
    limparPortal();
  }

  function handleSituacaoChange(valor: FiltroSituacao) {
    setSituacao(valor);
    limparPortal();
  }

  async function consultarPortais() {
    if (!placa) {
      setPortalError("Selecione um veículo.");
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    try {
      const [pedagio, estacionamento] = await Promise.all([
        lanzaApi.pedagioPassagens(placa, portalStatus as "aberto" | "pago" | "todos"),
        lanzaApi.estacionamentoAvisos(placa, portalStatus as "aberto" | "pago" | "todos"),
      ]);
      setPassagensPortal((pedagio.items ?? []) as PortalPassagem[]);
      setAvisosPortal((estacionamento.items ?? []) as PortalAviso[]);
    } catch (err) {
      setPortalError(err instanceof LanzaApiError ? err.message : "Falha ao consultar portais.");
    } finally {
      setPortalLoading(false);
    }
  }

  const queryError =
    infracoesQuery.error ?? pedagioQuery.error ?? estacionamentoQuery.error ?? null;

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Consulta por veículo</h2>
        <p className="field__hint">
          Visualização somente leitura dos débitos e registos do veículo: DETRAN (infrações
          sincronizadas), Pedágio Digital, SigaPay (estacionamento rotativo) e consulta live nos
          portais.
        </p>
        <div className="form-grid">
          <FieldLike label="Veículo">
            <VeiculoSelect
              value={veiculoId}
              onChange={handleVeiculoChange}
              valueField="id"
              variant="filtro"
              aria-label="Veículo"
            />
          </FieldLike>
          <FieldLike label="Situação">
            <NativeSelect
              value={situacao}
              onChange={(v) => handleSituacaoChange(v as FiltroSituacao)}
              variant="filtro"
              allowEmpty={false}
              aria-label="Situação"
            >
              <option value="em_aberto">Em aberto</option>
              <option value="todos">{SELECT_LABEL_TODOS}</option>
            </NativeSelect>
          </FieldLike>
        </div>
        {veiculoIdFiltro ? (
          <div className="form-card__action-row">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={portalLoading || !placa}
              onClick={() => void consultarPortais()}
            >
              {portalLoading ? "Consultando portais…" : "Consultar portais (Pedágio + SigaPay)"}
            </button>
          </div>
        ) : null}
        {portalError ? <p className="form-card__error">{portalError}</p> : null}
      </section>

      {!veiculoIdFiltro ? (
        <p className="muted">Selecione um veículo para ver os dados.</p>
      ) : null}

      {veiculo ? (
        <section className="form-card veiculo-dados-veiculo">
          <h2 className="form-card__title">Veículo</h2>
          <VeiculoResumo veiculo={veiculo} />
        </section>
      ) : null}

      {queryError ? (
        <QueryError
          message={
            queryError instanceof LanzaApiError ? queryError.message : "Falha ao carregar dados."
          }
        />
      ) : null}

      {veiculoIdFiltro ? (
        <>
          <section className="form-section veiculo-dados-secao">
            <SecaoTitulo
              titulo="DETRAN — infrações"
              total={infracoes.length}
              valor={totalInfracoes}
              origem="Base local (sync DETRAN)"
            />
            <DataTable
              loading={infracoesQuery.isLoading}
              rows={infracoes}
              keyFn={(i) => i.id}
              emptyMessage="Nenhuma infração para este veículo."
              columns={[
                {
                  key: "auto",
                  header: "Auto",
                  sortValue: (i) => i.numeroAuto ?? "",
                  render: (i) => <strong>{i.numeroAuto}</strong>,
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
                  key: "local",
                  header: "Local",
                  sortValue: (i) => i.localInfracao ?? "",
                  render: (i) => i.localInfracao ?? "—",
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
                  sortValue: (i) => situacaoInfracao(i).text,
                  render: (i) => {
                    const s = situacaoInfracao(i);
                    return <span className={s.className}>{s.text}</span>;
                  },
                },
                {
                  key: "responsavel",
                  header: "Responsável",
                  render: (i) => <ResponsavelReadonly item={i} />,
                },
              ]}
            />
          </section>

          <section className="form-section veiculo-dados-secao">
            <SecaoTitulo
              titulo="Pedágio Digital"
              total={pedagios.length}
              valor={totalPedagioSync}
              origem="Base local (sync portal)"
            />
            <DataTable
              loading={pedagioQuery.isLoading}
              rows={pedagios}
              keyFn={(d) => d.id}
              emptyMessage="Nenhum pedágio sincronizado para este veículo."
              columns={[
                {
                  key: "ref",
                  header: "Ref.",
                  sortValue: (d) => d.autoInfracao ?? d.id,
                  render: (d) => <strong>{d.autoInfracao ?? d.id.slice(0, 8)}</strong>,
                },
                {
                  key: "desc",
                  header: "Descrição",
                  sortValue: (d) => d.descricao ?? "",
                  render: (d) => d.descricao ?? "—",
                },
                {
                  key: "local",
                  header: "Local",
                  sortValue: (d) => d.localInfracao ?? "",
                  render: (d) => d.localInfracao ?? "—",
                },
                {
                  key: "data",
                  header: "Passagem",
                  sortValue: (d) => d.dataAutuacao?.slice(0, 16) ?? "",
                  render: (d) => d.dataAutuacao?.slice(0, 16) ?? "—",
                },
                {
                  key: "valor",
                  header: "Valor",
                  className: "num",
                  sortValue: (d) => valorDespesa(d),
                  render: (d) => formatBrl(valorDespesa(d)),
                },
                {
                  key: "situacao",
                  header: "Situação",
                  sortValue: (d) => situacaoDespesa(d).text,
                  render: (d) => {
                    const s = situacaoDespesa(d);
                    return <span className={s.className}>{s.text}</span>;
                  },
                },
                {
                  key: "responsavel",
                  header: "Responsável",
                  render: (d) => <ResponsavelReadonly item={d} />,
                },
              ]}
            />
            {passagensPortal ? (
              <>
                <SecaoTitulo
                  titulo="Pedágio Digital — portal (live)"
                  total={passagensPortal.length}
                  valor={totalPedagioPortal}
                  origem="Consulta direta ao portal"
                />
                <DataTable
                  rows={passagensPortal}
                  keyFn={(p) => p.id}
                  emptyMessage="Nenhuma passagem no portal."
                  columns={[
                    {
                      key: "data",
                      header: "Passagem",
                      sortValue: (p) => dataPortalItem(p),
                      render: (p) => dataPortalItem(p),
                    },
                    {
                      key: "local",
                      header: "Praça / rodovia",
                      sortValue: (p) => `${p.praca ?? ""} ${p.rodovia ?? ""}`,
                      render: (p) => [p.praca, p.rodovia].filter(Boolean).join(" · ") || "—",
                    },
                    {
                      key: "valor",
                      header: "Valor",
                      className: "num",
                      sortValue: (p) => p.valor,
                      render: (p) => formatBrl(p.valor),
                    },
                    {
                      key: "situacao",
                      header: "Situação",
                      sortValue: (p) => situacaoPortal(p.emAberto).text,
                      render: (p) => {
                        const s = situacaoPortal(p.emAberto);
                        return <span className={s.className}>{s.text}</span>;
                      },
                    },
                  ]}
                />
              </>
            ) : null}
          </section>

          <section className="form-section veiculo-dados-secao">
            <SecaoTitulo
              titulo="SigaPay — estacionamento rotativo"
              total={estacionamentos.length}
              valor={totalEstacionamentoSync}
              origem="Base local (sync portal)"
            />
            <DataTable
              loading={estacionamentoQuery.isLoading}
              rows={estacionamentos}
              keyFn={(d) => d.id}
              emptyMessage="Nenhum estacionamento sincronizado para este veículo."
              columns={[
                {
                  key: "ref",
                  header: "Ref.",
                  sortValue: (d) => d.autoInfracao ?? d.id,
                  render: (d) => <strong>{d.autoInfracao ?? d.id.slice(0, 8)}</strong>,
                },
                {
                  key: "desc",
                  header: "Descrição",
                  sortValue: (d) => d.descricao ?? "",
                  render: (d) => d.descricao ?? "—",
                },
                {
                  key: "local",
                  header: "Local",
                  sortValue: (d) => d.localInfracao ?? "",
                  render: (d) => d.localInfracao ?? "—",
                },
                {
                  key: "data",
                  header: "Aviso",
                  sortValue: (d) => d.dataAutuacao?.slice(0, 16) ?? "",
                  render: (d) => d.dataAutuacao?.slice(0, 16) ?? "—",
                },
                {
                  key: "valor",
                  header: "Valor",
                  className: "num",
                  sortValue: (d) => valorDespesa(d),
                  render: (d) => formatBrl(valorDespesa(d)),
                },
                {
                  key: "situacao",
                  header: "Situação",
                  sortValue: (d) => situacaoDespesa(d).text,
                  render: (d) => {
                    const s = situacaoDespesa(d);
                    return <span className={s.className}>{s.text}</span>;
                  },
                },
                {
                  key: "responsavel",
                  header: "Responsável",
                  render: (d) => <ResponsavelReadonly item={d} />,
                },
              ]}
            />
            {avisosPortal ? (
              <>
                <SecaoTitulo
                  titulo="SigaPay — portal (live)"
                  total={avisosPortal.length}
                  valor={totalEstacionamentoPortal}
                  origem="Consulta direta ao portal"
                />
                <DataTable
                  rows={avisosPortal}
                  keyFn={(a) => a.id}
                  emptyMessage="Nenhum aviso no portal."
                  columns={[
                    {
                      key: "data",
                      header: "Aviso",
                      sortValue: (a) => dataPortalItem(a),
                      render: (a) => dataPortalItem(a),
                    },
                    {
                      key: "local",
                      header: "Local",
                      sortValue: (a) => a.local ?? "",
                      render: (a) => a.local ?? "—",
                    },
                    {
                      key: "valor",
                      header: "Valor",
                      className: "num",
                      sortValue: (a) => a.valor,
                      render: (a) => formatBrl(a.valor),
                    },
                    {
                      key: "situacao",
                      header: "Situação",
                      sortValue: (a) => situacaoPortal(a.emAberto).text,
                      render: (a) => {
                        const s = situacaoPortal(a.emAberto);
                        return <span className={s.className}>{s.text}</span>;
                      },
                    },
                  ]}
                />
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {loading ? <p className="muted">A carregar dados…</p> : null}
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
