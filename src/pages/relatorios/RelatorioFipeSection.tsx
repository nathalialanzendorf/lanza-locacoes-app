import { useMemo, useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { ClienteSelect, ParceiroSelect, VeiculoSelect } from "@/components/EntitySelects";
import { FipeConsultaForm } from "@/components/FipeConsultaForm";
import { QueryError } from "@/components/PageHeader";
import {
  useClientes,
  useContratos,
  useParceiros,
  useVeiculos,
  useVinculosParceiro,
} from "@/api/hooks";
import { LanzaApiError } from "@/api/client";
import { clienteExibicaoPorId, formatVeiculoLabel } from "@/lib/format";
import { StatusContrato, TipoVeiculoFrota } from "@/lib/domain";
import { temDadosFipe } from "@/lib/fipeDisplay";
import type { Veiculo } from "@/api/types";

function compactPlaca(placa: string | null | undefined): string {
  return (placa ?? "").replace(/-/g, "").trim().toUpperCase();
}

export function RelatorioFipeSection() {
  const [veiculoId, setVeiculoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [parceiroId, setParceiroId] = useState("");

  const veiculosQuery = useVeiculos({
    ativo: true,
    tipoFrota: TipoVeiculoFrota.Locacao,
    comFipe: true,
  });
  const clientesQuery = useClientes({ ativo: true });
  const parceirosQuery = useParceiros();
  const vinculosQuery = useVinculosParceiro();
  const contratosQuery = useContratos({ status: StatusContrato.Ativo });

  const { parceiroPorVeiculoId, parceiroIdPorVeiculoId } = useMemo(() => {
    const nomes = new Map((parceirosQuery.data?.items ?? []).map((p) => [p.id, p.nome]));
    const parceiroPorVeiculoId = new Map<string, string>();
    const parceiroIdPorVeiculoId = new Map<string, string>();
    for (const v of vinculosQuery.data?.items ?? []) {
      parceiroIdPorVeiculoId.set(v.veiculoId, v.parceiroId);
      const nome = nomes.get(v.parceiroId);
      if (nome) parceiroPorVeiculoId.set(v.veiculoId, nome);
    }
    return { parceiroPorVeiculoId, parceiroIdPorVeiculoId };
  }, [parceirosQuery.data, vinculosQuery.data]);

  const placaParaVeiculoId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of veiculosQuery.data?.items ?? []) {
      const key = compactPlaca(v.placa);
      if (key) map.set(key, v.id);
    }
    return map;
  }, [veiculosQuery.data]);

  /** Cliente do contrato ativo por veículo (fallback: clienteVinculadoId). */
  const clienteIdPorVeiculoId = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of veiculosQuery.data?.items ?? []) {
      if (v.clienteVinculadoId?.trim()) map.set(v.id, v.clienteVinculadoId.trim());
    }
    for (const c of contratosQuery.data?.items ?? []) {
      const cid = c.clienteId?.trim();
      if (!cid) continue;
      const vid =
        c.veiculoId?.trim() ||
        c.veiculo?.id?.trim() ||
        placaParaVeiculoId.get(compactPlaca(c.placa ?? c.veiculo?.placa));
      if (vid) map.set(vid, cid);
    }
    return map;
  }, [veiculosQuery.data, contratosQuery.data, placaParaVeiculoId]);

  const rows = useMemo(() => {
    const items = veiculosQuery.data?.items ?? [];
    return items
      .filter((v) => {
        if (veiculoId && v.id !== veiculoId) return false;
        if (parceiroId && parceiroIdPorVeiculoId.get(v.id) !== parceiroId) return false;
        if (clienteId && clienteIdPorVeiculoId.get(v.id) !== clienteId) return false;
        return true;
      })
      .sort((a, b) => formatVeiculoLabel(a).localeCompare(formatVeiculoLabel(b), "pt-BR"));
  }, [veiculosQuery.data, veiculoId, parceiroId, clienteId, parceiroIdPorVeiculoId, clienteIdPorVeiculoId]);

  const temFiltro = Boolean(veiculoId || clienteId || parceiroId);
  const comFipe = rows.filter((v) => temDadosFipe(v)).length;
  const loading =
    veiculosQuery.isLoading ||
    vinculosQuery.isLoading ||
    contratosQuery.isLoading ||
    clientesQuery.isLoading;

  function clienteDoVeiculo(v: Veiculo): string {
    return clienteExibicaoPorId(clientesQuery.data?.items, clienteIdPorVeiculoId.get(v.id));
  }

  function parceiroDoVeiculo(v: Veiculo): string {
    return parceiroPorVeiculoId.get(v.id) ?? "—";
  }

  return (
    <>
      {!loading ? (
        <p className="relatorio-infracoes__resumo">
          <span className="badge badge--muted">
            {rows.length} veículo{rows.length === 1 ? "" : "s"} · {comFipe} com FIPE
          </span>
        </p>
      ) : null}

      <section className="form-card">
        <h2 className="form-card__title">Filtros</h2>
        <div className="form-grid">
          <FieldLike label="Veículo">
            <VeiculoSelect
              value={veiculoId}
              onChange={setVeiculoId}
              valueField="id"
              ativo
              tipoFrota={TipoVeiculoFrota.Locacao}
              parceiroId={parceiroId || undefined}
              variant="filtro"
            />
          </FieldLike>
          <FieldLike label="Cliente">
            <ClienteSelect value={clienteId} onChange={setClienteId} ativo variant="filtro" />
          </FieldLike>
          <FieldLike label="Parceiro">
            <ParceiroSelect value={parceiroId} onChange={setParceiroId} ativo variant="filtro" />
          </FieldLike>
        </div>
      </section>

      {veiculosQuery.isError ? (
        <QueryError
          message={
            veiculosQuery.error instanceof LanzaApiError
              ? veiculosQuery.error.message
              : "Falha ao listar veículos FIPE."
          }
        />
      ) : null}

      <DataTable
        loading={loading}
        rows={rows}
        keyFn={(v) => v.id}
        emptyMessage={
          temFiltro ? "Nenhum veículo corresponde aos filtros." : "Nenhum veículo encontrado."
        }
        columns={[
          {
            key: "veiculo",
            header: "Veículo",
            sortValue: (v) => formatVeiculoLabel(v),
            render: (v) => <strong>{formatVeiculoLabel(v)}</strong>,
          },
          {
            key: "cliente",
            header: "Cliente",
            sortValue: (v) => clienteDoVeiculo(v),
            render: (v) => clienteDoVeiculo(v),
          },
          {
            key: "parceiro",
            header: "Parceiro",
            sortValue: (v) => parceiroDoVeiculo(v),
            render: (v) => parceiroDoVeiculo(v),
          },
          {
            key: "fipeModelo",
            header: "Modelo FIPE",
            sortValue: (v) => v.fipeModelo ?? "",
            render: (v) => v.fipeModelo ?? "—",
          },
          {
            key: "fipeCodigo",
            header: "Código",
            sortValue: (v) => v.fipeCodigo ?? "",
            render: (v) => v.fipeCodigo ?? "—",
          },
          {
            key: "fipeValor",
            header: "Valor",
            className: "num",
            sortValue: (v) => v.fipeValor ?? "",
            render: (v) =>
              temDadosFipe(v) ? (
                v.fipeValor ?? "—"
              ) : (
                <span className="badge badge--muted">Sem FIPE</span>
              ),
          },
          {
            key: "ref",
            header: "Referência",
            sortValue: (v) => v.fipeReferencia ?? "",
            render: (v) => v.fipeReferencia ?? "—",
          },
        ]}
      />

      <FipeConsultaForm
        title="Consulta FIPE por placa"
        showPersistOption
        modoSelecao="placa"
      />
    </>
  );
}

function FieldLike({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
