import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";

const RELATORIOS_LOCACAO_TABS = [
  { to: "/relatorios/cobrancas", label: "Cobranças", end: true },
  { to: "/relatorios/prestacao-contas", label: "Prestação de contas" },
  { to: "/relatorios/encerramento", label: "Encerramento" },
] as const;

const RELATORIOS_CONSULTA_TABS = [
  { to: "/relatorios/veiculo", label: "Dados do veículo", end: true },
  { to: "/relatorios/infracoes", label: "Infrações" },
  { to: "/relatorios/pedagios", label: "Pedágio Digital" },
  { to: "/relatorios/estacionamento", label: "SigaPay" },
  { to: "/relatorios/fipe", label: "FIPE" },
] as const;

function relatoriosLocacaoPath(pathname: string): boolean {
  return (
    pathname === "/relatorios/cobrancas" ||
    pathname === "/relatorios/prestacao-contas" ||
    pathname === "/relatorios/encerramento"
  );
}

export function RelatoriosShell() {
  const { pathname } = useLocation();
  const locacao = relatoriosLocacaoPath(pathname);

  return (
    <PageHeader
      title="Relatórios"
      description={
        locacao
          ? "Cobranças, prestação de contas e encerramento de contrato — operação de locação."
          : "Consultas por veículo — DETRAN, pedágio digital, estacionamento SigaPay e FIPE."
      }
    >
      <PageTabs
        ariaLabel="Relatórios"
        tabs={locacao ? [...RELATORIOS_LOCACAO_TABS] : [...RELATORIOS_CONSULTA_TABS]}
      />
      <Outlet />
    </PageHeader>
  );
}

export function RelatoriosIndexRedirect() {
  return <Navigate to="cobrancas" replace />;
}
