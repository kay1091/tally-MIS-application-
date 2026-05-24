import { calculateMetrics } from "./calculations";
import type { AppState, RawRow, RawSheet } from "./types";

export const monthlyTrendHeader: RawRow = [
  "Month",
  "Revenue",
  "COGS",
  "Gross Profit",
  "Indirect Expenses",
  "EBITDA",
  "Net Profit",
  "Receivables",
  "Payables",
  "Closing Stock",
  "Cash Balance"
];

function hasData(rows: RawSheet): boolean {
  return rows.length > 1;
}

export function reportingPeriodLabel(period: string): string {
  const match = period.match(/to\s+\d{1,2}-([A-Za-z]{3})-(\d{2,4})/i) ?? period.match(/\d{1,2}-([A-Za-z]{3})-(\d{2,4})/i);
  if (!match) return period || "Current period";

  const [, month, rawYear] = match;
  return `${month.slice(0, 3)}-${rawYear.slice(-2)}`;
}

function valueWhen(available: boolean, value: number): number | null {
  if (!available) return null;
  return Number.isFinite(value) ? value : null;
}

export function buildTrendRowFromState(state: AppState): RawRow {
  const metrics = calculateMetrics(state);
  const hasTrialBalance = hasData(state.rawTrialBalance);

  return [
    reportingPeriodLabel(state.reportingPeriod),
    valueWhen(hasTrialBalance, metrics.totalRevenue),
    valueWhen(hasTrialBalance, metrics.totalCOGS),
    valueWhen(hasTrialBalance, metrics.grossProfit),
    valueWhen(hasTrialBalance, metrics.totalOperatingExpenses),
    valueWhen(hasTrialBalance, metrics.ebitda),
    valueWhen(hasTrialBalance, metrics.pat),
    valueWhen(hasTrialBalance, metrics.sundryDebtors),
    valueWhen(hasTrialBalance, metrics.sundryCreditors),
    valueWhen(hasTrialBalance, metrics.closingStock),
    valueWhen(hasTrialBalance, metrics.cashBank)
  ];
}

export function replaceGeneratedTrendRow(state: AppState): AppState {
  return {
    ...state,
    monthlyTrends: [monthlyTrendHeader, buildTrendRowFromState(state)]
  };
}
