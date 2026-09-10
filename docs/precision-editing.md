# Precise editing and measurements

Open **Edit & measure** in the plot's right inspector, or **Edit** in the mobile bottom bar. Select something in the scene or use **Choose an element** to reach windows and furniture obscured by the roof.

- **Move house** exposes position, rotation and 1 cm / 10 cm / 1 m adjustment steps. Apply position commits the draft as one undo entry; Cancel adjustment restores the displayed values. Positions use plot coordinates. In zielonki v2 the enabled linked-features checkbox also moves the carport, terrace and entrance path, and adjusts the house-side driveway edge. The road entrance stays fixed. Check the resulting approach after moving. The existing scene gizmo moves only its selected object.
- Windows and doors have an exact centre offset along their host wall, width, height, sill height and 1 cm offset buttons. Save applies the change only if it fits. Side clearances show the distances between the opening edges and wall ends.
- Partitions have length, start/centre/end length anchors, endpoint coordinates, thickness and height. Save updates connected walls, room boundaries and hosted openings atomically. Invalid shapes are rejected. The exterior outline remains protected in this editor; changing the building envelope requires the existing plot geometry tools.
- Furniture retains its catalogue dimensions and separate size editor. Position, elevation and rotation can be entered precisely. Coordinates are local to the building floor. Group moves produce one undo entry; locked edits are rejected. Open **House interior** for direct furniture dragging in 2D or 3D. Garden objects also have precise position controls.
- **Measure distance** accepts two scene points or exact X/Y/Z endpoints. It shows the three-dimensional model distance to 0.001 m, plus millimetres. Edit endpoint values and press **Apply endpoints**. Scene snapping and dragging measurement endpoints use the same values. Measurements are temporary view tools, not saved project entities; survey accuracy is unchanged.

**Undo / Redo** reverses completed edits. Changes use the existing autosave and per-origin project storage. A pending proposal must be applied or rejected before a direct edit. Browser edits still need explicit capture into tracked project data before a release; they do not automatically commit to Git.

WebMCP `building.update` supports optional `moveLinkedFeatures` on a `move` of `house/main` in `project/zielonki-v2`. It uses the same domain operation and validation as the panel, while preserving the proposal Apply/Reject workflow.

Run `node scripts/audit-precision-editor.mjs --url <preview-or-public-url> --output output/precision-editor` for isolated desktop/mobile coverage of building and linked-feature movement, undo/redo, draft cancellation, opening movement, partition shortening, furniture positioning, exact measurements and reload persistence.
