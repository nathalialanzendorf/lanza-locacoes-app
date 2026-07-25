import { Navigate, Outlet } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";

export function RelatoriosShell() {
  return (
    <PageHeader
      title="Relatórios"
      description="Cobranças, prestação de contas, encerramento de contrato, infrações DETRAN, pedágio digital, estacionamento SigaPay, dados do veículo e consulta FIPE."
    >
      <PageTabs
        ariaLabel="Relatórios"
        tabs={[
          { to: "/relatorios/cobrancas", label: "Cobranças", end: true },
          { to: "/relatorios/prestacao-contas", label: "Prestação de contas" },
          { to: "/relatorios/encerramento", label: "Encerramento" },
          { to: "/relatorios/infracoes", label: "Infrações" },
          { to: "/relatorios/pedagios", label: "Pedágio Digital" },
          { to: "/relatorios/estacionamento", label: "SigaPay" },
          { to: "/relatorios/veiculo", label: "Dados do veículo" },
          { to: "/relatorios/fipe", label: "FIPE" },
        ]}
      />
      <Outlet />
    </PageHeader>
  );
}

export function RelatoriosIndexRedirect() {
  return <Navigate to="cobrancas" replace />;
}
