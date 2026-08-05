import type { SyncCatalogEntry, SyncDirecao } from "@/api/types";
import { CategoriaDespesaCliente } from "@/lib/domain";

/** Syncs Rastreame que só enviam (fallback se a API não enviar `direcao`). */
const ENVIAR_SYNC_IDS = new Set([
  "motoristas",
  "rastreaveis-enviar",
  "recebimentos",
  "manutencao",
]);

export const RASTREAME_SYNC_IDS = new Set([
  "motoristas",
  "rastreaveis",
  "rastreaveis-enviar",
  "recebimentos",
  "manutencao",
]);

const RASTREAME_SYNC_ORDEM = [
  "rastreaveis",
  "motoristas",
  "rastreaveis-enviar",
  "recebimentos",
  "manutencao",
] as const;

export function isSyncRastreame(id: string): boolean {
  return RASTREAME_SYNC_IDS.has(id);
}

export function direcaoEfetiva(sync: SyncCatalogEntry): SyncDirecao {
  if (sync.direcao === "enviar" || sync.direcao === "buscar") return sync.direcao;
  return ENVIAR_SYNC_IDS.has(sync.id) ? "enviar" : "buscar";
}

const BUSCAR_ORDEM = [
  "pedagios",
  "estacionamento",
  "infracoes",
  "ipva-licenciamento",
  "detran-rs",
  "fipe",
  "seguro",
] as const;

const ENVIAR_ORDEM = [] as const;

export function ordenarSyncsPorDirecao(
  syncs: SyncCatalogEntry[],
  direcao: "buscar" | "enviar",
): SyncCatalogEntry[] {
  const ordem = direcao === "buscar" ? BUSCAR_ORDEM : ENVIAR_ORDEM;
  const filtrados = syncs.filter((s) => direcaoEfetiva(s) === direcao);
  const map = new Map(filtrados.map((s) => [s.id, s]));
  const ordered: SyncCatalogEntry[] = [];
  for (const id of ordem) {
    const item = map.get(id);
    if (item) ordered.push(item);
  }
  for (const s of filtrados) {
    if (!ordered.some((o) => o.id === s.id)) ordered.push(s);
  }
  return ordered;
}

export function ordenarSyncsRastreame(syncs: SyncCatalogEntry[]): SyncCatalogEntry[] {
  const filtrados = syncs.filter((s) => isSyncRastreame(s.id) && syncAtivo(s));
  const map = new Map(filtrados.map((s) => [s.id, s]));
  const ordered: SyncCatalogEntry[] = [];
  for (const id of RASTREAME_SYNC_ORDEM) {
    const item = map.get(id);
    if (item) ordered.push(item);
  }
  for (const s of filtrados) {
    if (!ordered.some((o) => o.id === s.id)) ordered.push(s);
  }
  return ordered;
}

export function bodySyncGlobal(opts: { dryRun: boolean; placa: string }): Record<string, unknown> {
  return {
    dryRun: opts.dryRun,
    placa: opts.placa.trim() || undefined,
  };
}

export function opcoesSyncCompleto(
  syncs: SyncCatalogEntry[],
  opts: { dryRun: boolean; placa: string },
): Record<string, Record<string, unknown>> {
  const base = bodySyncGlobal(opts);
  const ativos = syncs.filter((s) => !s.depreciado);
  return Object.fromEntries(ativos.map((s) => [s.id, { ...base }]));
}

export function opcoesSyncRastreame(
  syncs: SyncCatalogEntry[],
  opts: { dryRun: boolean; placa: string },
): Record<string, Record<string, unknown>> {
  const base = bodySyncGlobal(opts);
  return Object.fromEntries(ordenarSyncsRastreame(syncs).map((s) => [s.id, { ...base }]));
}

export function syncAtivo(sync: SyncCatalogEntry): boolean {
  return !sync.depreciado;
}

const SYNC_TAB_LABELS: Record<string, string> = {
  pedagios: "Pedágio",
  estacionamento: "SigaPay",
  infracoes: "Infrações",
  "ipva-licenciamento": "IPVA/Licenciamento",
  "detran-rs": "DETRAN RS",
  fipe: "FIPE",
  seguro: "Seguro",
  motoristas: "Clientes",
  rastreaveis: "Rastreáveis",
  "rastreaveis-enviar": "Rastreáveis ↑",
  recebimentos: "Gastos",
  manutencao: "Manutenção",
};

export function rotuloAbaSync(entry: SyncCatalogEntry): string {
  return SYNC_TAB_LABELS[entry.id] ?? entry.rotulo;
}

export function syncPath(id: string): string {
  return `/sync/${id}`;
}

export function syncNavAtivo(pathname: string): boolean {
  return pathname === "/sync" || pathname.startsWith("/sync/");
}

export type SyncNavItem = {
  to: string;
  label: string;
  end?: boolean;
};

/** Abas da SyncPage (Registros, dados do veículo, integrações ativas, Rastreame e Legado). */
export function syncNavItems(syncs: SyncCatalogEntry[]): SyncNavItem[] {
  const { ativos, rastreame, legado } = abasSync(syncs);
  return [
    { to: "/sync/registros", label: "Registros", end: true },
    { to: "/sync/veiculo", label: "Dados do veículo", end: true },
    ...ativos.map((s) => ({
      to: syncPath(s.id),
      label: rotuloAbaSync(s),
      end: true as const,
    })),
    ...(rastreame.length > 0
      ? [{ to: "/sync/rastreame", label: "Rastreame", end: true as const }]
      : []),
    ...(legado.length > 0 ? [{ to: "/sync/legado", label: "Legado", end: true as const }] : []),
  ];
}

export type SyncRegistroTipo =
  | typeof CategoriaDespesaCliente.Infracao
  | typeof CategoriaDespesaCliente.Pedagio
  | typeof CategoriaDespesaCliente.Estacionamento;

export function tiposRegistrosSync(syncId: string): SyncRegistroTipo[] | null {
  switch (syncId) {
    case "pedagios":
      return [CategoriaDespesaCliente.Pedagio];
    case "estacionamento":
      return [CategoriaDespesaCliente.Estacionamento];
    case "infracoes":
      return [CategoriaDespesaCliente.Infracao];
    default:
      return null;
  }
}

export function syncTemRegistros(syncId: string): boolean {
  return tiposRegistrosSync(syncId) !== null;
}

export function abasSync(syncs: SyncCatalogEntry[]): {
  ativos: SyncCatalogEntry[];
  rastreame: SyncCatalogEntry[];
  legado: SyncCatalogEntry[];
} {
  const rastreame = ordenarSyncsRastreame(syncs);
  const rastreameIds = new Set(rastreame.map((s) => s.id));
  const outrosAtivos = syncs.filter((s) => syncAtivo(s) && !rastreameIds.has(s.id));
  const ativos = [
    ...ordenarSyncsPorDirecao(outrosAtivos, "buscar"),
    ...ordenarSyncsPorDirecao(outrosAtivos, "enviar"),
  ];
  const legado = syncs.filter((s) => !syncAtivo(s));
  return { ativos, rastreame, legado };
}
