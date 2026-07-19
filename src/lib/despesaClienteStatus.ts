import type { ClienteDespesa } from "@/api/types";

export type BadgeStatusDespesa = "ok" | "warn" | "danger" | "muted";

function norm(s?: string | null): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function isCategoriaInfracao(categoria?: string | null): boolean {
  return norm(categoria).startsWith("infra");
}

function situacaoGenerica(s?: string | null): boolean {
  const t = norm(s);
  return !t || t === "em aberto" || t === "registrado" || t === "pago";
}

function parseDataBr(data?: string | null): Date | null {
  const raw = String(data ?? "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function debitoVencido(d: ClienteDespesa, ref = new Date()): boolean {
  if (d.convertidaEmDebito !== true) return false;
  const venc = parseDataBr(d.dataVencimentoOriginal ?? d.limiteDefesa);
  return venc != null && ref > venc;
}

function pagaLanza(d: ClienteDespesa): boolean {
  if (d.paga === true) return true;
  const sit = norm(d.situacao);
  return sit === "registrado" || sit === "pago";
}

function pagaDetran(d: ClienteDespesa): boolean {
  if (d.quitadaDetran === true) return true;
  const status = norm(d.statusInfracao ?? d.statusDetran ?? d.situacao);
  return status === "paga" || /quitad/.test(status);
}

function advertida(d: ClienteDespesa): boolean {
  const status = norm(d.statusInfracao ?? d.statusDetran ?? d.situacao);
  return status === "advertida" || status === "advertido";
}

function justificada(d: ClienteDespesa): boolean {
  const status = norm(d.statusInfracao ?? d.statusDetran ?? d.situacao);
  return status === "justificada";
}

/** Rótulo exibido na coluna Status da listagem de despesas cliente. */
export function rotuloStatusDespesaCliente(d: ClienteDespesa): string {
  if (pagaLanza(d)) return "Pago";

  const situacao = d.situacao?.trim();
  if (situacao && !situacaoGenerica(situacao)) {
    return situacao;
  }

  if (isCategoriaInfracao(d.categoria)) {
    if (pagaDetran(d)) return "Paga DETRAN";
    if (advertida(d)) return "Advertida";
    if (justificada(d)) return "Justificada";
    if (debitoVencido(d)) return "Vencida";
    if (d.convertidaEmDebito === true) return "Penalidade notificada";
    if (norm(d.statusInfracao) === "notificada" || norm(d.situacao) === "notificada") {
      return "Autuação notificada";
    }
  }

  if (situacao) return situacao;
  return "Em aberto";
}

export function badgeStatusDespesaCliente(d: ClienteDespesa): BadgeStatusDespesa {
  if (d.ativo === false) return "muted";
  if (pagaLanza(d) || pagaDetran(d)) return "ok";
  if (advertida(d) || justificada(d)) return "muted";

  const rotulo = norm(rotuloStatusDespesaCliente(d));
  if (rotulo.includes("vencid")) return "danger";
  if (
    rotulo.includes("notificad") ||
    rotulo.includes("penalidade") ||
    rotulo.includes("autuacao") ||
    rotulo === "em aberto"
  ) {
    return "warn";
  }
  return "warn";
}

/** Débito cobrável ao locatário (linha em destaque vermelho). */
export function despesaCobravelCliente(d: ClienteDespesa): boolean {
  if (d.ativo === false) return false;
  if (pagaLanza(d)) return false;

  if (isCategoriaInfracao(d.categoria)) {
    if (pagaDetran(d) || advertida(d) || justificada(d)) return false;
    return true;
  }

  return !pagaLanza(d);
}

export function despesaElegivelBaixaCliente(d: ClienteDespesa): boolean {
  if (!despesaCobravelCliente(d)) return false;
  return Boolean((d.clienteId ?? d.condutorId)?.trim());
}
