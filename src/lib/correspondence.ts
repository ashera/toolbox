// Shared types + pure helpers for the Correspondence Tracker.
// No server-only imports here, so this is safe to use in client components too.

export type CorrespondenceDTO = {
  id: string;
  source: string; // "Aconex" | "Email" | "Other"
  reference: string | null;
  subject: string;
  sentTo: string;
  sentDate: string; // ISO string
  responseNeededBy: string | null; // ISO string
  status: string; // "Awaiting" | "Responded" | "Closed"
  respondedDate: string | null; // ISO string
  link: string | null;
  notes: string | null;
};

export const SOURCES = ["Aconex", "Email", "Other"] as const;

// Shape used when creating rows (manual entry and CSV import).
export type NewCorrespondence = {
  source: string;
  reference?: string | null;
  subject: string;
  sentTo: string;
  sentDate: string; // ISO
  responseNeededBy?: string | null; // ISO
  status?: string;
  link?: string | null;
  notes?: string | null;
};

// The default follow-up threshold, in WORKING days. Anything still awaiting a
// response after this long is flagged "Overdue". Overridable per viewer in the UI.
export const DEFAULT_THRESHOLD_WD = 5;

// Count working days (Mon–Fri) between two dates. Weekends don't count, so
// something sent Friday isn't "2 days overdue" by Monday morning.
export function workingDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setUTCHours(0, 0, 0, 0);
  while (cur < stop) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// How long an item has been (or was) waiting, in working days.
export function daysWaiting(item: CorrespondenceDTO): number {
  const end = item.respondedDate ? new Date(item.respondedDate) : new Date();
  return workingDaysBetween(new Date(item.sentDate), end);
}

// The status we actually show: "Overdue" is a derived flavour of "Awaiting".
export type DisplayStatus = "Awaiting" | "Overdue" | "Responded" | "Closed";

export function displayStatus(
  item: CorrespondenceDTO,
  thresholdWorkingDays: number = DEFAULT_THRESHOLD_WD,
): DisplayStatus {
  if (item.status === "Responded") return "Responded";
  if (item.status === "Closed") return "Closed";
  // status === "Awaiting"
  const now = new Date();
  if (item.responseNeededBy) {
    return new Date(item.responseNeededBy) < now ? "Overdue" : "Awaiting";
  }
  return daysWaiting(item) > thresholdWorkingDays ? "Overdue" : "Awaiting";
}

// Parse dates from messy CSV exports. Handles ISO (2024-12-31), common
// day-first formats (31/12/2024, 31-12-2024), and falls back to Date.parse.
// Returns an ISO string, or null if it can't be understood.
export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Build a UTC-midnight date so the calendar day is preserved exactly,
  // independent of the viewer's timezone.
  const utc = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  // ISO-ish: 2024-12-31 or 2024/12/31 (year first)
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return utc(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Day-first: 31/12/2024 or 31-12-2024 (assume DD/MM/YYYY, common in AU/UK)
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return utc(year, Number(dmy[2]), Number(dmy[1]));
  }

  // Anything else (e.g. "31 Dec 2024", "Dec 31, 2024"). Parse, then re-anchor
  // the resulting calendar day to UTC midnight.
  const t = Date.parse(s);
  if (isNaN(t)) return null;
  const d = new Date(t);
  return utc(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
