import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplet, Droplets, Leaf, PawPrint, Sprout } from "lucide-react";
import { useMemo } from "react";
import { CARE_ICON, CARE_TONE } from "@/components/canopy/care-dialogs";
import { EmptyState, PageHeader, SectionTitle } from "@/components/canopy/page-header";
import { useWater } from "@/components/canopy/plant-card";
import { AddPlantDialog } from "@/components/canopy/plant-dialogs";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { STATUS_TONE } from "@/components/canopy/thirst-ring";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/use-mutation";
import { useGarden } from "@/hooks/use-snapshot";
import { type DueItem, dueLabel, dueNow, plantName, plural, speciesOf, summarize, upcoming } from "@/lib/care";
import { monthDay, weekdayLong, weekdayShort } from "@/lib/dates";
import { emitCareLogged, slot } from "@/lib/features";
import { logCare, logCareBulk } from "@/lib/server-fns";
import type { ScheduledKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: TodayPage,
});

const WIDGETS = slot("homeWidgets");

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function TodayPage() {
  const { snapshot, settings, schedules, today, spaceById } = useGarden();
  const { run, pending } = useMutation();
  const due = useMemo(() => dueNow(schedules), [schedules]);
  const week = useMemo(() => upcoming(schedules, 7, today), [schedules, today]);
  const summary = useMemo(() => summarize(snapshot, today), [snapshot, today]);
  const thirsty = due.filter((d) => d.schedule.kind === "water");
  const hungry = due.filter((d) => d.schedule.kind === "feed");

  const bulk = (kind: ScheduledKind, items: DueItem[]) =>
    run(() => logCareBulk({ data: { plantIds: items.map((d) => d.plant.id), kind } }), {
      success: `${kind === "water" ? "Watered" : "Fed"} ${plural(items.length, "plant")}`,
      onSuccess: (res) => res && emitCareLogged(res),
    });

  if (snapshot.plants.length === 0) {
    return (
      <div>
        <PageHeader
          kicker={`${weekdayLong(today)}, ${monthDay(today)}`}
          title={`${greeting(new Date().getHours())}, ${settings.displayName}`}
        />
        <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
          <PlantGlyph form="foliage" size="lg" />
          <p className="font-display text-4xl">Your greenhouse is empty</p>
          <p className="max-w-md text-muted-foreground">
            Add your first plant and Canopy will work out when it needs water and food. Or load a sample collection to
            look around, and reset it later from Settings.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <AddPlantDialog />
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/settings">Load sample data</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <PageHeader
        kicker={`${weekdayLong(today)}, ${monthDay(today)}`}
        title={`${greeting(new Date().getHours())}, ${settings.displayName}`}
        meta={
          thirsty.length === 0
            ? "Everyone has had a drink. Enjoy the green."
            : `${plural(thirsty.length, "plant is", "plants are")} thirsty${summary.overdue ? `, ${summary.overdue} overdue` : ""}.`
        }
      >
        {thirsty.length > 1 && (
          <Button
            disabled={pending}
            onClick={() => bulk("water", thirsty)}
            className="rounded-full bg-water text-white hover:bg-water/90"
          >
            <Droplets className="size-4" /> Water all {thirsty.length}
          </Button>
        )}
      </PageHeader>

      <section className="flex flex-wrap gap-2 text-sm">
        <Chip icon={Leaf} tone="bg-leaf/15 text-leaf">
          {plural(summary.active, "plant")}
        </Chip>
        <Chip icon={Droplet} tone="bg-water/15 text-water">
          {plural(summary.wateredThisWeek, "watering")} this week
        </Chip>
        {summary.hungry > 0 && (
          <Chip icon={Sprout} tone="bg-sun/20 text-sun">
            {summary.hungry} ready to feed
          </Chip>
        )}
        {summary.petUnsafe > 0 && (
          <Chip icon={PawPrint} tone="bg-clay/15 text-clay">
            {summary.petUnsafe} not pet-safe
          </Chip>
        )}
      </section>

      <section>
        <SectionTitle count={due.length || undefined}>Needs you today</SectionTitle>
        {due.length === 0 ? (
          <EmptyState title="All caught up">Nothing needs water or food today.</EmptyState>
        ) : (
          <div className="glass divide-y divide-foreground/5 overflow-hidden rounded-3xl">
            {due.map((d) => (
              <DueRow
                key={`${d.plant.id}-${d.schedule.kind}`}
                item={d}
                spaceName={d.plant.spaceId ? spaceById.get(d.plant.spaceId)?.name : undefined}
              />
            ))}
          </div>
        )}
        {hungry.length > 1 && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" disabled={pending} onClick={() => bulk("feed", hungry)} className="rounded-full">
              <Sprout className="size-4" /> Feed all {hungry.length}
            </Button>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>The week ahead</SectionTitle>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {week.map((day, i) => (
            <div
              key={day.date}
              className={cn(
                "flex min-h-36 flex-col rounded-2xl p-2 sm:p-3",
                i === 0 ? "bg-primary text-primary-foreground" : "glass",
              )}
            >
              <p className={cn("kicker", i === 0 ? "opacity-80" : "text-muted-foreground")}>
                {i === 0 ? "Today" : weekdayShort(day.date)}
              </p>
              <p className="font-display text-3xl leading-none">{Number(day.date.slice(8))}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {day.items.slice(0, 4).map((it) => {
                  const Icon = CARE_ICON[it.schedule.kind];
                  return (
                    <li
                      key={`${it.plant.id}-${it.schedule.kind}`}
                      className="flex min-w-0 items-center gap-1 text-[11px] leading-tight"
                      title={`${plantName(it.plant)}: ${it.schedule.kind}`}
                    >
                      <Icon
                        className={cn(
                          "size-3 shrink-0",
                          i === 0 ? "" : it.schedule.kind === "water" ? "text-water" : "text-leaf",
                        )}
                      />
                      <span className="hidden truncate sm:inline">{plantName(it.plant)}</span>
                    </li>
                  );
                })}
                {day.items.length > 4 && <li className="text-[11px] opacity-70">+{day.items.length - 4}</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {WIDGETS.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2">
          {WIDGETS.map((Widget, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the widget list is fixed at build time.
            <Widget key={i} />
          ))}
        </section>
      )}
    </div>
  );
}

function Chip({ icon: Icon, tone, children }: { icon: typeof Leaf; tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium", tone)}>
      <Icon className="size-4" />
      {children}
    </span>
  );
}

/** One thing to do today: which plant, where, what and how late, with a button to do it. */
function DueRow({ item, spaceName }: { item: DueItem; spaceName?: string }) {
  const { water, pending: watering } = useWater();
  const { run, pending: feeding } = useMutation();
  const { plant, schedule } = item;
  const species = speciesOf(plant);
  const name = plantName(plant);
  const Icon = CARE_ICON[schedule.kind];
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <PlantGlyph form={species.form} size="sm" />
      <div className="min-w-0 flex-1">
        <Link to="/plants/$id" params={{ id: String(plant.id) }} className="block truncate font-medium hover:underline">
          {name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {spaceName ?? "Unplaced"} · every {schedule.everyDays} days
        </p>
      </div>
      <span
        className={cn(
          "hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline",
          STATUS_TONE[schedule.status].chip,
        )}
      >
        {schedule.kind === "water" ? "Water" : "Feed"} {dueLabel(schedule.daysLeft)}
      </span>
      <Button
        size="sm"
        disabled={watering || feeding}
        onClick={() =>
          schedule.kind === "water"
            ? water(plant.id, name)
            : run(() => logCare({ data: { plantId: plant.id, kind: "feed" } }), {
                success: `Fed ${name}`,
                onSuccess: (res) => res && emitCareLogged(res),
              })
        }
        className={cn(
          "rounded-full",
          schedule.kind === "water" ? "bg-water text-white hover:bg-water/90" : CARE_TONE.feed,
        )}
      >
        <Icon className="size-3.5" /> {schedule.kind === "water" ? "Water" : "Feed"}
      </Button>
    </div>
  );
}
