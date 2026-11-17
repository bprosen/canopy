import { Check, ChevronsUpDown, PawPrint, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FORMS, type Form, getSpecies, SPECIES, type Species } from "@/data/species";
import { matches } from "@/lib/search";
import { cn } from "@/lib/utils";
import { PlantGlyph } from "./plant-glyph";

export function matchesSpecies(s: Species, query: string): boolean {
  return (
    matches(s.name, query) || matches(s.latin, query) || matches(s.family, query) || matches(FORMS[s.form].label, query)
  );
}

/** Searchable combobox over the whole catalog, grouped by growth form. Searches common and Latin names. */
export function SpeciesPicker({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (speciesId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = value ? getSpecies(value) : undefined;
  const groups = useMemo(() => {
    const out = new Map<Form, Species[]>();
    for (const s of SPECIES) {
      if (!matchesSpecies(s, q)) continue;
      const list = out.get(s.form) ?? [];
      list.push(s);
      out.set(s.form, list);
    }
    return [...out.entries()];
  }, [q]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-auto min-h-11 justify-between rounded-xl py-2 font-normal", className)}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5 text-left">
              <PlantGlyph form={selected.form} size="sm" />
              <span className="min-w-0">
                <span className="block truncate">{selected.name}</span>
                <span className="latin block truncate text-xs text-muted-foreground">{selected.latin}</span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search 90 species…</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] rounded-2xl p-0" align="start">
        <div className="relative border-b p-2">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Monstera, Ficus, fern…"
            className="h-9 rounded-xl pl-8"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {groups.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No matches</p>}
          {groups.map(([form, list]) => (
            <div key={form}>
              <p className="kicker px-2 pt-2 pb-1 text-muted-foreground">{FORMS[form].label}</p>
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-accent",
                    s.id === value && "bg-accent/70",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.name}</span>
                    <span className="latin block truncate text-xs text-muted-foreground">{s.latin}</span>
                  </span>
                  {s.petSafe && <PawPrint className="size-3.5 text-leaf" aria-label="Pet safe" />}
                  {s.id === value && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
