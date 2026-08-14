import { useEffect, useState } from "react";

import { bridgeFetchBlockedByHttps, deveUsarBridgeLocal } from "@/lib/captureBridgeClient";
import { detranRsBridgeHealth } from "@/lib/detranRsCaptureBridge";
import { bridgeHealth as detranScBridgeHealth } from "@/lib/detranScCaptureBridge";
import { pedagioBridgeHealth } from "@/lib/pedagioCaptureBridge";
import { sigapayBridgeHealth } from "@/lib/sigapayCaptureBridge";

type BridgeDef = { id: string; label: string; health: () => Promise<boolean> };

const ALL_BRIDGES: BridgeDef[] = [
  { id: "detran-sc", label: "DETRAN SC", health: detranScBridgeHealth },
  { id: "sigapay", label: "SigaPay", health: sigapayBridgeHealth },
  { id: "pedagio", label: "Pedágio", health: pedagioBridgeHealth },
  { id: "detran-rs", label: "DETRAN RS", health: detranRsBridgeHealth },
];

type Props = {
  /** Se definido, mostra só estes bridges (ex.: aba Pedágio). */
  only?: string[];
};

export function CaptureBridgesStatus({ only }: Props) {
  const [ativo, setAtivo] = useState<Record<string, boolean>>({});

  const bridges = only?.length
    ? ALL_BRIDGES.filter((b) => only.includes(b.id))
    : ALL_BRIDGES;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const next: Record<string, boolean> = {};
      await Promise.all(
        bridges.map(async (b) => {
          next[b.id] = await b.health();
        }),
      );
      if (!cancelled) setAtivo(next);
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [only?.join(",")]);

  const algumAtivo = bridges.some((b) => ativo[b.id]);
  const todosAtivos = bridges.every((b) => ativo[b.id]);
  const httpsApp = bridgeFetchBlockedByHttps();
  const usaBridgeLocal =
    typeof window !== "undefined" &&
    deveUsarBridgeLocal(
      (import.meta.env.VITE_API_BASE_URL?.trim() || "https://api.lanzalocacoes.vercel.app").replace(
        /\/+$/,
        "",
      ),
    );

  return (
    <p className="field__hint">
      Bridge local:{" "}
      {bridges.map((b) => (
        <span key={b.id} style={{ marginRight: "0.65rem" }}>
          <span className={ativo[b.id] ? "badge badge--ok" : "badge badge--muted"}>{b.label}</span>
        </span>
      ))}
      {(httpsApp || usaBridgeLocal) && !algumAtivo ? (
        <>
          {" "}
          — API remota: rode <code>npm run capture-bridges-all</code> e use Capturar sessão (abre janela em{" "}
          <code>127.0.0.1</code>)
        </>
      ) : !algumAtivo ? (
        <>
          {" "}
          — rode <code>npm run capture-bridges-all</code> em lanza-locacoes-services
        </>
      ) : todosAtivos && bridges.length === ALL_BRIDGES.length ? (
        <> · todos activos</>
      ) : null}
    </p>
  );
}
