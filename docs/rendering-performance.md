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
