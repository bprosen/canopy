import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { type ServerFeature, serverFeatures } from "./features.server";

// ---------- migrations ----------

/** A schema change with a globally unique id ("base/001-initial", "<feature id>/<name>"). */
export type Migration = { id: string; up: (db: DatabaseSync) => void };

export const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

/** The base schema. To change it, APPEND a migration and never edit one that has shipped. */
export const BASE_MIGRATIONS: Migration[] = [
  {
    id: "base/001-initial",
    up: (db) =>
      db.exec(`
        CREATE TABLE spaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          light TEXT NOT NULL CHECK (light IN ('low', 'medium', 'bright', 'direct')),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT ${NOW},
          updated_at TEXT NOT NULL DEFAULT ${NOW}
        );

        CREATE TABLE plants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          species_id TEXT NOT NULL,
          nickname TEXT,
          space_id INTEGER REFERENCES spaces (id) ON DELETE SET NULL,
          acquired_on TEXT NOT NULL,
          water_every_days INTEGER CHECK (water_every_days BETWEEN 1 AND 365),
          feed_every_days INTEGER CHECK (feed_every_days BETWEEN 1 AND 365),
          note TEXT,
          archived_on TEXT,
          archive_reason TEXT CHECK (archive_reason IN ('died', 'rehomed', 'other')),
          created_at TEXT NOT NULL DEFAULT ${NOW},
          updated_at TEXT NOT NULL DEFAULT ${NOW},
          CHECK ((archived_on IS NULL) = (archive_reason IS NULL))
        );
        CREATE INDEX plants_space ON plants (space_id);
        CREATE INDEX plants_species ON plants (species_id);

        CREATE TABLE care_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plant_id INTEGER NOT NULL REFERENCES plants (id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('water', 'feed', 'repot', 'prune', 'note')),
          on_date TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT ${NOW}
        );
        CREATE INDEX care_events_plant ON care_events (plant_id, kind, on_date);

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `),
  },
];

/** Base migrations first, then each feature's, in feature-id order. */
export function allMigrations(features: ServerFeature[] = serverFeatures()): Migration[] {
  const out = [...BASE_MIGRATIONS];
  for (const f of features) {
    for (const m of f.migrations ?? []) out.push({ id: `${f.id}/${m.name}`, up: m.up });
  }
  const ids = out.map((m) => m.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`Duplicate migration "${dupe}"`);
  return out;
}

/** Ids of the migrations already applied to `db`. */
export function appliedMigrations(db: DatabaseSync): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT ${NOW})`);
  return (db.prepare("SELECT id FROM _migrations ORDER BY rowid").all() as { id: string }[]).map((r) => r.id);
}

/**
 * Apply every migration not yet recorded in `_migrations`, each in its own transaction. Tracking by id (not by
 * count) lets features add migrations independently of each other. Safe to call on every startup.
 */
export function migrate(db: DatabaseSync, migrations: Migration[] = allMigrations()): void {
  const done = new Set(appliedMigrations(db));
  const record = db.prepare("INSERT INTO _migrations (id) VALUES (?)");
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      m.up(db);
      record.run(m.id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration "${m.id}" failed`, { cause: err });
    }
  }
}

// ---------- connection ----------

const DB_PATH = process.env.CANOPY_DB_PATH ?? path.join(process.cwd(), "data", "canopy.db");

declare global {
  var __canopyDb: DatabaseSync | undefined;
}

/** Open a connection with Canopy's pragmas and run pending migrations. */
export function openDb(file: string = DB_PATH): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

/** Shared connection; cached on globalThis so dev HMR doesn't open a new handle on each reload. */
export function getDb(): DatabaseSync {
  globalThis.__canopyDb ??= openDb();
  return globalThis.__canopyDb;
}

/** Replace the shared connection (tests use this to start from a clean in-memory database). */
export function resetDbForTests(): DatabaseSync {
  globalThis.__canopyDb?.close();
  globalThis.__canopyDb = openDb(":memory:");
  return globalThis.__canopyDb;
}

/** Run `fn` inside a transaction, rolling back on error. */
export function tx<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------- typed query helpers ----------

const statements = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

function statement(sql: string): StatementSync {
  const db = getDb();
  let cache = statements.get(db);
  if (!cache) {
    cache = new Map();
    statements.set(db, cache);
  }
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}

/** All rows of a query, typed as `T` (which must describe the selected columns). */
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return statement(sql).all(...params) as T[];
}

/** First row of a query, or `undefined`. */
export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return statement(sql).get(...params) as T | undefined;
}

/** Execute a write. */
export function run(sql: string, ...params: SQLInputValue[]) {
  return statement(sql).run(...params);
}

// ---------- row types ----------

export type SpaceRow = {
  id: number;
  name: string;
  light: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};
export type PlantRow = {
  id: number;
  species_id: string;
  nickname: string | null;
  space_id: number | null;
  acquired_on: string;
  water_every_days: number | null;
  feed_every_days: number | null;
  note: string | null;
  archived_on: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};
export type CareRow = {
  id: number;
  plant_id: number;
  kind: string;
  on_date: string;
  note: string | null;
  created_at: string;
};
export type SettingRow = { key: string; value: string };
