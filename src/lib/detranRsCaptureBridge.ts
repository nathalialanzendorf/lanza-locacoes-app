import { API_TIMEOUT_MS } from "@/api/client";
import type { PortalCapturaState } from "@/api/types";

const BRIDGE_BASE =
  import.meta.env.VITE_DETRAN_RS_CAPTURE_BRIDGE?.trim() || "http://127.0.0.1:9237";

export type BridgeCapturaStartOpts = {
  apiUrl: string;
  bearer?: string;
  apiKey?: string;
};

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BRIDGE_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function detranRsBridgeHealth(): Promise<boolean> {
  const r = await bridgeFetch<{ ok?: boolean }>("/health");
  return Boolean(r?.ok);
}

export async function detranRsBridgeCapturaStatus(): Promise<PortalCapturaState | null> {
  const r = await bridgeFetch<{ data: PortalCapturaState }>("/capture/status");
  return r?.data ?? null;
}

export async function detranRsBridgeCapturaIniciar(
  opts: BridgeCapturaStartOpts,
): Promise<PortalCapturaState | null> {
  const r = await bridgeFetch<{ data: PortalCapturaState }>("/capture/start", {
    method: "POST",
    body: JSON.stringify(opts),
  });
  return r?.data ?? null;
}

export function detranRsBridgeStartHint(): string {
  return "Abra um terminal em lanza-locacoes-services e rode: npm run detran-rs-capture-bridge";
}
