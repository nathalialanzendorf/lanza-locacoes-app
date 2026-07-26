import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DataTable } from "@/components/DataTable";
import { QueryError } from "@/components/PageHeader";
import { RowActions } from "@/components/RowActions";
import { useContratos, useClientes, useParceiros, useVeiculos, useVinculosParceiro } from "@/api/hooks";
import { lanzaApi } from "@/api/endpoints";
import { LanzaApiError } from "@/api/client";
import { formatPlaca, clienteExibicaoPorId } from "@/lib/format";
import { StatusContrato } from "@/lib/domain";
import { ordenarAtivoDepoisAlfabetico } from "@/lib/listagemCadastro";
import type { Contrato } from "@/api/types";

function terminoContrato(contrato: Contrato): string {
  if (contrato.dataEncerramento?.trim()) return contrato.dataEncerramento;
  if (contrato.dataFimPrevista?.trim()) return contrato.dataFimPrevista;
  return contrato.dataFim ?? "—";
}

function veiculoUuid(contrato: Contrato, placaParaId: Map<string, string>): string | undefined {
  const idSnapshot = contrato.veiculo?.id;
  if (idSnapshot) return idSnapshot;
  const placa = contrato.placa ?? contrato.veiculo?.placa;
  if (!placa) return undefined;
  return placaParaId.get(placa.trim().toUpperCase());
}

export function ContratosListSection() {
  const qc = useQueryClient();
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [baixandoAssinadoId, setBaixandoAssinadoId] = useState<string | null>(null);
  const query = useContratos();
  const parceirosQuery = useParceiros();
  const vinculosQuery = useVinculosParceiro();
  const veiculosQuery = useVeiculos();
  const clientesQuery = useClientes();

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return ordenarAtivoDepoisAlfabetico(items, {
      ativoDe: (c) => c.status === StatusContrato.Ativo,
      rotuloDe: (c) => formatPlaca(c.placa ?? c.veiculo?.placa ?? c.id),
    });
  }, [query.data]);

  const parceiroPorVeiculoId = useMemo(() => {
    const nomes = new Map((parceirosQuery.data?.items ?? []).map((p) => [p.id, p.nome]));
    const map = new Map<string, string>();
    for (const v of vinculosQuery.data?.items ?? []) {
      const nome = nomes.get(v.parceiroId);
      if (nome) map.set(v.veiculoId, nome);
    }
    return map;
  }, [parceirosQuery.data, vinculosQuery.data]);

  const placaParaVeiculoId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of veiculosQuery.data?.items ?? []) {
      if (v.placa) map.set(v.placa.trim().toUpperCase(), v.id);
    }
    return map;
  }, [veiculosQuery.data]);

  function parceiroDoContrato(contrato: Contrato): string {
    const id = veiculoUuid(contrato, placaParaVeiculoId);
    if (!id) return "—";
    return parceiroPorVeiculoId.get(id) ?? "—";
  }

  async function baixarAssinado(contrato: Contrato) {
    setBaixandoAssinadoId(contrato.id);
    try {
      await lanzaApi.downloadContratoAssinado(
        contrato.id,
        contrato.contratoAssinadoNome ?? undefined,
      );
    } catch (err) {
      window.alert(
        err instanceof LanzaApiError ? err.message : "Falha ao baixar contrato assinado.",
      );
    } finally {
      setBaixandoAssinadoId(null);
    }
  }

  async function excluir(contrato: Contrato) {
    const nomeCli = clienteExibicaoPorId(
      clientesQuery.data?.items,
      contrato.clienteId,
      contrato.clienteNome,
    );
    const label = nomeCli !== "—" ? nomeCli : formatPlaca(contrato.placa) ?? contrato.id;
    if (!window.confirm(`Excluir o contrato "${label}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(contrato.id);
    try {
      await lanzaApi.removerContrato(contrato.id);
      void qc.invalidateQueries({ queryKey: ["contratos"] });
    } catch (err) {
      window.alert(err instanceof LanzaApiError ? err.message : "Falha ao excluir contrato.");
    } finally {
      setExcluindoId(null);
    }
  }

  const loadingExtra =
    parceirosQuery.isLoading || vinculosQuery.isLoading || veiculosQuery.isLoading;

  return (
    <>
      {query.isError ? (
        <QueryError
          message={query.error instanceof LanzaApiError ? query.error.message : "Falha ao listar contratos."}
        />
      ) : null}
      {!query.isLoading ? (
        <p className="field__hint">
          {rows.length} contrato{rows.length === 1 ? "" : "s"}
        </p>
      ) : null}
      <DataTable
        loading={query.isLoading || loadingExtra}
        rows={rows}
        keyFn={(c) => c.id}
        rowClassName={(c) =>
          c.status === StatusContrato.Ativo ? undefined : "row--inativo row--inativo-amber"
        }
        emptyMessage="Nenhum contrato registado."
        columns={[
          {
            key: "placa",
            header: "Placa",
            sortValue: (c) => formatPlaca(c.placa ?? c.veiculo?.placa),
            render: (c) => <strong>{formatPlaca(c.placa ?? c.veiculo?.placa)}</strong>,
          },
          {
            key: "marcaModelo",
            header: "Marca / modelo",
            sortValue: (c) => c.veiculo?.marcaModelo ?? "",
            render: (c) => c.veiculo?.marcaModelo ?? "—",
          },
          {
            key: "ano",
            header: "Ano",
            sortValue: (c) => c.veiculo?.anoModelo ?? "",
            render: (c) => c.veiculo?.anoModelo ?? "—",
          },
          {
            key: "cliente",
            header: "Cliente",
            sortValue: (c) => clienteExibicaoPorId(clientesQuery.data?.items, c.clienteId, c.clienteNome),
            render: (c) =>
              clienteExibicaoPorId(clientesQuery.data?.items, c.clienteId, c.clienteNome),
          },
          {
            key: "parceiro",
            header: "Parceiro",
            sortValue: (c) => parceiroDoContrato(c),
            render: (c) => parceiroDoContrato(c),
          },
          {
            key: "status",
            header: "Status",
            sortValue: (c) => c.status ?? "",
            render: (c) => (
              <span className={c.status === StatusContrato.Ativo ? "badge badge--ok" : "badge badge--amber"}>
                {c.status ?? "—"}
              </span>
            ),
          },
          {
            key: "assinado",
            header: "Assinado",
            sortValue: (c) => (c.contratoAssinadoStorageKey ? "1" : "0"),
            render: (c) =>
              c.contratoAssinadoStorageKey ? (
                <span className="badge badge--ok" title={c.contratoAssinadoNome ?? "Contrato assinado"}>
                  Sim
                </span>
              ) : (
                <span className="muted">—</span>
              ),
          },
          { key: "inicio", header: "Início", sortValue: (c) => c.dataInicio ?? "", render: (c) => c.dataInicio ?? "—" },
          { key: "termino", header: "Término", sortValue: (c) => terminoContrato(c), render: (c) => terminoContrato(c) },
          {
            key: "acoes",
            header: "Ações",
            className: "col-acoes",
            render: (c) => (
              <RowActions
                variant="contrato"
                editTo={`/contratos/${c.id}/editar`}
                encerrarTo={
                  c.status === StatusContrato.Ativo
                    ? `/contratos/encerrar?id=${encodeURIComponent(c.id)}`
                    : undefined
                }
                renovarTo={
                  c.status === StatusContrato.Ativo
                    ? `/contratos/renovar?id=${encodeURIComponent(c.id)}`
                    : undefined
                }
                onDownloadAssinado={
                  c.contratoAssinadoStorageKey
                    ? () => void baixarAssinado(c)
                    : undefined
                }
                downloadingAssinado={baixandoAssinadoId === c.id}
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
