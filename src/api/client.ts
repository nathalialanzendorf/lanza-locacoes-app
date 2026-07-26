import type { ApiError } from "./types";
import { getStoredToken } from "./authClient";

const STORAGE_KEY = "lanza_api_key";

const PRODUCTION_API_URL = "https://api.lanzalocacoes.vercel.app";

function isLanzaFrontendHost(hostname: string): boolean {
  return (
    hostname === "lanzalocacoes.vercel.app" ||
    /^lanzalocacoes[\w-]*\.vercel\.app$/.test(hostname) ||
    /^lanza-locacoes-app[\w-]*\.vercel\.app$/.test(hostname)
  );
}

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (import.meta.env.PROD && typeof window !== "undefined") {
    if (isLanzaFrontendHost(window.location.hostname)) {
      return PRODUCTION_API_URL;
    }
  }
  return "";
}

function baseUrl(): string {
  return getApiBaseUrl();
}

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_API_KEY ?? "";
}

export function setStoredApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export class LanzaApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LanzaApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Timeout HTTP (ms). Útil para OCR de documentos. */
  timeoutMs?: number;
};

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl()}${normalized}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = getStoredApiKey().trim();
  if (apiKey) headers["X-API-Key"] = apiKey;

  const token = getStoredToken().trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  if (options.timeoutMs != null && options.timeoutMs > 0) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.params), init);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Falha na ligação à API";
    const msg =
      /timeout|connection terminated/i.test(raw)
        ? "A API demorou demais ou perdeu ligação ao banco. Aguarde alguns segundos e verifique a lista de contratos antes de tentar de novo."
        : raw || "Sem ligação à API";
    throw new LanzaApiError(0, msg);
  }
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!res.ok) {
    const message =
      (payload as ApiError | null)?.error ??
      (res.status ? `Erro HTTP ${res.status}` : "Erro sem status code");
    throw new LanzaApiError(res.status, message);
  }

  return payload as T;
}

/** Transferência de ficheiro (Word/PDF) com autenticação. */
export async function apiDownload(
  path: string,
  options: Omit<RequestOptions, "body"> & { filename?: string } = {},
): Promise<void> {
  const headers: Record<string, string> = {};
  const apiKey = getStoredApiKey().trim();
  if (apiKey) headers["X-API-Key"] = apiKey;
  const token = getStoredToken().trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.timeoutMs != null && options.timeoutMs > 0) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }

  const res = await fetch(buildUrl(path, options.params), init);
  if (!res.ok) {
    const text = await res.text();
    let message = `Erro HTTP ${res.status}`;
    try {
      const payload = JSON.parse(text) as ApiError;
      if (payload.error) message = payload.error;
    } catch {
      if (text.trim()) message = text.trim();
    }
    throw new LanzaApiError(res.status, message);
  }

  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(dispo);
  const filename = options.filename ?? match?.[1] ?? "documento";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Envio de ficheiro binário (ex.: PDF do contrato assinado). */
export async function apiUpload<T>(
  path: string,
  file: Blob,
  options: Omit<RequestOptions, "body"> & { filename: string; contentType?: string } = {
    filename: "arquivo",
  },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": options.contentType?.trim() || file.type || "application/octet-stream",
    "X-Filename": options.filename,
  };
  const apiKey = getStoredApiKey().trim();
  if (apiKey) headers["X-API-Key"] = apiKey;
  const token = getStoredToken().trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method: options.method ?? "PUT",
    headers,
    body: file,
  };
  if (options.timeoutMs != null && options.timeoutMs > 0) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }

  const params = { ...options.params, filename: options.filename };
  const res = await fetch(buildUrl(path, params), init);
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!res.ok) {
    const message =
      (payload as ApiError | null)?.error ??
      (res.status ? `Erro HTTP ${res.status}` : "Erro sem status code");
    throw new LanzaApiError(res.status, message);
  }

  return payload as T;
}
