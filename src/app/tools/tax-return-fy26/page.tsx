// ── Server component ──
// Loads the user's saved work-related expenses from Postgres and hands them to
// the interactive <TaxCalculator/>. If the database isn't configured/reachable,
// it still renders the calculator (with a setup notice in the expenses panel)
// rather than crashing — mirroring the Quick Notes tool's approach.

import ToolShell from "@/components/ToolShell";
import { prisma } from "@/lib/prisma";
import TaxCalculator from "./TaxCalculator";
import type { Expense } from "./eligibility";

// Render on every request instead of being prerendered at build time. This page
// reads live, per-visit data from the database, and the build environment (e.g.
// on Railway) often can't reach the DB — without this, a build-time snapshot
// (showing the "not connected" state) would be served even after the DB is up.
export const dynamic = "force-dynamic";

export default async function TaxReturnFy26Page() {
  let expenses: Expense[] = [];
  let dbReady = false;
  let dbError: string | undefined;

  if (!process.env.DATABASE_URL) {
    dbError = "DATABASE_URL is not set.";
  } else {
    try {
      const rows = await prisma.expenseItem.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          category: true,
          amount: true,
          workUsePercent: true,
          reimbursed: true,
        },
      });
      expenses = rows;
      dbReady = true;
    } catch (error) {
      dbError = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <ToolShell slug="tax-return-fy26">
      <TaxCalculator expenses={expenses} dbReady={dbReady} dbError={dbError} />
    </ToolShell>
  );
}
