# ProjectV2 Spatial Editor

[Open the deployed planner](https://piotrnowakowski.github.io/House_Web_MCP/)

This is a WebMCP-native spatial editor for early building, site and landscape planning. The clean-break `ProjectV2` model represents buildings as storeys, shared slabs, wall graphs, polygonal spaces, real openings, roofs, platforms and linked ceiling finishes. It does not read V1 projects.

The bundled demo uses the Zielonki site evidence for parcels `54/3 + 55/3 + 58/3`, agricultural context, terrain, geotechnical constraints, climate and planting guidance. See the [Zielonki knowledge bank](knowledge-bank/zielonki/README.md).

The climate panel shows representative temperature averages for every month split into local-time night (00–06), morning (06–12), day (12–18) and evening (18–24). These conceptual day-part values are derived from the editable monthly mean minimum and maximum; they are not hourly weather-station observations. Selecting a month also changes the scene's seasonal lighting.

The planting guide separates productive and landscape recommendations. Its productive catalogue includes tomatoes, potatoes, cucumbers, apples, sour cherries, pears and plums, with planting/harvest windows and site-specific cautions. A dedicated soil-analysis section distinguishes documented ground observations from unknown horticultural properties, lists the laboratory and drainage checks still needed, and gives conservative raised-bed and orchard-mound preparation principles.

The default modern-barn project also includes a ready kitchen-garden set: three timber raised beds planted with tomatoes, potatoes and cucumbers. Use **Garden fixtures** in the viewport to focus the camera on the set, place another complete set or add individual structures and crop rows. Fixtures are semantic, selectable project objects rather than decorative canvas-only geometry.

This is a concept tool, not construction documentation or structural, planning, geotechnical or horticultural advice.

## Spatial and viewer stack

- React Three Fiber is the only renderer and render loop.
- That Open Components uses the existing R3F scene, WebGL renderer and canvas through a non-owning world bridge. Its `OrthoPerspectiveCamera` is the active camera. Length uses two ground-point clicks; area uses a drag-sized rectangular ground overlay. Edit, length, area, section and plan modes are mutually exclusive; the unused angle mode is excluded.
- Manifold runs in a Web Worker and generates semantic slab and wall meshes. Door/window boxes are subtracted as real voids. Results are revision-checked, transferable and cached by semantic input.
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

Each drawing is rendered sequentially at 960×640, annotated with title, north, scale and building labels, and displayed from an in-memory PNG Blob. Object URLs are revoked when a report is replaced, closed or the app unmounts. The WebMCP JSON contains only view descriptors and local-metre placement numbers—never data URLs, Blob URLs or binary image content. Reports do not change the project revision and can target an uncommitted ghost variant.

## Run and verify

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Verification:

```bash
npm test
npm run build
npm run test:e2e
```

The browser test uses installed Chrome. It checks one canvas, runtime WASM, two-click length measurement, drag-to-size rectangular area measurement, removal of the angle tool, the ready garden-fixture set, live WebMCP fixture discovery, the climate day-part view, the planting and soil guide, the ten-sheet architectural set, placement data, report cleanup, zero page/console errors, and the same report against an uncommitted moved-building variant.

## WebMCP tools

Use **MCP Tools** in the application to inspect the registered catalogue. The panel loads the generated [`webmcp-tools.json`](public/webmcp-tools.json) manifest and supports full-text search across tool names, titles and prompts. Each tool exposes its complete structured prompt, the exact Draft-7 input schema generated from runtime Zod validation, a valid example input and its documented result shape. The same schema registry drives runtime registration and manifest generation.

| Tool | Purpose |
| --- | --- |
| `get_project_state` | Read summary, site, structure, landscape or full V2 state |
| `propose_site_update` | Change site boundary or north |
| `propose_terrain_update` | Change terrain elevation controls |
| `propose_building_update` | Add, remove, move, rotate or restyle a building |
| `propose_storey_update` | Add/remove a storey or change clear height |
| `propose_slab_update` | Edit one shared slab identity |
| `propose_space_update` | Edit a polygonal space or linked lowered ceiling |
| `propose_wall_update` | Edit a shared wall graph edge |
| `propose_opening_update` | Add/remove/move/resize a wall-hosted door or window |
| `propose_roof_update` | Edit flat, gable or hip roof parameters |
| `propose_platform_update` | Edit a space-hosted mezzanine platform |
| `propose_landscape_update` | Edit a straight-edged landscape polygon |
| `propose_plant_update` | Edit a terrain-supported plant |
| `list_garden_fixtures` | Read the ready structure and crop-fixture catalogue |
| `propose_garden_fixture_update` | Add, remove, move or rotate one semantic garden fixture |
| `propose_garden_fixture_set` | Place the complete kitchen garden or one crop-filled raised bed, including “next to the previous bed” placement |
| `propose_climate_update` | Edit one climate month, including night/morning/day/evening averages |
| `show_structure_views` | Open visible architectural drawings and return placement data |
| `run_seasonal_analysis` | Return day-part temperature averages and V2 seasonal planning signals |
| `compare_variants` | Compare ghost metrics and validation issues |
| `request_apply_variant` | Wait for explicit Apply/Reject confirmation |
| `discard_variant` | Remove an uncommitted variant |
| `undo_last_change` | Restore the previous committed V2 project |

Every modifying tool creates an immutable ghost variant. Only explicit human approval commits it. The centralized [WebMCP prompt catalog](prompts/webmcp-tools.ts) uses role, task, input, tools, output and example-output blocks aligned with the runtime Zod schemas. Vite regenerates the JSON manifest during development startup and every production build.

## Scope

The editor is desktop-first and deliberately excludes accounts, a backend, an embedded LLM, cost estimation, structural simulation and legal compliance. Placement coordinates are local `{x,z}` metres; survey coordinates and setback claims are not included in architectural report results.

## License

MIT. See [LICENSE](LICENSE).
