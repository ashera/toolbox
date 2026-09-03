"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";
import {
  type CorrespondenceDTO,
  type NewCorrespondence,
  type DisplayStatus,
  SOURCES,
  DEFAULT_THRESHOLD_WD,
  displayStatus,
  daysWaiting,
  parseFlexibleDate,
} from "@/lib/correspondence";
import {
  createCorrespondence,
  importCorrespondences,
  markResponded,
  reopenCorrespondence,
  closeCorrespondence,
  deleteCorrespondence,
  snoozeCorrespondence,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────
//  Main dashboard
// ─────────────────────────────────────────────────────────────────────────
export default function CorrespondenceApp({
  items,
}: {
  items: CorrespondenceDTO[];
}) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD_WD);
  const [filter, setFilter] = useState<DisplayStatus | "All">("All");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Remember the viewer's chosen threshold locally.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("corr-threshold");
      if (saved) setThreshold(Number(saved));
    } catch {}
  }, []);
  function updateThreshold(v: number) {
    setThreshold(v);
    try {
      localStorage.setItem("corr-threshold", String(v));
    } catch {}
  }

  // Annotate every item with its derived display status.
  const withStatus = useMemo(
    () =>
      items.map((it) => ({
        item: it,
        ds: displayStatus(it, threshold),
        wait: daysWaiting(it),
      })),
    [items, threshold],
  );

  const stats = useMemo(() => {
    const awaiting = withStatus.filter((x) => x.ds === "Awaiting").length;
    const overdue = withStatus.filter((x) => x.ds === "Overdue").length;
    const responded = withStatus.filter((x) => x.ds === "Responded").length;
    const open = withStatus.filter(
      (x) => x.ds === "Awaiting" || x.ds === "Overdue",
    );
    const avg =
      open.length > 0
        ? Math.round(open.reduce((s, x) => s + x.wait, 0) / open.length)
        : 0;
    return { awaiting, overdue, responded, avg, open: open.length };
  }, [withStatus]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      All: withStatus.length,
      Awaiting: 0,
      Overdue: 0,
      Responded: 0,
      Closed: 0,
    };
    for (const x of withStatus) c[x.ds]++;
    return c;
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus
      .filter((x) => filter === "All" || x.ds === filter)
      .filter(
        (x) =>
          !q ||
          x.item.subject.toLowerCase().includes(q) ||
          x.item.sentTo.toLowerCase().includes(q) ||
          (x.item.reference ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Overdue first, then longest-waiting, keeping resolved items last.
        const rank = (d: DisplayStatus) =>
          d === "Overdue" ? 0 : d === "Awaiting" ? 1 : d === "Responded" ? 2 : 3;
        if (rank(a.ds) !== rank(b.ds)) return rank(a.ds) - rank(b.ds);
        return b.wait - a.wait;
      });
  }, [withStatus, filter, query]);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            + Log correspondence
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
          >
            ⬆ Import file
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
          Flag overdue after
          <select
            value={threshold}
            onChange={(e) => updateThreshold(Number(e.target.value))}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          >
            {[3, 5, 7, 10, 14].map((n) => (
              <option key={n} value={n} className="bg-background text-foreground">
                {n} working days
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Awaiting reply" value={stats.awaiting} tone="info" icon="⏳" />
        <StatTile label="Overdue" value={stats.overdue} tone="critical" icon="⚠️" emphasize={stats.overdue > 0} />
        <StatTile label="Responded" value={stats.responded} tone="good" icon="✓" />
        <StatTile label="Avg wait (open)" value={stats.avg} suffix=" wd" tone="neutral" icon="◷" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/40 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["All", "Overdue", "Awaiting", "Responded", "Closed"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-foreground text-background"
                    : "border border-black/15 text-black/60 hover:border-black/40 dark:border-white/20 dark:text-white/60"
                }`}
              >
                {f} <span className="opacity-60">{counts[f] ?? 0}</span>
              </button>
            ),
          )}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, recipient, ref…"
          className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>

      {/* Table / empty state */}
      {items.length === 0 ? (
        <EmptyState
          onAdd={() => setShowAdd(true)}
          onImport={() => setShowImport(true)}
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 py-10 text-center text-sm text-black/40 dark:border-white/20 dark:text-white/40">
          Nothing matches this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/40 dark:border-white/15 dark:text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Correspondence</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Waiting</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ item, ds, wait }) => (
                <tr
                  key={item.id}
                  className="border-b border-black/5 transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 align-top">
                    <StatusPill status={ds} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{item.subject}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-black/45 dark:text-white/45">
                      <SourceBadge source={item.source} />
                      {item.reference && <span>#{item.reference}</span>}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-black dark:hover:text-white"
                        >
                          open ↗
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-black/70 dark:text-white/70">
                    {item.sentTo}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-black/60 dark:text-white/60">
                    {fmtDate(item.sentDate)}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <WaitBadge status={ds} wait={wait} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <RowActions
                      status={ds}
                      pending={pending}
                      onRespond={() => run(() => markResponded(item.id))}
                      onSnooze={() => run(() => snoozeCorrespondence(item.id, 7))}
                      onClose={() => run(() => closeCorrespondence(item.id))}
                      onReopen={() => run(() => reopenCorrespondence(item.id))}
                      onDelete={() => run(() => deleteCorrespondence(item.id))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSubmit={(data) =>
            run(async () => {
              await createCorrespondence(data);
              setShowAdd(false);
            })
          }
          pending={pending}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(rows) =>
            run(async () => {
              await importCorrespondences(rows);
              setShowImport(false);
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Presentational bits
// ─────────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC", // dates are stored as UTC midnight; show that calendar day
  });
}

function StatTile({
  label,
  value,
  suffix,
  tone,
  icon,
  emphasize,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "info" | "critical" | "good" | "neutral";
  icon: string;
  emphasize?: boolean;
}) {
  const toneRing =
    emphasize && tone === "critical"
      ? "border-red-400/50 bg-red-50 dark:bg-red-950/30"
      : "border-black/10 dark:border-white/15";
  const toneText =
    tone === "critical" && emphasize
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className={`rounded-xl border p-4 ${toneRing}`}>
      <div className="flex items-center justify-between text-xs text-black/45 dark:text-white/45">
        <span>{label}</span>
        <span aria-hidden>{icon}</span>
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${toneText}`}>
        {value}
        {suffix && <span className="text-base font-medium opacity-50">{suffix}</span>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DisplayStatus }) {
  const map: Record<DisplayStatus, { cls: string; icon: string }> = {
    Overdue: {
      cls: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/20",
      icon: "⚠️",
    },
    Awaiting: {
      cls: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/20",
      icon: "⏳",
    },
    Responded: {
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20",
      icon: "✓",
    },
    Closed: {
      cls: "bg-black/5 text-black/50 ring-black/10 dark:bg-white/10 dark:text-white/50 dark:ring-white/15",
      icon: "⊘",
    },
  };
  const { cls, icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      <span aria-hidden>{icon}</span>
      {status}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded bg-black/5 px-1.5 py-0.5 font-medium dark:bg-white/10">
      {source}
    </span>
  );
}

function WaitBadge({ status, wait }: { status: DisplayStatus; wait: number }) {
  if (status === "Responded" || status === "Closed") {
    return <span className="text-black/40 dark:text-white/40">{wait} wd</span>;
  }
  const cls =
    status === "Overdue"
      ? "text-red-600 dark:text-red-400 font-semibold"
      : "text-black/70 dark:text-white/70";
  return <span className={cls}>{wait} wd</span>;
}

function RowActions({
  status,
  pending,
  onRespond,
  onSnooze,
  onClose,
  onReopen,
  onDelete,
}: {
  status: DisplayStatus;
  pending: boolean;
  onRespond: () => void;
  onSnooze: () => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const open = status === "Awaiting" || status === "Overdue";
  return (
    <div className="flex items-center justify-end gap-1">
      {open ? (
        <>
          <IconBtn title="Mark responded" onClick={onRespond} disabled={pending}>
            ✓
          </IconBtn>
          <IconBtn title="Snooze 1 week" onClick={onSnooze} disabled={pending}>
            ⏰
          </IconBtn>
          <IconBtn title="Close (no response needed)" onClick={onClose} disabled={pending}>
            ⊘
          </IconBtn>
        </>
      ) : (
        <IconBtn title="Re-open" onClick={onReopen} disabled={pending}>
          ↩
        </IconBtn>
      )}
      <IconBtn title="Delete" onClick={onDelete} disabled={pending} danger>
        ✕
      </IconBtn>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-md border text-xs transition-colors disabled:opacity-40 ${
        danger
          ? "border-black/10 text-black/40 hover:border-red-400 hover:text-red-500 dark:border-white/15 dark:text-white/40"
          : "border-black/10 text-black/60 hover:border-black/40 hover:text-black dark:border-white/15 dark:text-white/60 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  onAdd,
  onImport,
}: {
  onAdd: () => void;
  onImport: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 py-14 text-center dark:border-white/20">
      <div className="text-4xl">📮</div>
      <h3 className="mt-3 font-semibold">No correspondence tracked yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-black/55 dark:text-white/55">
        Log the emails and Aconex mail you send, and this dashboard will chase
        the ones that go unanswered so you never forget to follow up.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          onClick={onAdd}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          + Log your first one
        </button>
        <button
          onClick={onImport}
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
        >
          ⬆ Import a file
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Manual-entry modal
// ─────────────────────────────────────────────────────────────────────────
function AddModal({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (data: NewCorrespondence) => void;
  pending: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [source, setSource] = useState<string>("Email");
  const [subject, setSubject] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [sentDate, setSentDate] = useState(today);
  const [reference, setReference] = useState("");
  const [responseNeededBy, setResponseNeededBy] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");

  const valid = subject.trim() && sentTo.trim() && sentDate;

  return (
    <Modal onClose={onClose} title="Log correspondence">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit({
            source,
            subject,
            sentTo,
            sentDate: new Date(sentDate).toISOString(),
            reference: reference || null,
            responseNeededBy: responseNeededBy
              ? new Date(responseNeededBy).toISOString()
              : null,
            link: link || null,
            notes: notes || null,
          });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label="Source">
            <Select value={source} onChange={setSource} options={[...SOURCES]} />
          </ModalField>
          <ModalField label="Sent date *">
            <input
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
              className={inputCls}
              required
            />
          </ModalField>
        </div>
        <ModalField label="Subject *">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. RFI-042 – Slab penetration coordination"
            className={inputCls}
            required
          />
        </ModalField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label="Sent to *">
            <input
              value={sentTo}
              onChange={(e) => setSentTo(e.target.value)}
              placeholder="Contractor / client"
              className={inputCls}
              required
            />
          </ModalField>
          <ModalField label="Reference / No.">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Aconex mail no., doc ref…"
              className={inputCls}
            />
          </ModalField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label="Response needed by (optional)">
            <input
              type="date"
              value={responseNeededBy}
              onChange={(e) => setResponseNeededBy(e.target.value)}
              className={inputCls}
            />
          </ModalField>
          <ModalField label="Link (optional)">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </ModalField>
        </div>
        <ModalField label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </ModalField>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || pending}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  CSV import modal (drag & drop + column mapping)
// ─────────────────────────────────────────────────────────────────────────
type MapTarget = "subject" | "sentTo" | "sentDate" | "reference" | "status" | "link" | "notes";

const MAP_FIELDS: { key: MapTarget; label: string; required: boolean; hints: string[] }[] = [
  { key: "subject", label: "Subject", required: true, hints: ["subject", "title", "description", "document title"] },
  { key: "sentTo", label: "Sent to", required: true, hints: ["to", "recipient", "attention", "attn", "toorganization", "toorganisation", "sentto", "tocompany"] },
  { key: "sentDate", label: "Sent date", required: true, hints: ["sentdate", "datesent", "sent", "issued", "dateissued", "date", "createddate"] },
  { key: "reference", label: "Reference / No.", required: false, hints: ["mailno", "docno", "documentno", "reference", "ref", "number", "no", "correspondenceno"] },
  { key: "status", label: "Status", required: false, hints: ["status", "state"] },
  { key: "link", label: "Link", required: false, hints: ["link", "url", "href"] },
  { key: "notes", label: "Notes", required: false, hints: ["notes", "comment", "comments", "remarks"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function guessMapping(columns: string[]): Record<MapTarget, string> {
  const used = new Set<string>();
  const out = {} as Record<MapTarget, string>;
  for (const f of MAP_FIELDS) {
    let best = "";
    for (const c of columns) {
      if (used.has(c)) continue;
      if (f.hints.some((h) => norm(c) === norm(h))) {
        best = c;
        break;
      }
    }
    if (!best)
      for (const c of columns) {
        if (used.has(c)) continue;
        if (f.hints.some((h) => norm(c).includes(h))) {
          best = c;
          break;
        }
      }
    out[f.key] = best;
    if (best) used.add(best);
  }
  return out;
}

function normStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (!s) return "Awaiting";
  if (s.includes("close")) return "Closed";
  if (["respond", "complete", "answered", "replied", "received"].some((k) => s.includes(k)))
    return "Responded";
  return "Awaiting";
}

// Read a CSV or Excel file into { headers, rows-as-objects }.
function cellToStr(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
}

async function parseSpreadsheet(
  file: File,
): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const matrix = (await readXlsxFile(file)) as unknown as unknown[][];
    const headerRow = matrix[0] ?? [];
    const headers = headerRow.map((c, i) => cellToStr(c) || `Column ${i + 1}`);
    const data = matrix.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cellToStr(r[i]);
      });
      return obj;
    });
    return { headers, data };
  }
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) =>
        resolve({
          headers: (res.meta.fields ?? []).filter(Boolean),
          data: res.data,
        }),
      error: (err) => reject(err),
    });
  });
}

function ImportModal({
  onClose,
  onImport,
  pending,
}: {
  onClose: () => void;
  onImport: (rows: NewCorrespondence[]) => void;
  pending: boolean;
}) {
  type Stage = "drop" | "working" | "review";
  const [stage, setStage] = useState<Stage>("drop");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<MapTarget, string>>(
    {} as Record<MapTarget, string>,
  );
  const [defaultSource, setDefaultSource] = useState("Aconex");
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiOk, setAiOk] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage("working");
    try {
      const { headers, data } = await parseSpreadsheet(file);
      if (headers.length === 0)
        throw new Error("Couldn't read any columns from that file.");
      setColumns(headers);
      setRows(data);

      // Let Claude interpret which column is which; fall back to a keyword guess.
      let map = guessMapping(headers);
      let source = "Aconex";
      let reasoning: string | null = null;
      let ok = false;
      try {
        const res = await fetch("/api/correspondence/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headers, sampleRows: data.slice(0, 6) }),
        });
        if (res.ok) {
          const ai = await res.json();
          const m = {} as Record<MapTarget, string>;
          for (const f of MAP_FIELDS) {
            const v = ai.columnMap?.[f.key];
            m[f.key] = typeof v === "string" && headers.includes(v) ? v : "";
          }
          map = m;
          source = ai.source || "Aconex";
          reasoning = ai.reasoning || "Matched your columns automatically.";
          ok = true;
        }
      } catch {
        /* fall back to the offline guess */
      }
      setMapping(map);
      setDefaultSource(source);
      setAiReasoning(reasoning);
      setAiOk(ok);
      setShowManual(!ok);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
      setStage("drop");
    }
  }

  function reset() {
    setStage("drop");
    setRows([]);
    setColumns([]);
    setError(null);
  }

  // Build the importable rows from the current mapping.
  const built = useMemo(() => {
    const valid: NewCorrespondence[] = [];
    let skipped = 0;
    for (const r of rows) {
      const get = (k: MapTarget) =>
        mapping[k] ? String(r[mapping[k]] ?? "").trim() : "";
      const subject = get("subject");
      const sentTo = get("sentTo");
      const sentDate = parseFlexibleDate(get("sentDate"));
      if (!subject || !sentTo || !sentDate) {
        skipped++;
        continue;
      }
      valid.push({
        source: defaultSource,
        subject,
        sentTo,
        sentDate,
        reference: get("reference") || null,
        status: mapping.status ? normStatus(get("status")) : "Awaiting",
        link: get("link") || null,
        notes: get("notes") || null,
      });
    }
    return { valid, skipped };
  }, [rows, mapping, defaultSource]);

  const missingRequired = MAP_FIELDS.filter(
    (f) => f.required && !mapping[f.key],
  );

  return (
    <Modal onClose={onClose} title="Import correspondence" wide>
      {stage === "drop" && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver
                ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
                : "border-black/20 dark:border-white/25"
            }`}
          >
            <div className="text-4xl">📥</div>
            <p className="mt-3 font-medium">
              Drag &amp; drop your Aconex export here
            </p>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Excel (.xlsx) or CSV — Claude reads it and works out the columns
              for you. No manual matching.
            </p>
            <label className="mt-4 inline-block cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50">
              Choose a file
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      {stage === "working" && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/15 border-t-black/60 dark:border-white/20 dark:border-t-white/70" />
          <p className="text-sm font-medium">✨ Reading your file…</p>
          <p className="text-xs text-black/45 dark:text-white/45">
            Claude is working out which column is which.
          </p>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">
              📄 {fileName} · {rows.length} rows
            </span>
            <button
              onClick={reset}
              className="text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              choose a different file
            </button>
          </div>

          {aiOk ? (
            <div className="rounded-lg border border-sky-400/30 bg-sky-50 px-4 py-3 text-sm dark:bg-sky-950/20">
              <p className="font-medium">✨ Claude read your file</p>
              {aiReasoning && (
                <p className="mt-1 text-black/60 dark:text-white/60">
                  {aiReasoning}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Couldn&apos;t reach Claude to interpret this file — I&apos;ve
              auto-matched the columns as best I can. Check the mapping below.
            </div>
          )}

          {/* Detected mapping */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                Detected columns
              </span>
              <button
                onClick={() => setShowManual((s) => !s)}
                className="text-xs text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
              >
                {showManual ? "done" : "adjust"}
              </button>
            </div>

            {!showManual ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MAP_FIELDS.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-xs dark:border-white/15 dark:bg-white/[0.04]"
                  >
                    <span className="text-black/45 dark:text-white/45">
                      {f.label}:
                    </span>
                    <strong
                      className={
                        mapping[f.key] ? "" : "text-black/30 dark:text-white/30"
                      }
                    >
                      {mapping[f.key] || "—"}
                    </strong>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-xs dark:border-white/15 dark:bg-white/[0.04]">
                  <span className="text-black/45 dark:text-white/45">
                    Source:
                  </span>
                  <strong>{defaultSource}</strong>
                </span>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MAP_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [f.key]: e.target.value })
                      }
                      className={inputCls}
                    >
                      <option value="" className="bg-background text-foreground">
                        — none —
                      </option>
                      {columns.map((c) => (
                        <option
                          key={c}
                          value={c}
                          className="bg-background text-foreground"
                        >
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">
                    Source for all imported rows
                  </span>
                  <Select
                    value={defaultSource}
                    onChange={setDefaultSource}
                    options={[...SOURCES]}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Preview of the first few interpreted rows */}
          {built.valid.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="border-b border-black/10 uppercase tracking-wide text-black/40 dark:border-white/15 dark:text-white/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {built.valid.slice(0, 3).map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-black/5 last:border-0 dark:border-white/10"
                    >
                      <td className="px-3 py-2">{r.subject}</td>
                      <td className="px-3 py-2">{r.sentTo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.sentDate).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {missingRequired.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Couldn&apos;t match the required fields (
              {missingRequired.map((f) => f.label).join(", ")}). Click
              &ldquo;adjust&rdquo; to set them.
            </p>
          ) : (
            <p className="text-xs text-black/55 dark:text-white/55">
              Ready to import <strong>{built.valid.length}</strong> rows
              {built.skipped > 0 && (
                <>
                  {" "}
                  · {built.skipped} skipped (missing subject, recipient, or an
                  unreadable date)
                </>
              )}
              .
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              disabled={
                missingRequired.length > 0 ||
                built.valid.length === 0 ||
                pending
              }
              onClick={() => onImport(built.valid)}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {pending ? "Importing…" : `Import ${built.valid.length}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Shared modal + form primitives
// ─────────────────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`mt-10 w-full rounded-2xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15 ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({
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
      className={inputCls}
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-background text-foreground">
          {o}
        </option>
      ))}
    </select>
  );
}
