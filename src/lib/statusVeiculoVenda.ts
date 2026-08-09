export const StatusVeiculoVenda = {
  Vendido: "vendido",
  NaoVendido: "nao_vendido",
} as const;

export type StatusVeiculoVendaValor =
  (typeof StatusVeiculoVenda)[keyof typeof StatusVeiculoVenda];

export const STATUS_VEICULO_VENDA_OPCOES: { value: StatusVeiculoVendaValor; label: string }[] = [
  { value: StatusVeiculoVenda.Vendido, label: "Vendido" },
  { value: StatusVeiculoVenda.NaoVendido, label: "Não vendido" },
];

export function statusVeiculoVendaDeAtivo(
  ativo: boolean | undefined | null,
): StatusVeiculoVendaValor {
  return ativo === false ? StatusVeiculoVenda.Vendido : StatusVeiculoVenda.NaoVendido;
}

export function veiculoVendidoDeStatus(status: StatusVeiculoVendaValor): boolean {
  return status === StatusVeiculoVenda.Vendido;
}

export function rotuloStatusVeiculoVenda(ativo: boolean | undefined | null): string {
  return statusVeiculoVendaDeAtivo(ativo) === StatusVeiculoVenda.Vendido
    ? "Vendido"
    : "Não vendido";
}

export function classeStatusVeiculoVenda(ativo: boolean | undefined | null): string {
  return statusVeiculoVendaDeAtivo(ativo) === StatusVeiculoVenda.Vendido
    ? "badge badge--muted"
    : "badge badge--ok";
}
