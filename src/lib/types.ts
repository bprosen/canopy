/** Shapes shared by the server (which builds them from SQLite) and the client (which renders them). */
import type { Light } from "@/data/species";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Things you do to a plant. Watering and feeding are scheduled; the rest are just recorded. */
export type CareKind = "water" | "feed" | "repot" | "prune" | "note";
export const CARE_KINDS: CareKind[] = ["water", "feed", "repot", "prune", "note"];
export const SCHEDULED_KINDS = ["water", "feed"] as const;
export type ScheduledKind = (typeof SCHEDULED_KINDS)[number];

/** Why a plant left the collection. */
export type ArchiveReason = "died" | "rehomed" | "other";
export const ARCHIVE_REASONS: ArchiveReason[] = ["died", "rehomed", "other"];

export type Plant = {
  id: number;
  /** A catalog species id (see `src/data/species.ts`). */
  speciesId: string;
  /** What you call it ("Big Monty"). Null shows the species name. */
  nickname: string | null;
  /** The space it lives in, or null if it isn't placed anywhere yet. */
  spaceId: number | null;
  /** YYYY-MM-DD it joined the collection. The watering schedule counts from here until the first watering. */
  acquiredOn: string;
  /** Days between waterings for this plant, or null to use the species default. */
  waterEveryDays: number | null;
  /** Days between feeds for this plant, or null to use the species default. */
  feedEveryDays: number | null;
  note: string | null;
  /** Archived plants keep their history but leave the schedule. */
  archivedOn: string | null;
  archiveReason: ArchiveReason | null;
  createdAt: string;
  updatedAt: string;
};

export type CareEvent = {
  id: number;
  plantId: number;
  kind: CareKind;
  /** YYYY-MM-DD it was done. */
  on: string;
  note: string | null;
  createdAt: string;
};

export type Space = {
  id: number;
  /** "Living room", "Kitchen sill", "Balcony". */
  name: string;
  /** How much light the space gets. Compared with each plant's needs. */
  light: Light;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  displayName: string;
  /** Plants due within this many days count as "soon". */
  soonDays: number;
};

/** Any JSON value. Feature snapshot slices must be JSON so they survive the trip to the browser and exports. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Everything the app knows about the user. Small enough to ship whole to every page. */
export type Snapshot = {
  settings: Settings;
  /** By name, archived ones included. */
  plants: Plant[];
  /** Newest first. */
  care: CareEvent[];
  /** By name. */
  spaces: Space[];
  /**
   * Each feature's own slice, keyed by feature id (see `snapshot` in `ServerFeature`).
   * Read it with `useFeatureData(id)`.
   */
  features: Record<string, Json>;
};

export const DEFAULT_SETTINGS: Settings = { displayName: "Gardener", soonDays: 2 };

export const EMPTY_SNAPSHOT: Snapshot = { settings: DEFAULT_SETTINGS, plants: [], care: [], spaces: [], features: {} };
