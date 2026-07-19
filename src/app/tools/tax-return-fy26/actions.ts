"use server"; // Everything in this file runs on the SERVER, never the browser.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategory, type TaxProfileInput } from "./eligibility";

// ── Server Actions ──
// Called directly from <form action={...}> in the tax tool. They persist
// itemised work-related expenses to Postgres via the shared Prisma client.

const PATH = "/tools/tax-return-fy26";

export async function addExpense(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amount = parseFloat(String(formData.get("amount") ?? ""));
  const workUseRaw = parseInt(String(formData.get("workUsePercent") ?? "100"), 10);
  const reimbursed = formData.get("reimbursed") === "on";

  // Basic server-side validation — ignore junk rather than store it.
  if (!description || !Number.isFinite(amount) || amount <= 0) return;

  // Normalise: unknown category → "other"; clamp work-use to 0–100.
  const safeCategory = getCategory(category).id;
  const workUsePercent = Number.isFinite(workUseRaw)
    ? Math.min(100, Math.max(0, workUseRaw))
    : 100;

  await prisma.expenseItem.create({
    data: { description, category: safeCategory, amount, workUsePercent, reimbursed },
  });

  revalidatePath(PATH);
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.expenseItem.delete({ where: { id } });
  revalidatePath(PATH);
}

// The income inputs live in a single shared row (id = "default"). Called
// (debounced) from the client as fields change, so they sync across devices.
// No revalidatePath: the client already holds these values while typing, and
// re-rendering the server component mid-edit would fight the user's input.
const PROFILE_ID = "default";

export async function saveTaxProfile(input: TaxProfileInput) {
  const str = (v: unknown) => String(v ?? "").slice(0, 20);
  const data = {
    salary: str(input.salary),
    otherIncome: str(input.otherIncome),
    paygWithheld: str(input.paygWithheld),
    hasHospitalCover: Boolean(input.hasHospitalCover),
    hasHelpDebt: Boolean(input.hasHelpDebt),
  };

  await prisma.taxProfile.upsert({
    where: { id: PROFILE_ID },
    create: { id: PROFILE_ID, ...data },
    update: data,
  });
}
