import { useEffect, useId, useRef, useState } from "react";
import { IconCalendar } from "@/components/icons";
import { brToIsoDate, dateValueToDisplay, isoDateToBr, maskDateBrInput } from "@/lib/dateBr";

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Formato exposto ao formulário — a API Lanza usa DD/MM/AAAA (`br`). */
  format?: "br" | "iso";
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

function toIsoBound(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return brToIsoDate(value) || undefined;
}

function emitStoredValue(masked: string, format: "br" | "iso", onChange: (value: string) => void) {
  if (format === "iso") {
    const iso = brToIsoDate(masked);
    if (iso) onChange(iso);
    return;
  }
  onChange(masked);
}

export function DateInput({
  value,
  onChange,
  format = "br",
  disabled,
  required,
  className,
  id,
  placeholder = "dd/mm/aaaa",
  min,
  max,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const nativeRef = useRef<HTMLInputElement>(null);
  const displayFromProps = dateValueToDisplay(value, format);
  const [text, setText] = useState(displayFromProps);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const minIso = toIsoBound(min);
  const maxIso = toIsoBound(max);
  const isoValue = brToIsoDate(text) || "";

  useEffect(() => {
    if (focused) return;
    setText(displayFromProps);
    setInvalid(false);
  }, [displayFromProps, focused]);

  function handleChange(raw: string) {
    const masked = maskDateBrInput(raw);
    setText(masked);
    setInvalid(false);
    if (format === "br") {
      onChange(masked);
      return;
    }
    if (brToIsoDate(masked)) emitStoredValue(masked, format, onChange);
  }

  function applyBrDate(br: string) {
    setText(br);
    setInvalid(false);
    emitStoredValue(br, format, onChange);
  }

  function handleBlur() {
    setFocused(false);
    const masked = maskDateBrInput(text);
    if (!masked.trim()) {
      onChange("");
      setText("");
      setInvalid(false);
      return;
    }
    const iso = brToIsoDate(masked);
    if (iso) {
      emitStoredValue(masked, format, onChange);
      setText(dateValueToDisplay(format === "iso" ? iso : masked, "br"));
      setInvalid(false);
      return;
    }
    setInvalid(true);
    setText(displayFromProps);
  }

  function openPicker() {
    if (disabled) return;
    const el = nativeRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
      el.click();
    }
  }

  function handleNativeChange(iso: string) {
    if (!iso) {
      onChange("");
      setText("");
      setInvalid(false);
      return;
    }
    applyBrDate(isoDateToBr(iso));
  }

  return (
    <div
      className={[
        "date-input",
        invalid ? "date-input--invalid" : "",
        disabled ? "date-input--disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input input--date-br date-input__text"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        maxLength={10}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        required={required}
      />
      <button
        type="button"
        className="date-input__calendar-btn"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Abrir calendário"
        title="Abrir calendário"
      >
        <IconCalendar />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="date-input__native"
        value={isoValue}
        min={minIso}
        max={maxIso}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleNativeChange(e.target.value)}
      />
    </div>
  );
}
