import type { ClienteDespesa } from "@/api/types";
import { formatBrl } from "@/lib/format";
import { despesaElegivelBaixaCliente } from "@/lib/despesaClienteStatus";

export type OpcaoPendenciaDespesa = {
  id: string;
  placa: string;
  valor: number;
  vencimentoBr: string;
  label: string;
};

function vencimentoSortMs(vencimentoBr?: string | null): number {
  const m = String(vencimentoBr ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const [, dd, mm, yyyy] = m;
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
}

function valorDespesaCliente(d: ClienteDespesa): number {
  const v = Number(d.valorMulta);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Opções de `<select>` para pendências em aberto — vencimento no rótulo, mais recente primeiro. */
export function montarOpcoesPendenciaDespesa(despesas: ClienteDespesa[]): OpcaoPendenciaDespesa[] {
  return despesas
    .filter((d) => despesaElegivelBaixaCliente(d))
    .map((d) => {
      const valorDevido = valorDespesaCliente(d);
      if (valorDevido <= 0) return null;
      const rotulo = d.descricao?.trim() || d.categoria?.trim() || d.id;
      const placa = d.placa?.trim() || d.veiculoId?.trim() || "";
      const vencimentoBr = d.vencimentoBr?.trim() || "";
      const partes = [formatBrl(valorDevido)];
      if (vencimentoBr) partes.push(`venc. ${vencimentoBr}`);
      partes.push(rotulo);
      if (placa) partes.push(placa);
      return {
        id: d.id,
        placa,
        valor: valorDevido,
        vencimentoBr,
        label: partes.join(" · "),
      };
    })
    .filter((o): o is OpcaoPendenciaDespesa => o != null)
    .sort((a, b) => {
      const ta = vencimentoSortMs(a.vencimentoBr);
      const tb = vencimentoSortMs(b.vencimentoBr);
      if (ta !== tb) return tb - ta;
      return a.label.localeCompare(b.label, "pt-BR");
    });
}
