# House_Web_MCP

[Open the live 3D planner](https://piotrnowakowski.github.io/House_Web_MCP/)

House_Web_MCP is a WebMCP-native 3D workspace for early home, plot, garage,
and garden planning. A person can edit the model directly, while a browser
agent such as ChatGPT or Codex can inspect the same live project and propose
reversible 3D variants through semantic tools.

This is a concept exploration tool. It does not produce construction
documentation and does not claim compliance with planning, structural,
horticultural, or building regulations.

## What works

- Polygonal plot with an interpolated height field
- Parametric rooms, multiple floors, room-specific ceilings, mezzanines,
  attached or integrated garages, openings, and three roof families
- Technical and realistic presentations of one shared 3D model
- Full visible UI rendered inside WebGL: tool rail, inspector, seasonal status,
  variants, confirmation, history, and export controls
- Direct scene selection for rooms, garden zones, and plants, with a contextual
  inspector and transform gizmos anchored to the selected object
- Translate, scale, and rotate snapping, hover feedback, locked-object states,
  keyboard control, and an in-canvas shortcut guide
- Editable Zielonki climate preset, procedural vegetation, monthly sunlight,
  water-balance, frost, foliage, and bloom signals
- Project-owned seamless garden materials with physical-scale tiling, bump and
  roughness response, anisotropic filtering, irregular rain-garden water,
  instanced surface detail, textured bark, and layered seasonal canopies
- Ghost variants, validation, human approval, discard, and undo
- IndexedDB autosave plus validated JSON import/export, PNG, and GLB export
- Sixteen native WebMCP tools registered with
  `document.modelContext.registerTool()`

## Run locally

Requirements: Node.js 22 or later and npm.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173` in the ChatGPT in-app browser, or in Chrome 149+
with `chrome://flags/#enable-webmcp-testing` enabled.

Production checks:

```bash
npm test
npm run build
npm run preview
```

The repository includes both `vercel.json` for Vercel and a tested GitHub
Pages workflow. The Pages build sets `/House_Web_MCP/` as Vite's base path;
local and Vercel builds remain rooted at `/`.

## Recommended agent demo

1. Ask the agent to call `get_project_state` before changing anything.
2. Say: "Add an upper floor, lower the living-room ceiling, add a mezzanine,
   attach a two-car garage, and propose a low-water garden. Preserve the terrace
   and the old apple tree."
3. Inspect the translucent variants in technical and realistic modes.
4. Ask the agent to run a January, April, July, and October analysis.
5. Ask it to request application of the chosen variant.
6. Confirm or reject inside the 3D canvas, then demonstrate undo.

## WebMCP tools

| Tool | Behavior |
| --- | --- |
| `get_project_state` | Reads summary, structure, garden, or full project state |
| `propose_plot_update` | Proposes plot, north, or terrain changes |
| `propose_building_update` | Proposes building position or roof changes |
| `propose_floor_update` | Adds, removes, or changes a floor |
| `propose_room_update` | Adds, moves, resizes, removes, or changes a room ceiling |
| `propose_mezzanine_update` | Adds, resizes, or removes a mezzanine |
| `propose_garage_update` | Adds or modifies an integrated or attached garage |
| `propose_garden_plan` | Generates a goal-driven seasonal garden variant |
| `propose_garden_update` | Changes one zone or plant |
| `propose_climate_update` | Edits one month of the local climate profile |
| `run_seasonal_analysis` | Returns daylight, water, frost, foliage, and bloom signals |
| `compare_variants` | Compares metrics and validation reports |
| `request_apply_variant` | Waits for explicit human confirmation in the canvas |
| `discard_variant` | Discards an uncommitted proposal |
| `undo_last_change` | Restores the previous committed project |
| `request_export` | Waits for approval before JSON, GLB, or PNG export |

The adapter uses the current `document.modelContext` imperative API, JSON
Schema inputs, `readOnlyHint`, `AbortSignal`, and an `AbortController` for
registration lifetime. It does not ship a production polyfill or use the
non-standard `outputSchema` extension. When the native API is absent, manual
editing remains available and the canvas reports `WebMCP unavailable`.

## Architecture

All manual and agent operations pass through the same immutable command bus.
A modifying WebMCP call executes its command against a cloned project and
creates a `VariantModel`; it never commits directly. `request_apply_variant`
keeps its tool Promise pending while the user reviews the ghost geometry and
resolves only after Apply or Reject.

The versioned `ProjectV1` model stores semantic references such as
`house/main`, `floor/ground`, and `room/living-room`. Three.js objects,
temporary renderer identifiers, and UI state never enter agent-facing project
data.

## Keyboard shortcuts

- `1` / `2`: technical / realistic
- `T` / `S` / `R`: translate / scale / rotate
- `F`: explode / assemble floors
- `[` / `]`: previous / next month
- `Ctrl+Z`: undo
- `Esc`: close help and clear selection
- `?`: open / close the in-canvas controls guide

## Climate and limitations

The bundled Zielonki values are editable, illustrative inputs derived from the
ERA5/ERA5-Land variable set exposed by Open-Meteo. They are not official local
measurements. See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

The application is desktop-first and intentionally has no account system,
backend, embedded LLM, mobile editor, cost estimator, or legal compliance
engine.

## License

MIT. See [LICENSE](./LICENSE).
