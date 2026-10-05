# WebGL release validation — 2026-09-11

Deployed application code: `c143541a90b29e174b376437de8ba61dc7f85b7f`, branch `codex/deploy-furnished-zielonki`, at [Mikrus HTTPS](https://natan203-20203.mikrus.cloud/). `/health` confirms this revision; public HTML matches the tested local build byte-for-byte. The legacy HTTP origin remains available. GitHub Pages/main was not changed.

## Final checks

| Check | Local production preview (5189) | Public Mikrus HTTPS |
| --- | --- | --- |
| WebGL suite | 7 passed, no retries | 7 passed, no retries |
| Hardware: MCP, measurement, sun, navigation, interior switching | Passed | Passed |
| Forced SwiftShader: fast rendering, tools and ten report images | Passed | Passed |
| Unavailable/lost context and retry | Passed | Passed |
| Reports, cancellation/retry, Detailed drawing content, nonblank interior PNG | Passed | Passed |
| Idle draw calls | 0 | 0 |
| Report readbacks | 10 asynchronous, 0 synchronous | 10 asynchronous, 0 synchronous |
| Out-of-range texture-unit calls | 0 | 0 |

The 404 unit tests and TypeScript/build checks passed. A separate failed-model browser check verifies that optional models remain selectable/retryable. Project audits passed at 1440×1000, 360×640, 390×844 and 844×390, including all three projects, fresh storage, independent saved edits/deletions, migrations and reload. Mobile sizes were simulated in Chrome, not tested on physical mobile GPUs.

One final instrumented hardware run measured MCP opening during startup at 2.284 s locally and 2.512 s on production; the ten-view report took 1.358 s and 2.051 s respectively. These are individual smoke-test observations on one Windows Chrome machine, not controlled benchmarks or device guarantees. Cold initialization still takes seconds and included individual main-thread tasks around 1.6 s. The original `activeTexture INVALID_ENUM` was not reproduced; normal tested hardware/software flows emitted no WebGL errors or GPU-stall warnings.

## Implemented changes and setup

- Grass placement runs in a cancellable worker. Automatic mode uses lower rendering resolution, diffuse-only plot textures and procedural vegetation. Detailed retains scanned vegetation and fuller textures/shadows; Fast also removes shadows and grass blades. Rendering preferences are session-local and do not modify project data.
- Each new canvas starts conservatively, including when returning from the interior. Context failures leave HTML tools available with a retry action. Both editors render on demand.
- Reports use asynchronous GPU readback and restore temporary scene state before yielding. Physical glass refraction was removed after reproducing a framebuffer feedback-loop error. Transparent glazing remains. A separate blank site-plan bug was corrected by scaling the camera clipping range to the long plot; tests inspect drawing pixels, excluding captions.
- Local development remains Vite on 5173; use the built preview on 5189 for release comparisons. Production serves the same renderer code through Nginx. No server GPU configuration is needed. Automatic/Fast/Detailed adapt to the browser, not the hosting origin.
- Nginx now precompresses text assets, versions model/texture caching, returns uncached 404s for missing assets, and retains the previous build's named chunks. HTTPS and direct HTTP gzip, immutable versioned assets, unversioned revalidation, uncached HTML and missing-asset behavior were verified. Both IPv4 and IPv6 bindings remain intact.

See [rendering policy and test commands](rendering-performance.md) and [Mikrus deployment configuration](mikrus-deployment.md).

## Preservation and operational limits

Actual Chrome and Codex workspaces were backed up repeatedly before publication. All extracted entries remained unchanged; the HTTPS copies exactly match canonical original r49, front r67 and rear r88. No project JSON, geometry, immutable baseline or origin working copy was overwritten. See the capture/merge decisions in [project provenance](../project-data/zielonki/README.md).

The final container is healthy, has zero restarts/OOM events, and uses about 14.7 MiB of its 256 MiB allowance; the CPU cap remains 0.5 core. Verified redundant archive removal reclaimed 827,355,882 bytes. After retaining both new releases, the shared VPS root is still 94% full (about 2.4 GB free). Further host disk management remains separate work; unrelated services and their data were not pruned. The large JavaScript bundle build warning also remains an optimization opportunity.

One final upload attempt lost its SSH connection before a service switch; retry succeeded after checksum and candidate validation. Rollback configuration: `/root/house-web-mcp/furnished-zielonki/deploy/mikrus/compose.yaml.before-20260911T133837Z`.

Evidence is retained in ignored `tmp/webgl-local-release-results.json`, `tmp/webgl-production-release-results.json`, their `*-release-tests` screenshot directories, `tmp/webgl-production-release-projects/audit.json`, `tmp/webgl-release-delivery.json`, `tmp/webgl-public-delivery.json`, `tmp/webgl-release-server.json`, and `tmp/deployment-result.json`. Raw browser recovery directories remain ignored and private.
