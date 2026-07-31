import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, NativeSelect, matchVeiculoSelectValue } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { ResultPanel } from "@/components/ResultPanel";
import { useContratos, useVeiculos } from "@/api/hooks";
import type { Contrato } from "@/api/types";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import {
  CATEGORIA_MOVIMENTACAO_OPCOES,
  CategoriaMovimentacao,
  StatusContrato,
  TipoLocacao,
  isCategoriaMovimentacaoValor,
  isTipoLocacaoValor,
  type CategoriaMovimentacaoValor,
  type TipoLocacaoValor,
} from "@/lib/domain";

type Props = {
  locacaoId?: string;
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

export function MovimentacaoCadastroSection({ locacaoId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const veiculosQuery = useVeiculos();
  const editando = Boolean(locacaoId);
  const veiculoEscolhidoManualmente = useRef(false);

  const [veiculoId, setVeiculoId] = useState("");
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

  const contratosClienteQuery = useContratos(
    { status: StatusContrato.Ativo, clienteId: clienteId.trim() || undefined },
    { enabled: !editando && Boolean(clienteId.trim()) },
  );

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
          veiculoEscolhidoManualmente.current = true;
        }
        const categoriaRaw = typeof l.situacao === "string" ? l.situacao : undefined;
        if (isCategoriaMovimentacaoValor(categoriaRaw)) setCategoria(categoriaRaw);
        const tipoRaw = typeof l.tipoLocacao === "string" ? l.tipoLocacao : undefined;
        if (isTipoLocacaoValor(tipoRaw)) setTipoLocacao(tipoRaw);
        if (typeof l.inicio === "string") setInicio(l.inicio);
        if (typeof l.fim === "string") setFim(l.fim);
        if (typeof l.clienteId === "string") {
          setClienteId(l.clienteId);
          veiculoEscolhidoManualmente.current = true;
        }
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
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    if (veiculoEscolhidoManualmente.current) return;
    setVeiculoId("");
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (!clienteId.trim()) throw new Error("Selecione um cliente.");
      if (!veiculoId.trim()) throw new Error("Selecione um veículo.");
      if (!inicio.trim()) throw new Error("Informe a data de início.");
      const body = {
        veiculoId: veiculoId.trim(),
        situacao: categoria,
        inicio: inicio.trim(),
        fim: fim.trim() || null,
        clienteId: clienteId.trim(),
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
          <Field label="Cliente">
            <ClienteSelect
              value={clienteId}
              onChange={onClienteChange}
              somenteContratoAtivo
              required
              variant="cadastro"
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
        <div className="form-grid">
          <Field label="Início">
            <DateInput value={inicio} onChange={setInicio} required disabled={loading} />
          </Field>
          <Field label="Fim (opcional)">
            <DateInput value={fim} onChange={setFim} disabled={loading} />
          </Field>
        </div>
        <Field label="Observação">
          <input
            className="input"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={loading}
          />
        </Field>
      </FormCard>
      <ResultPanel title="Movimentação gravada" data={result} />
    </>
  );
}
