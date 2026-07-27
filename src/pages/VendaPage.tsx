import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { VeiculosListSection } from "@/pages/veiculos/VeiculosListSection";
import { VeiculosCadastroSection } from "@/pages/veiculos/VeiculosCadastroSection";
import { VendasListSection } from "@/pages/venda/VendasListSection";
import { VendasCadastroSection } from "@/pages/venda/VendasCadastroSection";
import { TipoVeiculoFrota } from "@/lib/domain";

export function VendaPage() {
  return (
    <PageHeader
      title="Venda"
      description="Registo de vendas de veículos e gestão do estoque para venda."
    >
      <PageTabs
        ariaLabel="Venda"
        tabs={[
          {
            to: "/venda",
            label: "Vendas",
            isActive: (pathname) =>
              pathname === "/venda" ||
              pathname === "/venda/novo" ||
              /^\/venda\/[^/]+\/editar$/.test(pathname),
          },
          {
            to: "/venda/veiculos",
            label: "Veículos",
            isActive: (pathname) => pathname.startsWith("/venda/veiculos"),
          },
        ]}
      />
      <Routes>
        <Route index element={<VendasListSection />} />
        <Route path="novo" element={<VendasCadastroSection />} />
        <Route path="veiculos/*" element={<VendaVeiculosRoutes />} />
        <Route path=":id/editar" element={<VendaCadastroRoute />} />
        <Route path="*" element={<Navigate to="/venda" replace />} />
      </Routes>
    </PageHeader>
  );
}

function VendaCadastroRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/venda" replace />;
  return <VendasCadastroSection vendaId={id} />;
}

function VendaVeiculosRoutes() {
  return (
    <Routes>
      <Route index element={<VeiculosListSection tipoFrota={TipoVeiculoFrota.Venda} />} />
      <Route path="novo" element={<VeiculosCadastroSection tipoFrota={TipoVeiculoFrota.Venda} />} />
      <Route path=":id/editar" element={<VendaVeiculoCadastroRoute />} />
      <Route path="*" element={<Navigate to="/venda/veiculos" replace />} />
    </Routes>
  );
}

function VendaVeiculoCadastroRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/venda/veiculos" replace />;
  return <VeiculosCadastroSection veiculoId={id} tipoFrota={TipoVeiculoFrota.Venda} />;
}
