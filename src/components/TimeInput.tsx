type TimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

/** Normaliza HH:MM (24h). */
export function normalizeHoraBr(value: string): string {
  const t = value.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export const HORA_INICIO_PADRAO = "18:00";

export function TimeInput({
  value,
  onChange,
  disabled,
  required,
  className,
  id,
  "aria-label": ariaLabel,
}: TimeInputProps) {
  const normalized = normalizeHoraBr(value) || value;

  return (
    <input
      id={id}
      type="time"
      className={["input", "input--time", className].filter(Boolean).join(" ")}
      value={normalized}
      aria-label={ariaLabel}
      onChange={(e) => onChange(normalizeHoraBr(e.target.value) || e.target.value)}
      disabled={disabled}
      required={required}
    />
  );
}
