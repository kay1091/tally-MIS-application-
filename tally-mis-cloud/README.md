# TallyMIS Cloud

Cloud-hosted, low-cost MIS dashboard for businesses using TallyPrime. V1 uses manual TallyPrime Excel/CSV exports instead of live Tally sync, so the app can run on Cloudflare Pages, Workers, and D1 at minimal cost.

## What Is Included

- Vite + React + TypeScript frontend.
- Cloudflare Pages Functions API.
- Cloudflare D1 schema for users, sessions, company settings, reporting periods, raw sheets, calculated metrics, and audit events.
- Browser-side Tally export parsing for `.xlsx` and `.csv`.
- Typed MIS calculation engine.
- Dashboard, upload center, raw data review, reports, audit view, settings, JSON backup, and Excel MIS export.
- No runtime CDN scripts.

## Local Development

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. If the Cloudflare API is not running, the app falls back to demo mode and sample data.

To test Cloudflare Functions locally after building:

```bash
npm run build
npm run db:migrate:local
npm run cf:dev
```

## Cloudflare Setup

The repository has a root-level `wrangler.toml` so Cloudflare can run `npx wrangler deploy` from the repository root. That command builds `tally-mis-cloud` and deploys only the compiled `tally-mis-cloud/dist` assets.

For Cloudflare Workers static deploy:

```bash
npm run build
npx wrangler deploy
```

For Cloudflare Pages instead, set:

- Root directory: `tally-mis-cloud`
- Build command: `npm ci && npm run build`
- Output directory: `dist`

1. Create a D1 database:

```bash
npx wrangler d1 create tally_mis_cloud
```

2. Replace `database_id` in `wrangler.toml`.

3. Apply migrations:

```bash
npm run db:migrate:remote
```

4. Add a Pages secret named `BOOTSTRAP_KEY`.

5. Seed the first admin through the bootstrap endpoint once:

```bash
curl -X POST "https://YOUR_DOMAIN/api/auth/bootstrap" \
  -H "content-type: application/json" \
  -H "x-bootstrap-key: YOUR_BOOTSTRAP_KEY" \
  -d '{"email":"admin@example.com","name":"Finance Admin","password":"replace-with-long-password"}'
```

6. Deploy:

```bash
npm run cf:deploy
```

## Upload Rules

- Supported files: `.xlsx`, `.csv`.
- Maximum size: 8 MB.
- Sheet names should contain one of:
  - `Trial` or `Balance`
  - `Sales` or `Register`
  - `Purchase` or `Expense`
  - `Receivable` or `Debtor`
  - `Payable` or `Creditor`
  - `Stock` or `Inventory`
  - `Monthly` or `Trend`

## Security Notes

- Uploaded spreadsheet cells are rendered as text by React, not injected as HTML.
- No financial data is sent to third-party APIs.
- Runtime JavaScript dependencies are bundled through `package.json`.
- Viewer users cannot save data through the API.
- Audit events are stored for login and state-save events.

## Deferred Work

Live Tally sync remains deferred until the TallyPrime machine/server location is known. The recommended later path is a small office-PC connector that pushes exports securely to this cloud app.
