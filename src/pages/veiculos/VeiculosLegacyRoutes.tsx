import { Navigate, useLocation } from "react-router-dom";

/** Redireciona rotas legadas `/veiculos/locacao/*`, etc. */
export function RedirectVeiculosLegado({ destinoBase }: { destinoBase: string }) {
  const { pathname, search } = useLocation();
  const suffix = pathname.replace(/^\/veiculos\/(locacao|particular|venda)/, "");
  return <Navigate to={`${destinoBase}${suffix}${search}`} replace />;
}
