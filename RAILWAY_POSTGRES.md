# Worklio: PostgreSQL deployment on Railway

This edition keeps all application records in PostgreSQL when DATABASE_URL is set: accounts, password hashes, sessions, login limits, organizations, company settings/logos, customers, quotes, jobs, invoice snapshots, invoice numbering, and payment status. The existing payment ledger is derived from quote statuses such as Paid; it is not a payment processor or a new banking transaction ledger.

Workspace documents remain JSON serialized into a PostgreSQL TEXT column. This preserves the complete existing format and API without a risky rewrite of business records. Conditional version updates still reject stale saves. Related writes run in database transactions on the same checked-out connection. Responses are sent only after commit. PostgreSQL write transactions use a shared advisory lock so concurrent app instances cannot partially create organizations or disable the last administrator. This conservative first implementation serializes writes across organizations; profile and narrow locking before targeting high write throughput.

## Fresh Railway deployment

1. Put the CONTENTS of `worklio-local` at the root of your GitHub repository. Do not commit `.env`, `data`, dependencies, or test files containing real data.
2. Create a Railway project. Add a PostgreSQL database service named `Postgres`. Keep its persistent volume attached.
3. Add your repository as an application service. Railway uses the included Dockerfile and railway.json.
4. Generate an application domain under Settings → Networking. Keep the database private.
5. Set these variables on the APPLICATION service:

| Variable | Value |
| --- | --- |
| DATABASE_URL | `${{Postgres.DATABASE_URL}}` (use your actual database service name) |
| SETUP_TOKEN | Your own random secret of at least 32 characters |
| NODE_ENV | `production` (also supplied by Dockerfile) |
| HOST | `0.0.0.0` (also supplied by Dockerfile) |
| APP_ORIGIN | Optional for Railway's generated domain; for a custom domain use the exact HTTPS origin |
| PG_POOL_MAX | Optional; defaults to `10` per application instance |

Generate a setup secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it private. The hosted application does not print this secret in logs. Use it once on the administrator setup screen; remove SETUP_TOKEN after the first account is created.

6. Confirm deployment settings (also defined in railway.json):
   - Pre-deploy: `npm run db:migrate`
   - Start: `npm start`
   - Health check: `/health`
7. Deploy, open the generated HTTPS URL, complete administrator setup, then create the first organization and its administrator.
8. Enable database volume backups in the Postgres service's Backups tab. Add an independent backup/export strategy and test a restore.
9. Create a customer/quote/invoice, mark an eligible quote Paid, redeploy only the application, and confirm the data remains.

The application container does not need a `/data` volume in PostgreSQL mode. In this codebase logos are stored within workspace data, imported spreadsheets are parsed without permanent server files, and exports are generated on demand. If future features add file uploads, those files will require separate durable storage.

DATABASE_URL is mandatory when NODE_ENV=production or RAILWAY_ENVIRONMENT_ID is present. An absent or invalid URL causes startup to fail rather than silently creating a temporary SQLite database. A database outage also fails startup/readiness; no local fallback is used. `/health` checks actual database connectivity.

## Upgrade an existing SQLite deployment without losing data

Do not simply set DATABASE_URL and assume SQLite data transfers automatically.

1. Arrange a maintenance window and stop writes to the old application. Keep the old image/code, database, and volume for rollback.
2. Back up `obra.sqlite`. Stop the old app before a plain file copy so all WAL data is checkpointed, or use a proper SQLite backup. Do not copy only the main database file from a live WAL database and discard its WAL file.
3. Create a NEW, EMPTY PostgreSQL service. Do not allow users to initialize accounts in this target before import.
4. Install this package locally with Node 24 and run `npm ci`.
5. To migrate from your computer, temporarily enable the database's TCP proxy/public connection and use its PUBLIC connection URL. Private `.railway.internal` URLs work only inside Railway. Remove public exposure when done if it is no longer needed.
6. Create a private `.env.migration` file containing only `DATABASE_URL=<target PostgreSQL URL>`. It is ignored by Git and Docker. Run:

```sh
node --env-file=.env.migration scripts/migrate.mjs
node --env-file=.env.migration scripts/import-sqlite.mjs /absolute/path/to/obra.sqlite
```

Alternatively, use environment variables with `npm run db:migrate` and `npm run db:import:sqlite -- /absolute/path/to/obra.sqlite`.

7. Check the reported table counts. Import preserves IDs, password hashes, sessions, organization assignments, workspace versions, invoice history/numbering, and the complete saved workspace JSON. Older single-organization SQLite schemas are upgraded in memory during import. The source is opened read-only and is not modified by the importer.
8. Import is all-or-nothing and refuses any nonempty application table in the target. If it fails, fix the source/connection and retry against the same still-empty target. It does not merge accounts or overwrite existing customers. Repeating a completed import is rejected.
9. Deploy the new app with DATABASE_URL referencing that imported Postgres service. Generate/retain the original application domain and APP_ORIGIN. Existing passwords work; no new administrator setup is required. Sessions retain their original expiry/idle rules and cookie origin requirements.
10. Validate users, organization isolation, quotes, invoice numbering, paid statuses, and exports. Reopen access only after verification. Keep the old backup until you have tested a PostgreSQL restore.

For rollback, stop writes to the new system and restore the old code against its preserved SQLite volume. New PostgreSQL writes do not automatically appear in the old SQLite database; reconcile them before switching back.

## Later deployments

Keep the same Postgres service and reference variable. Push updated code; the migration command safely ensures the schema exists and does not reset records. Take backups before future destructive schema changes. Do not delete the Postgres service/volume to deploy application changes. Application rollback does not undo schema or data migrations.

## Local use

Node 24 is recommended. `npm ci`, `npm run build`, and `npm start` still run with the existing `data/obra.sqlite` when DATABASE_URL is unset outside production. The original local launchers continue to work. Never use multiple processes against this SQLite fallback.

For local PostgreSQL, set DATABASE_URL plus APP_ORIGIN/HOST, or copy `.env.example` to `.env`, edit it, and run `node --env-file=.env server.mjs`. `npm start` does not automatically load `.env`.

## Verification

- `npm run build`: production frontend build.
- `npm test`: original business/security/UI tests plus PostgreSQL integration tests.
- `npm run test:postgres`: isolated SQL-path test using PGlite, an embedded PostgreSQL engine, with durable on-disk storage. Covers repeatable schema setup, legacy import, import refusal, accounts, organization creation, concurrent version checks, invoices, Paid status, rollback, rate limits, and application restart/session persistence.
- Optional real network test: set TEST_DATABASE_URL to a DEDICATED EMPTY disposable PostgreSQL database, then run `npm run test:postgres`. Never use production. The test creates fixtures and leaves them in that dedicated database. This exercises node-postgres network connections rather than the embedded test pool.

The embedded test executes PostgreSQL SQL, but does not validate Railway networking, TLS, or Docker image execution. Verify those during deployment. Each app process uses up to PG_POOL_MAX connections, so account for replicas and deployment overlap when sizing the database.

## Relevant official documentation

- https://docs.railway.com/databases/postgresql
- https://docs.railway.com/volumes/backups
- https://docs.railway.com/deployments/pre-deploy-command
- https://node-postgres.com/features/transactions
