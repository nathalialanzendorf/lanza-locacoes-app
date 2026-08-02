import { brToIsoDate, isoDateToBr } from "@/lib/dateBr";
import { TipoContrato, type TipoContratoValor } from "@/lib/domain";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDataBrToDate(dataBr: string): Date | null {
  const iso = brToIsoDate(dataBr.trim());
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`);
}

function formatDataBr(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function diaPagamentoParaDow(diaPagamento?: string | null): number {
  const t = String(diaPagamento ?? "sábado")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (t.includes("domingo")) return 0;
  if (t.includes("segunda")) return 1;
  if (t.includes("terca")) return 2;
  if (t.includes("quarta")) return 3;
  if (t.includes("quinta")) return 4;
  if (t.includes("sexta")) return 5;
  return 6;
}

function diasNoMes(ano: number, mes0: number): number {
  return new Date(ano, mes0 + 1, 0).getDate();
}

function dataNoDiaMes(ano: number, mes0: number, diaMes: number): Date {
  const dia = Math.min(Math.max(1, diaMes), diasNoMes(ano, mes0));
  return new Date(ano, mes0, dia, 12, 0, 0);
}

/** 1.ª parcela na semana seguinte ao dia de pagamento após a retirada. */
export function gerarDatasParcelasSemanal(
  inicioBr: string,
  parcelas: number,
  diaPagamento?: string | null,
): string[] {
  if (parcelas < 1) return [];
  const inicio = parseDataBrToDate(inicioBr);
  if (!inicio) return [];
  const dow = diaPagamentoParaDow(diaPagamento);
  const first = new Date(inicio);
  while (first.getDay() !== dow) {
    first.setDate(first.getDate() + 1);
  }
  first.setDate(first.getDate() + 7);
  const out: string[] = [];
  for (let i = 0; i < parcelas; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    out.push(formatDataBr(d));
  }
  return out;
}

export function gerarDatasParcelasMensal(
  inicioBr: string,
  parcelas: number,
  diaMes: number,
): string[] {
  if (parcelas < 1) return [];
  const inicio = parseDataBrToDate(inicioBr);
  if (!inicio) return [];
  const dia = Math.min(31, Math.max(1, Math.round(diaMes)));
  let first = dataNoDiaMes(inicio.getFullYear(), inicio.getMonth(), dia);
  if (first.getTime() <= inicio.getTime()) {
    first = dataNoDiaMes(inicio.getFullYear(), inicio.getMonth() + 1, dia);
  }
  const out: string[] = [];
  for (let i = 0; i < parcelas; i++) {
    out.push(formatDataBr(dataNoDiaMes(first.getFullYear(), first.getMonth() + i, dia)));
  }
  return out;
}

export function gerarDatasParcelasDiaria(inicioBr: string, parcelas: number): string[] {
  if (parcelas < 1) return [];
  const inicio = parseDataBrToDate(inicioBr);
  if (!inicio) return [];
  const out: string[] = [];
  for (let i = 0; i < parcelas; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + 1 + i);
    out.push(formatDataBr(d));
  }
  return out;
}

export function gerarDatasParcelasPorTipo(
  inicioBr: string,
  parcelas: number,
  opts: {
    tipoContrato: TipoContratoValor;
    diaPagamento?: string;
    diaPagamentoMes?: string | number;
  },
): string[] {
  if (opts.tipoContrato === TipoContrato.Mensal) {
    const diaMes =
      typeof opts.diaPagamentoMes === "number"
        ? opts.diaPagamentoMes
        : Number.parseInt(String(opts.diaPagamentoMes ?? "").trim(), 10);
    return gerarDatasParcelasMensal(
      inicioBr,
      parcelas,
      Number.isFinite(diaMes) && diaMes >= 1 && diaMes <= 31 ? diaMes : 1,
    );
  }
  if (opts.tipoContrato === TipoContrato.Diaria) {
    return gerarDatasParcelasDiaria(inicioBr, parcelas);
  }
  return gerarDatasParcelasSemanal(inicioBr, parcelas, opts.diaPagamento);
}

/** Ajusta o array de datas ao número de parcelas, preenchendo as novas. */
export function alinharDatasParcelas(
  atuais: string[],
  sugeridas: string[],
  parcelas: number,
): string[] {
  const n = Math.max(0, Math.round(parcelas));
  if (n <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const atual = atuais[i]?.trim() ?? "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(atual)) {
      out.push(atual);
    } else {
      out.push(sugeridas[i] ?? "");
    }
  }
  return out;
}

export function datasParcelasParaApi(datas: string[]): string | null {
  const limpas = datas.map((d) => d.trim()).filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d));
  if (limpas.length === 0) return null;
  return limpas.join(",");
}

export function validarDatasParcelas(datas: string[], parcelas: number): string | null {
  if (parcelas < 1) return null;
  if (datas.length !== parcelas) {
    return `Informe a data de pagamento das ${parcelas} parcela(s).`;
  }
  for (let i = 0; i < datas.length; i++) {
    const d = datas[i]?.trim() ?? "";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d) || !brToIsoDate(d)) {
      return `Data da parcela ${i + 1} inválida — use DD/MM/AAAA.`;
    }
  }
  return null;
}

/** Converte ISO ou BR para BR (DateInput). */
export function dataBrOuIsoParaBr(raw: string): string {
  const t = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return isoDateToBr(t.slice(0, 10));
  return t;
}
