import ToolShell from "@/components/ToolShell";
import { prisma } from "@/lib/prisma";
import { createNote, deleteNote } from "./actions";

// ── A backend + database tool ──
// This is a SERVER component: it runs on the server, reads notes from the
// database, and renders them. The forms below call server actions
// (see actions.ts) to create and delete notes.

// A friendly setup card shown when the database isn't configured yet.
function SetupNotice({ detail }: { detail?: string }) {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-5 text-sm dark:bg-amber-950/30">
      <p className="font-semibold">⚙️ Database not connected yet</p>
      <p className="mt-2 text-black/70 dark:text-white/70">
        This tool saves notes to a Postgres database. To switch it on:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-black/70 dark:text-white/70">
        <li>
          Get a free database at{" "}
          <a
            href="https://neon.tech"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            neon.tech
          </a>{" "}
          and copy its connection string.
        </li>
        <li>
          Paste it into the <code>.env</code> file as <code>DATABASE_URL</code>.
        </li>
        <li>
          Run <code>npm run db:push</code> in your terminal, then refresh.
        </li>
      </ol>
      {detail && (
        <p className="mt-3 font-mono text-xs text-black/40 dark:text-white/40">
          {detail}
        </p>
      )}
    </div>
  );
}

export default async function NotesPage() {
  // If there's no connection string, show setup help instead of crashing.
  if (!process.env.DATABASE_URL) {
    return (
      <ToolShell slug="notes">
        <SetupNotice />
      </ToolShell>
    );
  }

  // Try to load notes. If the DB is unreachable or the table doesn't exist
  // yet (you haven't run db:push), show the setup notice with the error.
  let notes: { id: string; content: string; createdAt: Date }[] = [];
  try {
    notes = await prisma.note.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    return (
      <ToolShell slug="notes">
        <SetupNotice
          detail={error instanceof Error ? error.message : String(error)}
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell slug="notes">
      {/* Create a note */}
      <form action={createNote} className="flex gap-2">
        <input
          name="content"
          placeholder="Write a note and press Add…"
          required
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-80"
        >
          Add
        </button>
      </form>

      {/* List of notes */}
      <ul className="mt-6 space-y-2">
        {notes.length === 0 && (
          <li className="text-sm text-black/50 dark:text-white/50">
            No notes yet — add your first one above.
          </li>
        )}
        {notes.map((note) => (
          <li
            key={note.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
          >
            <span className="break-words">{note.content}</span>
            <form action={deleteNote}>
              <input type="hidden" name="id" value={note.id} />
              <button
                type="submit"
                aria-label="Delete note"
                className="shrink-0 text-black/30 transition-colors hover:text-red-500 dark:text-white/30"
              >
                ✕
              </button>
            </form>
          </li>
        ))}
      </ul>
    </ToolShell>
  );
}
