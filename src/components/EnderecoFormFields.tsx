import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Field } from "@/components/FormCard";
import { cepDigitos, cepValido, consultarCep, formatarCep } from "@/lib/viaCep";

export type EnderecoForm = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type Props = {
  value: EnderecoForm;
  onChange: Dispatch<SetStateAction<EnderecoForm>>;
  disabled?: boolean;
};

export function EnderecoFormFields({ value, onChange, disabled }: Props) {
  const [cepStatus, setCepStatus] = useState<string | null>(null);
  const ultimoCepConsultado = useRef("");

  useEffect(() => {
    const digits = cepDigitos(value.cep);
    if (!cepValido(value.cep) || digits === ultimoCepConsultado.current) return;

    let cancelado = false;
    setCepStatus("Buscando endereço…");

    void consultarCep(digits)
      .then((r) => {
        if (cancelado) return;
        ultimoCepConsultado.current = digits;
        onChange((prev) => ({
          ...prev,
          cep: formatarCep(digits),
          logradouro: r.logradouro || prev.logradouro,
          bairro: r.bairro || prev.bairro,
          cidade: r.localidade || prev.cidade,
          uf: r.uf || prev.uf,
        }));
        setCepStatus(null);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        ultimoCepConsultado.current = "";
        setCepStatus(err instanceof Error ? err.message : "Falha ao consultar CEP.");
      });

    return () => {
      cancelado = true;
    };
  }, [value.cep, onChange]);

  function atualizarCep(raw: string) {
    const digits = cepDigitos(raw);
    ultimoCepConsultado.current = "";
    onChange((prev) => ({
      ...prev,
      cep: digits.length <= 8 ? (digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits) : prev.cep,
    }));
  }

  return (
    <div className="form-grid">
      <Field label="CEP" hint="ViaCEP: informe o CEP e logradouro, bairro, cidade e UF são preenchidos automaticamente.">
        <input
          className="input"
          inputMode="numeric"
          autoComplete="postal-code"
          value={value.cep}
          disabled={disabled}
          placeholder="00000-000"
          onChange={(e) => atualizarCep(e.target.value)}
          onBlur={() => {
            if (cepValido(value.cep)) {
              onChange((prev) => ({ ...prev, cep: formatarCep(prev.cep) }));
            }
          }}
        />
        {cepStatus ? <span className="field__hint">{cepStatus}</span> : null}
      </Field>
      <Field label="Número" hint="Obrigatório para endereço completo.">
        <input
          className="input"
          value={value.numero}
          disabled={disabled}
          placeholder="123"
          onChange={(e) => onChange((prev) => ({ ...prev, numero: e.target.value }))}
        />
      </Field>
      <Field label="Complemento" hint="Apto, bloco, casa, etc.">
        <input
          className="input"
          value={value.complemento}
          disabled={disabled}
          placeholder="Apto 101"
          onChange={(e) => onChange((prev) => ({ ...prev, complemento: e.target.value }))}
        />
      </Field>
      <Field label="Logradouro" span="full">
        <input
          className="input"
          value={value.logradouro}
          disabled={disabled}
          onChange={(e) => onChange((prev) => ({ ...prev, logradouro: e.target.value }))}
        />
      </Field>
      <Field label="Bairro">
        <input
          className="input"
          value={value.bairro}
          disabled={disabled}
          onChange={(e) => onChange((prev) => ({ ...prev, bairro: e.target.value }))}
        />
      </Field>
      <Field label="Cidade" span="wide">
        <input
          className="input"
          value={value.cidade}
          disabled={disabled}
          onChange={(e) => onChange((prev) => ({ ...prev, cidade: e.target.value }))}
        />
      </Field>
      <Field label="UF">
        <input
          className="input"
          value={value.uf}
          disabled={disabled}
          maxLength={2}
          onChange={(e) => onChange((prev) => ({ ...prev, uf: e.target.value.toUpperCase() }))}
        />
      </Field>
    </div>
  );
}
