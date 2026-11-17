/**
 * Reading and changing plants. The plain functions here validate their input, fire `onPlantChange` and must run
 * inside a transaction; features call them from their own `mutate` blocks. The `…Fn` exports wrap them for the
 * server functions.
 */
import { today } from "./dates";
import { all, get, getDb, NOW, type PlantRow, run } from "./db.server";
import { emitPlant } from "./features.server";
import * as V from "./mutate.server";
import { getSpace } from "./spaces.server";
import { ARCHIVE_REASONS, type ArchiveReason, type Plant } from "./types";

export function toPlant(r: PlantRow): Plant {
  return {
    id: r.id,
    speciesId: r.species_id,
    nickname: r.nickname,
    spaceId: r.space_id,
    acquiredOn: r.acquired_on,
    waterEveryDays: r.water_every_days,
    feedEveryDays: r.feed_every_days,
    note: r.note,
    archivedOn: r.archived_on,
    archiveReason: r.archive_reason as ArchiveReason | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getPlant(id: number): Plant | undefined {
  const r = get<PlantRow>("SELECT * FROM plants WHERE id = ?", id);
  return r && toPlant(r);
}

/** Every plant, archived ones included, by name (nickname if it has one, else species id). */
export function listPlants(): Plant[] {
  return all<PlantRow>("SELECT * FROM plants ORDER BY COALESCE(nickname, species_id) COLLATE NOCASE, id").map(toPlant);
}

export function mustGetPlant(id: unknown): Plant {
  const p = getPlant(V.id(id, "Plant"));
  if (!p) throw new V.UserError("Plant not found");
  return p;
}

function spaceId(v: unknown): number | null {
  if (v == null || v === "") return null;
  const id = V.id(v, "Space");
  if (!getSpace(id)) throw new V.UserError("Space not found");
  return id;
}

function interval(v: unknown, field: string): number | null {
  return V.int(v, field, { min: 1, max: 365 });
}

export type PlantInput = {
  speciesId: unknown;
  nickname?: unknown;
  spaceId?: unknown;
  /** Defaults to today. */
  acquiredOn?: unknown;
  waterEveryDays?: unknown;
  feedEveryDays?: unknown;
  note?: unknown;
};

export function addPlant(input: PlantInput): Plant {
  const s = V.species(input.speciesId);
  const acquiredOn = V.isoDate(input.acquiredOn, "Date added") ?? today();
  if (acquiredOn > today()) throw new V.UserError("A plant can't join your collection in the future");
  const { lastInsertRowid } = run(
    "INSERT INTO plants (species_id, nickname, space_id, acquired_on, water_every_days, feed_every_days, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    s.id,
    V.str(input.nickname, "Nickname", { max: 60 }),
    spaceId(input.spaceId),
    acquiredOn,
    interval(input.waterEveryDays, "Watering interval"),
    interval(input.feedEveryDays, "Feeding interval"),
    V.str(input.note, "Note", { max: 1000 }),
  );
  const plant = getPlant(Number(lastInsertRowid))!;
  emitPlant(getDb(), { type: "added", plant });
  return plant;
}

export type PlantPatch = Partial<Omit<PlantInput, "speciesId">> & { id: unknown };

/** Change some of a plant's details. Fields left out keep their value; the species can't change. */
export function editPlant(patch: PlantPatch): Plant {
  const before = mustGetPlant(patch.id);
  const next = {
    nickname: patch.nickname === undefined ? before.nickname : V.str(patch.nickname, "Nickname", { max: 60 }),
    spaceId: patch.spaceId === undefined ? before.spaceId : spaceId(patch.spaceId),
    acquiredOn:
      patch.acquiredOn === undefined
        ? before.acquiredOn
        : (V.isoDate(patch.acquiredOn, "Date added") ?? before.acquiredOn),
    waterEveryDays:
      patch.waterEveryDays === undefined ? before.waterEveryDays : interval(patch.waterEveryDays, "Watering interval"),
    feedEveryDays:
      patch.feedEveryDays === undefined ? before.feedEveryDays : interval(patch.feedEveryDays, "Feeding interval"),
    note: patch.note === undefined ? before.note : V.str(patch.note, "Note", { max: 1000 }),
  };
  if (next.acquiredOn > today()) throw new V.UserError("A plant can't join your collection in the future");
  run(
    `UPDATE plants SET nickname = ?, space_id = ?, acquired_on = ?, water_every_days = ?, feed_every_days = ?, note = ?, updated_at = ${NOW} WHERE id = ?`,
    next.nickname,
    next.spaceId,
    next.acquiredOn,
    next.waterEveryDays,
    next.feedEveryDays,
    next.note,
    before.id,
  );
  const after = getPlant(before.id)!;
  emitPlant(getDb(), { type: "updated", before, after });
  return after;
}

/** Take a plant out of the collection (it died, was given away…). Its history stays. */
export function archivePlant(input: { id: unknown; reason: unknown; on?: unknown }): Plant {
  const before = mustGetPlant(input.id);
  if (before.archivedOn) throw new V.UserError("That plant is already archived");
  if (!ARCHIVE_REASONS.includes(input.reason as ArchiveReason))
    throw new V.UserError("Reason must be died, rehomed or other");
  const on = V.isoDate(input.on, "Date") ?? today();
  if (on < before.acquiredOn) throw new V.UserError("A plant can't leave before it arrived");
  run(
    `UPDATE plants SET archived_on = ?, archive_reason = ?, updated_at = ${NOW} WHERE id = ?`,
    on,
    input.reason as ArchiveReason,
    before.id,
  );
  const plant = getPlant(before.id)!;
  emitPlant(getDb(), { type: "archived", plant });
  return plant;
}

/** Bring an archived plant back into the collection. */
export function restorePlant(input: { id: unknown }): Plant {
  const before = mustGetPlant(input.id);
  if (!before.archivedOn) throw new V.UserError("That plant isn't archived");
  run(`UPDATE plants SET archived_on = NULL, archive_reason = NULL, updated_at = ${NOW} WHERE id = ?`, before.id);
  const plant = getPlant(before.id)!;
  emitPlant(getDb(), { type: "restored", plant });
  return plant;
}

/** Delete a plant and all its care history. For mistakes; archive plants that really left. */
export function removePlant(input: { id: unknown }): void {
  const plant = mustGetPlant(input.id);
  run("DELETE FROM plants WHERE id = ?", plant.id);
  emitPlant(getDb(), { type: "deleted", plant });
}

// ---------- server function handlers ----------

export const addPlantFn = (input: PlantInput) => V.mutate(() => addPlant(input));
export const updatePlantFn = (input: PlantPatch) => V.mutate(() => editPlant(input));
export const archivePlantFn = (input: { id: unknown; reason: unknown; on?: unknown }) =>
  V.mutate(() => archivePlant(input));
export const restorePlantFn = (input: { id: unknown }) => V.mutate(() => restorePlant(input));
export const deletePlantFn = (input: { id: unknown }) => V.mutate(() => removePlant(input));
