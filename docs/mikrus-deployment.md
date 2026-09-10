# Current house deployment

The working house branch is `codex/deploy-furnished-zielonki`, previewed locally at `http://127.0.0.1:5173/`.
It includes the merged `codex/ikea-interior-mobile` editor and all 64 catalogue configurations.
Interior IDs use cryptographic UUID v4 generation on both HTTP and HTTPS. The browser regression fixture also exercises the HTTP case where `crypto.randomUUID` is absent.
The plot now includes [precise editing and measurement controls](precision-editing.md). Run `node scripts/audit-precision-editor.mjs --url <preview-or-public-url>` to verify the desktop/mobile editing and reload flows in isolated profiles.
House interior also supports immediate mouse/touch dragging of partitions, openings and furniture. Before release, run the direct-manipulation and interior browser tests documented in that guide; the scene uses native pointer capture to suspend camera gestures during object edits.
The deployed house is [Mikrus on port 20203](http://natan203.mikrus.xyz:20203/).
GitHub Pages/main remains the separately restored competition submission; deploying this branch does not change it.

## Build and verify

Use Node 22.12+ (validated with Node 24). Run `npm ci` after merging dependencies, with the local Vite process stopped on Windows.
Run `npm test`, `npm run lint` and `npm run build` with `BASE_PATH=/` for Mikrus.
Start the normal preview with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Vite ignores recovery files in `tmp/`, browser evidence in `output/` and `.playwright-mcp/`; locked browser databases must not stop the development watcher.
Set `APP_URL=http://127.0.0.1:5173` when running `npm run test:interior` against this checkout.
The original separate editor worktree can continue on 5187.

The house icon beside Neighbors opens the shared variants chooser for the original house and existing zielonki v2 (r50: road-facing carport and house moved back within mapped building land; r49: front terrace removed). V2 is loaded from `project-data/zielonki-v2/project.json`, persisted under a separate ref and merged against its own immutable baseline. Include its data/chunks in releases and run `node scripts/audit-house-studies.mjs --url <preview-or-public-url>` for desktop/mobile switching and reload, including migration from a saved r49. Revision numbers are project-local; the geometry worker must accept a lower revision when switching projects or undoing an edit.

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
