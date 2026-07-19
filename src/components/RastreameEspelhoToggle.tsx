import { Toggle } from "@/components/Toggle";
import { useRastreameEspelho } from "@/hooks/useRastreameEspelho";

export function RastreameEspelhoToggle() {
  const { config } = useRastreameEspelho();

  if (!config) return null;

  return (
    <div className="rastreame-espelho rastreame-espelho--deprecated">
      <Toggle
        checked={false}
        onChange={() => {}}
        disabled
        label="Rastreame (descontinuado)"
        aria-label="Integração Rastreame descontinuada"
      />
      <span className="rastreame-espelho__hint">só Lanza</span>
    </div>
  );
}
