import { useMemo } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { useSyncMeta } from "@/api/hooks";
import { syncNavItems, isSyncRastreame } from "@/lib/syncUi";
import { RelatorioVeiculoDadosSection } from "@/pages/relatorios/RelatorioVeiculoDadosSection";
import { SyncRastreameSection } from "@/pages/sync/SyncRastreameSection";
import { SyncLegadoSection, SyncTipoSection } from "@/pages/sync/SyncTipoSection";

function SyncTipoRoute() {
  const { syncId } = useParams();
  if (!syncId) return <Navigate to="/sync/veiculo" replace />;
  if (isSyncRastreame(syncId)) return <Navigate to="/sync/rastreame" replace />;
  return <SyncTipoSection syncId={syncId} />;
}

export function SyncPage() {
  const metaQuery = useSyncMeta();
  const tabs = useMemo(
    () => syncNavItems(metaQuery.data?.syncs ?? []),
    [metaQuery.data],
  );

  return (
    <PageHeader
      title="Sincronizações"
      description="Uma aba por integração para buscar e enviar dados externos."
    >
      <PageTabs ariaLabel="Sincronizações" tabs={tabs} />
      <Routes>
        <Route index element={<Navigate to="veiculo" replace />} />
        <Route path="veiculo" element={<RelatorioVeiculoDadosSection />} />
        <Route path="registros" element={<Navigate to="/sync/veiculo" replace />} />
        <Route path="executar" element={<Navigate to="/sync/veiculo" replace />} />
        <Route path="rastreame" element={<SyncRastreameSection />} />
        <Route path="legado" element={<SyncLegadoSection />} />
        <Route path=":syncId" element={<SyncTipoRoute />} />
        <Route path="*" element={<Navigate to="veiculo" replace />} />
      </Routes>
    </PageHeader>
  );
}
