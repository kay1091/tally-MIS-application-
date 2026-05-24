CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'finance_manager', 'viewer')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  reporting_period TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reporting_periods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved')) DEFAULT 'draft',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  file_name TEXT NOT NULL,
  sheet_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  errors_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_sheets (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  sheet_key TEXT NOT NULL,
  rows_json TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_id, sheet_key)
);

CREATE TABLE IF NOT EXISTS calculated_metrics (
  period_id TEXT PRIMARY KEY REFERENCES reporting_periods(id),
  metrics_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO company_settings (
  id,
  company_name,
  financial_year,
  reporting_period,
  currency
) VALUES (
  1,
  'Apex Technologies Pvt Ltd',
  'FY 2025-26',
  'March 2026',
  'INR'
);
