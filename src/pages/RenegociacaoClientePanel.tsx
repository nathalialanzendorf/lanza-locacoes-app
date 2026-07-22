import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Field } from "@/components/FormCard";
import { DateInput } from "@/components/DateInput";
import { ClienteSelect, VeiculoSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { lanzaApi } from "@/api/endpoints";
import { useRenegociacaoResumo } from "@/api/hooks";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { formatBrl } from "@/lib/format";
import type { RenegociacaoInput, RenegociacaoParcela, RenegociacaoPreview } from "@/api/types";

type Props = {
  clienteIdInicial?: string;
  veiculoIdInicial?: string;
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function gerarParcelasIguais(
  total: number,
  qtd: number,
  primeiraData: string,
  intervaloDias: number,
): RenegociacaoParcela[] {
  if (qtd < 1) return [];
  const base = Math.floor((total / qtd) * 100) / 100;
  let rest = total;
  const parcelas: RenegociacaoParcela[] = [];
  for (let i = 1; i <= qtd; i++) {
    const valor = i === qtd ? Math.round(rest * 100) / 100 : base;
    rest = Math.round((rest - valor) * 100) / 100;
    parcelas.push({
      numero: i,
      totalParcelas: qtd,
      valor,
      data: addDays(primeiraData, (i - 1) * intervaloDias),
    });
  }
  return parcelas;
}

function formatDataDebito(data?: string): string {
  if (!data) return "—";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString("pt-BR");
}

export function RenegociacaoClientePanel({ clienteIdInicial = "", veiculoIdInicial = "" }: Props) {
  const qc = useQueryClient();

  const [clienteId, setClienteId] = useState(clienteIdInicial);
  const [veiculoId, setVeiculoId] = useState(veiculoIdInicial);
  const [numParcelas, setNumParcelas] = useState("3");
  const [primeiraParcela, setPrimeiraParcela] = useState(hojeIso());
  const [intervaloDias, setIntervaloDias] = useState("7");

  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [parcelas, setParcelas] = useState<RenegociacaoParcela[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RenegociacaoPreview | null>(null);

  const [loadingExec, setLoadingExec] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<unknown>(null);

  const filtroParams = useMemo(
    () => ({
      clienteId: clienteId.trim() || undefined,
      veiculoId: veiculoId.trim() || undefined,
    }),
    [clienteId, veiculoId],
  );

  const resumoQuery = useRenegociacaoResumo(filtroParams, {
    enabled: Boolean(filtroParams.clienteId),
  });
  const resumo = resumoQuery.data ?? null;

  useEffect(() => {
    if (!resumo) return;
    setSelIds(new Set(resumo.debitos.map((d) => String(d.id))));
    const qtd = Math.max(1, Number(numParcelas) || 1);
    setParcelas(
      gerarParcelasIguais(resumo.soma, qtd, primeiraParcela, Math.max(1, Number(intervaloDias) || 7)),
    );
    setPreview(null);
    setExecResult(null);
  }, [resumo]);

  const totalSelecionado = useMemo(() => {
    if (!resumo) return 0;
    return resumo.debitos
      .filter((d) => selIds.has(String(d.id)))
      .reduce((s, d) => s + d.total, 0);
  }, [resumo, selIds]);

  function montarInput(): RenegociacaoInput | null {
    if (!resumo) return null;
    const gastosIds = [...selIds].map((id) => {
      const n = Number(id);
      return Number.isFinite(n) && String(n) === id ? n : id;
    });
    return {
      negociacaoCodigo: resumo.negociacaoCodigo,
      clienteId: resumo.clienteId ?? (clienteId.trim() || undefined),
      veiculoId: veiculoId.trim() || resumo.veiculoId || undefined,
      gastosIds,
      motoristaKey: resumo.motoristaKey,
      rastreavelKey: resumo.rastreavelKey,
      parcelas,
    };
  }

  function toggleDebito(id: string | number) {
    const key = String(id);
    setSelIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreview(null);
  }

  function regenerarParcelas() {
    const qtd = Math.max(1, Number(numParcelas) || 1);
    setParcelas(
      gerarParcelasIguais(
        totalSelecionado,
        qtd,
        primeiraParcela,
        Math.max(1, Number(intervaloDias) || 7),
      ),
    );
    setPreview(null);
  }

  async function fazerPreview() {
    const input = montarInput();
    if (!input || input.gastosIds.length === 0) {
      setPreviewError("Selecione ao menos um débito.");
      return;
    }
    if (input.parcelas.length === 0) {
      setPreviewError("Gere as parcelas antes do preview.");
      return;
    }
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const r = await lanzaApi.previewRenegociacao(input);
      setPreview(r);
    } catch (err) {
      setPreviewError(err instanceof LanzaApiError ? err.message : "Falha no preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function salvar() {
    const input = montarInput();
    if (!input) return;
    if (
      !window.confirm(
        "Confirmar renegociação? Os débitos serão marcados e as parcelas gravadas no cadastro.",
      )
    ) {
      return;
    }
    setLoadingExec(true);
    setExecError(null);
    try {
      const r = await lanzaApi.salvarRenegociacao(input);
      setExecResult(r);
      setPreview(r.preview);
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
      void qc.invalidateQueries({ queryKey: ["renegociacao-resumo"] });
    } catch (err) {
      setExecError(err instanceof LanzaApiError ? err.message : "Falha ao salvar renegociação.");
    } finally {
      setLoadingExec(false);
    }
  }

  return (
    <section className="reneg-panel">
      <h2 className="form-card__title">Renegociação de débitos</h2>

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Veículo</span>
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              clienteId={clienteId || undefined}
              variant="filtro"
            />
          </label>
          <label className="field">
            <span className="field__label">Cliente</span>
            <ClienteSelect value={clienteId} onChange={setClienteId} variant="filtro" />
          </label>
        </div>
        {!resumoQuery.isLoading && resumo && filtroParams.clienteId ? (
          <p className="field__hint">
            {resumo.total} débito{resumo.total === 1 ? "" : "s"} elegível
            {resumo.total === 1 ? "" : "is"} · {formatBrl(resumo.soma)}
          </p>
        ) : null}
      </section>

      {resumoQuery.isError ? (
        <QueryError
          message={
            resumoQuery.error instanceof LanzaApiError
              ? resumoQuery.error.message
              : "Falha ao consultar débitos."
          }
        />
      ) : null}

      {filtroParams.clienteId ? (
        <>
          <section className="form-card">
            <h2 className="form-card__title">Débitos no cadastro</h2>
            <DataTable
              loading={resumoQuery.isLoading}
              rows={resumo?.debitos ?? []}
              keyFn={(d) => String(d.id)}
              emptyMessage="Nenhum débito elegível para renegociação."
              columns={[
                {
                  key: "sel",
                  header: "",
                  sortable: false,
                  render: (d) => (
                    <Toggle
                      checked={selIds.has(String(d.id))}
                      onChange={() => toggleDebito(d.id)}
                      size="compact"
                      aria-label={`Selecionar débito ${d.id}`}
                    />
                  ),
                },
                { key: "id", header: "ID", sortValue: (d) => String(d.id), render: (d) => String(d.id) },
                {
                  key: "data",
                  header: "Data",
                  sortValue: (d) => formatDataDebito(d.data),
                  render: (d) => formatDataDebito(d.data),
                },
                { key: "info", header: "Descrição", sortValue: (d) => d.info, render: (d) => d.info },
                { key: "tipo", header: "Tipo", sortValue: (d) => d.tipo ?? "", render: (d) => d.tipo ?? "—" },
                {
                  key: "total",
                  header: "Total",
                  className: "num",
                  sortValue: (d) => d.total,
                  render: (d) => formatBrl(d.total),
                },
              ]}
              footer={
                resumo && resumo.debitos.length > 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <strong>Selecionados</strong>
                    </td>
                    <td className="num">
                      <strong>{formatBrl(totalSelecionado)}</strong>
                    </td>
                  </tr>
                ) : undefined
              }
            />
          </section>

          {resumo ? (
            <>
              <section className="form-card">
                <h2 className="form-card__title">Plano de parcelas</h2>
                {resumo.negociacaoCodigo ? (
                  <p className="field__hint">
                    Código da negociação: <strong>[NEGOCIADO {resumo.negociacaoCodigo}]</strong> — gerado
                    automaticamente (sequencial por cliente, inicia em 1).
                  </p>
                ) : null}
                <div className="form-grid">
                  <Field label="Nº parcelas">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={numParcelas}
                      onChange={(e) => setNumParcelas(e.target.value)}
                    />
                  </Field>
                  <Field label="1ª parcela">
                    <DateInput value={primeiraParcela} onChange={setPrimeiraParcela} format="iso" />
                  </Field>
                  <Field label="Intervalo (dias)">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={intervaloDias}
                      onChange={(e) => setIntervaloDias(e.target.value)}
                    />
                  </Field>
                </div>
                <button type="button" className="btn btn--ghost" onClick={regenerarParcelas}>
                  Recalcular parcelas ({formatBrl(totalSelecionado)})
                </button>
                {parcelas.length > 0 ? (
                  <div className="table-wrap reneg-parcelas">
                    <DataTable
                      rows={parcelas}
                      keyFn={(p) => String(p.numero)}
                      columns={[
                        {
                          key: "parcela",
                          header: "Parcela",
                          sortValue: (p) => p.numero,
                          render: (p) => `${p.numero}x${p.totalParcelas}`,
                        },
                        {
                          key: "vencimento",
                          header: "Vencimento",
                          sortValue: (p) => formatDataDebito(p.data),
                          render: (p) => formatDataDebito(p.data),
                        },
                        {
                          key: "valor",
                          header: "Valor",
                          className: "num",
                          sortValue: (p) => p.valor,
                          render: (p) => formatBrl(p.valor),
                        },
                      ]}
                    />
                  </div>
                ) : null}
              </section>

              <div className="reneg-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={loadingPreview || selIds.size === 0}
                  onClick={() => void fazerPreview()}
                >
                  {loadingPreview ? "A validar…" : "Preview (dry-run)"}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={loadingExec || selIds.size === 0 || !preview?.validacao.ok}
                  onClick={() => void salvar()}
                >
                  {loadingExec ? "A salvar…" : "Salvar"}
                </button>
              </div>

              <FlashError message={previewError} />
              <FlashError message={execError} />

              {preview ? (
                <section className="form-card">
                  <h2 className="form-card__title">Validação</h2>
                  {preview.negociacaoCodigo ? (
                    <p className="field__hint">
                      Código aplicado: <strong>[NEGOCIADO {preview.negociacaoCodigo}]</strong>
                    </p>
                  ) : null}
                  <p className={preview.validacao.ok ? "badge badge--ok" : "badge badge--danger"}>
                    Soma parcelas: {formatBrl(preview.validacao.soma)} · Diferença:{" "}
                    {formatBrl(preview.validacao.diff)} ·{" "}
                    {preview.validacao.ok ? "OK" : "Ajuste os valores antes de salvar"}
                  </p>
                </section>
              ) : null}

              <ResultPanel title="Resultado" data={execResult ?? preview} />
            </>
          ) : null}
        </>
      ) : (
        <p className="field__hint">Selecione um cliente para listar os débitos elegíveis.</p>
      )}
    </section>
  );
}
