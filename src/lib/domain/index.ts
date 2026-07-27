export {
  CategoriaDespesaCliente,
  CATEGORIAS_DESPESA_CLIENTE_CADASTRO,
  CATEGORIA_PEDAGIO_ALIAS,
  CATEGORIAS_ESTACIONAMENTO_ALIAS,
  type CategoriaDespesaClienteValor,
  type CategoriaDespesaClienteCadastro,
} from "@/lib/domain/categoriaDespesaCliente";

export {
  DiaSemanaJs,
  DIAS_SEMANA,
  DIAS_PAGAMENTO_SEMANAL,
  DIAS_PAGAMENTO_SEMANAL_ORDEM,
  DIA_PAGAMENTO_POR_CHAVE,
  diaSemanaPorJsDay,
  labelCurtoDiaSemana,
  type DiaSemanaJsValor,
  type DiaSemanaDef,
} from "@/lib/domain/diasSemana";

export { SituacaoDespesa, type SituacaoDespesaValor } from "@/lib/domain/situacaoDespesa";

export {
  StatusDespesaFiltro,
  STATUS_DESPESA_CADASTRO_OPCOES,
  STATUS_DESPESA_FILTRO_OPCOES,
  statusCadastroDeDespesa,
  camposStatusDespesaDeCadastro,
  filtroPagamentoParaEmAberto,
  type StatusDespesaFiltroValor,
  type StatusDespesaCadastro,
} from "@/lib/domain/statusDespesa";

export {
  StatusContrato,
  MotivoEncerramento,
  STATUS_CONTRATO_OPCOES,
  MOTIVO_ENCERRAMENTO_OPCOES,
  contratoOperacionalAtivo,
  isStatusContratoValor,
  isMotivoEncerramentoValor,
  parseStatusContrato,
  type StatusContratoValor,
  type MotivoEncerramentoValor,
} from "@/lib/domain/statusContrato";

export {
  registroEstaAtivo,
  RotuloStatusRegistro,
  rotuloStatusRegistro,
  classeStatusRegistro,
  StatusRegistroFiltro,
  STATUS_REGISTRO_FILTRO_OPCOES,
  filtroRegistroParaAtivo,
  type RotuloStatusRegistroValor,
  type StatusRegistroFiltroValor,
} from "@/lib/domain/statusRegistro";

export {
  CategoriaMovimentacao,
  CATEGORIA_MOVIMENTACAO_OPCOES,
  RotuloCategoriaMovimentacao,
  isCategoriaMovimentacaoValor,
  rotuloCategoriaMovimentacao,
  type CategoriaMovimentacaoValor,
} from "@/lib/domain/categoriaMovimentacao";

export {
  TipoLocacao,
  TIPO_LOCACAO_OPCOES,
  RotuloTipoLocacao,
  isTipoLocacaoValor,
  rotuloTipoLocacao,
  TipoContrato,
  TIPO_CONTRATO_OPCOES,
  isTipoContratoValor,
  parseTipoContrato,
  type TipoLocacaoValor,
  type TipoContratoValor,
} from "@/lib/domain/tipoLocacao";

export {
  TipoCobrancaAction,
  TIPOS_COBRANCA_ACTION_PADRAO,
  RotuloTipoCobrancaAction,
  rotuloTipoCobrancaAction,
  type TipoCobrancaActionValor,
} from "@/lib/domain/tipoCobranca";

export {
  TipoVeiculoFrota,
  RotuloTipoVeiculoFrota,
  isTipoVeiculoFrotaValor,
  parseTipoVeiculoFrota,
  tipoFrotaDeVeiculo,
  rotuloTipoVeiculoFrota,
  veiculosBasePath,
  abaVeiculoPath,
  type TipoVeiculoFrotaValor,
} from "@/lib/domain/tipoVeiculoFrota";

export {
  SituacaoLocacao,
  SITUACAO_LOCACAO_OPCOES,
  isSituacaoLocacaoValor,
  type SituacaoLocacaoValor,
  SituacaoVeiculoOperacional,
  RotuloSituacaoVeiculo,
  FiltroSituacaoVeiculo,
  placasComContratoAtivo,
  situacaoVeiculoOperacional,
  situacaoLocacaoVeiculo,
  rotuloSituacaoLocacaoVeiculo,
  classeSituacaoLocacaoVeiculo,
  rotuloSituacaoVeiculoOperacional,
  classeSituacaoVeiculoOperacional,
  veiculoPassaFiltroSituacao,
  type SituacaoVeiculoOperacionalValor,
  type FiltroSituacaoVeiculoValor,
} from "@/lib/domain/situacaoVeiculo";
