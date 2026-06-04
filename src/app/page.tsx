import Link from "next/link";
import { tools } from "@/lib/tools";
import { prisma } from "@/lib/prisma";

// This page reads live data (the notes count) from the database, so it renders
// dynamically on each request rather than being statically cached.

type NotesStats = { count: number; lastAddedAt: Date | null };

// Load stats for the Quick Notes card. Wrapped in try/catch so a missing or
// unreachable database just hides the stats instead of crashing the homepage.
async function getNotesStats(): Promise<NotesStats | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const [count, latest] = await Promise.all([
      prisma.note.count(),
      prisma.note.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    return { count, lastAddedAt: latest?.createdAt ?? null };
  } catch {
    return null;
  }
}

// Turn a date into a short "2 hours ago" style string.
function timeAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secsPerUnit] of units) {
    if (Math.abs(seconds) >= secsPerUnit || unit === "second") {
      return rtf.format(-Math.round(seconds / secsPerUnit), unit);
    }
  }
  return "just now";
}

// The homepage: a gallery of cards, one per tool in the registry.
export default async function Home() {
  const notesStats = await getNotesStats();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">🧰 My Toolbox</h1>
        <p className="mt-2 max-w-2xl text-black/60 dark:text-white/60">
          A home for the little tools I build. Pick one below — or add a new one
          by dropping a page in <code>src/app/tools/</code> and registering it in{" "}
          <code>src/lib/tools.ts</code>.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group rounded-xl border border-black/10 p-5 transition-all hover:-translate-y-0.5 hover:border-black/30 hover:shadow-md dark:border-white/15 dark:hover:border-white/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{tool.icon}</span>
              <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
                {tool.category}
              </span>
            </div>
            <h2 className="mt-4 font-semibold group-hover:underline">
              {tool.name}
            </h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {tool.description}
            </p>
            {tool.slug === "notes" && notesStats && (
              <p className="mt-3 border-t border-black/5 pt-3 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                {notesStats.count === 0 ? (
                  "No notes yet"
                ) : (
                  <>
                    📋 {notesStats.count}{" "}
                    {notesStats.count === 1 ? "note" : "notes"}
                    {notesStats.lastAddedAt && (
                      <>
                        {" · last added "}
                        <span title={notesStats.lastAddedAt.toLocaleString()}>
                          {timeAgo(notesStats.lastAddedAt)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </p>
            )}
          </Link>
        ))}
      </section>

      {tools.length === 0 && (
        <p className="text-black/50 dark:text-white/50">
          No tools yet. Add your first one in <code>src/lib/tools.ts</code>.
        </p>
      )}
    </main>
  );
}
