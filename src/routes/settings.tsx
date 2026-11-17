import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/canopy/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/use-mutation";
import { useSnapshot } from "@/hooks/use-snapshot";
import { slot } from "@/lib/features";
import { importData, loadSampleData, resetAll, saveSettings } from "@/lib/server-fns";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Canopy" }] }),
  component: SettingsPage,
});

const SECTIONS = slot("settingsSections");

function SettingsPage() {
  const snapshot = useSnapshot();
  const { run, pending } = useMutation();
  const [name, setName] = useState(snapshot.settings.displayName);
  const [soonDays, setSoonDays] = useState(String(snapshot.settings.soonDays));
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setName(snapshot.settings.displayName);
    setSoonDays(String(snapshot.settings.soonDays));
  }, [snapshot.settings]);

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ app: "canopy", version: 1, exportedAt: new Date().toISOString(), ...snapshot }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("That file isn't valid JSON");
      return;
    }
    run(() => importData({ data: { snapshot: parsed } }), { success: "Import complete" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="Preferences" title="Settings" />

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>You</CardTitle>
          <CardDescription>How Canopy greets you, and how early it gives you a heads-up.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveSettings({ data: { displayName: name, soonDays: Number(soonDays) } }), {
                success: "Settings saved",
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="soon">Heads-up window (days)</Label>
              <Input
                id="soon"
                type="number"
                min={0}
                max={14}
                required
                className="w-28 rounded-xl"
                value={soonDays}
                onChange={(e) => setSoonDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Plants due within this many days are marked "soon".</p>
            </div>
            <Button type="submit" disabled={pending} className="rounded-full">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {SECTIONS.map((Section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the section list is fixed at build time.
        <Section key={i} />
      ))}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything lives in a local SQLite file (data/canopy.db). Back it up as JSON any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson} className="rounded-full">
            <Download className="size-4" /> Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="rounded-full"
          >
            <Upload className="size-4" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            disabled={pending}
            className="rounded-full"
            onClick={() => run(() => loadSampleData(), { success: "Sample plants potted" })}
          >
            <Database className="size-4" /> Load sample data
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Start over</CardTitle>
          <CardDescription>Importing replaces all data. Resetting erases it.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={pending} className="rounded-full">
                <Trash2 className="size-4" /> Reset everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Erase all plant data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every plant, space, care entry and setting, and everything else Canopy has saved, will be permanently
                  deleted. Export first if you might want it back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-full"
                  onClick={() => run(() => resetAll(), { success: "Fresh soil" })}
                >
                  Erase everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
