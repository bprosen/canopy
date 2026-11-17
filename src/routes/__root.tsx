import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Dock, TopBar } from "@/components/canopy/app-shell";
import { Providers } from "@/components/providers";
import { slot } from "@/lib/features";
import { getSnapshot } from "@/lib/server-fns";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Canopy — your plants, cared for" },
      { name: "description", content: "Track your houseplants, know who's thirsty, and keep every leaf happy." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>",
      },
    ],
  }),
  // The whole dataset is small, so every page reads from this one loader. Mutations invalidate it.
  loader: () => getSnapshot(),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  );
}

const OVERLAYS = slot("overlays");

function RootLayout() {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-4 pt-2 pb-36 sm:px-6">
        <Outlet />
      </main>
      <Dock />
      {OVERLAYS.map((Overlay, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the overlay list is fixed at build time.
        <Overlay key={i} />
      ))}
    </>
  );
}
