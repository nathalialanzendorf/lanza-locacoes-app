import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { NativeSelect } from "@/components/EntitySelects";
import { Field, FormCard } from "@/components/FormCard";
import { Toggle } from "@/components/Toggle";
import { DateInput } from "@/components/DateInput";
import { QueryError } from "@/components/PageHeader";
import { ContratosVencimentoLegenda } from "@/pages/contratos/ContratosVencimentoLegenda";
import { colunasVeiculoContrato } from "@/pages/contratos/contratosVeiculoGridColumns";
import { useContratos, useClientes } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatPlaca, clienteExibicaoPorId } from "@/lib/format";
import {
  alertaVencimentoContrato,
  dataFimPrevistaContrato,
  hojeIsoBr,
  ordenarContratosRenovacao,
  resumoVencimentoContratos,
  rotuloAlertaVencimento,
  rowClassVencimentoContrato,
} from "@/lib/contratoVencimento";
import { mensagemErroApi, mensagemSucessoEncerramento } from "@/lib/encerramentoFeedback";
import {
  MOTIVO_ENCERRAMENTO_OPCOES,
  MotivoEncerramento,
  StatusContrato,
  type MotivoEncerramentoValor,
} from "@/lib/domain";
import type { Contrato } from "@/api/types";

export function ContratosEncerrarSection() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const contratoIdUrl = searchParams.get("id")?.trim() || null;
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string | null>(contratoIdUrl);
  const [dataEncerramento, setDataEncerramento] = useState("");
  const [motivo, setMotivo] = useState<MotivoEncerramentoValor>(MotivoEncerramento.Devolvido);
  const [quebraContrato, setQuebraContrato] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useContratos({ status: StatusContrato.Ativo });
  const clientesQuery = useClientes();
  const hojeIso = hojeIsoBr();

  const rows = useMemo(() => {
    const list = [...(query.data?.items ?? [])];
    list.sort((a, b) => ordenarContratosRenovacao(a, b, hojeIso));
    return list;
  }, [query.data, hojeIso]);

  const resumo = useMemo(
    () => resumoVencimentoContratos(rows, hojeIso),
    [rows, hojeIso],
  );

  const contratoSelecionado = useMemo(
    () => rows.find((c) => c.id === contratoSelecionadoId) ?? null,
    [rows, contratoSelecionadoId],
  );

  useEffect(() => {
    if (contratoIdUrl) setContratoSelecionadoId(contratoIdUrl);
  }, [contratoIdUrl]);

  useEffect(() => {
    if (query.isLoading || !contratoSelecionadoId) return;
    if (!rows.some((c) => c.id === contratoSelecionadoId)) {
      setContratoSelecionadoId(null);
      if (contratoIdUrl) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("id");
            return next;
          },
          { replace: true },
        );
      }
    }
  }, [rows, contratoSelecionadoId, query.isLoading, contratoIdUrl, setSearchParams]);

  useEffect(() => {
    if (motivo === MotivoEncerramento.Troca) setQuebraContrato(false);
  }, [motivo]);

  function selecionarContrato(contrato: Contrato) {
    setContratoSelecionadoId(contrato.id);
    setError(null);
    setSuccess(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", contrato.id);
        return next;
      },
      { replace: true },
    );
  }

  async function submit() {
    if (!contratoSelecionado) {
      setError("Selecione um contrato na lista.");
      return;
    }
    if (!dataEncerramento.trim()) {
      setError("Informe a data de encerramento.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await lanzaApi.encerrarContrato({
        idOuPasta: contratoSelecionado.id,
        dataEncerramento: dataEncerramento.trim(),
        motivoEncerramento: motivo,
        quebraContrato: motivo === MotivoEncerramento.Troca ? false : quebraContrato,
      });
      setSuccess(mensagemSucessoEncerramento(r.data));
      setContratoSelecionadoId(null);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("id");
          return next;
        },
        { replace: true },
      );
      void qc.invalidateQueries({ queryKey: ["contratos"] });
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      void qc.invalidateQueries({ queryKey: ["veiculos"] });
    } catch (err) {
      setError(mensagemErroApi(err, "Falha ao encerrar contrato."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Contratos ativos</h2>
        {!query.isLoading ? (
          <p className="field__hint">
            {rows.length} contrato{rows.length === 1 ? "" : "s"}
          </p>
        ) : null}
        <ContratosVencimentoLegenda vencidos={resumo.vencidos} proximos={resumo.proximos} />
        {query.isError ? (
          <QueryError
            message={
              query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar contratos."
            }
          />
        ) : null}
        <p className="field__hint">Selecione o contrato a encerrar.</p>
        <DataTable
          loading={query.isLoading}
          rows={rows}
          keyFn={(c) => c.id}
          selectedKey={contratoSelecionadoId}
          onRowClick={selecionarContrato}
          rowClassName={(c) => rowClassVencimentoContrato(c, hojeIso)}
          emptyMessage="Nenhum contrato ativo."
          columns={[
            {
              key: "sel",
              header: "",
              className: "col-sel",
              render: (c) => (
                <input
                  type="radio"
                  name="contrato-encerrar"
                  checked={contratoSelecionadoId === c.id}
                  onChange={() => selecionarContrato(c)}
                  aria-label={`Selecionar contrato ${formatPlaca(c.placa)}`}
                />
              ),
            },
            {
              key: "cliente",
              header: "Cliente",
              sortValue: (c) =>
                clienteExibicaoPorId(clientesQuery.data?.items, c.clienteId, c.clienteNome),
              render: (c) => (
                <strong>
                  {clienteExibicaoPorId(clientesQuery.data?.items, c.clienteId, c.clienteNome)}
                </strong>
              ),
            },
            ...colunasVeiculoContrato,
            { key: "inicio", header: "Início", sortValue: (c) => c.dataInicio ?? "", render: (c) => c.dataInicio ?? "—" },
            {
              key: "termino",
              header: "Fim previsto",
              sortValue: (c) => dataFimPrevistaContrato(c) ?? "",
              render: (c) => {
                const fim = dataFimPrevistaContrato(c) ?? "—";
                const rotulo = rotuloAlertaVencimento(dataFimPrevistaContrato(c), hojeIso);
                const alerta = alertaVencimentoContrato(dataFimPrevistaContrato(c), hojeIso);
                return (
                  <span className="contratos-renovar__termino">
                    {fim}
                    {rotulo ? (
                      <span
                        className={
                          alerta === "vencido" ? "badge badge--danger" : "badge badge--warn"
                        }
                      >
                        {rotulo}
                      </span>
                    ) : null}
                  </span>
                );
              },
            },
          ]}
        />
      </section>

      {contratoSelecionado ? (
        <>
          <p className="field__hint">
            Selecionado:{" "}
            <strong>
              {clienteExibicaoPorId(
                clientesQuery.data?.items,
                contratoSelecionado.clienteId,
                contratoSelecionado.clienteNome,
              )}
            </strong>{" "}
            · {formatPlaca(contratoSelecionado.placa)} · fim{" "}
            {dataFimPrevistaContrato(contratoSelecionado) ?? "—"}
          </p>
          <FormCard
            title="Efetivar encerramento"
            onSubmit={submit}
            loading={loading}
            submitLabel="Encerrar contrato"
            error={error}
            success={success}
          >
            <Field label="Data de encerramento">
              <DateInput value={dataEncerramento} onChange={setDataEncerramento} required disabled={loading} />
            </Field>
            <Field label="Motivo do encerramento">
              <NativeSelect
                value={motivo}
                onChange={(v) => setMotivo(v as MotivoEncerramentoValor)}
                variant="cadastro"
                allowEmpty={false}
                disabled={loading}
                aria-label="Motivo do encerramento"
              >
                {MOTIVO_ENCERRAMENTO_OPCOES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Quebra de contrato">
              <Toggle
                checked={quebraContrato}
                onChange={setQuebraContrato}
                disabled={loading || motivo === MotivoEncerramento.Troca}
                label="Registrar quebra (retenção proporcional de caução)"
              />
              {motivo === MotivoEncerramento.Troca ? (
                <span className="field__hint">Troca de veículo não é quebra — a caução transfere para o novo contrato.</span>
              ) : null}
            </Field>
          </FormCard>
        </>
      ) : null}
    </>
  );
}
