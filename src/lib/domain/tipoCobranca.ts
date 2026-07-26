/** Identificador de lote/ação na API e relatórios de cobrança. */
export const TipoCobrancaAction = {
  PagamentoSemanal: "pagamento-semanal",
  Renegociacao: "renegociacao",
  Infracoes: "infracoes",
  Pedagio: "pedagio",
  EstacionamentoRotativo: "estacionamento-rotativo",
  Manutencao: "manutencao",
} as const;

export type TipoCobrancaActionValor =
  (typeof TipoCobrancaAction)[keyof typeof TipoCobrancaAction];

export const TIPOS_COBRANCA_ACTION_PADRAO = Object.values(TipoCobrancaAction);

export const RotuloTipoCobrancaAction = {
  [TipoCobrancaAction.PagamentoSemanal]: "Pagamento semanal",
  [TipoCobrancaAction.Renegociacao]: "Renegociação",
  [TipoCobrancaAction.Infracoes]: "Infrações",
  [TipoCobrancaAction.Pedagio]: "Pedágio Digital",
  [TipoCobrancaAction.EstacionamentoRotativo]: "Estacionamento rotativo",
  [TipoCobrancaAction.Manutencao]: "Manutenção",
} as const satisfies Record<TipoCobrancaActionValor, string>;

export function rotuloTipoCobrancaAction(tipo: TipoCobrancaActionValor): string {
  return RotuloTipoCobrancaAction[tipo];
}
