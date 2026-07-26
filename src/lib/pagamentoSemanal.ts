import { brToIsoDate } from "@/lib/dateBr";
import { labelCurtoDiaSemana } from "@/lib/domain";

/** Ex.: "Pagamento semanal - Quarta 15" a partir do vencimento DD/MM/AAAA. */
export function descricaoPagamentoSemanalDeVencimentoBr(vencimentoBr: string): string | null {
  const iso = brToIsoDate(vencimentoBr);
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getDate() !== d || date.getMonth() !== mo - 1) {
    return null;
  }
  const label = labelCurtoDiaSemana(date.getDay());
  if (!label) return null;
  const dia = String(d).padStart(2, "0");
  return `Pagamento semanal - ${label} ${dia}`;
}
