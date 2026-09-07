import Link from "next/link";
import type { ReactNode } from "react";
import { getTool } from "@/lib/tools";

// A consistent wrapper for every tool page: a back link, the tool's icon +
// name + description pulled from the registry, then your tool's UI.
//
// Use it in a tool page like:
//   <ToolShell slug="word-counter">{/* your UI */}</ToolShell>
export default function ToolShell({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const tool = getTool(slug);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link
        href="/"
        className="text-sm text-black/50 transition-colors hover:text-black dark:text-white/50 dark:hover:text-white"
      >
        ← Back to toolbox
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-3xl ring-1 ring-brand/20">
          {tool?.icon ?? "🛠️"}
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{tool?.name ?? slug}</h1>
          {tool?.description && (
            <p className="mt-1 text-black/60 dark:text-white/60">
              {tool.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 h-px bg-gradient-to-r from-brand/40 to-transparent" />

      <div className="mt-6">{children}</div>
    </main>
  );
}
