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

  async function handleUpload(file: File) {
    const { parseTallyWorkbook } = await import("./lib/uploadParser");
    const result = await parseTallyWorkbook(file, state);
    setState(result.nextState);
    setNotice(
      result.accepted
        ? `Accepted ${file.name}. Mapped: ${result.mappedSheets.map((sheet) => sheetLabels[sheet]).join(", ")}.`
        : result.errors.join(" ")
    );
    if (result.accepted && token !== "demo-token") {
      await saveState(token, result.nextState);
    }
  }

  function updateCompany(field: keyof AppState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  const trendRows = state.monthlyTrends.slice(1);
  const months = trendRows.map((row) => String(row[0]));
  const revenue = trendRows.map((row) => Number(row[1]) || 0);
  const ebitda = trendRows.map((row) => Number(row[5]) || 0);
  const loadedSheets = Object.values(sheetLabels).length;
  const totalLoadedRows = (Object.keys(sheetLabels) as SheetKey[]).reduce((sum, key) => sum + Math.max(0, state[key].length - 1), 0);

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
              <KpiCard label="Revenue" value={formatCurrency(metrics.totalRevenue)} detail="Trial Balance sales ledgers" tone="good" icon={TrendingUp} />
              <KpiCard label="EBITDA" value={formatCurrency(metrics.ebitda)} detail={formatPercent(metrics.ebitdaMargin)} tone="good" icon={BarChart3} />
              <KpiCard label="PAT" value={formatCurrency(metrics.pat)} detail={formatPercent(metrics.netMargin)} tone="good" icon={Activity} />
              <KpiCard label="DSO" value={`${metrics.debtorDays} days`} detail="Receivables / revenue" tone={metrics.debtorDays <= 60 ? "good" : "warn"} icon={Database} />
              <KpiCard label="Current Ratio" value={formatNumber(metrics.currentRatio, 2)} detail="Target > 1.33" tone={metrics.currentRatio >= 1.33 ? "good" : "bad"} icon={ShieldCheck} />
              <KpiCard label="GST Payable" value={formatCurrency(metrics.gstNetPayable)} detail="Output less ITC" icon={FileSpreadsheet} />
            </section>

            <section className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Revenue and EBITDA Trend</h2>
                    <p>Based on uploaded monthly trend data or sample seed data.</p>
                  </div>
                  <span className="panel-badge">6 month view</span>
                </div>
                <Suspense fallback={<div className="chart-loading">Loading chart...</div>}>
                  <Chart
                    type="line"
                    height={320}
                    options={{
                      chart: { toolbar: { show: false }, foreColor: "#526070" },
                      stroke: { width: [0, 3], curve: "smooth" },
                      xaxis: { categories: months },
                      yaxis: { labels: { formatter: (value: number) => formatNumber(value) } },
                      colors: ["#0f766e", "#2563eb"],
                      dataLabels: { enabled: false }
                    }}
                    series={[
                      { name: "Revenue", type: "column", data: revenue },
                      { name: "EBITDA", type: "line", data: ebitda }
                    ]}
                  />
                </Suspense>
              </section>

              <section className="panel workflow-panel">
                <div>
                  <span className="eyebrow">Cloud workflow</span>
                  <h2>Manual upload pipeline</h2>
                  <p>No local Tally connection is required for the hosted version.</p>
                </div>
                <div className="workflow-list">
                  {workflowSteps.map((step, index) => (
                    <div key={step}>
                      <span>{index + 1}</span>
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
                <button className="primary-btn" onClick={() => setView("upload")}>
                  <Upload size={16} />
                  Start upload
                </button>
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
              <strong>Select Tally export workbook</strong>
              <span>.xlsx or .csv up to 8 MB</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
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
            <button className="primary-btn" onClick={() => setState(cloneState(sampleState))}>Reset sample data</button>
          </section>
        )}
      </main>
    </div>
  );
}
