/** Nome de download Word/PDF: `Contrato - Nome Cliente.ext`. */
export function nomeArquivoContrato(clienteNome: string, ext: "docx" | "pdf"): string {
  const nome = String(clienteNome ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const base = (nome || "Cliente").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return `Contrato - ${base}.${ext}`;
}

/** Rótulo da versão do documento gerado (ex.: Versão 3 · 30/08/2026, 15:00). */
export function formatVersaoDocumentoContrato(
  versao: number | null | undefined,
  geradoEm: string | null | undefined,
): string {
  const temVersao = versao != null && versao > 0;
  const temData = Boolean(geradoEm?.trim());
  if (!temVersao && !temData) return "Nenhuma versão gerada";
  const num = temVersao ? versao! : 1;
  if (!temData) return `Versão ${num}`;
  return `Versão ${num} · ${new Date(geradoEm!).toLocaleString("pt-BR")}`;
}
