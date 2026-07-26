import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, ParceiroSelect, VeiculoSelect, NativeSelect, matchVeiculoSelectValue } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { ResultPanel } from "@/components/ResultPanel";
import { useVeiculos, useVinculosParceiro } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import {
  CATEGORIA_MOVIMENTACAO_OPCOES,
  CategoriaMovimentacao,
  TIPO_LOCACAO_OPCOES,
  TipoLocacao,
  isCategoriaMovimentacaoValor,
  isTipoLocacaoValor,
  type CategoriaMovimentacaoValor,
  type TipoLocacaoValor,
} from "@/lib/domain";

type Props = {
  locacaoId?: string;
};

export function MovimentacaoCadastroSection({ locacaoId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const veiculosQuery = useVeiculos();
  const vinculosQuery = useVinculosParceiro();
  const editando = Boolean(locacaoId);

  const [veiculoId, setVeiculoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaMovimentacaoValor>(CategoriaMovimentacao.Locado);
  const [tipoLocacao, setTipoLocacao] = useState<TipoLocacaoValor>(TipoLocacao.Semanal);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    if (!locacaoId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterLocacao(locacaoId)
      .then((r) => {
        if (cancelado) return;
        const l = r.data as Record<string, unknown>;
        const veiculoRef =
          typeof l.veiculoId === "string"
            ? l.veiculoId
            : typeof l.placa === "string"
              ? l.placa
              : "";
        if (veiculoRef) {
          setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
        }
        const categoriaRaw = typeof l.situacao === "string" ? l.situacao : undefined;
        if (isCategoriaMovimentacaoValor(categoriaRaw)) setCategoria(categoriaRaw);
        const tipoRaw = typeof l.tipoLocacao === "string" ? l.tipoLocacao : undefined;
        if (isTipoLocacaoValor(tipoRaw)) setTipoLocacao(tipoRaw);
        if (typeof l.inicio === "string") setInicio(l.inicio);
        if (typeof l.fim === "string") setFim(l.fim);
        if (typeof l.clienteId === "string") setClienteId(l.clienteId);
        if (typeof l.observacao === "string") setObservacao(l.observacao);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof LanzaApiError ? err.message : "Falha ao carregar movimentação.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [locacaoId, veiculosQuery.data]);

  useEffect(() => {
    if (!veiculoId.trim() || !veiculosQuery.data || !vinculosQuery.data) return;
    const vinculo = (vinculosQuery.data.items ?? []).find((x) => x.veiculoId === veiculoId.trim());
    if (vinculo?.parceiroId) setParceiroId(vinculo.parceiroId);
  }, [veiculoId, veiculosQuery.data, vinculosQuery.data]);

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    if (!id) {
      setParceiroId("");
      return;
    }
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
    const vinculo = (vinculosQuery.data?.items ?? []).find((x) => x.veiculoId === id);
    setParceiroId(vinculo?.parceiroId ?? "");
  }

  function onParceiroChange(id: string) {
    setParceiroId(id);
    if (!id || !veiculoId) return;
    const vinculo = (vinculosQuery.data?.items ?? []).find((x) => x.veiculoId === veiculoId);
    if (vinculo?.parceiroId !== id) setVeiculoId("");
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    if (!id || !veiculoId) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === veiculoId);
    if (v?.clienteVinculadoId && v.clienteVinculadoId !== id) setVeiculoId("");
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (!veiculoId.trim()) throw new Error("Selecione um veículo.");
      const body = {
        veiculoId: veiculoId.trim(),
        situacao: categoria,
        inicio: inicio.trim(),
        fim: fim.trim() || null,
        clienteId: clienteId.trim() || null,
        tipoLocacao: categoria === CategoriaMovimentacao.Locado ? tipoLocacao : null,
        observacao: observacao.trim() || null,
      };

      const r = editando
        ? await lanzaApi.atualizarLocacao(locacaoId!, body)
        : await lanzaApi.salvarLocacao(body);

      setResult(r);
      void qc.invalidateQueries({ queryKey: ["locacoes"] });
      navigate("/movimentacao");
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar movimentação.");
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return (
      <>
        <CadastroBackLink to="/movimentacao" />
        <p className="muted">A carregar movimentação…</p>
      </>
    );
  }

  return (
    <>
      <CadastroBackLink to="/movimentacao" />
      <FormCard
        title={editando ? "Editar movimentação" : "Nova movimentação"}
        onSubmit={submit}
        loading={loading}
        error={error}
      >
        <div className="form-grid">
          <Field label="Veículo">
            <VeiculoSelect
              value={veiculoId}
              onChange={onVeiculoChange}
              valueField="id"
              clienteId={clienteId || undefined}
              parceiroId={parceiroId || undefined}
              required
              variant="cadastro"
              disabled={loading}
            />
          </Field>
          <Field label="Parceiro">
            <ParceiroSelect
              value={parceiroId}
              onChange={onParceiroChange}
              variant="cadastro"
              disabled={loading}
            />
          </Field>
          <Field label="Cliente">
            <ClienteSelect
              value={clienteId}
              onChange={onClienteChange}
              variant="cadastro"
              disabled={loading}
            />
          </Field>
          <Field label="Categoria">
            <NativeSelect
              value={categoria}
              onChange={(v) => {
                if (isCategoriaMovimentacaoValor(v)) setCategoria(v);
              }}
              variant="cadastro"
              allowEmpty={false}
              disabled={loading}
              aria-label="Categoria"
            >
              {CATEGORIA_MOVIMENTACAO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {categoria === CategoriaMovimentacao.Locado ? (
          <Field label="Tipo de locação">
            <NativeSelect
              value={tipoLocacao}
              onChange={(v) => {
                if (isTipoLocacaoValor(v)) setTipoLocacao(v);
              }}
              variant="cadastro"
              allowEmpty={false}
              disabled={loading}
            >
              {TIPO_LOCACAO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field label="Início">
          <DateInput value={inicio} onChange={setInicio} required disabled={loading} />
        </Field>
        <Field label="Fim (opcional)">
          <DateInput value={fim} onChange={setFim} disabled={loading} />
        </Field>
        <Field label="Observação">
          <input className="input" value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={loading} />
        </Field>
      </FormCard>
      <ResultPanel title="Movimentação gravada" data={result} />
    </>
  );
}
