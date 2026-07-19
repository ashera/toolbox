// ───────────────────────────────────────────────────────────────────────────
//  Work-related expense categories + deductibility rules for EMPLOYEES.
//
//  Plain TypeScript (no "use client"/"use server") so it can be imported from
//  both the server actions and the client UI.
//
//  The ATO's three "golden rules" for an employee deduction: you paid it
//  yourself and weren't reimbursed, it directly relates to earning your
//  income (only the work-use portion counts), and you have a record.
//  These categories encode the common outcomes — general guidance to check
//  with an accountant, not a formal ruling.
// ───────────────────────────────────────────────────────────────────────────

export type Eligibility = "eligible" | "conditional" | "ineligible";

export type Category = {
  /** Stored in the database `category` column. */
  id: string;
  label: string;
  eligibility: Eligibility;
  /** One-line plain-English guidance shown next to the item. */
  note: string;
};

export const CATEGORIES: Category[] = [
  {
    id: "tools_equipment",
    label: "Tools & equipment",
    eligibility: "eligible",
    note: "Deductible when used for work. Items over $300 are generally depreciated over time rather than claimed all at once.",
  },
  {
    id: "wfh",
    label: "Working from home",
    eligibility: "eligible",
    note: "Claim the work-use portion of running costs (electricity, internet, phone). Keep a log of hours worked from home.",
  },
  {
    id: "phone_internet",
    label: "Phone & internet",
    eligibility: "eligible",
    note: "Only the work-use percentage is deductible — set the work-use % to match your usage.",
  },
  {
    id: "union_memberships",
    label: "Union fees & professional memberships",
    eligibility: "eligible",
    note: "Union fees, professional association memberships and work registrations are deductible.",
  },
  {
    id: "subscriptions_books",
    label: "Work subscriptions & reference books",
    eligibility: "eligible",
    note: "Journals, technical books and work-related digital subscriptions are deductible.",
  },
  {
    id: "vehicle_travel",
    label: "Car & work travel",
    eligibility: "conditional",
    note: "Trips between worksites or for work duties are deductible; normal home-to-work commuting is not. Needs a logbook or cents-per-km records.",
  },
  {
    id: "self_education",
    label: "Self-education & courses",
    eligibility: "conditional",
    note: "Deductible only if it maintains or improves skills for your CURRENT job. Study to get a new job doesn't qualify.",
  },
  {
    id: "protective_clothing",
    label: "Uniforms & protective clothing",
    eligibility: "conditional",
    note: "Occupation-specific uniforms, compulsory branded uniforms and protective gear (hi-vis, steel-caps) qualify. Plain clothing does not.",
  },
  {
    id: "seminars_conferences",
    label: "Seminars & conferences",
    eligibility: "conditional",
    note: "Deductible when directly related to your current work. Any travel and meal portions have extra substantiation rules.",
  },
  {
    id: "income_protection",
    label: "Income protection insurance",
    eligibility: "conditional",
    note: "Premiums are deductible, but NOT life, trauma or TPD cover, and not if the policy is held inside super.",
  },
  {
    id: "commuting",
    label: "Home-to-work travel (commuting)",
    eligibility: "ineligible",
    note: "Normal travel between home and your regular workplace is private — not deductible.",
  },
  {
    id: "conventional_clothing",
    label: "Plain clothing & grooming",
    eligibility: "ineligible",
    note: "Everyday clothes, haircuts and grooming are private, even if your employer requires a certain look.",
  },
  {
    id: "meals_entertainment",
    label: "Meals & entertainment (general)",
    eligibility: "ineligible",
    note: "Everyday meals and entertainment are private. (Limited exceptions exist for overtime-meal allowances and overnight work travel.)",
  },
  {
    id: "other",
    label: "Other",
    eligibility: "conditional",
    note: "Assess against the three golden rules: you paid it, it relates to earning your income, and you have a record.",
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Look up a category, falling back to "Other" for unknown ids. */
export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** A stored expense row (mirrors the Prisma ExpenseItem model). */
export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  workUsePercent: number;
  reimbursed: boolean;
};

/**
 * The dollar amount actually claimable for an expense.
 * - Reimbursed expenses → $0 (you didn't bear the cost).
 * - Ineligible categories → $0.
 * - Otherwise → amount × work-use %.
 */
export function claimableAmount(e: Expense): number {
  if (e.reimbursed) return 0;
  if (getCategory(e.category).eligibility === "ineligible") return 0;
  const pct = Math.min(100, Math.max(0, e.workUsePercent)) / 100;
  return e.amount * pct;
}

/** Why an expense's claimable amount is $0, or null if it is claimable. */
export function excludedReason(e: Expense): string | null {
  if (e.reimbursed) return "Reimbursed by employer";
  if (getCategory(e.category).eligibility === "ineligible")
    return "Not deductible";
  return null;
}
