import ToolShell from "@/components/ToolShell";
import { prisma } from "@/lib/prisma";
import type { CorrespondenceDTO } from "@/lib/correspondence";
import CorrespondenceApp from "./CorrespondenceApp";

export const dynamic = "force-dynamic";

function SetupNotice({ detail }: { detail?: string }) {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-5 text-sm dark:bg-amber-950/30">
      <p className="font-semibold">⚙️ Database not connected yet</p>
      <p className="mt-2 text-black/70 dark:text-white/70">
        This tool stores your correspondence log in Postgres. To switch it on,
        set <code>DATABASE_URL</code> in <code>.env</code> and run{" "}
        <code>npm run db:push</code>. On Railway it&apos;s already configured — it
        just needs this deploy to sync the new table.
      </p>
      {detail && (
        <p className="mt-3 font-mono text-xs text-black/40 dark:text-white/40">
          {detail}
        </p>
      )}
    </div>
  );
}

export default async function CorrespondencePage() {
  if (!process.env.DATABASE_URL) {
    return (
      <ToolShell slug="correspondence">
        <SetupNotice />
      </ToolShell>
    );
  }

  let items: CorrespondenceDTO[] = [];
  try {
    const rows = await prisma.correspondence.findMany({
      orderBy: [{ status: "asc" }, { sentDate: "asc" }],
    });
    items = rows.map((r) => ({
      id: r.id,
      source: r.source,
      reference: r.reference,
      subject: r.subject,
      sentTo: r.sentTo,
      sentDate: r.sentDate.toISOString(),
      responseNeededBy: r.responseNeededBy?.toISOString() ?? null,
      status: r.status,
      respondedDate: r.respondedDate?.toISOString() ?? null,
      link: r.link,
      notes: r.notes,
    }));
  } catch (error) {
    return (
      <ToolShell slug="correspondence">
        <SetupNotice
          detail={error instanceof Error ? error.message : String(error)}
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell slug="correspondence">
      <CorrespondenceApp items={items} />
    </ToolShell>
  );
}
