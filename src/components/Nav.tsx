import Link from "next/link";

// The top navigation bar, shown on every page via the root layout.
export default function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🧰</span>
          <span>Toolbox</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
        >
          All tools
        </Link>
      </nav>
    </header>
  );
}
