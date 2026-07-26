/** Tipo de locação quando categoria = locado (`locacoes.tipoLocacao`). */
export const TipoLocacao = {
  Diaria: "diaria",
  Semanal: "semanal",
  Mensal: "mensal",
} as const;

export type TipoLocacaoValor = (typeof TipoLocacao)[keyof typeof TipoLocacao];

const TIPOS_LOCACAO_VALIDOS = new Set<string>(Object.values(TipoLocacao));

export function isTipoLocacaoValor(raw: string | null | undefined): raw is TipoLocacaoValor {
  return TIPOS_LOCACAO_VALIDOS.has(String(raw ?? "").trim());
}

export const RotuloTipoLocacao = {
  Diaria: "Diária",
  Semanal: "Semanal",
  Mensal: "Mensal",
} as const;

export const TIPO_LOCACAO_OPCOES = [
  { value: TipoLocacao.Diaria, label: RotuloTipoLocacao.Diaria },
  { value: TipoLocacao.Semanal, label: RotuloTipoLocacao.Semanal },
  { value: TipoLocacao.Mensal, label: RotuloTipoLocacao.Mensal },
] as const;

export function rotuloTipoLocacao(valor: TipoLocacaoValor): string {
  switch (valor) {
    case TipoLocacao.Diaria:
      return RotuloTipoLocacao.Diaria;
    case TipoLocacao.Semanal:
      return RotuloTipoLocacao.Semanal;
    case TipoLocacao.Mensal:
      return RotuloTipoLocacao.Mensal;
  }
}

/** Mesmos valores em `contratos.tipoContrato`. */
export const TipoContrato = TipoLocacao;

export type TipoContratoValor = TipoLocacaoValor;

export const TIPO_CONTRATO_OPCOES = TIPO_LOCACAO_OPCOES;

export const isTipoContratoValor = isTipoLocacaoValor;

export function parseTipoContrato(raw: string | null | undefined): TipoContratoValor {
  const v = String(raw ?? "").trim().toLowerCase();
  if (isTipoContratoValor(v)) return v;
  return TipoContrato.Semanal;
}
