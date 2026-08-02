import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataFieldsPanel } from "@/components/DataFieldsPanel";
import { VeiculoSelect } from "@/components/EntitySelects";
import { Field } from "@/components/FormCard";
import { FlashError } from "@/context/ScreenFlashContext";
import { useVeiculos, useSyncMeta } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { LABEL } from "@/lib/labels";
import { FipeSyncResultadosPanel } from "@/pages/sync/FipeSyncResultadosPanel";
import { executarSyncId, useSyncDisparo } from "@/pages/sync/syncShared";

type FipeResposta = {
  cadastrado?: boolean;
  data?: Record<string, unknown>;
  fipe?: Record<string, unknown>;
};

type ModoPlaca = "frota" | "avulsa";

function normPlaca(placa?: string | null): string {
  return (placa ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function linhasFipe(resposta: FipeResposta) {
  const veiculo = resposta.data ?? {};
  const fipe = resposta.fipe ?? {};
  return [
    { label: "Placa", value: veiculo.placa },
    { label: "Marca / modelo", value: veiculo.marcaModelo },
    { label: "Ano / modelo", value: veiculo.anoModelo },
    { label: "Modelo FIPE", value: fipe.fipeModelo ?? veiculo.fipeModelo },
    { label: "Código FIPE", value: fipe.fipeCodigo ?? veiculo.fipeCodigo },
    { label: "Valor FIPE", value: fipe.fipeValor ?? veiculo.fipeValor },
    { label: "Mês referência", value: fipe.fipeReferencia ?? veiculo.fipeReferencia },
    { label: "URL FIPE", value: fipe.fipe ?? veiculo.fipe },
  ];
}

type Props = {
  initialPlaca?: string;
  initialMarcaModelo?: string;
  initialAnoModelo?: string;
};

export function FipeSyncPanel({
  initialPlaca,
  initialMarcaModelo,
  initialAnoModelo,
}: Props) {
  const qc = useQueryClient();
  const metaQuery = useSyncMeta();
  const veiculosQuery = useVeiculos();
  const { runningId, error: syncError, disparar } = useSyncDisparo();

  const [modo, setModo] = useState<ModoPlaca>(() =>
    initialPlaca?.trim() ? "avulsa" : "frota",
  );
  const [placaFrota, setPlacaFrota] = useState("");
  const [placaAvulsa, setPlacaAvulsa] = useState(() => (initialPlaca ?? "").toUpperCase());
  const [marcaModelo, setMarcaModelo] = useState(() => initialMarcaModelo ?? "");
  const [anoModelo, setAnoModelo] = useState(() => initialAnoModelo ?? "");
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<FipeResposta | null>(null);

  useEffect(() => {
    const p = initialPlaca?.trim();
    if (!p) return;
    setModo("avulsa");
    setPlacaAvulsa(p.toUpperCase());
  }, [initialPlaca]);

  useEffect(() => {
    if (initialMarcaModelo?.trim()) setMarcaModelo(initialMarcaModelo.trim());
  }, [initialMarcaModelo]);

  useEffect(() => {
    if (initialAnoModelo?.trim()) setAnoModelo(initialAnoModelo.trim());
  }, [initialAnoModelo]);

  const placaNorm = normPlaca(modo === "frota" ? placaFrota : placaAvulsa);

  const veiculoFrota = useMemo(() => {
    if (!placaNorm) return null;
    return (veiculosQuery.data?.items ?? []).find((v) => normPlaca(v.placa) === placaNorm) ?? null;
  }, [placaNorm, veiculosQuery.data]);

  const cadastrado = Boolean(veiculoFrota);
  const placaVazia = !placaNorm;
  const syncRodando = runningId === "fipe";

  async function consultar() {
    if (placaVazia) {
      setConsultaError("Informe ou selecione uma placa para consultar.");
      return;
    }

    const placaEnvio = (modo === "frota" ? veiculoFrota?.placa : placaAvulsa)?.trim() ?? "";
    const marcaEnvio =
      cadastrado ? veiculoFrota?.marcaModelo?.trim() : marcaModelo.trim();
    const anoEnvio = cadastrado ? veiculoFrota?.anoModelo?.trim() : anoModelo.trim();

    if (!cadastrado && (!marcaEnvio || !anoEnvio)) {
      setConsultaError("Veículo não cadastrado — informe marca/modelo e ano.");
      return;
    }

    setConsultaLoading(true);
    setConsultaError(null);
    setResultado(null);
    try {
      const r = (await lanzaApi.consultarFipe({
        placa: placaEnvio,
        marcaModelo: marcaEnvio || undefined,
        anoModelo: anoEnvio || undefined,
      })) as FipeResposta;
      setResultado(r);
    } catch (err) {
      setConsultaError(err instanceof LanzaApiError ? err.message : "Falha ao consultar FIPE.");
    } finally {
      setConsultaLoading(false);
    }
  }

  function atualizar() {
    setResultado(null);
    setConsultaError(null);
    const placa = placaVazia ? "" : (veiculoFrota?.placa ?? placaFrota).trim();
    void disparar("fipe", () =>
      executarSyncId(
        metaQuery.data?.syncs ?? [],
        "fipe",
        { dryRun: false, placa },
        true,
      ),
    ).then(() => {
      void qc.invalidateQueries({ queryKey: ["sync-jobs"] });
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
    });
  }

  const podeAtualizar = modo === "frota" && (placaVazia || cadastrado);
  const podeConsultar = !placaVazia && (cadastrado || modo === "avulsa");

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">FIPE</h2>

        <div className="form-grid" style={{ marginBottom: "0.75rem" }}>
          <label className="field checkbox-inline">
            <input
              type="radio"
              name="fipe-modo"
              checked={modo === "frota"}
              onChange={() => {
                setModo("frota");
                setResultado(null);
                setConsultaError(null);
              }}
              disabled={consultaLoading || syncRodando}
            />
            Selecionar da frota
          </label>
          <label className="field checkbox-inline">
            <input
              type="radio"
              name="fipe-modo"
              checked={modo === "avulsa"}
              onChange={() => {
                setModo("avulsa");
                setResultado(null);
                setConsultaError(null);
              }}
              disabled={consultaLoading || syncRodando}
            />
            Digitar placa (consulta avulsa)
          </label>
        </div>

        {modo === "frota" ? (
          <Field
            label="Veículo"
            hint="Vazio = atualizar todos os veículos e exibir o resultado abaixo."
          >
            <VeiculoSelect
              value={placaFrota}
              onChange={(v) => {
                setPlacaFrota(v);
                setResultado(null);
                setConsultaError(null);
              }}
              valueField="placa"
              variant="filtro"
              disabled={consultaLoading || syncRodando}
            />
          </Field>
        ) : (
          <Field label="Placa" hint="Veículo fora da frota — só visualização, não grava.">
            <input
              className="input"
              value={placaAvulsa}
              onChange={(e) => {
                setPlacaAvulsa(e.target.value.toUpperCase());
                setResultado(null);
                setConsultaError(null);
              }}
              placeholder="ABC1D23"
              disabled={consultaLoading || syncRodando}
            />
          </Field>
        )}

        {modo === "avulsa" && placaNorm && !cadastrado ? (
          <div className="form-grid">
            <Field label="Marca / modelo" hint="Ex.: VW/GOL">
              <input
                className="input"
                value={marcaModelo}
                onChange={(e) => setMarcaModelo(e.target.value)}
                placeholder="MARCA/MODELO"
                disabled={consultaLoading || syncRodando}
              />
            </Field>
            <Field label="Ano / modelo" hint="Ex.: 2018/2018">
              <input
                className="input"
                value={anoModelo}
                onChange={(e) => setAnoModelo(e.target.value)}
                placeholder="2018/2018"
                disabled={consultaLoading || syncRodando}
              />
            </Field>
          </div>
        ) : null}

        {modo === "avulsa" && placaNorm && cadastrado ? (
          <p className="field__hint">Placa encontrada na frota — pode consultar ou voltar ao modo frota para atualizar.</p>
        ) : null}

        <div className="despesas-toolbar" style={{ marginTop: "1rem" }}>
          {podeAtualizar ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={consultaLoading || syncRodando || metaQuery.isLoading}
              onClick={atualizar}
            >
              {syncRodando
                ? LABEL.processando
                : placaVazia
                  ? "Atualizar todos"
                  : "Atualizar placa"}
            </button>
          ) : null}
          {podeConsultar ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={consultaLoading || syncRodando}
              onClick={() => void consultar()}
            >
              {consultaLoading ? LABEL.processando : LABEL.consultar}
            </button>
          ) : null}
        </div>

        <FlashError message={consultaError} />
        <FlashError message={syncError} />
      </section>

      {resultado ? (
        <>
          {resultado.cadastrado === false ? (
            <p className="field__hint">Consulta avulsa — nada foi gravado.</p>
          ) : null}
          <DataFieldsPanel title="Consulta FIPE" rows={linhasFipe(resultado)} />
        </>
      ) : null}

      {modo === "frota" ? <FipeSyncResultadosPanel /> : null}
    </>
  );
}
