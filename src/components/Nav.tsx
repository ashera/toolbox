import Link from "next/link";

// The top navigation bar, shown on every page via the root layout.
export default function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      {/* Thin brand accent strip along the very top */}
      <div className="h-1 bg-brand" />
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-brand-fg">
            🧰
          </span>
          <span>Toolbox</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-black/60 transition-colors hover:text-brand dark:text-white/60"
        >
          All tools
        </Link>
      </nav>
    </header>
  );
}
