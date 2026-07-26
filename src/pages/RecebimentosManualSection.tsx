import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Field, FormCard } from "@/components/FormCard";
import { DateInput } from "@/components/DateInput";
import { ClienteSelect, NativeSelect } from "@/components/EntitySelects";
import { QueryError } from "@/components/PageHeader";
import { useDespesasCliente } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError, FlashSuccess } from "@/context/ScreenFlashContext";
import type { ClienteDespesa } from "@/api/types";
import { formatBrl, formatValorInput, parseValorInput } from "@/lib/format";
import { montarOpcoesPendenciaDespesa } from "@/lib/pendenciaDespesaOpcoes";
import { isEntityUuid } from "@/lib/uuid";

function compactPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function placaDespesa(d: ClienteDespesa): string {
  return compactPlaca(String(d.placa ?? d.veiculoId ?? ""));
}

function formatPlacaFromCompact(pk: string): string {
  if (pk.length === 7) return `${pk.slice(0, 3)}-${pk.slice(3)}`;
  return pk;
}

export function RecebimentosManualSection() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const clienteIdUrl = searchParams.get("clienteId")?.trim() || "";
  const valorUrl = searchParams.get("valor")?.trim() || "";
  const despesaIdUrl = searchParams.get("despesaId")?.trim() || "";
  const dataBrUrl = searchParams.get("dataBr")?.trim() || "";

  const [clienteId, setClienteId] = useState(clienteIdUrl);
  const [despesaId, setDespesaId] = useState("");
  const [dataBr, setDataBr] = useState(dataBrUrl);
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execSuccess, setExecSuccess] = useState<string | null>(null);

  const clienteSelecionado = clienteId.trim();
  const despesasQuery = useDespesasCliente(
    {
      emAberto: true,
      ativo: true,
      clienteId: clienteSelecionado || undefined,
    },
    { enabled: Boolean(clienteSelecionado) },
  );
  const loadingDespesas =
    Boolean(clienteSelecionado) && despesasQuery.isLoading && !despesasQuery.data;

  const opcoesDespesa = useMemo(
    () => montarOpcoesPendenciaDespesa(despesasQuery.data?.items ?? []),
    [despesasQuery.data],
  );

  const despesaSel = useMemo(
    () => opcoesDespesa.find((o) => o.id === despesaId) ?? null,
    [opcoesDespesa, despesaId],
  );

  const despesaRegistro = useMemo(() => {
    if (!despesaSel) return null;
    return (
      (despesasQuery.data?.items ?? []).find((d) => d.id === despesaSel.id) ?? null
    );
  }, [despesaSel, despesasQuery.data]);

  const valorParcialHint = useMemo(() => {
    if (!despesaSel) return null;
    const pago = parseValorInput(valor);
    if (pago == null) return null;
    const diff = Math.round((despesaSel.valor - pago) * 100) / 100;
    if (diff < 0.01) return "Baixa integral da pendência selecionada.";
    if (pago > despesaSel.valor + 0.009) {
      return `Máximo permitido: ${formatBrl(despesaSel.valor)} (valor da pendência).`;
    }
    return `Baixa parcial: ${formatBrl(pago)} quitado · ${formatBrl(diff)} permanece em aberto na mesma pendência.`;
  }, [despesaSel, valor]);

  useEffect(() => {
    if (clienteIdUrl) setClienteId(clienteIdUrl);
  }, [clienteIdUrl]);

  useEffect(() => {
    if (dataBrUrl) setDataBr(dataBrUrl);
  }, [dataBrUrl]);

  useEffect(() => {
    if (!despesaIdUrl || opcoesDespesa.length === 0) return;
    const item = opcoesDespesa.find((o) => o.id === despesaIdUrl);
    if (!item) return;
    setDespesaId(item.id);
    const n = parseValorInput(valorUrl);
    setValor(formatValorInput(n != null && n <= item.valor ? n : item.valor));
  }, [despesaIdUrl, valorUrl, opcoesDespesa]);

  function onClienteChange(id: string) {
    setClienteId(id);
    setDespesaId("");
    setValor("");
  }

  function onDespesaChange(id: string) {
    setDespesaId(id);
    setExecSuccess(null);
    if (!id) {
      setValor("");
      return;
    }
    const item = opcoesDespesa.find((o) => o.id === id);
    if (item) setValor(formatValorInput(item.valor));
  }

  function placaExibicao(): string | null {
    if (!despesaRegistro) return null;
    const pk = placaDespesa(despesaRegistro);
    if (pk.length === 7) return formatPlacaFromCompact(pk);
    const bruta = String(despesaRegistro.placa ?? "").trim();
    return bruta || null;
  }

  function escopoVeiculoDespesa(d: ClienteDespesa): { veiculoId?: string; placa?: string } | null {
    const raw = d.veiculoId?.trim();
    if (raw && isEntityUuid(raw)) return { veiculoId: raw };
    const placa = d.placa?.trim() || raw;
    return placa ? { placa } : null;
  }

  function veiculoIdBaixa(): string | null {
    if (!despesaRegistro) return null;
    const escopo = escopoVeiculoDespesa(despesaRegistro);
    return escopo?.veiculoId?.trim() || null;
  }

  async function executarBaixa() {
    if (!clienteId.trim()) {
      setFormError("Selecione um cliente.");
      return;
    }
    if (!despesaSel) {
      setFormError(
        "Selecione uma pendência em aberto. Cadastre a despesa em Despesas → Cliente antes da baixa.",
      );
      return;
    }
    const escopoVeiculo = despesaRegistro ? escopoVeiculoDespesa(despesaRegistro) : null;
    if (!escopoVeiculo) {
      setFormError("A pendência selecionada não tem veículo associado.");
      return;
    }
    const valorNum = parseValorInput(valor);
    if (valorNum == null || valorNum <= 0) {
      setFormError("Informe o valor recebido.");
      return;
    }
    if (valorNum > despesaSel.valor + 0.009) {
      setFormError(
        `Valor recebido (${formatBrl(valorNum)}) não pode ser maior que o devido (${formatBrl(despesaSel.valor)}).`,
      );
      return;
    }
    if (!dataBr.trim()) {
      setFormError("Informe a data do pagamento.");
      return;
    }

    setLoading(true);
    setFormError(null);
    setExecError(null);
    setExecSuccess(null);
    try {
      const planoRes = await lanzaApi.montarPlanoRecebimento({
        clienteId: clienteId.trim(),
        ...escopoVeiculo,
        despesaId: despesaSel.id,
        valor: valorNum,
        dataBr: dataBr.trim(),
      });
      const plano = planoRes.data;
      if (!plano.linhas.length) {
        setFormError(
          plano.avisos?.[0] ?? "Nenhuma linha de baixa gerada para este pagamento.",
        );
        return;
      }

      const linhas = plano.linhas;
      const escopoVeiculoId =
        plano.despesaAlvo?.veiculoId?.trim() ||
        plano.linhas.map((l) => l.veiculoId?.trim()).find((id) => id && isEntityUuid(id)) ||
        veiculoIdBaixa() ||
        undefined;
      const r = await lanzaApi.executarRecebimento({
        linhas,
        clienteId: plano.cliente.id,
        veiculoId: escopoVeiculoId,
        despesaId: despesaSel.id,
        syncRastreame: false,
      });
      const aplicadas =
        typeof r.data === "object" &&
        r.data != null &&
        "aplicadas" in r.data &&
        typeof (r.data as { aplicadas: unknown }).aplicadas === "number"
          ? (r.data as { aplicadas: number }).aplicadas
          : linhas.length;
      setExecSuccess(
        `Baixa aplicada com sucesso (${aplicadas} linha${aplicadas === 1 ? "" : "s"}).`,
      );
      setDespesaId("");
      setValor("");
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setExecError(err instanceof LanzaApiError ? err.message : "Falha ao executar baixa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FlashError message={execError} />
      <FlashSuccess message={execSuccess} />
      <FormCard
        className="form-card--compact"
        title="Baixa manual"
        onSubmit={executarBaixa}
        loading={loading}
        submitLabel="Executar baixa"
        error={formError}
      >
        <Field label="Cliente">
          <ClienteSelect
            value={clienteId}
            onChange={onClienteChange}
            variant="cadastro"
            required
            disabled={loading}
          />
        </Field>
        {despesasQuery.isError ? (
          <QueryError
            message={
              despesasQuery.error instanceof LanzaApiError
                ? despesasQuery.error.message
                : "Falha ao carregar pendências do cliente."
            }
          />
        ) : null}
        <Field label="Data do pagamento">
          <DateInput value={dataBr} onChange={setDataBr} required disabled={loading} />
        </Field>
        <Field
          label="Pendência em aberto"
          span="wide"
          hint={
            clienteSelecionado
              ? despesaSel
                ? `Devido ${formatBrl(despesaSel.valor)} · placa ${placaExibicao() ?? "—"} · pode receber valor parcial (até o total)`
                : opcoesDespesa.length === 0
                  ? (
                      <>
                        Nenhuma pendência —{" "}
                        <Link to="/despesas/cliente/novo">cadastre a despesa</Link> antes da baixa.
                      </>
                    )
                  : "Selecione a despesa cadastrada a quitar"
              : "Selecione o cliente para listar pendências"
          }
        >
          <div className="recebimentos-valor-campos">
            <NativeSelect
              value={despesaId}
              onChange={onDespesaChange}
              variant="cadastro"
              required
              disabled={loading || !clienteSelecionado || loadingDespesas}
              loading={loadingDespesas}
              emptyLabel={
                clienteSelecionado && !loadingDespesas && opcoesDespesa.length === 0
                  ? "Nenhuma pendência em aberto"
                  : undefined
              }
              aria-label="Pendência em aberto"
            >
              {opcoesDespesa.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
              disabled={loading || !clienteSelecionado || !despesaId}
              placeholder="0,00"
              aria-label="Valor recebido"
            />
          </div>
          {valorParcialHint ? <p className="field__hint">{valorParcialHint}</p> : null}
        </Field>
      </FormCard>
    </>
  );
}
