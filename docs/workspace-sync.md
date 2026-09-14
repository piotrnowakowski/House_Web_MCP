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

## Automatic local connection

Vite development on loopback now reads `HOUSE_SYNC_CONNECTION_KEY` from the ignored server-side `.env` automatically. The panel reports that local configuration is connected and does not ask for the key. `/api/local-sync/` injects authorization upstream; it never returns the key to the browser. Requests require a loopback peer, an exact localhost Host/Origin and a custom header, and only the fixed sync read/write routes are forwarded. The optional server-only `HOUSE_SYNC_API_URL` selects the upstream; default is the Mikrus HTTPS deployment. Restart Vite after changing `.env`.

The user explicitly enabled public sync on 2026-09-14: `HOUSE_SYNC_PUBLIC_ACCESS=true` in local and restricted Mikrus runtime configuration. In this mode website visitors can list, read and write shared projects without a key. The frontend detects `/api/sync/access` and hides credential entry; no secret is returned. Setting the flag to false restores private bearer authentication, with existing connected browsers remembered across deployments. Origin checks, schema validation, optimistic concurrency and version history remain active. Server `.env` is never served or embedded in frontend files. The public API code still awaits deployment because verified database TLS is unresolved. Validation: 496 tests, both builds and release secret scan pass.


## Two-action transfer panel

The user requested only Get from Mikrus and Push to Mikrus. The panel now offers these two directions for the current project. Get never uploads, including when recovering local state; Push sends the local snapshot rather than implicitly merging in remote changes. Different versions are backed up and require confirmation before replacement. Conditional server versions prevent a concurrent write from being silently overwritten. Automatic local saves, automatic local `.env` connection, and configured public access remain in use. The former bidirectional service helpers remain for existing integrations, but are not exposed in this panel.

Release capture: actual in-app localhost workspace records backed up to ignored tmp/two-action-release/local-before.json. GŁÓWNY saved r12 matches canonical r11; prior unrelated records are preserved. Database readiness rechecked on Mikrus: DEPTH_ZERO_SELF_SIGNED_CERT still prevents activating the API release.

2026-09-14 sync endpoint diagnosis: public /api/sync/access returns HTTP 200 text/html from the old SPA fallback, not an API response. Local proxy now converts non-JSON upstream responses to HTTP 503, and the client validates content type and malformed JSON before consuming API results. Browser Push verified the explicit service-unavailable message without altering local data. Focused regression tests (10), frontend/API builds and release secret scan pass. Shared PostgreSQL trust still blocks backend activation; private VPS PostgreSQL alternative was offered to the user, awaiting selection.

2026-09-14: user explicitly requested temporarily skipping the shared database certificate check. `PGSSLMODE=require` is now supported only as an explicit configuration choice; it keeps TLS encryption but does not verify database identity. `verify-full` remains the sample/default recommendation; unspecified or unencrypted modes are rejected. Local and restricted server runtime .env were set to require at the user's request, and authenticated SELECT 1 succeeds. No global TLS setting was disabled. Public access remains explicitly enabled.

Live verification, 2026-09-14: d1d1ebb deployed successfully with frontend and sync API healthy. /api/sync/access reports publicAccess=true. Actual in-app localhost Push saved favourite GŁÓWNY r20 with one proposal as server version 1; local Get succeeded. The actual HTTPS in-app browser then opened GŁÓWNY and completed Get without a connection key. API readback confirms the project identity, r20 and proposal history. TLS encryption is enabled with certificate verification temporarily skipped at the user's explicit request. Evidence: ignored tmp/sync-response-fix/deploy.log and server-readback.json; 506 tests plus frontend/API builds and secret scan passed.
