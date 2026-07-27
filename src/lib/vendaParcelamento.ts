import { formatValorInput, parseValorInput } from "@/lib/format";

export type CampoVendaParcelamento = "valorTotal" | "valorParcela" | "quantidadeParcelas";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ParcelamentoFields = {
  valorTotal: string;
  valorParcela: string;
  quantidadeParcelas: string;
};

type ParcelamentoSetters = {
  setValorTotal: (v: string) => void;
  setValorParcela: (v: string) => void;
  setQuantidadeParcelas: (v: string) => void;
};

function lerParcelamento(fields: ParcelamentoFields) {
  const total = parseValorInput(fields.valorTotal, { allowZero: true });
  const parcela = parseValorInput(fields.valorParcela, { allowZero: true });
  const qtdRaw = fields.quantidadeParcelas.trim();
  const qtd = qtdRaw ? Number.parseInt(qtdRaw, 10) : NaN;
  return {
    total,
    parcela,
    qtd,
    temTotal: total != null && total > 0,
    temParcela: parcela != null && parcela > 0,
    temQtd: Number.isFinite(qtd) && qtd > 0,
  };
}

/** Sincroniza valor total, valor da parcela e quantidade conforme o campo editado. */
export function sincronizarVendaParcelamento(
  fields: ParcelamentoFields,
  setters: ParcelamentoSetters,
  origem: CampoVendaParcelamento,
): void {
  const { total, parcela, qtd, temTotal, temParcela, temQtd } = lerParcelamento(fields);

  if (origem === "valorParcela") {
    if (temParcela && temQtd) {
      setters.setValorTotal(formatValorInput(round2(parcela! * qtd!)));
      return;
    }
    if (temParcela && temTotal) {
      setters.setQuantidadeParcelas(String(Math.max(1, Math.round(total! / parcela!))));
    }
    return;
  }

  if (origem === "quantidadeParcelas") {
    if (temParcela && temQtd) {
      setters.setValorTotal(formatValorInput(round2(parcela! * qtd!)));
      return;
    }
    if (temQtd && temTotal) {
      setters.setValorParcela(formatValorInput(round2(total! / qtd!)));
    }
    return;
  }

  if (origem === "valorTotal") {
    if (temTotal && temParcela) {
      setters.setQuantidadeParcelas(String(Math.max(1, Math.round(total! / parcela!))));
      return;
    }
    if (temTotal && temQtd) {
      setters.setValorParcela(formatValorInput(round2(total! / qtd!)));
    }
  }
}
