/** Status gravado em `contratos.status`. */
export const StatusContrato = {
  Ativo: "ativo",
  Encerrado: "encerrado",
} as const;

export type StatusContratoValor = (typeof StatusContrato)[keyof typeof StatusContrato];

/** Como o veículo saiu da locação (contrato encerrado). */
export const MotivoEncerramento = {
  Devolvido: "devolvido",
  Recuperado: "recuperado",
  Troca: "troca",
} as const;

export type MotivoEncerramentoValor = (typeof MotivoEncerramento)[keyof typeof MotivoEncerramento];

export const STATUS_CONTRATO_OPCOES = [
  { value: StatusContrato.Ativo, label: "Ativo" },
  { value: StatusContrato.Encerrado, label: "Encerrado" },
] as const;

export const MOTIVO_ENCERRAMENTO_OPCOES = [
  { value: MotivoEncerramento.Devolvido, label: "Devolvido" },
  { value: MotivoEncerramento.Recuperado, label: "Recuperado" },
  { value: MotivoEncerramento.Troca, label: "Troca de veículo" },
] as const;

export function isStatusContratoValor(raw: string | null | undefined): raw is StatusContratoValor {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === StatusContrato.Ativo || v === StatusContrato.Encerrado;
}

export function parseStatusContrato(raw: string | null | undefined): StatusContratoValor {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === StatusContrato.Encerrado) return StatusContrato.Encerrado;
  return StatusContrato.Ativo;
}

export function isMotivoEncerramentoValor(raw: string | null | undefined): raw is MotivoEncerramentoValor {
  const v = String(raw ?? "").trim().toLowerCase();
  return (
    v === MotivoEncerramento.Devolvido ||
    v === MotivoEncerramento.Recuperado ||
    v === MotivoEncerramento.Troca
  );
}

/** Contrato em locação ativa (status ativo e sem data de encerramento). */
export function contratoOperacionalAtivo(c: {
  status?: string | null;
  dataEncerramento?: string | null;
}): boolean {
  if (parseStatusContrato(c.status) !== StatusContrato.Ativo) return false;
  return !String(c.dataEncerramento ?? "").trim();
}
