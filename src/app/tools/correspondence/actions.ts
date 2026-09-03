"use server"; // Everything here runs on the server, close to the database.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { NewCorrespondence } from "@/lib/correspondence";

const PATH = "/tools/correspondence";

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

// Create one item (from the manual-entry form).
export async function createCorrespondence(data: NewCorrespondence) {
  if (!data.subject?.trim() || !data.sentTo?.trim() || !data.sentDate) {
    throw new Error("Subject, recipient, and sent date are required.");
  }
  await prisma.correspondence.create({
    data: {
      source: data.source || "Email",
      reference: clean(data.reference),
      subject: data.subject.trim(),
      sentTo: data.sentTo.trim(),
      sentDate: new Date(data.sentDate),
      responseNeededBy: data.responseNeededBy
        ? new Date(data.responseNeededBy)
        : null,
      status: data.status || "Awaiting",
      link: clean(data.link),
      notes: clean(data.notes),
    },
  });
  revalidatePath(PATH);
}

// Bulk create (from a CSV import). Returns how many rows were saved.
export async function importCorrespondences(rows: NewCorrespondence[]) {
  const data = rows
    .filter((r) => r.subject?.trim() && r.sentTo?.trim() && r.sentDate)
    .map((r) => ({
      source: r.source || "Aconex",
      reference: clean(r.reference),
      subject: r.subject.trim(),
      sentTo: r.sentTo.trim(),
      sentDate: new Date(r.sentDate),
      responseNeededBy: r.responseNeededBy ? new Date(r.responseNeededBy) : null,
      status: r.status || "Awaiting",
      link: clean(r.link),
      notes: clean(r.notes),
    }));

  if (data.length === 0) return { imported: 0 };

  await prisma.correspondence.createMany({ data });
  revalidatePath(PATH);
  return { imported: data.length };
}

// Mark an item as responded (records "now" as the response date).
export async function markResponded(id: string) {
  await prisma.correspondence.update({
    where: { id },
    data: { status: "Responded", respondedDate: new Date() },
  });
  revalidatePath(PATH);
}

// Re-open a responded/closed item back to awaiting.
export async function reopenCorrespondence(id: string) {
  await prisma.correspondence.update({
    where: { id },
    data: { status: "Awaiting", respondedDate: null },
  });
  revalidatePath(PATH);
}

// Close an item without a response (e.g. no longer relevant).
export async function closeCorrespondence(id: string) {
  await prisma.correspondence.update({
    where: { id },
    data: { status: "Closed" },
  });
  revalidatePath(PATH);
}

export async function deleteCorrespondence(id: string) {
  await prisma.correspondence.delete({ where: { id } });
  revalidatePath(PATH);
}

// Push the follow-up due date out by N calendar days ("snooze").
export async function snoozeCorrespondence(id: string, days: number) {
  const due = new Date();
  due.setDate(due.getDate() + days);
  await prisma.correspondence.update({
    where: { id },
    data: { responseNeededBy: due, status: "Awaiting" },
  });
  revalidatePath(PATH);
}
