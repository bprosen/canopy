/** Every page opens with a serif headline, an optional small line above it, and actions on the right. */
export function PageHeader({
  kicker,
  title,
  meta,
  children,
}: {
  /** A small line above the title. */
  kicker?: React.ReactNode;
  title: React.ReactNode;
  /** A line under the title. */
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2 text-leaf">{kicker}</p>}
        <h1 className="font-display text-5xl leading-[1.05] break-words sm:text-6xl">{title}</h1>
        {meta && <div className="mt-2 max-w-2xl text-muted-foreground">{meta}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** A section title with an optional count and an action on the right. */
export function SectionTitle({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-3xl">
        {children}
        {count != null && <span className="font-sans text-sm text-muted-foreground tabular-nums">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/** Pending state while a route loads: three sprouts growing and shrinking. */
export function PageSkeleton() {
  return (
    <div className="grid place-items-center gap-4 py-28" role="status" aria-label="Loading">
      <div className="flex h-10 items-end gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-full w-2 origin-bottom rounded-full bg-leaf"
            style={{ animation: `sprout 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <p className="latin text-lg text-muted-foreground">Growing…</p>
    </div>
  );
}

/** A soft dashed placeholder for empty lists. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-foreground/10 px-6 py-12 text-center">
      <p className="font-display text-3xl text-muted-foreground">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
