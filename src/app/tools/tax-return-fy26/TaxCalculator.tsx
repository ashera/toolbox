"use client"; // Interactive calculator — runs in the browser.

import { useEffect, useRef, useState } from "react";
import { addExpense, deleteExpense, saveTaxProfile } from "./actions";
import {
  CATEGORIES,
  getCategory,
  claimableAmount,
  excludedReason,
  type Expense,
  type Eligibility,
  type TaxProfileInput,
} from "./eligibility";

// ───────────────────────── FY26 (2025–26) tax engine ─────────────────────────
// Rates/thresholds for a single resident individual, checked against the ATO
// in July 2026. Estimate only — not tax advice. (See the disclaimer in the UI.)

/** Resident income tax on taxable income — 2025–26 rates (excl. Medicare levy). */
function incomeTax(taxable: number): number {
  if (taxable <= 18_200) return 0;
  if (taxable <= 45_000) return (taxable - 18_200) * 0.16;
  if (taxable <= 135_000) return 4_288 + (taxable - 45_000) * 0.3;
  if (taxable <= 190_000) return 31_288 + (taxable - 135_000) * 0.37;
  return 51_638 + (taxable - 190_000) * 0.45;
}

/** Low Income Tax Offset (LITO) — 2025–26. Max $700, non-refundable. */
function lito(taxable: number): number {
  if (taxable <= 37_500) return 700;
  if (taxable <= 45_000) return 700 - (taxable - 37_500) * 0.05;
  if (taxable <= 66_667) return Math.max(0, 325 - (taxable - 45_000) * 0.015);
  return 0;
}

/** Medicare levy (2%) with the 2025–26 single low-income shade-in. */
function medicareLevy(taxable: number): number {
  const LOWER = 28_011;
  const UPPER = 35_013;
  if (taxable <= LOWER) return 0;
  if (taxable <= UPPER) return (taxable - LOWER) * 0.1;
  return taxable * 0.02;
}

/** Medicare Levy Surcharge — 2025–26 SINGLE tiers; only when no hospital cover. */
function medicareLevySurcharge(income: number, hasHospitalCover: boolean): number {
  if (hasHospitalCover) return 0;
  if (income <= 101_000) return 0;
  if (income <= 118_000) return income * 0.01;
  if (income <= 158_000) return income * 0.0125;
  return income * 0.015;
}

/** HELP/HECS compulsory repayment — 2025–26 new marginal system. */
function helpRepayment(income: number): number {
  if (income <= 67_000) return 0;
  let marginal: number;
  if (income <= 125_000) marginal = (income - 67_000) * 0.15;
  else marginal = 8_700 + (income - 125_000) * 0.17;
  return Math.min(marginal, income * 0.1);
}

/** Total tax + levies at a given taxable income, holding the flags constant.
 *  Used to value deductions: how much tax is saved by lowering taxable income. */
function liabilityAt(taxable: number, hasHospitalCover: boolean, hasHelpDebt: boolean): number {
  const net = Math.max(0, incomeTax(taxable) - lito(taxable));
  const help = hasHelpDebt ? helpRepayment(taxable) : 0;
  return net + medicareLevy(taxable) + medicareLevySurcharge(taxable, hasHospitalCover) + help;
}

const money = (n: number) =>
  n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });

const BADGE: Record<Eligibility, { text: string; cls: string }> = {
  eligible: {
    text: "Deductible",
    cls: "bg-green-600/10 text-green-700 dark:text-green-400",
  },
  conditional: {
    text: "Check conditions",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  ineligible: {
    text: "Not deductible",
    cls: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

/** A labelled dollar input for the income fields. */
function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && (
        <span className="ml-1 text-xs text-black/45 dark:text-white/45">{hint}</span>
      )}
      <div className="mt-1 flex items-center rounded-lg border border-black/15 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/50">
        <span className="pl-3 text-black/40 dark:text-white/40">$</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          className="w-full bg-transparent p-2.5 pl-1.5 tabular-nums outline-none"
        />
      </div>
    </label>
  );
}

export default function TaxCalculator({
  expenses,
  initialProfile,
  dbReady,
  dbError,
}: {
  expenses: Expense[];
  initialProfile: TaxProfileInput | null;
  dbReady: boolean;
  dbError?: string;
}) {
  // Seed the income fields from the database (via the server component), so
  // they load on any device. SSR and first client render use the same values.
  const [salary, setSalary] = useState(initialProfile?.salary ?? "");
  const [otherIncome, setOtherIncome] = useState(initialProfile?.otherIncome ?? "");
  const [paygWithheld, setPaygWithheld] = useState(initialProfile?.paygWithheld ?? "");
  const [hasHospitalCover, setHasHospitalCover] = useState(initialProfile?.hasHospitalCover ?? true);
  const [hasHelpDebt, setHasHelpDebt] = useState(initialProfile?.hasHelpDebt ?? false);
  // Category chosen in the "add expense" form, so we can preview eligibility.
  const [draftCategory, setDraftCategory] = useState(CATEGORIES[0].id);

  // Auto-save the income fields to the database, debounced so we write ~600ms
  // after typing stops rather than on every keystroke. Skips the first run
  // (the seeded values already match the DB) and no-ops when the DB is down.
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved">("idle");
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (!dbReady) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    setSyncState("saving");
    const t = setTimeout(() => {
      saveTaxProfile({ salary, otherIncome, paygWithheld, hasHospitalCover, hasHelpDebt })
        .then(() => setSyncState("saved"))
        .catch(() => setSyncState("idle"));
    }, 600);
    return () => clearTimeout(t);
  }, [dbReady, salary, otherIncome, paygWithheld, hasHospitalCover, hasHelpDebt]);

  const num = (s: string) => (s ? parseFloat(s) || 0 : 0);

  // Deductions come from the itemised, DB-persisted expenses.
  const deductions = expenses.reduce((sum, e) => sum + claimableAmount(e), 0);

  const grossIncome = num(salary) + num(otherIncome);
  const taxable = Math.max(0, grossIncome - deductions);

  const tax = incomeTax(taxable);
  const offset = lito(taxable);
  const netIncomeTax = Math.max(0, tax - offset); // LITO can't reduce below 0
  const levy = medicareLevy(taxable);
  const surcharge = medicareLevySurcharge(taxable, hasHospitalCover);
  const help = hasHelpDebt ? helpRepayment(taxable) : 0;

  const totalLiability = netIncomeTax + levy + surcharge + help;
  const withheld = num(paygWithheld);
  const balance = totalLiability - withheld; // >0 owe, <0 refund
  const isRefund = balance < 0;
  const effectiveRate = taxable > 0 ? (totalLiability / taxable) * 100 : 0;

  // What the deductions are worth: the drop in total tax from removing them.
  // A deduction only saves tax at your marginal rate, not the full dollar.
  const liabilityNoDeductions = liabilityAt(grossIncome, hasHospitalCover, hasHelpDebt);
  const deductionTaxSaving = Math.max(0, liabilityNoDeductions - totalLiability);
  // Tax saved per $1 deducted — the same for every dollar, so each expense's
  // contribution is proportional to its claimable amount (and they sum exactly).
  const savingPerDollar = deductions > 0 ? deductionTaxSaving / deductions : 0;

  const breakdown = [
    { label: "Gross income", value: grossIncome },
    { label: "Less work-related deductions", value: -deductions, muted: true },
    { label: "Taxable income", value: taxable, strong: true },
    { label: "Income tax", value: tax },
    { label: "Less low income tax offset (LITO)", value: -offset, muted: true },
    { label: "Medicare levy (2%)", value: levy },
    ...(surcharge > 0 ? [{ label: "Medicare levy surcharge", value: surcharge }] : []),
    ...(help > 0 ? [{ label: "HELP/HECS compulsory repayment", value: help }] : []),
    { label: "Total tax & levies", value: totalLiability, strong: true },
    { label: "Less PAYG tax withheld", value: -withheld, muted: true },
  ];

  const draft = getCategory(draftCategory);

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Income inputs ── */}
        <div className="space-y-4">
          <Field label="Salary & wages" hint="gross, before tax" value={salary} onChange={setSalary} />
          <Field label="Other income" hint="interest, dividends…" value={otherIncome} onChange={setOtherIncome} />
          <Field label="PAYG tax withheld" hint="from your income statement" value={paygWithheld} onChange={setPaygWithheld} />

          <label className="flex items-center gap-3 pt-1 text-sm">
            <input type="checkbox" checked={hasHospitalCover} onChange={(e) => setHasHospitalCover(e.target.checked)} className="h-4 w-4" />
            <span>
              I had private <strong>hospital</strong> cover all year
              <span className="block text-xs text-black/45 dark:text-white/45">
                {hasHospitalCover
                  ? "No surcharge — you're covered."
                  : surcharge > 0
                    ? `Surcharge applies at this income: ${money(surcharge)}`
                    : "No surcharge — income is under the $101,000 threshold, so this box has no effect."}
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={hasHelpDebt} onChange={(e) => setHasHelpDebt(e.target.checked)} className="h-4 w-4" />
            <span>
              I have a <strong>HELP/HECS</strong> debt
              <span className="block text-xs text-black/45 dark:text-white/45">Adds the 2025–26 compulsory repayment</span>
            </span>
          </label>

          <p className="pt-1 text-xs text-black/40 dark:text-white/40">
            {!dbReady
              ? "↳ Not saved — database not connected."
              : syncState === "saving"
                ? "↳ Saving…"
                : syncState === "saved"
                  ? "↳ Saved — synced across your devices."
                  : "↳ Auto-saved to your account and synced across devices."}
          </p>
        </div>

        {/* ── Result ── */}
        <div>
          <div className={`rounded-xl border p-5 text-center ${isRefund ? "border-green-600/30 bg-green-600/5" : "border-amber-600/30 bg-amber-600/5"}`}>
            <div className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              {isRefund ? "Estimated refund" : "Estimated amount owing"}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">{money(Math.abs(balance))}</div>
            <div className="mt-1 text-xs text-black/45 dark:text-white/45">Effective tax rate {effectiveRate.toFixed(1)}%</div>
          </div>

          <dl className="mt-5 space-y-1.5 text-sm">
            {breakdown.map((row) => (
              <div key={row.label} className={`flex justify-between gap-4 ${row.strong ? "border-t border-black/10 pt-1.5 font-semibold dark:border-white/15" : ""}`}>
                <dt className={row.muted ? "text-black/50 dark:text-white/50" : undefined}>{row.label}</dt>
                <dd className="tabular-nums">{money(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Itemised work-related expenses (DB-backed) ── */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Work-related expenses</h2>
          <div className="text-right text-sm text-black/50 dark:text-white/50">
            <div>
              Claimable: <strong className="tabular-nums text-foreground">{money(deductions)}</strong>
            </div>
            <div>
              Tax saved:{" "}
              <strong className="tabular-nums text-green-700 dark:text-green-400">
                {money(deductionTaxSaving)}
              </strong>
              {deductions > 0 && savingPerDollar > 0 && (
                <span className="text-black/40 dark:text-white/40"> · {Math.round(savingPerDollar * 100)}% per $1</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          Add each expense and the tool flags likely deductibility, then feeds the claimable
          portion into your taxable income above. Saved to your database so they persist.
        </p>
        {/* How much the deductions are actually worth, adapting to the entered income. */}
        {deductions > 0 && (
          <p className="mt-2 rounded-md bg-green-600/[0.07] px-3 py-2 text-sm text-black/70 dark:text-white/70">
            {grossIncome === 0
              ? "Enter your salary above to see how much tax these deductions save."
              : deductionTaxSaving === 0
                ? "At this taxable income there's no tax for these deductions to reduce — so they add nothing to your refund."
                : `These deductions cut your tax by about ${money(deductionTaxSaving)} — roughly ${Math.round(savingPerDollar * 100)}c of every $1 claimed (your marginal rate incl. Medicare levy). Each expense's share is shown as “saves ~$” below.`}
          </p>
        )}

        {!dbReady ? (
          <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-50 p-5 text-sm dark:bg-amber-950/30">
            <p className="font-semibold">⚙️ Database not connected yet</p>
            <p className="mt-2 text-black/70 dark:text-white/70">
              Saving expenses needs the Postgres <code>DATABASE_URL</code> in your <code>.env</code>.
              Add it, run <code>npm run db:push</code>, then refresh. The calculator above still works
              without it — it just can&apos;t save your itemised list.
            </p>
            {dbError && <p className="mt-3 font-mono text-xs text-black/40 dark:text-white/40">{dbError}</p>}
          </div>
        ) : (
          <>
            {/* Add-expense form → server action → Postgres */}
            <form action={addExpense} className="mt-4 grid gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium">Description</span>
                <input name="description" required placeholder="e.g. Laptop, steel-cap boots, home internet"
                  className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50" />
              </label>

              <label className="block">
                <span className="text-xs font-medium">Category</span>
                <select name="category" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50">
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-background">{c.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium">Amount</span>
                <div className="mt-1 flex items-center rounded-lg border border-black/15 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/50">
                  <span className="pl-2.5 text-black/40 dark:text-white/40">$</span>
                  <input name="amount" inputMode="decimal" required placeholder="0"
                    className="w-full bg-transparent p-2 pl-1 text-sm tabular-nums outline-none" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-medium">Work-use %</span>
                <input name="workUsePercent" inputMode="numeric" defaultValue={100} placeholder="100"
                  className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-2 text-sm tabular-nums outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50" />
              </label>

              <label className="flex items-center gap-2 text-sm sm:pt-6">
                <input type="checkbox" name="reimbursed" className="h-4 w-4" />
                <span>Reimbursed by employer</span>
              </label>

              {/* Live eligibility preview for the selected category */}
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md bg-black/[0.03] p-2.5 text-xs dark:bg-white/[0.04]">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${BADGE[draft.eligibility].cls}`}>
                  {BADGE[draft.eligibility].text}
                </span>
                <span className="text-black/60 dark:text-white/60">{draft.note}</span>
              </div>

              <div className="sm:col-span-2">
                <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
                  Add expense
                </button>
              </div>
            </form>

            {/* Saved expenses */}
            <ul className="mt-4 space-y-2">
              {expenses.length === 0 && (
                <li className="text-sm text-black/50 dark:text-white/50">No expenses yet — add your first one above.</li>
              )}
              {expenses.map((e) => {
                const cat = getCategory(e.category);
                const claimable = claimableAmount(e);
                const reason = excludedReason(e);
                const contribution = claimable * savingPerDollar; // its share of the refund
                return (
                  <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{e.description}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[cat.eligibility].cls}`}>
                          {BADGE[cat.eligibility].text}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                        {cat.label} · {money(e.amount)}
                        {e.workUsePercent !== 100 && !e.reimbursed && cat.eligibility !== "ineligible" && ` · ${e.workUsePercent}% work use`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <div className="tabular-nums font-medium">{money(claimable)}</div>
                        {claimable > 0 ? (
                          <div className="text-xs tabular-nums text-green-700 dark:text-green-400">
                            {contribution > 0 ? `saves ~${money(contribution)}` : "claimable"}
                          </div>
                        ) : (
                          reason && <div className="text-xs text-black/40 dark:text-white/40">{reason}</div>
                        )}
                      </div>
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" aria-label="Delete expense" className="text-black/30 transition-colors hover:text-red-500 dark:text-white/30">✕</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ── Disclaimer ── */}
      <p className="mt-8 rounded-lg border border-black/10 bg-black/[0.02] p-4 text-xs leading-relaxed text-black/55 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/55">
        <strong>Estimate only — not tax advice.</strong> Uses 2025–26 resident rates for a single
        individual as at July 2026. Expense deductibility flags apply the ATO&apos;s general employee
        rules — treat &ldquo;check conditions&rdquo; items as prompts to confirm with your accountant,
        who can settle the finer calls (capital items, mixed-use, self-education). &ldquo;Tax saved&rdquo;
        values each deduction at your marginal rate (incl. Medicare levy) and is approximate. It
        doesn&apos;t handle offsets beyond LITO, family/senior Medicare thresholds, capital gains, or
        franking credits.
      </p>
    </>
  );
}
