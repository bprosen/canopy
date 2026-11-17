/**
 * TanStack Start server functions (RPC) for the base app. Loaders and components import from here; the SQLite
 * code in `*.server.ts` never reaches the browser bundle. Features define their own in their folder, the same way.
 */
import { createServerFn } from "@tanstack/react-start";
import type { Light } from "@/data/species";
import * as C from "./care.server";
import * as D from "./data.server";
import * as P from "./plants.server";
import { readSnapshot } from "./snapshot.server";
import * as S from "./spaces.server";
import type { ArchiveReason, CareKind } from "./types";

/** Minimal runtime guard: payloads must be plain objects. Field-level validation happens in the handlers. */
export function objectInput<T>(d: T): T {
  if (typeof d !== "object" || d === null || Array.isArray(d)) throw new Error("Invalid input");
  return d;
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(() => readSnapshot());

type IdInput = { id: number };

// ---------- plants ----------

export type PlantFields = {
  nickname?: string | null;
  spaceId?: number | null;
  acquiredOn?: string;
  waterEveryDays?: number | null;
  feedEveryDays?: number | null;
  note?: string | null;
};

export const addPlant = createServerFn({ method: "POST" })
  .validator((d: PlantFields & { speciesId: string }) => objectInput(d))
  .handler(({ data }) => P.addPlantFn(data));

export const updatePlant = createServerFn({ method: "POST" })
  .validator((d: PlantFields & IdInput) => objectInput(d))
  .handler(({ data }) => P.updatePlantFn(data));

export const archivePlant = createServerFn({ method: "POST" })
  .validator((d: IdInput & { reason: ArchiveReason; on?: string }) => objectInput(d))
  .handler(({ data }) => P.archivePlantFn(data));

export const restorePlant = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => P.restorePlantFn(data));

export const deletePlant = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => P.deletePlantFn(data));

// ---------- care ----------

export const logCare = createServerFn({ method: "POST" })
  .validator((d: { plantId: number; kind: CareKind; on?: string; note?: string | null }) => objectInput(d))
  .handler(({ data }) => C.logCareFn(data));

export const logCareBulk = createServerFn({ method: "POST" })
  .validator((d: { plantIds: number[]; kind: Exclude<CareKind, "note">; on?: string }) => objectInput(d))
  .handler(({ data }) => C.logCareBulkFn(data));

export const updateCare = createServerFn({ method: "POST" })
  .validator((d: IdInput & { on?: string; note?: string | null }) => objectInput(d))
  .handler(({ data }) => C.updateCareFn(data));

export const deleteCare = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => C.deleteCareFn(data));

// ---------- spaces ----------

export type SpaceFields = { name: string; light: Light; note?: string | null };

export const createSpace = createServerFn({ method: "POST" })
  .validator((d: SpaceFields) => objectInput(d))
  .handler(({ data }) => S.createSpaceFn(data));

export const updateSpace = createServerFn({ method: "POST" })
  .validator((d: SpaceFields & IdInput) => objectInput(d))
  .handler(({ data }) => S.updateSpaceFn(data));

export const deleteSpace = createServerFn({ method: "POST" })
  .validator((d: IdInput) => objectInput(d))
  .handler(({ data }) => S.deleteSpaceFn(data));

// ---------- settings and data ----------

export const saveSettings = createServerFn({ method: "POST" })
  .validator((d: { displayName?: string; soonDays?: number }) => objectInput(d))
  .handler(({ data }) => D.saveSettings(data));

export const loadSampleData = createServerFn({ method: "POST" }).handler(() => D.loadSampleData());

export const resetAll = createServerFn({ method: "POST" }).handler(() => D.resetAll());

export const importData = createServerFn({ method: "POST" })
  .validator((d: { snapshot: unknown }) => objectInput(d))
  .handler(({ data }) => D.importData(data));
