/**
 * UI half of the feature registry.
 *
 * A feature lives in `src/features/<id>/` and default-exports a `Feature` from `index.ts` or `index.tsx`. It is
 * picked up automatically, with nothing to register by hand. Its pages are ordinary file routes in
 * `src/routes/`, and its database side (if any) is `index.server.ts`; see `features.server.ts`.
 *
 * This file must stay importable in the browser, so feature UI modules must never import `*.server.ts` files.
 * Talk to the server through `createServerFn` functions instead.
 */
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { Species } from "@/data/species";
import type { PlantCare } from "./care";
import { collectFeatures } from "./collect-features";
import type { CareEvent, Plant, Space } from "./types";

export type NavItem = {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: LucideIcon;
  /** Primary items come before the others in the dock. */
  primary?: boolean;
};

/** Props for a `plantCardExtras` component: the plant and its current schedules. */
export type PlantCardExtraProps = PlantCare;

/** Passed to `onCareLogged` after care is logged and saved. */
export type CareLoggedInfo = { plants: Plant[]; events: CareEvent[] };

export type Feature = {
  /** Must match the folder name: lowercase letters, digits and dashes. */
  id: string;
  /** Links to this feature's pages, added to the dock. */
  nav?: NavItem[];
  /** Cards on the Today page, below the base sections, in feature-id order. */
  homeWidgets?: ComponentType[];
  /**
   * Small extras on every plant card (Plants, Today, a space's page): a photo, a badge, an adjusted due date.
   * Return null to show nothing; the strip takes no space when every extra is empty.
   */
  plantCardExtras?: ComponentType<PlantCardExtraProps>[];
  /** Panels on each plant's page, below its care schedule and before its history. */
  plantSections?: ComponentType<{ plant: Plant }>[];
  /** Panels on each space's page, below its plants. */
  spaceSections?: ComponentType<{ space: Space }>[];
  /** Panels on each catalog species page, below its care facts. */
  speciesSections?: ComponentType<{ species: Species }>[];
  /** Cards on the Settings page, between the profile and data sections, for the feature's own options. */
  settingsSections?: ComponentType[];
  /** Mounted once in the root layout, for dialogs, reminders and other global UI. */
  overlays?: ComponentType[];
  /**
   * Called in the browser right after care is logged and saved (one plant or many at once), e.g. to celebrate
   * or nudge. Server-side reactions belong in `onCareChange` instead.
   */
  onCareLogged?: (info: CareLoggedInfo) => void;
};

const modules = import.meta.glob<{ default: Feature }>("../features/*/index.{ts,tsx}", { eager: true });

// Resolved lazily, in case a feature module imports something that imports this file.
let features: Feature[] | undefined;

export function getFeatures(): Feature[] {
  features ??= collectFeatures(modules, "Feature");
  return features;
}

type ListSlot = Exclude<keyof Feature, "id" | "onCareLogged">;

/** Every feature's entries for one slot, flattened in feature-id order. */
export function slot<K extends ListSlot>(key: K): NonNullable<Feature[K]> {
  const out: unknown[] = [];
  for (const f of getFeatures()) out.push(...((f[key] ?? []) as unknown[]));
  return out as NonNullable<Feature[K]>;
}

/** Tell every feature care was logged. A feature that throws is logged and skipped. */
export function emitCareLogged(info: CareLoggedInfo) {
  for (const f of getFeatures()) {
    try {
      f.onCareLogged?.(info);
    } catch (err) {
      console.error(`Feature "${f.id}" failed in onCareLogged`, err);
    }
  }
}
