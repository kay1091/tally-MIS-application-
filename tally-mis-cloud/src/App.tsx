import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Gauge,
  Layers3,
  Lock,
  LogOut,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { login, saveState } from "./lib/api";
import { calculateMetrics } from "./lib/calculations";
import { formatCurrency, formatNumber, formatPercent } from "./lib/format";
import { sampleState } from "./lib/sampleData";
import { replaceGeneratedTrendRow } from "./lib/trends";
import type { AppState, RawSheet, SheetKey, User } from "./lib/types";

const Chart = lazy(() => import("react-apexcharts"));

type View = "dashboard" | "upload" | "raw" | "reports" | "audit" | "settings";

const sheetLabels: Record<SheetKey, string> = {
  rawTrialBalance: "Trial Balance",
  rawSales: "Sales Register",
  rawPurchases: "Purchase Register",
  rawReceivables: "Receivables Aging",
  rawPayables: "Payables Aging",
  rawStockSummary: "Stock Summary",
  monthlyTrends: "Monthly Trends"
};

const navItems: Array<{ id: View; label: string; icon: typeof BarChart3 }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "upload", label: "Upload Center", icon: Upload },
  { id: "raw", label: "Raw Data", icon: Database },
  { id: "reports", label: "Reports", icon: FileSpreadsheet },
  { id: "audit", label: "Audit Log", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Users }
];

const defaultUser: User = {
  id: "demo-admin",
  email: "admin@company.local",
  name: "Finance Admin",
  role: "admin"
};

const workflowSteps = [
  "Export TallyPrime reports",
  "Upload workbook or CSV",
  "Review mapped sheets",
  "Export MIS pack"
];

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function clearSampleFallbackSheets(state: AppState, mappedSheets: Set<SheetKey>): AppState {
  const nextState = cloneState(state);
  (Object.keys(sheetLabels) as SheetKey[]).forEach((key) => {
    if (key === "monthlyTrends" || mappedSheets.has(key)) return;
    if (JSON.stringify(nextState[key]) === JSON.stringify(sampleState[key])) {
      nextState[key] = [sampleState[key][0]];
    }
  });
  return nextState;
}

function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon = Activity
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  icon?: typeof Activity;
}) {
  return (
    <section className={`kpi-card ${tone}`}>
      <div className="kpi-topline">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function DataTable({ rows, maxRows = 12 }: { rows: RawSheet; maxRows?: number }) {
  const header = rows[0] ?? [];
  const body = rows.slice(1, maxRows + 1);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={`${String(cell)}-${index}`}>{String(cell ?? "")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_, cellIndex) => (
                <td key={cellIndex}>{String(row[cellIndex] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  return header.findIndex((cell) => String(cell ?? "").toLowerCase().includes(needle.toLowerCase()));
}

function sumColumn(rows: RawSheet, needle: string): number {
  const index = columnIndex(rows, needle);
  if (index < 0) return 0;
  return rows.slice(1).reduce((sum, row) => sum + numeric(row[index]), 0);
}

function ageingBuckets(rows: RawSheet): number[] {
  const buckets = ["0-30", "31-60", "61-90", "above"];
  return buckets.map((bucket) => sumColumn(rows, bucket));
}

function stockMovement(rows: RawSheet) {
  return {
    categories: rows.slice(1).map((row) => String(row[0] ?? "Item")).slice(0, 8),
    opening: rows.slice(1).map((row) => numeric(row[columnIndex(rows, "opening")])).slice(0, 8),
    purchases: rows.slice(1).map((row) => numeric(row[columnIndex(rows, "purchase")])).slice(0, 8),
    sales: rows.slice(1).map((row) => numeric(row[columnIndex(rows, "sales")])).slice(0, 8),
    closing: rows.slice(1).map((row) => numeric(row[columnIndex(rows, "closing")])).slice(0, 8)
  };
}

function LoginPanel({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [email, setEmail] = useState(defaultUser.email);
  const [password, setPassword] = useState("change-me");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await login(email, password);
      onLogin(result.user, result.token);
    } catch {
      onLogin(defaultUser, "demo-token");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-visual" aria-hidden="true">
        <div className="login-stat">
          <span>Monthly MIS</span>
          <strong>Cloud ready</strong>
        </div>
        <div className="login-chart-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">
          <Lock size={20} />
        </div>
        <h1>TallyMIS Cloud</h1>
        <p>Secure MIS reporting for uploaded TallyPrime exports.</p>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <div className="error-text">{error}</div>}
        <button type="submit" className="primary-btn">
          Sign in
        </button>
        <small>Demo mode is enabled until Cloudflare D1 users are seeded.</small>
      </form>
    </main>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [activeSheet, setActiveSheet] = useState<SheetKey>("rawTrialBalance");
  const [state, setState] = useState<AppState>(sampleState);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [notice, setNotice] = useState("Sample data loaded. Upload Tally exports to replace it.");
  const metrics = useMemo(() => calculateMetrics(state), [state]);

  if (!user) {
    return (
      <LoginPanel
        onLogin={(nextUser, nextToken) => {
          setUser(nextUser);
          setToken(nextToken);
        }}
      />
    );
  }

  async function handleUploadFiles(files: FileList) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    let nextState = state;
    const acceptedFiles: string[] = [];
    const mappedSheets = new Set<SheetKey>();
    const errors: string[] = [];

    for (const file of selectedFiles) {
      const result = await parseUpload(file, nextState);
      nextState = result.nextState;
      if (result.accepted) {
        acceptedFiles.push(file.name);
        result.mappedSheets.forEach((sheet) => mappedSheets.add(sheet));
      }
      errors.push(...result.errors);
    }

    if (acceptedFiles.length > 0) {
      nextState = clearSampleFallbackSheets(nextState, mappedSheets);
    }

    if (acceptedFiles.length > 0 && !mappedSheets.has("monthlyTrends")) {
      nextState = replaceGeneratedTrendRow(nextState);
      setSelectedPeriod(String(nextState.monthlyTrends[1]?.[0] ?? "all"));
    }

    setState(nextState);
    setNotice(
      acceptedFiles.length > 0
        ? `Accepted ${acceptedFiles.length} file${acceptedFiles.length === 1 ? "" : "s"}. Mapped: ${Array.from(mappedSheets)
            .map((sheet) => sheetLabels[sheet])
            .join(", ")}.`
        : errors.join(" ")
    );
    if (acceptedFiles.length > 0 && token !== "demo-token") {
      await saveState(token, nextState);
    }
  }

  async function parseUpload(file: File, currentState: AppState) {
    const { parseTallyWorkbook } = await import("./lib/uploadParser");
    return parseTallyWorkbook(file, currentState);
  }

  function updateCompany(field: keyof AppState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  async function resetSampleData() {
    const nextState = cloneState(sampleState);
    setState(nextState);
    setActiveSheet("rawTrialBalance");
    setSelectedPeriod("all");
    setNotice("Sample data restored. Upload Tally exports to replace it.");
    if (token !== "demo-token") {
      await saveState(token, nextState);
    }
  }

  const allTrendRows = state.monthlyTrends.slice(1);
  const periodOptions = allTrendRows.map((row) => String(row[0] ?? "")).filter(Boolean);
  const trendRows = selectedPeriod === "all" ? allTrendRows : allTrendRows.filter((row) => String(row[0]) === selectedPeriod);
  const months = trendRows.map((row) => String(row[0]));
  const chartNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const chartValue = (row: RawSheet[number], index: number): number | null => chartNumber(row[index]);
  const revenue = trendRows.map((row) => chartValue(row, 1));
  const cogs = trendRows.map((row) => chartValue(row, 2));
  const grossProfit = trendRows.map((row) => chartValue(row, 3));
  const operatingExpenses = trendRows.map((row) => chartValue(row, 4));
  const ebitda = trendRows.map((row) => chartValue(row, 5));
  const netProfit = trendRows.map((row) => chartValue(row, 6));
  const receivablesTrend = trendRows.map((row) => chartValue(row, 7));
  const payablesTrend = trendRows.map((row) => chartValue(row, 8));
  const stockTrend = trendRows.map((row) => chartValue(row, 9));
  const cashTrend = trendRows.map((row) => chartValue(row, 10));
  const latestRevenue = revenue.at(-1) ?? 0;
  const previousRevenue = revenue.at(-2) ?? 0;
  const monthlyGrowth = previousRevenue && latestRevenue !== null ? (latestRevenue - previousRevenue) / previousRevenue : 0;
  const marginTrend = revenue.map((value, index) => (value && grossProfit[index] !== null ? (Number(grossProfit[index]) / value) * 100 : null));
  const receivableAgeing = ageingBuckets(state.rawReceivables);
  const payableAgeing = ageingBuckets(state.rawPayables);
  const inventory = stockMovement(state.rawStockSummary);
  const loadedSheets = Object.values(sheetLabels).length;
  const totalLoadedRows = (Object.keys(sheetLabels) as SheetKey[]).reduce((sum, key) => sum + Math.max(0, state[key].length - 1), 0);
  const chartBaseOptions = {
    chart: { toolbar: { show: false }, foreColor: "#526070" },
    dataLabels: { enabled: false },
    grid: { borderColor: "#e5eaf0" },
    legend: { position: "top" as const },
    tooltip: { theme: "light" }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="product">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <div>
            <strong>TallyMIS Cloud</strong>
            <span>Cloud upload v1</span>
          </div>
        </div>
        <div className="sidebar-snapshot">
          <span>Current period</span>
          <strong>{state.reportingPeriod}</strong>
          <small>{totalLoadedRows} rows loaded</small>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="user-card">
          <strong>{user.name}</strong>
          <span>{user.role.replace("_", " ")}</span>
          <button onClick={() => setUser(null)}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Management reporting workspace</span>
            <h1>{state.companyName}</h1>
            <p>{state.financialYear} / {state.reportingPeriod}</p>
          </div>
          <div className="actions">
            <button onClick={() => setView("upload")}>
              <FileUp size={16} />
              Upload
            </button>
            <button
              onClick={async () => {
                const { exportBackupJson } = await import("./lib/excelExport");
                exportBackupJson(state);
              }}
            >
              <Archive size={16} />
              Backup JSON
            </button>
            <button
              className="primary-btn"
              onClick={async () => {
                const { exportMisWorkbook } = await import("./lib/excelExport");
                await exportMisWorkbook(state);
              }}
            >
              <Download size={16} />
              Export MIS
            </button>
          </div>
        </header>

        <section className="status-strip">
          <div className="notice">
            <CheckCircle2 size={17} />
            {notice}
          </div>
          <div className="status-chip">
            <Database size={15} />
            D1-ready schema
          </div>
          <div className="status-chip">
            <ShieldCheck size={15} />
            No third-party data APIs
          </div>
          <div className="status-chip">
            <Layers3 size={15} />
            {loadedSheets} mapped sheets
          </div>
        </section>

        {view === "dashboard" && (
          <>
            <section className="panel filter-panel">
              <div>
                <span className="eyebrow">Dashboard filters</span>
                <h2>Reporting period</h2>
              </div>
              <label>
                Period
                <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
                  <option value="all">All loaded periods</option>
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </label>
            </section>
            <section className="hero-panel">
              <div>
                <span className="eyebrow">Executive snapshot</span>
                <h2>{formatCurrency(metrics.totalRevenue)} revenue with {formatPercent(metrics.ebitdaMargin)} EBITDA margin</h2>
                <p>Upload Tally exports, review validated sheets, and export a board-ready MIS workbook from the same cloud workflow.</p>
                <div className="hero-actions">
                  <button className="primary-btn" onClick={() => setView("upload")}>
                    <Upload size={16} />
                    Upload exports
                  </button>
                  <button onClick={() => setView("reports")}>
                    <FileSpreadsheet size={16} />
                    View reports
                  </button>
                </div>
              </div>
              <div className="hero-metrics">
                <div>
                  <span>Working capital</span>
                  <strong>{formatCurrency(metrics.workingCapital)}</strong>
                </div>
                <div>
                  <span>Cash conversion</span>
                  <strong>{metrics.cashConversionCycle} days</strong>
                </div>
              </div>
            </section>
            <section className="kpi-grid">
              <KpiCard label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} detail="Trial Balance sales ledgers" tone="good" icon={TrendingUp} />
              <KpiCard label="Gross Profit" value={formatCurrency(metrics.grossProfit)} detail="Revenue less COGS" tone={metrics.grossProfit >= 0 ? "good" : "bad"} icon={BarChart3} />
              <KpiCard label="Gross Margin %" value={formatPercent(metrics.grossMargin)} detail="Gross profit / revenue" tone={metrics.grossMargin >= 0.25 ? "good" : "warn"} icon={Gauge} />
              <KpiCard label="EBITDA" value={formatCurrency(metrics.ebitda)} detail={formatPercent(metrics.ebitdaMargin)} tone="good" icon={BarChart3} />
              <KpiCard label="Net Profit" value={formatCurrency(metrics.pat)} detail={formatPercent(metrics.netMargin)} tone={metrics.pat >= 0 ? "good" : "bad"} icon={Activity} />
              <KpiCard label="Debtor Days" value={`${metrics.debtorDays} days`} detail="Receivables / revenue" tone={metrics.debtorDays <= 60 ? "good" : "warn"} icon={Database} />
              <KpiCard label="Creditor Days" value={`${metrics.creditorDays} days`} detail="Payables / purchases" tone={metrics.creditorDays <= 75 ? "good" : "warn"} icon={Users} />
              <KpiCard label="Inventory Days" value={`${metrics.inventoryDays} days`} detail="Stock / COGS" tone={metrics.inventoryDays <= 90 ? "good" : "warn"} icon={Layers3} />
              <KpiCard label="Working Capital" value={formatCurrency(metrics.workingCapital)} detail="Current assets less liabilities" tone={metrics.workingCapital >= 0 ? "good" : "bad"} icon={Archive} />
              <KpiCard label="Current Ratio" value={formatNumber(metrics.currentRatio, 2)} detail="Target > 1.33" tone={metrics.currentRatio >= 1.33 ? "good" : "bad"} icon={ShieldCheck} />
              <KpiCard label="Quick Ratio" value={formatNumber(metrics.quickRatio, 2)} detail="Liquid assets / liabilities" tone={metrics.quickRatio >= 1 ? "good" : "warn"} icon={CheckCircle2} />
              <KpiCard label="GST Payable" value={formatCurrency(metrics.gstNetPayable)} detail="Output less ITC" icon={FileSpreadsheet} />
              <KpiCard label="Monthly Growth %" value={formatPercent(monthlyGrowth)} detail="Latest month revenue growth" tone={monthlyGrowth >= 0 ? "good" : "bad"} icon={TrendingUp} />
            </section>

            <section className="chart-grid">
              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Monthly Revenue Graph</h2>
                    <p>Revenue movement across reporting months.</p>
                  </div>
                  <span className="panel-badge">Revenue</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="bar"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      xaxis: { categories: months },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#0f766e"]
                    }}
                    series={[{ name: "Revenue", data: revenue }]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Trend Charts</h2>
                    <p>Revenue, EBITDA, net profit, and gross margin trend.</p>
                  </div>
                  <span className="panel-badge">Profitability</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="line"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      stroke: { width: [0, 3, 3, 3], curve: "smooth" },
                      xaxis: { categories: months },
                      yaxis: [{ labels: { formatter: (value: number) => formatNumber(value) } }, { opposite: true, labels: { formatter: (value: number) => `${value.toFixed(0)}%` } }],
                      colors: ["#0f766e", "#2563eb", "#7c3aed", "#b45309"]
                    }}
                    series={[
                      { name: "Revenue", type: "column", data: revenue },
                      { name: "EBITDA", type: "line", data: ebitda },
                      { name: "Net Profit", type: "line", data: netProfit },
                      { name: "Gross Margin %", type: "line", data: marginTrend }
                    ]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Expense Breakdown Chart</h2>
                    <p>COGS, operating expenses, and profit stack.</p>
                  </div>
                  <span className="panel-badge">Expenses</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="donut"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      labels: ["COGS", "Operating Expenses", "EBITDA"],
                      colors: ["#2563eb", "#b45309", "#0f766e"]
                    }}
                    series={[metrics.totalCOGS, metrics.totalOperatingExpenses, Math.max(0, metrics.ebitda)]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Receivables Ageing Chart</h2>
                    <p>Customer outstanding by ageing bucket.</p>
                  </div>
                  <span className="panel-badge">AR ageing</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="bar"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      xaxis: { categories: ["0-30", "31-60", "61-90", "90+"] },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#2563eb"]
                    }}
                    series={[{ name: "Receivables", data: receivableAgeing }]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Payables Ageing Chart</h2>
                    <p>Vendor outstanding by ageing bucket.</p>
                  </div>
                  <span className="panel-badge">AP ageing</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="bar"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      xaxis: { categories: ["0-30", "31-60", "61-90", "90+"] },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#b45309"]
                    }}
                    series={[{ name: "Payables", data: payableAgeing }]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Inventory Movement Chart</h2>
                    <p>Opening, purchases, sales, and closing quantities.</p>
                  </div>
                  <span className="panel-badge">Inventory</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="bar"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      xaxis: { categories: inventory.categories },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#94a3b8", "#2563eb", "#b45309", "#0f766e"]
                    }}
                    series={[
                      { name: "Opening", data: inventory.opening },
                      { name: "Purchases", data: inventory.purchases },
                      { name: "Sales", data: inventory.sales },
                      { name: "Closing", data: inventory.closing }
                    ]}
                  />
                </Suspense>
              </section>

              <section className="panel chart-panel chart-panel-wide">
                <div className="panel-head">
                  <div>
                    <h2>Cashflow Trend Chart</h2>
                    <p>Cash balance with receivables, payables, stock, COGS, and expenses.</p>
                  </div>
                  <span className="panel-badge">Cashflow</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="line"
                    height={320}
                    options={{
                      ...chartBaseOptions,
                      stroke: { width: 3, curve: "smooth" },
                      xaxis: { categories: months },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#0f766e", "#2563eb", "#b45309", "#64748b", "#7c3aed"]
                    }}
                    series={[
                      { name: "Cash Balance", data: cashTrend },
                      { name: "Receivables", data: receivablesTrend },
                      { name: "Payables", data: payablesTrend },
                      { name: "Closing Stock", data: stockTrend },
                      { name: "Expenses", data: operatingExpenses.map((value, index) => value === null && cogs[index] === null ? null : (value ?? 0) + (cogs[index] ?? 0)) }
                    ]}
                  />
                </Suspense>
              </section>
            </section>
          </>
        )}

        {view === "upload" && (
          <section className="panel upload-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Import workflow</span>
                <h2>Upload Center</h2>
                <p>Upload TallyPrime Excel or CSV exports. Data is parsed in the browser, validated, then saved to the cloud API when configured.</p>
              </div>
              <span className="panel-badge">8 MB limit</span>
            </div>
            <label className="drop-target">
              <Upload size={28} />
              <strong>Select Tally export workbook(s)</strong>
              <span>.xlsx or .csv up to 8 MB</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                multiple
                onChange={(event) => {
                  const files = event.target.files;
                  if (files) void handleUploadFiles(files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <div className="sheet-grid">
              {Object.entries(sheetLabels).map(([key, label]) => (
                <div key={key} className="sheet-status">
                  <CheckCircle2 size={17} />
                  <strong>{label}</strong>
                  <span>{state[key as SheetKey].length - 1} rows loaded</span>
                </div>
              ))}
            </div>
            <div className="import-note">
              <Gauge size={18} />
              <div>
                <strong>Production-safe import mode</strong>
                <span>Spreadsheet values are normalized and rendered as text; live localhost Tally sync is intentionally excluded from the cloud UI.</span>
              </div>
            </div>
          </section>
        )}

        {view === "raw" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Raw Data Review</h2>
                <p>Values are rendered as text to prevent spreadsheet content injection.</p>
              </div>
              <select value={activeSheet} onChange={(event) => setActiveSheet(event.target.value as SheetKey)}>
                {Object.entries(sheetLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <DataTable rows={state[activeSheet]} maxRows={25} />
          </section>
        )}

        {view === "reports" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Report pack</span>
                <h2>Management Reports</h2>
              </div>
              <span className="panel-badge">Export ready</span>
            </div>
            <div className="report-grid">
              <DataTable
                rows={[
                  ["Metric", "Value"],
                  ["Gross Profit", formatCurrency(metrics.grossProfit)],
                  ["Gross Margin", formatPercent(metrics.grossMargin)],
                  ["Operating Expenses", formatCurrency(metrics.totalOperatingExpenses)],
                  ["PBT", formatCurrency(metrics.pbt)],
                  ["Tax Provision", formatCurrency(metrics.taxProvision)],
                  ["Debt Equity", formatNumber(metrics.debtEquity, 2)],
                  ["ROCE", formatPercent(metrics.roce)]
                ]}
              />
              <DataTable rows={state.rawReceivables} />
            </div>
          </section>
        )}

        {view === "audit" && (
          <section className="panel">
            <h2>Audit Log</h2>
            <DataTable
              rows={[
                ["Time", "Actor", "Event", "Detail"],
                [new Date().toISOString(), user.email, "session.started", "Demo session opened"],
                [new Date().toISOString(), user.email, "state.loaded", notice]
              ]}
            />
          </section>
        )}

        {view === "settings" && (
          <section className="panel settings-grid">
            <label>
              Company name
              <input value={state.companyName} onChange={(event) => updateCompany("companyName", event.target.value)} />
            </label>
            <label>
              Financial year
              <input value={state.financialYear} onChange={(event) => updateCompany("financialYear", event.target.value)} />
            </label>
            <label>
              Reporting period
              <input value={state.reportingPeriod} onChange={(event) => updateCompany("reportingPeriod", event.target.value)} />
            </label>
            <button className="primary-btn" onClick={() => void resetSampleData()}>Reset sample data</button>
          </section>
        )}
      </main>
    </div>
  );
}
