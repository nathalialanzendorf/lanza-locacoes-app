import { useRef, useState } from "react";

import { ResultPanel } from "@/components/ResultPanel";
import { Toggle } from "@/components/Toggle";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { FlashError } from "@/context/ScreenFlashContext";
import { LABEL } from "@/lib/labels";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const b64 = raw.includes(",") ? raw.split(",")[1]! : raw;
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

type UploadResultado = {
  upload?: { uploaded?: unknown[]; erros?: string[] };
  sync?: {
    novos?: number;
    atualizados?: number;
    semAlteracao?: number;
    boletos?: number;
    despesas?: Array<{ placa: string; acao: string }>;
    erros?: string[];
  };
};

function resumoSync(sync: UploadResultado["sync"]): string | null {
  if (!sync) return null;
  const partes: string[] = [];
  if (sync.novos) partes.push(`${sync.novos} despesa(s) nova(s)`);
  if (sync.atualizados) partes.push(`${sync.atualizados} atualizada(s)`);
  if (sync.semAlteracao) partes.push(`${sync.semAlteracao} sem alteração`);
  if (!partes.length && sync.boletos) return `${sync.boletos} boleto(s) processado(s)`;
  return partes.length ? partes.join(", ") : null;
}

type Props = {
  dryRun: boolean;
  onSynced?: () => void;
};

export function SeguroUploadPanel({ dryRun, onSynced }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [sincronizar, setSincronizar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<UploadResultado | null>(null);
  const [selecionados, setSelecionados] = useState<File[]>([]);

  function onFilesChange(files: FileList | null) {
    if (!files?.length) {
      setSelecionados([]);
      return;
    }
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setSelecionados(pdfs);
  }

  async function enviar() {
    if (!selecionados.length) {
      setError("Selecione pelo menos um PDF.");
      return;
    }
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const arquivos = await Promise.all(
        selecionados.map(async (f) => ({
          nome: f.name,
          conteudo: await fileToBase64(f),
        })),
      );
      const data = await lanzaApi.uploadSeguroComprovantes({
        ano,
        mes,
        arquivos,
        sincronizar,
        dryRun,
      });
      setResultado(data);
      setSelecionados([]);
      if (inputRef.current) inputRef.current.value = "";
      if (sincronizar && !dryRun) onSynced?.();
    } catch (err) {
      setError(err instanceof LanzaApiError ? err.message : "Falha ao enviar PDFs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-card">
      <h2 className="form-card__title">Enviar comprovantes de seguro</h2>
      <p className="field__hint">
        Os PDFs são armazenados na Vercel Blob. Com &quot;Sincronizar após upload&quot; ativo, as
        despesas parceiro são gravadas automaticamente.
      </p>

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Ano</span>
          <input
            className="field__input"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={ano}
            onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <label className="field">
          <span className="field__label">Mês</span>
          <input
            className="field__input"
            type="text"
            inputMode="numeric"
            placeholder="08"
            maxLength={2}
            value={mes}
            onChange={(e) => setMes(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">PDFs</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(e) => onFilesChange(e.target.files)}
        />
        {selecionados.length ? (
          <p className="field__hint">
            {selecionados.length} arquivo(s): {selecionados.map((f) => f.name).join(", ")}
          </p>
        ) : null}
      </label>

      <Toggle
        className="field"
        checked={sincronizar}
        onChange={setSincronizar}
        label="Sincronizar após upload (gravar despesas parceiro)"
      />

      <div className="despesas-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading || !selecionados.length}
          onClick={() => void enviar()}
        >
          {loading ? LABEL.processando : "Enviar PDFs"}
        </button>
      </div>

      <FlashError message={error} />
      {resultado?.sync && resumoSync(resultado.sync) ? (
        <p className="field__hint sync-dryrun-hint">
          Despesas parceiro: {resumoSync(resultado.sync)}
          {dryRun ? " (dry-run — nada gravado)" : ""}
        </p>
      ) : null}
      {resultado ? <ResultPanel title="Resultado do upload" data={resultado} /> : null}
    </section>
  );
}
