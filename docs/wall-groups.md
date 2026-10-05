# Wall groups

In **House interior → Edit → Select walls**, tap partitions in the scene or select them from the wall list. Multiple selection only selects: it does not start an accidental drag. Desktop users can also Shift-click partitions. All selected walls are highlighted.

Choose **Group walls** to save the group and leave selection mode. On mobile this closes the panel. Drag any member to translate the entire set in X/Z, preserving relative positions, lengths and opening offsets. Finish selecting also allows a temporary set to move together without saving a group. Four 10 cm movement buttons provide a button alternative. **Ungroup walls** removes the saved association without moving geometry.

A single gesture is one undo entry. Grouping, ungrouping and movement support undo/redo and autosave/reload. Escape or interrupted gestures cancel the movement. Rooms and connected endpoints update atomically; invalid geometry, locked walls/rooms, floor void intersections, opening fit and exterior-envelope changes are rejected. Partitions joined to the exterior may only move in directions that keep the envelope fixed. Furniture inside affected rooms does not automatically become part of a wall group.

The optional `WallModel.groupRef` is additive, preserving old projects. Domain commands `interior.update` actions `wall-group` (`wallRefs`, nullable `groupRef`) and `walls-move` (`wallRefs`, `delta`) use the same validation for UI and WebMCP proposals. Existing group membership is expanded before an edit; shared endpoints are mapped once from their original positions and final topology is validated once.

Validation: `npx vitest run src/domain/wallGroups.test.ts src/interior/directManipulation.test.ts src/domain/interiorLayout.test.ts`; `APP_URL=http://127.0.0.1:5173 npx playwright test tests/wall-groups.spec.ts tests/direct-manipulation.spec.ts --config=playwright.interior.config.ts`. Browser tests use disposable profiles and cover mouse/touch grouping, rigid movement, undo/redo, reload and ungrouping.
