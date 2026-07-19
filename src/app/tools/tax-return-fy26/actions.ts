"use server"; // Everything in this file runs on the SERVER, never the browser.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategory } from "./eligibility";

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
