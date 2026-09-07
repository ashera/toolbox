import { anthropic, ADVISOR_MODEL } from "@/lib/anthropic";

// Turn a batch of correspondence (subject + optional details) into short,
// plain-English one-line summaries. Runs server-side so the key stays secret.
// The client sends rows in chunks and stitches the results back together.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summaries: { type: "array", items: { type: "string" } },
  },
  required: ["summaries"],
};

const SYSTEM = `You write very short, plain-English summaries of construction-project correspondence for a busy client-side project manager scanning a long list.

For each item (given its subject and any description), write a summary of at most ~10 words that captures what it's actually about — decode codes/jargon where you reasonably can (e.g. "RFI" = request for information). No trailing full stop. If there's nothing to summarise, return an empty string for that item.

Return exactly one summary per input item, in the same order.`;

type Row = { subject?: string; details?: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Summaries need ANTHROPIC_API_KEY set." },
      { status: 503 },
    );
  }

  let rows: Row[];
  try {
    const body = await req.json();
    rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("no rows");
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const list = rows
    .map((r, i) => {
      const subject = String(r.subject ?? "").slice(0, 200);
      const details = String(r.details ?? "").slice(0, 400);
      return `${i + 1}. Subject: ${subject}${details ? ` | Details: ${details}` : ""}`;
    })
    .join("\n");

  try {
    const message = await anthropic.messages.create({
      model: ADVISOR_MODEL,
      max_tokens: 4000,
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
          content: `Summarise these ${rows.length} items:\n\n${list}`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text");
    const parsed = JSON.parse(text && "text" in text ? text.text : "{}");
    const summaries: string[] = Array.isArray(parsed.summaries)
      ? parsed.summaries.map((s: unknown) => (typeof s === "string" ? s : ""))
      : [];

    // Always return exactly one entry per input row.
    const out = rows.map((_, i) => summaries[i] ?? "");
    return Response.json({ summaries: out });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Summarisation failed." },
      { status: 500 },
    );
  }
}
