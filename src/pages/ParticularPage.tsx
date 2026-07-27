import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { VeiculosListSection } from "@/pages/veiculos/VeiculosListSection";
import { VeiculosCadastroSection } from "@/pages/veiculos/VeiculosCadastroSection";
import { TipoVeiculoFrota } from "@/lib/domain";

export function ParticularPage() {
  return (
    <PageHeader
      title="Particular"
      description="Veículos particulares — cadastro e gestão fora da frota de locação."
    >
      <Routes>
        <Route index element={<VeiculosListSection tipoFrota={TipoVeiculoFrota.Particular} />} />
        <Route path="novo" element={<VeiculosCadastroSection tipoFrota={TipoVeiculoFrota.Particular} />} />
        <Route path=":id/editar" element={<ParticularVeiculoCadastroRoute />} />
        <Route path="*" element={<Navigate to="/particular" replace />} />
      </Routes>
    </PageHeader>
  );
}

function ParticularVeiculoCadastroRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/particular" replace />;
  return <VeiculosCadastroSection veiculoId={id} tipoFrota={TipoVeiculoFrota.Particular} />;
}
