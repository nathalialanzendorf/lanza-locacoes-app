import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, matchVeiculoSelectValue, NativeSelect } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { ValorInput } from "@/components/ValorInput";
import { useContratos, useVeiculos } from "@/api/hooks";
import type { Contrato } from "@/api/types";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { clienteIdDe } from "@/lib/clienteCampo";
import { brToIsoDate } from "@/lib/dateBr";
import { formatValorInput, parseValorInput } from "@/lib/format";
import {
  CategoriaDespesaCliente,
  CATEGORIAS_DESPESA_CLIENTE_CADASTRO,
  STATUS_DESPESA_CADASTRO_OPCOES,
  StatusContrato,
  StatusDespesaFiltro,
  camposStatusDespesaDeCadastro,
  statusCadastroDeDespesa,
  type CategoriaDespesaClienteCadastro,
  type StatusDespesaCadastro,
} from "@/lib/domain";
import { hojeDataBr } from "@/lib/contratoVencimento";
import { descricaoPagamentoSemanalDeVencimentoBr } from "@/lib/pagamentoSemanal";
import { mergeDespesaClienteNoCache } from "@/lib/despesaClienteCache";

type Props = {
  despesaId?: string;
};

function veiculoRefDeContrato(c: Contrato): string | undefined {
  return c.veiculoId?.trim() || c.veiculo?.placa?.trim() || c.placa?.trim() || undefined;
}

function contratoAtivoMaisRecente(contratos: Contrato[]): Contrato | undefined {
  if (!contratos.length) return undefined;
  return [...contratos].sort((a, b) =>
    (b.dataInicio ?? "").localeCompare(a.dataInicio ?? "", "pt-BR"),
  )[0];
}

export function DespesaClienteCadastroSection({ despesaId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(despesaId);
  const veiculosQuery = useVeiculos();
  const veiculoEscolhidoManualmente = useRef(false);
  const veiculoRefAplicado = useRef<string | null>(null);

  /** Estado (não ref) para o efeito reagir quando a despesa chega após a lista de veículos. */
  const [veiculoRefCarregado, setVeiculoRefCarregado] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDespesaClienteCadastro>(
    CategoriaDespesaCliente.Manutencao,
  );
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState<StatusDespesaCadastro>(StatusDespesaFiltro.EmAberto);
  const [pagaEm, setPagaEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clienteId, setClienteIdState] = useState("");

  const contratosClienteQuery = useContratos(
    { status: StatusContrato.Ativo, clienteId: clienteId.trim() || undefined },
    { enabled: !editando && Boolean(clienteId.trim()) },
  );

  useEffect(() => {
    if (!despesaId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    veiculoRefAplicado.current = null;
    setVeiculoRefCarregado(null);
    void lanzaApi
      .obterDespesaCliente(despesaId)
      .then((r) => {
        if (cancelado) return;
        const d = r.data;
        setVeiculoRefCarregado(d.placa ?? d.veiculoId ?? null);
        if (d.categoria) setCategoria(d.categoria as CategoriaDespesaClienteCadastro);
        if (d.descricao) setDescricao(d.descricao);
        if (d.valorMulta != null) setValor(formatValorInput(Number(d.valorMulta)));
        if (d.vencimentoBr) setDataVencimento(d.vencimentoBr);
        else if (d.dataVencimentoOriginal) setDataVencimento(d.dataVencimentoOriginal);
        else if (d.dataLimiteDefesa) setDataVencimento(d.dataLimiteDefesa);
        else if (d.limiteDefesa) setDataVencimento(d.limiteDefesa);
        setStatus(statusCadastroDeDespesa(d));
        setPagaEm(d.pagaEmBr ?? null);
        const id = clienteIdDe(d);
        if (id) {
          setClienteIdState(id);
          veiculoEscolhidoManualmente.current = true;
        }
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof LanzaApiError ? err.message : "Falha ao carregar despesa.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [despesaId]);

  useEffect(() => {
    const ref = veiculoRefCarregado;
    if (!despesaId || !ref || !veiculosQuery.data?.items?.length) return;
    if (veiculoRefAplicado.current === ref) return;
    const encontrado = matchVeiculoSelectValue(veiculosQuery.data.items, ref, "id");
    if (!encontrado) return;
    veiculoRefAplicado.current = ref;
    setVeiculoId(encontrado);
    veiculoEscolhidoManualmente.current = true;
  }, [despesaId, veiculoRefCarregado, veiculosQuery.data]);

  useEffect(() => {
    if (editando || categoria !== CategoriaDespesaCliente.LocacaoSemanal) return;
    const auto = descricaoPagamentoSemanalDeVencimentoBr(dataVencimento);
    if (auto) setDescricao(auto);
  }, [categoria, dataVencimento, editando]);

  useEffect(() => {
    if (editando || !clienteId.trim() || veiculoEscolhidoManualmente.current) return;
    const contrato = contratoAtivoMaisRecente(contratosClienteQuery.data?.items ?? []);
    const ref = contrato ? veiculoRefDeContrato(contrato) : undefined;
    if (!ref) return;
    const sugerido = matchVeiculoSelectValue(veiculosQuery.data?.items, ref, "id");
    if (sugerido) setVeiculoId(sugerido);
  }, [clienteId, contratosClienteQuery.data, veiculosQuery.data, editando]);

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    veiculoEscolhidoManualmente.current = true;
    if (!id || clienteId.trim()) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteIdState(v.clienteVinculadoId);
  }

  function onClienteChange(id: string) {
    setClienteIdState(id);
    if (veiculoEscolhidoManualmente.current) return;
    setVeiculoId("");
  }

  async function gravar() {
    const vencimento = dataVencimento.trim();
    if (!vencimento) {
      setError("Informe a data de vencimento.");
      return;
    }
    if (!brToIsoDate(vencimento)) {
      setError("Data de vencimento inválida. Use DD/MM/AAAA.");
      return;
    }
    if (!veiculoId.trim()) {
      setError("Selecione um veículo.");
      return;
    }
    const valorNum = parseValorInput(valor, { allowZero: true });
    if (valorNum == null) {
      setError("Informe um valor válido (ex.: 120,00).");
      return;
    }
    if (status === StatusDespesaFiltro.Pago) {
      const pagamento = pagaEm?.trim();
      if (!pagamento) {
        setError("Informe a data de pagamento.");
        return;
      }
      if (!brToIsoDate(pagamento)) {
        setError("Data de pagamento inválida. Use DD/MM/AAAA.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    const statusCampos = camposStatusDespesaDeCadastro(status, pagaEm);
    try {
      if (editando) {
        const r = await lanzaApi.atualizarDespesaCliente(despesaId!, {
          categoria,
          descricao: descricao.trim() || undefined,
          valorMulta: valorNum,
          dataVencimentoOriginal: vencimento,
          veiculoId: veiculoId.trim(),
          /** null limpa o cliente e reabre confirmação cliente/parceiro. */
          condutorId: clienteId.trim() || null,
          ...statusCampos,
        });
        mergeDespesaClienteNoCache(qc, r.data);
      } else {
        const r = await lanzaApi.criarDespesaCliente(veiculoId.trim(), {
          autoInfracao: `WEB-${Date.now()}`,
          descricao:
            descricao.trim() ||
            (categoria === CategoriaDespesaCliente.Manutencao
              ? "Acionamento Franquia"
              : categoria === CategoriaDespesaCliente.LocacaoSemanal
                ? descricaoPagamentoSemanalDeVencimentoBr(vencimento) ?? "Despesa cliente"
                : "Despesa cliente"),
          localInfracao: "",
          dataAutuacao: new Date().toLocaleDateString("pt-BR"),
          valorMulta: valorNum,
          limiteDefesa: "",
          dataVencimentoOriginal: vencimento,
          categoria,
          condutorId: clienteId.trim() || undefined,
          rastreameTipo: categoria === CategoriaDespesaCliente.Manutencao ? "ALIMENTACAO" : "OUTROS",
          ...statusCampos,
        });
        mergeDespesaClienteNoCache(qc, r.data);
      }
      navigate("/despesas/cliente");
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"], refetchType: "none" });
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar despesa.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCliente() {
    if (!editando || !despesaId) return;
    setLoading(true);
    setError(null);
    try {
      // null/vazio desvincula e reabre confirmação cliente/parceiro.
      const r = await lanzaApi.confirmarClienteDespesa(despesaId, clienteId.trim() || null);
      const d = r.data;
      setClienteIdState(clienteIdDe(d) ?? "");
      mergeDespesaClienteNoCache(qc, d);
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"], refetchType: "none" });
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao confirmar cliente.");
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return (
      <>
        <CadastroBackLink to="/despesas/cliente" />
        <p className="muted">A carregar despesa…</p>
      </>
    );
  }

  return (
    <>
      <CadastroBackLink to="/despesas/cliente" />
      <FormCard
        title={editando ? "Editar despesa do cliente" : "Nova despesa do cliente"}
        onSubmit={gravar}
        loading={loading}
        error={error}
        actions={
          editando ? (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={loading}
              onClick={() => void confirmarCliente()}
            >
              {clienteId.trim() ? "Confirmar cliente" : "Desvincular / reabrir confirmação"}
            </button>
          ) : null
        }
      >
        <Field label="Cliente">
          <ClienteSelect
            value={clienteId}
            onChange={onClienteChange}
            variant="cadastro"
            required={!editando}
            disabled={loading}
          />
        </Field>
        <Field label="Veículo">
          <VeiculoSelect
            value={veiculoId}
            onChange={onVeiculoChange}
            valueField="id"
            required
            variant="cadastro"
            disabled={loading}
          />
        </Field>
        <Field label="Categoria">
          <NativeSelect
            value={categoria}
            onChange={(v) => setCategoria(v as CategoriaDespesaClienteCadastro)}
            variant="cadastro"
            allowEmpty={false}
          >
            {CATEGORIAS_DESPESA_CLIENTE_CADASTRO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Descrição">
          <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        <Field label="Valor (R$)">
          <ValorInput
            value={valor}
            onChange={setValor}
            required
            allowZero
            disabled={loading}
            aria-label="Valor"
          />
        </Field>
        <Field label="Vencimento">
          <DateInput
            value={dataVencimento}
            onChange={setDataVencimento}
            required
            disabled={loading}
          />
        </Field>
        <Field label="Status">
          <NativeSelect
            value={status}
            onChange={(v) => {
              const next = v as StatusDespesaCadastro;
              setStatus(next);
              if (next === StatusDespesaFiltro.Pago && !pagaEm?.trim()) {
                setPagaEm(hojeDataBr());
              }
              if (
                next === StatusDespesaFiltro.EmAberto ||
                next === StatusDespesaFiltro.Baixado
              ) {
                setPagaEm(null);
              }
            }}
            variant="cadastro"
            allowEmpty={false}
            disabled={loading}
            aria-label="Status"
            className={
              status === StatusDespesaFiltro.Baixado ? "select select--amber" : "select"
            }
          >
            {STATUS_DESPESA_CADASTRO_OPCOES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Data pagamento">
          <DateInput
            value={pagaEm ?? ""}
            onChange={(v) => setPagaEm(v.trim() || null)}
            disabled={loading || status !== StatusDespesaFiltro.Pago}
            required={status === StatusDespesaFiltro.Pago}
          />
        </Field>
      </FormCard>
    </>
  );
}
