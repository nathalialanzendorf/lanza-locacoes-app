export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor monetário para campo de texto (ex.: 610,05). */
export function formatValorInput(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Aceita digitação/cola em pt-BR: 610,05 · 1.610,05 · 0,00 · R$ 120,00 · 610.05.
 * `allowZero` permite 0,00 (padrão: false).
 */
export function parseValorInput(
  raw: string,
  opts?: { allowZero?: boolean },
): number | null {
  let s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$\s?/i, "");
  if (!s) return null;

  // Só dígitos e separadores
  s = s.replace(/[^\d.,]/g, "");
  if (!s || s === "," || s === "." || s === ",," || s === "..") return null;

  let normalized: string;
  if (s.includes(",") && s.includes(".")) {
    // 1.610,05 → milhar com ponto, decimal com vírgula
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // 610,05 ou 0,00 — vírgula = decimal (ignora vírgulas extras)
    const parts = s.split(",");
    const intPart = (parts[0] ?? "").replace(/\D/g, "") || "0";
    const decPart = (parts.slice(1).join("") || "").replace(/\D/g, "").slice(0, 2);
    normalized = decPart.length > 0 ? `${intPart}.${decPart}` : intPart;
  } else if (s.includes(".")) {
    const parts = s.split(".");
    // Um ponto com 1–2 casas → decimal; senão milhar
    if (parts.length === 2 && (parts[1] ?? "").length <= 2) {
      normalized = s;
    } else {
      normalized = s.replace(/\./g, "");
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0 && !opts?.allowZero) return null;
  return Math.round(n * 100) / 100;
}

/** Mantém só caracteres válidos ao digitar (dígitos, vírgula/ponto decimal). */
export function sanitizeValorDigitado(raw: string): string {
  let s = String(raw ?? "").replace(/[^\d.,]/g, "");
  if (!s) return "";

  // Preferir vírgula como decimal: se digitar ponto e ainda não há vírgula, troca
  if (s.includes(".") && !s.includes(",")) {
    const parts = s.split(".");
    if (parts.length === 2 && (parts[1] ?? "").length <= 2) {
      s = `${parts[0]},${parts[1]}`;
    } else {
      // vários pontos / milhar → remove pontos (usuário ainda está digitando)
      s = s.replace(/\./g, "");
    }
  }

  // Uma única vírgula decimal
  const firstComma = s.indexOf(",");
  if (firstComma >= 0) {
    const head = s.slice(0, firstComma + 1).replace(/\./g, "");
    const tail = s
      .slice(firstComma + 1)
      .replace(/[^\d]/g, "")
      .slice(0, 2);
    s = head + tail;
  }

  return s;
}


export function formatPlaca(placa?: string): string {
  if (!placa) return "—";
  const raw = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (raw.length === 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return placa;
}

export type VeiculoLabelInput = {
  placa?: string | null;
  id?: string;
  marcaModelo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  anoModelo?: string | null;
};

/** Rótulo padrão de combobox: PLACA · marca/modelo · ano. */
export function formatVeiculoLabel(v: VeiculoLabelInput): string {
  const placa = formatPlaca(v.placa ?? v.id);
  const modelo =
    v.marcaModelo?.trim() ||
    [v.marca?.trim(), v.modelo?.trim()].filter(Boolean).join(" ").trim();
  const ano = v.anoModelo?.trim();
  const parts = [placa];
  if (modelo) parts.push(modelo);
  if (ano) parts.push(ano);
  return parts.join(" · ");
}

export type ClienteLabelInput = {
  nome?: string | null;
  id?: string;
  ativo?: boolean;
};

/** Rótulo padrão de cliente: só o nome; inativo em MAIÚSCULAS. */
export function formatClienteLabel(c: ClienteLabelInput): string {
  const nome = c.nome?.trim() || c.id?.slice(0, 8) || "—";
  if (c.ativo === false) return nome.toLocaleUpperCase("pt-BR");
  return nome;
}

/** Rótulo para `<option>` — destaca cliente com contrato operacional ativo. */
export function formatClienteSelectOption(c: ClienteLabelInput, contratoAtivo?: boolean): string {
  const base = formatClienteLabel(c);
  if (contratoAtivo) return `${base} · ativo`;
  return base;
}

/** Nome para exibição quando só há texto (sem cadastro); inativo opcional. */
export function formatClienteNomeExibicao(nome: string | null | undefined, ativo?: boolean): string {
  const n = nome?.trim();
  if (!n) return "—";
  if (ativo === false) return n.toLocaleUpperCase("pt-BR");
  return n;
}

/** Resolve nome formatado por id do cadastro ou fallback denormalizado. */
export function clienteExibicaoPorId(
  clientes: ClienteLabelInput[] | undefined,
  clienteId: string | null | undefined,
  fallbackNome?: string | null,
): string {
  const id = clienteId?.trim();
  if (id) {
    const c = clientes?.find((x) => x.id === id);
    if (c) return formatClienteLabel(c);
  }
  return formatClienteNomeExibicao(fallbackNome);
}

export {
  rotuloStatusRegistro as statusLabel,
  classeStatusRegistro as statusClass,
} from "@/lib/domain";
