import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { EmptyState, PageHeader, SectionTitle } from "@/components/canopy/page-header";
import { PlantGrid } from "@/components/canopy/plant-card";
import { AddPlantDialog } from "@/components/canopy/plant-dialogs";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { Input } from "@/components/ui/input";
import { useGarden } from "@/hooks/use-snapshot";
import { type CareStatus, isActive, plantName, plural, speciesOf } from "@/lib/care";
import { formatDate } from "@/lib/dates";
import { matches } from "@/lib/search";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "thirsty", "soon", "happy"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { all: "All", thirsty: "Thirsty", soon: "Soon", happy: "Happy" };
const MATCHES: Record<Filter, (s: CareStatus | undefined) => boolean> = {
  all: () => true,
  thirsty: (s) => s === "overdue" || s === "due",
  soon: (s) => s === "soon",
  happy: (s) => s === "ok",
};

type PlantSearch = { q?: string; space?: number | "none"; show?: Filter; sort?: "name" | "due" };

export const Route = createFileRoute("/plants/")({
  head: () => ({ meta: [{ title: "Plants · Canopy" }] }),
  validateSearch: (s: Record<string, unknown>): PlantSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    space:
      s.space === "none"
        ? "none"
        : Number.isInteger(Number(s.space)) && Number(s.space) > 0
          ? Number(s.space)
          : undefined,
    show: FILTERS.includes(s.show as Filter) && s.show !== "all" ? (s.show as Filter) : undefined,
    sort: s.sort === "due" ? "due" : undefined,
  }),
  component: PlantsPage,
});

function PlantsPage() {
  const { snapshot, schedules } = useGarden();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = (patch: Partial<PlantSearch>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
  const show = search.show ?? "all";

  const shown = useMemo(() => {
    const list = schedules.filter(({ plant, water }) => {
      const s = speciesOf(plant);
      return (
        (search.space == null || (search.space === "none" ? plant.spaceId == null : plant.spaceId === search.space)) &&
        MATCHES[show](water?.status) &&
        matches(`${plantName(plant)} ${s.name} ${s.latin} ${plant.note ?? ""}`, search.q ?? "")
      );
    });
    return search.sort === "due"
      ? [...list].sort((a, b) => (a.water?.daysLeft ?? 999) - (b.water?.daysLeft ?? 999))
      : list;
  }, [schedules, search, show]);
  const archived = snapshot.plants.filter((p) => !isActive(p));
  const active = schedules.length;

  const pill = (on: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
      on ? "bg-primary text-primary-foreground" : "glass hover:bg-secondary",
    );

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Collection"
        title="Your plants"
        meta={
          active
            ? `${plural(active, "plant")} growing${archived.length ? `, ${archived.length} archived` : ""}.`
            : "Nothing growing yet."
        }
      >
        <AddPlantDialog />
      </PageHeader>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Search by name or species…"
              className="glass h-10 rounded-full pl-10"
              aria-label="Search plants"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => set({ show: f === "all" ? undefined : f })}
                className={pill(show === f)}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set({ sort: search.sort === "due" ? undefined : "due" })}
              className={pill(search.sort === "due")}
              aria-pressed={search.sort === "due"}
            >
              Most thirsty first
            </button>
          </div>
        </div>
        {snapshot.spaces.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => set({ space: undefined })} className={pill(search.space == null)}>
              Everywhere
            </button>
            {snapshot.spaces.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => set({ space: search.space === s.id ? undefined : s.id })}
                className={pill(search.space === s.id)}
              >
                {s.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set({ space: search.space === "none" ? undefined : "none" })}
              className={pill(search.space === "none")}
            >
              Unplaced
            </button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={active === 0 ? "No plants yet" : "No plants match"}>
          {active === 0 ? "Add one with the + in the dock." : "Try clearing a filter."}
        </EmptyState>
      ) : (
        <PlantGrid items={shown} />
      )}

      {archived.length > 0 && (
        <section>
          <SectionTitle count={archived.length}>Archived</SectionTitle>
          <ul className="glass divide-y divide-foreground/5 overflow-hidden rounded-3xl">
            {archived.map((p) => (
              <li key={p.id}>
                <Link
                  to="/plants/$id"
                  params={{ id: String(p.id) }}
                  className="flex items-center gap-3 px-4 py-3 opacity-80 transition-opacity hover:opacity-100"
                >
                  <PlantGlyph form={speciesOf(p).form} size="sm" className="grayscale" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{plantName(p)}</span>
                    <span className="latin block truncate text-xs text-muted-foreground">{speciesOf(p).latin}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.archiveReason === "died" ? "Died" : p.archiveReason === "rehomed" ? "Rehomed" : "Archived"}{" "}
                    {formatDate(p.archivedOn!)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
