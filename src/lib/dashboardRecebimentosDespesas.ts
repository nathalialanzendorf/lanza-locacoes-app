import type { ClienteDespesa, DashboardRecebimentoLinha } from "@/api/types";
import { CategoriaDespesaCliente } from "@/lib/domain";
import { brToIsoDate } from "@/lib/dateBr";
import { formatPlaca } from "@/lib/format";

export type CategoriaRecebimentoDashboard = {
  id: "semanal" | "caucao" | "renegociacao";
  categoria: string;
  titulo: string;
};

export const CATEGORIAS_RECEBIMENTO_DASHBOARD: CategoriaRecebimentoDashboard[] = [
  {
    id: "semanal",
    categoria: CategoriaDespesaCliente.LocacaoSemanal,
    titulo: "Pagamento semanal",
  },
  { id: "caucao", categoria: CategoriaDespesaCliente.Caucao, titulo: "Caução" },
  {
    id: "renegociacao",
    categoria: CategoriaDespesaCliente.Renegociacao,
    titulo: "Renegociação",
  },
];

export type RecebimentoCategoriaClassificado = {
  totalEmAberto: number;
  venceHoje: DashboardRecebimentoLinha[];
  atrasados: DashboardRecebimentoLinha[];
};

export type RecebimentosPorCategoria = Record<
  CategoriaRecebimentoDashboard["id"],
  RecebimentoCategoriaClassificado
>;

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

function categoriaDespesaMatch(d: ClienteDespesa, categoria: string): boolean {
  return (d.categoria ?? "").trim().toLowerCase() === categoria.trim().toLowerCase();
}

export function filtrarDespesasPorCategoria(
  despesas: ClienteDespesa[],
  categoria: string,
): ClienteDespesa[] {
  return despesas.filter((d) => categoriaDespesaMatch(d, categoria));
}

export function totalDespesasEmAberto(despesas: ClienteDespesa[]): number {
  return Math.round(
    despesas.reduce((s, d) => s + (Number(d.valorMulta) || 0), 0) * 100,
  ) / 100;
}

export function classificarRecebimentosPorCategoria(
  despesas: ClienteDespesa[],
  hojeBr: string,
  hojeIso: string,
): RecebimentosPorCategoria {
  const resultado = {} as RecebimentosPorCategoria;

  for (const cat of CATEGORIAS_RECEBIMENTO_DASHBOARD) {
    const filtradas = filtrarDespesasPorCategoria(despesas, cat.categoria);
    const { venceHoje, atrasados } = classificarDespesasRecebimento(filtradas, hojeBr, hojeIso);
    resultado[cat.id] = {
      totalEmAberto: totalDespesasEmAberto(filtradas),
      venceHoje,
      atrasados,
    };
  }

  return resultado;
}

export function juntarLinhasVenceHoje(porCategoria: RecebimentosPorCategoria): DashboardRecebimentoLinha[] {
  const linhas: DashboardRecebimentoLinha[] = [];
  for (const cat of CATEGORIAS_RECEBIMENTO_DASHBOARD) {
    linhas.push(...porCategoria[cat.id].venceHoje);
  }
  return linhas.sort(ordenarLinhas);
}
