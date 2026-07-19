"use client"; // This tool runs entirely in the browser (React state, no backend).

import { useState } from "react";
import ToolShell from "@/components/ToolShell";

// ───────────────────────────────────────────────────────────────────────────
//  FY26 (2025–26) Australian resident individual tax estimate.
//
//  All rates/thresholds are for the income year 1 Jul 2025 – 30 Jun 2026 and
//  were checked against the ATO (and reliable secondary sources) in Jul 2026.
//  This is an ESTIMATE for a single resident individual — not tax advice.
//  Some inputs (HELP repayment income, MLS income) use "income for surcharge"
//  in real life; here we approximate them with taxable income. See notes in UI.
// ───────────────────────────────────────────────────────────────────────────

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

/** Medicare levy (2%) with the 2025–26 single low-income shade-in.
 *  Nil ≤ $28,011; phases in at 10c/$ to $35,013; full 2% above. */
function medicareLevy(taxable: number): number {
  const LOWER = 28_011;
  const UPPER = 35_013;
  if (taxable <= LOWER) return 0;
  if (taxable <= UPPER) return (taxable - LOWER) * 0.1;
  return taxable * 0.02;
}

/** Medicare Levy Surcharge — 2025–26 SINGLE tiers. Only applies when the
 *  person had NO private hospital cover. Charged on the whole income. */
function medicareLevySurcharge(income: number, hasHospitalCover: boolean): number {
  if (hasHospitalCover) return 0;
  if (income <= 101_000) return 0;
  if (income <= 118_000) return income * 0.01;
  if (income <= 158_000) return income * 0.0125;
  return income * 0.015;
}

/** HELP/HECS compulsory repayment — 2025–26 NEW marginal system.
 *  Nil ≤ $67,000; 15% on the slice $67k–$125k; then $8,700 + 17% above $125k;
 *  the whole repayment is capped at 10% of repayment income. */
function helpRepayment(income: number): number {
  if (income <= 67_000) return 0;
  let marginal: number;
  if (income <= 125_000) marginal = (income - 67_000) * 0.15;
  else marginal = 8_700 + (income - 125_000) * 0.17;
  return Math.min(marginal, income * 0.1);
}

const money = (n: number) =>
  n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });

/** A labelled dollar input. Empty string is treated as 0 by the caller. */
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

export default function TaxReturnFy26Page() {
  const [salary, setSalary] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [deductions, setDeductions] = useState("");
  const [paygWithheld, setPaygWithheld] = useState("");
  const [hasHospitalCover, setHasHospitalCover] = useState(true);
  const [hasHelpDebt, setHasHelpDebt] = useState(false);

  const num = (s: string) => (s ? parseFloat(s) || 0 : 0);

  const grossIncome = num(salary) + num(otherIncome);
  const taxable = Math.max(0, grossIncome - num(deductions));

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

  const breakdown = [
    { label: "Gross income", value: grossIncome },
    { label: "Less work-related deductions", value: -num(deductions), muted: true },
    { label: "Taxable income", value: taxable, strong: true },
    { label: "Income tax", value: tax },
    { label: "Less low income tax offset (LITO)", value: -offset, muted: true },
    { label: "Medicare levy (2%)", value: levy },
    ...(surcharge > 0
      ? [{ label: "Medicare levy surcharge", value: surcharge }]
      : []),
    ...(help > 0
      ? [{ label: "HELP/HECS compulsory repayment", value: help }]
      : []),
    { label: "Total tax & levies", value: totalLiability, strong: true },
    { label: "Less PAYG tax withheld", value: -withheld, muted: true },
  ];

  return (
    <ToolShell slug="tax-return-fy26">
      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Inputs ── */}
        <div className="space-y-4">
          <Field
            label="Salary & wages"
            hint="gross, before tax"
            value={salary}
            onChange={setSalary}
          />
          <Field
            label="Other income"
            hint="interest, dividends, etc."
            value={otherIncome}
            onChange={setOtherIncome}
          />
          <Field
            label="Work-related deductions"
            hint="WFH, car, tools…"
            value={deductions}
            onChange={setDeductions}
          />
          <Field
            label="PAYG tax withheld"
            hint="from your payslips / summary"
            value={paygWithheld}
            onChange={setPaygWithheld}
          />

          <label className="flex items-center gap-3 pt-1 text-sm">
            <input
              type="checkbox"
              checked={hasHospitalCover}
              onChange={(e) => setHasHospitalCover(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              I had private <strong>hospital</strong> cover all year
              <span className="block text-xs text-black/45 dark:text-white/45">
                Avoids the Medicare levy surcharge
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={hasHelpDebt}
              onChange={(e) => setHasHelpDebt(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              I have a <strong>HELP/HECS</strong> debt
              <span className="block text-xs text-black/45 dark:text-white/45">
                Adds the 2025–26 compulsory repayment
              </span>
            </span>
          </label>
        </div>

        {/* ── Result ── */}
        <div>
          <div
            className={`rounded-xl border p-5 text-center ${
              isRefund
                ? "border-green-600/30 bg-green-600/5"
                : "border-amber-600/30 bg-amber-600/5"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              {isRefund ? "Estimated refund" : "Estimated amount owing"}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">
              {money(Math.abs(balance))}
            </div>
            <div className="mt-1 text-xs text-black/45 dark:text-white/45">
              Effective tax rate {effectiveRate.toFixed(1)}%
            </div>
          </div>

          <dl className="mt-5 space-y-1.5 text-sm">
            {breakdown.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between gap-4 ${
                  row.strong
                    ? "border-t border-black/10 pt-1.5 font-semibold dark:border-white/15"
                    : ""
                }`}
              >
                <dt
                  className={
                    row.muted ? "text-black/50 dark:text-white/50" : undefined
                  }
                >
                  {row.label}
                </dt>
                <dd className="tabular-nums">{money(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="mt-8 rounded-lg border border-black/10 bg-black/[0.02] p-4 text-xs leading-relaxed text-black/55 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/55">
        <strong>Estimate only — not tax advice.</strong> Uses 2025–26 resident
        rates for a single individual as at July 2026. It assumes salary is your
        only PAYG source and approximates HELP repayment income and
        surcharge income with your taxable income. It doesn&apos;t handle tax
        offsets beyond LITO, family/senior Medicare thresholds, foreign income,
        capital gains, or franking credits. Bring your payment summaries and
        receipts to your accountant — treat this as a sanity check, not a
        lodged return.
      </p>
    </ToolShell>
  );
}
