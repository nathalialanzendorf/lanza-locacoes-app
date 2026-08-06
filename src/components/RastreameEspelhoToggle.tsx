import { Toggle } from "@/components/Toggle";
import { useRastreameEspelho } from "@/hooks/useRastreameEspelho";

type Props = {
  /** Destaque na aba Sync › Rastreame (além do rodapé do menu). */
  variant?: "sidebar" | "panel";
};

export function RastreameEspelhoToggle({ variant = "sidebar" }: Props) {
  const { ativo, config, loading, setAtivo, error } = useRastreameEspelho();

  if (!config && loading) {
    return <p className="field__hint">A carregar configuração do espelho…</p>;
  }

  if (!config) return null;

  const bloqueado = loading || !config.editavelViaApi;
  const hintEnv =
    !config.editavelViaApi && config.origem === "env"
      ? "Controlado por LANZA_RASTREAME_ESPELHO no servidor"
      : !config.editavelViaApi
        ? "Neste ambiente altere LANZA_RASTREAME_ESPELHO nas variáveis do servidor"
        : null;

  return (
    <div
      className={`rastreame-espelho${variant === "panel" ? " rastreame-espelho--panel" : ""}`}
    >
      <Toggle
        checked={ativo}
        onChange={(next) => void setAtivo(next)}
        disabled={bloqueado}
        label="Espelhar no Rastreame"
        aria-label="Espelhar no Rastreame"
      />
      {hintEnv ? (
        <span className="rastreame-espelho__hint">{hintEnv}</span>
      ) : (
        <span className={`rastreame-espelho__status ${ativo ? "is-on" : "is-off"}`}>
          {ativo ? "ligado" : "desligado"}
        </span>
      )}
      {error ? (
        <span className="rastreame-espelho__hint rastreame-espelho__hint--erro">
          {error instanceof Error ? error.message : "Falha ao atualizar"}
        </span>
      ) : null}
      {variant === "panel" && bloqueado && hintEnv ? (
        <p className="field__hint sync-rastreame-aviso">
          Ligue o espelho definindo <code>LANZA_RASTREAME_ESPELHO=true</code> no servidor (Vercel
          ou variáveis locais).
        </p>
      ) : null}
      {variant === "panel" && !bloqueado && !ativo ? (
        <p className="field__hint sync-rastreame-aviso">
          Ligue o espelho para enviar dados ao Rastreame e replicar alterações de despesas.
        </p>
      ) : null}
    </div>
  );
}
