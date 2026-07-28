import { Navigate, useLocation, useParams } from "react-router-dom";

import { useVeiculo } from "@/api/hooks";
import { abaVeiculoPath, TipoVeiculoFrota, veiculosBasePath } from "@/lib/domain";

/** Redireciona rotas legadas `/veiculos/locacao/*`, etc. */
export function RedirectVeiculosLegado({ destinoBase }: { destinoBase: string }) {
  const { pathname, search } = useLocation();
  const suffix = pathname.replace(/^\/veiculos\/(locacao|particular|venda)/, "");
  return <Navigate to={`${destinoBase}${suffix}${search}`} replace />;
}

export function VeiculosEditarRedirect() {
  const { id } = useParams<{ id: string }>();
  const query = useVeiculo(id);

  if (!id) return <Navigate to={veiculosBasePath(TipoVeiculoFrota.Locacao)} replace />;
  if (query.isLoading) return <p className="muted">A carregar veículo…</p>;
  if (query.isError || !query.data?.data) {
    return <Navigate to={veiculosBasePath(TipoVeiculoFrota.Locacao)} replace />;
  }

  return <Navigate to={`${abaVeiculoPath(query.data.data)}/${id}/editar`} replace />;
}
