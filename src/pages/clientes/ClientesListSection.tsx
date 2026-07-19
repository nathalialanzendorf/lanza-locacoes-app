import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import { useClientes, useContratos } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatVeiculoLabel, formatClienteLabel, statusClass, statusLabel } from "@/lib/format";
import { ordenarAtivoDepoisAlfabetico, registroAtivo, rowClassInativo } from "@/lib/listagemCadastro";
import {
  clienteOperacionalAtivo,
  contratoOperacionalDoCliente,
  indexarContratosOperacionaisAtivos,
} from "@/lib/statusCliente";
import type { Cliente, Contrato } from "@/api/types";

function formatCnh(cnh: Cliente["cnh"]): string {
  if (!cnh) return "—";
  if (typeof cnh === "string") return cnh;
  if (typeof cnh === "object" && "numeroRegistro" in cnh) {
    return String(cnh.numeroRegistro ?? "—");
  }
  return "—";
}

function veiculoDoContrato(contrato: Contrato): string {
  return formatVeiculoLabel({
    placa: contrato.placa ?? contrato.veiculo?.placa,
    marcaModelo: contrato.veiculo?.marcaModelo,
    anoModelo: contrato.veiculo?.anoModelo,
  });
}

function rotuloCliente(cliente: Cliente, ativoOperacional: boolean): string {
  return formatClienteLabel({ ...cliente, ativo: ativoOperacional });
}

export function ClientesListSection() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [togglingAtivoId, setTogglingAtivoId] = useState<string | null>(null);
  const query = useClientes();
  const contratosQuery = useContratos({ status: "ativo" });

  const contratosAtivos = useMemo(
    () => indexarContratosOperacionaisAtivos(contratosQuery.data?.items),
    [contratosQuery.data],
  );

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = nome.trim().toLowerCase();
    const filtrados = q ? items.filter((c) => (c.nome ?? "").toLowerCase().includes(q)) : items;
    return ordenarAtivoDepoisAlfabetico(filtrados, {
      ativoDe: (c) => clienteOperacionalAtivo(c, contratosAtivos),
      rotuloDe: (c) => c.nome ?? "",
    });
  }, [query.data, nome, contratosAtivos]);

  async function desabilitar(cliente: Cliente) {
    const label = rotuloCliente(cliente, clienteOperacionalAtivo(cliente, contratosAtivos));
    if (!window.confirm(`Desabilitar o cliente "${label}"?`)) return;
    setTogglingAtivoId(cliente.id);
    try {
      await lanzaApi.atualizarCliente(cliente.id, { ativo: false });
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      void qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao desabilitar cliente.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function habilitar(cliente: Cliente) {
    const label = rotuloCliente(cliente, clienteOperacionalAtivo(cliente, contratosAtivos));
    if (!window.confirm(`Habilitar o cliente "${label}"?`)) return;
    setTogglingAtivoId(cliente.id);
    try {
      await lanzaApi.atualizarCliente(cliente.id, { ativo: true });
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      void qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao habilitar cliente.");
    } finally {
      setTogglingAtivoId(null);
    }
  }

  async function excluir(cliente: Cliente) {
    const label = rotuloCliente(cliente, clienteOperacionalAtivo(cliente, contratosAtivos));
    if (!window.confirm(`Excluir o cliente "${label}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(cliente.id);
    try {
      await lanzaApi.removerCliente(cliente.id);
      void qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir cliente.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <>
      <ListToolbar addTo="/clientes/novo">
        <input
          className="input"
          placeholder="Filtrar nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        {!query.isLoading ? (
          <span className="badge badge--muted">
            {rows.length} cliente{rows.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </ListToolbar>
      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar clientes."}
        />
      ) : null}
      <DataTable
        loading={query.isLoading || contratosQuery.isLoading}
        rows={rows}
        keyFn={(c) => c.id}
        rowClassName={(c) =>
          rowClassInativo(clienteOperacionalAtivo(c, contratosAtivos))
        }
        columns={[
          {
            key: "nome",
            header: "Nome",
            sortValue: (c) => rotuloCliente(c, clienteOperacionalAtivo(c, contratosAtivos)),
            render: (c) => rotuloCliente(c, clienteOperacionalAtivo(c, contratosAtivos)),
          },
          { key: "cpf", header: "CPF", sortValue: (c) => c.cpf ?? "", render: (c) => c.cpf ?? "—" },
          { key: "cnh", header: "CNH", sortValue: (c) => formatCnh(c.cnh), render: (c) => formatCnh(c.cnh) },
          {
            key: "veiculoContrato",
            header: "Veículo",
            sortValue: (c) => {
              const contrato = contratoOperacionalDoCliente(c, contratosAtivos);
              return contrato ? veiculoDoContrato(contrato) : "";
            },
            render: (c) => {
              const contrato = contratoOperacionalDoCliente(c, contratosAtivos);
              return contrato ? veiculoDoContrato(contrato) : "—";
            },
          },
          {
            key: "status",
            header: "Status",
            sortValue: (c) => statusLabel(clienteOperacionalAtivo(c, contratosAtivos)),
            render: (c) => {
              const ativo = clienteOperacionalAtivo(c, contratosAtivos);
              return <span className={statusClass(ativo)}>{statusLabel(ativo)}</span>;
            },
          },
          {
            key: "analise",
            header: "Análise",
            sortValue: (c) => {
              const a = c.analiseCadastro?.aprovado;
              if (a === true) return "Aprovado";
              if (a === false) return "Reprovado";
              return "Pendente";
            },
            render: (c) => {
              const a = c.analiseCadastro?.aprovado;
              if (a === true) return <span className="badge badge--ok">Aprovado</span>;
              if (a === false) return <span className="badge badge--danger">Reprovado</span>;
              return <span className="badge badge--muted">Pendente</span>;
            },
          },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (c) => (
              <RowActions
                editTo={`/clientes/${c.id}/editar`}
                ativo={registroAtivo(c.ativo)}
                onAtivoChange={(next) => void (next ? habilitar(c) : desabilitar(c))}
                togglingAtivo={togglingAtivoId === c.id}
                deleting={excluindoId === c.id}
                onDelete={() => void excluir(c)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
