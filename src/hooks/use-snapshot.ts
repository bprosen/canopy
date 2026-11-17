import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { allSchedules, careByPlant, type PlantCare } from "@/lib/care";
import { today } from "@/lib/dates";

const root = getRouteApi("__root__");

/** The user's whole dataset, loaded once by the root route and refreshed after every mutation. */
export function useSnapshot() {
  return root.useLoaderData();
}

/** Snapshot plus schedules and the lookups most pages need, memoized per snapshot. */
export function useGarden() {
  const snapshot = useSnapshot();
  return useMemo(() => {
    const on = today();
    const schedules = allSchedules(snapshot, on);
    return {
      snapshot,
      settings: snapshot.settings,
      today: on,
      schedules,
      scheduleByPlant: new Map<number, PlantCare>(schedules.map((s) => [s.plant.id, s])),
      plantById: new Map(snapshot.plants.map((p) => [p.id, p])),
      spaceById: new Map(snapshot.spaces.map((s) => [s.id, s])),
      careByPlant: careByPlant(snapshot.care),
    };
  }, [snapshot]);
}

/**
 * A feature's slice of the snapshot: whatever its `ServerFeature.snapshot` returned, refreshed after every
 * mutation. Undefined if the feature has no server side.
 */
export function useFeatureData<T>(id: string): T | undefined {
  return useSnapshot().features[id] as T | undefined;
}
