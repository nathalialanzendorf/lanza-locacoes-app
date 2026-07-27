import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { ClienteSelect, VeiculoSelect } from "@/components/EntitySelects";
import { DateInput } from "@/components/DateInput";
import { Field, FormCard, FormSection } from "@/components/FormCard";
import { Toggle } from "@/components/Toggle";
import { ValorInput } from "@/components/ValorInput";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatValorInput, parseValorInput } from "@/lib/format";
import { TipoVeiculoFrota } from "@/lib/domain";
import { sincronizarVendaParcelamento } from "@/lib/vendaParcelamento";

type Props = {
  vendaId?: string;
};

export function VendasCadastroSection({ vendaId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(vendaId);

  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [dataVenda, setDataVenda] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [dataPagamentoParcelas, setDataPagamentoParcelas] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parcelamentoFields = { valorTotal: valorVenda, valorParcela, quantidadeParcelas };
  const parcelamentoSetters = {
    setValorTotal: setValorVenda,
    setValorParcela: setValorParcela,
    setQuantidadeParcelas: setQuantidadeParcelas,
  };

  useEffect(() => {
    if (!vendaId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterVenda(vendaId)
      .then((r) => {
        if (cancelado) return;
        const v = r.data;
        if (v.veiculoId) setVeiculoId(v.veiculoId);
        if (v.clienteId) setClienteId(v.clienteId);
        if (v.dataVenda) setDataVenda(v.dataVenda);
        if (v.valorEntrada != null) setValorEntrada(formatValorInput(v.valorEntrada));
        if (v.dataPagamentoParcelas) setDataPagamentoParcelas(v.dataPagamentoParcelas);
        if (v.valorParcela != null) setValorParcela(formatValorInput(v.valorParcela));
        if (v.quantidadeParcelas != null) setQuantidadeParcelas(String(v.quantidadeParcelas));
        if (v.valorVenda != null) setValorVenda(formatValorInput(v.valorVenda));
        if (v.observacao) setObservacao(v.observacao);
        if (typeof v.ativo === "boolean") setAtivo(v.ativo);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof LanzaApiError ? err.message : "Falha ao carregar venda.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vendaId]);

  async function submit() {
    const valor = parseValorInput(valorVenda);
    if (valor == null) {
      setError("Informe o valor total da venda.");
      return;
    }
    if (!veiculoId.trim()) {
      setError("Selecione o veículo vendido.");
      return;
    }
    if (!dataVenda.trim()) {
      setError("Informe a data da venda.");
      return;
    }

    const qtdRaw = quantidadeParcelas.trim();
    const qtd = qtdRaw ? Number.parseInt(qtdRaw, 10) : null;

    setLoading(true);
    setError(null);
    try {
      const body = {
        veiculoId: veiculoId.trim(),
        clienteId: clienteId.trim() || undefined,
        dataVenda: dataVenda.trim(),
        valorVenda: valor,
        valorEntrada: parseValorInput(valorEntrada, { allowZero: true }) ?? undefined,
        dataPagamentoParcelas: dataPagamentoParcelas.trim() || undefined,
        valorParcela: parseValorInput(valorParcela, { allowZero: true }) ?? undefined,
        quantidadeParcelas: qtd != null && Number.isFinite(qtd) && qtd > 0 ? qtd : undefined,
        observacao: observacao.trim() || undefined,
        ativo,
      };

      if (editando) {
        await lanzaApi.atualizarVenda(vendaId!, body);
      } else {
        await lanzaApi.criarVenda(body);
      }

      void qc.invalidateQueries({ queryKey: ["vendas"] });
      navigate("/venda");
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar venda.");
    } finally {
      setLoading(false);
    }
  }

  if (carregando) {
    return (
      <>
        <CadastroBackLink to="/venda" />
        <p className="muted">A carregar venda…</p>
      </>
    );
  }

  return (
    <>
      <CadastroBackLink to="/venda" />
      <FormCard
        title={editando ? "Editar venda" : "Nova venda"}
        onSubmit={submit}
        loading={loading}
        error={error}
      >
        <Field label="Veículo" hint="Somente veículos do estoque de venda">
          <VeiculoSelect
            value={veiculoId}
            onChange={setVeiculoId}
            valueField="id"
            variant="cadastro"
            required
            tipoFrota={TipoVeiculoFrota.Venda}
            disabled={loading}
          />
        </Field>
        <Field label="Cliente">
          <ClienteSelect value={clienteId} onChange={setClienteId} variant="cadastro" disabled={loading} />
        </Field>
        <Field label="Data da venda">
          <DateInput value={dataVenda} onChange={setDataVenda} required disabled={loading} />
        </Field>
        <Field label="Valor de entrada (R$)" hint="Deixe vazio se não houve entrada">
          <ValorInput value={valorEntrada} onChange={setValorEntrada} allowZero disabled={loading} />
        </Field>

        <div className="field--full">
          <FormSection
            title="Parcelamento"
            hint="Preencha dois campos entre valor total, valor da parcela e quantidade — o terceiro é calculado automaticamente."
          >
            <div className="form-grid">
              <Field label="Data pagamento das parcelas">
                <DateInput
                  value={dataPagamentoParcelas}
                  onChange={setDataPagamentoParcelas}
                  disabled={loading}
                />
              </Field>
              <Field label="Valor das parcelas (R$)" hint="Com quantidade preenchida, calcula o valor total">
                <ValorInput
                  value={valorParcela}
                  onChange={(v) => {
                    setValorParcela(v);
                    sincronizarVendaParcelamento(
                      { ...parcelamentoFields, valorParcela: v },
                      parcelamentoSetters,
                      "valorParcela",
                    );
                  }}
                  disabled={loading}
                />
              </Field>
              <Field label="Quantidade de parcelas" hint="Com valor da parcela preenchido, calcula o valor total">
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={quantidadeParcelas}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuantidadeParcelas(v);
                    sincronizarVendaParcelamento(
                      { ...parcelamentoFields, quantidadeParcelas: v },
                      parcelamentoSetters,
                      "quantidadeParcelas",
                    );
                  }}
                  disabled={loading}
                />
              </Field>
              <Field
                label="Valor total da venda (R$)"
                hint="Com parcela ou quantidade preenchidos, calcula o outro campo"
              >
                <ValorInput
                  value={valorVenda}
                  onChange={(v) => {
                    setValorVenda(v);
                    sincronizarVendaParcelamento(
                      { ...parcelamentoFields, valorTotal: v },
                      parcelamentoSetters,
                      "valorTotal",
                    );
                  }}
                  required
                  disabled={loading}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <Field label="Observações" span="full">
          <textarea
            className="input"
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={loading}
          />
        </Field>
        {editando ? (
          <Field label="Ativa">
            <Toggle checked={ativo} onChange={setAtivo} disabled={loading} aria-label="Venda ativa" />
          </Field>
        ) : null}
      </FormCard>
    </>
  );
}
