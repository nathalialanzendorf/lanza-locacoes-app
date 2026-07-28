import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { VeiculosListSection } from "@/pages/veiculos/VeiculosListSection";
import { VeiculosCadastroSection } from "@/pages/veiculos/VeiculosCadastroSection";
import { VeiculosImportarSection } from "@/pages/veiculos/VeiculosImportarSection";
import {
  TipoVeiculoFrota,
  veiculosBasePath,
  type TipoVeiculoFrotaValor,
} from "@/lib/domain";

function descricaoVeiculosModulo(tipoFrota: TipoVeiculoFrotaValor): string {
  switch (tipoFrota) {
    case TipoVeiculoFrota.Particular:
      return "Veículos particulares — cadastro e gestão fora da frota de locação.";
    case TipoVeiculoFrota.Venda:
      return "Estoque de veículos para venda — cadastro e consulta.";
    default:
      return "Frota de locação — cadastro e importação de CRLV.";
  }
}

type Props = {
  tipoFrota: TipoVeiculoFrotaValor;
};

export function VeiculosModulePage({ tipoFrota }: Props) {
  const importar = tipoFrota === TipoVeiculoFrota.Locacao;

  return (
    <PageHeader
      title="Veículos"
      description={descricaoVeiculosModulo(tipoFrota)}
    >
      <Routes>
        <Route index element={<VeiculosListSection tipoFrota={tipoFrota} />} />
        <Route path="novo" element={<VeiculosCadastroSection tipoFrota={tipoFrota} />} />
        {importar ? (
          <Route path="importar" element={<VeiculosImportarSection tipoFrota={tipoFrota} />} />
        ) : null}
        <Route path=":id/editar" element={<VeiculosCadastroRoute tipoFrota={tipoFrota} />} />
        <Route path="*" element={<Navigate to={veiculosBasePath(tipoFrota)} replace />} />
      </Routes>
    </PageHeader>
  );
}

function VeiculosCadastroRoute({ tipoFrota }: { tipoFrota: TipoVeiculoFrotaValor }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to={veiculosBasePath(tipoFrota)} replace />;
  return <VeiculosCadastroSection veiculoId={id} tipoFrota={tipoFrota} />;
}
