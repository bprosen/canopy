import { Droplet, NotebookPen, Pencil, Scissors, Shovel, Sprout, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-mutation";
import { CARE, plantName } from "@/lib/care";
import { formatDate, relativeDays, today } from "@/lib/dates";
import { emitCareLogged } from "@/lib/features";
import { deleteCare, logCare, updateCare } from "@/lib/server-fns";
import type { CareEvent, CareKind, Plant } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CARE_ICON: Record<CareKind, typeof Droplet> = {
  water: Droplet,
  feed: Sprout,
  repot: Shovel,
  prune: Scissors,
  note: NotebookPen,
};

export const CARE_TONE: Record<CareKind, string> = {
  water: "bg-water/15 text-water",
  feed: "bg-leaf/15 text-leaf",
  repot: "bg-clay/15 text-clay",
  prune: "bg-sun/20 text-sun",
  note: "bg-secondary text-muted-foreground",
};

/** Log any kind of care for one plant, on any past date, with an optional note. */
export function LogCareDialog({ plant, kind }: { plant: Plant; kind: CareKind }) {
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(today());
  const [note, setNote] = useState("");
  const Icon = CARE_ICON[kind];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setOn(today());
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <span className={cn("grid size-11 place-items-center rounded-full", CARE_TONE[kind])}>
            <Icon className="size-5" />
          </span>
          {CARE[kind].verb}
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {CARE[kind].verb} {plantName(plant)}
          </DialogTitle>
        </DialogHeader>
        <form
          id="log-care"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logCare({ data: { plantId: plant.id, kind, on, note: note || null } }), {
              success: kind === "note" ? "Note added" : `${CARE[kind].past} ${plantName(plant)}`,
              onSuccess: (res) => {
                setOpen(false);
                if (res) emitCareLogged(res);
              },
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-on">When</Label>
            <Input
              id="c-on"
              type="date"
              required
              min={plant.acquiredOn}
              max={today()}
              value={on}
              onChange={(e) => setOn(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-note">{kind === "note" ? "Note" : "Note (optional)"}</Label>
            <Textarea
              id="c-note"
              rows={3}
              maxLength={1000}
              required={kind === "note"}
              placeholder={kind === "note" ? "New leaf unfurling, some yellowing…" : "Anything worth remembering"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="log-care" disabled={pending} className="rounded-full">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fix the date or note of a past entry, or delete it. */
function EditCareDialog({ event, plant }: { event: CareEvent; plant: Plant }) {
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(event.on);
  const [note, setNote] = useState(event.note ?? "");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setOn(event.on);
          setNote(event.note ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Edit entry">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {CARE[event.kind].label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form
          id="edit-care"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateCare({ data: { id: event.id, on, note: note || null } }), {
              success: "Saved",
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ec-on">When</Label>
            <Input
              id="ec-on"
              type="date"
              required
              min={plant.acquiredOn}
              max={today()}
              value={on}
              onChange={(e) => setOn(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-note">Note</Label>
            <Textarea
              id="ec-note"
              rows={3}
              maxLength={1000}
              required={event.kind === "note"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </form>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="rounded-full text-destructive"
            disabled={pending}
            onClick={() =>
              run(() => deleteCare({ data: { id: event.id } }), {
                success: "Entry deleted",
                onSuccess: () => setOpen(false),
              })
            }
          >
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button type="submit" form="edit-care" disabled={pending} className="rounded-full">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A plant's care history as a vertical vine: newest first, each entry editable. */
export function CareTimeline({ events, plant, todayIs }: { events: CareEvent[]; plant: Plant; todayIs: string }) {
  if (events.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nothing logged yet. Water it and it'll show up here.
      </p>
    );
  return (
    <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[1.35rem] before:w-px before:bg-leaf/30">
      {events.map((e) => {
        const Icon = CARE_ICON[e.kind];
        return (
          <li key={e.id} className="relative flex items-start gap-3 rounded-2xl px-1 py-1.5 hover:bg-secondary/50">
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-card",
                CARE_TONE[e.kind],
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm">
                <span className="font-medium">{CARE[e.kind].past}</span>{" "}
                <span className="text-muted-foreground">
                  · {formatDate(e.on)} · {relativeDays(e.on, todayIs)}
                </span>
              </p>
              {e.note && <p className="mt-0.5 text-sm text-muted-foreground">{e.note}</p>}
            </div>
            <EditCareDialog event={e} plant={plant} />
          </li>
        );
      })}
    </ol>
  );
}
