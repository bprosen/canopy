/**
 * Demo data for "Load sample data": a small apartment jungle across four spaces, with two months of care
 * history. Dates are relative to today, and the history is laid out so a few plants are always thirsty and a
 * couple are overdue, which keeps the Today page interesting.
 */
import type { Light } from "@/data/species";
import type { CareKind } from "./types";

export type SampleSpace = { name: string; light: Light; note?: string };

export const SAMPLE_SPACES: SampleSpace[] = [
  { name: "Living room", light: "bright", note: "Big south-west window, sheer curtain." },
  { name: "Bedroom", light: "medium" },
  { name: "Bathroom", light: "low", note: "Steamy after showers." },
  { name: "Kitchen sill", light: "direct" },
];

export type SamplePlant = {
  speciesId: string;
  nickname?: string;
  space: string;
  /** How long ago it joined the collection. */
  acquiredDaysAgo: number;
  /** Days ago it was last watered, which sets where it sits in its schedule today. */
  lastWateredDaysAgo: number;
  /** Days ago it was last fed, if ever. */
  lastFedDaysAgo?: number;
  waterEveryDays?: number;
  note?: string;
};

export const SAMPLE_PLANTS: SamplePlant[] = [
  {
    speciesId: "monstera",
    nickname: "Big Monty",
    space: "Living room",
    acquiredDaysAgo: 400,
    lastWateredDaysAgo: 8,
    lastFedDaysAgo: 20,
    note: "Moved to the bigger pot last spring.",
  },
  {
    speciesId: "fiddle-leaf-fig",
    nickname: "Fig",
    space: "Living room",
    acquiredDaysAgo: 220,
    lastWateredDaysAgo: 3,
    lastFedDaysAgo: 35,
  },
  { speciesId: "pothos-golden", space: "Living room", acquiredDaysAgo: 600, lastWateredDaysAgo: 9, lastFedDaysAgo: 12 },
  {
    speciesId: "bird-of-paradise",
    space: "Living room",
    acquiredDaysAgo: 120,
    lastWateredDaysAgo: 5,
    lastFedDaysAgo: 30,
  },
  {
    speciesId: "snake-plant",
    nickname: "Sid",
    space: "Bedroom",
    acquiredDaysAgo: 900,
    lastWateredDaysAgo: 14,
    lastFedDaysAgo: 70,
  },
  { speciesId: "zz-plant", space: "Bedroom", acquiredDaysAgo: 300, lastWateredDaysAgo: 18, lastFedDaysAgo: 40 },
  {
    speciesId: "calathea-orbifolia",
    nickname: "Orbi",
    space: "Bedroom",
    acquiredDaysAgo: 90,
    lastWateredDaysAgo: 7,
    lastFedDaysAgo: 15,
    note: "Only gets filtered water.",
  },
  { speciesId: "peace-lily", space: "Bedroom", acquiredDaysAgo: 150, lastWateredDaysAgo: 6, lastFedDaysAgo: 50 },
  { speciesId: "boston-fern", space: "Bathroom", acquiredDaysAgo: 75, lastWateredDaysAgo: 2 },
  {
    speciesId: "maidenhair-fern",
    nickname: "Maid Marian",
    space: "Bathroom",
    acquiredDaysAgo: 40,
    lastWateredDaysAgo: 4,
    lastFedDaysAgo: 25,
  },
  { speciesId: "moth-orchid", space: "Bathroom", acquiredDaysAgo: 200, lastWateredDaysAgo: 5, lastFedDaysAgo: 18 },
  { speciesId: "basil", space: "Kitchen sill", acquiredDaysAgo: 30, lastWateredDaysAgo: 1, lastFedDaysAgo: 22 },
  { speciesId: "rosemary", space: "Kitchen sill", acquiredDaysAgo: 180, lastWateredDaysAgo: 6 },
  {
    speciesId: "jade",
    nickname: "Jade",
    space: "Kitchen sill",
    acquiredDaysAgo: 1200,
    lastWateredDaysAgo: 10,
    lastFedDaysAgo: 60,
  },
  { speciesId: "echeveria", space: "Kitchen sill", acquiredDaysAgo: 60, lastWateredDaysAgo: 15 },
];

/** How far back the generated care history goes. */
export const HISTORY_DAYS = 60;

export type SampleCare = { kind: CareKind; daysAgo: number; note?: string };

/**
 * Past care for one sample plant: waterings every `every` days counting back from the last one (with a little
 * day-to-day wobble so it looks human), feeds the same way, and the odd repot or prune.
 */
export function sampleHistory(p: SamplePlant, waterEvery: number, feedEvery: number | null): SampleCare[] {
  const out: SampleCare[] = [];
  const earliest = Math.min(HISTORY_DAYS, p.acquiredDaysAgo);
  let day = p.lastWateredDaysAgo;
  let i = 0;
  while (day <= earliest) {
    out.push({ kind: "water", daysAgo: day });
    // Wobble: -1, 0, +1 days around the interval, deterministically.
    day += Math.max(1, waterEvery + ((i * 7 + p.acquiredDaysAgo) % 3) - 1);
    i++;
  }
  if (p.lastFedDaysAgo != null && feedEvery != null) {
    for (let d = p.lastFedDaysAgo; d <= earliest; d += feedEvery) out.push({ kind: "feed", daysAgo: d });
  }
  if (p.speciesId === "monstera") out.push({ kind: "prune", daysAgo: 33, note: "Took off two yellow lower leaves." });
  if (p.speciesId === "basil") out.push({ kind: "prune", daysAgo: 9, note: "Pinched the tops for pesto." });
  if (p.speciesId === "calathea-orbifolia") out.push({ kind: "repot", daysAgo: 45, note: "Up one size, chunky mix." });
  return out;
}

export const SAMPLE_SETTINGS = { displayName: "Robin" };
