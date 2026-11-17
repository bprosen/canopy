import { describe, expect, it } from "vitest";
import { FORM_IDS, LIGHT_IDS, lightGap, SPECIES } from "@/data/species";
import {
  allSchedules,
  careByPlant,
  dueLabel,
  dueNow,
  lightFit,
  plantName,
  scheduleFor,
  statusFor,
  summarize,
  upcoming,
} from "./care";
import { addDays, startOfWeek } from "./dates";
import type { CareEvent, Plant, Space } from "./types";

let nextId = 1;
const plant = (p: Partial<Plant> = {}): Plant => ({
  id: nextId++,
  speciesId: "monstera", // waters every 7 days, feeds every 30
  nickname: null,
  spaceId: null,
  acquiredOn: "2026-01-01",
  waterEveryDays: null,
  feedEveryDays: null,
  note: null,
  archivedOn: null,
  archiveReason: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...p,
});
const care = (plantId: number, kind: CareEvent["kind"], on: string): CareEvent => ({
  id: nextId++,
  plantId,
  kind,
  on,
  note: null,
  createdAt: `${on}T09:00:00.000Z`,
});
const space = (light: Space["light"], name = "Room"): Space => ({
  id: nextId++,
  name,
  light,
  note: null,
  createdAt: "",
  updatedAt: "",
});

const on = "2026-01-15";

describe("catalog", () => {
  it("has unique kebab-case ids and sensible care facts", () => {
    const ids = SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SPECIES) {
      expect(s.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(FORM_IDS).toContain(s.form);
      expect(LIGHT_IDS).toContain(s.light);
      expect(s.waterDays).toBeGreaterThanOrEqual(1);
      expect(s.waterDays).toBeLessThanOrEqual(60);
      if (s.feedDays != null) expect(s.feedDays).toBeGreaterThanOrEqual(7);
      expect(s.latin.length).toBeGreaterThan(0);
      expect(s.tip.length).toBeGreaterThan(0);
    }
  });

  it("measures light gaps from darkest to brightest", () => {
    expect(lightGap("bright", "low")).toBe(-2);
    expect(lightGap("low", "direct")).toBe(3);
    expect(lightGap("medium", "medium")).toBe(0);
  });
});

describe("schedules", () => {
  it("count from the plant's arrival until the first watering", () => {
    const p = plant({ acquiredOn: "2026-01-10" });
    const s = scheduleFor(p, [], "water", 2, on)!;
    expect(s).toMatchObject({ last: null, dueOn: "2026-01-17", daysLeft: 2, status: "soon", everyDays: 7 });
  });

  it("count from the last time, using the plant's own interval if it has one", () => {
    const p = plant({ waterEveryDays: 3 });
    const events = [care(p.id, "water", "2026-01-10"), care(p.id, "water", "2026-01-12")];
    const s = scheduleFor(p, events, "water", 2, on)!;
    expect(s).toMatchObject({ last: "2026-01-12", dueOn: "2026-01-15", daysLeft: 0, status: "due", progress: 1 });
  });

  it("mark overdue care and its progress past the full ring", () => {
    const p = plant();
    const s = scheduleFor(p, [care(p.id, "water", "2026-01-04")], "water", 2, on)!;
    expect(s.status).toBe("overdue");
    expect(s.daysLeft).toBe(-4);
    expect(s.progress).toBeCloseTo(11 / 7);
  });

  it("skip plants that don't get that care, and archived plants", () => {
    expect(scheduleFor(plant({ speciesId: "rosemary" }), [], "feed", 2, on)).toBeNull();
    expect(scheduleFor(plant({ archivedOn: "2026-01-12", archiveReason: "died" }), [], "water", 2, on)).toBeNull();
    expect(scheduleFor(plant({ speciesId: "rosemary", feedEveryDays: 30 }), [], "feed", 2, on)).not.toBeNull();
  });

  it("classify days left", () => {
    expect([statusFor(-1, 2), statusFor(0, 2), statusFor(2, 2), statusFor(3, 2)]).toEqual([
      "overdue",
      "due",
      "soon",
      "ok",
    ]);
    expect([dueLabel(0), dueLabel(1), dueLabel(4), dueLabel(-1), dueLabel(-3)]).toEqual([
      "today",
      "tomorrow",
      "in 4 days",
      "1 day late",
      "3 days late",
    ]);
  });
});

describe("the garden", () => {
  const a = plant({ nickname: "Monty" }); // watered on the 4th: 4 days late
  const b = plant({ speciesId: "snake-plant" }); // every 21 days from the 1st: due the 22nd
  const c = plant({ speciesId: "basil", acquiredOn: "2026-01-12" }); // every 3 days: due today
  const gone = plant({ archivedOn: "2026-01-05", archiveReason: "died" });
  const events = [
    care(a.id, "water", "2026-01-04"),
    care(a.id, "feed", "2026-01-01"),
    care(c.id, "water", "2026-01-11"),
  ];
  const snap = { plants: [a, b, c, gone], care: events, settings: { displayName: "x", soonDays: 2 } };

  it("names plants by nickname, else species", () => {
    expect(plantName(a)).toBe("Monty");
    expect(plantName(b)).toBe("Snake plant");
  });

  it("groups care per plant, newest first", () => {
    const by = careByPlant([care(a.id, "water", "2026-01-01"), care(a.id, "water", "2026-01-09")]);
    expect(by.get(a.id)!.map((e) => e.on)).toEqual(["2026-01-09", "2026-01-01"]);
  });

  it("lists what's due now, most overdue first", () => {
    const due = dueNow(allSchedules(snap, on));
    expect(due.map((d) => [plantName(d.plant), d.schedule.kind, d.schedule.daysLeft])).toEqual([
      ["Monty", "water", -4],
      ["Basil", "water", 0],
    ]);
  });

  it("spreads the next week across days, with overdue on today", () => {
    const days = upcoming(allSchedules(snap, on), 7, on);
    expect(days.map((d) => d.date)).toEqual(Array.from({ length: 7 }, (_, i) => addDays(on, i)));
    expect(days[0].items.map((i) => plantName(i.plant))).toEqual(["Monty", "Basil"]);
    expect(days.flatMap((d) => d.items).some((i) => i.plant.id === b.id)).toBe(false);
  });

  it("summarizes the collection", () => {
    expect(summarize(snap, on)).toEqual({
      active: 3,
      archived: 1,
      thirsty: 2,
      overdue: 1,
      hungry: 0,
      wateredThisWeek: 1,
      petUnsafe: 2,
    });
  });

  it("checks a space's light against the plant", () => {
    expect(lightFit(a, undefined)).toBeNull();
    expect(lightFit(a, space("bright"))!.gap).toBe(0);
    expect(lightFit(a, space("low", "Hall"))!.message).toMatch(/Hall is darker than it likes/);
    expect(lightFit(a, space("direct"))!.gap).toBe(1);
  });

  it("finds the start of the week", () => {
    expect(startOfWeek(on, 1)).toBe("2026-01-12");
  });
});
