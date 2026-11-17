import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Droplet, PawPrint, Search } from "lucide-react";
import { useMemo } from "react";
import { LightMeter } from "@/components/canopy/light-meter";
import { EmptyState, PageHeader } from "@/components/canopy/page-header";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { matchesSpecies } from "@/components/canopy/species-picker";
import { Input } from "@/components/ui/input";
import { FORM_IDS, FORMS, type Form, LIGHT_IDS, LIGHTS, type Light, SPECIES } from "@/data/species";
import { useGarden } from "@/hooks/use-snapshot";
import { isActive } from "@/lib/care";
import { cn } from "@/lib/utils";

type CatalogSearch = { q?: string; form?: Form; light?: Light; pets?: boolean; easy?: boolean };

export const Route = createFileRoute("/species/")({
  head: () => ({ meta: [{ title: "Species · Canopy" }] }),
  validateSearch: (s: Record<string, unknown>): CatalogSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    form: FORM_IDS.includes(s.form as Form) ? (s.form as Form) : undefined,
    light: LIGHT_IDS.includes(s.light as Light) ? (s.light as Light) : undefined,
    pets: s.pets === true || s.pets === "true" ? true : undefined,
    easy: s.easy === true || s.easy === "true" ? true : undefined,
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { snapshot } = useGarden();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = (patch: Partial<CatalogSearch>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  const owned = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of snapshot.plants) if (isActive(p)) out.set(p.speciesId, (out.get(p.speciesId) ?? 0) + 1);
    return out;
  }, [snapshot.plants]);

  const shown = SPECIES.filter(
    (s) =>
      (!search.form || s.form === search.form) &&
      (!search.light || s.light === search.light) &&
      (!search.pets || s.petSafe) &&
      (!search.easy || s.difficulty === "easy") &&
      matchesSpecies(s, search.q ?? ""),
  );

  const pill = (on: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
      on ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary",
    );

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Field guide"
        title="Species"
        meta={`${SPECIES.length} plants with care notes. Filter by what suits your home.`}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Common or Latin name…"
              className="glass h-10 rounded-full pl-10"
              aria-label="Search species"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              aria-pressed={!!search.pets}
              onClick={() => set({ pets: search.pets ? undefined : true })}
              className={pill(!!search.pets)}
            >
              <PawPrint className="mr-1 inline size-3.5" /> Pet-safe
            </button>
            <button
              type="button"
              aria-pressed={!!search.easy}
              onClick={() => set({ easy: search.easy ? undefined : true })}
              className={pill(!!search.easy)}
            >
              Easy care
            </button>
            {LIGHT_IDS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => set({ light: search.light === l ? undefined : l })}
                className={pill(search.light === l)}
              >
                {LIGHTS[l].short} light
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" onClick={() => set({ form: undefined })} className={pill(!search.form)}>
            All forms
          </button>
          {FORM_IDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set({ form: search.form === f ? undefined : f })}
              className={pill(search.form === f)}
            >
              {FORMS[f].label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No species match">Try clearing a filter.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const mine = owned.get(s.id);
            return (
              <Link
                key={s.id}
                to="/species/$id"
                params={{ id: s.id }}
                className="glass group flex gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
              >
                <PlantGlyph form={s.form} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xl leading-tight">{s.name}</p>
                  <p className="latin truncate text-sm text-muted-foreground">{s.latin}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <LightMeter light={s.light} />
                    <span className="flex items-center gap-1">
                      <Droplet className="size-3.5 text-water" /> {s.waterDays}d
                    </span>
                    {s.petSafe && <PawPrint className="size-3.5 text-leaf" aria-label="Pet-safe" />}
                    {mine && (
                      <span className="rounded-full bg-leaf/15 px-2 py-0.5 font-medium text-leaf">You have {mine}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
