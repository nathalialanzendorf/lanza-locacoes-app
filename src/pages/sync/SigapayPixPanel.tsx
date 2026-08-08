import { useMemo, useState } from "react";

import { ResultPanel } from "@/components/ResultPanel";
import { VeiculoSelect } from "@/components/EntitySelects";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { TipoVeiculoFrota } from "@/lib/domain";
import { ROTULO_SIGAPAY } from "@/lib/estacionamentoLabels";
import { useVeiculos } from "@/api/hooks";

/** Consulta PIX pública (pix.sigapay.com.br) — sem sessão logada; exige OTP SMS. */
export function SigapayPixPanel() {
  const [veiculoId, setVeiculoId] = useState("");
  const [phone, setPhone] = useState("");
  const [rpcId, setRpcId] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solicitacao, setSolicitacao] = useState<unknown>(null);
  const [resultado, setResultado] = useState<unknown>(null);

  const veiculosQuery = useVeiculos({ ativo: true, tipoFrota: TipoVeiculoFrota.Locacao });
  const placa = useMemo(() => {
    if (!veiculoId) return "";
    return veiculosQuery.data?.items.find((v) => v.id === veiculoId)?.placa ?? "";
  }, [veiculoId, veiculosQuery.data]);

  async function solicitarSms() {
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await lanzaApi.estacionamentoPixSolicitar(phone.trim(), placa);
      setSolicitacao(r.data);
      const id =
        r.data && typeof r.data === "object" && "id" in r.data
          ? String((r.data as { id?: string }).id ?? "")
          : "";
      if (id) setRpcId(id);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao solicitar código SMS.");
    } finally {
      setLoading(false);
    }
  }

  async function verificarOtp() {
    setLoading(true);
    setError(null);
    try {
      const r = await lanzaApi.estacionamentoPixVerificar(rpcId.trim(), otp.trim());
      setResultado(r.data);
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao verificar código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">Consulta PIX pública ({ROTULO_SIGAPAY})</h2>
      <p className="field__hint">
        Fluxo de <strong>pix.sigapay.com.br</strong> — não precisa de sessão logada. Informe o
        telefone cadastrado no SigaPay e a placa; receberá SMS com código OTP para obter o PIX.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Veículo</span>
          <VeiculoSelect
            value={veiculoId}
            onChange={setVeiculoId}
            valueField="id"
            ativo
            tipoFrota={TipoVeiculoFrota.Locacao}
            variant="filtro"
          />
        </label>
        <label className="field">
          <span className="field__label">Telefone (SMS)</span>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="48999999999"
            autoComplete="tel"
          />
        </label>
      </div>

      <div className="form-card__action-row">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={loading || !phone.trim() || !placa}
          onClick={() => void solicitarSms()}
        >
          {loading && !resultado ? "A solicitar…" : "1. Enviar código SMS"}
        </button>
      </div>

      {solicitacao ? (
        <p className="field__hint">
          <span className="badge badge--ok">SMS solicitado</span>
          {rpcId ? ` · id ${rpcId}` : null}
        </p>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Id (passo 1)</span>
          <input
            className="input"
            type="text"
            value={rpcId}
            onChange={(e) => setRpcId(e.target.value)}
            placeholder="rpc_…"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span className="field__label">Código SMS</span>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="62424"
            autoComplete="one-time-code"
          />
        </label>
      </div>

      <div className="form-card__action-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading || !rpcId.trim() || !otp.trim()}
          onClick={() => void verificarOtp()}
        >
          {loading && resultado === null && solicitacao ? "A verificar…" : "2. Verificar e obter PIX"}
        </button>
      </div>

      <FlashError message={error} />

      {resultado ? <ResultPanel title="Resposta PIX (portal)" data={resultado} /> : null}
      {solicitacao && !resultado ? (
        <ResultPanel title="Resposta solicitação SMS" data={solicitacao} />
      ) : null}
    </section>
  );
}
