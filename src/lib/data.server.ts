/** Settings, and the whole-dataset operations: sample data, import and reset. */
import type { DatabaseSync } from "node:sqlite";
import { getSpecies, isSpeciesId, LIGHT_IDS, type Light } from "@/data/species";
import { addDays, today } from "./dates";
import { get, run } from "./db.server";
import { serverFeatures } from "./features.server";
import * as V from "./mutate.server";
import { SAMPLE_PLANTS, SAMPLE_SETTINGS, SAMPLE_SPACES, sampleHistory } from "./sample-data";
import { ARCHIVE_REASONS, type ArchiveReason, CARE_KINDS, type CareKind, type Snapshot } from "./types";

// ---------- settings ----------

function setSetting(key: string, value: string | null) {
  if (value == null) run("DELETE FROM settings WHERE key = ?", key);
  else
    run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
}

export type SettingsInput = { displayName?: unknown; soonDays?: unknown };

export function saveSettings(input: SettingsInput) {
  return V.mutate(() => {
    if (input.displayName !== undefined)
      setSetting("displayName", V.str(input.displayName, "Display name", { max: 40 }));
    if (input.soonDays !== undefined) {
      const n = V.int(input.soonDays, "Heads-up window", { min: 0, max: 14 });
      setSetting("soonDays", n == null ? null : String(n));
    }
  });
}

// ---------- bulk ----------

const BASE_TABLES = ["care_events", "plants", "spaces", "settings"];

function clearAll(db: DatabaseSync) {
  for (const f of serverFeatures()) f.reset?.(db);
  for (const t of BASE_TABLES) run(`DELETE FROM ${t}`);
}

export function resetAll() {
  return V.mutate((db) => clearAll(db));
}

/**
 * Merge the demo dataset into whatever is already there, then let each feature add its own demo rows. Running
 * it twice adds nothing new: spaces are matched by name, and a sample plant is skipped if that space already
 * has a plant of the same species.
 */
export function loadSampleData() {
  return V.mutate((db) => {
    const t = today();
    const spaceIds = new Map<string, number>();
    for (const s of SAMPLE_SPACES) {
      const existing = get<{ id: number }>("SELECT id FROM spaces WHERE name = ? COLLATE NOCASE", s.name);
      if (existing) spaceIds.set(s.name, existing.id);
      else
        spaceIds.set(
          s.name,
          Number(
            run("INSERT INTO spaces (name, light, note) VALUES (?, ?, ?)", s.name, s.light, s.note ?? null)
              .lastInsertRowid,
          ),
        );
    }
    for (const p of SAMPLE_PLANTS) {
      const spaceId = spaceIds.get(p.space)!;
      if (get("SELECT 1 FROM plants WHERE species_id = ? AND space_id = ?", p.speciesId, spaceId)) continue;
      const species = getSpecies(p.speciesId)!;
      const plantId = Number(
        run(
          "INSERT INTO plants (species_id, nickname, space_id, acquired_on, water_every_days, note) VALUES (?, ?, ?, ?, ?, ?)",
          species.id,
          p.nickname ?? null,
          spaceId,
          addDays(t, -p.acquiredDaysAgo),
          p.waterEveryDays ?? null,
          p.note ?? null,
        ).lastInsertRowid,
      );
      for (const c of sampleHistory(p, p.waterEveryDays ?? species.waterDays, species.feedDays)) {
        run(
          "INSERT INTO care_events (plant_id, kind, on_date, note) VALUES (?, ?, ?, ?)",
          plantId,
          c.kind,
          addDays(t, -c.daysAgo),
          c.note ?? null,
        );
      }
    }
    if (!get("SELECT 1 FROM settings WHERE key = 'displayName'"))
      setSetting("displayName", SAMPLE_SETTINGS.displayName);
    for (const f of serverFeatures()) f.loadSample?.(db);
  });
}

/**
 * Replace all data with an exported snapshot, keeping the original ids so feature data that points at plants,
 * care and spaces still lines up. Anything invalid (unknown species, broken dates) is dropped rather than
 * failing the whole import. Each feature then restores its own slice from `snapshot.features[id]`.
 */
export function importData(input: { snapshot: unknown }) {
  return V.mutate((db) => {
    const s = input.snapshot as Partial<Record<keyof Snapshot, unknown>> | null;
    if (!s || typeof s !== "object" || !Array.isArray(s.plants) || !Array.isArray(s.care) || !Array.isArray(s.spaces))
      throw new V.UserError("That doesn't look like a Canopy export");
    clearAll(db);
    for (const sp of s.spaces) importSpace(sp);
    for (const p of s.plants) importPlant(p);
    for (const c of s.care) importCare(c);
    importSettings(s.settings);
    const slices = (s.features && typeof s.features === "object" ? s.features : {}) as Record<string, unknown>;
    for (const f of serverFeatures()) {
      if (f.importData && slices[f.id] !== undefined) f.importData(db, slices[f.id]);
    }
  });
}

type Loose = Record<string, unknown>;

function positiveId(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) > 0 ? (v as number) : null;
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.trim().slice(0, max) || null : null;
}

function interval(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 365 ? (v as number) : null;
}

/** Restore exported created/updated times, so an import is a faithful copy. */
function keepTimestamps(table: "spaces" | "plants" | "care_events", id: number, raw: Loose) {
  const created = V.safeTimestamp(raw.createdAt);
  if (created) run(`UPDATE ${table} SET created_at = ? WHERE id = ?`, created, id);
  if (table === "care_events") return;
  const updated = V.safeTimestamp(raw.updatedAt);
  if (updated) run(`UPDATE ${table} SET updated_at = ? WHERE id = ?`, updated, id);
}

function importSpace(raw: unknown) {
  const sp = (raw ?? {}) as Loose;
  const id = positiveId(sp.id);
  const name = text(sp.name, 60);
  if (!id || !name || get("SELECT 1 FROM spaces WHERE id = ? OR name = ? COLLATE NOCASE", id, name)) return;
  const light = LIGHT_IDS.includes(sp.light as Light) ? (sp.light as Light) : "medium";
  run("INSERT INTO spaces (id, name, light, note) VALUES (?, ?, ?, ?)", id, name, light, text(sp.note, 500));
  keepTimestamps("spaces", id, sp);
}

function importPlant(raw: unknown) {
  const p = (raw ?? {}) as Loose;
  const id = positiveId(p.id);
  const acquiredOn = V.safeDate(p.acquiredOn);
  if (!id || !isSpeciesId(p.speciesId) || !acquiredOn || get("SELECT 1 FROM plants WHERE id = ?", id)) return;
  const spaceId = positiveId(p.spaceId);
  let archivedOn = V.safeDate(p.archivedOn);
  let reason = ARCHIVE_REASONS.includes(p.archiveReason as ArchiveReason) ? (p.archiveReason as ArchiveReason) : null;
  if (archivedOn && !reason) reason = "other";
  if (!archivedOn) reason = null;
  if (archivedOn && archivedOn < acquiredOn) archivedOn = acquiredOn;
  run(
    "INSERT INTO plants (id, species_id, nickname, space_id, acquired_on, water_every_days, feed_every_days, note, archived_on, archive_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    p.speciesId,
    text(p.nickname, 60),
    spaceId && get("SELECT 1 FROM spaces WHERE id = ?", spaceId) ? spaceId : null,
    acquiredOn,
    interval(p.waterEveryDays),
    interval(p.feedEveryDays),
    text(p.note, 1000),
    archivedOn,
    reason,
  );
  keepTimestamps("plants", id, p);
}

function importCare(raw: unknown) {
  const c = (raw ?? {}) as Loose;
  const id = positiveId(c.id);
  const plantId = positiveId(c.plantId);
  const on = V.safeDate(c.on);
  if (!id || !plantId || !on || !CARE_KINDS.includes(c.kind as CareKind)) return;
  if (!get("SELECT 1 FROM plants WHERE id = ?", plantId) || get("SELECT 1 FROM care_events WHERE id = ?", id)) return;
  const note = text(c.note, 1000);
  if (c.kind === "note" && !note) return;
  run(
    "INSERT INTO care_events (id, plant_id, kind, on_date, note) VALUES (?, ?, ?, ?, ?)",
    id,
    plantId,
    c.kind as CareKind,
    on,
    note,
  );
  keepTimestamps("care_events", id, c);
}

function importSettings(raw: unknown) {
  const st = (raw ?? {}) as Loose;
  const name = text(st.displayName, 40);
  if (name) setSetting("displayName", name);
  if (Number.isInteger(st.soonDays) && (st.soonDays as number) >= 0 && (st.soonDays as number) <= 14)
    setSetting("soonDays", String(st.soonDays));
}
