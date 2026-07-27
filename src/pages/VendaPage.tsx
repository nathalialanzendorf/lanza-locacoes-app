import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { VeiculosListSection } from "@/pages/veiculos/VeiculosListSection";
import { VeiculosCadastroSection } from "@/pages/veiculos/VeiculosCadastroSection";
import { TipoVeiculoFrota } from "@/lib/domain";

export function VendaPage() {
  return (
    <PageHeader
      title="Venda"
      description="Veículos disponíveis para venda — cadastro e gestão do estoque."
    >
      <Routes>
        <Route index element={<VeiculosListSection tipoFrota={TipoVeiculoFrota.Venda} />} />
        <Route path="novo" element={<VeiculosCadastroSection tipoFrota={TipoVeiculoFrota.Venda} />} />
        <Route path=":id/editar" element={<VendaCadastroRoute />} />
        <Route path="*" element={<Navigate to="/venda" replace />} />
      </Routes>
    </PageHeader>
  );
}

function VendaCadastroRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/venda" replace />;
  return <VeiculosCadastroSection veiculoId={id} tipoFrota={TipoVeiculoFrota.Venda} />;
}
