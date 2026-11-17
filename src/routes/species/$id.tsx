import { createFileRoute } from "@tanstack/react-router";
import { Droplet, PawPrint, Plus, Sprout, Sun, Waves } from "lucide-react";
import { LightMeter } from "@/components/canopy/light-meter";
import { NotFound } from "@/components/canopy/not-found";
import { SectionTitle } from "@/components/canopy/page-header";
import { PlantGrid } from "@/components/canopy/plant-card";
import { AddPlantDialog } from "@/components/canopy/plant-dialogs";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { Button } from "@/components/ui/button";
import { DIFFICULTY, FORMS, getSpecies, HUMIDITY, LIGHTS } from "@/data/species";
import { useGarden } from "@/hooks/use-snapshot";
import { slot } from "@/lib/features";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/species/$id")({
  head: () => ({ meta: [{ title: "Species · Canopy" }] }),
  component: SpeciesPage,
});

const SECTIONS = slot("speciesSections");

function SpeciesPage() {
  const { id } = Route.useParams();
  const { schedules } = useGarden();
  const species = getSpecies(id);
  if (!species) return <NotFound what="species" />;
  const mine = schedules.filter((c) => c.plant.speciesId === species.id);

  const facts = [
    {
      icon: Sun,
      tone: "bg-sun/20 text-sun",
      label: "Light",
      value: (
        <>
          <LightMeter light={species.light} label={false} /> {LIGHTS[species.light].label}
        </>
      ),
      hint: LIGHTS[species.light].hint,
    },
    {
      icon: Droplet,
      tone: "bg-water/15 text-water",
      label: "Water",
      value: `Every ${species.waterDays} days`,
      hint: "A typical indoor interval",
    },
    {
      icon: Sprout,
      tone: "bg-leaf/15 text-leaf",
      label: "Feed",
      value: species.feedDays ? `Every ${species.feedDays} days` : "Rarely",
      hint: "In spring and summer",
    },
    {
      icon: Waves,
      tone: "bg-water/15 text-water",
      label: "Humidity",
      value: HUMIDITY[species.humidity].label,
      hint: species.humidity === "high" ? "A bathroom or pebble tray helps" : "Normal room air is fine",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <PlantGlyph form={species.form} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="kicker mb-1 text-leaf">
            {FORMS[species.form].label} · {species.family}
          </p>
          <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">{species.name}</h1>
          <p className="latin mt-1 text-xl text-muted-foreground">{species.latin}</p>
        </div>
        <AddPlantDialog
          speciesId={species.id}
          trigger={
            <Button className="rounded-full">
              <Plus className="size-4" /> Add one
            </Button>
          }
        />
      </header>

      <p className="font-display text-3xl leading-snug">“{species.tip}”</p>

      <section className="grid gap-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className="glass flex items-center gap-4 rounded-3xl p-4">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", f.tone)}>
              <f.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="kicker text-muted-foreground">{f.label}</p>
              <p className="flex items-center gap-1.5 font-medium">{f.value}</p>
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium",
            species.petSafe ? "bg-leaf/15 text-leaf" : "bg-clay/15 text-clay",
          )}
        >
          <PawPrint className="size-4" /> {species.petSafe ? "Safe for cats and dogs" : "Toxic to cats and dogs"}
        </span>
        <span className="glass inline-flex items-center rounded-full px-3 py-1.5 font-medium">
          {DIFFICULTY[species.difficulty].label} to care for
        </span>
      </section>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} species={species} />
      ))}

      <section>
        <SectionTitle count={mine.length || undefined}>Yours</SectionTitle>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">You don't have one of these yet.</p>
        ) : (
          <PlantGrid items={mine} />
        )}
      </section>
    </div>
  );
}
