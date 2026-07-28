import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { SyncRegistrosSection } from "@/pages/sync/SyncRegistrosSection";
import { SyncLegadoSection, SyncTipoSection } from "@/pages/sync/SyncTipoSection";

function SyncTipoRoute() {
  const { syncId } = useParams();
  if (!syncId) return <Navigate to="/sync/registros" replace />;
  return <SyncTipoSection syncId={syncId} />;
}

export function SyncPage() {
  return (
    <PageHeader
      title="Sincronizações"
      description="Integrações externas — buscar dados, conferir registos e confirmar responsável."
    >
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
