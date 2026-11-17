/**
 * Server half of the feature registry.
 *
 * A feature lives in `src/features/<id>/`. If it needs the database it adds `index.server.ts`, which
 * default-exports a `ServerFeature`. It is picked up automatically, with nothing to register by hand. The UI
 * half (`index.ts(x)`, see `features.ts`) must never import this file or `index.server.ts`, so SQLite stays out
 * of the browser bundle.
 *
 * Every hook gets the open connection and runs inside the caller's transaction, so a failing hook rolls the
 * whole mutation back.
 */
import type { DatabaseSync } from "node:sqlite";
import { collectFeatures } from "./collect-features";
import type { CareEvent, Plant, Space } from "./types";

export type FeatureMigration = {
  /** Unique within the feature, e.g. "001-create-photos". Recorded as "<feature id>/<name>" once applied. */
  name: string;
  up: (db: DatabaseSync) => void;
};

/**
 * Something happened to a plant. Fired for user actions (and for features that call the helpers in
 * `plants.server.ts`), not for imports or sample data: features restore those through `importData` and
 * `loadSample`.
 */
export type PlantEvent =
  | { type: "added"; plant: Plant }
  | { type: "updated"; before: Plant; after: Plant }
  /** Left the collection (died, rehomed…). Its history is kept. */
  | { type: "archived"; plant: Plant }
  | { type: "restored"; plant: Plant }
  /** Deleted with all its care history. The rows are already gone; drop anything that points at it. */
  | { type: "deleted"; plant: Plant };

export type CareChange =
  /** Care was logged. Bulk logging ("water everything due") fires one per plant. */
  | { type: "logged"; event: CareEvent; plant: Plant }
  | { type: "updated"; before: CareEvent; after: CareEvent }
  /** The row is already gone. */
  | { type: "deleted"; event: CareEvent };

export type SpaceEvent =
  | { type: "created"; space: Space }
  | { type: "updated"; before: Space; after: Space }
  /** The row is already gone, and its plants are now unplaced. */
  | { type: "deleted"; space: Space };

export type ServerFeature = {
  /** Must match the folder name: lowercase letters, digits and dashes. */
  id: string;
  /** Schema changes, applied in order after the base schema. Append new ones; never edit one that has run. */
  migrations?: FeatureMigration[];
  /** This feature's slice of the root snapshot (`snapshot.features[id]`). Must be JSON-serializable. */
  snapshot?: (db: DatabaseSync) => unknown;
  onPlantChange?: (db: DatabaseSync, event: PlantEvent) => void;
  onCareChange?: (db: DatabaseSync, event: CareChange) => void;
  onSpaceChange?: (db: DatabaseSync, event: SpaceEvent) => void;
  /** Delete this feature's rows. Called by "Reset everything" and before an import replaces all data. */
  reset?: (db: DatabaseSync) => void;
  /**
   * Restore `snapshot.features[id]` from an export. Called after the base settings, spaces, plants and care are
   * in, with their original ids, so ids stored in the slice still point at the right rows.
   */
  importData?: (db: DatabaseSync, data: unknown) => void;
  /** Merge demo rows in for "Load sample data". Called after the base sample spaces, plants and care exist. */
  loadSample?: (db: DatabaseSync) => void;
};

const modules = import.meta.glob<{ default: ServerFeature }>("../features/*/index.server.ts", { eager: true });

// Resolved lazily: feature modules import the db helpers, which import this file.
let features: ServerFeature[] | undefined;

export function serverFeatures(): ServerFeature[] {
  features ??= collectFeatures(modules, "ServerFeature");
  return features;
}

/** Swap the registered features (tests only). Pass `undefined` to go back to the real ones. */
export function setServerFeaturesForTests(list: ServerFeature[] | undefined) {
  features = list;
}

export function emitPlant(db: DatabaseSync, event: PlantEvent) {
  for (const f of serverFeatures()) f.onPlantChange?.(db, event);
}

export function emitCare(db: DatabaseSync, event: CareChange) {
  for (const f of serverFeatures()) f.onCareChange?.(db, event);
}

export function emitSpace(db: DatabaseSync, event: SpaceEvent) {
  for (const f of serverFeatures()) f.onSpaceChange?.(db, event);
}
