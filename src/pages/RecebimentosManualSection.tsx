import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { Field, FormCard } from "@/components/FormCard";
import { DateInput } from "@/components/DateInput";
import { ClienteSelect, VeiculoSelect, NativeSelect } from "@/components/EntitySelects";
import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { useDespesasCliente, useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import type { LinhaPlanoBaixa, PlanoBaixa, ClienteDespesa } from "@/api/types";
import { formatBrl, formatValorInput, parseValorInput } from "@/lib/format";

const ROTULO_TIPO_BAIXA: Record<NonNullable<PlanoBaixa["tipoBaixa"]>, string> = {
  integral: "Baixa integral",
  parcial: "Baixa parcial",
  integral_desconto: "Baixa integral com desconto",
};

function compactPlaca(placa: string): string {
  return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function rotuloEfeitoLinha(l: LinhaPlanoBaixa): string {
  const patch = l.patch ?? {};
  if (l.operacao === "criar" && patch.paga === true) return "Quitado (valor pago)";
  if (l.operacao === "criar") return "Nova parcela em aberto";
  if (l.operacao === "atualizar" && patch.paga === true) return "Quitado";
  if (l.operacao === "atualizar") return "Saldo em atraso";
  return "—";
}

function valorDespesaCliente(d: ClienteDespesa): number {
  const v = Number(d.valorMulta);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function placaDespesa(d: ClienteDespesa): string {
  return compactPlaca(String(d.placa ?? d.veiculoId ?? ""));
}

function formatPlacaFromCompact(pk: string): string {
  if (pk.length === 7) return `${pk.slice(0, 3)}-${pk.slice(3)}`;
  return pk;
}

export function RecebimentosManualSection() {
  const [searchParams] = useSearchParams();
  const clienteIdUrl = searchParams.get("clienteId")?.trim() || "";
  const placaUrl = searchParams.get("placa")?.trim() || "";
  const valorUrl = searchParams.get("valor")?.trim() || "";
  const despesaIdUrl = searchParams.get("despesaId")?.trim() || "";
  const dataBrUrl = searchParams.get("dataBr")?.trim() || "";

  const veiculosQuery = useVeiculos({ ativo: true });
  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState(clienteIdUrl);
  const [despesaId, setDespesaId] = useState("");
  const [dataBr, setDataBr] = useState(dataBrUrl);
  const [valor, setValor] = useState("");
  const [loadingPlano, setLoadingPlano] = useState(false);
  const [planoError, setPlanoError] = useState<string | null>(null);
  const [plano, setPlano] = useState<PlanoBaixa | null>(null);
  const [linhasSel, setLinhasSel] = useState<Set<number>>(new Set());
  const [loadingExec, setLoadingExec] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<unknown>(null);

  const veiculoSel = useMemo(
    () => (veiculosQuery.data?.items ?? []).find((v) => v.id === veiculoId) ?? null,
    [veiculosQuery.data, veiculoId],
  );

  const despesasQuery = useDespesasCliente({
    emAberto: true,
    ativo: true,
    clienteId: clienteId || undefined,
  });

  const despesasFiltradas = useMemo(() => {
    const items = despesasQuery.data?.items ?? [];
    if (!veiculoSel?.placa?.trim()) return items;
    const pk = compactPlaca(veiculoSel.placa);
    return items.filter((d) => placaDespesa(d) === pk);
  }, [despesasQuery.data, veiculoSel?.placa]);

  const opcoesDespesa = useMemo(() => {
    return despesasFiltradas
      .map((d) => {
        const valorDevido = valorDespesaCliente(d);
        if (valorDevido <= 0) return null;
        const chave = d.autoInfracao?.trim() || d.id;
        const placa = d.placa?.trim() || d.veiculoId?.trim() || "";
        return {
          id: chave,
          autoInfracao: chave,
          placa,
          valor: valorDevido,
          label: `${formatBrl(valorDevido)} · ${d.descricao ?? d.categoria ?? chave}${placa ? ` · ${placa}` : ""}`,
        };
      })
      .filter((o): o is NonNullable<typeof o> => o != null)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [despesasFiltradas]);

  const despesaSel = useMemo(
    () => opcoesDespesa.find((o) => o.id === despesaId) ?? null,
    [opcoesDespesa, despesaId],
  );

  const despesaRegistro = useMemo(() => {
    if (!despesaSel) return null;
    return (
      despesasFiltradas.find(
        (d) => (d.autoInfracao?.trim() || d.id) === despesaSel.id,
      ) ?? null
    );
  }, [despesaSel, despesasFiltradas]);

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
    if (!placaUrl || despesaSel || !veiculosQuery.data) return;
    const alvo = compactPlaca(placaUrl);
    const v = (veiculosQuery.data.items ?? []).find(
      (x) => x.placa && compactPlaca(x.placa) === alvo,
    );
    if (v) setVeiculoId(v.id);
  }, [placaUrl, despesaSel, veiculosQuery.data]);

  useEffect(() => {
    if (!despesaIdUrl || opcoesDespesa.length === 0) return;
    const item = opcoesDespesa.find((o) => o.id === despesaIdUrl);
    if (!item) return;
    setDespesaId(item.id);
    const n = parseValorInput(valorUrl);
    setValor(formatValorInput(n != null && n <= item.valor ? n : item.valor));
  }, [despesaIdUrl, valorUrl, opcoesDespesa]);

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    setDespesaId("");
    setValor("");
    if (!id || clienteId.trim()) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    setDespesaId("");
    setValor("");
    setVeiculoId("");
  }

  function onDespesaChange(id: string) {
    setDespesaId(id);
    setPlano(null);
    setExecResult(null);
    if (!id) {
      setValor("");
      return;
    }
    const item = opcoesDespesa.find((o) => o.id === id);
    if (item) setValor(formatValorInput(item.valor));
  }

  function placaBaixa(): string | null {
    if (despesaRegistro) {
      const pk = placaDespesa(despesaRegistro);
      if (pk.length === 7) return formatPlacaFromCompact(pk);
      const bruta = String(despesaRegistro.placa ?? despesaRegistro.veiculoId ?? "").trim();
      if (bruta) return bruta;
    }
    return null;
  }

  async function montarPlano() {
    if (!clienteId.trim()) {
      setPlanoError("Selecione um cliente.");
      return;
    }
    if (!despesaSel) {
      setPlanoError(
        "Selecione uma pendência em aberto. Cadastre a despesa em Despesas → Cliente antes da baixa.",
      );
      return;
    }
    const placa = placaBaixa();
    if (!placa) {
      setPlanoError("A pendência selecionada não tem placa associada.");
      return;
    }
    const valorNum = parseValorInput(valor);
    if (valorNum == null || valorNum <= 0) {
      setPlanoError("Informe o valor recebido.");
      return;
    }
    if (valorNum > despesaSel.valor + 0.009) {
      setPlanoError(
        `Valor recebido (${formatBrl(valorNum)}) não pode ser maior que o devido (${formatBrl(despesaSel.valor)}).`,
      );
      return;
    }
    if (!dataBr.trim()) {
      setPlanoError("Informe a data do crédito.");
      return;
    }

    setLoadingPlano(true);
    setPlanoError(null);
    setPlano(null);
    setExecResult(null);
    try {
      const r = await lanzaApi.montarPlanoRecebimento({
        clienteQuery: clienteId.trim(),
        valor: valorNum,
        dataBr: dataBr.trim(),
        placa,
        autoInfracaoAlvo: despesaSel.autoInfracao,
      });
      setPlano(r.data);
      setLinhasSel(new Set(r.data.linhas.map((l) => l.num)));
    } catch (err) {
      setPlanoError(err instanceof LanzaApiError ? err.message : "Falha ao montar plano.");
    } finally {
      setLoadingPlano(false);
    }
  }

  function toggleLinha(num: number) {
    setLinhasSel((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  async function executar() {
    if (!plano) return;
    setLoadingExec(true);
    setExecError(null);
    try {
      const linhas = plano.linhas.filter((l) => linhasSel.has(l.num));
      const r = await lanzaApi.executarRecebimento({ linhas, syncRastreame: false });
      setExecResult(r.data);
    } catch (err) {
      setExecError(err instanceof LanzaApiError ? err.message : "Falha ao executar baixa.");
    } finally {
      setLoadingExec(false);
    }
  }

  return (
    <>
      <FormCard
        className="form-card--compact"
        title="Montar plano de baixa"
        onSubmit={montarPlano}
        loading={loadingPlano}
        submitLabel="Montar plano"
        error={planoError}
      >
        <Field label="Cliente">
          <ClienteSelect
            value={clienteId}
            onChange={onClienteChange}
            ativo
            variant="cadastro"
            required
            disabled={loadingPlano}
          />
        </Field>
        <Field label="Data do crédito">
          <DateInput value={dataBr} onChange={setDataBr} required disabled={loadingPlano} />
        </Field>
        <Field
          label="Pendência em aberto"
          span="wide"
          hint={
            clienteId
              ? despesaSel
                ? `Devido ${formatBrl(despesaSel.valor)} · placa ${placaBaixa() ?? "—"} · pode receber valor parcial (até o total)`
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
              disabled={loadingPlano || !clienteId || despesasQuery.isLoading}
              loading={Boolean(clienteId && despesasQuery.isLoading)}
              emptyLabel={
                clienteId && !despesasQuery.isLoading && opcoesDespesa.length === 0
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
              disabled={loadingPlano || !clienteId || !despesaId}
              placeholder="0,00"
              aria-label="Valor recebido"
            />
          </div>
          {valorParcialHint ? <p className="field__hint">{valorParcialHint}</p> : null}
        </Field>
        {!despesaSel ? (
          <Field label="Veículo (opcional)" hint="Filtrar pendências por placa">
            <VeiculoSelect
              value={veiculoId}
              onChange={onVeiculoChange}
              valueField="id"
              ativo
              disabled={loadingPlano}
              variant="cadastro"
            />
          </Field>
        ) : null}
      </FormCard>

      {plano ? (
        <section className="form-card">
          <h2 className="form-card__title">Confirmar linhas ({plano.linhas.length})</h2>
          {plano.tipoBaixa ? (
            <p className="field__hint">
              <strong>{ROTULO_TIPO_BAIXA[plano.tipoBaixa]}</strong>
              {plano.despesaAlvo
                ? ` · devido ${formatBrl(plano.despesaAlvo.valorDevido)} · recebido ${formatBrl(plano.pagamento?.valor ?? parseValorInput(valor) ?? 0)}`
                : null}
            </p>
          ) : null}
          {plano.avisos?.map((a) => (
            <p key={a} className="field__hint">
              {a}
            </p>
          ))}
          <DataTable
            rows={plano.linhas}
            keyFn={(l) => String(l.num)}
            columns={[
              {
                key: "sel",
                header: "",
                sortable: false,
                render: (l) => (
                  <Toggle
                    checked={linhasSel.has(l.num)}
                    onChange={() => toggleLinha(l.num)}
                    size="compact"
                    aria-label={`Selecionar linha ${l.num}`}
                  />
                ),
              },
              { key: "num", header: "#", sortValue: (l) => l.num, render: (l) => l.num },
              { key: "operacao", header: "Operação", sortValue: (l) => l.operacao, render: (l) => l.operacao },
              { key: "descricao", header: "Descrição", sortValue: (l) => l.descricao ?? "", render: (l) => l.descricao ?? "—" },
              {
                key: "efeito",
                header: "Efeito",
                sortValue: (l) => rotuloEfeitoLinha(l),
                render: (l) => rotuloEfeitoLinha(l),
              },
              {
                key: "valor",
                header: "Valor",
                className: "num",
                sortValue: (l) => l.total ?? 0,
                render: (l) => formatBrl(l.total ?? 0),
              },
            ]}
          />
          <p className="field__hint">Valor recebido: {formatBrl(parseValorInput(valor) ?? 0)}</p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={loadingExec || linhasSel.size === 0}
            onClick={() => void executar()}
          >
            {loadingExec ? "A aplicar…" : `Executar baixa (${linhasSel.size})`}
          </button>
          {execError ? <p className="form-card__error">{execError}</p> : null}
        </section>
      ) : null}

      <ResultPanel title="Baixa aplicada" data={execResult} />
    </>
  );
}
