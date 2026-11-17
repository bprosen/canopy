/** Care facts derived on the client (and in tests) from the snapshot: schedules, what's due, light fit. */
import { getSpecies, LIGHTS, lightGap, type Species } from "@/data/species";
import { addDays, daysBetween, laterDate, today } from "./dates";
import type { CareEvent, CareKind, Plant, ScheduledKind, Snapshot, Space } from "./types";

export const CARE: Record<CareKind, { label: string; verb: string; past: string }> = {
  water: { label: "Water", verb: "Water", past: "Watered" },
  feed: { label: "Feed", verb: "Feed", past: "Fed" },
  repot: { label: "Repot", verb: "Repot", past: "Repotted" },
  prune: { label: "Prune", verb: "Prune", past: "Pruned" },
  note: { label: "Note", verb: "Add note", past: "Note" },
};

// ---------- plants ----------

/** The catalog species behind a plant. Plants only ever hold catalog ids, but stay safe if one is removed. */
export function speciesOf(p: Pick<Plant, "speciesId">): Species {
  return (
    getSpecies(p.speciesId) ?? {
      id: p.speciesId,
      name: p.speciesId,
      latin: "",
      family: "",
      form: "foliage",
      light: "medium",
      waterDays: 7,
      feedDays: null,
      humidity: "medium",
      petSafe: false,
      difficulty: "moderate",
      tip: "",
    }
  );
}

/** What to call a plant: its nickname, or its species name. */
export function plantName(p: Pick<Plant, "nickname" | "speciesId">): string {
  return p.nickname ?? speciesOf(p).name;
}

export function isActive(p: Pick<Plant, "archivedOn">): boolean {
  return p.archivedOn == null;
}

/** Days between waterings or feeds for this plant (its own setting, else its species'), or null for never. */
export function intervalFor(p: Plant, kind: ScheduledKind): number | null {
  const s = speciesOf(p);
  return kind === "water" ? (p.waterEveryDays ?? s.waterDays) : (p.feedEveryDays ?? s.feedDays);
}

// ---------- schedules ----------

export type CareStatus = "overdue" | "due" | "soon" | "ok";

export type Schedule = {
  kind: ScheduledKind;
  everyDays: number;
  /** When it was last done, or null if never. */
  last: string | null;
  /** When it's next due. Counts from the last time, or from the day the plant arrived. */
  dueOn: string;
  /** Days until due: negative when overdue. */
  daysLeft: number;
  status: CareStatus;
  /** How far through the interval it is, from 0 (just done) up; over 1 means overdue. For the thirst ring. */
  progress: number;
};

/** Care events grouped by plant, each list newest first (as the snapshot gives them). */
export function careByPlant(care: CareEvent[]): Map<number, CareEvent[]> {
  const out = new Map<number, CareEvent[]>();
  for (const e of care) {
    const list = out.get(e.plantId) ?? [];
    list.push(e);
    out.set(e.plantId, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.on.localeCompare(a.on) || b.id - a.id);
  return out;
}

/** The most recent date a kind of care was done, from one plant's events. */
export function lastDone(events: CareEvent[], kind: CareKind): string | null {
  let last: string | null = null;
  for (const e of events) if (e.kind === kind && (!last || e.on > last)) last = e.on;
  return last;
}

export function statusFor(daysLeft: number, soonDays: number): CareStatus {
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "due";
  if (daysLeft <= soonDays) return "soon";
  return "ok";
}

/** A plant's schedule for one kind of care, or null if it doesn't get that care (or is archived). */
export function scheduleFor(
  p: Plant,
  events: CareEvent[],
  kind: ScheduledKind,
  soonDays: number,
  on: string = today(),
): Schedule | null {
  const everyDays = intervalFor(p, kind);
  if (everyDays == null || !isActive(p)) return null;
  const last = lastDone(events, kind);
  const dueOn = addDays(last ? laterDate(last, p.acquiredOn) : p.acquiredOn, everyDays);
  const daysLeft = daysBetween(on, dueOn);
  return {
    kind,
    everyDays,
    last,
    dueOn,
    daysLeft,
    status: statusFor(daysLeft, soonDays),
    progress: Math.max(0, (everyDays - daysLeft) / everyDays),
  };
}

export type PlantCare = { plant: Plant; water: Schedule | null; feed: Schedule | null };

/** Both schedules for every active plant. */
export function allSchedules(s: Pick<Snapshot, "plants" | "care" | "settings">, on: string = today()): PlantCare[] {
  const byPlant = careByPlant(s.care);
  return s.plants.filter(isActive).map((plant) => {
    const events = byPlant.get(plant.id) ?? [];
    return {
      plant,
      water: scheduleFor(plant, events, "water", s.settings.soonDays, on),
      feed: scheduleFor(plant, events, "feed", s.settings.soonDays, on),
    };
  });
}

const STATUS_ORDER: Record<CareStatus, number> = { overdue: 0, due: 1, soon: 2, ok: 3 };

/** The more urgent of two statuses. */
export function worst(a: CareStatus, b: CareStatus): CareStatus {
  return STATUS_ORDER[a] <= STATUS_ORDER[b] ? a : b;
}

export type DueItem = { plant: Plant; schedule: Schedule };

/** Everything due today or overdue, most overdue first. */
export function dueNow(list: PlantCare[]): DueItem[] {
  const out: DueItem[] = [];
  for (const pc of list) {
    for (const schedule of [pc.water, pc.feed]) {
      if (schedule && schedule.daysLeft <= 0) out.push({ plant: pc.plant, schedule });
    }
  }
  return out.sort((a, b) => a.schedule.daysLeft - b.schedule.daysLeft || a.plant.id - b.plant.id);
}

/** What comes due on each of the next `days` days (today first), overdue care counted on today. */
export function upcoming(list: PlantCare[], days = 7, on: string = today()): { date: string; items: DueItem[] }[] {
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(on, i), items: [] as DueItem[] }));
  for (const pc of list) {
    for (const schedule of [pc.water, pc.feed]) {
      if (!schedule) continue;
      const i = Math.max(0, schedule.daysLeft);
      if (i < days) out[i].items.push({ plant: pc.plant, schedule });
    }
  }
  return out;
}

export type GardenSummary = {
  active: number;
  archived: number;
  thirsty: number;
  overdue: number;
  hungry: number;
  /** Waterings logged in the last 7 days, today included. */
  wateredThisWeek: number;
  petUnsafe: number;
};

export function summarize(s: Pick<Snapshot, "plants" | "care" | "settings">, on: string = today()): GardenSummary {
  const list = allSchedules(s, on);
  const weekAgo = addDays(on, -6);
  return {
    active: list.length,
    archived: s.plants.length - list.length,
    thirsty: list.filter((pc) => pc.water && pc.water.daysLeft <= 0).length,
    overdue: list.filter((pc) => pc.water?.status === "overdue" || pc.feed?.status === "overdue").length,
    hungry: list.filter((pc) => pc.feed && pc.feed.daysLeft <= 0).length,
    wateredThisWeek: s.care.filter((e) => e.kind === "water" && e.on >= weekAgo && e.on <= on).length,
    petUnsafe: list.filter((pc) => !speciesOf(pc.plant).petSafe).length,
  };
}

// ---------- light ----------

export type LightFit = { gap: number; message: string } | null;

/** Whether a space suits a plant. Null if the plant isn't placed. */
export function lightFit(p: Plant, space: Space | undefined): LightFit {
  if (!space) return null;
  const s = speciesOf(p);
  const gap = lightGap(s.light, space.light);
  if (gap === 0) return { gap, message: `${space.name} gets the ${LIGHTS[s.light].label.toLowerCase()} it likes.` };
  if (gap < 0)
    return {
      gap,
      message: `${space.name} is darker than it likes (${LIGHTS[space.light].short.toLowerCase()} vs ${LIGHTS[s.light].short.toLowerCase()}).`,
    };
  return {
    gap,
    message: `${space.name} is brighter than it likes (${LIGHTS[space.light].short.toLowerCase()} vs ${LIGHTS[s.light].short.toLowerCase()}).`,
  };
}

/** "in 3 days", "today", "2 days late". */
export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  if (daysLeft > 1) return `in ${daysLeft} days`;
  if (daysLeft === -1) return "1 day late";
  return `${-daysLeft} days late`;
}

/** "1 plant", "3 plants". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}
