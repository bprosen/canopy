import { Sun } from "lucide-react";
import { LIGHT_IDS, LIGHTS, type Light } from "@/data/species";
import { cn } from "@/lib/utils";

/** Four little bars, lit up to a light level, with a sun and an optional label. */
export function LightMeter({ light, label = true, className }: { light: Light; label?: boolean; className?: string }) {
  const level = LIGHT_IDS.indexOf(light);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)} title={LIGHTS[light].label}>
      <Sun className="size-3.5 text-sun" />
      <span className="flex items-end gap-0.5" aria-hidden>
        {LIGHT_IDS.map((l, i) => (
          <span
            key={l}
            className={cn("w-1 rounded-full", i <= level ? "bg-sun" : "bg-foreground/15")}
            style={{ height: 5 + i * 2.5 }}
          />
        ))}
      </span>
      {label && <span>{LIGHTS[light].short}</span>}
    </span>
  );
}
