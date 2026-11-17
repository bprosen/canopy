import { useNavigate } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSpecies } from "@/data/species";
import { useMutation } from "@/hooks/use-mutation";
import { useGarden } from "@/hooks/use-snapshot";
import { today } from "@/lib/dates";
import { addPlant, type PlantFields, updatePlant } from "@/lib/server-fns";
import type { Plant } from "@/lib/types";
import { SpeciesPicker } from "./species-picker";

type Draft = {
  speciesId: string | null;
  nickname: string;
  spaceId: string;
  acquiredOn: string;
  water: string;
  feed: string;
  note: string;
};

const NONE = "none";

function toFields(d: Draft): PlantFields {
  const n = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    nickname: d.nickname || null,
    spaceId: d.spaceId === NONE ? null : Number(d.spaceId),
    acquiredOn: d.acquiredOn,
    waterEveryDays: n(d.water),
    feedEveryDays: n(d.feed),
    note: d.note || null,
  };
}

/** The fields shared by "add" and "edit". The species can only be chosen when adding. */
function PlantFormFields({
  draft,
  set,
  chooseSpecies,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  chooseSpecies: boolean;
}) {
  const { snapshot } = useGarden();
  const species = draft.speciesId ? getSpecies(draft.speciesId) : undefined;
  return (
    <div className="space-y-4">
      {chooseSpecies && (
        <div className="space-y-1.5">
          <Label>Species</Label>
          <SpeciesPicker value={draft.speciesId} onChange={(id) => set({ speciesId: id })} className="w-full" />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-nick">Nickname</Label>
          <Input
            id="p-nick"
            maxLength={60}
            placeholder={species?.name ?? "Optional"}
            value={draft.nickname}
            onChange={(e) => set({ nickname: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-space">Space</Label>
          <Select value={draft.spaceId} onValueChange={(v) => set({ spaceId: v })}>
            <SelectTrigger id="p-space" className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not placed yet</SelectItem>
              {snapshot.spaces.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-date">Joined</Label>
          <Input
            id="p-date"
            type="date"
            required
            max={today()}
            value={draft.acquiredOn}
            onChange={(e) => set({ acquiredOn: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-water">Water every</Label>
          <Input
            id="p-water"
            type="number"
            min={1}
            max={365}
            placeholder={species ? `${species.waterDays} days` : "days"}
            value={draft.water}
            onChange={(e) => set({ water: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-feed">Feed every</Label>
          <Input
            id="p-feed"
            type="number"
            min={1}
            max={365}
            placeholder={species ? (species.feedDays ? `${species.feedDays} days` : "never") : "days"}
            value={draft.feed}
            onChange={(e) => set({ feed: e.target.value })}
            className="rounded-xl"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Leave the intervals blank to use the species' usual schedule.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="p-note">Note</Label>
        <Textarea
          id="p-note"
          rows={2}
          maxLength={1000}
          placeholder="Where you got it, pot size, quirks…"
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          className="rounded-xl"
        />
      </div>
    </div>
  );
}

const blank = (spaceId?: number, speciesId?: string): Draft => ({
  speciesId: speciesId ?? null,
  nickname: "",
  spaceId: spaceId ? String(spaceId) : NONE,
  acquiredOn: today(),
  water: "",
  feed: "",
  note: "",
});

/**
 * "Add plant": pick a species and optional details, then go to the new plant. `trigger` replaces the default
 * button and must be a single element that accepts a ref.
 */
export function AddPlantDialog({
  trigger,
  spaceId,
  speciesId,
}: {
  trigger?: ReactElement;
  /** Start with this space chosen. */
  spaceId?: number;
  /** Start with this species chosen. */
  speciesId?: string;
}) {
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blank(spaceId, speciesId));
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(blank(spaceId, speciesId));
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="rounded-full">
            <Plus className="size-4" /> Add plant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>A new plant</DialogTitle>
          <DialogDescription>Its watering schedule starts from the day it joined.</DialogDescription>
        </DialogHeader>
        <form
          id="add-plant"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.speciesId) return;
            run(() => addPlant({ data: { speciesId: draft.speciesId!, ...toFields(draft) } }), {
              success: "Welcome to the collection",
              onSuccess: (p) => {
                setOpen(false);
                if (p) navigate({ to: "/plants/$id", params: { id: String(p.id) } });
              },
            });
          }}
        >
          <PlantFormFields draft={draft} set={set} chooseSpecies />
        </form>
        <DialogFooter>
          <Button type="submit" form="add-plant" disabled={pending || !draft.speciesId} className="rounded-full">
            Add to collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit a plant's nickname, space, dates, intervals and note. */
export function EditPlantDialog({ plant }: { plant: Plant }) {
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const fromPlant = (): Draft => ({
    speciesId: plant.speciesId,
    nickname: plant.nickname ?? "",
    spaceId: plant.spaceId ? String(plant.spaceId) : NONE,
    acquiredOn: plant.acquiredOn,
    water: plant.waterEveryDays == null ? "" : String(plant.waterEveryDays),
    feed: plant.feedEveryDays == null ? "" : String(plant.feedEveryDays),
    note: plant.note ?? "",
  });
  const [draft, setDraft] = useState<Draft>(fromPlant);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(fromPlant());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <Pencil className="size-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit plant</DialogTitle>
        </DialogHeader>
        <form
          id="edit-plant"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updatePlant({ data: { id: plant.id, ...toFields(draft) } }), {
              success: "Saved",
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <PlantFormFields draft={draft} set={set} chooseSpecies={false} />
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-plant" disabled={pending} className="rounded-full">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
