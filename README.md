# 🧰 Toolbox

A personal hub for the small web tools you build. The homepage shows a card for
each tool; every tool lives at its own page. Built with **Next.js**, **Tailwind
CSS**, and **Prisma + Postgres** for tools that need to save data.

---

## Getting started

```bash
npm run dev
```

Then open **http://localhost:3000**.

The **Word Counter** tool works immediately. The **Quick Notes** tool needs a
database — see below.

---

## Connecting the database (one-time, ~2 minutes)

Tools that save data use a free Postgres database.

1. Go to **[neon.tech](https://neon.tech)**, sign up, and create a project.
2. Copy the **connection string** it gives you.
3. Open the **`.env`** file and paste it in:
   ```
   DATABASE_URL="postgresql://...your string here..."
   ```
4. Create the tables in your database:
   ```bash
   npm run db:push
   ```
5. Refresh the Quick Notes page — it now saves notes.

> Tip: `npm run db:studio` opens a visual browser for your database.

---

## ✨ How to add a new tool

Adding a tool is two steps:

### 1. Create the tool's page

Make a folder under `src/app/tools/` named after your tool's slug, with a
`page.tsx` inside. For a tool at `/tools/my-tool`:

```
src/app/tools/my-tool/page.tsx
```

Use the `ToolShell` wrapper so it gets the standard header and back-link:

```tsx
"use client"; // only if your tool uses browser state/effects

import ToolShell from "@/components/ToolShell";

export default function MyToolPage() {
  return (
    <ToolShell slug="my-tool">
      {/* your tool's UI goes here */}
    </ToolShell>
  );
}
```

### 2. Register it

Add one entry to the `tools` array in **`src/lib/tools.ts`**:

```ts
{
  slug: "my-tool",          // must match the folder name
  name: "My Tool",
  description: "What it does, in one line.",
  icon: "🛠️",
  category: "Text",
}
```

Save, and it appears on the homepage automatically. 🎉

---

## Does my tool need a database?

- **No** (calculations, converters, formatters that run in the browser) →
  look at **Word Counter** (`src/app/tools/word-counter/page.tsx`). Just a
  client component, no backend.

- **Yes** (it saves or loads data) → look at **Quick Notes**
  (`src/app/tools/notes/`). The pattern:
  1. Add a model to `prisma/schema.prisma` and run `npm run db:push`.
  2. Write server actions in an `actions.ts` file (`"use server"`) that read/
     write via the shared `prisma` client from `src/lib/prisma.ts`.
  3. Call those actions from `<form action={...}>` in your page.

---

## Project layout

```
src/
  app/
    page.tsx              # homepage — the tool gallery
    layout.tsx            # shared layout + nav
    tools/
      word-counter/       # sample: frontend-only tool
      notes/              # sample: database-backed tool
  components/
    Nav.tsx               # top navigation bar
    ToolShell.tsx         # standard wrapper for tool pages
  lib/
    tools.ts              # ⭐ THE TOOL REGISTRY — edit this to add tools
    prisma.ts             # shared database client
prisma/
  schema.prisma           # database tables
```

---

## Deploying online

This app is ready for **[Vercel](https://vercel.com)** (the makers of Next.js):

1. Push this project to a GitHub repository.
2. Import it on Vercel.
3. Add your `DATABASE_URL` as an environment variable in the Vercel project
   settings (same value as in your `.env`).
4. Deploy. Because you're using hosted Postgres, no code changes are needed.

Check it builds locally first with `npm run build`.
