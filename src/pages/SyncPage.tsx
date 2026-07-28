import { useMemo } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { useSyncMeta } from "@/api/hooks";
import { abasSync, rotuloAbaSync, syncPath } from "@/lib/syncUi";
import { SyncRegistrosSection } from "@/pages/sync/SyncRegistrosSection";
import { SyncLegadoSection, SyncTipoSection } from "@/pages/sync/SyncTipoSection";

function SyncTipoRoute() {
  const { syncId } = useParams();
  if (!syncId) return <Navigate to="/sync/registros" replace />;
  return <SyncTipoSection syncId={syncId} />;
}

export function SyncPage() {
  const metaQuery = useSyncMeta();
  const { ativos, legado } = useMemo(
    () => abasSync(metaQuery.data?.syncs ?? []),
    [metaQuery.data],
  );

  const tabs = useMemo(
    () => [
      { to: "/sync/registros", label: "Registros", end: true },
      ...ativos.map((s) => ({
        to: syncPath(s.id),
        label: rotuloAbaSync(s),
        end: true as const,
      })),
      ...(legado.length > 0
        ? [{ to: "/sync/legado", label: "Legado", end: true as const }]
        : []),
    ],
    [ativos, legado],
  );

  return (
    <PageHeader
      title="Sincronizações"
      description="Uma aba por integração — buscar dados externos, conferir registos e confirmar responsável."
    >
      <PageTabs ariaLabel="Sincronizações" tabs={tabs} />
      <Routes>
        <Route index element={<Navigate to="registros" replace />} />
        <Route path="registros" element={<SyncRegistrosSection />} />
        <Route path="executar" element={<Navigate to="/sync/registros" replace />} />
        <Route path="legado" element={<SyncLegadoSection />} />
        <Route path=":syncId" element={<SyncTipoRoute />} />
        <Route path="*" element={<Navigate to="registros" replace />} />
      </Routes>
    </PageHeader>
  );
}
