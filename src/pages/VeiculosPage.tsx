import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { useVeiculo } from "@/api/hooks";
import { VeiculosListSection } from "@/pages/veiculos/VeiculosListSection";
import { VeiculosCadastroSection } from "@/pages/veiculos/VeiculosCadastroSection";
import { VeiculosImportarSection } from "@/pages/veiculos/VeiculosImportarSection";
import {
  TipoVeiculoFrota,
  abaVeiculoPath,
  veiculosBasePath,
  type TipoVeiculoFrotaValor,
} from "@/lib/domain";

export function VeiculosPage() {
  return (
    <PageHeader
      title="Veículos"
      description="Frota de locação — cadastro e importação de CRLV."
    >
      <PageTabs
        ariaLabel="Veículos"
        tabs={[
          { to: veiculosBasePath(TipoVeiculoFrota.Locacao), label: "Locação", end: true },
        ]}
      />
      <Routes>
        <Route index element={<Navigate to={TipoVeiculoFrota.Locacao} replace />} />
        <Route path="locacao/*" element={<VeiculosTipoRoutes tipoFrota={TipoVeiculoFrota.Locacao} />} />
        <Route path="particular/*" element={<RedirectVeiculosParticular />} />
        <Route path="venda/*" element={<RedirectVeiculosVenda />} />
        <Route path="fipe" element={<Navigate to="/sync/fipe" replace />} />
        <Route path="novo" element={<Navigate to={`${veiculosBasePath(TipoVeiculoFrota.Locacao)}/novo`} replace />} />
        <Route path="importar" element={<Navigate to={`${veiculosBasePath(TipoVeiculoFrota.Locacao)}/importar`} replace />} />
        <Route path=":id/editar" element={<VeiculosEditarRedirect />} />
        <Route path="cadastro" element={<Navigate to={`${veiculosBasePath(TipoVeiculoFrota.Locacao)}/novo`} replace />} />
        <Route path="*" element={<Navigate to={veiculosBasePath(TipoVeiculoFrota.Locacao)} replace />} />
      </Routes>
    </PageHeader>
  );
}

function VeiculosTipoRoutes({ tipoFrota }: { tipoFrota: TipoVeiculoFrotaValor }) {
  const basePath = veiculosBasePath(tipoFrota);
  const importar = tipoFrota === TipoVeiculoFrota.Locacao;

  return (
    <Routes>
      <Route index element={<VeiculosListSection tipoFrota={tipoFrota} />} />
      <Route path="novo" element={<VeiculosCadastroSection tipoFrota={tipoFrota} />} />
      {importar ? <Route path="importar" element={<VeiculosImportarSection tipoFrota={tipoFrota} />} /> : null}
      <Route path=":id/editar" element={<VeiculosCadastroRoute tipoFrota={tipoFrota} />} />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
}

function VeiculosCadastroRoute({ tipoFrota }: { tipoFrota: TipoVeiculoFrotaValor }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to={veiculosBasePath(tipoFrota)} replace />;
  return <VeiculosCadastroSection veiculoId={id} tipoFrota={tipoFrota} />;
}

function RedirectVeiculosParticular() {
  const { pathname, search } = useLocation();
  const suffix = pathname.replace(/^\/veiculos\/particular/, "");
  return <Navigate to={`/particular${suffix}${search}`} replace />;
}

function RedirectVeiculosVenda() {
  const { pathname, search } = useLocation();
  const suffix = pathname.replace(/^\/veiculos\/venda/, "");
  return <Navigate to={`/venda/veiculos${suffix}${search}`} replace />;
}

function VeiculosEditarRedirect() {
  const { id } = useParams<{ id: string }>();
  const query = useVeiculo(id);

  if (!id) return <Navigate to={veiculosBasePath(TipoVeiculoFrota.Locacao)} replace />;
  if (query.isLoading) return <p className="muted">A carregar veículo…</p>;
  if (query.isError || !query.data?.data) {
    return <Navigate to={veiculosBasePath(TipoVeiculoFrota.Locacao)} replace />;
  }

  return <Navigate to={`${abaVeiculoPath(query.data.data)}/${id}/editar`} replace />;
}
