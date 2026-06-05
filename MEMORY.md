# Project memory & setup

Shared setup notes and working conventions so everyone pulling this repo gets the
same local environment. (Private/per-developer secrets never live here — they go
in the gitignored `.env`.)

---

## Database: Railway Postgres

This project uses a **Postgres database hosted on Railway** (not Neon, despite
older notes in `.env.example`/`README.md`).

- For **local development**, use Railway's **public** connection string —
  `DATABASE_PUBLIC_URL`, whose host looks like `<name>.proxy.rlwy.net:<port>`.
  Do **not** use the internal `*.railway.internal` host: it only resolves inside
  Railway's own network and will fail from your machine.
- Get it from: **Railway dashboard → the Postgres service → Variables tab →
  `DATABASE_PUBLIC_URL`** (ask a maintainer if you don't have dashboard access).
- It is shared with the deployed app, so be careful with destructive changes.

## One-time local setup

```bash
npm install                       # installs deps + generates the Prisma client
# Create .env (gitignored) and set your Railway public connection string:
#   DATABASE_URL="postgresql://postgres:<password>@<name>.proxy.rlwy.net:<port>/railway"
npm run db:push                   # syncs prisma/schema.prisma to the database
npm run dev                       # http://localhost:3000
```

`cp .env.example .env` is a fine starting point — just replace the empty
`DATABASE_URL` with the Railway **public** URL above.

## Everyday commands

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Start the dev server (hot-reloads) at :3000             |
| `npm run db:push`  | Apply `prisma/schema.prisma` changes to the database    |
| `npm run db:studio`| Visual browser/editor for the database                  |
| `npm run build`    | Production build (runs `prisma generate` first)         |

---

## Conventions

- **Run the dev server after each change.** After applying a change, make sure
  `npm run dev` is running and confirm the change compiled cleanly and the
  affected route serves a 200. The server hot-reloads, so don't start a second
  instance (the port will already be in use) — check the existing one.
- **Commit and push after each change.** Commit each change directly to `main`
  and push to GitHub (no branch/PR), then note the commit id. Never commit
  secrets — `.env` stays gitignored.
- **Record new conventions here.** This file is the source of truth for project
  conventions — when a new one is agreed, add it to this list so everyone on the
  repo picks it up.
- **Tooling auto-approval.** `.claude/settings.json` (committed) lets Claude Code
  run git commands and write/edit files in the repo without prompting. Personal
  approvals stay in the gitignored `.claude/settings.local.json`.
- **Next.js 16 has breaking changes.** Before writing framework code, read the
  relevant guide under `node_modules/next/dist/docs/` — see `AGENTS.md`.
- **Adding a tool / database-backed tools:** see `README.md` for the pattern
  (create `src/app/tools/<slug>/page.tsx`, register it in `src/lib/tools.ts`,
  add a Prisma model + server actions for data).
