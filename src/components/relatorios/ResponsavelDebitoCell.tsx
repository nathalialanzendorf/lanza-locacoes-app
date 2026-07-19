import { useState } from "react";
import { ClienteSelect, ParceiroSelect } from "@/components/EntitySelects";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { clienteIdDe } from "@/lib/clienteCampo";
import {
  labelStatusResponsavel,
  precisaConfirmacao,
  statusResponsavel,
} from "@/lib/responsavelDebitoUi";

type Props =
  | {
      tipo: "infracao";
      chave: string;
      item: Parameters<typeof statusResponsavel>[0];
      onConfirmed: () => void;
    }
  | {
      tipo: "pedagio";
      despesaId: string;
      autoInfracao: string;
      item: Parameters<typeof statusResponsavel>[0];
      onConfirmed: () => void;
    };

export function ResponsavelDebitoCell(props: Props) {
  const { item, onConfirmed } = props;
  const status = statusResponsavel(item);
  const badge = labelStatusResponsavel(status);
  const [clienteId, setClienteId] = useState(clienteIdDe(item) ?? "");
  const [parceiroId, setParceiroId] = useState("");
  const [loading, setLoading] = useState<"cliente" | "parceiro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!precisaConfirmacao(item)) {
    return <span className={badge.className}>{badge.text}</span>;
  }

  async function confirmarCliente() {
    if (!clienteId.trim()) {
      setError("Selecione um cliente.");
      return;
    }
    setLoading("cliente");
    setError(null);
    try {
      if (props.tipo === "infracao") {
        await lanzaApi.confirmarClienteInfracao(props.chave, clienteId.trim());
      } else {
        await lanzaApi.confirmarClienteDespesa(props.despesaId, clienteId.trim());
      }
      onConfirmed();
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao confirmar cliente.");
    } finally {
      setLoading(null);
    }
  }

  async function confirmarParceiro() {
    setLoading("parceiro");
    setError(null);
    try {
      if (props.tipo === "infracao") {
        await lanzaApi.confirmarParceiroInfracao(
          props.chave,
          parceiroId.trim() || undefined,
        );
      } else {
        await lanzaApi.confirmarParceiroDespesa(
          props.despesaId,
          parceiroId.trim() || undefined,
        );
      }
      onConfirmed();
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao confirmar parceiro.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="responsavel-debito-cell">
      <span className={badge.className}>{badge.text}</span>
      <div className="responsavel-debito-cell__actions">
        <ClienteSelect
          value={clienteId}
          onChange={setClienteId}
          ativo
          variant="cadastro"
          aria-label="Cliente responsável"
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(loading)}
          onClick={() => void confirmarCliente()}
        >
          {loading === "cliente" ? "…" : "Confirmar cliente"}
        </button>
        <ParceiroSelect
          value={parceiroId}
          onChange={setParceiroId}
          ativo
          variant="cadastro"
          aria-label="Parceiro responsável"
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={Boolean(loading)}
          onClick={() => void confirmarParceiro()}
        >
          {loading === "parceiro" ? "…" : "Confirmar parceiro"}
        </button>
      </div>
      {error ? <p className="form-card__error">{error}</p> : null}
    </div>
  );
}
