# Current house deployment

The working house branch is `codex/deploy-furnished-zielonki`, previewed locally at `http://127.0.0.1:5173/`.
It includes the merged `codex/ikea-interior-mobile` editor and all 64 catalogue configurations.
Interior IDs use cryptographic UUID v4 generation on both HTTP and HTTPS. The browser regression fixture also exercises the HTTP case where `crypto.randomUUID` is absent.
The plot now includes [precise editing and measurement controls](precision-editing.md). Run `node scripts/audit-precision-editor.mjs --url <preview-or-public-url>` to verify the desktop/mobile editing and reload flows in isolated profiles.
House interior also supports immediate mouse/touch dragging of partitions, openings and furniture. Before release, run the direct-manipulation and interior browser tests documented in that guide; the scene uses native pointer capture to suspend camera gestures during object edits.
The deployed house is [Mikrus over HTTPS](https://natan203-20203.mikrus.cloud/).
The original [HTTP address on port 20203](http://natan203.mikrus.xyz:20203/) remains available for existing browser workspaces.
GitHub Pages/main remains the separately restored competition submission; deploying this branch does not change it.

## HTTPS

Mikrus's [automatic subdomain proxy](https://wiki.mikr.us/darmowa_subdomena_dla_vps/) provides HTTPS and certificate renewal for `natan203-20203.mikrus.cloud`. It reaches the application's HTTP port over IPv6. Preserve both published bindings in the server-side Compose configuration:

```yaml
ports:
  - "0.0.0.0:20203:8080"
  - "[::]:20203:8080"
```

Do not install a certificate in the application container or redirect every backend HTTP request to HTTPS: the provider proxy uses HTTP to reach the origin. TLS terminates at the provider; the proxy-to-application connection is HTTP. The deployment script preserves these bindings when updating the existing Compose file.

HTTP and HTTPS are separate browser storage origins. Existing local edits and history do not automatically transfer between them. Keep the original address available for recovery/export; new HTTPS workspaces receive the published projects. Capture and compare actual browser data before a future redirect or storage migration.

HTTPS was enabled on 11 September 2026 without changing application code `8d334e5b8a9db11931a3902df2f6738f791f136f` or canonical project revisions (original r49, front r67, rear r88). The server rollback file is `/root/house-web-mcp/furnished-zielonki/deploy/mikrus/compose.yaml.before-https-20260911T104126Z`. Restoring it with the rollback command below removes the IPv6 binding and disables this HTTPS proxy route.

Validation passed: browser certificate trust and secure context, identical HTTP/HTTPS application HTML, healthy unchanged code revision, and `audit-house-studies.mjs` at 1440×1000, 360×640, 390×844 and 844×390. The audit covers all three projects, reload, fresh storage and migration preserving independent names and tree deletions. Evidence is in ignored `tmp/https-20260911-1243/`.

## Build and verify

Use Node 22.12+ (validated with Node 24). Run `npm ci` after merging dependencies, with the local Vite process stopped on Windows.
Run `npm test`, `npm run lint` and `npm run build` with `BASE_PATH=/` for Mikrus.
Start the normal preview with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Vite ignores recovery files in `tmp/`, browser evidence in `output/` and `.playwright-mcp/`; locked browser databases must not stop the development watcher.
Set `APP_URL=http://127.0.0.1:5173` when running `npm run test:interior` against this checkout.
The original separate editor worktree can continue on 5187.

The Projects house icon opens the shared launcher for `Dom duży taras` (r50), `Garaz przód` (existing zielonki v2, r68), and the independent rear-carport design (r89). All three include the 17 emailed-map trees and the distant field outbuilding with its terrace and equipment. Both carport designs include the shortened and narrowed shell, enlarged bathroom/storage and moved guest-room door. The rear-carport design retains parking behind the house, with 4.00 m road clearance and a 0.15 m mapped construction/agricultural boundary margin. Each project is loaded from its own tracked `project-data/` directory and merged against its own immutable baseline. Include all three data/chunks in releases and run `node scripts/audit-house-studies.mjs --url <preview-or-public-url>` for desktop/mobile switching and reload, including migration from saved original r46 and v2 r49 with independent user edits and deletions. Revision numbers are project-local; the geometry worker must accept a lower revision when switching projects or undoing an edit.

The migration audit also seeds rear-carport r49 with an independent house rename and tree deletion before updating to r50. It verifies that both edits survive project switching and reload.

## Publish

The private, ignored `.env` contains VPS_HOST, VPS_PORT, VPS_USER, VPS_PASSWORD,
VPS_SSH_HOST_KEY (algorithm, bit count, SHA256 fingerprint), HOUSE_DEPLOY_PATH,
HOUSE_DEPLOY_PROJECT, HOUSE_DEPLOY_PUBLIC_PORT and HOUSE_DEPLOY_URL.
Never commit it or include it in an archive. Install Paramiko in the Python environment used for deployment.
The existing local copy in ignored `tmp/mikrus-python` can be supplied through `PYTHONPATH`.

```sh
python scripts/deploy-mikrus.py --help
python scripts/deploy-mikrus.py
python scripts/deploy-mikrus.py --revision <validated-commit-sha> --deploy
```

The default command only inspects the service. Publishing packages `dist/` only, verifies the uploaded SHA256,
builds an immutable revision-tagged Nginx image and probes its health and 64-entry catalogue in a separate container.
It then backs up Compose and replaces only the `house-web-mcp` service in the existing project.
If the new service fails its health/revision check, the script restores the previous Compose configuration.
Previous images and release directories remain available; other VPS services are not restarted.
The script checks the pinned SSH fingerprint and does not log or upload the password.

Check `/health` for the deployed revision and use `scripts/audit-interior-production.mjs --url <public-url>`
to check all model/thumbnail paths and desktop/mobile production flows in isolated browser contexts.
Deployment records are written to the server's `deployment.json` / `deployment.txt` and locally to ignored `tmp/deployment-result.json`.

## Roll back

The deployment record names the exact Compose backup. On the VPS, restore that backup to
`$HOUSE_DEPLOY_PATH/deploy/mikrus/compose.yaml`, then run Docker Compose with the recorded project name:

```sh
docker compose -p house-web-mcp-furnished -f /root/house-web-mcp/furnished-zielonki/deploy/mikrus/compose.yaml up -d --no-build --no-deps house-web-mcp
```

Local and public origins have separate IndexedDB working copies. The published house is now tracked in
`project-data/zielonki/project.json` and included in the build. Before deploying, capture the user's current
workspace, merge its data changes with the tracked project, and follow `AGENTS.md` and
`project-data/zielonki/README.md`. A code merge alone does not capture browser edits.
On startup the application merges published data against each browser's last published baseline, backing
up changed workspaces. Conflicting local changes remain intact beside a separate published version.
Check the house contents (initial recovery: r40, six plants, six garden fixtures, ~40.13° gables)
as well as `/health`; a deployed code SHA alone is not evidence that the intended project was published.

The September 11 release includes the enclosed U-shaped stairs in the rear-carport design and aligned main-roof ridges in both compact designs. Their slopes are 44° and approximately 37.871038°, with eaves at 4.85 m; the original large-terrace design remains r49. Roof regression tests verify the shared ridge and absence of an internal roof sheet.

## WebGL release delivery — 2026-09-11

The renderer configuration is shared between local and production builds; see [rendering modes and reproducible browser checks](rendering-performance.md). Use Vite dev on 5173 for editing and a production preview on 5189 for comparable measurements. Mikrus runs only the built static files; no GPU, X server or Chromium process is needed there.

`deploy/mikrus/nginx.conf` and `deploy/mikrus/Dockerfile` are now tracked deployment inputs. The publisher validates Nginx in its isolated candidate container, precompresses JS/CSS/JSON/WASM/SVG, and retains the immediately preceding build's named asset chunks so an already-open tab can finish loading deferred editors. It preserves the existing resource limits and IPv4/IPv6 bindings.

Hashed `/assets/` files use immutable caching. Model and texture URLs receive a 16-hex content version computed by Vite from the asset directories; only successful versioned responses receive immutable caching. Unversioned model/texture URLs revalidate. Missing assets return 404 with `no-store`, not the SPA HTML. Root HTML and `/health` are never cached. Origin gzip also benefits the direct HTTP address; the provider HTTPS proxy may use Brotli. Rebuilding after asset changes updates the version automatically.

Before publishing, `node scripts/capture-browser-workspaces.mjs --source-profile <actual-profile-directory> --output tmp/<new-capture-directory>` copies known house IndexedDB stores into an ignored recovery directory, verifies source-file stability, and reads the copy without running app migrations. Capture each actual profile independently and compare extracted projects by reference against their own published baseline. A capture is not permission to overwrite a browser working copy.

Disk maintenance during this audit removed 19 redundant upload archives only after verifying every archived file byte against its extracted release. All extracted releases, Docker images, and current/previous upload archives were retained. It reclaimed 827,355,882 bytes; root usage fell from 95% to 93% (about 3 GB free). The remote deletion ledger is `deploy/mikrus/archive-cleanup-20260911.json`. Remaining host-wide disk use is outside this app's release cleanup; do not globally prune other services.
