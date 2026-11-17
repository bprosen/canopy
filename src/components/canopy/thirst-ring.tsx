import { Droplet, Sprout } from "lucide-react";
import type { CareStatus, Schedule } from "@/lib/care";
import { cn } from "@/lib/utils";

/** Text and fill colors for a care status. */
export const STATUS_TONE: Record<CareStatus, { text: string; stroke: string; chip: string }> = {
  overdue: { text: "text-clay", stroke: "stroke-clay", chip: "bg-clay/15 text-clay" },
  due: { text: "text-water", stroke: "stroke-water", chip: "bg-water/15 text-water" },
  soon: { text: "text-sun", stroke: "stroke-sun", chip: "bg-sun/20 text-sun" },
  ok: { text: "text-leaf", stroke: "stroke-leaf", chip: "bg-leaf/15 text-leaf" },
};

/**
 * A ring that fills as the next watering (or feed) approaches: empty just after, full when due, and colored
 * terracotta once it's late. The icon in the middle says which kind of care it tracks.
 */
export function ThirstRing({
  schedule,
  size = 44,
  className,
}: {
  schedule: Schedule;
  size?: number;
  className?: string;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, schedule.progress);
  const tone = STATUS_TONE[schedule.status];
  const Icon = schedule.kind === "water" ? Droplet : Sprout;
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      title={`${schedule.kind === "water" ? "Watering" : "Feeding"}: ${Math.round(filled * 100)}% of the way to due`}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-foreground/10" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - filled)}
          className={cn(tone.stroke, "transition-[stroke-dashoffset] duration-500")}
        />
      </svg>
      <Icon
        className={cn("size-4", tone.text, schedule.status === "overdue" && "animate-[drip_1.6s_ease-in-out_infinite]")}
        strokeWidth={2}
        fill={schedule.status === "overdue" || schedule.status === "due" ? "currentColor" : "none"}
      />
    </span>
  );
}
