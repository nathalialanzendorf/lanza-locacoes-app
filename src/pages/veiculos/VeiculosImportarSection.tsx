import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { CadastroBackLink } from "@/components/CadastroBackLink";
import { DocUploadField } from "@/components/DocUploadField";
import { matchParceiroIdPorNome, ParceiroSelect, TipoVeiculoFrotaSelect } from "@/components/EntitySelects";
import { Field, FormCard } from "@/components/FormCard";
import { Toggle } from "@/components/Toggle";
import { useParceiros } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { TipoVeiculoFrota, veiculosBasePath, type TipoVeiculoFrotaValor } from "@/lib/domain";

export function VeiculosImportarSection({
  tipoFrota: tipoFrotaRota = TipoVeiculoFrota.Locacao,
}: {
  tipoFrota?: TipoVeiculoFrotaValor;
}) {
  const basePathRota = veiculosBasePath(tipoFrotaRota);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const parceirosQuery = useParceiros();

  const [tipoFrota, setTipoFrota] = useState<TipoVeiculoFrotaValor>(tipoFrotaRota);
  const mostrarParceiro = tipoFrota !== TipoVeiculoFrota.Venda;

  const [placa, setPlaca] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [chassi, setChassi] = useState("");
  const [renavam, setRenavam] = useState("");
  const [cor, setCor] = useState("");
  const [ufRegistro, setUfRegistro] = useState("SC");
  const [parceiroId, setParceiroId] = useState("");
  const [atualizarFipe, setAtualizarFipe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function aplicarCrlv(campos: Record<string, unknown>) {
    if (typeof campos.placa === "string") setPlaca(campos.placa);
    if (typeof campos.marcaModelo === "string") setMarcaModelo(campos.marcaModelo);
    if (typeof campos.anoModelo === "string") setAnoModelo(campos.anoModelo);
    if (typeof campos.chassi === "string") setChassi(campos.chassi);
    if (typeof campos.renavam === "string") setRenavam(campos.renavam);
    if (typeof campos.cor === "string") setCor(campos.cor);
    if (typeof campos.ufRegistro === "string") setUfRegistro(campos.ufRegistro);
    if (typeof campos.proprietarioNome === "string" && campos.proprietarioNome.trim()) {
      const id = matchParceiroIdPorNome(parceirosQuery.data?.items, campos.proprietarioNome.trim());
      if (id) setParceiroId(id);
    }
  }

  async function salvar() {
    if (!placa.trim()) {
      setError("Placa obrigatória — envie o CRLV ou informe manualmente.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await lanzaApi.criarVeiculo({
        placa: placa.trim(),
        marcaModelo: marcaModelo.trim() || undefined,
        anoModelo: anoModelo.trim() || undefined,
        chassi: chassi.trim() || undefined,
        renavam: renavam.trim() || undefined,
        cor: cor.trim() || undefined,
        ufRegistro: ufRegistro.trim() || undefined,
        ...(mostrarParceiro ? { parceiroId: parceiroId.trim() || undefined } : {}),
        tipoFrota,
        origem: "web-importar-crlv",
      });

      if (atualizarFipe) {
        try {
          await lanzaApi.atualizarFipeVeiculo(placa.trim());
        } catch {
          /* FIPE opcional após importação */
        }
      }

      void qc.invalidateQueries({ queryKey: ["veiculos"] });
      void qc.invalidateQueries({ queryKey: ["parceiros"] });
      navigate(veiculosBasePath(tipoFrota));
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao salvar veículo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <CadastroBackLink to={basePathRota} />
      <FormCard title="Importar CRLV" onSubmit={salvar} loading={loading} error={error}>
        <Field
          label="Tipo"
          hint="Locação = frota operacional; Particular = uso do proprietário; Venda = estoque para revenda"
        >
          <TipoVeiculoFrotaSelect value={tipoFrota} onChange={setTipoFrota} disabled={loading} />
        </Field>
        <DocUploadField
          label="CRLV (PDF)"
          tipo="crlv"
          hint="Envie o PDF do CRLV para preencher os campos automaticamente."
          disabled={loading}
          onParsed={({ campos }) => aplicarCrlv(campos)}
          onError={setError}
        />
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
        <Toggle
          className="field"
          checked={atualizarFipe}
          onChange={setAtualizarFipe}
          label="Consultar FIPE após salvar"
        />
      </FormCard>
    </>
  );
}

