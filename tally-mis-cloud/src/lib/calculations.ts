import type { AppState, Metrics, RawSheet } from "./types";

function numeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function columnIndex(rows: RawSheet, needle: string): number {
  const header = rows[0] ?? [];
  return header.findIndex((cell) => String(cell).toLowerCase().includes(needle.toLowerCase()));
}

function rowLabel(row: unknown[]): string {
  return String(row[0] ?? "").trim().toLowerCase();
}

function firstMatchingTrialBalanceValue(state: AppState, patterns: RegExp[], column = "closing"): number {
  const rows = state.rawTrialBalance;
  const index = columnIndex(rows, column);
  if (index < 0) return 0;

  const row = rows.slice(1).find((candidate) => patterns.some((pattern) => pattern.test(rowLabel(candidate))));
  return row ? numeric(row[index]) : 0;
}

function trialBalanceAmount(state: AppState, ledgerName: string, patterns: RegExp[], column = "closing"): number {
  const exactValue = getTrialBalanceValue(state, ledgerName, column);
  return exactValue !== 0 ? exactValue : firstMatchingTrialBalanceValue(state, patterns, column);
}

export function getTrialBalanceValue(state: AppState, ledgerName: string, column = "closing"): number {
  const rows = state.rawTrialBalance;
  const index = columnIndex(rows, column);
  if (index < 0) return 0;

  const row = rows
    .slice(1)
    .find((candidate) => String(candidate[0] ?? "").trim().toLowerCase() === ledgerName.trim().toLowerCase());

  return row ? numeric(row[index]) : 0;
}

function sumColumn(rows: RawSheet, column: number): number {
  return rows.slice(1).reduce((sum, row) => sum + numeric(row[column]), 0);
}

function sumMatchingColumns(rows: RawSheet, include: RegExp[], exclude: RegExp[] = []): number {
  const header = rows[0] ?? [];
  const indexes = header
    .map((cell, index) => ({ text: String(cell ?? "").toLowerCase(), index }))
    .filter(({ text }) => include.some((pattern) => pattern.test(text)) && !exclude.some((pattern) => pattern.test(text)))
    .map(({ index }) => index);

  return indexes.reduce((total, index) => total + sumColumn(rows, index), 0);
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function calculateMetrics(state: AppState): Metrics {
  const productRevenue = Math.abs(
    trialBalanceAmount(state, "Product Sales - Software", [/^sales accounts$/, /^sales\s*-/i], "closing")
  );
  const consultingRevenue = Math.abs(
    trialBalanceAmount(state, "Consulting Service Revenue", [/service revenue/i, /consulting/i], "closing")
  );
  const totalRevenue = productRevenue + consultingRevenue;

  const totalCOGS =
    Math.abs(trialBalanceAmount(state, "Purchase of Software Stock", [/^purchase accounts$/, /^purchase\s/i], "closing")) +
    Math.abs(trialBalanceAmount(state, "Direct Subcontracting Costs", [/^direct expenses$/, /manufacturing expenses/i], "closing"));
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = safeRatio(grossProfit, totalRevenue);

  const totalOperatingExpenses =
    trialBalanceAmount(state, "Employee Salaries & Benefits", [/salary/i, /wages/i], "closing") +
    trialBalanceAmount(state, "Office Rent & Maintenance", [/rent/i, /maintenance/i], "closing") +
    trialBalanceAmount(state, "Professional & CA Fees", [/professional/i, /audit fees/i], "closing") +
    trialBalanceAmount(state, "Travel & Conveyance Expenses", [/travel/i, /conveyance/i], "closing") +
    trialBalanceAmount(state, "Sales & Marketing Expenses", [/marketing/i], "closing") +
    trialBalanceAmount(state, "Power, Fuel & Internet", [/power/i, /fuel/i, /internet/i], "closing") ||
    Math.abs(firstMatchingTrialBalanceValue(state, [/^indirect expenses$/], "closing"));

  const ebitda = grossProfit - totalOperatingExpenses;
  const ebitdaMargin = safeRatio(ebitda, totalRevenue);
  const financeInterest = Math.abs(trialBalanceAmount(state, "Finance Interest Charges", [/interest/i, /finance/i], "closing"));
  const depreciation = Math.abs(trialBalanceAmount(state, "Depreciation & Amortization", [/depreciation/i], "closing"));
  const pbt = ebitda - financeInterest - depreciation;
  const taxProvision = Math.max(0, pbt * 0.25);
  const pat = pbt - taxProvision;
  const netMargin = safeRatio(pat, totalRevenue);

  const shareCapital = Math.abs(trialBalanceAmount(state, "Share Capital", [/capital account/i, /share capital/i], "closing"));
  const retainedEarnings = Math.abs(trialBalanceAmount(state, "Retained Earnings", [/reserves/i, /retained/i], "closing"));
  const termLoan = Math.abs(trialBalanceAmount(state, "HDFC Bank Term Loan", [/secured loans/i, /bank od/i], "closing"));
  const unsecuredLoan = Math.abs(trialBalanceAmount(state, "Director's Unsecured Loan", [/unsecured loans/i], "closing"));
  const sundryCreditors = Math.abs(trialBalanceAmount(state, "Sundry Creditors (Payables)", [/^sundry creditors$/], "closing"));
  const totalCurrentLiabilities =
    Math.abs(firstMatchingTrialBalanceValue(state, [/^current liabilities$/], "closing")) ||
    sundryCreditors +
      Math.abs(getTrialBalanceValue(state, "GST Output CGST Payable")) +
      Math.abs(getTrialBalanceValue(state, "GST Output SGST Payable")) +
      Math.abs(getTrialBalanceValue(state, "GST Output IGST Payable")) +
      Math.abs(getTrialBalanceValue(state, "TDS Payable (Contractors/Rent)")) +
      Math.abs(getTrialBalanceValue(state, "Salary Payable"));

  const fixedAssetsNet =
    Math.abs(firstMatchingTrialBalanceValue(state, [/^fixed assets$/], "closing")) ||
    getTrialBalanceValue(state, "Office Premises (Owned)") +
      getTrialBalanceValue(state, "Computers & IT Equipment") +
      getTrialBalanceValue(state, "Office Furniture") +
      getTrialBalanceValue(state, "Accumulated Depreciation");

  const closingStock = Math.abs(trialBalanceAmount(state, "Inventory (Finished Goods)", [/stock/i, /inventory/i], "closing"));
  const sundryDebtors = Math.abs(trialBalanceAmount(state, "Sundry Debtors (Receivables)", [/^sundry debtors$/], "closing"));
  const cashBank =
    Math.abs(trialBalanceAmount(state, "Cash in Hand", [/cash-in-hand/i, /cash in hand/i], "closing")) +
    Math.abs(trialBalanceAmount(state, "HDFC Bank Current A/c", [/^bank accounts$/], "closing")) +
    Math.abs(getTrialBalanceValue(state, "ICICI Corporate A/c"));
  const gstITC = Math.abs(trialBalanceAmount(state, "GST Input Tax Credit (ITC)", [/input tax credit/i, /duties & taxes/i], "closing"));
  const totalCurrentAssets =
    Math.abs(firstMatchingTrialBalanceValue(state, [/^current assets$/], "closing")) || closingStock + sundryDebtors + cashBank + gstITC;
  const totalAssets = fixedAssetsNet + totalCurrentAssets;
  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;

  const debtorDays = Math.round(safeRatio(sundryDebtors, totalRevenue || 1) * 365);
  const creditorDays = Math.round(safeRatio(sundryCreditors, totalCOGS || 1) * 365);
  const inventoryDays = Math.round(safeRatio(closingStock, totalCOGS || 1) * 365);
  const cashConversionCycle = debtorDays + inventoryDays - creditorDays;
  const currentRatio = safeRatio(totalCurrentAssets, totalCurrentLiabilities);
  const quickRatio = safeRatio(sundryDebtors + cashBank + gstITC, totalCurrentLiabilities);
  const debtEquity = safeRatio(termLoan + unsecuredLoan, shareCapital + retainedEarnings);
  const capitalEmployed = shareCapital + retainedEarnings + termLoan + unsecuredLoan;
  const roce = safeRatio(pbt + financeInterest, capitalEmployed);
  const roe = safeRatio(pat, shareCapital + retainedEarnings);
  const gstCollected = sumMatchingColumns(state.rawSales, [/^gst$/i, /output.*gst/i, /output.*cgst/i, /output.*sgst/i, /output.*igst/i]);
  const gstClaimed = sumMatchingColumns(state.rawPurchases, [/^gst$/i, /input.*gst/i, /input.*cgst/i, /input.*sgst/i, /input.*igst/i, /gst purchase/i]);
  const gstNetPayable = Math.max(0, gstCollected - gstClaimed);

  return {
    totalRevenue,
    productRevenue,
    consultingRevenue,
    totalCOGS,
    grossProfit,
    grossMargin,
    totalOperatingExpenses,
    ebitda,
    ebitdaMargin,
    financeInterest,
    depreciation,
    pbt,
    taxProvision,
    pat,
    netMargin,
    shareCapital,
    retainedEarnings,
    termLoan,
    unsecuredLoan,
    sundryCreditors,
    totalCurrentLiabilities,
    fixedAssetsNet,
    closingStock,
    sundryDebtors,
    cashBank,
    gstITC,
    totalCurrentAssets,
    totalAssets,
    workingCapital,
    debtorDays,
    creditorDays,
    inventoryDays,
    cashConversionCycle,
    currentRatio,
    quickRatio,
    debtEquity,
    roce,
    roe,
    gstCollected,
    gstClaimed,
    gstNetPayable
  };
}
