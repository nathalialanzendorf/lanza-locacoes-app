import { DataTable } from "@/components/DataTable";
import { ResponsavelDebitoCell } from "@/components/relatorios/ResponsavelDebitoCell";
import { formatBrl } from "@/lib/format";
import type { SyncRegistroLinha } from "@/pages/sync/useSyncRegistrosLinhas";

type Props = {
  loading: boolean;
  linhas: SyncRegistroLinha[];
  veiculoIdFiltro?: string;
  emptyMessage?: string;
  /** Abas de sync único (infrações / pedágio / SigaPay) — coluna Tipo é redundante. */
  ocultarTipo?: boolean;
  onConfirmed: () => void;
};

export function SyncRegistrosTable({
  loading,
  linhas,
  veiculoIdFiltro,
  emptyMessage,
  ocultarTipo,
  onConfirmed,
}: Props) {
  return (
    <DataTable
      loading={loading}
      rows={linhas}
      keyFn={(l) => l.id}
      emptyMessage={
        emptyMessage ??
        (veiculoIdFiltro
          ? "Nenhum registo em aberto para este veículo. Execute o sync e infira responsáveis."
          : "Nenhum registo em aberto. Selecione a frota ou um veículo e sincronize.")
      }
      columns={[
        ...(ocultarTipo
          ? []
          : [
              {
                key: "tipo",
                header: "Tipo",
                sortValue: (l: SyncRegistroLinha) => l.tipo,
                render: (l: SyncRegistroLinha) => (
                  <span className="badge badge--muted">{l.tipo}</span>
                ),
              },
            ]),
        {
          key: "ref",
          header: "Ref.",
          sortValue: (l) => l.ref,
          render: (l) => <strong>{l.ref}</strong>,
        },
        {
          key: "veiculo",
          header: "Veículo",
          sortValue: (l) => l.veiculo,
          render: (l) => l.veiculo,
        },
        {
          key: "desc",
          header: "Descrição",
          sortValue: (l) => l.descricao,
          render: (l) => (
            <span className="infracao-desc" title={l.descricao}>
              {l.descricao}
            </span>
          ),
        },
        {
          key: "data",
          header: "Data",
          sortValue: (l) => l.data,
          render: (l) => l.data,
        },
        {
          key: "valor",
          header: "Valor",
          className: "num",
          sortValue: (l) => l.valor,
          render: (l) => formatBrl(l.valor),
        },
        {
          key: "responsavel",
          header: "Responsável",
          render: (l) => {
            if (l.infracao) {
              return (
                <ResponsavelDebitoCell
                  tipo="infracao"
                  chave={l.infracao.numeroAuto ?? l.infracao.id}
                  item={l.infracao}
                  onConfirmed={onConfirmed}
                />
              );
            }
            if (l.despesa) {
              return (
                <ResponsavelDebitoCell
                  tipo="pedagio"
                  despesaId={l.despesa.id}
                  autoInfracao={l.despesa.autoInfracao ?? l.despesa.id}
                  item={l.despesa}
                  onConfirmed={onConfirmed}
                />
              );
            }
            return "—";
          },
        },
      ]}
    />
  );
}
