// ─────────────────────────────────────────────────────────────────────────
//  THE TOOL REGISTRY
//
//  This is the one place that lists every tool in your toolbox.
//  The homepage reads this list to draw a card for each tool.
//
//  ── To add a new tool ──
//    1. Create a page at:  src/app/tools/<your-slug>/page.tsx
//    2. Add one entry to the `tools` array below.
//  That's it — it shows up on the homepage automatically.
// ─────────────────────────────────────────────────────────────────────────

export type Tool = {
  /** URL-friendly id. The tool lives at /tools/<slug>, so this MUST match
   *  the folder name under src/app/tools/. */
  slug: string;
  /** Display name shown on the card and the tool page. */
  name: string;
  /** One-line description shown on the card. */
  description: string;
  /** An emoji used as the tool's icon. Pick any you like. */
  icon: string;
  /** A loose grouping label, e.g. "Text", "Data", "Fun". */
  category: string;
};

export const tools: Tool[] = [
  {
    slug: "word-counter",
    name: "Word Counter",
    description:
      "Paste any text and instantly see word, character, and line counts. Runs entirely in your browser.",
    icon: "🔤",
    category: "Text",
  },
  {
    slug: "notes",
    name: "Quick Notes",
    description:
      "Jot down notes that are saved to your database and persist across visits. Demonstrates the backend pattern.",
    icon: "📝",
    category: "Data",
  },
  {
    slug: "advisor",
    name: "Investment Advisor",
    description:
      "Describe your investing style and get specific, AI-researched investment ideas with live data. Educational, not financial advice.",
    icon: "📈",
    category: "Finance",
  },
  {
    slug: "tax-return-fy26",
    name: "FY26 Tax Return Estimator",
    description:
      "Estimate your 2025–26 Australian tax refund or bill: income tax, Medicare levy & surcharge, LITO, and HELP/HECS. Estimate only, not tax advice.",
    icon: "🧾",
    category: "Finance",
  },
  {
    slug: "correspondence",
    name: "Correspondence Tracker",
    description:
      "Log the emails and Aconex mail you send and never forget to follow up — it flags anything awaiting a reply past your deadline. Drop in an Excel/CSV register and Claude reads the columns for you, or add items by hand.",
    icon: "📮",
    category: "Work",
  },
];

/** Look up a single tool by its slug (used by tool pages for their header). */
export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}
