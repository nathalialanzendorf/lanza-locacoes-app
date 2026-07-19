import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Field, FormCard } from "@/components/FormCard";
import { DateInput } from "@/components/DateInput";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatBrl } from "@/lib/format";
import type { PagBankPlano } from "@/api/types";

export function PagBankRecebimentosSection() {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lote, setLote] = useState<{ planos: PagBankPlano[]; semMatch: unknown[] } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [execResult, setExecResult] = useState<unknown>(null);

  async function carregarMatch() {
    setLoading(true);
    setError(null);
    setExecResult(null);
    try {
      const r = await lanzaApi.pagbankMatchPost({
        inicio: inicio.trim() || undefined,
        fim: fim.trim() || undefined,
      });
      setLote(r);
      setSel(new Set(r.planos.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha no match PagBank.");
    } finally {
      setLoading(false);
    }
  }

  async function executarSelecionados() {
    if (!lote) return;
    setLoading(true);
    setError(null);
    const resultados: unknown[] = [];
    try {
      for (const i of sel) {
        const p = lote.planos[i];
        if (!p?.plano?.linhas?.length) continue;
        const r = await lanzaApi.executarRecebimento({
          linhas: p.plano.linhas,
          syncRastreame: false,
        });
        resultados.push({ credito: p.pagbank.id, cliente: p.clienteQuery, resultado: r.data });
      }
      setExecResult(resultados);
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao executar baixas PagBank.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const planosComIndice = useMemo(
    () => (lote?.planos ?? []).map((p, index) => ({ ...p, index })),
    [lote?.planos],
  );

  return (
    <>
      <FormCard
        className="form-card--compact"
        title="Match PagBank × despesas em aberto"
        onSubmit={carregarMatch}
        loading={loading}
        submitLabel="Buscar créditos e montar planos"
        error={error}
      >
        <Field label="Início">
          <DateInput value={inicio} onChange={setInicio} disabled={loading} />
        </Field>
        <Field label="Fim">
          <DateInput value={fim} onChange={setFim} disabled={loading} />
        </Field>
      </FormCard>

      {lote ? (
        <section className="form-card">
          <h2 className="form-card__title">
            Planos ({lote.planos.length}) · Sem match: {lote.semMatch.length}
          </h2>
          <DataTable
            rows={planosComIndice}
            keyFn={(p) => p.pagbank.id}
            columns={[
              {
                key: "sel",
                header: "",
                sortable: false,
                render: (p) => (
                  <Toggle
                    checked={sel.has(p.index)}
                    onChange={() => toggle(p.index)}
                    size="compact"
                    aria-label={`Selecionar crédito ${p.index + 1}`}
                  />
                ),
              },
              { key: "cliente", header: "Cliente", sortValue: (p) => p.clienteQuery, render: (p) => p.clienteQuery },
              {
                key: "valor",
                header: "Valor",
                className: "num",
                sortValue: (p) => p.pagbank.valor,
                render: (p) => formatBrl(p.pagbank.valor),
              },
              {
                key: "data",
                header: "Data",
                sortValue: (p) => p.pagbank.dataBr,
                render: (p) => p.pagbank.dataBr,
              },
              {
                key: "confianca",
                header: "Confiança",
                sortValue: (p) => `${p.confianca}${p.revisaoManual ? " revisar" : ""}`,
                render: (p) => (
                  <span className={p.confianca === "alta" ? "badge badge--ok" : "badge badge--warn"}>
                    {p.confianca}
                    {p.revisaoManual ? " · revisar" : ""}
                  </span>
                ),
              },
              {
                key: "linhas",
                header: "Linhas",
                sortValue: (p) => p.plano.linhas.length,
                render: (p) => p.plano.linhas.length,
              },
            ]}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading || sel.size === 0}
            onClick={() => void executarSelecionados()}
          >
            Executar {sel.size} baixa(s) selecionada(s)
          </button>
        </section>
      ) : null}

      <ResultPanel title="Baixas PagBank" data={execResult} />
    </>
  );
}
