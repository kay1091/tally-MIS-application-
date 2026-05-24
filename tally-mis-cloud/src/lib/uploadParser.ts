import ExcelJS from "exceljs";
import type { AppState, ImportResult, RawSheet, SheetKey } from "./types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const sheetMatchers: Array<[SheetKey, RegExp]> = [
  ["rawTrialBalance", /(trial|balance)/i],
  ["rawSales", /(sales|register)/i],
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
  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => row.map(normalizeCell));
}

function detectSheetKey(sheetName: string): SheetKey | null {
  const match = sheetMatchers.find(([, pattern]) => pattern.test(sheetName));
  return match?.[0] ?? null;
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
    const normalized = normalizeRows(parseCsv(await file.text()));
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
