import { listCare } from "./care.server";
import { all, getDb, type SettingRow } from "./db.server";
import { serverFeatures } from "./features.server";
import { listPlants } from "./plants.server";
import { listSpaces } from "./spaces.server";
import { DEFAULT_SETTINGS, type Json, type Settings, type Snapshot } from "./types";

export function readSettings(): Settings {
  const m = new Map(all<SettingRow>("SELECT key, value FROM settings").map((r) => [r.key, r.value]));
  const soon = Number(m.get("soonDays"));
  return {
    displayName: m.get("displayName") || DEFAULT_SETTINGS.displayName,
    soonDays: Number.isInteger(soon) && soon >= 0 && soon <= 14 ? soon : DEFAULT_SETTINGS.soonDays,
  };
}

/** Read everything the UI needs in one go: the base data plus each feature's slice. */
export function readSnapshot(): Snapshot {
  const db = getDb();
  const features: Record<string, Json> = {};
  for (const f of serverFeatures()) {
    // `snapshot` is typed loosely so features can return their own row types; they must be JSON-shaped.
    if (f.snapshot) features[f.id] = (f.snapshot(db) ?? null) as Json;
  }
  return { settings: readSettings(), plants: listPlants(), care: listCare(), spaces: listSpaces(), features };
}
