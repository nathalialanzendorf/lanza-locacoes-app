import { useState } from "react";

import { VeiculoSelect } from "@/components/EntitySelects";
import { LanzaApiError } from "@/api/client";
import type { VeiculoConsultaPortaisResultado } from "@/api/types";
import { PortalSessoesSection } from "@/pages/relatorios/PortalSessoesSection";
import { SyncJobsTable } from "@/pages/sync/syncShared";
import {
  SECOES_PORTAL,
  SecaoDados,
  IdentificacaoVeiculo,
  FieldLike,
  buscaFrota,
  consultarVeiculoPortaisLive,
} from "@/pages/sync/veiculoDadosUi";

/** Sync › Dados do veículo — consulta live em todos os portais. */
export function SyncVeiculoDadosSection() {
  const [placaInput, setPlacaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<VeiculoConsultaPortaisResultado | null>(null);

  const consultaFrota = buscaFrota(placaInput);

  async function buscar() {
    setLoading(true);
    setProgress(null);
    setError(null);
    setResultado(null);
    try {
      const data = await consultarVeiculoPortaisLive({
        placa: placaInput.trim() || undefined,
        fonte: "todos",
        frota: consultaFrota,
        onProgress: setProgress,
      });
      setResultado(data);
    } catch (err) {
      setError(
        err instanceof LanzaApiError ? err.message : "Falha ao consultar portais do veículo.",
      );
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Dados do veículo (portais)</h2>
        <p className="field__hint">
          Consulta em tempo real todos os portais externos — DETRAN SC, DETRAN RS, Pedágio Digital e
          SigaPay. Configure a sessão de cada portal abaixo antes de consultar. Para ver o que já está
          gravado na base, use o menu <strong>Relatórios</strong>.
        </p>
        <div className="form-grid">
          <FieldLike label="Placa" hint="Vazio = frota activa inteira (pode demorar vários minutos)">
            <VeiculoSelect
              value={placaInput}
              onChange={setPlacaInput}
              allowEmpty
              ativo
              emptyLabel="Toda a frota activa"
              disabled={loading}
            />
          </FieldLike>
        </div>

        <div className="form-card__action-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void buscar()}
            disabled={loading}
          >
            {loading
              ? "A consultar portais…"
              : consultaFrota
                ? "Consultar frota nos portais"
                : "Consultar veículo nos portais"}
          </button>
        </div>
        {error ? <p className="form-card__error">{error}</p> : null}
        {progress ? <p className="field__hint">{progress}</p> : null}
      </section>

      <PortalSessoesSection disabled={loading} />

      {!resultado && !loading ? (
        <p className="muted">
          Selecione um veículo ou deixe vazio para consultar toda a frota activa nos portais.
        </p>
      ) : null}

      {resultado ? (
        <>
          <IdentificacaoVeiculo resultado={resultado} origemLabel="Portais externos (consulta live)" />
          {SECOES_PORTAL.map((sec) => (
            <SecaoDados
              key={sec.key}
              titulo={sec.titulo}
              origem={sec.origem}
              secao={resultado[sec.key]}
              loading={loading}
              colData={sec.colData}
              mostrarPlaca={resultado.modo === "frota"}
              emptyMessage={`Nenhum registo no portal (${sec.titulo}).`}
            />
          ))}
        </>
      ) : null}

      <SyncJobsTable title="Jobs recentes (syncs)" />
    </>
  );
}
