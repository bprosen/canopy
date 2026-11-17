import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Droplet } from "lucide-react";
import { LightMeter } from "@/components/canopy/light-meter";
import { EmptyState, PageHeader } from "@/components/canopy/page-header";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { SpaceDialog } from "@/components/canopy/space-dialog";
import { LIGHTS } from "@/data/species";
import { useGarden } from "@/hooks/use-snapshot";
import { lightFit, type PlantCare, plural, speciesOf } from "@/lib/care";

export const Route = createFileRoute("/spaces/")({
  head: () => ({ meta: [{ title: "Spaces · Canopy" }] }),
  component: SpacesPage,
});

function SpacesPage() {
  const { snapshot, schedules } = useGarden();
  const bySpace = new Map<number | null, PlantCare[]>();
  for (const c of schedules) {
    const list = bySpace.get(c.plant.spaceId) ?? [];
    list.push(c);
    bySpace.set(c.plant.spaceId, list);
  }
  const unplaced = bySpace.get(null) ?? [];

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Around the home"
        title="Spaces"
        meta="The rooms and spots your plants live in. Each space's light is checked against what its plants want."
      >
        <SpaceDialog />
      </PageHeader>

      {snapshot.spaces.length === 0 ? (
        <EmptyState title="No spaces yet">Add a room or windowsill to start placing plants.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {snapshot.spaces.map((s) => {
            const plants = bySpace.get(s.id) ?? [];
            const thirsty = plants.filter((c) => c.water && c.water.daysLeft <= 0).length;
            const misfits = plants.filter((c) => (lightFit(c.plant, s)?.gap ?? 0) !== 0).length;
            return (
              <Link
                key={s.id}
                to="/spaces/$id"
                params={{ id: String(s.id) }}
                className="glass group flex flex-col rounded-3xl p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-4xl leading-tight">{s.name}</h2>
                    <LightMeter light={s.light} label={false} className="mt-1" />
                    <span className="ml-1.5 text-sm text-muted-foreground">{LIGHTS[s.light].label}</span>
                  </div>
                  <ChevronRight className="mt-2 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-5 flex -space-x-2">
                  {plants.slice(0, 7).map((c) => (
                    <PlantGlyph
                      key={c.plant.id}
                      form={speciesOf(c.plant).form}
                      size="sm"
                      className="ring-4 ring-card"
                    />
                  ))}
                  {plants.length > 7 && (
                    <span className="grid size-9 place-items-center rounded-xl bg-secondary text-xs font-medium ring-4 ring-card">
                      +{plants.length - 7}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{plural(plants.length, "plant")}</span>
                  {thirsty > 0 && (
                    <span className="flex items-center gap-1 text-water">
                      <Droplet className="size-3.5" fill="currentColor" /> {thirsty} thirsty
                    </span>
                  )}
                  {misfits > 0 && (
                    <span className="text-sun">{plural(misfits, "light mismatch", "light mismatches")}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {unplaced.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {plural(unplaced.length, "plant isn't", "plants aren't")} placed in a space yet.{" "}
          <Link to="/plants" search={{ space: "none" }} className="font-medium text-foreground underline">
            See them
          </Link>
        </p>
      )}
    </div>
  );
}
