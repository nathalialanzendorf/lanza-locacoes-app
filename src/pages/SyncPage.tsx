import { Navigate, Route, Routes } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PageTabs } from "@/components/PageTabs";
import { SyncExecutarSection } from "@/pages/sync/SyncExecutarSection";
import { SyncRegistrosSection } from "@/pages/sync/SyncRegistrosSection";

export function SyncPage() {
  return (
    <PageHeader
      title="Sincronizações"
      description="Buscar dados externos por placa ou frota inteira; conferir registos e confirmar responsável (cliente ou parceiro)."
    >
      <PageTabs
        ariaLabel="Sincronizações"
        tabs={[
          { to: "/sync/registros", label: "Sync Registros", end: true },
          { to: "/sync/executar", label: "Executar syncs" },
        ]}
      />
      <Routes>
        <Route index element={<Navigate to="registros" replace />} />
        <Route path="registros" element={<SyncRegistrosSection />} />
        <Route path="executar" element={<SyncExecutarSection />} />
        <Route path="*" element={<Navigate to="registros" replace />} />
      </Routes>
    </PageHeader>
  );
}
