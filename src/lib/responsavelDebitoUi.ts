import {
  clienteConfirmadoDe,
  clienteIdDe,
  clienteNaoIdentificadoDe,
} from "@/lib/clienteCampo";

type Item = {
  debitoParceiroConfirmado?: boolean;
  revisarManual?: boolean;
  clienteConfirmado?: boolean;
  condutorConfirmado?: boolean;
  clienteId?: string | null;
  condutorId?: string | null;
  clienteNaoIdentificado?: boolean;
  condutorNaoIdentificado?: boolean;
};

export type ResponsavelStatus =
  | "confirmado-cliente"
  | "confirmado-parceiro"
  | "sugerido-cliente"
  | "sugerido-parceiro"
  | "revisar"
  | "sem-sugestao";

export function statusResponsavel(item: Item): ResponsavelStatus {
  if (item.debitoParceiroConfirmado) return "confirmado-parceiro";
  if (clienteConfirmadoDe(item) && clienteIdDe(item)) return "confirmado-cliente";
  if (clienteConfirmadoDe(item) && clienteNaoIdentificadoDe(item)) return "confirmado-parceiro";
  if (item.revisarManual) return "revisar";
  if (clienteIdDe(item)) return "sugerido-cliente";
  if (clienteNaoIdentificadoDe(item)) return "sugerido-parceiro";
  return "sem-sugestao";
}

export function labelStatusResponsavel(status: ResponsavelStatus): {
  text: string;
  className: string;
} {
  switch (status) {
    case "confirmado-cliente":
      return { text: "Cliente confirmado", className: "badge badge--ok" };
    case "confirmado-parceiro":
      return { text: "Parceiro confirmado", className: "badge badge--ok" };
    case "sugerido-cliente":
      return { text: "Cliente sugerido", className: "badge badge--warn" };
    case "sugerido-parceiro":
      return { text: "Parceiro sugerido", className: "badge badge--warn" };
    case "revisar":
      return { text: "Revisar manual", className: "badge badge--danger" };
    default:
      return { text: "Sem sugestão", className: "badge badge--muted" };
  }
}

export function precisaConfirmacao(item: Item): boolean {
  const s = statusResponsavel(item);
  return s === "sugerido-cliente" || s === "sugerido-parceiro" || s === "revisar" || s === "sem-sugestao";
}
