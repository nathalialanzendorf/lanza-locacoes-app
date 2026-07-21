import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect, matchVeiculoSelectValue, NativeSelect } from "@/components/EntitySelects";
import { Field, FormCard } from "@/components/FormCard";
import { ResultPanel } from "@/components/ResultPanel";
import { useVeiculos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { clienteIdDe } from "@/lib/clienteCampo";
import { CATEGORIA_PEDAGIO } from "@/lib/pedagioLabels";

const CATEGORIAS = [
  "Manutenção",
  "Locação semanal",
  "Caução",
  "Outros",
  CATEGORIA_PEDAGIO,
  "Infração",
  "Estacionamento",
];

type Props = {
  despesaId?: string;
};

export function DespesaClienteCadastroSection({ despesaId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(despesaId);
  const veiculosQuery = useVeiculos();

  const [veiculoId, setVeiculoId] = useState("");
  const [categoria, setCategoria] = useState("Manutenção");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [autoInfracao, setAutoInfracao] = useState("");
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
        if (d.categoria) setCategoria(d.categoria);
        if (d.descricao) setDescricao(d.descricao);
        if (d.valorMulta != null) setValor(String(d.valorMulta));
        if (d.autoInfracao) setAutoInfracao(d.autoInfracao);
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

  function onVeiculoChange(id: string) {
    setVeiculoId(id);
    if (!id) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === id);
    if (v?.clienteVinculadoId) setClienteId(v.clienteVinculadoId);
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    if (!id) {
      setVeiculoId("");
      return;
    }
    if (!veiculoId) return;
    const v = (veiculosQuery.data?.items ?? []).find((x) => x.id === veiculoId);
    if (v?.clienteVinculadoId && v.clienteVinculadoId !== id) setVeiculoId("");
  }

  async function gravar() {
    setLoading(true);
    setError(null);
    try {
      if (editando) {
        const r = await lanzaApi.atualizarDespesaCliente(despesaId!, {
          categoria,
          descricao: descricao.trim() || undefined,
          valorMulta: Number(valor),
        });
        setResult(r);
      } else {
        const id = autoInfracao.trim() || `WEB-${Date.now()}`;
        const r = await lanzaApi.criarDespesaCliente(veiculoId.trim(), {
          autoInfracao: id,
          descricao: descricao.trim() || (categoria === "Manutenção" ? "Acionamento Franquia" : "Despesa cliente"),
          localInfracao: "",
          dataAutuacao: new Date().toLocaleDateString("pt-BR"),
          valorMulta: Number(valor),
          situacao: "Em aberto",
          limiteDefesa: "",
          categoria,
          paga: false,
          condutorId: clienteId.trim() || undefined,
          rastreameTipo: categoria === "Manutenção" ? "ALIMENTACAO" : "OUTROS",
        });
        setResult(r);
      }
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
      navigate("/despesas/cliente");
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
      void qc.invalidateQueries({ queryKey: ["despesas-cliente"] });
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
        <Field label="Cliente" hint="Locatário responsável por esta despesa">
          <ClienteSelect
            value={clienteId}
            onChange={onClienteChange}
            variant="cadastro"
            required={!editando}
            disabled={loading}
          />
        </Field>
        <Field
          label="Veículo"
          hint={clienteId.trim() ? "Veículos vinculados ao cliente ou com contrato ativo" : "Selecione o cliente para filtrar veículos"}
        >
          <VeiculoSelect
            value={veiculoId}
            onChange={onVeiculoChange}
            valueField="id"
            clienteId={clienteId.trim() || undefined}
            required
            variant="cadastro"
            disabled={loading || editando || !clienteId.trim()}
          />
        </Field>
        <Field label="Categoria">
          <NativeSelect
            value={categoria}
            onChange={setCategoria}
            variant="cadastro"
            allowEmpty={false}
          >
            {CATEGORIAS.map((c) => (
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
        {!editando ? (
          <Field label="Auto / ID (opcional)">
            <input className="input" value={autoInfracao} onChange={(e) => setAutoInfracao(e.target.value)} />
          </Field>
        ) : null}
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
