import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, Droplets, MoreHorizontal, PawPrint, Sun, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { CareTimeline, LogCareDialog } from "@/components/canopy/care-dialogs";
import { LightMeter } from "@/components/canopy/light-meter";
import { NotFound } from "@/components/canopy/not-found";
import { SectionTitle } from "@/components/canopy/page-header";
import { useWater } from "@/components/canopy/plant-card";
import { EditPlantDialog } from "@/components/canopy/plant-dialogs";
import { PlantGlyph } from "@/components/canopy/plant-glyph";
import { STATUS_TONE, ThirstRing } from "@/components/canopy/thirst-ring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIFFICULTY, FORMS, HUMIDITY, LIGHTS } from "@/data/species";
import { useMutation } from "@/hooks/use-mutation";
import { useGarden } from "@/hooks/use-snapshot";
import { dueLabel, lightFit, plantName, type Schedule, speciesOf } from "@/lib/care";
import { formatDate, relativeDays, today } from "@/lib/dates";
import { slot } from "@/lib/features";
import { archivePlant, deletePlant, restorePlant } from "@/lib/server-fns";
import { ARCHIVE_REASONS, type ArchiveReason, CARE_KINDS, type Plant } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plants/$id")({
  head: () => ({ meta: [{ title: "Plant · Canopy" }] }),
  component: PlantPage,
});

const SECTIONS = slot("plantSections");

const REASON_LABEL: Record<ArchiveReason, string> = {
  died: "It died",
  rehomed: "Gave it away",
  other: "Something else",
};

function PlantPage() {
  const { id } = Route.useParams();
  const { plantById, scheduleByPlant, spaceById, careByPlant, today: on } = useGarden();
  const plant = plantById.get(Number(id));
  if (!plant) return <NotFound what="plant" />;
  const species = speciesOf(plant);
  const care = scheduleByPlant.get(plant.id);
  const space = plant.spaceId ? spaceById.get(plant.spaceId) : undefined;
  const fit = lightFit(plant, space);
  const events = careByPlant.get(plant.id) ?? [];
  const archived = plant.archivedOn != null;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <PlantGlyph form={species.form} size="lg" className={cn(archived && "grayscale")} />
        <div className="min-w-0 flex-1">
          <p className="kicker mb-1 text-leaf">
            {space ? (
              <Link to="/spaces/$id" params={{ id: String(space.id) }} className="hover:underline">
                {space.name}
              </Link>
            ) : (
              "Not placed"
            )}
            {" · "}
            {FORMS[species.form].label}
          </p>
          <h1 className="font-display text-5xl leading-[1.05] break-words sm:text-6xl">{plantName(plant)}</h1>
          <p className="latin mt-1 text-xl text-muted-foreground">
            {plant.nickname ? `${species.name}, ` : ""}
            <Link to="/species/$id" params={{ id: species.id }} className="hover:underline">
              {species.latin}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <EditPlantDialog plant={plant} />
          <PlantMenu plant={plant} />
        </div>
      </header>

      {archived && <ArchivedBanner plant={plant} />}

      {!archived && (
        <section className="glass grid grid-cols-5 gap-1 rounded-3xl p-2">
          {CARE_KINDS.map((k) => (
            <LogCareDialog key={k} plant={plant} kind={k} />
          ))}
        </section>
      )}

      {care && (
        <section className="grid gap-4 sm:grid-cols-2">
          {care.water && <ScheduleCard plant={plant} schedule={care.water} todayIs={on} />}
          {care.feed ? (
            <ScheduleCard plant={plant} schedule={care.feed} todayIs={on} />
          ) : (
            <div className="glass flex items-center rounded-3xl p-5 text-sm text-muted-foreground">
              {species.name} doesn't need regular feeding. Set an interval with Edit if you'd like to feed it anyway.
            </div>
          )}
        </section>
      )}

      <section className="glass grid gap-6 rounded-3xl p-6 md:grid-cols-[1fr_16rem]">
        <div>
          <SectionTitle>Care guide</SectionTitle>
          <p className="text-lg">{species.tip}</p>
          {fit && (
            <p
              className={cn(
                "mt-4 flex items-start gap-2 rounded-2xl px-3 py-2 text-sm",
                fit.gap === 0 ? "bg-leaf/10 text-leaf" : "bg-sun/15 text-foreground",
              )}
            >
              <Sun className="mt-0.5 size-4 shrink-0 text-sun" /> {fit.message}
            </p>
          )}
          {plant.note && (
            <p className="mt-4 border-l-2 border-leaf/40 pl-3 text-sm text-muted-foreground">{plant.note}</p>
          )}
        </div>
        <dl className="space-y-2.5 text-sm">
          <Fact label="Light">
            <LightMeter light={species.light} label={false} /> {LIGHTS[species.light].label}
          </Fact>
          <Fact label="Humidity">{HUMIDITY[species.humidity].label}</Fact>
          <Fact label="Care level">{DIFFICULTY[species.difficulty].label}</Fact>
          <Fact label="Pets">
            <PawPrint className={cn("size-3.5", species.petSafe ? "text-leaf" : "text-clay")} />
            {species.petSafe ? "Pet-safe" : "Toxic to pets"}
          </Fact>
          <Fact label="With you since">{formatDate(plant.acquiredOn)}</Fact>
        </dl>
      </section>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} plant={plant} />
      ))}

      <section>
        <SectionTitle count={events.length || undefined}>History</SectionTitle>
        <div className="glass rounded-3xl p-3">
          <CareTimeline events={events} plant={plant} todayIs={on} />
        </div>
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium">{children}</dd>
    </div>
  );
}

/** A big ring for one schedule, with when it was last done and when it's due. */
function ScheduleCard({ plant, schedule, todayIs }: { plant: Plant; schedule: Schedule; todayIs: string }) {
  const { water, pending } = useWater();
  const isWater = schedule.kind === "water";
  return (
    <div className="glass flex items-center gap-5 rounded-3xl p-5">
      <ThirstRing schedule={schedule} size={84} />
      <div className="min-w-0 flex-1">
        <p className="kicker text-muted-foreground">{isWater ? "Watering" : "Feeding"}</p>
        <p className={cn("font-display text-3xl leading-tight", STATUS_TONE[schedule.status].text)}>
          {dueLabel(schedule.daysLeft).replace(/^./, (c) => c.toUpperCase())}
        </p>
        <p className="text-sm text-muted-foreground">
          Every {schedule.everyDays} days ·{" "}
          {schedule.last ? `last ${relativeDays(schedule.last, todayIs)}` : "not logged yet"}
        </p>
      </div>
      {isWater && schedule.daysLeft <= 1 && (
        <Button
          disabled={pending}
          onClick={() => water(plant.id, plantName(plant))}
          className="shrink-0 rounded-full bg-water text-white hover:bg-water/90"
        >
          <Droplets className="size-4" /> Water
        </Button>
      )}
    </div>
  );
}

function ArchivedBanner({ plant }: { plant: Plant }) {
  const { run, pending } = useMutation();
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border-2 border-dashed border-foreground/15 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        {plant.archiveReason === "died" ? "Died" : plant.archiveReason === "rehomed" ? "Rehomed" : "Archived"} on{" "}
        {formatDate(plant.archivedOn!)}. Its history is kept, but it's off the schedule.
      </p>
      <Button
        variant="outline"
        disabled={pending}
        className="rounded-full"
        onClick={() => run(() => restorePlant({ data: { id: plant.id } }), { success: "Welcome back" })}
      >
        <Undo2 className="size-4" /> Restore
      </Button>
    </div>
  );
}

/** Archive or delete, behind a menu so they're hard to hit by accident. */
function PlantMenu({ plant }: { plant: Plant }) {
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState<ArchiveReason>("died");
  const [on, setOn] = useState(today());

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl">
          {!plant.archivedOn && (
            <DropdownMenuItem onSelect={() => setArchiving(true)}>
              <Archive className="size-4" /> Archive…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 className="size-4" /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={archiving} onOpenChange={setArchiving}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive {plantName(plant)}?</DialogTitle>
            <DialogDescription>
              It leaves the schedule but keeps its history. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {ARCHIVE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-2xl border p-3 text-sm",
                    reason === r ? "border-leaf bg-leaf/10" : "hover:bg-secondary",
                  )}
                >
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-on">When</Label>
              <Input
                id="a-on"
                type="date"
                min={plant.acquiredOn}
                max={today()}
                value={on}
                onChange={(e) => setOn(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              className="rounded-full"
              onClick={() =>
                run(() => archivePlant({ data: { id: plant.id, reason, on } }), {
                  success: "Archived",
                  onSuccess: () => setArchiving(false),
                })
              }
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plantName(plant)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the plant and all of its care history for good. If it died or moved on, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() =>
                run(() => deletePlant({ data: { id: plant.id } }), {
                  success: "Plant deleted",
                  onSuccess: () => navigate({ to: "/plants" }),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
