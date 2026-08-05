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
