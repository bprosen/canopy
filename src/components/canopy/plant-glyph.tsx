import { Flower2, Leaf, type LucideIcon, Sprout, TreeDeciduous, TreePalm, Trees, Vegan, Wheat } from "lucide-react";
import type { Form } from "@/data/species";
import { cn } from "@/lib/utils";

const GLYPH: Record<Form, { icon: LucideIcon; tone: string }> = {
  foliage: { icon: Leaf, tone: "bg-leaf/15 text-leaf" },
  flowering: { icon: Flower2, tone: "bg-clay/15 text-clay" },
  succulent: { icon: Vegan, tone: "bg-sun/20 text-sun" },
  cactus: { icon: Wheat, tone: "bg-sun/20 text-sun" },
  fern: { icon: Sprout, tone: "bg-leaf/15 text-leaf" },
  palm: { icon: TreePalm, tone: "bg-water/15 text-water" },
  tree: { icon: TreeDeciduous, tone: "bg-leaf/15 text-leaf" },
  vine: { icon: Trees, tone: "bg-water/15 text-water" },
  herb: { icon: Sprout, tone: "bg-sun/20 text-sun" },
};

/** A soft rounded tile with an icon for a plant's growth form. Stands in for a photo. */
export function PlantGlyph({
  form,
  className,
  size = "md",
}: {
  form: Form;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { icon: Icon, tone } = GLYPH[form];
  const box = size === "sm" ? "size-9 rounded-xl" : size === "lg" ? "size-20 rounded-3xl" : "size-12 rounded-2xl";
  const ico = size === "sm" ? "size-4" : size === "lg" ? "size-9" : "size-5";
  return (
    <span className={cn("grid shrink-0 place-items-center", box, tone, className)} aria-hidden>
      <Icon className={ico} strokeWidth={1.75} />
    </span>
  );
}
