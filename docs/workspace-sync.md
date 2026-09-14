# Durable local saving and manual Mikrus sync

## Behavior

The application subscribes to committed workspace changes before React renders. It captures immutable snapshots immediately and saves them in order. **Saved locally** means the IndexedDB transaction completed; it does not mean the workspace has reached Mikrus. A failed transaction keeps the pending work in memory, prevents project replacement, and offers Retry and recovery export. Browser termination before a transaction completes cannot be guaranteed safe.

Local storage writes use per-project versions plus content comparisons inside the same transaction. Other tabs cannot overwrite a changed snapshot. Opening an unchanged copy does not advance its version. Local deletion leaves a tombstone so queued saves and published migrations cannot recreate it. An explicit recovery import or shared-project download can restore that identity.

**Save & sync** is available in plot and interior views. Enter the private connection key once per browser, then click **Sync with Mikrus** when ready. There is no polling or automatic upload. While a sync is running or awaiting conflict resolution, editing and project switching are paused. Cancel remains available during conflict review; network requests time out after 20 seconds.

Three-way merges use the last acknowledged shared workspace, stable entity references, and absence-as-deletion. Revision numbers are not conflict resolution. Conflicting fields, geometry arrays, and edit/delete changes require explicit selection. Both versions remain in recovery snapshots; **Browse recovery snapshots** exports them without changing their project identities. Keep-as-copy creates a new identity only on explicit selection.

Pending proposals and draft histories are included. Merged/resolved workspaces conservatively stale pending approvals. The API keeps immutable version history and idempotency receipts; a lost upload response can be retried using the same persisted request ID. The candidate workspace and retry identity are stored locally before transmission, then the acknowledged baseline is committed atomically.

HTTP, HTTPS and localhost have separate browser stores. On legacy HTTP, use **Export recovery copy**, open HTTPS, and **Import recovery copy**. This transfer preserves identity, proposals, drafts and known shared baseline. It excludes the private connection key. Existing divergent local data is backed up and requires confirmation before replacement. A pending upload is retried by its originating browser, not transferred to a second browser.

## Private runtime configuration

Local `.env` remains ignored. PostgreSQL uses `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE=verify-full` and, when necessary, `PGSSLROOTCERT` pointing to a provider-verified CA PEM. `HOUSE_SYNC_CONNECTION_KEY` is the local setup key to enter in browsers; only its SHA-256 `HOUSE_SYNC_KEY_HASH` goes to the API. `HOUSE_SYNC_ORIGINS` is an explicit comma-separated allowlist. Never use a `VITE_` prefix for secrets.

On Mikrus the persistent file is `/root/house-web-mcp/furnished-zielonki/deploy/mikrus/.env`, outside the release directories, mode **0600**. Explicit provisioning updates only the supported keys and preserves others, with a restricted backup. Ordinary releases reuse this file unchanged. Docker Compose injects only required settings into the API runtime; neither this file nor the plaintext browser connection key is uploaded into release images. A CA certificate, if configured, is mounted read-only separately.

Provision configuration independently from deployment:

```powershell
uv run --with paramiko --with pyyaml python scripts/deploy-mikrus.py --configure-sync
```

The supplied database currently presents a self-signed certificate not trusted by the local TLS store. Obtain a trusted CA/certificate and verify its identity through Mikrus before setting `PGSSLROOTCERT`. Do not use `rejectUnauthorized: false`, `sslmode=require`, or `NODE_TLS_REJECT_UNAUTHORIZED=0` to bypass the deployment gate. Authentication and live migrations have not been performed.

## API contract and database

- `GET /api/sync/health`: readiness only, no project data; returns 503 when the database is unavailable.
- `GET /api/sync/projects`: authenticated project summaries.
- `GET /api/sync/workspace?ref=…`: authenticated `{serverVersion, workspace}`, or 404.
- `PUT /api/sync/workspace`: authenticated `{expectedVersion, mutationId, workspace}`. Version 0 creates only if absent. Returns the committed snapshot or 409 for a conflict; reusing the same ID/request returns its original receipt even after later writes.

Bearer keys are required; cookies are not used. Requests are limited to 20 MiB, schemas and geometry are checked before SQL, and database errors return content-free messages. `house_sync_projects`, `house_sync_versions`, and `house_sync_receipts` are the only application tables. Transactions atomically record the head, immutable version and receipt. No remote deletion or automatic history pruning is exposed.

## Validation and deployment

```powershell
npm test
npm run lint
npm run build
npm run build:sync
```

Browser sync regression uses disposable profiles and an embedded PostgreSQL database, never the supplied production credentials. Start Vite on port 5193 and the test API on 5194 in separate terminals, then run the audit:

```powershell
npm run dev -- --port 5193 --strictPort
npx tsx tests/support/sync-api.ts
node scripts/audit-workspace-sync.mjs
```

Restart the test API before rerunning the audit to reset its in-memory database. The audit routes only its browser contexts' sync requests to the test API. Reports/screenshots are in ignored `tmp/workspace-sync-audit/`.

Before publishing, recapture and compare actual browser/profile workspaces with canonical project data under `AGENTS.md`. Commit only the reviewed house branch changes and project merges, preserving concurrent work. Then:

```powershell
uv run --with paramiko --with pyyaml python scripts/deploy-mikrus.py --revision <validated-house-commit> --sync-api --deploy
```

The publisher preserves the existing IPv4/IPv6 bindings, validates frontend assets and database TLS/authentication, and backs up existing `house_sync_*` tables before the new API runs migrations. A restricted custom-format PostgreSQL dump stays in the server's `deploy/mikrus/backups/` and is downloaded to ignored local `tmp/` for off-host recovery. First deployment skips the data backup only if application tables do not yet exist. Restore rehearsal must use a separate disposable database with `pg_restore --no-owner --no-acl`, never the live database.

Application rollback restores the previous Compose configuration/images without reversing database history. The frozen `main` branch and Pages deployment are never touched. Publish readiness requires actual public HTTPS UI tests after rollout, not just the local API audit. Current code is not yet deployed because verified database TLS is unresolved and concurrent house-data changes remain uncommitted.
