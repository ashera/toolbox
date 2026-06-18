"use client";

import { useRef, useState } from "react";
import ToolShell from "@/components/ToolShell";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STYLES = [
  "Passive / index investing",
  "Growth",
  "Dividend & income",
  "Value",
  "Thematic / sector (e.g. tech, clean energy)",
  "A balanced mix",
];
const RISKS = ["Conservative", "Balanced", "Aggressive"];
const HORIZONS = ["Less than 3 years", "3–10 years", "10+ years"];
const REGIONS = ["United States", "United Kingdom", "Europe", "Australia", "Global"];
const CURRENCIES = ["USD ($)", "GBP (£)", "EUR (€)", "AUD ($)"];

export default function AdvisorPage() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followup, setFollowup] = useState("");

  // Profile form fields
  const [style, setStyle] = useState(STYLES[0]);
  const [risk, setRisk] = useState(RISKS[1]);
  const [horizon, setHorizon] = useState(HORIZONS[2]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Send the current conversation to the API and stream the reply in.
  async function send(history: ChatMessage[]) {
    setBusy(true);
    setError(null);
    // Add an empty assistant message we'll stream text into.
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Request failed." }));
        setError(data.error ?? "Request failed.");
        setMessages(history); // drop the empty assistant bubble
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setMessages(history);
    } finally {
      setBusy(false);
    }
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const amountText = amount.trim()
      ? `Amount to invest: ${amount.trim()} ${currency}`
      : "Amount to invest: not specified";
    const profile = [
      `I'd like specific investment recommendations for my profile.`,
      ``,
      `- Investing style: ${style}`,
      `- Risk tolerance: ${risk}`,
      `- Time horizon: ${horizon}`,
      `- Market/region: ${region}`,
      `- ${amountText}`,
      notes.trim() ? `- Other notes: ${notes.trim()}` : null,
      ``,
      `Please research current data and give me specific picks with tickers, a suggested allocation, the reasoning, the key risks, and your sources.`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    setStarted(true);
    send([{ role: "user", content: profile }]);
  }

  function handleFollowup(e: React.FormEvent) {
    e.preventDefault();
    if (!followup.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: followup.trim() }];
    setFollowup("");
    send(next);
  }

  return (
    <ToolShell slug="advisor">
      {/* Disclaimer — always visible */}
      <div className="mb-6 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
        <strong>⚠️ Educational use only.</strong> This tool uses AI to generate
        investment ideas — it is <em>not</em> a licensed financial advisor and
        this is <em>not</em> personalized financial advice. All investing
        carries risk, including loss of capital. Do your own research and
        consider consulting a qualified professional before investing.
      </div>

      {!started ? (
        <form onSubmit={handleStart} className="space-y-5">
          <p className="text-black/60 dark:text-white/60">
            Tell me how you like to invest, and I&apos;ll research current
            options and suggest specific investments that fit.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Investing style">
              <Select value={style} onChange={setStyle} options={STYLES} />
            </Field>
            <Field label="Risk tolerance">
              <Select value={risk} onChange={setRisk} options={RISKS} />
            </Field>
            <Field label="Time horizon">
              <Select value={horizon} onChange={setHorizon} options={HORIZONS} />
            </Field>
            <Field label="Market / region">
              <Select value={region} onChange={setRegion} options={REGIONS} />
            </Field>
            <Field label="Amount to invest (optional)">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
              />
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={setCurrency} options={CURRENCIES} />
            </Field>
          </div>

          <Field label="Anything else? (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. I already hold an S&P 500 fund; I'd like to add some international exposure."
              className="w-full resize-y rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </Field>

          <button
            type="submit"
            className="rounded-lg bg-foreground px-5 py-2.5 font-medium text-background transition-opacity hover:opacity-80"
          >
            Get recommendations
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div ref={scrollRef} className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "rounded-lg bg-black/5 px-4 py-3 text-sm dark:bg-white/10"
                    : "rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
                }
              >
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
                  {m.role === "user" ? "You" : "Advisor"}
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {m.content ||
                    (busy ? "Researching current market data…" : "")}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleFollowup} className="flex gap-2">
            <input
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
              disabled={busy}
              placeholder="Ask a follow-up, e.g. “make it more conservative” or “add bonds”…"
              className="flex-1 rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/20 dark:focus:border-white/50"
            />
            <button
              type="submit"
              disabled={busy || !followup.trim()}
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </ToolShell>
  );
}

// ── Small form helpers ──
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-black/70 dark:text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-background text-foreground">
          {o}
        </option>
      ))}
    </select>
  );
}
