# WebGL responsiveness: investigation and proposed fixes

Historical investigation before the rendering changes. See [release validation](webgl-release-validation-2026-09-11.md) for the implemented fixes and final local/production results.

Investigated 2026-09-11 at https://natan203-20203.mikrus.cloud/. This is a diagnosis and fix proposal; application code and published project data were not changed.

## Reproduction and scope

- Local branch: `codex/deploy-furnished-zielonki`, HEAD `8d334e5b8a9db11931a3902df2f6738f791f136f`.
- Served entry: `assets/index-Cf3Ab9tJ.js`; scene: `assets/PlotCanvas-DBJQzgSl.js`. These filenames match the local production build. Its source maps contain the current source of App, PlotCanvas, StudioScene, grassVisuals and domain/geometry. A deployed Git SHA was not independently established.
- Opened the Zielonki house study in fresh, isolated browser storage. The architectural report identified project **r49**. This does not establish the revision of the user's browser working copy or the other project identities.
- Browser reported **ANGLE / Intel Arc / Direct3D11**, 16 fragment texture units and 32 combined texture units; viewport 1440 × 1000, drawing buffer 1144 × 942. Software WebGL was not used in this reproduction.

| Check | Observation |
| --- | --- |
| Idle viewport | Zero additional WebGL draw calls over two seconds |
| MCP Tools after startup | Opened in 289 ms; search and Input schema worked |
| Length / Area / Sun controls | Clicks completed in 221 / 214 / 59 ms |
| Exact length | Displayed `1.000 m (1000.0 mm)`; clearing worked |
| Architectural set | First generation completed in 5.336 seconds; ten synchronous readbacks |
| Report images | All ten thumbnails decoded at 960 × 640 on a subsequent generation |
| WebGL diagnostics | No captured console warnings/errors or out-of-range activeTexture arguments in the instrumented reproduction |
| Startup CPU profile | MCP Tools opened during startup in 2.153 seconds; longest observed main-thread task was 6.740 seconds |

These are diagnostic samples, not controlled benchmarks. The first run instrumented drawing, texture activation and readback; the startup run used a CPU profiler and long-task observer without those WebGL wrappers. Instrumentation adds overhead. The original QA browser/GPU configuration was unavailable, so its exact timeout, invalid enum and software-fallback combination remains unconfirmed. One investigator selector timeout used the `textbox` role for an input of type `search`; using its accessible label succeeded. That timeout is not an app defect.

## 1. High priority: synchronous grass generation blocks startup and edits

**Evidence:** `src/scene/grassVisuals.tsx:10,34–68,140`. During React rendering, `grassBladePoints` tests 360,000 candidates against polygons, fixtures and entrances, then calls `elevationAt` for accepted blades. Its memo depends on the entire project object. Any new project object can therefore repeat the work, including edits unrelated to grass. `src/domain/geometry.ts:165` reduces terrain elevation points for every sampled position.

The production CPU profile mapped significant self time to grass noise generation, fixture exclusion checks, polygon processing and terrain elevation interpolation. Other startup costs also exist; grass is not the sole cause.

**Proposed fix:** generate grass attributes in a worker and transfer typed arrays back. Cache by the inputs that actually affect grass: terrain, relevant boundaries/zones, building footprints and placement, fixtures and entrances. Reject superseded worker results after edits or project changes. Show the existing ground material immediately and add grass when ready. Use a smaller blade budget for reduced quality, and partition grass spatially so distant patches can be culled; the current single mesh disables frustum culling at line 163.

**Validation:** open MCP Tools during cold scene loading; edit an unrelated finish and verify grass is not regenerated; change a building footprint and verify exclusions update without changing semantic geometry or project data.

## 2. High priority: expensive rendering has no reduced-quality or failed-context path

**Evidence:** `src/scene/PlotCanvas.tsx:8–24` enables antialiasing, DPR up to 2, shadows and a preserved drawing buffer. `src/scene/sun/SunLight.tsx:32` uses a 2048² shadow map. Plot glass uses physical transmission, for example `src/scene/StudioScene.tsx:612`. Interior rendering has similar defaults at `src/interior/InteriorEditor.tsx:417–421`. There is no application-level Canvas error boundary or context-loss UX. Existing boundaries handle texture errors only.

The CPU profile also mapped substantial time to Three.js shader first-use setup and texture uploads. Demand rendering already works, but it does not reduce the cost of the frames that must render.

**Proposed fix:** provide a session-level reduced-quality setting, using DPR 1, smaller/disabled shadows, simpler glass, fewer blades and lower-resolution texture variants. Use capability information and measured frame cost rather than a GPU-name check alone. Stage asset uploads and use `compileAsync` for materials before their first visible use where supported. A failed/lost context should leave project navigation and the HTML MCP catalog usable, with a retry control. Reduced visual quality must not alter house geometry, measurements or saved data.

Software rendering is a browser/environment condition, not proof of an app-triggered renderer fallback. Record the QA browser version, renderer and launch configuration. Run separate hardware and software/unavailable-context cases. Chromium documents the software fallback behavior in its [SwiftShader guide](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/swiftshader.md).

## 3. Medium priority: report capture forces synchronous GPU readback

**Evidence:** `src/scene/StudioScene.tsx:1233–1273`, especially line 1266, renders each architectural view and immediately calls `gl.readRenderTargetPixels`. Instrumentation recorded ten `readPixels` calls from that exact production call path. None occurred before report generation in the instrumented run. This is a concrete synchronization point consistent with a readback stall warning, but does not explain a warning occurring before any export by itself. Browser screenshot/compositing activity also needs to be distinguished from app calls in the original QA trace.

**Proposed fix:** use the installed Three.js `readRenderTargetPixelsAsync` API. Restore the normal render target, clipping, visibility and material state before yielding to interactive frames; retain the capture target until its readback completes and dispose it on every exit. Protect concurrent captures and restore temporary sun state with `finally`. Expose progress and cancellation; the toolbar currently creates an AbortController without retaining it for cancellation (`src/App.tsx:77`).

Remove `preserveDrawingBuffer` from the plot after verifying all capture consumers. The report already uses an offscreen target. Interior PNG export reads the visible canvas at `src/interior/InteriorEditor.tsx:936`, so it must first be converted to an explicit render-and-capture path. Merely disabling preservation there could produce blank exports. See the [Three.js WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer.html) for asynchronous readback and compilation.

**Validation:** capture all ten images, cancel mid-report, navigate during capture, and simulate a capture failure. Verify decoded images, restored viewport state, and no remaining report target or blob URL leaks.

## 4. Unconfirmed: INVALID_ENUM from activeTexture

No application code directly calls `activeTexture`; the installed Three.js renderer manages texture units. Instrumentation observed no invalid unit arguments on this GPU. Counting the total textures in the scene does not establish sampler overflow in a draw.

**Proposed next step:** reproduce in the original QA environment and capture the first invalid argument, stack, active material/program and both fragment/combined texture limits. Check shader-link diagnostics and any preceding Three.js texture-unit warning. The [WebGL specification](https://registry.khronos.org/webgl/specs/latest/1.0/) defines the valid texture-unit enum range. If a specific material exceeds its sampler budget, simplify that material or pack maps; if a renderer/driver bug is demonstrated, test a targeted dependency or driver fix. Do not clamp unit values, suppress the message, or claim a dependency upgrade fixes an unidentified cause.

## 5. Medium priority: performance regression test misses these warnings

`tests/rendering-performance.spec.ts:17` records only `pageerror`, so WebGL console errors and warnings can escape this test. It permits up to 45 seconds for first draws and idle settling and exercises tools only after settling. It therefore cannot prove startup responsiveness. `tests/browser-v2.spec.ts` captures console errors in several cases, but not warnings.

**Proposed fix:** collect console warnings/errors with narrowly defined expectations for the chosen renderer. Exercise MCP Tools, Length, Area and Sun while initial assets load, as well as after idle. Record browser/GPU details, maximum long task, click-to-visible-result latency and capture duration. Use separate agreed budgets for hardware and software cases. Keep the existing zero-idle-draw assertion and test unavailable WebGL without losing access to the HTML tools.

Prioritize grass generation and reduced-quality startup first, then asynchronous report capture. Keep the invalid-enum item open until its original environment produces actionable evidence.
