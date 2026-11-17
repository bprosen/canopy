/**
 * Reading and changing spaces (rooms and spots where plants live). The plain functions validate, fire
 * `onSpaceChange` and must run inside a transaction; the `…Fn` exports wrap them for the server functions.
 */
import type { Light } from "@/data/species";
import { all, get, getDb, NOW, run, type SpaceRow } from "./db.server";
import { emitSpace } from "./features.server";
import * as V from "./mutate.server";
import type { Space } from "./types";

export function toSpace(r: SpaceRow): Space {
  return {
    id: r.id,
    name: r.name,
    light: r.light as Light,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getSpace(id: number): Space | undefined {
  const r = get<SpaceRow>("SELECT * FROM spaces WHERE id = ?", id);
  return r && toSpace(r);
}

/** Every space, by name. */
export function listSpaces(): Space[] {
  return all<SpaceRow>("SELECT * FROM spaces ORDER BY name COLLATE NOCASE, id").map(toSpace);
}

function mustGet(id: unknown): Space {
  const s = getSpace(V.id(id, "Space"));
  if (!s) throw new V.UserError("Space not found");
  return s;
}

export type SpaceInput = { name: unknown; light: unknown; note?: unknown };

function parse(input: SpaceInput) {
  return {
    name: V.str(input.name, "Name", { required: true, max: 60 })!,
    light: V.light(input.light),
    note: V.str(input.note, "Note", { max: 500 }),
  };
}

function nameTaken(name: string, exceptId = 0): boolean {
  return !!get("SELECT 1 FROM spaces WHERE name = ? COLLATE NOCASE AND id != ?", name, exceptId);
}

export function addSpace(input: SpaceInput): Space {
  const s = parse(input);
  if (nameTaken(s.name)) throw new V.UserError(`You already have a space called "${s.name}"`);
  const { lastInsertRowid } = run("INSERT INTO spaces (name, light, note) VALUES (?, ?, ?)", s.name, s.light, s.note);
  const space = getSpace(Number(lastInsertRowid))!;
  emitSpace(getDb(), { type: "created", space });
  return space;
}

export function editSpace(input: SpaceInput & { id: unknown }): Space {
  const before = mustGet(input.id);
  const s = parse(input);
  if (nameTaken(s.name, before.id)) throw new V.UserError(`You already have a space called "${s.name}"`);
  run(
    `UPDATE spaces SET name = ?, light = ?, note = ?, updated_at = ${NOW} WHERE id = ?`,
    s.name,
    s.light,
    s.note,
    before.id,
  );
  const after = getSpace(before.id)!;
  emitSpace(getDb(), { type: "updated", before, after });
  return after;
}

/** Delete a space. Its plants stay in the collection, unplaced. */
export function removeSpace(input: { id: unknown }): void {
  const space = mustGet(input.id);
  run("DELETE FROM spaces WHERE id = ?", space.id);
  emitSpace(getDb(), { type: "deleted", space });
}

// ---------- server function handlers ----------

export const createSpaceFn = (input: SpaceInput) => V.mutate(() => addSpace(input));
export const updateSpaceFn = (input: SpaceInput & { id: unknown }) => V.mutate(() => editSpace(input));
export const deleteSpaceFn = (input: { id: unknown }) => V.mutate(() => removeSpace(input));
