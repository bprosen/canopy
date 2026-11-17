import { Link } from "@tanstack/react-router";
import { Shovel } from "lucide-react";
import { Button } from "@/components/ui/button";

/** An empty pot where the page should be. */
export function NotFound({ what = "page" }: { what?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-clay/15 text-clay">
        <Shovel className="size-8" strokeWidth={1.5} />
      </span>
      <h1 className="font-display text-5xl">This pot is empty</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn't find that {what}. It may have been deleted, or the link is wrong.
      </p>
      <Button asChild className="rounded-full">
        <Link to="/">Back to today</Link>
      </Button>
    </div>
  );
}
