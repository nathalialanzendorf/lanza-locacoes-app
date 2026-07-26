/** Cliente, veículo e parceiro: omitido ou true = ativo; só `false` = inativo. */
export function registroEstaAtivo(ativo?: boolean | null): boolean {
  return ativo !== false;
}

export const RotuloStatusRegistro = {
  Ativo: "Ativo",
  Inativo: "Inativo",
} as const;

export type RotuloStatusRegistroValor =
  (typeof RotuloStatusRegistro)[keyof typeof RotuloStatusRegistro];

export function rotuloStatusRegistro(ativo?: boolean | null): RotuloStatusRegistroValor {
  return registroEstaAtivo(ativo) ? RotuloStatusRegistro.Ativo : RotuloStatusRegistro.Inativo;
}

export function classeStatusRegistro(ativo?: boolean | null): string {
  return registroEstaAtivo(ativo) ? "badge badge--ok" : "badge badge--muted";
}

/** Filtro de listagem por cadastro ativo/inativo. */
export const StatusRegistroFiltro = {
  Ativo: "ativo",
  Inativo: "inativo",
  Todos: "todos",
} as const;

export type StatusRegistroFiltroValor =
  (typeof StatusRegistroFiltro)[keyof typeof StatusRegistroFiltro];

export const STATUS_REGISTRO_FILTRO_OPCOES = [
  { value: StatusRegistroFiltro.Ativo, label: RotuloStatusRegistro.Ativo },
  { value: StatusRegistroFiltro.Inativo, label: RotuloStatusRegistro.Inativo },
] as const;

export function filtroRegistroParaAtivo(
  filtro: StatusRegistroFiltroValor,
): boolean | undefined {
  if (filtro === StatusRegistroFiltro.Ativo) return true;
  if (filtro === StatusRegistroFiltro.Inativo) return false;
  return undefined;
}
