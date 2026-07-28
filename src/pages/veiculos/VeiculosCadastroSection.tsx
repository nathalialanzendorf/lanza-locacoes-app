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
import { fipeCamposDeVeiculo, type FipeCampos } from "@/lib/fipeDisplay";

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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editando = Boolean(veiculoId);

  const vinculosQuery = useVinculosParceiro(
    veiculoId ? { veiculoId } : undefined,
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
    if (typeof v.ativo === "boolean") setAtivo(v.ativo);
    setFipeDados(fipeCamposDeVeiculo(v));
  }

  useEffect(() => {
    if (!editando || !veiculoId) return;
    const vinculo = vinculosQuery.data?.items?.[0];
    if (vinculo?.parceiroId) setParceiroId(vinculo.parceiroId);
  }, [editando, veiculoId, vinculosQuery.data]);

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
        parceiroId: parceiroId.trim() || undefined,
        ativo,
        tipoFrota,
        ...(editando ? {} : { origem: origemCadastroWeb(tipoFrota) }),
      };

      if (editando) {
        await lanzaApi.atualizarVeiculo(veiculoId!, body);
      } else {
        await lanzaApi.criarVeiculo(body);
      }

      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      void qc.invalidateQueries({ queryKey: ["parceiros"] });
      navigate(basePath);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao gravar veículo.");
    } finally {
      setLoading(false);
    }
  }

  const rotuloTipo = rotuloTipoVeiculoFrota(tipoFrota).toLowerCase();
  const titulo = editando ? `Editar veículo (${rotuloTipo})` : `Novo veículo (${rotuloTipo})`;

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
      {editando ? (
        <VeiculoFipePanel
          fipe={fipeDados}
          emptyHint="Nenhum dado FIPE no cadastro — consulte na aba FIPE ou execute sync."
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
        <Field label="Parceiro (proprietário)">
          <ParceiroSelect value={parceiroId} onChange={setParceiroId} variant="cadastro" disabled={loading} />
        </Field>
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

