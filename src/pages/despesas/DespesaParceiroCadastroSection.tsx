import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { VeiculoSelect, NativeSelect, matchVeiculoSelectValue } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard } from "@/components/FormCard";
import { ResultPanel } from "@/components/ResultPanel";
import { useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { CATEGORIAS_DESPESA_PARCEIRO } from "@/lib/parceiroDespesaCategorias";

type Props = {
  despesaId?: string;
};

export function DespesaParceiroCadastroSection({ despesaId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(despesaId);

  const veiculosQuery = useVeiculos();
  const [veiculoId, setVeiculoId] = useState("");
  const [categoria, setCategoria] = useState("IPVA");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
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
      .obterParceiroDespesa(despesaId)
      .then((r) => {
        if (cancelado) return;
        const d = r.data;
        const veiculoRef = d.veiculoId ?? d.placa;
        if (veiculoRef) {
          setVeiculoId(matchVeiculoSelectValue(veiculosQuery.data?.items, veiculoRef, "id"));
        }
        if (d.categoria) setCategoria(d.categoria);
        if (d.descricao) setDescricao(d.descricao);
        if (d.valor != null) setValor(String(d.valor));
        if (d.data) setData(d.data);
        else if (d.vencimentoBr) setData(d.vencimentoBr);
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

  async function submit() {
    if (!data.trim()) {
      setError("Informe a data de vencimento.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!veiculoId.trim()) {
        setError("Selecione um veículo.");
        return;
      }
      const body = {
        veiculoId: veiculoId.trim(),
        categoria: categoria.trim(),
        descricao: descricao.trim(),
        valor: Number(valor),
        data: data.trim(),
      };
      const r = editando
        ? await lanzaApi.atualizarParceiroDespesa(despesaId!, body)
        : await lanzaApi.criarDespesaParceiro(body);
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["despesas-parceiro"] });
      navigate("/despesas/parceiro");
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar despesa parceiro.");
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return (
      <>
        <CadastroBackLink to="/despesas/parceiro" />
        <p className="muted">A carregar despesa…</p>
      </>
    );
  }

  return (
    <>
      <CadastroBackLink to="/despesas/parceiro" />
      <FormCard
        title={editando ? "Editar despesa parceiro" : "Nova despesa parceiro"}
        onSubmit={submit}
        loading={loading}
        error={error}
      >
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
        <Field label="Categoria">
          <NativeSelect
            value={categoria}
            onChange={setCategoria}
            variant="cadastro"
            allowEmpty={false}
            disabled={loading}
            required
          >
            {!CATEGORIAS_DESPESA_PARCEIRO.includes(categoria as (typeof CATEGORIAS_DESPESA_PARCEIRO)[number]) &&
            categoria.trim() ? (
              <option value={categoria}>{categoria}</option>
            ) : null}
            {CATEGORIAS_DESPESA_PARCEIRO.map((c) => (
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
        <Field label="Data (vencimento)" hint="DD/MM/AAAA">
          <DateInput value={data} onChange={setData} required disabled={loading} />
        </Field>
      </FormCard>
      <ResultPanel title="Resultado" data={result} />
    </>
  );
}
