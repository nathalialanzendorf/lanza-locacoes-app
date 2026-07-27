import type { Contrato, Veiculo } from "@/api/types";

import { contratoOperacionalAtivo } from "@/lib/domain/statusContrato";

export {
  CategoriaMovimentacao,
  CATEGORIA_MOVIMENTACAO_OPCOES,
  RotuloCategoriaMovimentacao,
  isCategoriaMovimentacaoValor,
  rotuloCategoriaMovimentacao,
  SituacaoLocacao,
  SITUACAO_LOCACAO_OPCOES,
  isSituacaoLocacaoValor,
  type CategoriaMovimentacaoValor,
  type SituacaoLocacaoValor,
} from "@/lib/domain/categoriaMovimentacao";

/** Status operacional derivado de `ativo` + contrato ativo na placa. */export const SituacaoVeiculoOperacional = {
  Locado: "locado",
  NaoLocado: "nao_locado",
  Inativo: "inativo",
} as const;

export type SituacaoVeiculoOperacionalValor =
  (typeof SituacaoVeiculoOperacional)[keyof typeof SituacaoVeiculoOperacional];

export const RotuloSituacaoVeiculo = {
  Locado: "Locado",
  NaoLocado: "Não locado",
  Inativo: "Inativo",
  Indisponivel: "—",
} as const;

export const FiltroSituacaoVeiculo = {
  Operacionais: "operacionais",
  Locado: "locado",
  NaoLocado: "nao_locado",
  Inativo: "inativo",
  Todos: "todos",
} as const;

export type FiltroSituacaoVeiculoValor =
  (typeof FiltroSituacaoVeiculo)[keyof typeof FiltroSituacaoVeiculo];

function compactPlaca(placa: string): string {
  return String(placa ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Placas com contrato operacional ativo. */
export function placasComContratoAtivo(
  contratos: Array<Pick<Contrato, "placa" | "veiculoId" | "status" | "dataEncerramento">>,
): Set<string> {
  const set = new Set<string>();
  for (const c of contratos) {
    if (!contratoOperacionalAtivo(c)) continue;
    const placa = compactPlaca(c.placa ?? "");
    if (placa) set.add(placa);
    const veiculoId = String(c.veiculoId ?? "").trim();
    if (veiculoId) set.add(veiculoId);
  }
  return set;
}

function veiculoReferenciaLocacao(v: Pick<Veiculo, "placa"> & { id?: string }): string[] {
  const refs: string[] = [];
  const placa = compactPlaca(v.placa ?? "");
  if (placa) refs.push(placa);
  const id = String(v.id ?? "").trim();
  if (id) refs.push(id);
  return refs;
}

export function situacaoVeiculoOperacional(
  v: Pick<Veiculo, "ativo" | "placa"> & { id?: string },
  placasContratoAtivo: ReadonlySet<string> = new Set(),
): SituacaoVeiculoOperacionalValor {
  if (v.ativo === false) return SituacaoVeiculoOperacional.Inativo;
  if (veiculoReferenciaLocacao(v).some((ref) => placasContratoAtivo.has(ref))) {
    return SituacaoVeiculoOperacional.Locado;
  }
  return SituacaoVeiculoOperacional.NaoLocado;
}

/** Locado / não locado; `null` quando o veículo está inativo na frota. */
export function situacaoLocacaoVeiculo(
  v: Pick<Veiculo, "ativo" | "placa"> & { id?: string },
  placasContratoAtivo: ReadonlySet<string> = new Set(),
): boolean | null {
  if (v.ativo === false) return null;
  return veiculoReferenciaLocacao(v).some((ref) => placasContratoAtivo.has(ref));
}

export function rotuloSituacaoLocacaoVeiculo(situacao: boolean | null): string {
  if (situacao === null) return RotuloSituacaoVeiculo.Indisponivel;
  return situacao ? RotuloSituacaoVeiculo.Locado : RotuloSituacaoVeiculo.NaoLocado;
}

export function classeSituacaoLocacaoVeiculo(situacao: boolean | null): string {
  if (situacao === null) return "badge badge--muted";
  return situacao ? "badge badge--ok" : "badge";
}

export function rotuloSituacaoVeiculoOperacional(
  status: SituacaoVeiculoOperacionalValor,
): string {
  switch (status) {
    case SituacaoVeiculoOperacional.Locado:
      return RotuloSituacaoVeiculo.Locado;
    case SituacaoVeiculoOperacional.NaoLocado:
      return RotuloSituacaoVeiculo.NaoLocado;
    case SituacaoVeiculoOperacional.Inativo:
      return RotuloSituacaoVeiculo.Inativo;
  }
}

export function classeSituacaoVeiculoOperacional(
  status: SituacaoVeiculoOperacionalValor,
): string {
  switch (status) {
    case SituacaoVeiculoOperacional.Locado:
      return "badge badge--ok";
    case SituacaoVeiculoOperacional.NaoLocado:
      return "badge";
    case SituacaoVeiculoOperacional.Inativo:
      return "badge badge--amber";
  }
}

export function veiculoPassaFiltroSituacao(
  v: Pick<Veiculo, "ativo" | "placa">,
  filtro: FiltroSituacaoVeiculoValor,
  placasContratoAtivo: ReadonlySet<string> = new Set(),
): boolean {
  const status = situacaoVeiculoOperacional(v, placasContratoAtivo);
  switch (filtro) {
    case FiltroSituacaoVeiculo.Operacionais:
      return status !== SituacaoVeiculoOperacional.Inativo;
    case FiltroSituacaoVeiculo.Locado:
      return status === SituacaoVeiculoOperacional.Locado;
    case FiltroSituacaoVeiculo.NaoLocado:
      return status === SituacaoVeiculoOperacional.NaoLocado;
    case FiltroSituacaoVeiculo.Inativo:
      return status === SituacaoVeiculoOperacional.Inativo;
    case FiltroSituacaoVeiculo.Todos:
      return true;
  }
}

/** @deprecated Use {@link situacaoVeiculoOperacional}. */
export const statusVeiculoOperacional = situacaoVeiculoOperacional;

/** @deprecated Use {@link rotuloSituacaoLocacaoVeiculo}. */
export const situacaoVeiculoLabel = rotuloSituacaoLocacaoVeiculo;

/** @deprecated Use {@link classeSituacaoLocacaoVeiculo}. */
export const situacaoVeiculoClass = classeSituacaoLocacaoVeiculo;

/** @deprecated Use {@link rotuloSituacaoVeiculoOperacional}. */
export const statusVeiculoLabel = rotuloSituacaoVeiculoOperacional;

/** @deprecated Use {@link classeSituacaoVeiculoOperacional}. */
export const statusVeiculoClass = classeSituacaoVeiculoOperacional;

/** @deprecated Use {@link veiculoPassaFiltroSituacao}. */
export const veiculoPassaFiltroStatus = veiculoPassaFiltroSituacao;

/** @deprecated Use {@link SituacaoVeiculoOperacionalValor}. */
export type StatusVeiculoOperacional = SituacaoVeiculoOperacionalValor;

/** @deprecated Use {@link FiltroSituacaoVeiculoValor}. */
export type FiltroStatusVeiculo = FiltroSituacaoVeiculoValor;
