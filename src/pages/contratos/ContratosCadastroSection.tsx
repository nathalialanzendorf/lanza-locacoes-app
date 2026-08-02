import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, NativeSelect, matchVeiculoSelectValue } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { TimeInput, HORA_INICIO_PADRAO, normalizeHoraBr } from "@/components/TimeInput";
import { Field, FormCard } from "@/components/FormCard";
import { Toggle } from "@/components/Toggle";
import { ValorInput } from "@/components/ValorInput";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { useVeiculos } from "@/api/hooks";
import type { Contrato } from "@/api/types";
import { formatValorInput, parseValorInput } from "@/lib/format";
import {
  DIAS_PAGAMENTO_SEMANAL,
  PERIODOS_CONTRATO,
  dataFimDePeriodo,
  diaPagamentoSemanaParaSelect,
  diasEntreDatasBr,
  labelTempoContrato,
  periodoDeDias,
  preencherPrazoRenovacao,
  hojeDataBr,
} from "@/lib/contratoPrazo";
import {
  MOTIVO_ENCERRAMENTO_OPCOES,
  MotivoEncerramento,
  STATUS_CONTRATO_OPCOES,
  StatusContrato,
  TIPO_CONTRATO_OPCOES,
  TipoContrato,
  isMotivoEncerramentoValor,
  isTipoContratoValor,
  parseStatusContrato,
  parseTipoContrato,
  type MotivoEncerramentoValor,
  type StatusContratoValor,
  type TipoContratoValor,
} from "@/lib/domain";

type ModoContrato = "criar" | "renovar" | "editar";

type Props = {
  modo: ModoContrato;
  contratoId?: string;
  /** Contrato selecionado na lista (renovar) — preenche a tela antes do GET /contratos/:id. */
  contratoOrigem?: Contrato | null;
  titulo: string;
  submitLabel?: string;
  backTo?: string;
  backLabel?: string;
};

type ContratoRenovacaoFonte = Contrato & {
  prazoDias?: number | null;
  valorSemanal?: number | null;
  valorMensal?: number | null;
  valorDiaria?: number | null;
  valorCaucao?: number | null;
  diaPagamentoSemana?: string | null;
  diaPagamentoMes?: number | null;
  diaPagamentoTexto?: string | null;
  tipoContrato?: string | null;
  contratoAssinadoStorageKey?: string | null;
  contratoAssinadoNome?: string | null;
  motivoEncerramento?: string | null;
  quebraContrato?: boolean | null;
};

const DIARIA_PADRAO = 120;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseDataInicioComHora(raw: string): { data: string; hora: string } {
  const m = raw.trim().match(/^(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?$/);
  if (m) return { data: m[1]!, hora: m[2] ?? HORA_INICIO_PADRAO };
  return { data: raw.trim(), hora: HORA_INICIO_PADRAO };
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
  contratoOrigem,
  titulo,
  submitLabel,
  backTo = "/contratos",
  backLabel,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(contratoId);
  const veiculosQuery = useVeiculos();
  const labelSubmit =
    submitLabel ??
    (modo === "editar" ? "Salvar" : modo === "renovar" ? "Confirmar renovação" : "Salvar contrato");

  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [semana, setSemana] = useState("");
  const [mensal, setMensal] = useState("");
  const [diaria, setDiaria] = useState(formatValorInput(DIARIA_PADRAO));
  const [caucao, setCaucao] = useState("");
  const [diaPagamento, setDiaPagamento] = useState<string>(DIAS_PAGAMENTO_SEMANAL[0]!.value);
  const [tipoContrato, setTipoContrato] = useState<TipoContratoValor>(TipoContrato.Semanal);
  const [diaPagamentoMes, setDiaPagamentoMes] = useState("");
  const periodoInicial = modo === "renovar" ? "3 meses" : "semana";
  const hoje = hojeDataBr();
  const prazoInicialRenovacao =
    modo === "renovar" && contratoOrigem ? preencherPrazoRenovacao(contratoOrigem) : null;
  const [periodo, setPeriodo] = useState(prazoInicialRenovacao?.periodo ?? periodoInicial);
  const [dataInicio, setDataInicio] = useState(prazoInicialRenovacao?.dataInicio ?? hoje);
  const [horaInicio, setHoraInicio] = useState(HORA_INICIO_PADRAO);
  const [dataFim, setDataFim] = useState(
    prazoInicialRenovacao?.dataFim ?? dataFimDePeriodo(hoje, periodoInicial),
  );
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState(
    prazoInicialRenovacao?.periodoPersonalizado ?? false,
  );
  const [prazoDiasContrato, setPrazoDiasContrato] = useState<number | null>(
    prazoInicialRenovacao?.prazoDias ?? null,
  );
  const [parcelarCaucao, setParcelarCaucao] = useState(false);
  const [parcelarSemana, setParcelarSemana] = useState(false);
  const [caucaoEntrada, setCaucaoEntrada] = useState("");
  const [caucaoParcelasN, setCaucaoParcelasN] = useState("");
  const [caucaoValorParcela, setCaucaoValorParcela] = useState("");
  const [caucaoAnterior, setCaucaoAnterior] = useState<number | null>(null);
  const [semanaEntrada, setSemanaEntrada] = useState("");
  const [semanaParcelasN, setSemanaParcelasN] = useState("");
  const [semanaValorParcela, setSemanaValorParcela] = useState("");
  const [carregando, setCarregando] = useState(editando && !contratoOrigem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contratoSalvoId, setContratoSalvoId] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [assinadoStorageKey, setAssinadoStorageKey] = useState<string | null>(null);
  const [assinadoNome, setAssinadoNome] = useState<string | null>(null);
  const [assinadoPendente, setAssinadoPendente] = useState<File | null>(null);
  const [statusContrato, setStatusContrato] = useState<StatusContratoValor>(StatusContrato.Ativo);
  const [dataEncerramento, setDataEncerramento] = useState("");
  const [motivoEncerramento, setMotivoEncerramento] = useState<MotivoEncerramentoValor>(
    MotivoEncerramento.Devolvido,
  );
  const [quebraContrato, setQuebraContrato] = useState(false);

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

  function aplicarContratoEdicao(c: ContratoRenovacaoFonte) {
    const veiculoRef =
      typeof c.veiculoId === "string" ? c.veiculoId : typeof c.placa === "string" ? c.placa : "";
    if (veiculoRef) {
      setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
    }
    if (c.clienteId?.trim()) {
      setClienteId(c.clienteId.trim());
    }
    if (c.valorSemanal != null) setSemana(formatValorInput(c.valorSemanal));
    if (c.valorMensal != null) setMensal(formatValorInput(c.valorMensal));
    if (c.valorDiaria != null) setDiaria(formatValorInput(c.valorDiaria));
    if (c.valorCaucao != null) setCaucao(formatValorInput(c.valorCaucao));
    if (c.diaPagamentoSemana) {
      setDiaPagamento(diaPagamentoSemanaParaSelect(c.diaPagamentoSemana));
    }
    const tipo = parseTipoContrato(c.tipoContrato);
    if (isTipoContratoValor(tipo)) setTipoContrato(tipo);
    if (c.diaPagamentoMes != null && c.diaPagamentoMes > 0) {
      setDiaPagamentoMes(String(c.diaPagamentoMes));
    }
    const inicioRaw = c.dataInicio?.trim() ?? "";
    const fim = c.dataFimPrevista?.trim() || c.dataFim?.trim() || "";
    if (inicioRaw) {
      const parsed = parseDataInicioComHora(inicioRaw);
      setDataInicio(parsed.data);
      setHoraInicio(normalizeHoraBr(c.horaInicio?.trim() ?? parsed.hora) || HORA_INICIO_PADRAO);
    } else if (c.horaInicio?.trim()) {
      setHoraInicio(normalizeHoraBr(c.horaInicio) || HORA_INICIO_PADRAO);
    }
    if (fim) setDataFim(fim);
    const dias =
      c.prazoDias ?? (inicioRaw && fim ? diasEntreDatasBr(parseDataInicioComHora(inicioRaw).data, fim) : null);
    if (dias != null && dias > 0) {
      setPrazoDiasContrato(dias);
      const per = periodoDeDias(dias);
      if (per) {
        setPeriodo(per);
        setPeriodoPersonalizado(false);
      } else {
        setPeriodo("");
        setPeriodoPersonalizado(true);
      }
    }
    if (c.contratoAssinadoStorageKey?.trim()) {
      setAssinadoStorageKey(c.contratoAssinadoStorageKey.trim());
    }
    if (c.contratoAssinadoNome?.trim()) {
      setAssinadoNome(c.contratoAssinadoNome.trim());
    }
    if (c.id?.trim()) setContratoSalvoId(c.id.trim());
    setStatusContrato(parseStatusContrato(c.status));
    setDataEncerramento(c.dataEncerramento?.trim() ?? "");
    const motivo = c.motivoEncerramento?.trim().toLowerCase();
    if (isMotivoEncerramentoValor(motivo)) setMotivoEncerramento(motivo);
    setQuebraContrato(c.quebraContrato === true);
  }

  function aplicarContratoRenovacao(c: ContratoRenovacaoFonte) {
    const veiculoRef =
      typeof c.veiculoId === "string" ? c.veiculoId : typeof c.placa === "string" ? c.placa : "";
    if (veiculoRef) {
      setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
    }
    if (c.clienteId?.trim()) {
      setClienteId(c.clienteId.trim());
    }
    if (c.valorSemanal != null) setSemana(formatValorInput(c.valorSemanal));
    if (c.valorCaucao != null) {
      setCaucao(formatValorInput(c.valorCaucao));
      setCaucaoAnterior(c.valorCaucao);
    }
    if (c.diaPagamentoSemana) {
      setDiaPagamento(diaPagamentoSemanaParaSelect(c.diaPagamentoSemana));
    }
    const tipo = parseTipoContrato(c.tipoContrato);
    if (isTipoContratoValor(tipo)) setTipoContrato(tipo);
    if (c.diaPagamentoMes != null && c.diaPagamentoMes > 0) {
      setDiaPagamentoMes(String(c.diaPagamentoMes));
    }
    const prazo = preencherPrazoRenovacao(c);
    setDataInicio(prazo.dataInicio);
    setDataFim(prazo.dataFim);
    setPeriodo(prazo.periodo);
    setPeriodoPersonalizado(prazo.periodoPersonalizado);
    setPrazoDiasContrato(prazo.prazoDias);
  }

  useEffect(() => {
    if (modo !== "renovar" || !contratoOrigem) return;
    aplicarContratoRenovacao(contratoOrigem);
  }, [modo, contratoOrigem, veiculosQuery.data]);

  useEffect(() => {
    if (modo === "editar" && motivoEncerramento === MotivoEncerramento.Troca) setQuebraContrato(false);
  }, [modo, motivoEncerramento]);

  useEffect(() => {
    if (!contratoId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterContrato(contratoId)
      .then((r) => {
        if (cancelado) return;
        if (modo === "renovar") {
          aplicarContratoRenovacao(r.data as ContratoRenovacaoFonte);
        } else if (modo === "editar") {
          aplicarContratoEdicao(r.data as ContratoRenovacaoFonte);
        } else {
          const c = r.data as ContratoRenovacaoFonte;
          const veiculoRef =
            typeof c.veiculoId === "string" ? c.veiculoId : typeof c.placa === "string" ? c.placa : "";
          if (veiculoRef) {
            setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
          }
          if (c.clienteId?.trim()) {
      setClienteId(c.clienteId.trim());
    }
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
    setSuccess(null);
    setDocError(null);
    try {
      const caucaoTotal = parseValorInput(caucao);
      const semanaTotal = parseValorInput(semana, { allowZero: true });
      const mensalTotal = parseValorInput(mensal, { allowZero: true });
      const diariaTotal = parseValorInput(diaria);
      if (caucaoTotal == null) {
        throw new Error("Informe o valor da caução.");
      }
      if (diariaTotal == null || diariaTotal <= 0) {
        throw new Error("Informe o valor da diária (usado também no cálculo de atraso).");
      }
      if (tipoContrato === TipoContrato.Semanal) {
        if (semanaTotal == null || semanaTotal <= 0) {
          throw new Error("Informe o valor semanal.");
        }
      } else if (tipoContrato === TipoContrato.Mensal) {
        if (mensalTotal == null || mensalTotal <= 0) {
          throw new Error("Informe o valor mensal.");
        }
      } else if (tipoContrato === TipoContrato.Diaria) {
        if (diariaTotal <= 0) {
          throw new Error("Informe o valor da diária do contrato.");
        }
      }
      if (!diaPagamento.trim() && tipoContrato !== TipoContrato.Mensal) {
        throw new Error("Informe o dia de pagamento semanal.");
      }
      if (tipoContrato === TipoContrato.Mensal) {
        const diaMes = Number.parseInt(diaPagamentoMes.trim(), 10);
        if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
          throw new Error("Informe o dia de pagamento mensal (1 a 31).");
        }
      }

      if (!veiculoId.trim()) throw new Error("Selecione um veículo cadastrado.");
      if (!clienteId.trim()) throw new Error("Selecione um cliente cadastrado.");

      const body: Record<string, unknown> = {
        veiculoId: veiculoId.trim(),
        clienteId: clienteId.trim(),
        semana: semanaTotal ?? 0,
        caucao: caucaoTotal,
        diaria: diariaTotal,
        tipoContrato,
        diaPagamento:
          tipoContrato === TipoContrato.Mensal
            ? `dia ${Number.parseInt(diaPagamentoMes.trim(), 10)}`
            : diaPagamento.trim(),
      };
      if (mensalTotal != null && mensalTotal > 0) body.mensal = mensalTotal;
      if (modo === "renovar" && contratoId?.trim()) {
        body.contratoRenovarId = contratoId.trim();
      }

      const inicio = dataInicio.trim();
      const hora = normalizeHoraBr(horaInicio) || HORA_INICIO_PADRAO;
      const fim = dataFim.trim();
      if (!inicio) throw new Error("Informe a data de início.");
      if (!hora) throw new Error("Informe o horário de início (HH:MM).");
      if (!fim) throw new Error("Informe a data fim.");
      const dias = diasEntreDatasBr(inicio, fim);
      if (dias == null || dias <= 0) {
        throw new Error("A data fim deve ser posterior à data de início.");
      }

      if (modo === "editar") {
        if (!contratoId?.trim()) throw new Error("Contrato não identificado.");
        const patch: Record<string, unknown> = {
          dataInicio: inicio,
          horaInicio: hora,
          dataFimPrevista: fim,
          prazoDias: dias,
          valorSemanal: semanaTotal != null && semanaTotal > 0 ? semanaTotal : null,
          valorMensal: mensalTotal != null && mensalTotal > 0 ? mensalTotal : null,
          valorDiaria: diariaTotal,
          valorCaucao: caucaoTotal,
          tipoContrato,
        };
        if (tipoContrato === TipoContrato.Mensal) {
          const diaMes = Number.parseInt(diaPagamentoMes.trim(), 10);
          patch.diaPagamentoMes = diaMes;
          patch.diaPagamentoTexto = `dia ${diaMes}`;
          patch.diaPagamentoSemana = null;
        } else {
          patch.diaPagamentoSemana = diaPagamento.trim();
          patch.diaPagamentoMes = null;
          patch.diaPagamentoTexto = diaPagamento.trim();
        }
        patch.status = statusContrato;
        if (statusContrato === StatusContrato.Encerrado) {
          if (!dataEncerramento.trim()) {
            throw new Error("Informe a data de encerramento para contratos encerrados.");
          }
          patch.dataEncerramento = dataEncerramento.trim();
          patch.motivoEncerramento = motivoEncerramento;
          patch.quebraContrato = motivoEncerramento === MotivoEncerramento.Troca ? false : quebraContrato;
        } else {
          patch.dataEncerramento = null;
          patch.motivoEncerramento = null;
          patch.quebraContrato = false;
        }
        const r = await lanzaApi.atualizarContrato(contratoId.trim(), patch);
        let contrato = r.data?.contrato;
        const idSalvo = contrato?.id ?? contratoId.trim();
        if (assinadoPendente && idSalvo) {
          const uploadRes = await lanzaApi.uploadContratoAssinado(idSalvo, assinadoPendente);
          contrato = uploadRes.data?.contrato ?? contrato;
        }
        if (idSalvo) setContratoSalvoId(idSalvo);
        if (contrato?.contratoAssinadoStorageKey) {
          setAssinadoStorageKey(contrato.contratoAssinadoStorageKey);
        }
        if (contrato?.contratoAssinadoNome) {
          setAssinadoNome(contrato.contratoAssinadoNome);
        }
        setAssinadoPendente(null);
        setSuccess("Contrato atualizado.");
        void qc.invalidateQueries({ queryKey: ["contratos"] });
        void qc.invalidateQueries({ queryKey: ["veiculos"] });
        return;
      }

      body.inicio = inicio;
      body.hora = hora;
      body.fim = fim;
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
        body.caucaoSaldoAberto = saldo;
      }

      if (modo === "criar" && parcelarSemana) {
        if (semanaTotal == null || semanaTotal <= 0) {
          throw new Error("Parcelamento da 1ª semana exige valor semanal.");
        }
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
      const payload = r as {
        data?: {
          contrato?: { id?: string };
          despesasIniciaisAviso?: string | null;
        };
      };
      const id = payload.data?.contrato?.id?.trim();
      if (id) setContratoSalvoId(id);
      const avisoDespesas = payload.data?.despesasIniciaisAviso?.trim();
      setSuccess(
        avisoDespesas
          ? `Contrato salvo no banco. Aviso: despesas iniciais não geradas — ${avisoDespesas}`
          : modo === "criar"
            ? "Contrato salvo no banco. Gere o Word/PDF quando quiser."
            : "Renovação salva no banco. Gere o Word/PDF quando quiser.",
      );
      void qc.invalidateQueries({ queryKey: ["contratos"] });
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
    } catch (err) {
      setError(
        err instanceof LanzaApiError
          ? err.status === 0
            ? "Sem resposta da API (timeout ou ligação). O contrato pode ter sido salvo — confira a lista antes de tentar de novo."
            : err.message
          : err instanceof Error
            ? err.message
            : "Falha ao salvar contrato.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function gerarDocumento(formato: "docx" | "pdf") {
    const id = contratoSalvoId ?? contratoId;
    if (!id) return;
    setDocLoading(true);
    setDocError(null);
    try {
      await lanzaApi.gerarDocumentoContrato(id, formato);
    } catch (err) {
      setDocError(
        err instanceof LanzaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha ao gerar documento.",
      );
    } finally {
      setDocLoading(false);
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
  const idDocumento = contratoSalvoId ?? (modo === "editar" ? contratoId : null);

  function handleAssinadoFile(file: File | null) {
    if (!file) return;
    setAssinadoPendente(file);
    setAssinadoNome(file.name);
    setError(null);
  }

  async function baixarContratoAssinado() {
    const id = contratoId ?? contratoSalvoId;
    if (!id?.trim()) return;
    setDocLoading(true);
    setDocError(null);
    try {
      await lanzaApi.downloadContratoAssinado(id.trim(), assinadoNome ?? undefined);
    } catch (err) {
      setDocError(
        err instanceof LanzaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha ao baixar contrato assinado.",
      );
    } finally {
      setDocLoading(false);
    }
  }

  return (
    <>
      <CadastroBackLink to={backTo} label={backLabel} />
      <FormCard
        title={titulo}
        onSubmit={submit}
        loading={loading}
        submitLabel={labelSubmit}
        error={error}
        success={success}
      >
        <Field
          label="Veículo"
          hint={
            modo === "renovar"
              ? "Troque o veículo para renovar com troca — o contrato anterior será encerrado como troca."
              : modo === "editar"
                ? "Veículo não pode ser alterado na edição."
                : undefined
          }
        >
          <VeiculoSelect
            value={veiculoId}
            onChange={setVeiculoId}
            valueField="id"
            required
            variant="cadastro"
            disabled={loading || modo === "editar"}
          />
        </Field>
        <Field label="Cliente" hint={modo === "editar" ? "Cliente não pode ser alterado na edição." : undefined}>
          <ClienteSelect
            value={clienteId}
            onChange={setClienteId}
            valueField="id"
            variant="cadastro"
            disabled={loading || modo === "editar"}
            required
          />
        </Field>
        <Field label="Tipo de contrato">
          <NativeSelect
            value={tipoContrato}
            onChange={(v) => {
              if (isTipoContratoValor(v)) setTipoContrato(v);
            }}
            variant="cadastro"
            allowEmpty={false}
            disabled={loading}
            aria-label="Tipo de contrato"
          >
            {TIPO_CONTRATO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Valor semanal (R$)"
          hint={
            tipoContrato === TipoContrato.Semanal
              ? "Valor da parcela semanal"
              : "Opcional — útil se o contrato também referencia semana"
          }
        >
          <ValorInput
            value={semana}
            onChange={setSemana}
            required={tipoContrato === TipoContrato.Semanal}
            disabled={loading}
          />
        </Field>
        <Field
          label="Valor mensal (R$)"
          hint={
            tipoContrato === TipoContrato.Mensal
              ? "Valor da parcela mensal"
              : "Opcional — preencha em contratos mensais"
          }
        >
          <ValorInput
            value={mensal}
            onChange={setMensal}
            required={tipoContrato === TipoContrato.Mensal}
            disabled={loading}
          />
        </Field>
        <Field
          label="Valor diária (R$)"
          hint={
            tipoContrato === TipoContrato.Diaria
              ? "Valor da diária do contrato"
              : "Usado no cálculo de atraso (juros/multa). Padrão R$ 120"
          }
        >
          <ValorInput value={diaria} onChange={setDiaria} required disabled={loading} />
        </Field>
        <Field label="Caução (R$)">
          <ValorInput value={caucao} onChange={setCaucao} required disabled={loading} />
        </Field>
        <Field
          label={tipoContrato === TipoContrato.Mensal ? "Dia de pagamento mensal" : "Dia de pagamento semanal"}
          hint={
            tipoContrato === TipoContrato.Mensal
              ? "Dia do mês em que o locatário paga (ex.: 15)"
              : "Confirme o dia da cláusula 3.2 do contrato"
          }
        >
          {tipoContrato === TipoContrato.Mensal ? (
            <input
              className="input"
              type="number"
              min={1}
              max={31}
              value={diaPagamentoMes}
              onChange={(e) => setDiaPagamentoMes(e.target.value)}
              required
              disabled={loading}
              aria-label="Dia de pagamento mensal"
            />
          ) : (
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
          )}
        </Field>
        <div className="field--full form-grid form-grid--contrato-prazo">
        <Field label="Data início" hint={modo === "renovar" ? "Padrão: início do contrato anterior — altere se a troca for em outra data." : undefined}>
          <DateInput
              value={dataInicio}
              onChange={handleDataInicioChange}
              disabled={loading}
              required
            />
          </Field>
          <Field label="Horário" hint="Horário de retirada/devolução no contrato (cláusula 1.2).">
            <TimeInput
              value={horaInicio}
              onChange={setHoraInicio}
              disabled={loading}
              required
              aria-label="Horário de início"
            />
          </Field>
          <Field label="Tempo do contrato">
            <NativeSelect
              value={periodo}
              onChange={handlePeriodoChange}
              variant="cadastro"
              allowEmpty={periodoPersonalizado}
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
            {modo === "renovar" && dataInicio.trim() && dataFim.trim() ? (
              <span className="field__hint">
                Vigência do contrato anterior: {dataInicio} → {dataFim}
                {prazoDiasContrato != null ? ` · ${labelTempoContrato(periodo, prazoDiasContrato)}` : ""}
              </span>
            ) : null}
            {periodoPersonalizado && dataInicio.trim() && dataFim.trim() ? (
              <span className="field__hint">
                {diasEntreDatasBr(dataInicio, dataFim)} dias (ajuste pela data fim)
              </span>
            ) : null}
          </Field>
          <Field label="Término previsto">
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
            {modo === "criar" && tipoContrato === TipoContrato.Semanal ? (
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

        {modo === "editar" ? (
          <div className="form-section field--full">
            <h3 className="form-section-title">Status do contrato</h3>
            <div className="form-grid">
              <Field label="Status">
                <NativeSelect
                  value={statusContrato}
                  onChange={(v) => setStatusContrato(v as StatusContratoValor)}
                  variant="cadastro"
                  allowEmpty={false}
                  disabled={loading}
                  aria-label="Status do contrato"
                >
                  {STATUS_CONTRATO_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {statusContrato === StatusContrato.Encerrado ? (
                <>
                  <Field label="Data de encerramento">
                    <DateInput
                      value={dataEncerramento}
                      onChange={setDataEncerramento}
                      required
                      disabled={loading}
                    />
                  </Field>
                  <Field label="Motivo do encerramento">
                    <NativeSelect
                      value={motivoEncerramento}
                      onChange={(v) => setMotivoEncerramento(v as MotivoEncerramentoValor)}
                      variant="cadastro"
                      allowEmpty={false}
                      disabled={loading}
                      aria-label="Motivo do encerramento"
                    >
                      {MOTIVO_ENCERRAMENTO_OPCOES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Quebra de contrato">
                    <Toggle
                      checked={quebraContrato}
                      onChange={setQuebraContrato}
                      disabled={loading || motivoEncerramento === MotivoEncerramento.Troca}
                      label="Registrar quebra (retenção proporcional de caução)"
                    />
                    {motivoEncerramento === MotivoEncerramento.Troca ? (
                      <span className="field__hint">
                        Troca de veículo não é quebra — a caução transfere para o novo contrato.
                      </span>
                    ) : null}
                  </Field>
                </>
              ) : (
                <p className="field__hint">
                  Ao marcar como ativo, data e motivo de encerramento são removidos do registro.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {modo === "editar" ? (
          <div className="form-section field--full">
            <h3 className="form-section-title">Contrato assinado</h3>
            <p className="form-section__lead">
              Envie o PDF ou Word do contrato já assinado pelo cliente.
            </p>
            <div className="form-grid">
              <Field label="Arquivo assinado" hint="PDF ou Word (.doc/.docx)">
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={loading}
                  onChange={(e) => void handleAssinadoFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
            {assinadoNome ? (
              <p className="field__hint">
                {assinadoPendente ? "Será enviado ao salvar: " : "Arquivo: "}
                <strong>{assinadoNome}</strong>
              </p>
            ) : null}
            {assinadoStorageKey && !assinadoPendente ? (
              <div className="form-card__action-row">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={docLoading}
                  onClick={() => void baixarContratoAssinado()}
                >
                  {docLoading ? "Baixando…" : "Baixar contrato assinado"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </FormCard>
      {idDocumento ? (
        <div className="form-card form-card--actions">
          <h2 className="form-card__title">Documento Word/PDF</h2>
          <p className="field__hint">
            {modo === "editar"
              ? "Gere o Word para impressão ou baixe o contrato assinado acima."
              : "O contrato já está no banco. Gere o ficheiro Word para impressão ou assinatura."}
          </p>
          <div className="form-card__action-row">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={docLoading}
              onClick={() => void gerarDocumento("docx")}
            >
              {docLoading ? "Gerando…" : "Gerar Word (.docx)"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={docLoading}
              onClick={() => void gerarDocumento("pdf")}
            >
              Gerar PDF
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate("/contratos")}>
              Ir para lista de contratos
            </button>
          </div>
          {docError ? <p className="form-card__error">{docError}</p> : null}
        </div>
      ) : null}
    </>
  );
}
