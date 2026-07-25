import type { DetranScCapturaState } from "@/api/types";

const BRIDGE_BASE =
  import.meta.env.VITE_DETRAN_CAPTURE_BRIDGE?.trim() || "http://127.0.0.1:9234";

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BRIDGE_BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function bridgeHealth(): Promise<boolean> {
  const r = await bridgeFetch<{ ok?: boolean }>("/health");
  return Boolean(r?.ok);
}

export async function bridgeCapturaStatus(): Promise<DetranScCapturaState | null> {
  const r = await bridgeFetch<{ data: DetranScCapturaState }>("/capture/status");
  return r?.data ?? null;
}

export async function bridgeCapturaIniciar(): Promise<DetranScCapturaState | null> {
  const r = await bridgeFetch<{ data: DetranScCapturaState }>("/capture/start", {
    method: "POST",
  });
  return r?.data ?? null;
}

export async function bridgeCapturaParar(): Promise<DetranScCapturaState | null> {
  const r = await bridgeFetch<{ data: DetranScCapturaState }>("/capture/stop", {
    method: "DELETE",
  });
  return r?.data ?? null;
}
