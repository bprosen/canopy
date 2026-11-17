import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { LIGHT_IDS, LIGHTS, type Light } from "@/data/species";
import { useMutation } from "@/hooks/use-mutation";
import { createSpace, updateSpace } from "@/lib/server-fns";
import type { Space } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LightMeter } from "./light-meter";

/** Create a space, or edit one when `space` is given. */
export function SpaceDialog({ space }: { space?: Space }) {
  const { run, pending } = useMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(space?.name ?? "");
  const [light, setLight] = useState<Light>(space?.light ?? "medium");
  const [note, setNote] = useState(space?.note ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(space?.name ?? "");
          setLight(space?.light ?? "medium");
          setNote(space?.note ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        {space ? (
          <Button variant="outline" className="rounded-full">
            <Pencil className="size-4" /> Edit
          </Button>
        ) : (
          <Button className="rounded-full">
            <Plus className="size-4" /> New space
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{space ? "Edit space" : "A new space"}</DialogTitle>
          <DialogDescription>
            A room or spot your plants live in. Its light is checked against each plant.
          </DialogDescription>
        </DialogHeader>
        <form
          id="space-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = { name, light, note: note || null };
            run(() => (space ? updateSpace({ data: { id: space.id, ...data } }) : createSpace({ data })), {
              success: space ? "Saved" : "Space added",
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              required
              maxLength={60}
              placeholder="Living room, Kitchen sill…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Light</legend>
            <div className="grid grid-cols-2 gap-2">
              {LIGHT_IDS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={light === l}
                  onClick={() => setLight(l)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    light === l ? "border-leaf bg-leaf/10" : "hover:bg-secondary",
                  )}
                >
                  <LightMeter light={l} label={false} />
                  <span className="mt-1.5 block text-sm font-medium">{LIGHTS[l].label}</span>
                  <span className="block text-xs text-muted-foreground">{LIGHTS[l].hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="s-note">Note</Label>
            <Textarea
              id="s-note"
              rows={2}
              maxLength={500}
              placeholder="Window direction, drafts, humidity…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="space-form" disabled={pending} className="rounded-full">
            {space ? "Save" : "Add space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
