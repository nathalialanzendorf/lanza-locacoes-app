import { apiRequest, apiDownload, apiUpload } from "./client";
import { lanzaApiExtra } from "./endpointsExtra";
import type { StatusContratoValor, CategoriaMovimentacaoValor } from "@/lib/domain";
import type {
  Cliente,
  ClienteDespesa,
  CobrancasMeta,
  Contrato,
  DataEnvelope,
  Health,
  Infracao,
  ListEnvelope,
  Locacao,
  Venda,
  Parceiro,
  ParceiroDespesa,
  PlanoBaixa,
  RenegociacaoInput,
  RenegociacaoPreview,
  RenegociacaoResumo,
  Resumo,
  SyncJob,
  SyncMeta,
  SyncAlteracaoLinha,
  Veiculo,
  VinculoParceiro,
} from "./types";

export const lanzaApi = {
  ...lanzaApiExtra,
  health: () => apiRequest<Health>("/health"),
  resumo: () => apiRequest<Resumo>("/api/resumo"),

  listarClientes: (params?: { ativo?: boolean; cpf?: string; nome?: string; q?: string }) =>
    apiRequest<ListEnvelope<Cliente>>("/api/clientes", { params }),
  obterCliente: (id: string) =>
    apiRequest<DataEnvelope<Cliente>>(`/api/clientes/${encodeURIComponent(id)}`),

  listarVeiculos: (params?: {
    ativo?: boolean;
    placa?: string;
    particular?: boolean;
    tipoFrota?: string;
    comFipe?: boolean;
  }) => apiRequest<ListEnvelope<Veiculo>>("/api/veiculos", { params }),
  criarVeiculo: (body: {
    placa: string;
    marcaModelo?: string;
    anoModelo?: string;
    chassi?: string;
    renavam?: string;
    cor?: string;
    ativo?: boolean;
    particular?: boolean;
    tipoFrota?: string;
    parceiroNome?: string;
    parceiroId?: string;
    ufRegistro?: string;
    origem?: string;
  }) => apiRequest<{ data: Veiculo; acao: string }>("/api/veiculos", { method: "POST", body }),
  atualizarVeiculo: (id: string, patch: Record<string, unknown>) =>
    apiRequest<DataEnvelope<Veiculo>>(`/api/veiculos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }),

  listarContratos: (params?: {
    status?: StatusContratoValor;
    clienteId?: string;
    veiculoId?: string;
    placa?: string;
    dataInicial?: string;
    dataFinal?: string;
  }) => apiRequest<ListEnvelope<Contrato>>("/api/contratos", { params }),
  criarContrato: (body: Record<string, unknown>) =>
    apiRequest<{ data: unknown }>("/api/contratos/criar", {
      method: "POST",
      body,
    }),
  renovarContrato: (body: Record<string, unknown>) =>
    apiRequest<{ data: unknown }>("/api/contratos/renovar", {
      method: "POST",
      body,
    }),
  encerrarContrato: (body: {
    idOuPasta: string;
    dataEncerramento: string;
    motivoEncerramento: string;
    quebraContrato?: boolean;
  }) => apiRequest<{ data: unknown }>("/api/contratos/encerrar", { method: "POST", body }),
  gerarDocumentoContrato: (id: string) =>
    apiRequest<{
      data: {
        contratoId: string;
        documentoDocxStorageKey?: string | null;
        documentoPdfStorageKey?: string | null;
        documentoGeradoEm?: string | null;
      };
    }>(`/api/contratos/${encodeURIComponent(id)}/gerar-documento`, {
      method: "POST",
      timeoutMs: 120_000,
    }),
  downloadDocumentoGeradoContrato: (
    id: string,
    formato: "docx" | "pdf",
    filename?: string,
  ) =>
    apiDownload(`/api/contratos/${encodeURIComponent(id)}/documento-gerado`, {
      params: { formato },
      filename,
      timeoutMs: 120_000,
    }),
  downloadContratoAssinado: (id: string, filename?: string) =>
    apiDownload(`/api/contratos/${encodeURIComponent(id)}/contrato-assinado`, {
      filename,
      timeoutMs: 120_000,
    }),
  uploadContratoAssinado: (id: string, file: File) =>
    apiUpload<{ data: { contrato: import("./types").ContratoDetalhe } }>(
      `/api/contratos/${encodeURIComponent(id)}/contrato-assinado`,
      file,
      {
        filename: file.name,
        contentType: file.type || "application/pdf",
      },
    ),
  consultarVeiculoDadosLocal: (params?: { placa?: string }) =>
    apiRequest<{ data: import("./types").VeiculoConsultaPortaisResultado }>(
      "/api/relatorios/veiculo/consulta",
      { params, timeoutMs: 60_000 },
    ),
  consultarVeiculoPortaisSync: (params?: {
    placa?: string;
    renavam?: string;
    fonte?: import("./types").VeiculoConsultaFonte;
    async?: boolean;
  }) =>
    apiRequest<{
      data?: import("./types").VeiculoConsultaPortaisResultado;
      jobId?: string;
      sync?: string;
      fonte?: import("./types").VeiculoConsultaFonte;
      jobs?: Array<{
        jobId: string;
        sync: string;
        fonte: import("./types").VeiculoConsultaFonte;
        status?: string;
      }>;
      status?: string;
    }>("/api/sync/veiculo/consulta", {
      params,
      timeoutMs: params?.async ? 30_000 : 300_000,
    }),
  statusDetranScSessao: () =>
    apiRequest<{ data: import("./types").DetranScSessaoStatus }>("/api/portais/detran-sc/sessao"),
  gravarDetranScSessao: (body: { auth: string; empresa: string; appVersion?: string | null }) =>
    apiRequest<{ data: import("./types").DetranScSessaoStatus & { ok?: boolean } }>(
      "/api/portais/detran-sc/sessao",
      { method: "PUT", body },
    ),
  removerDetranScSessao: () =>
    apiRequest<{ data: { ok: boolean; configured: boolean } }>("/api/portais/detran-sc/sessao", {
      method: "DELETE",
    }),
  statusCapturaDetranSc: () =>
    apiRequest<{ data: import("./types").DetranScCapturaState }>(
      "/api/portais/detran-sc/captura",
    ),
  iniciarCapturaDetranSc: () =>
    apiRequest<{ data: import("./types").DetranScCapturaState }>(
      "/api/portais/detran-sc/captura",
      { method: "POST" },
    ),
  pararCapturaDetranSc: () =>
    apiRequest<{ data: import("./types").DetranScCapturaState }>(
      "/api/portais/detran-sc/captura",
      { method: "DELETE" },
    ),
  statusSigapaySessao: () =>
    apiRequest<{ data: import("./types").SigapaySessaoStatus }>("/api/portais/sigapay/sessao"),
  gravarSigapaySessao: (body: { cookie?: string; token?: string; apiBase?: string | null }) =>
    apiRequest<{ data: import("./types").SigapaySessaoStatus & { ok?: boolean } }>(
      "/api/portais/sigapay/sessao",
      { method: "PUT", body },
    ),
  removerSigapaySessao: () =>
    apiRequest<{ data: { ok: boolean; configured: boolean } }>("/api/portais/sigapay/sessao", {
      method: "DELETE",
    }),
  statusCapturaSigapay: () =>
    apiRequest<{ data: import("./types").SigapayCapturaState }>("/api/portais/sigapay/captura"),
  iniciarCapturaSigapay: () =>
    apiRequest<{ data: import("./types").SigapayCapturaState }>("/api/portais/sigapay/captura", {
      method: "POST",
    }),
  pararCapturaSigapay: () =>
    apiRequest<{ data: import("./types").SigapayCapturaState }>("/api/portais/sigapay/captura", {
      method: "DELETE",
    }),
  statusPedagioSessao: () =>
    apiRequest<{ data: import("./types").PedagioSessaoStatus }>("/api/portais/pedagio/sessao"),
  gravarPedagioSessao: (body: { cookie: string; csrf: string }) =>
    apiRequest<{ data: import("./types").PedagioSessaoStatus & { ok?: boolean } }>(
      "/api/portais/pedagio/sessao",
      { method: "PUT", body },
    ),
  removerPedagioSessao: () =>
    apiRequest<{ data: { ok: boolean; configured: boolean } }>("/api/portais/pedagio/sessao", {
      method: "DELETE",
    }),
  statusCapturaPedagio: () =>
    apiRequest<{ data: import("./types").PortalCapturaState }>("/api/portais/pedagio/captura"),
  iniciarCapturaPedagio: () =>
    apiRequest<{ data: import("./types").PortalCapturaState }>("/api/portais/pedagio/captura", {
      method: "POST",
    }),
  statusDetranRsSessao: () =>
    apiRequest<{ data: import("./types").DetranRsSessaoStatus }>("/api/portais/detran-rs/sessao"),
  gravarDetranRsSessao: (body: { auth: string; userId: string }) =>
    apiRequest<{ data: import("./types").DetranRsSessaoStatus & { ok?: boolean } }>(
      "/api/portais/detran-rs/sessao",
      { method: "PUT", body },
    ),
  removerDetranRsSessao: () =>
    apiRequest<{ data: { ok: boolean; configured: boolean } }>("/api/portais/detran-rs/sessao", {
      method: "DELETE",
    }),
  statusCapturaDetranRs: () =>
    apiRequest<{ data: import("./types").PortalCapturaState }>("/api/portais/detran-rs/captura"),
  iniciarCapturaDetranRs: () =>
    apiRequest<{ data: import("./types").PortalCapturaState }>("/api/portais/detran-rs/captura", {
      method: "POST",
    }),
  downloadDocumento: (pathname: string, filename?: string) =>
    apiDownload("/api/documentos/download", { params: { pathname }, filename }),

  listarDespesasCliente: (params?: {
    emAberto?: boolean;
    statusCobranca?: "em_aberto" | "pago" | "baixado";
    ativo?: boolean;
    clienteId?: string;
    veiculoId?: string;
    placa?: string;
    categoria?: string;
    competencia?: string;
    semCliente?: boolean;
    dataInicial?: string;
    dataFinal?: string;
    moduloVenda?: boolean;
    vendaId?: string;
  }) => apiRequest<ListEnvelope<ClienteDespesa>>("/api/despesas", { params }),

  listarDespesasParceiro: (params?: {
    emAberto?: boolean;
    ativo?: boolean;
    parceiroId?: string;
    veiculoId?: string;
    placa?: string;
    categoria?: string;
    competencia?: string;
    dataInicial?: string;
    dataFinal?: string;
  }) => apiRequest<ListEnvelope<ParceiroDespesa>>("/api/parceiro-despesas", { params }),

  listarLocacoes: (params?: {
    abertas?: boolean;
    veiculoId?: string;
    placa?: string;
    situacao?: CategoriaMovimentacaoValor;
    clienteId?: string;
    dataInicial?: string;
    dataFinal?: string;
  }) => apiRequest<ListEnvelope<Locacao>>("/api/locacoes", { params }),
  salvarLocacao: (body: Record<string, unknown>) =>
    apiRequest<{ data: Locacao }>("/api/locacoes", { method: "POST", body }),
  removerLocacao: (id: string) =>
    apiRequest<{ data: Locacao }>(`/api/locacoes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  sugerirLocacoesPrestacao: (body: { competencia: string; placa?: string }) =>
    apiRequest<{ data: import("./types").PrestacaoSugestaoLocacoes }>("/api/locacoes/sugerir", {
      method: "POST",
      body,
    }),

  listarParceiros: (params?: { ativo?: boolean; nome?: string; q?: string }) =>
    apiRequest<ListEnvelope<Parceiro>>("/api/parceiros", { params }),
  obterParceiro: (id: string) =>
    apiRequest<DataEnvelope<Parceiro>>(`/api/parceiros/${encodeURIComponent(id)}`),
  listarVinculosParceiro: (params?: { veiculoId?: string; parceiroId?: string }) =>
    apiRequest<ListEnvelope<VinculoParceiro>>("/api/parceiros/vinculos", { params }),

  listarVendas: (params?: {
    veiculoId?: string;
    clienteId?: string;
    placa?: string;
    ativo?: boolean;
    dataInicial?: string;
    dataFinal?: string;
  }) => apiRequest<ListEnvelope<Venda>>("/api/vendas", { params }),
  criarVenda: (body: Record<string, unknown>) =>
    apiRequest<{ data: Venda }>("/api/vendas", { method: "POST", body }),
  atualizarVenda: (id: string, patch: Record<string, unknown>) =>
    apiRequest<{ data: Venda }>(`/api/vendas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }),
  removerVenda: (id: string) =>
    apiRequest<{ data: Venda }>(`/api/vendas/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  listarInfracoes: (params?: {
    placa?: string;
    veiculoId?: string;
    clienteId?: string;
    parceiroId?: string;
    dataInicial?: string;
    dataFinal?: string;
    emAberto?: boolean;
    semCliente?: boolean;
    ativo?: boolean;
  }) => apiRequest<ListEnvelope<Infracao>>("/api/infracoes", { params }),

  metaCobrancas: () => apiRequest<CobrancasMeta>("/api/relatorios/cobrancas/meta"),
  gerarCobrancas: (body: {
    tipos?: string[];
    armazenarServidor?: boolean;
    filtro?: {
      veiculoId?: string;
      clienteId?: string;
      dataInicial?: string;
      dataFinal?: string;
      situacao?: "pago" | "todos";
    };
  }) =>
    apiRequest<{ data: unknown }>("/api/relatorios/cobrancas", { method: "POST", body }),
  gerarPrestacaoContas: (body: Record<string, unknown>) =>
    apiRequest<{ data: unknown }>("/api/relatorios/prestacao-contas", { method: "POST", body }),
  gerarEncerramento: (body: {
    contratoId?: string;
    pastaContrato?: string;
    dataEncerramento: string;
    semanasPagas?: number;
    armazenarServidor?: boolean;
  }) =>
    apiRequest<{
      data: unknown;
      whatsapp?: string;
      texto?: string;
      avisos?: string[];
      arquivos?: unknown;
    }>("/api/relatorios/encerramento", { method: "POST", body }),

  montarPlanoRecebimento: (body: {
    clienteId: string;
    veiculoId?: string;
    placa?: string;
    despesaId: string;
    valor: number;
    dataBr: string;
  }) =>
    apiRequest<{ data: PlanoBaixa }>("/api/recebimentos/plano", {
      method: "POST",
      body,
      timeoutMs: 60_000,
    }),
  executarRecebimento: (body: {
    linhas: PlanoBaixa["linhas"];
    clienteId?: string;
    veiculoId?: string;
    despesaId?: string;
    placa?: string;
    syncRastreame?: boolean;
  }) =>
    apiRequest<{ data: unknown }>("/api/recebimentos/executar", {
      method: "POST",
      body,
      timeoutMs: 60_000,
    }),

  metaSync: () => apiRequest<SyncMeta>("/api/sync"),
  listarSyncJobs: (limit = 20) =>
    apiRequest<{ total: number; jobs: SyncJob[] }>("/api/sync/jobs", { params: { limit } }),
  obterSyncJob: (id: string) => apiRequest<SyncJob>(`/api/sync/jobs/${encodeURIComponent(id)}`),
  cancelarSyncJob: (id: string) =>
    apiRequest<{ ok: boolean; job: SyncJob }>(`/api/sync/jobs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  executarSync: (
    nome: string,
    body: Record<string, unknown> = {},
    opts?: { async?: boolean },
  ) =>
    apiRequest<{ jobId?: string; status?: string; sync?: string; data?: unknown }>(
      `/api/sync/${encodeURIComponent(nome)}`,
      { method: "POST", body: { ...body, async: opts?.async ?? body.async }, params: opts?.async ? { async: true } : undefined },
    ),
  executarSyncCompleto: (body: Record<string, unknown> = {}, opts?: { async?: boolean }) =>
    apiRequest<{ jobId?: string; status?: string; data?: unknown }>("/api/sync/completo", {
      method: "POST",
      body: { ...body, async: opts?.async ?? body.async },
      params: opts?.async ? { async: true } : undefined,
    }),
  uploadSeguroComprovantes: (body: {
    ano: string;
    mes: string;
    arquivos: Array<{ nome: string; conteudo: string }>;
    sincronizar?: boolean;
    dryRun?: boolean;
  }) =>
    apiRequest<{
      upload: {
        uploaded: Array<{ pathname: string; nome: string; size: number }>;
        erros: string[];
      };
      sync?: {
        modo: string;
        novos?: number;
        atualizados?: number;
        semAlteracao?: number;
        boletos?: number;
        pdfs?: number;
        semVeiculo?: string[];
        despesas?: Array<{ placa: string; acao: string; id?: string }>;
        alteracoes?: SyncAlteracaoLinha[];
        erros?: string[];
      };
    }>("/api/sync/seguro/upload", { method: "POST", body, timeoutMs: 120_000 }),

  resumoRenegociacao: (params: {
    clienteId?: string;
    veiculoId?: string;
    motoristaKey?: string;
    rastreavelKey?: string;
    apenasVencidos?: boolean;
  }) => apiRequest<RenegociacaoResumo>("/api/renegociacao/resumo", { params }),
  previewRenegociacao: (body: RenegociacaoInput) =>
    apiRequest<RenegociacaoPreview>("/api/renegociacao/preview", { method: "POST", body }),
  salvarRenegociacao: (body: RenegociacaoInput) =>
    apiRequest<{ preview: RenegociacaoPreview; resultado: unknown; salvo: boolean }>(
      "/api/renegociacao/executar",
      { method: "POST", body },
    ),
  /** @deprecated use salvarRenegociacao */
  executarRenegociacao: (body: RenegociacaoInput) =>
    apiRequest<{ preview: RenegociacaoPreview; resultado: unknown; salvo: boolean }>(
      "/api/renegociacao/executar",
      { method: "POST", body },
    ),
};
