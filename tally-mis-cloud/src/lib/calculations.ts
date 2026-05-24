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

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function calculateMetrics(state: AppState): Metrics {
  const productRevenue = getTrialBalanceValue(state, "Product Sales - Software") * -1;
  const consultingRevenue = getTrialBalanceValue(state, "Consulting Service Revenue") * -1;
  const totalRevenue = productRevenue + consultingRevenue;

  const totalCOGS =
    getTrialBalanceValue(state, "Purchase of Software Stock") +
    getTrialBalanceValue(state, "Direct Subcontracting Costs");
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = safeRatio(grossProfit, totalRevenue);

  const totalOperatingExpenses =
    getTrialBalanceValue(state, "Employee Salaries & Benefits") +
    getTrialBalanceValue(state, "Office Rent & Maintenance") +
    getTrialBalanceValue(state, "Professional & CA Fees") +
    getTrialBalanceValue(state, "Travel & Conveyance Expenses") +
    getTrialBalanceValue(state, "Sales & Marketing Expenses") +
    getTrialBalanceValue(state, "Power, Fuel & Internet");

  const ebitda = grossProfit - totalOperatingExpenses;
  const ebitdaMargin = safeRatio(ebitda, totalRevenue);
  const financeInterest = getTrialBalanceValue(state, "Finance Interest Charges");
  const depreciation = getTrialBalanceValue(state, "Depreciation & Amortization");
  const pbt = ebitda - financeInterest - depreciation;
  const taxProvision = Math.max(0, pbt * 0.25);
  const pat = pbt - taxProvision;
  const netMargin = safeRatio(pat, totalRevenue);

  const shareCapital = getTrialBalanceValue(state, "Share Capital") * -1;
  const retainedEarnings = getTrialBalanceValue(state, "Retained Earnings") * -1;
  const termLoan = getTrialBalanceValue(state, "HDFC Bank Term Loan") * -1;
  const unsecuredLoan = getTrialBalanceValue(state, "Director's Unsecured Loan") * -1;
  const sundryCreditors = getTrialBalanceValue(state, "Sundry Creditors (Payables)") * -1;
  const totalCurrentLiabilities =
    sundryCreditors +
    getTrialBalanceValue(state, "GST Output CGST Payable") * -1 +
    getTrialBalanceValue(state, "GST Output SGST Payable") * -1 +
    getTrialBalanceValue(state, "GST Output IGST Payable") * -1 +
    getTrialBalanceValue(state, "TDS Payable (Contractors/Rent)") * -1 +
    getTrialBalanceValue(state, "Salary Payable") * -1;

  const fixedAssetsNet =
    getTrialBalanceValue(state, "Office Premises (Owned)") +
    getTrialBalanceValue(state, "Computers & IT Equipment") +
    getTrialBalanceValue(state, "Office Furniture") +
    getTrialBalanceValue(state, "Accumulated Depreciation");

  const closingStock = getTrialBalanceValue(state, "Inventory (Finished Goods)");
  const sundryDebtors = getTrialBalanceValue(state, "Sundry Debtors (Receivables)");
  const cashBank =
    getTrialBalanceValue(state, "Cash in Hand") +
    getTrialBalanceValue(state, "HDFC Bank Current A/c") +
    getTrialBalanceValue(state, "ICICI Corporate A/c");
  const gstITC = getTrialBalanceValue(state, "GST Input Tax Credit (ITC)");
  const totalCurrentAssets = closingStock + sundryDebtors + cashBank + gstITC;
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
  const gstCollected = sumColumn(state.rawSales, 7);
  const gstClaimed = sumColumn(state.rawPurchases, 5);
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
