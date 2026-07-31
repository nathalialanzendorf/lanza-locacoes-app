import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, matchVeiculoSelectValue, NativeSelect } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { ResultPanel } from "@/components/ResultPanel";
import { useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { clienteIdDe } from "@/lib/clienteCampo";
import { brToIsoDate } from "@/lib/dateBr";
import {
  CategoriaDespesaCliente,
  CATEGORIAS_DESPESA_CLIENTE_CADASTRO,
  STATUS_DESPESA_CADASTRO_OPCOES,
  StatusDespesaFiltro,
  camposStatusDespesaDeCadastro,
  statusCadastroDeDespesa,
  type CategoriaDespesaClienteCadastro,
  type StatusDespesaCadastro,
} from "@/lib/domain";
import { descricaoPagamentoSemanalDeVencimentoBr } from "@/lib/pagamentoSemanal";
import { mergeDespesaClienteNoCache } from "@/lib/despesaClienteCache";

type Props = {
  despesaId?: string;
};

export function DespesaClienteCadastroSection({ despesaId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(despesaId);
  const veiculosQuery = useVeiculos();

  const [veiculoId, setVeiculoId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDespesaClienteCadastro>(
    CategoriaDespesaCliente.Manutencao,
  );
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState<StatusDespesaCadastro>(StatusDespesaFiltro.EmAberto);
  const [pagaEm, setPagaEm] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    if (!despesaId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterDespesaCliente(despesaId)
      .then((r) => {
        if (cancelado) return;
        const d = r.data;
        const veiculoRef = d.placa ?? d.veiculoId;
        if (veiculoRef) {
          setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
        }
        if (d.categoria) setCategoria(d.categoria as CategoriaDespesaClienteCadastro);
        if (d.descricao) setDescricao(d.descricao);
        if (d.valorMulta != null) setValor(String(d.valorMulta));
        if (d.vencimentoBr) setDataVencimento(d.vencimentoBr);
        else if (d.dataVencimentoOriginal) setDataVencimento(d.dataVencimentoOriginal);
        else if (d.dataLimiteDefesa) setDataVencimento(d.dataLimiteDefesa);
        else if (d.limiteDefesa) setDataVencimento(d.limiteDefesa);
        setStatus(statusCadastroDeDespesa(d));
        setPagaEm(d.pagaEmBr ?? null);
        const id = clienteIdDe(d);
        if (id) setClienteId(id);
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
  }, [despesaId, veiculosQuery.data]);

  useEffect(() => {
    if (editando || categoria !== CategoriaDespesaCliente.LocacaoSemanal) return;
    const auto = descricaoPagamentoSemanalDeVencimentoBr(dataVencimento);
    if (auto) setDescricao(auto);
  }, [categoria, dataVencimento, editando]);

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    if (!id || clienteId.trim()) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
  }

  function onClienteChange(id: string) {
    setClienteId(id);
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
    setLoading(true);
    setError(null);
    const statusCampos = camposStatusDespesaDeCadastro(status, pagaEm);
    try {
      if (editando) {
        const r = await lanzaApi.atualizarDespesaCliente(despesaId!, {
          categoria,
          descricao: descricao.trim() || undefined,
          valorMulta: Number(valor),
          dataVencimentoOriginal: vencimento,
          veiculoId: veiculoId.trim(),
          ...statusCampos,
        });
        setResult(r);
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
          valorMulta: Number(valor),
          limiteDefesa: "",
          dataVencimentoOriginal: vencimento,
          categoria,
          condutorId: clienteId.trim() || undefined,
          rastreameTipo: categoria === CategoriaDespesaCliente.Manutencao ? "ALIMENTACAO" : "OUTROS",
          ...statusCampos,
        });
        setResult(r);
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
      const r = await lanzaApi.confirmarClienteDespesa(despesaId, clienteId.trim() || null);
      setResult(r);
      mergeDespesaClienteNoCache(qc, r.data);
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
          <input
            className="input"
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
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
            onChange={(v) => setStatus(v as StatusDespesaCadastro)}
            variant="cadastro"
            allowEmpty={false}
            disabled={loading}
            aria-label="Status"
          >
            {STATUS_DESPESA_CADASTRO_OPCOES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FormCard>

      {editando ? (
        <FormCard
          title="Confirmar cliente"
          onSubmit={confirmarCliente}
          loading={loading}
          submitLabel="Confirmar cliente"
          error={null}
        >
          <Field label="Cliente">
            <ClienteSelect value={clienteId} onChange={setClienteId} variant="cadastro" disabled={loading} />
          </Field>
        </FormCard>
      ) : null}

      <ResultPanel title="Resultado" data={result} />
    </>
  );
}
