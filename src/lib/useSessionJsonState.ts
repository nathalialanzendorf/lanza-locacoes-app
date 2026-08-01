import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Estado JSON em sessionStorage — sobrevive ao ir/voltar do cadastro
 * (desmontagem da listagem) sem poluir a URL.
 */
export function useSessionJsonState<T extends Record<string, unknown>>(
  key: string,
  fallback: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback();
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback();
      return { ...fallback(), ...(parsed as T) };
    } catch {
      return fallback();
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }
  }, [key, state]);

  return [state, setState];
}
