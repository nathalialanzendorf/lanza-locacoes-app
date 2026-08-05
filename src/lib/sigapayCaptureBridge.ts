import { API_TIMEOUT_MS } from "@/api/client";
import type { SigapayCapturaState } from "@/api/types";

const BRIDGE_BASE =
  import.meta.env.VITE_SIGAPAY_CAPTURE_BRIDGE?.trim() || "http://127.0.0.1:9235";

export type SigapayBridgeCapturaStartOpts = {
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

export async function sigapayBridgeHealth(): Promise<boolean> {
  const r = await bridgeFetch<{ ok?: boolean }>("/health");
  return Boolean(r?.ok);
}

export async function sigapayBridgeCapturaStatus(): Promise<SigapayCapturaState | null> {
  const r = await bridgeFetch<{ data: SigapayCapturaState }>("/capture/status");
  return r?.data ?? null;
}

export async function sigapayBridgeCapturaIniciar(
  opts: SigapayBridgeCapturaStartOpts,
): Promise<SigapayCapturaState | null> {
  const r = await bridgeFetch<{ data: SigapayCapturaState }>("/capture/start", {
    method: "POST",
    body: JSON.stringify(opts),
  });
  return r?.data ?? null;
}

export async function sigapayBridgeCapturaParar(): Promise<SigapayCapturaState | null> {
  const r = await bridgeFetch<{ data: SigapayCapturaState }>("/capture/stop", {
    method: "DELETE",
  });
  return r?.data ?? null;
}

export function sigapayBridgeStartHint(): string {
  return "Abra um terminal em lanza-locacoes-services e rode: npm run sigapay-capture-bridge";
}
