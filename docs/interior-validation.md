# Interior implementation validation

Validated on 9 September 2026 in the isolated `codex/ikea-interior-mobile` worktree. Baseline snapshot: `4fac4a6`. No automatic deployment was performed.

## Automated checks

| Check | Result | Coverage / evidence |
| --- | --- | --- |
| `npm test` | **247 passed**, 36 files | Existing project/domain/persistence/WebMCP suites plus geometry, layout, furniture and 25 asset/floor checks. |
| `npm run test:interior` | **8 passed** | Desktop editing, room split/merge/openings/finishes, three mobile viewport scenarios, WebMCP Apply, GLB recovery and project outputs. |
| `npm run lint` / production build | **Passed** | Node 24; production base `/House_Web_MCP/`. Vite reports the existing large app bundle, third-party Zod annotation and Manifold browser-externalization warnings. |
| Deployment asset audit | **72/72 URLs passed** | Desktop/mobile GLBs and PNG thumbnails checked as binary assets under the nested base path. Real production JSON import loads LACK desktop/mobile GLB with HTTP 200; no page exceptions in either viewport. |
| Original checkout | **Preserved** | Original branch remains `codex/deploy-furnished-zielonki`, HEAD `01bc116a8e11bbdb10e71fef78530d7befe90794`. Its tracked working files match the baseline snapshot; two snapshotted source/test files remain untracked there. No implementation edits were made there. |

The new domain cases cover shared room-boundary hosts and openings during split/merge, connected partition motion, fixed envelope, locked objects and walls, voids, opening fit/overlap and hinge/swing, separate wall-face finishes, fixed product dimensions, ceiling/elevation validation, rotated overlaps, rugs under tables, snapping, batch undo/redo and old-project parsing/exports. The asset audit reads the actual GLB buffers, checks embedded textures and their physical vertex bounds, floor-centred origins, mobile triangle counts and real PNG thumbnails. A separate floor test covers void clipping at a room boundary and correctly sized normal attributes.

The browser scenarios use visible controls to place, rotate, drag, cancel, edit exact values, split and merge rooms, add/remove openings, apply finishes, undo/redo and reload. Browser-only fixture helpers supply a deterministic two-room project and read camera/project state; they are not imported by the application or included in the production bundle. Touch scenarios dispatch real browser touch input through CDP, including `touchCancel`. Inputs are also exercised with keyboard entry. A final manual browser check confirmed accent-insensitive POANG/POÄNG and BESTA/BESTÅ catalogue searches.

## Mobile visibility

| Viewport | Canvas | Permanent bars | Unobstructed height | Result |
| --- | --- | --- | --- | --- |
| 360 × 640 | Full viewport | 56 + 60 px | 524 px / **81.9%** | Pass ≥80% |
| 390 × 844 | Full viewport | 56 + 60 px | 728 px / **86.3%** | Pass ≥85% |
| 844 × 390 | Full viewport | 56 + 60 px | 274 px / 70.3% | Landscape sheet stays to the side; no portrait target applied |

These are emulated CSS viewports with zero device safe-area insets and browser chrome excluded. Both plot and interior are checked. Tests verify one sheet, camera stability when opening it, catalogue dismissal for placement, property-specific slider activation, Hide controls and restore, panel close controls and Fit positioning in the visible area. A Fit request made while returning to the plot is retained through scene initialization and React's development remount.

## Assets

All 24 configurations have a desktop GLB, lighter mobile GLB, PNG thumbnail, assembled envelope and manifest record. Maximum desktop geometry is 6,084 triangles; maximum mobile geometry is 2,212 triangles. Painted furniture uses a subtle original paint map; fabric, jute, wood and mesh have their own original maps. Finishes use physical texture scale. Assets are independently authored planning studies, with source and licence details in the [asset audit](ikea-assets.md).

The [contact sheet](../output/interior-editor/asset-contact-sheet.png) was visually reviewed for all 24 models. The UI was also checked with the furnished Zielonki house. Default mounting elevation, bed-frame dimensions and carcass/assembly distinctions are in the product manifest. Two historical/redirecting Polish references remain explicitly marked.

## Performance and remaining device checks

The production audit used Chrome 152 on Windows with Intel Arc graphics. On the furnished ground floor with **21 objects**, the stationary rendering sample measured approximately **60 fps**, 16.7 ms median and 16.9–17.0 ms p95 frame intervals at both desktop and 390×844 viewports. These are requestAnimationFrame samples of a rendered scene on this desktop, not a phone navigation benchmark. Raw environment, asset requests and frame samples are in [production-audit.json](../output/interior-editor/production-audit.json).

**The 30 fps physical midrange-phone navigation target is not yet verified.** No physical phone was available. Before declaring that acceptance criterion met, record the actual device/OS/browser, use a representative furnished floor, orbit/pan/zoom continuously for 60 seconds, and capture frame times after loading. Check cold model loading, repeated furniture, landscape, interruption by a second finger, actual soft keyboard behavior, safe-area insets and memory pressure. iOS Safari and physical Android checks remain outstanding; the automated touch coverage ran in Chrome.

## Existing browser-suite failures

`tests/browser-v2.spec.ts` still has **four failures**. All four were reproduced in a separate detached worktree of the untouched snapshot `4fac4a6`, served on port 5191, as well as in the implementation worktree:

1. The initial-house assertion expects the previous “L-shaped modern barn” name after the bundled furnished-house flow changed.
2. The land legend assertion expects the old “Garden / agricultural land” wording instead of the existing MPZP legend.
3. The unavailable optional garden-model assertion expects a different error string.
4. The new-terrain launcher assertion expects zero Continue buttons although the baseline already lists an autosaved project.

These older expectations were not rewritten as part of the interior implementation. `npm run test:e2e` still runs that legacy suite; use `npm run test:interior` for the passing new scenarios. This delivery does not claim a green legacy browser suite.

## Walkthrough evidence

- [Desktop walkthrough](../output/interior-editor/desktop-walkthrough.mp4), approximately 49 seconds: furnished house, visual library, POÄNG placement and exact rotation. At approximately **00:44**, the inspector shows the expected contextual clearance warning after rotation.
- [Mobile walkthrough](../output/interior-editor/mobile-walkthrough.mp4), 44 seconds: contextual action bar, catalogue sheet, Hide controls and plot navigation. It is cropped from the full capture to remove the recorder's unused grey area; no UI elements were removed from the phone viewport.
- [Desktop view](../output/interior-editor/desktop-house.png), [desktop catalogue](../output/interior-editor/desktop-library.png), [mobile house](../output/interior-editor/mobile-house.png), [mobile catalogue](../output/interior-editor/mobile-library.png), [mobile plot](../output/interior-editor/mobile-plot-house.png), and [printable plan/PDF](../output/interior-editor/dimensioned-plan.pdf).
- [Timestamped recorder findings](../output/interior-editor/walkthrough-findings.json). Times refer to the full source recording; mobile clip time is source time minus 00:51.

What worked: the recorded placement, precision, catalogue, hide/restore and plot transitions completed. **No application crash or failed asset request was observed in the completed recording.** At source **00:00** and **01:10** (mobile **00:19**), the recorder's older bundled Chromium reported software-WebGL fallback and readback performance warnings; initial setup also reported a third-party initialization deprecation. The recording is unsuitable as performance evidence. The hardware-accelerated production audit is separate. No account, permission or external-service blocker affected these flows.

## Reproduce

```sh
npm ci
npm run dev:interior
npm test
npm run test:interior
npm run build
```

For the nested-path audit, set `BASE_PATH=/House_Web_MCP/` for build and preview, serve preview on 5189, then run `node scripts/audit-interior-production.mjs`. On PowerShell, assign `$env:BASE_PATH = '/House_Web_MCP/'` before `npm run build` and `npm run preview -- --port 5189 --strictPort`. The audit creates isolated browser contexts and does not touch another browser profile's projects.

The recording scenario is `demo-recording/interior.cjs` and runs with the browser-demo-recorder skill's `record_demo.cjs` script. Both scripts document their inputs and outputs. The app and evidence remain local to this worktree.
