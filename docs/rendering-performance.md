# Rendering and startup performance

Measured on 2026-09-10 against the working house branch based on `6d972d4`, including its existing uncommitted project and editor changes. This was a local optimization pass, not a deployment or project-data migration.

## Changes

- Load the plot canvas after choosing a project and load the interior editor when opened.
- Render both canvases on demand. Camera controls, edits, loaded assets, waiting measurement markers and sun playback request frames. Decorative grass updates with those frames and rests when the view is idle.
- Remove the unused fixed-body physics runtime from the viewer and stop prebundling unused physics/BIM libraries during development. Selection still uses mesh raycasting; geometry validation remains in the domain layer.
- Isolate sky updates from the static scene and memoize the plot canvas so toolbar changes do not rebuild it.
- Download only scans used by the current project or visible proposal. Reuse texture configuration, dispose rotated texture clones, and check the requested project's texture readiness before capturing reports.

## Local measurements

Production preview in headless Chrome, fresh isolated browser storage, 1440 × 1000 viewport, opening the furnished Zielonki study. These are local observations, not a statistically controlled benchmark or a promise for other devices. Browser storage belonging to the user was not used for testing.

| Measurement | Before | After |
| --- | ---: | ---: |
| Main JavaScript entry, minified | 4.45 MB | 1.63 MB |
| Main JavaScript entry, gzip estimate | 1.45 MB | 0.45 MB |
| Idle WebGL draw calls/second | 23,418 | 0 |
| First contentful paint | 1,404 ms | 884 ms |
| Resources transferred through initial scene loading | 30.84 MB / 45 requests | 22.85 MB / 35 requests |

The entry size excludes deferred chunks; total loaded JavaScript is larger when an editor is opened. Resource totals are sampled after opening the scene and settling, rather than at a fixed navigation deadline. Initial house rendering still includes model downloads, geometry construction and GPU setup; in the final sample the first scene was observed about 6.1 seconds after choosing the study.

## Reproducing the checks

Use the Node version required by `package.json`.

```powershell
npm run build
npm run preview -- --port 5189 --strictPort
```

In another terminal:

```powershell
$env:APP_URL = 'http://127.0.0.1:5189'
npx playwright test tests/rendering-performance.spec.ts --config=playwright.config.ts --workers=1
```

The test records startup metrics and screenshots under `test-results/`, checks that the launcher downloads no scene assets, verifies idle drawing stops, and exercises camera navigation, sun playback, exact measurements, interior switching and a report with a delayed new texture.

The existing unit tests cover project persistence, deletion preservation, migration, roof geometry and proposal workflows. Desktop/mobile interior and direct manipulation browser tests cover dragging, undo, autosave, openings, room edits, exports and failed model recovery.

## WebGL resilience update — 2026-09-11

Both local and Mikrus builds use the same client-side rendering policy. WebGL runs on the browser's GPU (or its software renderer); the static VPS does not render the house. Test release performance with `npm run build` and `npm run preview -- --port 5189 --strictPort`, not Vite's development server, whose module loading and hot reload add overhead.

The **View quality** selector is a session preference, independent of saved project data:

| Mode | Rendering cost |
| --- | --- |
| Automatic, hardware detected | DPR 1, 1024px shadows, diffuse textures, scanned models, 90,000 grass candidates in a worker |
| Automatic, software detected / Fast | DPR 1, no shadow maps or grass blades, flat finishes and procedural model fallbacks |
| Detailed | DPR up to 2 (1.5 on compact interiors), 2048px shadows, full texture maps, 360,000 grass candidates in a worker |

Automatic starts conservatively until the renderer is detected. If a browser conceals its GPU identity or a weak hardware GPU remains slow, select Fast manually. Detailed prioritizes appearance and is not a software-renderer performance guarantee. All modes keep transparent glass but omit physical refraction passes; this avoids the framebuffer/texture feedback loop reproduced during this audit. Antialiasing and preserved drawing buffers are disabled. PNG export explicitly renders immediately before capture.

Grass geometry is generated off the UI thread, cached for three placement configurations, and cancelled when superseded. Changing finishes or furniture does not rebuild it. Optional models have local loading fallbacks. Texture loading no longer eagerly initializes every texture through Drei. Both editors still render only when invalidated, including controls, edits and sun playback.

Architectural sets reuse a 960×640 render target and use Three's asynchronous pixel readback. Temporary scene visibility, materials, clipping and lights are restored before awaiting the GPU. Reports can be cancelled; concurrent captures are rejected, and abandoned image URLs are released. WebGL creation failure or context loss leaves the HTML tools accessible with a retry action.

Run the same isolated browser tests against each environment, one worker at a time to avoid GPU contention:

```powershell
$env:APP_URL = 'http://127.0.0.1:5189'
npx playwright test tests/rendering-performance.spec.ts tests/webgl-resilience.spec.ts tests/software-webgl.spec.ts --workers=1 --output=tmp/webgl-local-tests
$env:APP_URL = 'https://natan203-20203.mikrus.cloud'
npx playwright test tests/rendering-performance.spec.ts tests/webgl-resilience.spec.ts tests/software-webgl.spec.ts --workers=1 --output=tmp/webgl-production-tests
```

The software test deliberately enables SwiftShader only in its isolated trusted QA browser. This flag is not required or recommended for normal users or the VPS. Tests cover MCP search, length/area/sun controls, all ten report images, asynchronous readback, texture-unit bounds, Detailed cancellation, unavailable/lost context, nonblank interior PNG and idle rendering. The original QA `activeTexture INVALID_ENUM` was not reproduced on the inspected Intel Arc hardware; absence in these tests cannot establish compatibility with every driver.

See [Mikrus configuration](mikrus-deployment.md) for origin compression, strict missing-asset responses and versioned caching. Build warnings about the large entry bundle remain a startup optimization opportunity; lowering the warning threshold or adding server GPU resources would not fix browser rendering stalls.
