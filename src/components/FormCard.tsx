import type { FormEvent, ReactNode } from "react";

import { useFlashFormMessages } from "@/context/ScreenFlashContext";
import { LABEL } from "@/lib/labels";

type Props = {
  title?: string;
  className?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  /** Botões extras ao lado do Salvar (ex.: confirmar/desvincular). */
  actions?: ReactNode;
  error?: string | null;
  success?: string | null;
};

export function FormCard({
  title,
  className,
  children,
  onSubmit,
  loading,
  submitDisabled,
  submitLabel = LABEL.salvar,
  actions,
  error,
  success,
}: Props) {
  useFlashFormMessages(error, success);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit();
  }

  return (
    <form className={["form-card", className].filter(Boolean).join(" ")} onSubmit={handleSubmit}>
      {title ? <h2 className="form-card__title">{title}</h2> : null}
      <div className="form-grid">{children}</div>
      <div className="form-card__action-row">
        <button type="submit" className="btn btn--primary" disabled={loading || submitDisabled}>
          {loading ? LABEL.processando : submitLabel}
        </button>
        {actions}
      </div>
    </form>
  );
}

export function Field({
  label,
  children,
  hint,
  span,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  span?: "full" | "wide";
}) {
  const spanClass = span === "full" ? "field--full" : span === "wide" ? "field--wide" : undefined;
  return (
    <label className={["field", spanClass].filter(Boolean).join(" ")}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <h3 className="form-section-title">{title}</h3>
      {hint ? <p className="form-section__lead">{hint}</p> : null}
      {children}
    </section>
  );
}
