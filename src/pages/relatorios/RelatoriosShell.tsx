import { Navigate, Outlet } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";

export const RELATORIOS_CONSULTA_TABS = [
  { to: "/relatorios/infracoes", label: "Infrações", end: true },
  { to: "/relatorios/ipva-licenciamento", label: "IPVA/Licenciamento" },
  { to: "/relatorios/pedagios", label: "Pedágio Digital" },
  { to: "/relatorios/estacionamento", label: "SigaPay" },
  { to: "/relatorios/fipe", label: "FIPE" },
] as const;

const RELATORIOS_LOCACAO_TABS = [
  { to: "/relatorios/cobrancas", label: "Cobranças", end: true },
  { to: "/relatorios/prestacao-contas", label: "Prestação de contas" },
  { to: "/relatorios/encerramento", label: "Encerramento" },
] as const;

export function relatoriosConsultaAtivo(pathname: string): boolean {
  return RELATORIOS_CONSULTA_TABS.some((tab) =>
    "end" in tab && tab.end
      ? pathname === tab.to || pathname === `${tab.to}/`
      : pathname.startsWith(tab.to),
  );
}

function relatoriosLocacaoAtivo(pathname: string): boolean {
  return RELATORIOS_LOCACAO_TABS.some((tab) =>
    "end" in tab && tab.end
      ? pathname === tab.to || pathname === `${tab.to}/`
      : pathname.startsWith(tab.to),
  );
}

export { relatoriosLocacaoAtivo };

export function RelatoriosConsultaShell() {
  return (
    <PageHeader
      title="Relatórios"
      description="Consultas por veículo — DETRAN, IPVA/licenciamento, pedágio digital, estacionamento SigaPay e FIPE."
    >
      <PageTabs ariaLabel="Relatórios" tabs={[...RELATORIOS_CONSULTA_TABS]} />
      <Outlet />
    </PageHeader>
  );
}

export function RelatoriosLocacaoShell() {
  return (
    <PageHeader
      title="Relatórios"
      description="Cobranças, prestação de contas e encerramento de contrato — operação de locação."
    >
      <PageTabs ariaLabel="Relatórios" tabs={[...RELATORIOS_LOCACAO_TABS]} />
      <Outlet />
    </PageHeader>
  );
}

/** @deprecated Use RelatoriosConsultaShell ou RelatoriosLocacaoShell */
export function RelatoriosShell() {
  return <RelatoriosConsultaShell />;
}

export function RelatoriosConsultaIndexRedirect() {
  return <Navigate to="infracoes" replace />;
}

export function RelatoriosLocacaoIndexRedirect() {
  return <Navigate to="cobrancas" replace />;
}

/** @deprecated */
export function RelatoriosIndexRedirect() {
  return <RelatoriosConsultaIndexRedirect />;
}
