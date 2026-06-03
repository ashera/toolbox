// A single shared Prisma client for the whole app.
//
// In development, Next.js reloads your code on every change. Without this
// pattern you'd create a brand-new database connection on every reload and
// quickly run out. Caching the client on `globalThis` avoids that.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
