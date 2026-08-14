const PRODUCTION_API_HOST = "api.lanzalocacoes.vercel.app";

export type BridgeCapturaStartOpts = {
  apiUrl: string;
  bearer?: string;
  apiKey?: string;
};

/** App em HTTPS (ex.: Vercel) não pode fazer fetch a http://127.0.0.1 (mixed content). */
export function bridgeFetchBlockedByHttps(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/** API na Vercel (ou outro host remoto) não executa CDP — captura só via bridge local. */
export function apiRemotaSemCapturaCdp(apiUrl: string): boolean {
  const raw = apiUrl.trim() || `https://${PRODUCTION_API_HOST}`;
  try {
    const host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return true;
  }
}

/** Usar bridge local (janela ou fetch) em vez da API remota. */
export function deveUsarBridgeLocal(apiUrl: string): boolean {
  return bridgeFetchBlockedByHttps() || apiRemotaSemCapturaCdp(apiUrl);
}

export function buildBridgeCaptureStartUrl(
  base: string,
  opts: BridgeCapturaStartOpts,
): string {
  const root = base.replace(/\/+$/, "");
  const u = new URL(`${root}/capture/start`);
  u.searchParams.set("apiUrl", opts.apiUrl);
  if (opts.bearer?.trim()) u.searchParams.set("bearer", opts.bearer.trim());
  if (opts.apiKey?.trim()) u.searchParams.set("apiKey", opts.apiKey.trim());
  return u.toString();
}

/** Abre o bridge local numa nova aba HTTP (funciona a partir da app HTTPS). */
export function abrirBridgeCapturaJanela(base: string, opts: BridgeCapturaStartOpts): void {
  window.open(buildBridgeCaptureStartUrl(base, opts), "lanza-bridge-capture", "noopener,noreferrer");
}
