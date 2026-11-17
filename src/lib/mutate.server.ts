/** The plumbing every write goes through: a transaction, a uniform result, and input validation. */
import type { DatabaseSync } from "node:sqlite";
import { getSpecies, LIGHT_IDS, type Light, type Species } from "@/data/species";
import { tx } from "./db.server";
import type { ActionResult } from "./types";

/** A mistake the user can fix. Its message is shown to them as-is. */
export class UserError extends Error {}

/**
 * Wrap a mutation: run it in a transaction and return a uniform result. User mistakes (`UserError`) come back
 * as `{ ok: false, error }`; anything else is logged and reported generically. Features use this for their own
 * server functions too.
 */
export async function mutate<T>(fn: (db: DatabaseSync) => T): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: tx(fn) };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function str(v: unknown, field: string, { required = false, max = 2000 } = {}): string | null {
  if (v == null || v === "") {
    if (required) throw new UserError(`${field} is required`);
    return null;
  }
  if (typeof v !== "string") throw new UserError(`${field} must be text`);
  const s = v.trim();
  if (required && !s) throw new UserError(`${field} is required`);
  if (s.length > max) throw new UserError(`${field} is too long (max ${max} characters)`);
  return s || null;
}

export function int(v: unknown, field: string, { min = 0, max = 1_000_000 } = {}): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new UserError(`${field} must be a whole number`);
  if (n < min || n > max) throw new UserError(`${field} must be between ${min} and ${max}`);
  return n;
}

/** An ISO-8601 timestamp, normalized to UTC ("2026-01-15T18:30:00.000Z"), or null if blank. */
export function timestamp(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v))
    throw new UserError(`${field} must be a valid date and time`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new UserError(`${field} must be a valid date and time`);
  return d.toISOString();
}

/** A valid timestamp, or null. For lenient parsing of imported data. */
export function safeTimestamp(v: unknown): string | null {
  try {
    return timestamp(v, "time");
  } catch {
    return null;
  }
}

export function species(v: unknown): Species {
  const s = typeof v === "string" ? getSpecies(v) : undefined;
  if (!s) throw new UserError("Unknown plant species");
  return s;
}

export function light(v: unknown): Light {
  if (!LIGHT_IDS.includes(v as Light)) throw new UserError("Light must be low, medium, bright or direct");
  return v as Light;
}

/** A YYYY-MM-DD calendar date, or null if blank. */
export function isoDate(v: unknown, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError(`${field} must be a valid date`);
  const [y, mo, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    throw new UserError(`${field} must be a valid date`);
  return v;
}

/** A valid YYYY-MM-DD date, or null. For lenient parsing of imported data. */
export function safeDate(v: unknown): string | null {
  try {
    return isoDate(v, "date");
  } catch {
    return null;
  }
}

/** A positive integer row id. */
export function id(v: unknown, what = "Item"): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 1) throw new UserError(`${what} not found`);
  return n;
}
