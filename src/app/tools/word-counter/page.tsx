"use client"; // This tool runs in the browser (it uses React state).

import { useState } from "react";
import ToolShell from "@/components/ToolShell";

// ── A frontend-only tool ──
// No backend, no database — everything happens in the browser.
// This is the simplest kind of tool to build.
export default function WordCounterPage() {
  const [text, setText] = useState("");

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const lines = text ? text.split(/\n/).length : 0;

  const stats = [
    { label: "Words", value: words },
    { label: "Characters", value: characters },
    { label: "Characters (no spaces)", value: charactersNoSpaces },
    { label: "Lines", value: lines },
  ];

  return (
    <ToolShell slug="word-counter">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing or paste your text here…"
        rows={10}
        className="w-full resize-y rounded-lg border border-black/15 bg-transparent p-4 font-mono text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-black/10 p-4 text-center dark:border-white/15"
          >
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
