import { formatValorInput, parseValorInput, sanitizeValorDigitado } from "@/lib/format";

type ValorInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Permite 0,00 (ex.: entrada na retirada). */
  allowZero?: boolean;
  "aria-label"?: string;
};

/**
 * Campo monetário pt-BR (texto): aceita 120,00 · 0,00 · 1.200,50.
 * Não usa type="number" — o navegador bloqueia a vírgula nesse modo.
 */
export function ValorInput({
  value,
  onChange,
  disabled,
  required,
  placeholder = "0,00",
  allowZero,
  "aria-label": ariaLabel,
}: ValorInputProps) {
  return (
    <input
      className="input"
      type="text"
      inputMode="decimal"
      lang="pt-BR"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(sanitizeValorDigitado(e.target.value))}
      onBlur={() => {
        const n = parseValorInput(value, { allowZero });
        if (n != null) onChange(formatValorInput(n));
      }}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
