import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allSchedules, summarize } from "./care";
import * as C from "./care.server";
import * as D from "./data.server";
import { setClockForTests } from "./dates";
import { allMigrations, appliedMigrations, BASE_MIGRATIONS, migrate, openDb, resetDbForTests } from "./db.server";
import {
  type CareChange,
  type PlantEvent,
  type ServerFeature,
  type SpaceEvent,
  setServerFeaturesForTests,
} from "./features.server";
import * as P from "./plants.server";
import { SAMPLE_PLANTS, SAMPLE_SPACES } from "./sample-data";
import { readSnapshot } from "./snapshot.server";
import * as S from "./spaces.server";

beforeEach(() => {
  setClockForTests(() => new Date(2026, 0, 15, 12));
  resetDbForTests();
});
afterEach(() => {
  setClockForTests(undefined);
  setServerFeaturesForTests(undefined);
});

async function ok<T>(p: Promise<{ ok: true; data?: T } | { ok: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.data as T;
}

async function fails(p: Promise<{ ok: boolean; error?: string }>, msg: RegExp) {
  const r = await p;
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(msg);
}

describe("migrations", () => {
  it("bring a fresh database up to date, tracked by id, and are idempotent", () => {
    const db = openDb(":memory:");
    expect(appliedMigrations(db)).toEqual(BASE_MIGRATIONS.map((m) => m.id));
    migrate(db);
    expect(appliedMigrations(db)).toEqual(BASE_MIGRATIONS.map((m) => m.id));
  });

  it("apply only the migrations a database is missing", () => {
    const db = openDb(":memory:");
    const ran: string[] = [];
    const m = (id: string) => ({ id, up: () => ran.push(id) });
    migrate(db, [...BASE_MIGRATIONS, m("b/001"), m("a/001")]);
    migrate(db, [...BASE_MIGRATIONS, m("a/001"), m("c/001"), m("b/001")]);
    expect(ran).toEqual(["b/001", "a/001", "c/001"]);
  });

  it("roll back a failing migration and name it", () => {
    const db = openDb(":memory:");
    const bad = {
      id: "broken/001",
      up: (d: DatabaseSync) => {
        d.exec("CREATE TABLE half_done (x)");
        throw new Error("boom");
      },
    };
    expect(() => migrate(db, [...BASE_MIGRATIONS, bad])).toThrow(/"broken\/001" failed/);
    expect(appliedMigrations(db)).not.toContain("broken/001");
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'").get()).toBeUndefined();
  });

  it("namespace feature migrations by feature id and reject duplicates", () => {
    const up = () => {};
    const f = (id: string, ...names: string[]): ServerFeature => ({
      id,
      migrations: names.map((name) => ({ name, up })),
    });
    expect(allMigrations([f("photos", "001"), f("pests", "001")]).map((m) => m.id)).toEqual([
      ...BASE_MIGRATIONS.map((m) => m.id),
      "photos/001",
      "pests/001",
    ]);
    expect(() => allMigrations([f("pests", "001", "001")])).toThrow(/Duplicate migration "pests\/001"/);
  });
});

describe("spaces", () => {
  it("create, rename and refuse duplicate names", async () => {
    const s = await ok(S.createSpaceFn({ name: "  Living room ", light: "bright" }));
    expect(s).toMatchObject({ name: "Living room", light: "bright", note: null });
    await fails(S.createSpaceFn({ name: "living ROOM", light: "low" }), /already have a space/);
    await fails(S.createSpaceFn({ name: "Attic", light: "dim" }), /Light must be/);
    const edited = await ok(S.updateSpaceFn({ id: s.id, name: "Lounge", light: "medium", note: "west" }));
    expect(edited).toMatchObject({ name: "Lounge", light: "medium", note: "west" });
  });

  it("leave plants unplaced when deleted", async () => {
    const s = await ok(S.createSpaceFn({ name: "Office", light: "medium" }));
    const p = await ok(P.addPlantFn({ speciesId: "pothos-golden", spaceId: s.id }));
    await ok(S.deleteSpaceFn({ id: s.id }));
    expect(P.getPlant(p.id)!.spaceId).toBeNull();
  });
});

describe("plants", () => {
  it("add with defaults and validate", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "monstera", nickname: " Monty " }));
    expect(p).toMatchObject({ nickname: "Monty", acquiredOn: "2026-01-15", spaceId: null, waterEveryDays: null });
    await fails(P.addPlantFn({ speciesId: "triffid" }), /Unknown plant species/);
    await fails(P.addPlantFn({ speciesId: "monstera", spaceId: 99 }), /Space not found/);
    await fails(P.addPlantFn({ speciesId: "monstera", acquiredOn: "2026-02-01" }), /in the future/);
    await fails(P.addPlantFn({ speciesId: "monstera", waterEveryDays: 0 }), /between 1 and 365/);
  });

  it("edit only the fields given", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "monstera", note: "by the window" }));
    const e = await ok(P.updatePlantFn({ id: p.id, waterEveryDays: 5 }));
    expect(e).toMatchObject({ waterEveryDays: 5, note: "by the window" });
    const cleared = await ok(P.updatePlantFn({ id: p.id, waterEveryDays: null, nickname: "Monstro" }));
    expect(cleared).toMatchObject({ waterEveryDays: null, nickname: "Monstro" });
  });

  it("archive and restore, keeping history, and block care while archived", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "basil", acquiredOn: "2026-01-01" }));
    await ok(C.logCareFn({ plantId: p.id, kind: "water", on: "2026-01-10" }));
    await fails(P.archivePlantFn({ id: p.id, reason: "eaten" }), /Reason must be/);
    await fails(P.archivePlantFn({ id: p.id, reason: "died", on: "2025-12-01" }), /before it arrived/);
    const a = await ok(P.archivePlantFn({ id: p.id, reason: "died" }));
    expect(a).toMatchObject({ archivedOn: "2026-01-15", archiveReason: "died" });
    await fails(C.logCareFn({ plantId: p.id, kind: "water" }), /Restore the plant/);
    await fails(P.archivePlantFn({ id: p.id, reason: "died" }), /already archived/);
    expect(C.listCare(p.id)).toHaveLength(1);
    const r = await ok(P.restorePlantFn({ id: p.id }));
    expect(r).toMatchObject({ archivedOn: null, archiveReason: null });
  });

  it("delete with all their care", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "basil", acquiredOn: "2026-01-01" }));
    await ok(C.logCareFn({ plantId: p.id, kind: "water" }));
    await ok(P.deletePlantFn({ id: p.id }));
    expect(readSnapshot()).toMatchObject({ plants: [], care: [] });
  });
});

describe("care", () => {
  it("log with sensible dates and require text for notes", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "monstera", acquiredOn: "2026-01-05" }));
    const res = await ok(C.logCareFn({ plantId: p.id, kind: "water" }));
    expect(res.events[0]).toMatchObject({ kind: "water", on: "2026-01-15" });
    await fails(C.logCareFn({ plantId: p.id, kind: "water", on: "2026-01-16" }), /in the future/);
    await fails(C.logCareFn({ plantId: p.id, kind: "water", on: "2026-01-01" }), /before the plant joined/);
    await fails(C.logCareFn({ plantId: p.id, kind: "dance" }), /Unknown kind/);
    await fails(C.logCareFn({ plantId: p.id, kind: "note", note: "  " }), /Write something/);
    await ok(C.logCareFn({ plantId: p.id, kind: "note", note: "New leaf unfurling" }));
  });

  it("log for many plants at once, all or nothing", async () => {
    const a = await ok(P.addPlantFn({ speciesId: "monstera", acquiredOn: "2026-01-01" }));
    const b = await ok(P.addPlantFn({ speciesId: "basil", acquiredOn: "2026-01-01" }));
    const res = await ok(C.logCareBulkFn({ plantIds: [a.id, b.id, a.id], kind: "water" }));
    expect(res.events).toHaveLength(2);
    await fails(C.logCareBulkFn({ plantIds: [a.id, 999], kind: "water" }), /Plant not found/);
    expect(C.listCare()).toHaveLength(2);
    await fails(C.logCareBulkFn({ plantIds: [], kind: "water" }), /at least one/);
    await fails(C.logCareBulkFn({ plantIds: [a.id], kind: "note" }), /one plant at a time/);
  });

  it("edit and delete entries, which moves the schedule", async () => {
    const p = await ok(P.addPlantFn({ speciesId: "monstera", acquiredOn: "2026-01-01" }));
    const { events } = await ok(C.logCareFn({ plantId: p.id, kind: "water", on: "2026-01-14" }));
    const due = () => allSchedules(readSnapshot()).find((x) => x.plant.id === p.id)!.water!.dueOn;
    expect(due()).toBe("2026-01-21");
    await ok(C.updateCareFn({ id: events[0].id, on: "2026-01-10" }));
    expect(due()).toBe("2026-01-17");
    await ok(C.deleteCareFn({ id: events[0].id }));
    expect(due()).toBe("2026-01-08");
  });
});

describe("feature hooks", () => {
  it("hear about plant, care and space changes inside the transaction", async () => {
    const seen: string[] = [];
    setServerFeaturesForTests([
      {
        id: "spy",
        onPlantChange: (_db, e: PlantEvent) => seen.push(`p:${e.type}`),
        onCareChange: (_db, e: CareChange) => seen.push(`c:${e.type}`),
        onSpaceChange: (_db, e: SpaceEvent) => seen.push(`s:${e.type}`),
      },
    ]);
    const s = await ok(S.createSpaceFn({ name: "Den", light: "low" }));
    const p = await ok(P.addPlantFn({ speciesId: "zz-plant", spaceId: s.id, acquiredOn: "2026-01-01" }));
    const { events } = await ok(C.logCareFn({ plantId: p.id, kind: "water" }));
    await ok(C.updateCareFn({ id: events[0].id, note: "deep soak" }));
    await ok(C.deleteCareFn({ id: events[0].id }));
    await ok(P.updatePlantFn({ id: p.id, nickname: "Zed" }));
    await ok(P.archivePlantFn({ id: p.id, reason: "rehomed" }));
    await ok(P.restorePlantFn({ id: p.id }));
    await ok(S.updateSpaceFn({ id: s.id, name: "Den", light: "medium" }));
    await ok(S.deleteSpaceFn({ id: s.id }));
    await ok(P.deletePlantFn({ id: p.id }));
    expect(seen).toEqual([
      "s:created",
      "p:added",
      "c:logged",
      "c:updated",
      "c:deleted",
      "p:updated",
      "p:archived",
      "p:restored",
      "s:updated",
      "s:deleted",
      "p:deleted",
    ]);
  });

  it("roll the whole mutation back when a hook throws", async () => {
    setServerFeaturesForTests([
      {
        id: "grumpy",
        onCareChange: (_db, e) => {
          if (e.type === "logged" && e.plant.speciesId === "basil") throw new Error("nope");
        },
      },
    ]);
    const a = await ok(P.addPlantFn({ speciesId: "monstera", acquiredOn: "2026-01-01" }));
    const b = await ok(P.addPlantFn({ speciesId: "basil", acquiredOn: "2026-01-01" }));
    await fails(C.logCareBulkFn({ plantIds: [a.id, b.id], kind: "water" }), /Something went wrong/);
    expect(C.listCare()).toEqual([]);
  });
});

describe("settings, sample data, import and reset", () => {
  it("save settings with validation", async () => {
    await ok(D.saveSettings({ displayName: "Juniper", soonDays: 3 }));
    expect(readSnapshot().settings).toEqual({ displayName: "Juniper", soonDays: 3 });
    await fails(D.saveSettings({ soonDays: 30 }), /between 0 and 14/);
  });

  it("load sample data once, however many times it's asked, with something due today", async () => {
    await ok(D.loadSampleData());
    await ok(D.loadSampleData());
    const s = readSnapshot();
    expect(s.spaces).toHaveLength(SAMPLE_SPACES.length);
    expect(s.plants).toHaveLength(SAMPLE_PLANTS.length);
    expect(s.settings.displayName).toBe("Robin");
    const sum = summarize(s);
    expect(sum.thirsty).toBeGreaterThan(0);
    expect(sum.thirsty).toBeLessThan(s.plants.length);
  });

  it("round-trip an export through import, keeping ids, and drop junk", async () => {
    await ok(D.loadSampleData());
    const first = readSnapshot().plants[0];
    await ok(P.archivePlantFn({ id: first.id, reason: "rehomed" }));
    const before = readSnapshot();
    const junk = {
      ...before,
      plants: [...before.plants, { id: 900, speciesId: "triffid", acquiredOn: "2026-01-01" }],
      care: [...before.care, { id: 900, plantId: 12345, kind: "water", on: "2026-01-01" }, { id: "x" }],
      spaces: [...before.spaces, { id: 900, name: "", light: "bright" }],
    };
    await ok(D.importData({ snapshot: junk }));
    expect(readSnapshot()).toEqual(before);
    await fails(D.importData({ snapshot: { hello: 1 } }), /doesn't look like a Canopy export/);
  });

  it("reset everything, including feature tables", async () => {
    let resets = 0;
    setServerFeaturesForTests([{ id: "spy", reset: () => resets++ }]);
    await ok(D.loadSampleData());
    await ok(D.resetAll());
    expect(readSnapshot()).toMatchObject({ plants: [], care: [], spaces: [] });
    expect(resets).toBe(1);
  });
});
