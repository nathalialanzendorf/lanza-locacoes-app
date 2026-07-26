/** Categorias de despesa do cliente (valor gravado em `categoria`). */
export const CategoriaDespesaCliente = {
  Manutencao: "Manutenção",
  LocacaoSemanal: "Locação semanal",
  Diaria: "Diária",
  Caucao: "Caução",
  Outros: "Outros",
  Pedagio: "Pedágio",
  Infracao: "Infração",
  Estacionamento: "Estacionamento",
  QuebraContrato: "Quebra contrato",
  Renegociacao: "Renegociação",
  Lavacao: "Lavação",
} as const;

export type CategoriaDespesaClienteValor =
  (typeof CategoriaDespesaCliente)[keyof typeof CategoriaDespesaCliente];

/** Opções do cadastro e filtros principais de despesas cliente. */
export const CATEGORIAS_DESPESA_CLIENTE_CADASTRO = [
  CategoriaDespesaCliente.Manutencao,
  CategoriaDespesaCliente.LocacaoSemanal,
  CategoriaDespesaCliente.Caucao,
  CategoriaDespesaCliente.Outros,
  CategoriaDespesaCliente.Pedagio,
  CategoriaDespesaCliente.Infracao,
  CategoriaDespesaCliente.Estacionamento,
] as const;

export type CategoriaDespesaClienteCadastro =
  (typeof CATEGORIAS_DESPESA_CLIENTE_CADASTRO)[number];

/** Alias legado — normalizar para {@link CategoriaDespesaCliente.Pedagio}. */
export const CATEGORIA_PEDAGIO_ALIAS = "Pedágio Digital";

/** Alias legado — normalizar para {@link CategoriaDespesaCliente.Estacionamento}. */
export const CATEGORIAS_ESTACIONAMENTO_ALIAS = [
  "Estacionamento rotativo SigaPay",
  "SigaPay",
] as const;
