# Interior editor

This branch extends the furnished house snapshot with an IKEA starter catalogue, room-layout editing, contextual controls and a canvas-first mobile interface. [4Plan's public interface](https://4plan.app/) informed visual browsing and contextual editing. Native 4Plan gestures were not tested or copied.

## Run the isolated implementation

Use Node 22.12 or newer (validated with Node 24), run `npm ci`, then `npm run dev:interior`. Open **http://127.0.0.1:5187**, load **Zielonki house study**, and choose **House interior**. The strict port prevents silently moving to an occupied origin. IndexedDB, favourites and camera storage on this origin are separate from the other checkout's development origin.

Worktree: `C:\Users\piotr\Documents\ChatGPT\Web_MCP-ikea-interior`, branch `codex/ikea-interior-mobile`. Commit `4fac4a6` is a separate snapshot of the original checkout's unfinished tracked changes and required untracked `RoofTerrace.tsx` / `zielonkiTerrace.test.ts`. Implementation starts after that commit. The original checkout, branch and index were not used for implementation.

## Editing

| Task | Controls and behavior |
| --- | --- |
| Navigate | 2D Plan, 3D Cutaway, Room view; Fit; More → building/floor, Fit house or selected room. Cameras are remembered per project, building, floor and view for the session. |
| Add furniture | Add → IKEA or generic → search/category/favourites → choose a configuration. Catalogue closes and a correctly sized placement outline appears. Tap the floor or use Place here. Rotate or Cancel before committing. |
| Move | Select and drag. On touch, tap to select first, then drag the selected object. The camera is suspended during manipulation. Interrupted pointers, a second finger, Escape, lost capture, window blur or a hidden document cancel the draft. |
| Precision | Edit → position, elevation and rotation. Dimensions appear as a compact readout with a pencil icon that opens a separate modal. All catalogue objects start at their original size; the modal allows each dimension to increase, or return to the catalogue minimum. Cancel/Escape discards the draft; Save dimensions commits once. Sliders open only for the selected property. IKEA finishes remain tied to the article. |
| Multiple objects | Shift-select on desktop or Edit → Select multiple objects. More offers Group, Ungroup, Lock, Unlock, Duplicate and Delete. A group's translation/rotation/elevation changes commit atomically. |
| Replace | Select → More → Replace furniture. The new product retains the old location and angle; incompatible size/height is rejected. |
| Standard / tall cabinets | Select → Edit → IKEA height configuration. PAX, PLATSA, BILLY, BILLY/OXBERG, IVAR and METOD offer verified alternatives. The selection swaps the article and native dimensions in one history entry; placement/grouping remain. The remaining ceiling gap is shown. Alternatives that exceed clear height or PAX assembly clearance are disabled. Both configurations also appear in Add. |
| Rooms | Edit → Rooms on this level → name, usage, dimensions and Draw partition. In plan view, choose two room walls to draw a straight partition. Select an internal partition and remove it to merge its two rooms. Remove its openings first. |
| Connected walls | Select a wall → exact endpoints/thickness/height. Shared vertices, adjacent boundaries and hosted opening offsets update together. Exterior geometry stays fixed; use plot tools to change the envelope. |
| Openings | Select a wall → Add door/window. Select an opening to change centre offset, width, height, sill, hinge and swing, or remove it. Openings must fit the wall without overlapping each other. |
| Finishes | Room → floor/ceiling; wall → left/right face. Presets include paint, wood, tile, concrete, linen and jute. Rotation and tile size are in degrees/metres. Left/right follow the wall's start-to-end direction. |
| Measure | Two points with snap preview and draggable endpoints. More controls grid size/alignment independently. Selected furniture shows distances to the nearest two walls. |
| History | Undo/redo, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y. A completed drag or group edit is one history entry. Cancel makes no history entry. History is session-only; saved project geometry survives reload. |

Arrow keys nudge selected furniture by the grid step (Shift for a larger step); R rotates by 15 degrees, Delete removes and Escape cancels the active tool. Locked objects reject edits through both UI and WebMCP.

Existing saved furniture keeps its fitted dimensions when loaded or moved. New placements and dimension edits cannot go below the catalogue reference size. Enlarged IKEA instances are custom planning sizes; their manufacturer reference and original asset remain unchanged. The displayed model, placement footprint, collision checks and exports use the placed dimensions.

Room dimensions are inside-face measurements. Numeric resizing moves one available straight internal side while keeping the opposite side anchored. Irregular rooms, fragmented bounding sides, or dimensions bounded by two exterior walls may require editing the connected partition endpoints instead. The UI reports the unsupported resize rather than changing the envelope.

## Mobile behavior

Both views use `100dvh` and safe-area insets. Only the 56 px top strip and 60 px bottom bar remain open by default. The bottom actions are Add / Edit / Measure / More; selecting furniture replaces them with contextual actions. One dismissible sheet handles catalogue, inspector and project controls; it can close, occupy about 40% of the viewport, or expand. A landscape sheet sits at the right side. Hide controls leaves a visible restore button.

Opening panels preserves the camera. Explicit Fit uses the unobscured region. Controls have 44 px targets, accessible labels and numeric alternatives to gestures. Sheets contain their scrolling and react to `visualViewport` keyboard changes. Real iOS/Android keyboard and device-safe-area checks remain part of physical-device acceptance.

With panels closed and zero emulated safe-area insets, permanent controls occupy 116 px: **81.9%** of 360×640 and **86.3%** of 390×844 remains clear vertically. In 844×390 landscape the sheet preserves scene height; the closed controls leave 70.3% vertically. The 80%/85% portrait targets are not claimed for landscape.

## Files and autosave

More offers JSON export/import, scene PNG, a printable dimensioned SVG plan with the browser's Save as PDF option, furniture quantities with product links, and CSV export. The list includes furniture from the whole project. Printed plans describe the selected floor and are concept drawings. Duplicate project saves the current project first, then creates a separate alternative. JSON import validates the file and gives the imported project a new reference, preserving the source project.

The app reuses the existing IndexedDB autosave and project launcher. Autosave failure is shown in the interior view. Product and finish fields are additive to `ProjectV2`: old furniture needs no conversion and retains its existing generic renderer, dimensions and colours. Missing optional fields default to floor elevation, unlocked and ungrouped. Existing V1 parsing continues to migrate older projects.

## Domain and WebMCP

`interior.update` routes all edits through the shared command pipeline. Split/merge and connected-wall changes are made on a cloned project and validated before commit. Invalid boundaries, detached or overlapping openings, locked geometry, floor-void intersections and furniture above available floor/ceiling height are rejected. Rotated furniture bounds, elevation-aware overlaps, wall intersection, door swing and short clearance produce contextual warnings. Rugs below tables are valid vertical overlaps.

`list_catalog` now accepts `ikea`, `interior-generic` and `interior-finishes`. `propose_change` accepts the exact action schemas for put, remove, lock, room, split, merge, wall, opening, opening-remove and finish. These use the existing proposal/variant system. Requesting application opens Apply/Reject inside either editor. Inspecting or creating a proposal never commits it; direct editing is paused while its approval preview is open.

Example proposal operation (obtain real references with the read tools):

```json
{
  "type": "interior.update",
  "action": "finish",
  "buildingRef": "house/main",
  "storeyRef": "storey/ground",
  "targetRef": "space/living",
  "surface": "floor",
  "finish": { "presetId": "light-wood", "color": "#f3e8d3", "rotationDegrees": 90, "tileM": 1.9 }
}
```

The generated `public/webmcp-tools.json` includes the new catalogue choices and action schemas. Tool descriptions retain their existing role/task/input/output contracts and description budget.

## Implementation map and limits

- `src/domain/interior.ts`, `interiorLayout.ts`, `interiorPlacement.ts`: validated edits, shared geometry and warnings.
- `src/interior/InteriorEditor.tsx`, `InteriorPanels.tsx`, `AdaptiveSheet.tsx`: responsive editing and shared precision controls.
- `src/interior/InteriorScene.tsx`, `InteriorCamera.tsx`, `ProductModel.tsx`: R3F rendering, touch gestures, camera memory, on-demand models and retry fallback.
- `src/interior/floorGeometry.ts`: room finishes clipped against floor voids, including a void touching a room edge.
- `src/interior/interiorExports.ts`: semantic plan, furniture list and downloads.
- `src/domain/ikea-products.json`, `public/models/interior/manifest.json`: product facts and original asset provenance.

The 64 configurations each have a referenced finish/article, desktop and mobile GLBs and a rendered thumbnail. These independently authored planning studies use assembled envelopes; HEKTAR overall width and LINDBYN depth are explicitly marked estimates because the inspected manufacturer listings omit them. Collision footprints use conservative rectangles; concave empty spaces such as the chaise recess are not subtracted. Clearance warnings are local proximity checks, not whole-room route analysis. Kitchen and wardrobe models are fixed configurations, including explicitly named cabinet frames and top-unit combinations. A tall option uses its listed physical height and may leave a gap below the ceiling. No METOD/PAX configurator, live pricing/stock, native app, AR scanning, cloud collaboration or deployment is included.

See [asset sources and dimensions](ikea-assets.md) and [validation evidence](interior-validation.md).
