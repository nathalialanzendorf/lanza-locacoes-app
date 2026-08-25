import { apiRequest } from "@/api/client";

export type ViaCepResult = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export function cepDigitos(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatarCep(cep: string): string {
  const d = cepDigitos(cep);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep.trim();
}

export function cepValido(cep: string): boolean {
  return cepDigitos(cep).length === 8;
}

/** Consulta endereço pelo CEP via ViaCEP (proxy na API Lanza). */
export async function consultarCep(cep: string): Promise<ViaCepResult> {
  const digits = cepDigitos(cep);
  if (digits.length !== 8) {
    throw new Error("CEP inválido");
  }

  const r = await apiRequest<{ data: ViaCepResult }>(`/api/cep/${digits}`);
  return r.data;
}
