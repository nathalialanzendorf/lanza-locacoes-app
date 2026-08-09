import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { DespesasClienteListSection } from "@/pages/despesas/DespesasClienteListSection";
import { RecebimentosManualSection } from "@/pages/RecebimentosManualSection";
import { VendasListSection } from "@/pages/venda/VendasListSection";
import { VendasCadastroSection } from "@/pages/venda/VendasCadastroSection";

export function VendaPage() {
  return (
    <PageHeader
      title="Vendas"
      description="Registo de vendas, parcelas e recebimentos de veículos."
    >
      <PageTabs
        ariaLabel="Vendas"
        tabs={[
          { to: "/venda", label: "Vendas", end: true },
          { to: "/venda/parcelas", label: "Parcelas" },
          { to: "/venda/recebimentos", label: "Recebimentos" },
        ]}
      />

      <Routes>
        <Route index element={<VendasListSection />} />
        <Route path="novo" element={<VendasCadastroSection />} />
        <Route path="parcelas" element={<DespesasClienteListSection variant="venda" />} />
        <Route path="recebimentos" element={<RecebimentosManualSection variant="venda" />} />
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
