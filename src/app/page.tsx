import Link from "next/link";
import { tools } from "@/lib/tools";

// The homepage: a gallery of cards, one per tool in the registry.
export default function Home() {
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
