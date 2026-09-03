# House & Garden Spatial Editor

**A WebMCP-native 3D workspace where people and browser agents design a house, site and garden together.**

[Open the live planner](https://piotrnowakowski.github.io/House_Web_MCP/) · [Inspect the generated WebMCP manifest](https://piotrnowakowski.github.io/House_Web_MCP/webmcp-tools.json) · [Read the source](https://github.com/piotrnowakowski/House_Web_MCP)

No account, credentials or paid service is required. The project was created during the August 25–September 3, 2026 WebMCP Challenge submission period and is available under the MIT licence.

## What it does

Early house and garden planning is spatial: people need to see the building, terrain, rooms, openings, planting and seasonal effects together. A normal chat can describe a change, but it cannot safely understand or edit the exact objects in a live 3D design.

This editor gives both the person and their browser agent access to one semantic `ProjectV2` model. A person can navigate and edit the 3D scene directly. An agent can inspect the same project through 34 schema-described WebMCP tools, propose coordinated changes and open visible architectural reports. The result remains an uncommitted ghost variant until the person explicitly applies or rejects it.

The page opens on a start screen. Continue the last saved session, load the bundled Zielonki house study, or create a new terrain from a short form (name, width and depth in metres, north angle, coordinates and timezone). A new terrain is an empty plot: the inspector offers **Add a house**, the modern barn preset and every WebMCP proposal then work on it, and each project is autosaved separately so the **Projects** button in the top bar switches between them.

The bundled Zielonki project demonstrates:

- a two-storey modern-barn house with semantic storeys, slabs, spaces, walls, openings, finishes and roof;
- terrain, site boundary, landscape zones, plants and a ready three-bed kitchen garden;
- climate and planting guidance with documented evidence, unknowns and cautions kept separate;
- measurements and a ten-sheet architectural set containing site plan, elevations, plans, sections and axonometric view;
- grouped, transactional changes that can be reviewed as one proposal instead of a sequence of partly applied edits.

This is an early concept-exploration tool, not construction documentation or structural, planning, geotechnical or horticultural advice.

## Why WebMCP is the right interface

A 3D canvas is difficult for an agent to operate through DOM guessing or screen coordinates. WebMCP lets the page expose stable semantic references such as `house/main`, exact metre-based geometry, validation rules and deliberate operations such as `propose_storey_update` or `propose_planting_area`.

That creates a better experience in three ways:

1. **Accurate context:** the agent reads structured project state instead of inferring geometry from pixels.
2. **Meaningful actions:** tools call the same domain commands as the human interface, so validation and results stay consistent.
3. **Human control:** modifying tools create immutable ghost variants. The agent can compare them, but only a visible Apply/Reject decision commits one. Committed work can still be undone.

This makes collaboration possible that is awkward in either a conventional editor or a text-only chat: a person can describe an outcome, let the agent translate it into several exact spatial operations, inspect the resulting design in 3D and retain the final decision.

## Human-agent journey

```text
Person states an intent
        ↓
Agent reads semantic project state and constraints
        ↓
Agent creates one tool proposal or transactional change set
        ↓
Editor renders a visible ghost variant and comparison
        ↓
Person applies or rejects it → committed history remains undoable
```

The person can continue editing through the UI at every stage. WebMCP is not a separate chatbot or parallel data model; it is an agent-facing interface to the live application.

## Try it as a judge

1. Open the [live planner](https://piotrnowakowski.github.io/House_Web_MCP/) in ChatGPT's in-app Browser, which supports WebMCP by default. Alternatively, use Google Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing`, then restart Chrome.
2. Confirm that the 3D scene loads. The app requires no login and stores project state locally in IndexedDB.
3. Open **MCP Tools** in the top toolbar to inspect every registered tool, prompt, JSON Schema, example input and result shape.
4. Give the browser agent one of these prompts:

   - `Inspect this project and summarize the house, garden fixtures and important site constraints.`
   - `Create a ghost variant with a hornbeam boundary 1.2 metres inside the site, spaced every 5 metres. Do not apply it.`
   - `Extend the upper-storey footprint with a new wing, compare the proposal with the current design and ask before applying it.`
   - `Move the complete kitchen garden as one grouped change, but leave it for my approval.`
   - `Show the complete architectural set for the main house.`
   - `How much afternoon sun does the terrace get on 21 September? Then propose extending the upper storey over the wing and tell me how that changes it.`

5. For a modifying request, verify that the committed revision does not change until **Apply** is selected. Reject the proposal or apply it and use `undo_last_change` to restore the earlier committed project.

## How WebMCP is implemented

The app uses WebMCP's imperative API. At startup it registers the generated tool catalogue with the current document:

```ts
const modelContext = document.modelContext
const controller = new AbortController()

Promise.all(
  webMcpTools.map((tool) =>
    modelContext.registerTool(tool, { signal: controller.signal }),
  ),
)

return () => controller.abort()
```

The implementation lives in [`src/services/webmcp.ts`](src/services/webmcp.ts). A centralized Zod registry in [`src/services/webmcpDefinitions.ts`](src/services/webmcpDefinitions.ts) generates the exact Draft-7 input schemas used by both runtime registration and the public [`webmcp-tools.json`](public/webmcp-tools.json) manifest. Runtime descriptions use the concise task block so every tool stays within [Chrome's recommended description budget](https://developer.chrome.com/docs/ai/webmcp/secure-tools#set-character-budgets); the public manifest retains the complete role, task, input, tools, output and example contract for inspection.

Read tools return structured state or open a visible in-page report. Modifying tools call the same commands used by the interface and return an immutable variant reference. Transactional tools stage several typed operations against an explicit base revision before finalizing one reviewable variant. An `AbortController` removes registrations when the application unmounts.

## Challenge judging fit

| Criterion | Evidence in this project |
| --- | --- |
| WebMCP leverage | 34 non-trivial, schema-validated tools operate on live semantic spatial state; read, proposal, comparison, grouped transaction, approval and undo flows are all implemented. |
| Execution | Public no-login deployment, one coherent 3D editor, real geometry, local persistence, visible reports and automated browser coverage. |
| Potential impact | Helps homeowners and early-stage design collaborators turn broad intent into inspectable house-and-garden alternatives before engaging professional design and engineering services. |
| Creativity and ambition | Combines a semantic building model, landscape and seasonal context, agent-authored spatial variants and explicit human approval in one browser-native workspace. |

## Zielonki demonstration data

New terrains created from the start screen reuse the Zielonki monthly climate normal with the coordinates and timezone entered by the person (the sun position follows those), and start with an empty knowledge base that says so.

The bundled demo uses the Zielonki site evidence for parcels `54/3 + 55/3 + 58/3`, agricultural context, terrain, geotechnical constraints, climate and planting guidance. See the [Zielonki knowledge bank](knowledge-bank/zielonki/README.md).

The climate panel shows representative temperature averages for every month split into local-time night (00–06), morning (06–12), day (12–18) and evening (18–24). These conceptual day-part values are derived from the editable monthly mean minimum and maximum; they are not hourly weather-station observations. Selecting a month also moves the scene sun to the middle of that month; the sun widget in the viewport scrubs through the day and the year.

The planting guide separates productive and landscape recommendations. Its productive catalogue includes tomatoes, potatoes, cucumbers, apples, sour cherries, pears and plums, with planting/harvest windows and site-specific cautions. A dedicated soil-analysis section distinguishes documented ground observations from unknown horticultural properties, lists the laboratory and drainage checks still needed, and gives conservative raised-bed and orchard-mound preparation principles.

The default project includes three timber raised beds planted with tomatoes, potatoes and cucumbers. Use **Garden fixtures** in the viewport to browse and place outdoor furniture—including a teak dining set, lounge set, bench, sun lounger and cantilever parasol—or add individual garden structures and crop rows. Fixtures are semantic, selectable project objects rather than decorative canvas-only geometry, and the same catalogue is available through WebMCP.

## Spatial and viewer stack

- React Three Fiber is the only renderer and render loop.
- That Open Components uses the existing R3F scene, WebGL renderer and canvas through a non-owning world bridge. Its `OrthoPerspectiveCamera` is the active camera. Length uses two ground-point clicks; area uses a drag-sized rectangular ground overlay. Edit, length, area, section and plan modes are mutually exclusive; the unused angle mode is excluded.
- The sun is a real solar position (NOAA formulas) for the site's latitude, longitude, timezone and true north. The directional light, the sun-path arc, the compass rose, the sun-hours heatmap, the `sun-study` report view and the `run_sunlight_analysis` tool all derive from the same functions, so shadows on screen and numbers returned to agents agree. Sun hours are computed analytically against walls, slabs, roof wings, tree canopies and garden fixtures, and a `planting.sun-mismatch` warning flags sun-loving planting that gets under six hours of direct sun between 09:00 and 17:00 on 21 June.
- Manifold runs in a Web Worker and generates semantic slab and wall meshes. Door/window boxes are subtracted as real voids. Results are revision-checked, transferable and cached by semantic input. The worker also emits planar UVs in metres, so textures tile at true physical scale.
- A texture library of twelve Poly Haven CC0 scans (about 21 MB) dresses walls, ground zones, terrain, raised beds and the barn's interior floors at true physical scale. Every wall finish and every landscape zone can pick its scan from a thumbnail picker in the inspector, or keep the default for its material or zone kind, or go back to a flat colour. Agents read the same library with `list_textures` and choose with `textureId` on `propose_wall_finish_update` or a landscape `set-surface`. The scans a project draws load first; the rest of the library preloads in idle time so a later pick shows at once. The wall colour picker becomes a light tint over a textured finish.
- `three-mesh-bvh` builds and disposes acceleration structures with generated geometry.
- Rapier supplies fixed semantic colliders and constrained editing previews; it is not used for structural analysis or falling buildings.
- IndexedDB autosaves only under the V2 key. Old records remain untouched and unread.

One intermediate slab is both the upper floor and the lower ceiling. Lowered ceilings are separate linked finish elements. Polygonal spaces reuse coincident wall edges, and curved, self-intersecting, zero-area and out-of-site footprints are rejected.

There is no project-file import, download/export, IFC exchange or Fragments exchange.

## Architectural reports

`show_structure_views` opens an ephemeral, visible in-page report. The default architectural set contains:

- site plan;
- north, south, east and west elevations relative to site north;
- axonometric view;
- every selected-building storey plan;
- longitudinal and transverse centreline sections.

A custom `sun-study` view renders a shadow plan for a local date and time.

Each drawing is rendered sequentially at 960×640, annotated with title, north, scale and building labels, and displayed from an in-memory PNG Blob. Object URLs are revoked when a report is replaced, closed or the app unmounts. The WebMCP JSON contains only view descriptors and local-metre placement numbers—never data URLs, Blob URLs or binary image content. Reports do not change the project revision and can target an uncommitted ghost variant.

## Run locally and verify

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`, then pick **Zielonki house study** on the start screen (or **New terrain** to plan your own plot). WebMCP is available when the page runs in ChatGPT's in-app Browser or in Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.

Verification:

```bash
npm test
npm run build
npm run test:e2e
```

The browser test uses installed Chrome. It checks the start screen (Zielonki study, new terrain with add-a-house, continue after reload, switching projects), one canvas, runtime WASM, length/area/semantic-height measurement, the ready garden-fixture set, live WebMCP storey-extension, planting-area, grouped-change and height calls, the climate day-part view, the planting and soil guide, the sun widget and sun-hours heatmap, live sunlight and sun-study tool calls, the ten-sheet architectural set, placement data, report cleanup, zero page/console errors, and the same report against an uncommitted moved-building variant.

## WebMCP tools

Use **MCP Tools** in the application to inspect the registered catalogue. The panel loads the generated [`webmcp-tools.json`](public/webmcp-tools.json) manifest, which is rebuilt from the runtime Zod schemas and the structured prompts on every build, and shows the catalogue budget.

ChatGPT's browser accepts at most **5000 tokens** for a site's whole tool catalogue (names, descriptions and input schemas together), so the catalogue is eleven tools whose registered schemas stay compact (about 12.6k characters, about 3.6k tokens). Every operation that used to have its own tool is now an operation type of `propose_change`; Zod still validates every field at execution and returns `field: problem` messages, only the JSON Schema sent to the browser is lighter.

| Tool | Purpose |
| --- | --- |
| `get_project_state` | Read summary, site, structure, landscape, one object by ref, or full V2 state |
| `get_site_knowledge` | Read the site evidence bank by section; flagged as untrusted content because it summarises external documents |
| `get_proposals` | List proposal history and drafts, diff one ghost variant against the project, or compare up to four variants |
| `list_catalog` | Read the garden-fixture catalogue, the CC0 texture library, or the operation reference with required and optional fields per type |
| `measure_height` | Read semantic or free vertical height with local and absolute elevations |
| `run_analysis` | Seasonal day-part temperatures, daylight, sunrise and sunset, or direct sun hours for a zone, plant, fixture, point or the site, on the committed project or a ghost variant |
| `show_structure_views` | Open visible architectural drawings, including sun studies, and return placement data |
| `set_viewer_state` | Explode rooms, open a storey plan, select an object or move the viewer sun, without touching the revision |
| `propose_change` | Create one ghost variant from a list of typed operations (see below) |
| `manage_change_set` | Create, populate, finalize or discard a transactional draft selected by `action` |
| `manage_variant` | Request explicit Apply/Reject review, discard an uncommitted variant, or undo the last committed change, selected by `action` |

Operation types accepted by `propose_change` and `manage_change_set` (`list_catalog` with `catalog: operations` returns the same reference with every field):

| Operation | What it does |
| --- | --- |
| `site.update` | Change site boundary or north |
| `terrain.update` | Change terrain elevation controls |
| `building.update` | Add, remove, move, rotate or restyle a building |
| `storey.update` | Add/remove/resize a storey, including an atomic existing-footprint extension |
| `slab.update` | Edit one shared slab identity |
| `space.update` | Edit a polygonal space or linked lowered ceiling |
| `wall.update` | Edit a shared wall graph edge |
| `wall.finish` | Change one wall, one gable wall or all exterior walls to a material, colour and optional scan |
| `wall.opening-layout` | Apply a deterministic façade preset to one wall |
| `opening.update` | Add/remove/move/resize a wall-hosted door or window |
| `roof.update` | Update, add or split semantic roof segments, including footprints, ridge axes and typed junctions |
| `platform.update` | Edit a space-hosted mezzanine platform |
| `landscape.update` | Edit a straight-edged landscape polygon or set its ground scan |
| `plant.update` | Edit a terrain-supported plant |
| `planting.area` | Create one deterministic boundary, line or polygon planting scheme |
| `garden-fixture.update` | Add, remove, move or rotate one fixture |
| `garden-fixture.preset` | Place a coordinated raised-bed preset |
| `climate.update` | Edit one climate month, including night/morning/day/evening averages |

Every modifying tool creates an immutable ghost variant. Only explicit human approval commits it. The centralized [WebMCP prompt catalog](prompts/webmcp-tools.ts) holds every tool prompt, field description and the operation reference; the manifest test keeps the registered catalogue, the prompts and the budget in step.

## Scope

The editor is desktop-first and deliberately excludes accounts, a backend, an embedded LLM, cost estimation, structural simulation and legal compliance. Placement coordinates are local `{x,z}` metres; survey coordinates and setback claims are not included in architectural report results.

Project data stays in the browser's local IndexedDB. The application makes no runtime weather request and transmits no design state to an application backend.

## Assets and third-party software

All necessary source, generated manifests and runtime assets are included in this repository. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for the climate-data basis, the Poly Haven CC0 material scans and open-source runtime libraries. No third-party 3D models, photos, logos or music are bundled.

## License

MIT. See [LICENSE](LICENSE).
