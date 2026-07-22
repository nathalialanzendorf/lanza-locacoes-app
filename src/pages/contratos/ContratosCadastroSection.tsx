import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, NativeSelect, matchVeiculoSelectValue, placaDoVeiculo } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { Toggle } from "@/components/Toggle";
import { ValorInput } from "@/components/ValorInput";
import { ResultPanel } from "@/components/ResultPanel";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { useVeiculos, useClientes } from "@/api/hooks";
import { formatValorInput, parseValorInput } from "@/lib/format";
import {
  DIAS_PAGAMENTO_SEMANAL,
  PERIODOS_CONTRATO,
  dataFimDePeriodo,
  diaPagamentoSemanaParaSelect,
  diasEntreDatasBr,
  hojeDataBr,
  periodoDeDias,
} from "@/lib/contratoPrazo";

type ModoContrato = "criar" | "renovar";

type Props = {
  modo: ModoContrato;
  contratoId?: string;
  titulo: string;
  submitLabel?: string;
  backTo?: string;
  backLabel?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolverParcelas(
  qtdStr: string,
  valorStr: string,
  saldo: number,
  label: string,
): { parcelas: number; valorParcela: number } {
  if (saldo <= 0) {
    throw new Error(`${label}: saldo a parcelar deve ser maior que zero.`);
  }
  const qtd = qtdStr.trim() ? Number.parseInt(qtdStr, 10) : NaN;
  const valor = parseValorInput(valorStr) ?? NaN;
  const temQtd = Number.isFinite(qtd) && qtd > 0;
  const temValor = Number.isFinite(valor) && valor > 0;

  if (temQtd && temValor) {
    return { parcelas: Math.round(qtd), valorParcela: round2(valor) };
  }
  if (temQtd) {
    return { parcelas: Math.round(qtd), valorParcela: round2(saldo / qtd) };
  }
  if (temValor) {
    const parcelas = Math.max(1, Math.ceil(saldo / valor - 1e-9));
    return { parcelas, valorParcela: round2(valor) };
  }
  throw new Error(`${label}: informe a quantidade de parcelas ou o valor da parcela.`);
}

function sincronizarParcelamento(
  saldo: number,
  parcelas: string,
  valorParcela: string,
  setParcelas: (v: string) => void,
  setValorParcela: (v: string) => void,
  origem: "parcelas" | "valor" | "entrada",
) {
  if (saldo <= 0) return;
  if (origem === "parcelas") {
    const qtd = Number.parseInt(parcelas, 10);
    if (Number.isFinite(qtd) && qtd > 0) {
      setValorParcela(formatValorInput(round2(saldo / qtd)));
    }
    return;
  }
  const valor = parseValorInput(valorParcela);
  if (valor != null && valor > 0) {
    setParcelas(String(Math.max(1, Math.ceil(saldo / valor - 1e-9))));
    return;
  }
  const qtd = Number.parseInt(parcelas, 10);
  if (Number.isFinite(qtd) && qtd > 0) {
    setValorParcela(formatValorInput(round2(saldo / qtd)));
  }
}

function ParcelamentoFields({
  titulo,
  entradaLabel,
  saldo,
  entrada,
  onEntradaChange,
  parcelas,
  onParcelasChange,
  valorParcela,
  onValorParcelaChange,
  disabled,
}: {
  titulo: string;
  entradaLabel: string;
  saldo: number;
  entrada: string;
  onEntradaChange: (v: string) => void;
  parcelas: string;
  onParcelasChange: (v: string) => void;
  valorParcela: string;
  onValorParcelaChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="form-section field--full">
      <h3 className="form-section-title">{titulo}</h3>
      {saldo > 0 ? (
        <p className="form-section__lead">
          Saldo a parcelar: {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      ) : null}
      <div className="form-grid">
        <Field label={entradaLabel} hint="Deixe vazio ou 0 se nada foi pago na retirada">
          <ValorInput value={entrada} onChange={onEntradaChange} allowZero disabled={disabled} />
        </Field>
        <Field label="Quantidade de parcelas" hint="Ao digitar, calcula o valor da parcela">
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            value={parcelas}
            onChange={(e) => {
              const v = e.target.value;
              onParcelasChange(v);
              sincronizarParcelamento(saldo, v, valorParcela, onParcelasChange, onValorParcelaChange, "parcelas");
            }}
            disabled={disabled}
          />
        </Field>
        <Field label="Valor da parcela (R$)" hint="Ao digitar, calcula a quantidade de parcelas">
          <ValorInput
            value={valorParcela}
            onChange={(v) => {
              onValorParcelaChange(v);
              sincronizarParcelamento(saldo, parcelas, v, onParcelasChange, onValorParcelaChange, "valor");
            }}
            disabled={disabled}
          />
        </Field>
      </div>
    </div>
  );
}

export function ContratosCadastroSection({
  modo,
  contratoId,
  titulo,
  submitLabel = "Gerar Word/PDF",
  backTo = "/contratos",
  backLabel,
}: Props) {
  const navigate = useNavigate();
  const editando = Boolean(contratoId);
  const veiculosQuery = useVeiculos();
  const clientesQuery = useClientes();

  const [veiculoId, setVeiculoId] = useState("");
  const [cpf, setCpf] = useState("");
  const [semana, setSemana] = useState("");
  const [caucao, setCaucao] = useState("");
  const [diaPagamento, setDiaPagamento] = useState<string>(DIAS_PAGAMENTO_SEMANAL[0]!.value);
  const periodoInicial = modo === "renovar" ? "3 meses" : "semana";
  const inicioInicial = hojeDataBr();
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [dataInicio, setDataInicio] = useState(inicioInicial);
  const [dataFim, setDataFim] = useState(() => dataFimDePeriodo(inicioInicial, periodoInicial));
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState(false);
  const [parcelarCaucao, setParcelarCaucao] = useState(false);
  const [parcelarSemana, setParcelarSemana] = useState(false);
  const [caucaoEntrada, setCaucaoEntrada] = useState("");
  const [caucaoParcelasN, setCaucaoParcelasN] = useState("");
  const [caucaoValorParcela, setCaucaoValorParcela] = useState("");
  const [caucaoAnterior, setCaucaoAnterior] = useState<number | null>(null);
  const [semanaEntrada, setSemanaEntrada] = useState("");
  const [semanaParcelasN, setSemanaParcelasN] = useState("");
  const [semanaValorParcela, setSemanaValorParcela] = useState("");
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  function handlePeriodoChange(valor: string) {
    setPeriodo(valor);
    setPeriodoPersonalizado(false);
    if (dataInicio.trim() && valor) {
      setDataFim(dataFimDePeriodo(dataInicio, valor));
    }
  }

  function handleDataInicioChange(valor: string) {
    setDataInicio(valor);
    if (!valor.trim()) return;
    if (periodoPersonalizado && dataFim.trim()) {
      const dias = diasEntreDatasBr(valor, dataFim);
      if (dias != null && dias > 0) return;
    }
    if (periodo && !periodoPersonalizado) {
      setDataFim(dataFimDePeriodo(valor, periodo));
    }
  }

  function handleDataFimChange(valor: string) {
    setDataFim(valor);
    if (!valor.trim() || !dataInicio.trim()) return;
    const dias = diasEntreDatasBr(dataInicio, valor);
    if (dias == null || dias <= 0) return;
    const per = periodoDeDias(dias);
    if (per) {
      setPeriodo(per);
      setPeriodoPersonalizado(false);
    } else {
      setPeriodo("");
      setPeriodoPersonalizado(true);
    }
  }

  useEffect(() => {
    if (!contratoId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterContrato(contratoId)
      .then((r) => {
        if (cancelado) return;
        const c = r.data as typeof r.data & {
          prazoDias?: number;
          valorSemanal?: number | null;
          valorCaucao?: number;
          diaPagamentoSemana?: string | null;
        };
        const veiculoRef =
          typeof c.veiculoId === "string" ? c.veiculoId : typeof c.placa === "string" ? c.placa : "";
        if (veiculoRef) {
          setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
        }
        if (c.cpf) setCpf(c.cpf);
        if (c.valorSemanal != null) setSemana(formatValorInput(c.valorSemanal));
        if (c.valorCaucao != null) {
          setCaucao(formatValorInput(c.valorCaucao));
          if (modo === "renovar") setCaucaoAnterior(c.valorCaucao);
        }
        if (c.diaPagamentoSemana) {
          setDiaPagamento(diaPagamentoSemanaParaSelect(c.diaPagamentoSemana));
        }
        if (modo === "renovar") {
          const inicio = hojeDataBr();
          const per = c.prazoDias ? periodoDeDias(c.prazoDias) || "3 meses" : "3 meses";
          setDataInicio(inicio);
          setPeriodo(per);
          setPeriodoPersonalizado(false);
          setDataFim(dataFimDePeriodo(inicio, per));
        }
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof LanzaApiError ? err.message : "Falha ao carregar contrato.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [contratoId, modo, veiculosQuery.data]);

  const caucaoNumerica = parseValorInput(caucao) ?? NaN;
  const caucaoComplementoRenovacao =
    modo === "renovar" && caucaoAnterior != null && Number.isFinite(caucaoNumerica)
      ? round2(caucaoNumerica - caucaoAnterior)
      : null;
  const mostrarParcelarCaucaoRenovacao =
    modo === "renovar" &&
    caucaoComplementoRenovacao != null &&
    caucaoComplementoRenovacao > 0;

  useEffect(() => {
    if (modo === "renovar" && !mostrarParcelarCaucaoRenovacao) {
      setParcelarCaucao(false);
    }
  }, [modo, mostrarParcelarCaucaoRenovacao]);

  const saldoCaucaoParcelavel = useMemo(() => {
    const total = parseValorInput(caucao);
    if (total == null) return 0;
    const entrada = parseValorInput(caucaoEntrada, { allowZero: true }) ?? 0;
    const base =
      modo === "renovar" && caucaoAnterior != null
        ? round2(total - caucaoAnterior)
        : total;
    return Math.max(0, round2(base - entrada));
  }, [caucao, caucaoEntrada, caucaoAnterior, modo]);

  const saldoSemanaParcelavel = useMemo(() => {
    const total = parseValorInput(semana);
    if (total == null) return 0;
    const entrada = parseValorInput(semanaEntrada, { allowZero: true }) ?? 0;
    return Math.max(0, round2(total - entrada));
  }, [semana, semanaEntrada]);

  useEffect(() => {
    if (!parcelarCaucao || saldoCaucaoParcelavel <= 0) return;
    sincronizarParcelamento(
      saldoCaucaoParcelavel,
      caucaoParcelasN,
      caucaoValorParcela,
      setCaucaoParcelasN,
      setCaucaoValorParcela,
      "entrada",
    );
  }, [saldoCaucaoParcelavel, parcelarCaucao]);

  useEffect(() => {
    if (!parcelarSemana || saldoSemanaParcelavel <= 0) return;
    sincronizarParcelamento(
      saldoSemanaParcelavel,
      semanaParcelasN,
      semanaValorParcela,
      setSemanaParcelasN,
      setSemanaValorParcela,
      "entrada",
    );
  }, [saldoSemanaParcelavel, parcelarSemana]);

  function saldoCaucaoParcelavelSubmit(caucaoTotal: number): number {
    const entrada = parseValorInput(caucaoEntrada, { allowZero: true }) ?? 0;
    const base =
      modo === "renovar" && caucaoAnterior != null
        ? round2(caucaoTotal - caucaoAnterior)
        : caucaoTotal;
    if (base <= 0) {
      throw new Error(
        modo === "renovar"
          ? "A caução da renovação deve ser maior que a do contrato anterior para parcelar o complemento."
          : "Informe um valor de caução válido para parcelamento.",
      );
    }
    return round2(base - entrada);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const caucaoTotal = parseValorInput(caucao);
      const semanaTotal = parseValorInput(semana);
      if (caucaoTotal == null) {
        throw new Error("Informe o valor da caução.");
      }
      if (semanaTotal == null) {
        throw new Error("Informe o valor semanal.");
      }
      if (!diaPagamento.trim()) {
        throw new Error("Informe o dia de pagamento semanal.");
      }

      const placa = placaDoVeiculo(veiculosQuery.data?.items, veiculoId);
      if (!placa) throw new Error("Selecione um veículo cadastrado.");
      const clienteIdBody =
        clientesQuery.data?.items.find((c) => c.cpf?.trim() === cpf.trim())?.id ?? undefined;

      const body: Record<string, unknown> = {
        veiculoId: veiculoId.trim(),
        clienteId: clienteIdBody,
        placa,
        cpf: cpf.trim() || undefined,
        semana: semanaTotal,
        caucao: caucaoTotal,
        diaPagamento: diaPagamento.trim(),
      };

      const inicio = dataInicio.trim();
      const fim = dataFim.trim();
      if (!inicio) throw new Error("Informe a data de início.");
      if (!fim) throw new Error("Informe a data fim.");
      const dias = diasEntreDatasBr(inicio, fim);
      if (dias == null || dias <= 0) {
        throw new Error("A data fim deve ser posterior à data de início.");
      }
      body.inicio = inicio;
      body.dias = dias;
      const per = periodoDeDias(dias);
      if (per) body.periodo = per;

      if (parcelarCaucao) {
        const saldo = saldoCaucaoParcelavelSubmit(caucaoTotal);
        const { parcelas, valorParcela } = resolverParcelas(
          caucaoParcelasN,
          caucaoValorParcela,
          saldo,
          modo === "renovar" ? "Complemento de caução" : "Caução",
        );
        body.caucaoParcelasN = parcelas;
        body.caucaoValorParcela = valorParcela;
        const entrada = parseValorInput(caucaoEntrada, { allowZero: true }) ?? 0;
        if (entrada > 0) {
          body.caucaoSaldoAberto = saldo;
        }
      }

      if (modo === "criar" && parcelarSemana) {
        const entrada = parseValorInput(semanaEntrada, { allowZero: true }) ?? 0;
        const saldo = round2(semanaTotal - entrada);
        const { parcelas, valorParcela } = resolverParcelas(
          semanaParcelasN,
          semanaValorParcela,
          saldo,
          "1ª semana",
        );
        body.semanaEntrada = entrada;
        body.semanaParcelasN = parcelas;
        body.semanaValorParcela = valorParcela;
      }

      const fn = modo === "criar" ? lanzaApi.criarContrato : lanzaApi.renovarContrato;
      const r = await fn(body);
      setResult(r);
      navigate("/contratos");
    } catch (err) {
      setError(
        err instanceof LanzaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha ao gerar contrato.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return (
      <>
        <CadastroBackLink to={backTo} label={backLabel} />
        <p className="muted">A carregar contrato…</p>
      </>
    );
  }

  const mostrarToggleCaucao = modo === "criar" || mostrarParcelarCaucaoRenovacao;

  return (
    <>
      <CadastroBackLink to={backTo} label={backLabel} />
      <FormCard title={titulo} onSubmit={submit} loading={loading} submitLabel={submitLabel} error={error}>
        <Field label="Veículo">
          <VeiculoSelect
            value={veiculoId}
            onChange={setVeiculoId}
            valueField="id"
            required
            variant="cadastro"
            disabled={loading}
          />
        </Field>
        <Field label="Cliente">
          <ClienteSelect value={cpf} onChange={setCpf} valueField="cpf" variant="cadastro" disabled={loading} />
        </Field>
        <Field label="Valor semanal (R$)">
          <ValorInput value={semana} onChange={setSemana} required disabled={loading} />
        </Field>
        <Field label="Caução (R$)">
          <ValorInput value={caucao} onChange={setCaucao} required disabled={loading} />
        </Field>
        <Field label="Dia de pagamento semanal" hint="Confirme o dia da cláusula 3.2 do contrato">
          <NativeSelect
            value={diaPagamento}
            onChange={setDiaPagamento}
            variant="cadastro"
            allowEmpty={false}
            disabled={loading}
            aria-label="Dia de pagamento semanal"
          >
            {DIAS_PAGAMENTO_SEMANAL.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="field--full form-grid form-grid--contrato-prazo">
          <Field label="Data início">
            <DateInput
              value={dataInicio}
              onChange={handleDataInicioChange}
              disabled={loading}
              required
            />
          </Field>
          <Field label="Tempo do contrato">
            <NativeSelect
              value={periodo}
              onChange={handlePeriodoChange}
              variant="cadastro"
              allowEmpty={false}
              disabled={loading}
              aria-label="Tempo do contrato"
            >
              {periodoPersonalizado ? <option value="">Personalizado</option> : null}
              {PERIODOS_CONTRATO.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
            {periodoPersonalizado && dataInicio.trim() && dataFim.trim() ? (
              <span className="field__hint">
                {diasEntreDatasBr(dataInicio, dataFim)} dias (ajuste pela data fim)
              </span>
            ) : null}
          </Field>
          <Field label="Data fim">
            <DateInput value={dataFim} onChange={handleDataFimChange} disabled={loading} required />
          </Field>
        </div>

        {mostrarToggleCaucao ? (
          <div className="contrato-toggles-row">
            {mostrarToggleCaucao ? (
              <Toggle
                checked={parcelarCaucao}
                onChange={setParcelarCaucao}
                disabled={loading}
                label="Parcelar caução"
              />
            ) : null}
            {modo === "criar" ? (
              <Toggle
                checked={parcelarSemana}
                onChange={setParcelarSemana}
                disabled={loading}
                label="Parcelar 1ª semana"
              />
            ) : null}
          </div>
        ) : null}

        {mostrarToggleCaucao && modo === "renovar" && caucaoAnterior != null && caucaoComplementoRenovacao != null ? (
          <p className="field__hint field--full">
            Caução anterior {caucaoAnterior.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            {" · "}
            complemento{" "}
            {caucaoComplementoRenovacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        ) : null}

        {parcelarCaucao && mostrarToggleCaucao ? (
          <ParcelamentoFields
            titulo={
              modo === "renovar"
                ? "Parcelamento do complemento de caução (cláusula 3.3)"
                : "Parcelamento da caução (cláusula 3.3)"
            }
            entradaLabel={modo === "renovar" ? "Pago na renovação (R$)" : "Pago na retirada (R$)"}
            saldo={saldoCaucaoParcelavel}
            entrada={caucaoEntrada}
            onEntradaChange={setCaucaoEntrada}
            parcelas={caucaoParcelasN}
            onParcelasChange={setCaucaoParcelasN}
            valorParcela={caucaoValorParcela}
            onValorParcelaChange={setCaucaoValorParcela}
            disabled={loading}
          />
        ) : null}

        {modo === "criar" && parcelarSemana ? (
          <ParcelamentoFields
            titulo="Parcelamento da 1ª semana (cláusula 3.2)"
            entradaLabel="Pago na retirada (R$)"
            saldo={saldoSemanaParcelavel}
            entrada={semanaEntrada}
            onEntradaChange={setSemanaEntrada}
            parcelas={semanaParcelasN}
            onParcelasChange={setSemanaParcelasN}
            valorParcela={semanaValorParcela}
            onValorParcelaChange={setSemanaValorParcela}
            disabled={loading}
          />
        ) : null}
      </FormCard>
      <ResultPanel title="Contrato gerado" data={result} />
    </>
  );
}
