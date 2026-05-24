import ExcelJS from "exceljs";
import { calculateMetrics } from "./calculations";
import type { AppState, Metrics, RawSheet } from "./types";

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: RawSheet): void {
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRows(rows);
  worksheet.columns = (rows[0] ?? []).map((_, columnIndex) => {
    const width = Math.max(
      12,
      ...rows.map((row) => String(row[columnIndex] ?? "").length).slice(0, 200)
    );
    return { width: Math.min(width + 2, 48) };
  });
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function dashboardRows(state: AppState, metrics: Metrics): RawSheet {
  return [
    [`${state.companyName} - MIS Executive Dashboard`, ""],
    ["Reporting Period", state.reportingPeriod],
    ["Financial Year", state.financialYear],
    ["Currency", state.currency],
    [],
    ["Metric", "Value"],
    ["Total Revenue", metrics.totalRevenue],
    ["Gross Profit", metrics.grossProfit],
    ["Gross Margin %", metrics.grossMargin],
    ["EBITDA", metrics.ebitda],
    ["EBITDA Margin %", metrics.ebitdaMargin],
    ["Net Profit (PAT)", metrics.pat],
    ["Current Ratio", metrics.currentRatio],
    ["Quick Ratio", metrics.quickRatio],
    ["Working Capital", metrics.workingCapital],
    ["Cash Conversion Cycle", metrics.cashConversionCycle],
    ["GST Net Payable", metrics.gstNetPayable]
  ];
}

function summaryRows(metrics: Metrics): RawSheet {
  return [
    ["Area", "Observation", "Recommendation"],
    [
      "Revenue",
      `Revenue is ${metrics.totalRevenue.toLocaleString("en-IN")} with gross margin at ${(metrics.grossMargin * 100).toFixed(1)}%.`,
      "Track product and consulting margin separately before approving discounts."
    ],
    [
      "Working Capital",
      `DSO is ${metrics.debtorDays} days and CCC is ${metrics.cashConversionCycle} days.`,
      "Prioritize collections for invoices beyond 60 days and review credit terms."
    ],
    [
      "Liquidity",
      `Current ratio is ${metrics.currentRatio.toFixed(2)} and quick ratio is ${metrics.quickRatio.toFixed(2)}.`,
      "Maintain short-term cash buffers before committing surplus funds."
    ],
    [
      "Tax",
      `Net GST payable is ${metrics.gstNetPayable.toLocaleString("en-IN")}.`,
      "Reconcile ITC claims against purchase register before filing."
    ]
  ];
}

export async function exportMisWorkbook(state: AppState): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TallyMIS Cloud";
  workbook.created = new Date();
  const metrics = calculateMetrics(state);

  addSheet(workbook, "Dashboard", dashboardRows(state, metrics));
  addSheet(workbook, "Executive_Summary", summaryRows(metrics));
  addSheet(workbook, "Raw_Trial_Balance", state.rawTrialBalance);
  addSheet(workbook, "Raw_Sales", state.rawSales);
  addSheet(workbook, "Raw_Purchases", state.rawPurchases);
  addSheet(workbook, "Raw_Receivables", state.rawReceivables);
  addSheet(workbook, "Raw_Payables", state.rawPayables);
  addSheet(workbook, "Raw_Stock_Summary", state.rawStockSummary);
  addSheet(workbook, "Monthly_Trends", state.monthlyTrends);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `TallyMIS_${state.reportingPeriod.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportBackupJson(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `TallyMIS_Backup_${state.reportingPeriod.replace(/\s+/g, "_")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
