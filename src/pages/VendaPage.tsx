import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { VendasListSection } from "@/pages/venda/VendasListSection";
import { VendasCadastroSection } from "@/pages/venda/VendasCadastroSection";

export function VendaPage() {
  return (
    <PageHeader
      title="Vendas"
      description="Registo de vendas de veículos."
    >
      <Routes>
        <Route index element={<VendasListSection />} />
        <Route path="novo" element={<VendasCadastroSection />} />
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
