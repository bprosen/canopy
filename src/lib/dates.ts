/**
 * Calendar dates as YYYY-MM-DD strings in local time, and instants as ISO-8601 UTC timestamps. The clock can be
 * swapped in tests.
 */

let now: () => Date = () => new Date();

/** Pin "now" for tests. Pass `undefined` to go back to the real clock. */
export function setClockForTests(fn: (() => Date) | undefined) {
  now = fn ?? (() => new Date());
}

/** The current instant as an ISO timestamp, e.g. "2026-01-15T12:00:00.000Z". */
export function nowISO(): string {
  return now().toISOString();
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date. */
export function today(): string {
  return toISODate(now());
}

/** The local calendar date an instant falls on. */
export function dateOf(timestamp: string): string {
  return toISODate(new Date(timestamp));
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). Safe across daylight-saving changes. */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  );
}

/** The Monday (or Sunday, with `weekStart` 0) on or before a date. */
export function startOfWeek(iso: string, weekStart: 0 | 1 = 1): string {
  const day = parse(iso).getDay();
  return addDays(iso, -((day - weekStart + 7) % 7));
}

/** "today", "yesterday", "3 days ago", "in 2 days". */
export function relativeDays(iso: string, from: string = today()): string {
  const n = daysBetween(from, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "Jan 15, 2026". */
export function formatDate(iso: string): string {
  return parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Thu, Jan 15". */
export function formatDay(iso: string): string {
  return parse(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Mon", "Tue"… */
export function weekdayShort(iso: string): string {
  return parse(iso).toLocaleDateString("en-US", { weekday: "short" });
}

/** "Tuesday". */
export function weekdayLong(iso: string): string {
  return parse(iso).toLocaleDateString("en-US", { weekday: "long" });
}

/** "November 17". */
export function monthDay(iso: string): string {
  return parse(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** The later of two YYYY-MM-DD dates (they compare as strings). */
export function laterDate(a: string, b: string): string {
  return a >= b ? a : b;
}
