import { Link } from "@tanstack/react-router";
import { Droplet, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/use-mutation";
import { useGarden } from "@/hooks/use-snapshot";
import { dueLabel, type PlantCare, plantName, speciesOf } from "@/lib/care";
import { emitCareLogged, slot } from "@/lib/features";
import { logCare } from "@/lib/server-fns";
import { cn } from "@/lib/utils";
import { PlantGlyph } from "./plant-glyph";
import { STATUS_TONE, ThirstRing } from "./thirst-ring";

const EXTRAS = slot("plantCardExtras");

/** Log one watering and tell features about it. */
export function useWater() {
  const { run, pending } = useMutation();
  const water = (plantId: number, name: string) =>
    run(() => logCare({ data: { plantId, kind: "water" } }), {
      success: `${name} watered`,
      onSuccess: (res) => res && emitCareLogged(res),
    });
  return { water, pending };
}

/**
 * A plant as a frosted card: its form glyph, names, where it lives, the thirst ring with when it's next due, and
 * a one-tap water button when it's thirsty. Features can add a strip of extras at the bottom.
 */
export function PlantCard({ care, showSpace = true }: { care: PlantCare; showSpace?: boolean }) {
  const { spaceById } = useGarden();
  const { water, pending } = useWater();
  const { plant } = care;
  const species = speciesOf(plant);
  const space = plant.spaceId ? spaceById.get(plant.spaceId) : undefined;
  const schedule = care.water;
  const thirsty = schedule && schedule.daysLeft <= 0;
  const name = plantName(plant);

  return (
    <div className="glass group relative flex flex-col rounded-3xl p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <PlantGlyph form={species.form} />
        <div className="min-w-0 flex-1">
          <Link
            to="/plants/$id"
            params={{ id: String(plant.id) }}
            className="block truncate font-display text-2xl leading-tight after:absolute after:inset-0 after:rounded-3xl"
          >
            {name}
          </Link>
          <p className="latin truncate text-sm text-muted-foreground">
            {plant.nickname ? species.name : species.latin}
          </p>
        </div>
        {schedule && <ThirstRing schedule={schedule} />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
          {showSpace && (
            <>
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{space?.name ?? "Unplaced"}</span>
            </>
          )}
        </span>
        {schedule && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
              STATUS_TONE[schedule.status].chip,
            )}
          >
            Water {dueLabel(schedule.daysLeft)}
          </span>
        )}
      </div>
      {thirsty && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => water(plant.id, name)}
          className="relative z-10 mt-3 rounded-full bg-water text-white hover:bg-water/90"
        >
          <Droplet className="size-3.5" fill="currentColor" /> Water now
        </Button>
      )}
      {EXTRAS.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 text-xs empty:hidden">
          {EXTRAS.map((Extra, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the extras list is fixed at build time.
            <Extra key={i} {...care} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A responsive grid of plant cards. */
export function PlantGrid({ items, showSpace = true }: { items: PlantCare[]; showSpace?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <PlantCard key={c.plant.id} care={c} showSpace={showSpace} />
      ))}
    </div>
  );
}
