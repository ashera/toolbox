"use server"; // Everything in this file runs on the SERVER, never the browser.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── Server Actions ──
// These functions are called directly from <form action={...}> in page.tsx.
// Next.js runs them on the server, so it's safe to talk to the database here.

export async function createNote(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  await prisma.note.create({ data: { content } });

  // Tell Next.js to re-fetch the notes list so the new note appears.
  revalidatePath("/tools/notes");
}

export async function deleteNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.note.delete({ where: { id } });
  revalidatePath("/tools/notes");
}
