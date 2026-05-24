export type Role = "admin" | "finance_manager" | "viewer";

export type SheetKey =
  | "rawTrialBalance"
  | "rawSales"
  | "rawPurchases"
  | "rawReceivables"
  | "rawPayables"
  | "rawStockSummary"
  | "monthlyTrends";

export type RawRow = Array<string | number | boolean | null>;

export type RawSheet = RawRow[];

export type AppState = {
  companyName: string;
  financialYear: string;
  reportingPeriod: string;
  currency: "INR";
  rawTrialBalance: RawSheet;
  rawSales: RawSheet;
  rawPurchases: RawSheet;
  rawReceivables: RawSheet;
  rawPayables: RawSheet;
  rawStockSummary: RawSheet;
  monthlyTrends: RawSheet;
};

export type Metrics = {
  totalRevenue: number;
  productRevenue: number;
  consultingRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  totalOperatingExpenses: number;
  ebitda: number;
  ebitdaMargin: number;
  financeInterest: number;
  depreciation: number;
  pbt: number;
  taxProvision: number;
  pat: number;
  netMargin: number;
  shareCapital: number;
  retainedEarnings: number;
  termLoan: number;
  unsecuredLoan: number;
  sundryCreditors: number;
  totalCurrentLiabilities: number;
  fixedAssetsNet: number;
  closingStock: number;
  sundryDebtors: number;
  cashBank: number;
  gstITC: number;
  totalCurrentAssets: number;
  totalAssets: number;
  workingCapital: number;
  debtorDays: number;
  creditorDays: number;
  inventoryDays: number;
  cashConversionCycle: number;
  currentRatio: number;
  quickRatio: number;
  debtEquity: number;
  roce: number;
  roe: number;
  gstCollected: number;
  gstClaimed: number;
  gstNetPayable: number;
};

export type ImportResult = {
  accepted: boolean;
  mappedSheets: SheetKey[];
  errors: string[];
  nextState: AppState;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AuditEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
};
