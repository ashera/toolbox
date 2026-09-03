import { anthropic, ADVISOR_MODEL } from "@/lib/anthropic";

// Given a spreadsheet's headers + a few sample rows, ask Claude which column
// maps to each field of our correspondence tracker. Runs server-side so the
// API key stays secret. Returns a structured mapping the browser then applies
// to every row locally.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FIELDS = ["subject", "sentTo", "sentDate", "reference", "status", "link", "notes"] as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: { type: "string", enum: ["Aconex", "Email", "Other"] },
    columnMap: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        FIELDS.map((f) => [f, { type: ["string", "null"] }]),
      ),
      required: [...FIELDS],
    },
    reasoning: { type: "string" },
  },
  required: ["source", "columnMap", "reasoning"],
};

const SYSTEM = `You map spreadsheet columns to fields for a construction project manager's correspondence tracker (e.g. an exported Aconex mail register, or an email export).

Given the column headers and a few sample rows, decide which header best fills each target field. Return the EXACT header string, or null if no column fits.

Target fields:
- subject: the main topic/title/description of the correspondence
- sentTo: the recipient — the company or person it was sent TO (not the sender/from)
- sentDate: the date it was sent or issued
- reference: the mail number, document number, or unique reference
- status: any open/closed/responded/awaiting state column
- link: a URL/hyperlink to the item
- notes: any free-text remarks/comments column

Also infer whether the data is "Aconex" (construction mail register), "Email", or "Other".
Prefer the recipient column for sentTo; if there's both a "To" and a "From", never pick "From". Only map a field if a column genuinely fits.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI interpretation needs ANTHROPIC_API_KEY set." },
      { status: 503 },
    );
  }

  let headers: string[];
  let sampleRows: Record<string, string>[];
  try {
    const body = await req.json();
    headers = body.headers;
    sampleRows = body.sampleRows ?? [];
    if (!Array.isArray(headers) || headers.length === 0) throw new Error("no headers");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Compact, bounded representation for the prompt.
  const preview = sampleRows
    .slice(0, 6)
    .map(
      (row, i) =>
        `Row ${i + 1}: ` +
        headers
          .map((h) => `${h}=${String(row[h] ?? "").slice(0, 60)}`)
          .join(" | "),
    )
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: ADVISOR_MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Column headers: ${JSON.stringify(headers)}\n\nSample rows:\n${preview}`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text");
    const parsed = JSON.parse(text && "text" in text ? text.text : "{}");

    // Guard against hallucinated column names — only keep ones that exist.
    const headerSet = new Set(headers);
    const columnMap: Record<string, string | null> = {};
    for (const f of FIELDS) {
      const v = parsed.columnMap?.[f];
      columnMap[f] = typeof v === "string" && headerSet.has(v) ? v : null;
    }

    return Response.json({
      source: ["Aconex", "Email", "Other"].includes(parsed.source)
        ? parsed.source
        : "Aconex",
      columnMap,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Interpretation failed." },
      { status: 500 },
    );
  }
}
