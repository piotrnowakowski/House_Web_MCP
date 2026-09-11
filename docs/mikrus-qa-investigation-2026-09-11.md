# Deployed application and Mikrus configuration investigation

Read-only inspection on 2026-09-11, approximately 11:41–11:45 UTC. Public browser tests used **https://natan203-20203.mikrus.cloud/**, not localhost. SSH used the deployment script's pinned host-key verification. No service, configuration, image, release, or project data was changed.

## Conclusion

The currently deployed build is the expected release. The server was healthy and showed no evidence of CPU throttling, memory exhaustion, or failed asset requests during the captured browser flow. The deployed application still performed multi-second main-thread work on a hardware-accelerated browser.

Separate deployment problems were confirmed: nearly full VPS storage, missing model/texture URLs returning HTML with status 200, and a public texture cache policy that differs from the origin. These deserve fixes but do not establish the cause of the original WebGL invalid-enum warning.

## Verified release and topology

- Public `/health`: `8d334e5b8a9db11931a3902df2f6738f791f136f`.
- Running image: `house-web-mcp-furnished:8d334e5b8a9db11931a3902df2f6738f791f136f`.
- SHA256 comparisons confirmed identical public/local bytes for `index.html`, `assets/index-Cf3Ab9tJ.js`, and `assets/PlotCanvas-DBJQzgSl.js`.
- Cloudflare-fronted HTTPS endpoint → Mikrus IPv6 proxy route → published port 20203 → container port 8080 → Nginx static files. Browser asset requests used HTTP/2 and HTTP/3.
- Both `0.0.0.0:20203` and `[::]:20203` bindings are present. This matches the [Mikrus automatic subdomain requirements](https://wiki.mikr.us/darmowa_subdomena_dla_vps/).
- Running Nginx uses `nginx:1.27-alpine` (HTTP origin identifies version 1.27.5), sendfile enabled, 1024 worker connections, 65-second keepalive, gzip disabled.
- The reusable server-side `deploy/mikrus/nginx.conf` template contains an old health revision (`9af5730`), but the effective running configuration contains the correct full release SHA. `scripts/deploy-mikrus.py` replaces that template value per release; the old template label is not evidence of an old running application.

These checks identify the deployment at inspection time. The original QA run's timestamp and browser configuration are unavailable, so its historical build and renderer cannot be established from today's health response.

## Server resources and logs

| Item | Observation |
| --- | --- |
| Container state | Healthy, zero restarts, not OOM-killed |
| Started | 2026-09-11 10:41:32 UTC |
| CPU limit | 0.5 CPU; cgroup `cpu.max` = `50000 100000` |
| Throttling | `nr_throttled=0`, `throttled_usec=0` at inspection |
| Container RAM | Approximately 9.445 MiB used of 256 MiB |
| Memory events | No high/max/OOM/OOM-kill events |
| VPS RAM | 4096 MiB total, approximately 2749 MiB available; no swap |
| VPS load | 0.18 / 0.24 / 0.18 |
| Origin health request | HTTP 200, approximately 1.4 ms from the VPS |
| Root disk | 95% used; 35 GiB used, approximately 2.2 GiB available |
| App release directories | Approximately 2.6 GiB |
| Docker build cache, whole VPS | Approximately 2.838 GB reclaimable |
| Docker images, whole VPS | 46 images, 8.218 GB total, 4.327 GB reported reclaimable |

The bounded last-hour container log sample contained 371 HTTP 200 and 436 HTTP 304 responses, no 4xx/5xx paths, and no out-of-memory, no-space, timeout, or file-limit markers. This sample predates the deliberate missing-file probes below and is not a historical guarantee.

**Proposed infrastructure action:** set a disk alert and inventory app-specific releases, images and build cache for retention. Keep the current release, explicit rollback releases and recovery backups. Docker totals include other services, and an unused image may still be needed for rollback; do not perform a global prune from these numbers alone. Increasing this static server's CPU/RAM limit is not currently supported by the measurements as a fix for the editor stalls.

## Asset delivery and caching

| Request | Public HTTPS behavior |
| --- | --- |
| `/` and health | HTTP 200, `Cache-Control: no-store` |
| Hashed main JavaScript | One-year immutable caching; Brotli observed |
| Main JS browser transfer | 433,911 encoded bytes versus 1,629,940 decoded bytes |
| `webmcp-tools.json` | Successful browser request; 12,758 encoded versus 63,001 decoded bytes |
| `models/garden/orchard-tree-realistic.glb` | HTTP 200, `no-cache`, CDN DYNAMIC; 6,291,328 bytes |
| `textures/leafy_grass/diff_2k.jpg` | HTTP 200, public `max-age=14400`; 2,326,702 bytes |
| Deliberately absent `/models/__qa_missing_20260911.glb` | **HTTP 200, `text/html`, application shell** |
| Deliberately absent `/textures/__qa_missing_20260911.jpg` | **HTTP 200, `text/html`, application shell** |
| Deliberately absent hashed JS path under `/assets/` | HTTP 404 |

### Missing static files are swallowed by the SPA fallback

The effective Nginx configuration has a strict `try_files $uri =404` only for `/assets/`. Model and texture paths reach the general `try_files $uri $uri/ /index.html` rule. This conceals missing assets from status-only checks and causes model/image decoder errors instead of a clear 404.

**Proposed fix:** give `/models/` and `/textures/` explicit static locations with `try_files $uri =404`, and consider a strict exact location for `/webmcp-tools.json`. Reserve the HTML fallback for application navigation. For example, initially preserve origin revalidation for the existing unversioned files:

```nginx
location ^~ /models/ {
    add_header Cache-Control "no-cache";
    try_files $uri =404;
}

location ^~ /textures/ {
    add_header Cache-Control "no-cache";
    try_files $uri =404;
}
```

This is a proposal, not a deployed patch. Validate public behavior through the provider proxy as well as directly at the origin.

### Texture caching differs between origin and public endpoint

Origin configuration gives unversioned model/texture paths `no-cache`. The public texture response instead advertises a four-hour lifetime. That policy change is observable beyond the origin; this inspection did not have access to the provider's Cloudflare settings, so the exact responsible rule is unknown. There is a stale-texture risk when a release changes bytes at the same URL. No actually stale texture was demonstrated.

**Proposed fix:** use content-versioned URLs for models/textures and immutable caching for those versioned URLs. Keep manifests revalidated. Until assets are versioned, verify that the public proxy honors the intended revalidation policy, or coordinate the relevant cache rule/purge with the provider. Do not add a year of immutable caching to current filenames that can change in place.

### Origin compression is absent, but HTTPS JavaScript is already compressed

The direct legacy HTTP main-JS response is 1,629,940 bytes with no Content-Encoding despite advertising gzip support in the request. Public HTTPS uses Brotli and transferred about 434 KB in the browser. Thus missing origin gzip is a legacy HTTP delivery optimization, not an explanation for uncompressed JavaScript on the reported HTTPS URL.

**Proposed fix:** enable gzip for text/JS/JSON/WASM, or precompress those build outputs to reduce CPU work on the 0.5-CPU origin. Validate both HTTP and HTTPS. The large JPG/GLB assets need asset optimization; ordinary HTTP text compression does not resolve their texture upload or rendering costs.

## Deployed browser reproduction

A fresh isolated browser context opened the public Zielonki study at 1440 × 1000. Renderer: ANGLE / Intel Arc / Direct3D11. The page was a secure context.

- No failed requests and no captured warning/error messages.
- MCP Tools opened successfully in 1.342 seconds in this sample.
- A long-task observer recorded a maximum main-thread task of **3.861 seconds**, plus a **2.402-second** task. This run did not instrument WebGL calls or use the CPU profiler, though browser automation and the long-task observer still have overhead.
- Largest observed texture resource durations were approximately 1.7–1.85 seconds, with reported TTFB around 157–196 ms. These are one-load observations, not controlled bandwidth benchmarks.
- Main JavaScript took approximately 665 ms total, including approximately 75 ms TTFB; the plot chunk took approximately 95 ms.

The [earlier public-browser investigation](webgl-qa-investigation-2026-09-11.md) traced expensive startup work to grass generation/terrain sampling, shader setup and texture uploads, and architectural report synchronization to ten synchronous GPU readbacks. Its detailed report/image/measurement checks were also on the public HTTPS URL.

WebGL executes on the visiting browser's GPU or software renderer. Mikrus serves the files; it does not render this scene. The current server observations therefore do not explain an out-of-range `activeTexture` call. Reproducing that warning still requires the original QA browser/renderer configuration.

A separate Python urllib probe received public HTTP 403 responses while Chrome and curl succeeded. This is a client-specific observation; no provider rule was inspected and no 403 occurred in the browser flow. Use the actual QA browser/request trace before attributing its interaction timeout to proxy filtering.

## Suggested order of work

1. Reduce browser startup work and add reduced rendering quality, using the code locations and tests in the earlier report.
2. Correct missing static-file responses and establish versioned model/texture caching.
3. Review disk retention with an explicit app-specific deletion inventory and protected rollback set.
4. Optimize direct HTTP compression and large model/texture payloads.
5. Repeat startup, MCP, measurement and report checks on both hardware WebGL and the original QA renderer. Preserve all project identities and saved working copies during any eventual deployment.
