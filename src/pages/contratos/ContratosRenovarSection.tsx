import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/DataTable";
import { QueryError } from "@/components/PageHeader";
import { ContratosCadastroSection } from "@/pages/contratos/ContratosCadastroSection";
import { ContratosVencimentoLegenda } from "@/pages/contratos/ContratosVencimentoLegenda";
import { colunasVeiculoContrato } from "@/pages/contratos/contratosVeiculoGridColumns";
import { useClientes, useContratos } from "@/api/hooks";
import { StatusContrato } from "@/lib/domain";
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
import { labelTempoContrato } from "@/lib/contratoPrazo";
import type { Contrato } from "@/api/types";

export function ContratosRenovarSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const contratoIdUrl = searchParams.get("id")?.trim() || null;
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string | null>(contratoIdUrl);

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

  function selecionarContrato(contrato: Contrato) {
    setContratoSelecionadoId(contrato.id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", contrato.id);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <section className="form-card">
        <h2 className="form-card__title">Contratos ativos — renovação</h2>
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

        <p className="field__hint">Selecione o contrato a renovar.</p>
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
                  name="contrato-renovar"
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
            · {formatPlaca(contratoSelecionado.placa)} · início {contratoSelecionado.dataInicio ?? "—"} · fim{" "}
            {dataFimPrevistaContrato(contratoSelecionado) ?? "—"}
            {contratoSelecionado.prazoDias != null
              ? ` · ${labelTempoContrato("", contratoSelecionado.prazoDias)}`
              : ""}
          </p>
          <ContratosCadastroSection
            key={contratoSelecionado.id}
            modo="renovar"
            contratoId={contratoSelecionado.id}
            contratoOrigem={contratoSelecionado}
            titulo="Renovar contrato"
            submitLabel="Confirmar renovação"
            backTo="/contratos/renovar"
            backLabel="Voltar à lista de renovação"
          />
        </>
      ) : null}
    </>
  );
}
