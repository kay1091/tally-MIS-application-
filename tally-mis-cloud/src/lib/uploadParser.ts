import ExcelJS from "exceljs";
import type { AppState, ImportResult, RawSheet, SheetKey } from "./types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const sheetMatchers: Array<[SheetKey, RegExp]> = [
  ["rawTrialBalance", /(trial|balance)/i],
  ["rawSales", /sales/i],
  ["rawPurchases", /(purchase|expense)/i],
  ["rawReceivables", /(receivable|debtor)/i],
  ["rawPayables", /(payable|creditor)/i],
  ["rawStockSummary", /(stock|inventory)/i],
  ["monthlyTrends", /(trend|monthly)/i]
];

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value).trim();
  if (text === "") return null;
  const cleaned = text.replace(/[₹,\s]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return text.slice(0, 500);
}

function normalizeRows(rows: unknown[][]): RawSheet {
  const compactRows = rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => row.map(normalizeCell));

  return trimTallyReportPreamble(compactRows);
}

function detectSheetKey(sheetName: string): SheetKey | null {
  const match = sheetMatchers.find(([, pattern]) => pattern.test(sheetName));
  return match?.[0] ?? null;
}

function applyTallyMetadata(state: AppState, rows: unknown[][]): void {
  const textRows = rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean))
    .filter((row) => row.length > 0);
  const title = textRows[0]?.[0];
  const yearMatch = title?.match(/FY\s*(\d{4})[-\s]*(\d{2,4})/i);

  if (title) {
    const companyName = title.replace(/FY\s*\d{4}[-\s]*\d{2,4}/i, "").trim();
    if (companyName.length > 2) state.companyName = companyName;
  }

  if (yearMatch) {
    const endYear = yearMatch[2].slice(-2);
    state.financialYear = `FY ${yearMatch[1]}-${endYear}`;
  }

  const period = textRows.flat().find((cell) => /\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+to\s+\d{1,2}-[A-Za-z]{3}-\d{2,4}/.test(cell));
  if (period) state.reportingPeriod = period;
}

function trimTallyReportPreamble(rows: RawSheet): RawSheet {
  const headerIndex = rows.findIndex((row, rowIndex) => {
    const cells = row.map((cell) => String(cell ?? "").trim().toLowerCase());
    const joined = cells.join(" ");
    const hasDate = cells.includes("date");
    const hasLedgerName = joined.includes("ledger name");
    const hasParticulars = cells.includes("particulars");
    const hasVoucher = joined.includes("voucher");
    const hasBalance = joined.includes("balance");
    const hasNearbyBalance = rows
      .slice(rowIndex + 1, rowIndex + 3)
      .some((candidate) => candidate.join(" ").toLowerCase().includes("balance"));
    const hasValue = cells.includes("value") || joined.includes("gross total");

    return hasLedgerName || (hasParticulars && (hasBalance || hasNearbyBalance)) || (hasDate && hasVoucher && hasValue);
  });

  if (headerIndex < 0) return rows;

  const header = rows[headerIndex];
  const next = rows[headerIndex + 1];

  const third = rows[headerIndex + 2];
  const nextText = next?.join(" ").toLowerCase() ?? "";
  const thirdText = third?.join(" ").toLowerCase() ?? "";
  const isTrialBalanceHeader =
    Boolean(next && third) &&
    header.some((cell) => String(cell ?? "").trim().toLowerCase() === "particulars") &&
    (nextText.includes("opening") || nextText.includes("closing") || nextText.includes("transactions")) &&
    thirdText.includes("balance");

  if (isTrialBalanceHeader) {
    const mergedHeader = header.map((cell, index) => {
      const primary = String(cell ?? "").trim();
      const secondary = String(next[index] ?? "").trim();
      const tertiary = String(third?.[index] ?? "").trim();
      if (primary.toLowerCase() === "particulars") return "Particulars";
      return [secondary, tertiary].filter(Boolean).join(" ").trim() || primary;
    });
    return [mergedHeader, ...rows.slice(headerIndex + 3)];
  }

  return rows.slice(headerIndex);
}

export async function parseTallyWorkbook(file: File, currentState: AppState): Promise<ImportResult> {
  const errors: string[] = [];

  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    errors.push("Only .xlsx and .csv files are supported in the production parser.");
  }

  if (file.size > MAX_FILE_BYTES) {
    errors.push("File exceeds the 8 MB upload limit.");
  }

  if (errors.length > 0) {
    return { accepted: false, mappedSheets: [], errors, nextState: currentState };
  }

  const nextState = cloneState(currentState);
  const mappedSheets: SheetKey[] = [];

  if (/\.csv$/i.test(file.name)) {
    const key = detectSheetKey(file.name) ?? "rawTrialBalance";
    const rows = parseCsv(await file.text());
    applyTallyMetadata(nextState, rows);
    const normalized = normalizeRows(rows);
    if (normalized.length >= 2) {
      nextState[key] = normalized;
      mappedSheets.push(key);
    } else {
      errors.push("CSV file did not contain usable rows.");
    }
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    workbook.worksheets.forEach((worksheet) => {
      const key = detectSheetKey(worksheet.name);
      if (!key) return;

      const rows: unknown[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        rows.push(Array.isArray(row.values) ? row.values.slice(1) : []);
      });

      applyTallyMetadata(nextState, rows);
      const normalized = normalizeRows(rows);
      if (normalized.length < 2) {
        errors.push(`${worksheet.name} was detected but did not contain usable rows.`);
        return;
      }
      nextState[key] = normalized;
      mappedSheets.push(key);
    });
  }

  if (mappedSheets.length === 0) {
    errors.push("No supported Tally sheets were detected. Use sheet names containing Trial, Sales, Purchase, Receivable, Payable, Stock, or Monthly.");
  }

  return {
    accepted: mappedSheets.length > 0,
    mappedSheets,
    errors,
    nextState
  };
}

function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
