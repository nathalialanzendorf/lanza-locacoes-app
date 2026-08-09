import type { ReactNode } from "react";
import { useMemo } from "react";

import { useClientes, useContratos, useParceiros, useVeiculos, useVinculosParceiro } from "@/api/hooks";
import { StatusContrato, TIPOS_VEICULO_FROTA_CADASTRO, parseTipoVeiculoFrota, rotuloTipoVeiculoFrota, type TipoVeiculoFrotaValor } from "@/lib/domain";
import { formatClienteSelectOption, formatVeiculoLabel } from "@/lib/format";
import { ordenarAtivoDepoisAlfabetico } from "@/lib/listagemCadastro";
import { selectEmptyLabel, type SelectEmptyVariant } from "@/lib/selectLabels";
import {
  clienteOperacionalAtivo,
  indexarContratosOperacionaisAtivos,
} from "@/lib/statusCliente";
import type { Cliente, Parceiro, Veiculo } from "@/api/types";

type SelectBaseProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  /** Consulta/filtro → ---Todos---; cadastro → --- Selecionar --- */
  variant?: SelectEmptyVariant;
  /** Sobrescreve o rótulo definido por `variant`. */
  emptyLabel?: string;
  className?: string;
  id?: string;
};

function SelectShell({
  value,
  onChange,
  required,
  disabled,
  allowEmpty = true,
  variant = "cadastro",
  emptyLabel,
  className = "select",
  id,
  loading,
  children,
}: SelectBaseProps & { loading?: boolean; children: ReactNode }) {
  const label = emptyLabel ?? selectEmptyLabel(variant);
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
    >
      {allowEmpty ? <option value="">{loading ? "A carregar…" : label}</option> : null}
      {children}
    </select>
  );
}

/** Opção vazia padronizada para `<select>` nativos. */
export function SelectEmptyOption({
  variant = "filtro",
  loading,
}: {
  variant?: SelectEmptyVariant;
  loading?: boolean;
}) {
  return <option value="">{loading ? "A carregar…" : selectEmptyLabel(variant)}</option>;
}

export type NativeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  variant?: SelectEmptyVariant;
  allowEmpty?: boolean;
  emptyLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  children: ReactNode;
};

/** `<select>` nativo com placeholder ---Todos--- (filtro) ou --- Selecionar --- (cadastro). */
export function NativeSelect({
  value,
  onChange,
  variant = "cadastro",
  allowEmpty = true,
  emptyLabel,
  loading,
  disabled,
  required,
  className = "select",
  id,
  "aria-label": ariaLabel,
  children,
}: NativeSelectProps) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      aria-label={ariaLabel}
    >
      {allowEmpty ? (
        <option value="">{loading ? "A carregar…" : (emptyLabel ?? selectEmptyLabel(variant))}</option>
      ) : null}
      {children}
    </select>
  );
}

type TipoVeiculoFrotaSelectProps = {
  value: TipoVeiculoFrotaValor;
  onChange: (value: TipoVeiculoFrotaValor) => void;
  disabled?: boolean;
  id?: string;
};

/** Classificação operacional: locação, particular ou venda. */
export function TipoVeiculoFrotaSelect({ value, onChange, disabled, id }: TipoVeiculoFrotaSelectProps) {
  return (
    <NativeSelect
      id={id}
      value={value}
      onChange={(raw) => onChange(parseTipoVeiculoFrota(raw))}
      allowEmpty={false}
      disabled={disabled}
      aria-label="Tipo de veículo"
    >
      {TIPOS_VEICULO_FROTA_CADASTRO.map((tipo) => (
        <option key={tipo} value={tipo}>
          {rotuloTipoVeiculoFrota(tipo)}
        </option>
      ))}
    </NativeSelect>
  );
}

function clienteValue(c: Cliente, field: "id" | "cpf" | "nome"): string {
  if (field === "id") return c.id;
  if (field === "cpf") return c.cpf?.trim() ?? "";
  return c.nome?.trim() ?? c.id;
}

export type ClienteSelectProps = SelectBaseProps & {
  valueField?: "id" | "cpf" | "nome";
  ativo?: boolean;
  /** Somente clientes com contrato ativo (inclui o valor já selecionado). */
  somenteContratoAtivo?: boolean;
  /** Ordena e destaca clientes com contrato operacional ativo (padrão: true). */
  destacarContratoAtivo?: boolean;
};

function ClienteSelectOptions({
  items,
  valueField,
  contratosAtivos,
  destacarContratoAtivo,
}: {
  items: Cliente[];
  valueField: "id" | "cpf" | "nome";
  contratosAtivos: ReturnType<typeof indexarContratosOperacionaisAtivos>;
  destacarContratoAtivo: boolean;
}) {
  const comContrato: Cliente[] = [];
  const demais: Cliente[] = [];
  for (const c of items) {
    if (clienteOperacionalAtivo(c, contratosAtivos)) comContrato.push(c);
    else demais.push(c);
  }

  const renderOption = (c: Cliente) => {
    const operacional = clienteOperacionalAtivo(c, contratosAtivos);
    return (
      <option
        key={c.id}
        value={clienteValue(c, valueField)}
        className={operacional && destacarContratoAtivo ? "select-option--contrato-ativo" : undefined}
      >
        {formatClienteSelectOption(c, operacional && destacarContratoAtivo)}
      </option>
    );
  };

  if (!destacarContratoAtivo || demais.length === 0) {
    return <>{items.map(renderOption)}</>;
  }

  return (
    <>
      {comContrato.length > 0 ? (
        <optgroup label="Contrato ativo">{comContrato.map(renderOption)}</optgroup>
      ) : null}
      {demais.length > 0 ? (
        <optgroup label="Outros clientes">{demais.map(renderOption)}</optgroup>
      ) : null}
    </>
  );
}

export function ClienteSelect({
  valueField = "id",
  ativo,
  somenteContratoAtivo,
  destacarContratoAtivo = true,
  variant = "cadastro",
  value,
  onChange,
  ...props
}: ClienteSelectProps) {
  const query = useClientes(ativo === undefined ? undefined : { ativo });
  const contratosQuery = useContratos({ status: StatusContrato.Ativo });
  const contratosAtivos = useMemo(
    () => indexarContratosOperacionaisAtivos(contratosQuery.data?.items),
    [contratosQuery.data],
  );
  const idsContratoAtivo = useMemo(() => new Set(contratosAtivos.porClienteId.keys()), [contratosAtivos]);
  const items = useMemo(() => {
    let list = [...(query.data?.items ?? [])];
    if (somenteContratoAtivo) {
      const atual = value?.trim();
      list = list.filter((c) => idsContratoAtivo.has(c.id) || c.id === atual);
    }
    list = ordenarAtivoDepoisAlfabetico(list, {
      ativoDe: (c) => clienteOperacionalAtivo(c, contratosAtivos),
      rotuloDe: (c) => c.nome ?? c.id,
    });
    if (valueField === "cpf") return list.filter((c) => c.cpf?.trim());
    if (valueField === "nome") return list.filter((c) => c.nome?.trim());
    return list;
  }, [
    query.data,
    valueField,
    somenteContratoAtivo,
    idsContratoAtivo,
    contratosAtivos,
    value,
  ]);

  return (
    <SelectShell
      {...props}
      variant={variant}
      value={value}
      onChange={onChange}
      loading={query.isLoading || contratosQuery.isLoading}
      className={[
        "select",
        props.className,
        destacarContratoAtivo ? "select--cliente-contrato" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ClienteSelectOptions
        items={items}
        valueField={valueField}
        contratosAtivos={contratosAtivos}
        destacarContratoAtivo={destacarContratoAtivo}
      />
    </SelectShell>
  );
}

function compactPlaca(placa: string | null | undefined): string {
  return (placa ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function veiculoValue(v: Veiculo, field: "id" | "placa"): string {
  if (field === "id") return v.id;
  return v.placa?.trim() ?? v.id;
}

export type VeiculoSelectProps = SelectBaseProps & {
  valueField?: "id" | "placa";
  ativo?: boolean;
  /** @deprecated Use tipoFrota */
  particular?: boolean;
  tipoFrota?: import("@/lib/domain").TipoVeiculoFrotaValor;
  clienteId?: string;
  parceiroId?: string;
};

export function VeiculoSelect({
  valueField = "placa",
  ativo,
  particular,
  tipoFrota,
  clienteId,
  parceiroId,
  ...props
}: VeiculoSelectProps) {
  const tipoFiltro =
    tipoFrota ??
    (particular === true
      ? "particular"
      : particular === false
        ? "locacao"
        : undefined);
  const query = useVeiculos({ ativo, tipoFrota: tipoFiltro });
  const clienteRef = clienteId?.trim() ?? "";
  const contratosQuery = useContratos(
    { status: StatusContrato.Ativo, clienteId: clienteRef || undefined },
    { enabled: Boolean(clienteRef) },
  );
  const vinculosQuery = useVinculosParceiro(
    parceiroId?.trim() ? { parceiroId: parceiroId.trim() } : undefined,
  );
  const placasContratoCliente = useMemo(() => {
    const set = new Set<string>();
    for (const c of contratosQuery.data?.items ?? []) {
      const pk = compactPlaca(c.placa ?? c.veiculoId);
      if (pk) set.add(pk);
    }
    return set;
  }, [contratosQuery.data]);
  const items = useMemo(() => {
    let list = query.data?.items ?? [];
    if (clienteRef) {
      list = list.filter((v) => {
        if (v.clienteVinculadoId === clienteRef) return true;
        const pk = compactPlaca(v.placa);
        return pk.length > 0 && placasContratoCliente.has(pk);
      });
    }
    if (parceiroId?.trim()) {
      const veiculoIds = new Set((vinculosQuery.data?.items ?? []).map((v) => v.veiculoId));
      list = list.filter((v) => veiculoIds.has(v.id));
    }
    return [...list].sort((a, b) => (a.placa ?? a.id).localeCompare(b.placa ?? b.id, "pt-BR"));
  }, [query.data, clienteRef, parceiroId, vinculosQuery.data, placasContratoCliente]);

  return (
    <SelectShell
      {...props}
      loading={
        query.isLoading ||
        (clienteRef ? contratosQuery.isLoading : false) ||
        (parceiroId?.trim() ? vinculosQuery.isLoading : false)
      }
    >
      {items.map((v) => (
        <option key={v.id} value={veiculoValue(v, valueField)}>
          {formatVeiculoLabel(v)}
        </option>
      ))}
    </SelectShell>
  );
}

export type ParceiroSelectProps = SelectBaseProps & {
  /** Somente parceiros com status ativo. */
  ativo?: boolean;
};

export function ParceiroSelect({ ativo, variant = "cadastro", value, onChange, ...props }: ParceiroSelectProps) {
  const query = useParceiros(ativo ? { ativo: true } : undefined);
  const items = useMemo(
    () => [...(query.data?.items ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [query.data],
  );

  return (
    <SelectShell
      {...props}
      variant={variant}
      value={value}
      onChange={onChange}
      loading={query.isLoading}
    >
      {items.map((p: Parceiro) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </SelectShell>
  );
}

export function matchParceiroIdPorNome(parceiros: Parceiro[] | undefined, nome: string): string {
  const alvo = nome.trim().toLowerCase();
  if (!alvo) return "";
  const exato = parceiros?.find((p) => p.nome.trim().toLowerCase() === alvo);
  if (exato) return exato.id;
  const parcial = parceiros?.filter((p) => {
    const n = p.nome.trim().toLowerCase();
    return n.includes(alvo) || alvo.includes(n);
  });
  return parcial?.length === 1 ? parcial[0]!.id : "";
}

/** Placa cadastrada para um veículo (APIs legadas que ainda exigem placa no body). */
export function placaDoVeiculo(veiculos: Veiculo[] | undefined, veiculoId: string): string {
  const id = veiculoId.trim();
  if (!id) return "";
  return veiculos?.find((v) => v.id === id)?.placa?.trim() ?? "";
}

export function matchVeiculoSelectValue(
  veiculos: Veiculo[] | undefined,
  ref: string | undefined,
  valueField: "id" | "placa",
): string {
  if (!ref?.trim() || !veiculos?.length) return ref?.trim() ?? "";
  const r = ref.trim();
  const byId = veiculos.find((v) => v.id === r);
  if (byId) return valueField === "id" ? byId.id : (byId.placa ?? byId.id);
  const placaNorm = r.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const byPlaca = veiculos.find(
    (v) => (v.placa ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() === placaNorm,
  );
  if (byPlaca) return valueField === "id" ? byPlaca.id : (byPlaca.placa ?? byPlaca.id);
  return valueField === "placa" ? r : "";
}
