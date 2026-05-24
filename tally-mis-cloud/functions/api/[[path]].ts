import { calculateMetrics } from "../../src/lib/calculations";
import { sampleState } from "../../src/lib/sampleData";
import type { AppState, User } from "../../src/lib/types";

type Env = {
  MIS_DB: D1Database;
  BOOTSTRAP_KEY?: string;
};

type RequestBody = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function readBody(request: Request): Promise<RequestBody> {
  return request.json().catch(() => ({})) as Promise<RequestBody>;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireUser(env: Env, request: Request): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const row = await env.MIS_DB.prepare(
    `SELECT u.id, u.email, u.name, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  )
    .bind(token)
    .first<User>();

  return row ?? null;
}

async function audit(env: Env, user: User | null, eventType: string, entityType: string, detail: unknown, entityId = "") {
  await env.MIS_DB.prepare(
    `INSERT INTO audit_events (id, actor_user_id, event_type, entity_type, entity_id, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), user?.id ?? null, eventType, entityType, entityId, JSON.stringify(detail ?? {}))
    .run();
}

async function handleLogin(env: Env, request: Request): Promise<Response> {
  const body = await readBody(request);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return json({ error: "Email and password are required." }, 400);
  }

  const user = await env.MIS_DB.prepare("SELECT id, email, name, role, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<User & { password_hash: string }>();

  if (!user || user.password_hash !== (await sha256(password))) {
    return json({ error: "Invalid email or password." }, 401);
  }

  const token = crypto.randomUUID();
  await env.MIS_DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))"
  )
    .bind(token, user.id)
    .run();

  await audit(env, user, "auth.login", "user", { email });

  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
}

async function handleBootstrap(env: Env, request: Request): Promise<Response> {
  const body = await readBody(request);
  const bootstrapKey = request.headers.get("x-bootstrap-key");
  const expectedKey = env.BOOTSTRAP_KEY;

  if (!bootstrapKey || !expectedKey || bootstrapKey !== expectedKey) {
    return json({ error: "Bootstrap key mismatch." }, 403);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "Finance Admin").trim();

  if (!email || password.length < 10) {
    return json({ error: "Provide email and a password of at least 10 characters." }, 400);
  }

  await env.MIS_DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, 'admin', ?)"
  )
    .bind(crypto.randomUUID(), email, name, await sha256(password))
    .run();

  return json({ ok: true });
}

async function handleGetState(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  if (!user) return json({ error: "Unauthorized." }, 401);

  const company = await env.MIS_DB.prepare("SELECT company_name, financial_year, reporting_period, currency FROM company_settings WHERE id = 1").first<{
    company_name: string;
    financial_year: string;
    reporting_period: string;
    currency: "INR";
  }>();

  const period = await env.MIS_DB.prepare("SELECT id FROM reporting_periods ORDER BY created_at DESC LIMIT 1").first<{ id: string }>();
  const state: AppState = {
    ...sampleState,
    companyName: company?.company_name ?? sampleState.companyName,
    financialYear: company?.financial_year ?? sampleState.financialYear,
    reportingPeriod: company?.reporting_period ?? sampleState.reportingPeriod,
    currency: company?.currency ?? "INR"
  };

  if (period) {
    const sheets = await env.MIS_DB.prepare("SELECT sheet_key, rows_json FROM raw_sheets WHERE period_id = ?")
      .bind(period.id)
      .all<{ sheet_key: keyof AppState; rows_json: string }>();

    for (const row of sheets.results ?? []) {
      if (row.sheet_key in state) {
        (state[row.sheet_key] as unknown) = JSON.parse(row.rows_json);
      }
    }
  }

  return json(state);
}

async function handlePutState(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  if (!user) return json({ error: "Unauthorized." }, 401);
  if (user.role === "viewer") return json({ error: "Viewer role cannot edit data." }, 403);

  const state = (await readBody(request)) as AppState;
  if (!state.companyName || !state.reportingPeriod || !Array.isArray(state.rawTrialBalance)) {
    return json({ error: "Invalid MIS state payload." }, 400);
  }

  const periodId = `${state.financialYear}:${state.reportingPeriod}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  await env.MIS_DB.batch([
    env.MIS_DB.prepare(
      "UPDATE company_settings SET company_name = ?, financial_year = ?, reporting_period = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
    ).bind(state.companyName, state.financialYear, state.reportingPeriod, state.currency),
    env.MIS_DB.prepare("INSERT OR IGNORE INTO reporting_periods (id, label, created_by) VALUES (?, ?, ?)").bind(
      periodId,
      state.reportingPeriod,
      user.id
    )
  ]);

  const sheetEntries: Array<[string, unknown]> = [
    ["rawTrialBalance", state.rawTrialBalance],
    ["rawSales", state.rawSales],
    ["rawPurchases", state.rawPurchases],
    ["rawReceivables", state.rawReceivables],
    ["rawPayables", state.rawPayables],
    ["rawStockSummary", state.rawStockSummary],
    ["monthlyTrends", state.monthlyTrends]
  ];

  await env.MIS_DB.batch(
    sheetEntries.map(([key, rows]) =>
      env.MIS_DB.prepare(
        `INSERT INTO raw_sheets (id, period_id, sheet_key, rows_json, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(period_id, sheet_key)
         DO UPDATE SET rows_json = excluded.rows_json, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`
      ).bind(`${periodId}:${key}`, periodId, key, JSON.stringify(rows), user.id)
    )
  );

  await env.MIS_DB.prepare(
    `INSERT INTO calculated_metrics (period_id, metrics_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(period_id)
     DO UPDATE SET metrics_json = excluded.metrics_json, updated_at = CURRENT_TIMESTAMP`
  )
    .bind(periodId, JSON.stringify(calculateMetrics(state)))
    .run();

  await audit(env, user, "state.saved", "reporting_period", { reportingPeriod: state.reportingPeriod }, periodId);
  return json(state);
}

async function handleAudit(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  if (!user) return json({ error: "Unauthorized." }, 401);

  const rows = await env.MIS_DB.prepare(
    `SELECT id, event_type AS eventType, entity_type AS entityType, entity_id AS entityId, detail_json, created_at AS createdAt
     FROM audit_events
     ORDER BY created_at DESC
     LIMIT 100`
  ).all<{ id: string; eventType: string; entityType: string; entityId: string; detail_json: string; createdAt: string }>();

  return json(
    (rows.results ?? []).map((row) => ({
      id: row.id,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      detail: JSON.parse(row.detail_json),
      createdAt: row.createdAt
    }))
  );
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path ?? "");
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "auth/login" && method === "POST") return handleLogin(env, request);
  if (path === "auth/bootstrap" && method === "POST") return handleBootstrap(env, request);
  if (path === "state" && method === "GET") return handleGetState(env, request);
  if (path === "state" && method === "PUT") return handlePutState(env, request);
  if (path === "audit" && method === "GET") return handleAudit(env, request);

  return json({ error: "Not found." }, 404);
};
