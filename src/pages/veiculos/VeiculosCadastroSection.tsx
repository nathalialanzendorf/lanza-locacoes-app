import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { Toggle } from "@/components/Toggle";
import { ParceiroSelect } from "@/components/EntitySelects";
import { Field, FormCard } from "@/components/FormCard";
import { useContratos, useVinculosParceiro } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import {
  placasComContratoAtivo,
  situacaoLocacaoVeiculo,
  situacaoVeiculoClass,
  situacaoVeiculoLabel,
} from "@/lib/statusVeiculo";
import { statusLabel } from "@/lib/format";
import {
  StatusContrato,
  TipoVeiculoFrota,
  abaVeiculoPath,
  rotuloTipoVeiculoFrota,
  tipoFrotaDeVeiculo,
  veiculosBasePath,
  type TipoVeiculoFrotaValor,
} from "@/lib/domain";
import { VeiculoFipePanel } from "@/components/VeiculoFipePanel";
import { ValorInput } from "@/components/ValorInput";
import { fipeCamposDeVeiculo, type FipeCampos } from "@/lib/fipeDisplay";
import { formatValorInput, parseValorInput } from "@/lib/format";
import { syncFipePath } from "@/lib/syncFipeNav";

type Props = {
  veiculoId?: string;
  tipoFrota: TipoVeiculoFrotaValor;
};

function origemCadastroWeb(tipo: TipoVeiculoFrotaValor): string {
  switch (tipo) {
    case TipoVeiculoFrota.Particular:
      return "web-cadastro-particular";
    case TipoVeiculoFrota.Venda:
      return "web-cadastro-venda";
    default:
      return "web-cadastro";
  }
}

export function VeiculosCadastroSection({ veiculoId, tipoFrota }: Props) {
  const basePath = veiculosBasePath(tipoFrota);
  const frotaLocacao = tipoFrota === TipoVeiculoFrota.Locacao;
  const mostrarParceiro = tipoFrota !== TipoVeiculoFrota.Venda;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(veiculoId);

  const vinculosQuery = useVinculosParceiro(
    veiculoId ? { veiculoId } : undefined,
    { enabled: mostrarParceiro },
  );
  const contratosQuery = useContratos(
    { status: StatusContrato.Ativo },
    { enabled: frotaLocacao },
  );
  const placasContratoAtivo = useMemo(
    () => placasComContratoAtivo(contratosQuery.data?.items ?? []),
    [contratosQuery.data],
  );

  const [placa, setPlaca] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [chassi, setChassi] = useState("");
  const [renavam, setRenavam] = useState("");
  const [cor, setCor] = useState("");
  const [ufRegistro, setUfRegistro] = useState("SC");
  const [valorSemanal, setValorSemanal] = useState("");
  const [valorMensal, setValorMensal] = useState("");
  const [valorDiaria, setValorDiaria] = useState("");
  const [valorCaucao, setValorCaucao] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [carregando, setCarregando] = useState(editando);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fipeDados, setFipeDados] = useState<FipeCampos>({});
  const situacaoLocacao = useMemo(
    () => situacaoLocacaoVeiculo({ ativo, placa }, placasContratoAtivo),
    [ativo, placa, placasContratoAtivo],
  );

  function popularFormulario(v: Record<string, unknown>) {
    if (typeof v.placa === "string") setPlaca(v.placa);
    if (typeof v.marcaModelo === "string") setMarcaModelo(v.marcaModelo);
    if (typeof v.anoModelo === "string") setAnoModelo(v.anoModelo);
    if (typeof v.chassi === "string") setChassi(v.chassi);
    if (typeof v.renavam === "string") setRenavam(v.renavam);
    if (typeof v.cor === "string") setCor(v.cor);
    if (typeof v.ufRegistro === "string") setUfRegistro(v.ufRegistro);
    setValorSemanal(
      typeof v.valorSemanal === "number" && v.valorSemanal > 0
        ? formatValorInput(v.valorSemanal)
        : "",
    );
    setValorMensal(
      typeof v.valorMensal === "number" && v.valorMensal > 0
        ? formatValorInput(v.valorMensal)
        : "",
    );
    setValorDiaria(
      typeof v.valorDiaria === "number" && v.valorDiaria > 0
        ? formatValorInput(v.valorDiaria)
        : "",
    );
    setValorCaucao(
      typeof v.valorCaucao === "number" && v.valorCaucao > 0
        ? formatValorInput(v.valorCaucao)
        : "",
    );
    if (typeof v.ativo === "boolean") setAtivo(v.ativo);
    setFipeDados(fipeCamposDeVeiculo(v));
  }

  useEffect(() => {
    if (!mostrarParceiro || !editando || !veiculoId) return;
    const vinculo = vinculosQuery.data?.items?.[0];
    if (vinculo?.parceiroId) setParceiroId(vinculo.parceiroId);
  }, [mostrarParceiro, editando, veiculoId, vinculosQuery.data]);

  useEffect(() => {
    if (!veiculoId) return;
    let cancelado = false;
    setCarregando(true);
    setError(null);
    void lanzaApi
      .obterVeiculo(veiculoId)
      .then((r) => {
        if (cancelado) return;
        const tipoVeiculo = tipoFrotaDeVeiculo(r.data);
        if (tipoVeiculo !== tipoFrota) {
          navigate(`${abaVeiculoPath(r.data)}/${veiculoId}/editar`, { replace: true });
          return;
        }
        popularFormulario(r.data as unknown as Record<string, unknown>);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof LanzaApiError ? err.message : "Falha ao carregar veículo.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [veiculoId, tipoFrota, navigate]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        placa: placa.trim(),
        marcaModelo: marcaModelo.trim() || undefined,
        anoModelo: anoModelo.trim() || undefined,
        chassi: chassi.trim() || undefined,
        renavam: renavam.trim() || undefined,
        cor: cor.trim() || undefined,
        ufRegistro: ufRegistro.trim() || undefined,
        ...(mostrarParceiro ? { parceiroId: parceiroId.trim() || undefined } : {}),
        ativo,
        tipoFrota,
        ...(frotaLocacao
          ? {
              valorSemanal: parseValorInput(valorSemanal, { allowZero: true }) ?? undefined,
              valorMensal: parseValorInput(valorMensal, { allowZero: true }) ?? undefined,
              valorDiaria: parseValorInput(valorDiaria, { allowZero: true }) ?? undefined,
              valorCaucao: parseValorInput(valorCaucao, { allowZero: true }) ?? undefined,
            }
          : {}),
        ...(editando ? {} : { origem: origemCadastroWeb(tipoFrota) }),
      };

      if (editando) {
        await lanzaApi.atualizarVeiculo(veiculoId!, body);
      } else {
        await lanzaApi.criarVeiculo(body);
      }

      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      if (mostrarParceiro) void qc.invalidateQueries({ queryKey: ["parceiros"] });
      navigate(basePath);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar veículo.");
    } finally {
      setLoading(false);
    }
  }

  const rotuloTipo = rotuloTipoVeiculoFrota(tipoFrota).toLowerCase();
  const titulo = editando ? `Editar veículo (${rotuloTipo})` : `Novo veículo (${rotuloTipo})`;
  const consultaFipeTo = placa.trim()
    ? syncFipePath(placa, { marcaModelo, anoModelo })
    : undefined;

  if (carregando) {
    return (
      <>
        <CadastroBackLink to={basePath} />
        <p className="muted">A carregar veículo…</p>
      </>
    );
  }

  return (
    <>
      <CadastroBackLink to={basePath} />
      {editando || consultaFipeTo ? (
        <VeiculoFipePanel
          fipe={editando ? fipeDados : {}}
          emptyHint="Nenhum dado FIPE no cadastro — use Syncs › FIPE para consultar (visualização) ou atualizar o cadastro."
          consultaFipeTo={consultaFipeTo}
        />
      ) : null}
      <FormCard title={titulo} onSubmit={submit} loading={loading} error={error}>
        <Field label="Placa">
          <input className="input" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
        </Field>
        <Field label="Marca / modelo">
          <input className="input" value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} />
        </Field>
        <Field label="Ano / modelo">
          <input
            className="input"
            value={anoModelo}
            onChange={(e) => setAnoModelo(e.target.value)}
            placeholder="2012/2013"
          />
        </Field>
        <Field label="Chassi">
          <input className="input" value={chassi} onChange={(e) => setChassi(e.target.value)} />
        </Field>
        <Field label="RENAVAM">
          <input className="input" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
        </Field>
        <Field label="Cor">
          <input className="input" value={cor} onChange={(e) => setCor(e.target.value)} />
        </Field>
        <Field label="UF registro">
          <input className="input" value={ufRegistro} onChange={(e) => setUfRegistro(e.target.value)} />
        </Field>
        {mostrarParceiro ? (
          <Field label="Parceiro (proprietário)">
            <ParceiroSelect value={parceiroId} onChange={setParceiroId} variant="cadastro" disabled={loading} />
          </Field>
        ) : null}
        {frotaLocacao ? (
          <div className="form-section field--full">
            <h3 className="form-section-title">Tarifas de referência</h3>
            <p className="form-section__lead">
              Valores padrão usados ao criar contratos — podem ser alterados no contrato.
            </p>
            <div className="form-grid">
              <Field label="Valor semanal (R$)">
                <ValorInput value={valorSemanal} onChange={setValorSemanal} disabled={loading} />
              </Field>
              <Field label="Valor mensal (R$)">
                <ValorInput value={valorMensal} onChange={setValorMensal} disabled={loading} />
              </Field>
              <Field
                label="Valor diária (R$)"
                hint="Contratos diários e cálculo de juros/multa em contratos semanais"
              >
                <ValorInput value={valorDiaria} onChange={setValorDiaria} disabled={loading} />
              </Field>
              <Field label="Caução (R$)">
                <ValorInput value={valorCaucao} onChange={setValorCaucao} disabled={loading} />
              </Field>
            </div>
          </div>
        ) : null}
        <Field
          label="Status"
          hint={
            editando
              ? `${statusLabel(ativo)} — altere para ativar ou inativar na frota`
              : "Novos veículos entram como ativos"
          }
        >
          <Toggle
            checked={ativo}
            onChange={setAtivo}
            disabled={loading}
            aria-label="Veículo ativo"
          />
        </Field>
        {frotaLocacao ? (
          <Field label="Situação" hint="Derivada do contrato ativo na placa (somente leitura)">
            <span className={situacaoVeiculoClass(situacaoLocacao)}>
              {situacaoVeiculoLabel(situacaoLocacao)}
            </span>
          </Field>
        ) : (
          <Field label="Tipo" hint={`Veículo ${rotuloTipo} — não entra na frota de locação`}>
            <span className="badge">{rotuloTipoVeiculoFrota(tipoFrota)}</span>
          </Field>
        )}
      </FormCard>
    </>
  );
}

