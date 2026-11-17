/**
 * Logging and changing care events (waterings, feeds, repots…). As with plants, the plain functions validate,
 * fire `onCareChange` and must run inside a transaction; the `…Fn` exports wrap them for the server functions.
 */
import { today } from "./dates";
import { all, type CareRow, get, getDb, run } from "./db.server";
import { emitCare } from "./features.server";
import * as V from "./mutate.server";
import { mustGetPlant } from "./plants.server";
import { CARE_KINDS, type CareEvent, type CareKind, type Plant } from "./types";

export const CARE_LIMITS = { bulk: 200 } as const;

export function toCare(r: CareRow): CareEvent {
  return {
    id: r.id,
    plantId: r.plant_id,
    kind: r.kind as CareKind,
    on: r.on_date,
    note: r.note,
    createdAt: r.created_at,
  };
}

export function getCare(id: number): CareEvent | undefined {
  const r = get<CareRow>("SELECT * FROM care_events WHERE id = ?", id);
  return r && toCare(r);
}

/** Every care event, newest first; or one plant's. */
export function listCare(plantId?: number): CareEvent[] {
  const order = "ORDER BY on_date DESC, id DESC";
  const rows =
    plantId == null
      ? all<CareRow>(`SELECT * FROM care_events ${order}`)
      : all<CareRow>(`SELECT * FROM care_events WHERE plant_id = ? ${order}`, plantId);
  return rows.map(toCare);
}

function kind(v: unknown): CareKind {
  if (!CARE_KINDS.includes(v as CareKind)) throw new V.UserError("Unknown kind of care");
  return v as CareKind;
}

/** A care date: defaults to today, can't be in the future or before the plant arrived. */
function careDate(v: unknown, plant: Plant): string {
  const on = V.isoDate(v, "Date") ?? today();
  if (on > today()) throw new V.UserError("Care can't be logged in the future");
  if (on < plant.acquiredOn) throw new V.UserError("That's before the plant joined your collection");
  return on;
}

export type CareInput = { plantId: unknown; kind: unknown; on?: unknown; note?: unknown };

/** Log one piece of care for one plant. Archived plants can't get new care. */
export function logCare(input: CareInput): CareEvent {
  const plant = mustGetPlant(input.plantId);
  if (plant.archivedOn) throw new V.UserError("Restore the plant before logging care for it");
  const k = kind(input.kind);
  const note = V.str(input.note, "Note", { max: 1000 });
  if (k === "note" && !note) throw new V.UserError("Write something for the note");
  const { lastInsertRowid } = run(
    "INSERT INTO care_events (plant_id, kind, on_date, note) VALUES (?, ?, ?, ?)",
    plant.id,
    k,
    careDate(input.on, plant),
    note,
  );
  const event = getCare(Number(lastInsertRowid))!;
  emitCare(getDb(), { type: "logged", event, plant });
  return event;
}

/** Log the same care for several plants at once ("water everything due"). All or nothing. */
export function logCareBulk(input: { plantIds: unknown; kind: unknown; on?: unknown }): CareEvent[] {
  if (!Array.isArray(input.plantIds) || input.plantIds.length === 0) throw new V.UserError("Pick at least one plant");
  if (input.plantIds.length > CARE_LIMITS.bulk)
    throw new V.UserError(`You can log care for at most ${CARE_LIMITS.bulk} plants at once`);
  const k = kind(input.kind);
  if (k === "note") throw new V.UserError("Notes are written one plant at a time");
  const ids = [...new Set(input.plantIds.map((id) => V.id(id, "Plant")))];
  return ids.map((plantId) => logCare({ plantId, kind: k, on: input.on }));
}

function mustGet(id: unknown): CareEvent {
  const e = getCare(V.id(id, "Care entry"));
  if (!e) throw new V.UserError("Care entry not found");
  return e;
}

/** Fix the date or note of a care entry. Fields left out keep their value. */
export function editCare(input: { id: unknown; on?: unknown; note?: unknown }): CareEvent {
  const before = mustGet(input.id);
  const plant = mustGetPlant(before.plantId);
  const on = input.on === undefined ? before.on : careDate(input.on, plant);
  const note = input.note === undefined ? before.note : V.str(input.note, "Note", { max: 1000 });
  if (before.kind === "note" && !note) throw new V.UserError("Write something for the note");
  run("UPDATE care_events SET on_date = ?, note = ? WHERE id = ?", on, note, before.id);
  const after = getCare(before.id)!;
  emitCare(getDb(), { type: "updated", before, after });
  return after;
}

export function removeCare(input: { id: unknown }): void {
  const event = mustGet(input.id);
  run("DELETE FROM care_events WHERE id = ?", event.id);
  emitCare(getDb(), { type: "deleted", event });
}

// ---------- server function handlers ----------

export const logCareFn = (input: CareInput) =>
  V.mutate(() => {
    const event = logCare(input);
    return { events: [event], plants: [mustGetPlant(event.plantId)] };
  });
export const logCareBulkFn = (input: { plantIds: unknown; kind: unknown; on?: unknown }) =>
  V.mutate(() => {
    const events = logCareBulk(input);
    return { events, plants: events.map((e) => mustGetPlant(e.plantId)) };
  });
export const updateCareFn = (input: { id: unknown; on?: unknown; note?: unknown }) => V.mutate(() => editCare(input));
export const deleteCareFn = (input: { id: unknown }) => V.mutate(() => removeCare(input));
