export const CATEGORIAS_DESPESA_PARCEIRO = [
  "Seguro",
  "Rastreador",
  "Manutenção",
  "IPVA",
  "Licenciamento",
  "Outros",
] as const;

export const CATEGORIAS_IPVA_LICENCIAMENTO = ["IPVA", "Licenciamento"] as const;

export type CategoriaDespesaParceiro = (typeof CATEGORIAS_DESPESA_PARCEIRO)[number];
export type CategoriaIpvaLicenciamento = (typeof CATEGORIAS_IPVA_LICENCIAMENTO)[number];
