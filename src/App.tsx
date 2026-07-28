import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";

import { GuestRoute, ProtectedRoute } from "@/components/ProtectedRoute";

import { AuthProvider } from "@/context/AuthContext";
import { ScreenFlashProvider } from "@/context/ScreenFlashContext";

import { ClientesPage } from "@/pages/ClientesPage";

import { ContratosPage } from "@/pages/ContratosPage";

import { DashboardPage } from "@/pages/DashboardPage";

import { DespesasPage } from "@/pages/DespesasPage";

import { RelatorioFipeSection } from "@/pages/relatorios/RelatorioFipeSection";
import { RelatorioInfracoesSection } from "@/pages/relatorios/RelatorioInfracoesSection";
import { RelatorioIpvaLicenciamentoSection } from "@/pages/relatorios/RelatorioIpvaLicenciamentoSection";
import { RelatorioPedagiosSection } from "@/pages/relatorios/RelatorioPedagiosSection";
import { RelatorioEstacionamentoSection } from "@/pages/relatorios/RelatorioEstacionamentoSection";
import { RelatorioVeiculoDadosSection } from "@/pages/relatorios/RelatorioVeiculoDadosSection";

import { LoginPage } from "@/pages/LoginPage";

import { MovimentacaoPage } from "@/pages/MovimentacaoPage";

import { ParceirosPage } from "@/pages/ParceirosPage";

import { RecebimentosPage } from "@/pages/RecebimentosPage";

import { RegisterPage } from "@/pages/RegisterPage";

import { RelatorioCobrancasForm } from "@/pages/relatorios/RelatorioCobrancasForm";

import { RelatorioEncerramentoForm } from "@/pages/relatorios/RelatorioEncerramentoForm";

import { RelatorioPrestacaoContasForm } from "@/pages/relatorios/RelatorioPrestacaoContasForm";

import {
  RelatoriosConsultaIndexRedirect,
  RelatoriosConsultaShell,
  RelatoriosLocacaoShell,
} from "@/pages/relatorios/RelatoriosShell";

import { VeiculosModulePage } from "@/pages/veiculos/VeiculosModulePage";
import {
  RedirectVeiculosLegado,
  VeiculosEditarRedirect,
} from "@/pages/veiculos/VeiculosLegacyRoutes";
import { TipoVeiculoFrota } from "@/lib/domain";
import { VendaPage } from "@/pages/VendaPage";
import { SyncPage } from "@/pages/SyncPage";



const queryClient = new QueryClient({

  defaultOptions: {

    queries: {

      refetchOnWindowFocus: false,

    },

  },

});



export default function App() {

  return (

    <QueryClientProvider client={queryClient}>

      <AuthProvider>

        <ScreenFlashProvider>

        <BrowserRouter>

          <Routes>

            <Route element={<GuestRoute />}>

              <Route path="/login" element={<LoginPage />} />

              <Route path="/registro" element={<RegisterPage />} />

            </Route>



            <Route element={<ProtectedRoute />}>

              <Route element={<Layout />}>

                <Route index element={<DashboardPage />} />

                <Route path="clientes/*" element={<ClientesPage />} />

                <Route path="veiculos/:id/editar" element={<VeiculosEditarRedirect />} />
                <Route
                  path="veiculos/locacao/*"
                  element={<RedirectVeiculosLegado destinoBase="/veiculos" />}
                />
                <Route
                  path="veiculos/particular/*"
                  element={<RedirectVeiculosLegado destinoBase="/particular" />}
                />
                <Route
                  path="veiculos/venda/*"
                  element={<RedirectVeiculosLegado destinoBase="/venda/veiculos" />}
                />
                <Route path="veiculos/fipe" element={<Navigate to="/sync/fipe" replace />} />
                <Route
                  path="veiculos/*"
                  element={<VeiculosModulePage tipoFrota={TipoVeiculoFrota.Locacao} />}
                />

                <Route
                  path="particular/*"
                  element={<VeiculosModulePage tipoFrota={TipoVeiculoFrota.Particular} />}
                />

                <Route path="venda/veiculos/*" element={<VeiculosModulePage tipoFrota={TipoVeiculoFrota.Venda} />} />

                <Route path="venda/*" element={<VendaPage />} />

                <Route path="parceiros/*" element={<ParceirosPage />} />

                <Route path="contratos/*" element={<ContratosPage />} />

                <Route path="despesas/*" element={<DespesasPage />} />

                <Route path="infracoes" element={<Navigate to="/relatorios/infracoes" replace />} />

                <Route path="movimentacao/*" element={<MovimentacaoPage />} />

                <Route path="recebimentos/*" element={<RecebimentosPage />} />

                <Route path="sync/*" element={<SyncPage />} />

                <Route path="relatorios">
                  <Route element={<RelatoriosConsultaShell />}>
                    <Route index element={<RelatoriosConsultaIndexRedirect />} />
                    <Route path="infracoes" element={<RelatorioInfracoesSection />} />
                    <Route
                      path="ipva-licenciamento"
                      element={<RelatorioIpvaLicenciamentoSection />}
                    />
                    <Route path="pedagios" element={<RelatorioPedagiosSection />} />
                    <Route path="estacionamento" element={<RelatorioEstacionamentoSection />} />
                    <Route path="veiculo" element={<RelatorioVeiculoDadosSection />} />
                    <Route path="fipe" element={<RelatorioFipeSection />} />
                  </Route>
                  <Route element={<RelatoriosLocacaoShell />}>
                    <Route path="cobrancas" element={<RelatorioCobrancasForm />} />
                    <Route path="prestacao-contas" element={<RelatorioPrestacaoContasForm />} />
                    <Route path="encerramento" element={<RelatorioEncerramentoForm />} />
                  </Route>
                </Route>

                <Route path="locacoes" element={<Navigate to="/movimentacao" replace />} />

              </Route>

            </Route>



            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>

        </BrowserRouter>

        </ScreenFlashProvider>

      </AuthProvider>

    </QueryClientProvider>

  );

}

