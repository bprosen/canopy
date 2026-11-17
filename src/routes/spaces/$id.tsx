import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Sun, Trash2 } from "lucide-react";
import { LightMeter } from "@/components/canopy/light-meter";
import { NotFound } from "@/components/canopy/not-found";
import { EmptyState, PageHeader, SectionTitle } from "@/components/canopy/page-header";
import { PlantGrid } from "@/components/canopy/plant-card";
import { AddPlantDialog } from "@/components/canopy/plant-dialogs";
import { SpaceDialog } from "@/components/canopy/space-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LIGHTS } from "@/data/species";
import { useMutation } from "@/hooks/use-mutation";
import { useGarden } from "@/hooks/use-snapshot";
import { lightFit, plantName, plural } from "@/lib/care";
import { slot } from "@/lib/features";
import { deleteSpace } from "@/lib/server-fns";

export const Route = createFileRoute("/spaces/$id")({
  head: () => ({ meta: [{ title: "Space · Canopy" }] }),
  component: SpacePage,
});

const SECTIONS = slot("spaceSections");

function SpacePage() {
  const { id } = Route.useParams();
  const { spaceById, schedules } = useGarden();
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const space = spaceById.get(Number(id));
  if (!space) return <NotFound what="space" />;
  const here = schedules.filter((c) => c.plant.spaceId === space.id);
  const misfits = here.map((c) => ({ plant: c.plant, fit: lightFit(c.plant, space)! })).filter((m) => m.fit.gap !== 0);

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Space"
        title={space.name}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <LightMeter light={space.light} label={false} /> {LIGHTS[space.light].label} ·{" "}
            {plural(here.length, "plant")}
            {space.note && <span className="w-full text-sm">{space.note}</span>}
          </span>
        }
      >
        <AddPlantDialog
          spaceId={space.id}
          trigger={
            <Button className="rounded-full">
              <Plus className="size-4" /> Add here
            </Button>
          }
        />
        <SpaceDialog space={space} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" disabled={pending} aria-label="Delete space">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {space.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its plants stay in your collection; they just won't be placed anywhere until you move them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full"
                onClick={() =>
                  run(() => deleteSpace({ data: { id: space.id } }), {
                    success: "Space deleted",
                    onSuccess: () => navigate({ to: "/spaces" }),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      {misfits.length > 0 && (
        <section className="rounded-3xl bg-sun/10 p-5">
          <p className="flex items-center gap-2 font-medium">
            <Sun className="size-4 text-sun" /> {plural(misfits.length, "plant would", "plants would")} like different
            light
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {misfits.map((m) => (
              <li key={m.plant.id}>
                <span className="font-medium text-foreground">{plantName(m.plant)}</span>:{" "}
                {m.fit.message.replace(`${space.name} is `, "this space is ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle count={here.length || undefined}>Living here</SectionTitle>
        {here.length === 0 ? <EmptyState title="Nothing here yet" /> : <PlantGrid items={here} showSpace={false} />}
      </section>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} space={space} />
      ))}
    </div>
  );
}
