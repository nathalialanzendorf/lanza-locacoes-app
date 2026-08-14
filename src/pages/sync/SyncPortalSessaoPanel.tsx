import {
  DetranRsSessaoPanel,
  DetranScSessaoPanel,
  PedagioSessaoPanel,
  SigapaySessaoPanel,
} from "@/pages/relatorios/PortalSessoesSection";
import { CaptureBridgesStatus } from "@/pages/sync/CaptureBridgesStatus";

type Props = {
  syncId: string;
  disabled?: boolean;
};

/** Painel de sessão + bridge na aba do sync correspondente. */
export function SyncPortalSessaoPanel({ syncId, disabled }: Props) {
  switch (syncId) {
    case "pedagios":
      return (
        <section className="form-card">
          <CaptureBridgesStatus only={["pedagio"]} />
          <PedagioSessaoPanel disabled={disabled} />
        </section>
      );
    case "estacionamento":
      return (
        <section className="form-card">
          <CaptureBridgesStatus only={["sigapay"]} />
          <SigapaySessaoPanel disabled={disabled} />
        </section>
      );
    case "infracoes":
      return (
        <section className="form-card">
          <CaptureBridgesStatus only={["detran-sc", "detran-rs"]} />
          <DetranScSessaoPanel disabled={disabled} />
          <DetranRsSessaoPanel disabled={disabled} />
        </section>
      );
    case "ipva-licenciamento":
      return (
        <section className="form-card">
          <CaptureBridgesStatus only={["detran-sc", "detran-rs"]} />
          <DetranScSessaoPanel disabled={disabled} />
          <DetranRsSessaoPanel disabled={disabled} />
        </section>
      );
    case "detran-rs":
      return (
        <section className="form-card">
          <CaptureBridgesStatus only={["detran-rs"]} />
          <DetranRsSessaoPanel disabled={disabled} />
        </section>
      );
    default:
      return null;
  }
}
