import Anthropic from "@anthropic-ai/sdk";
import {
  anthropic,
  ADVISOR_MODEL,
  ADVISOR_SYSTEM_PROMPT,
} from "@/lib/anthropic";

// This route runs ONLY on the server, so the API key is never exposed to the
// browser. The browser POSTs the conversation here; we call Claude and stream
// the text answer back as it's generated.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow long-running streamed responses

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "The advisor isn't connected yet. Add ANTHROPIC_API_KEY to your .env file (get a key at console.anthropic.com), then restart the dev server.",
      },
      { status: 503 },
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("empty");
    }
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Conversation we send to Claude. We may extend it if a server-side
        // tool run (web search) pauses and needs to be resumed.
        let convo: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        for (let turn = 0; turn < 6; turn++) {
          const claudeStream = anthropic.messages.stream({
            model: ADVISOR_MODEL,
            max_tokens: 8000,
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            // Prompt-cache the system prompt so repeat calls are cheaper/faster.
            system: [
              {
                type: "text",
                text: ADVISOR_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            // Web search lets Claude ground recommendations in current data.
            tools: [{ type: "web_search_20260209", name: "web_search" }],
            messages: convo,
          });

          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const final = await claudeStream.finalMessage();

          // If the server-side web search loop paused, resume by re-sending.
          if (final.stop_reason === "pause_turn") {
            convo = [...convo, { role: "assistant", content: final.content }];
            continue;
          }
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`\n\n⚠️ Something went wrong: ${message}`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
