import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, House, Leaf, MapPin, Plus, Settings, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGarden } from "@/hooks/use-snapshot";
import { dueNow } from "@/lib/care";
import { type NavItem, slot } from "@/lib/features";
import { cn } from "@/lib/utils";
import { AddPlantDialog } from "./plant-dialogs";
import { ThemeToggle } from "./theme-toggle";

/** Base pages, then each feature's links (primary ones first). Settings lives in the top bar. */
function buildNav(): NavItem[] {
  const features = slot("nav");
  return [
    { to: "/", label: "Today", icon: House },
    { to: "/plants", label: "Plants", icon: Leaf },
    { to: "/spaces", label: "Spaces", icon: MapPin },
    { to: "/species", label: "Species", icon: BookOpen },
    ...features.filter((n) => n.primary),
    ...features.filter((n) => !n.primary),
  ];
}

const NAV = buildNav();

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Canopy home">
      <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <Sprout className="size-4.5" strokeWidth={2} />
      </span>
      <span className="latin text-3xl leading-none">Canopy</span>
    </Link>
  );
}

/** The slim bar at the top: wordmark, theme and settings. */
export function TopBar() {
  const pathname = useLocation({ select: (l) => l.pathname });
  return (
    <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Wordmark />
      <div className="flex items-center gap-1">
        <ThemeToggle className="rounded-full" />
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isActive(pathname, "/settings") && "bg-secondary")}
        >
          <Link to="/settings" aria-label="Settings">
            <Settings className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

/**
 * The floating dock: a frosted pill centered at the bottom of every screen, with the main pages and a raised
 * button for adding a plant. A dot on "Today" means something is due.
 */
export function Dock() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const { schedules } = useGarden();
  const due = dueNow(schedules).length;
  return (
    <nav
      aria-label="Main"
      className="glass fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full p-1.5"
    >
      {NAV.map((n) => {
        const on = isActive(pathname, n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <n.icon className="size-4.5" />
            <span className={cn("hidden sm:inline", on && "inline")}>{n.label}</span>
            {n.to === "/" && due > 0 && (
              <span
                className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-water text-[10px] font-semibold text-white"
                title={`${due} due`}
              >
                {due > 9 ? "9+" : due}
              </span>
            )}
          </Link>
        );
      })}
      <AddPlantDialog
        trigger={
          <button
            type="button"
            aria-label="Add plant"
            className="ml-1 grid size-11 shrink-0 place-items-center rounded-full bg-leaf text-white shadow-md transition-transform hover:scale-105"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
        }
      />
    </nav>
  );
}
