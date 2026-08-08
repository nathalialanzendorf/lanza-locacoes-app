import { useState } from "react";

import { VeiculoSelect } from "@/components/EntitySelects";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import type { VeiculoConsultaFonte, VeiculoConsultaPortaisResultado } from "@/api/types";
import {
  SECOES_PORTAL,
  SecaoDados,
  type SecaoConfig,
} from "@/pages/sync/veiculoDadosUi";

const FONTE_SECAO: Record<
  Exclude<VeiculoConsultaFonte, "todos">,
  SecaoConfig["key"]
> = {
  "detran-sc": "detranSc",
  "detran-rs": "detranRs",
  pedagio: "pedagio",
  sigapay: "estacionamento",
};

/** Consulta live no portal específico desta aba de sync. */
export function SyncVeiculoPortalPanel({
  fonte,
  titulo,
  hint,
  disabled,
}: {
  fonte: Exclude<VeiculoConsultaFonte, "todos">;
  titulo: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [placaInput, setPlacaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<VeiculoConsultaPortaisResultado | null>(null);

  const secaoConfig = SECOES_PORTAL.find((s) => s.key === FONTE_SECAO[fonte])!;

  async function consultar() {
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await lanzaApi.consultarVeiculoPortaisSync({
        placa: placaInput.trim() || undefined,
        fonte,
      });
      setResultado(r.data);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha na consulta ao portal.");
    } finally {
      setLoading(false);
    }
  }

  const secao = resultado ? resultado[FONTE_SECAO[fonte]] : undefined;

  return (
    <section className="form-card">
      <header className="sync-section__head">
        <h2 className="form-card__title">{titulo}</h2>
        {hint ? <p className="field__hint">{hint}</p> : null}
      </header>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Veículo</span>
          <span className="field__hint">Vazio = frota activa (pode demorar)</span>
          <VeiculoSelect
            value={placaInput}
            onChange={setPlacaInput}
            allowEmpty
            ativo
            emptyLabel="Toda a frota activa"
            disabled={Boolean(disabled || loading)}
          />
        </label>
      </div>
      <div className="form-card__action-row">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void consultar()}
          disabled={Boolean(disabled || loading)}
        >
          {loading ? "A consultar portal…" : "Consultar portal"}
        </button>
      </div>
      {error ? <p className="form-card__error">{error}</p> : null}
      {resultado ? (
        <SecaoDados
          titulo={secaoConfig.titulo}
          origem={secaoConfig.origem}
          secao={secao}
          loading={loading}
          colData={secaoConfig.colData}
          mostrarPlaca={resultado.modo === "frota"}
          emptyMessage={`Nenhum registo no portal (${secaoConfig.titulo}).`}
        />
      ) : null}
    </section>
  );
}
