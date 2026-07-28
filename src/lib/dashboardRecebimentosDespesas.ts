import type { ClienteDespesa, DashboardRecebimentoLinha } from "@/api/types";
import { brToIsoDate } from "@/lib/dateBr";
import { formatPlaca } from "@/lib/format";

function diasAtraso(vencimentoBr: string | null | undefined, hojeIso: string): number | null {
  const vencIso = brToIsoDate(String(vencimentoBr ?? ""));
  if (!vencIso) return null;
  const hoje = new Date(`${hojeIso}T12:00:00`);
  const venc = new Date(`${vencIso}T12:00:00`);
  const diff = Math.round((hoje.getTime() - venc.getTime()) / 86_400_000);
  return diff > 0 ? diff : null;
}

function compararDataBrAsc(a: string, b: string): number {
  const ia = brToIsoDate(a);
  const ib = brToIsoDate(b);
  if (!ia || !ib) return a.localeCompare(b, "pt-BR");
  return ia.localeCompare(ib);
}

function ordenarLinhas(a: DashboardRecebimentoLinha, b: DashboardRecebimentoLinha): number {
  const na = (a.clienteNome ?? "").localeCompare(b.clienteNome ?? "", "pt-BR");
  if (na !== 0) return na;
  const pa = a.placa.localeCompare(b.placa, "pt-BR");
  if (pa !== 0) return pa;
  return (a.descricao ?? "").localeCompare(b.descricao ?? "", "pt-BR");
}

function ordenarLinhasAtraso(a: DashboardRecebimentoLinha, b: DashboardRecebimentoLinha): number {
  const na = (a.clienteNome ?? "").localeCompare(b.clienteNome ?? "", "pt-BR");
  if (na !== 0) return na;
  const venc = compararDataBrAsc(a.vencimentoBr ?? "", b.vencimentoBr ?? "");
  if (venc !== 0) return venc;
  const pa = a.placa.localeCompare(b.placa, "pt-BR");
  if (pa !== 0) return pa;
  return (a.descricao ?? "").localeCompare(b.descricao ?? "", "pt-BR");
}

export function despesaParaLinhaRecebimento(d: ClienteDespesa): DashboardRecebimentoLinha {
  const valor = Number(d.valorMulta) || 0;
  const placa = formatPlaca(d.placa ?? undefined) || String(d.placa ?? d.veiculoId ?? "—");
  return {
    clienteId: (d.clienteId ?? d.condutorId) ?? null,
    clienteNome: d.clienteNome ?? null,
    placa,
    veiculo: d.veiculoLabel?.trim() || placa,
    despesaId: d.id,
    descricao: d.descricao ?? d.titulo ?? null,
    valor,
    vencimentoBr: d.vencimentoBr ?? null,
  };
}

export function classificarDespesasRecebimento(
  despesas: ClienteDespesa[],
  hojeBr: string,
  hojeIso: string,
): { venceHoje: DashboardRecebimentoLinha[]; atrasados: DashboardRecebimentoLinha[] } {
  const venceHoje: DashboardRecebimentoLinha[] = [];
  const atrasados: DashboardRecebimentoLinha[] = [];
  const hojeIsoCmp = brToIsoDate(hojeBr) || hojeIso;

  for (const d of despesas) {
    const venc = d.vencimentoBr?.trim();
    if (!venc) continue;

    const linha = despesaParaLinhaRecebimento(d);
    const vencIso = brToIsoDate(venc);
    if (!vencIso) continue;

    if (venc === hojeBr) {
      venceHoje.push(linha);
    } else if (vencIso < hojeIsoCmp) {
      atrasados.push({
        ...linha,
        diasAtraso: diasAtraso(venc, hojeIso),
      });
    }
  }

  return {
    venceHoje: venceHoje.sort(ordenarLinhas),
    atrasados: atrasados.sort(ordenarLinhasAtraso),
  };
}

export function totalLinhasRecebimento(linhas: DashboardRecebimentoLinha[]): number {
  return Math.round(linhas.reduce((s, l) => s + l.valor, 0) * 100) / 100;
}
