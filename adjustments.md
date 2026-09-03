# WebMCP adjustments implemented

These four gaps were discovered while using an agent against the live spatial model and are implemented in the current project. This record preserves the observed requests, the previous limitations and the acceptance contracts that drove the changes. Automated coverage lives in the domain, WebMCP and real-browser test suites.

## Extend an existing partial upper storey

### Observed request

The user asked the agent to add a second storey over the wing of the L-shaped building that currently has only one storey.

### Previous limitation

The existing WebMCP tools cannot express this as one coherent, reversible change:

- `propose_storey_update` with `action: "add"` creates another level above the existing upper storey instead of extending that upper storey sideways.
- `propose_space_update` can add a space to the existing upper storey, but it does not extend the supporting slab or increase the modeled floor area.
- `propose_slab_update` can extend the upper slab and floor-area metric, but it does not create the corresponding upper exterior walls, space boundary, or roof changes.

The architectural preview exposed the incorrect third-level interpretation before approval. No test variant was applied; the committed project remained at revision 1 and 204 m².

### Implementation contract

Add an atomic WebMCP operation for extending the footprint of an existing storey, either as a new tool or a new `propose_storey_update` action. It should:

1. Target an existing `buildingRef` and `storeyRef`.
2. Accept the desired complete storey footprint or a footprint extension.
3. Update the shared slab, exterior wall graph, enclosed spaces, and roof geometry together.
4. Preserve valid existing walls and openings where possible and report any conflicts.
5. Produce one ghost variant with accurate area and height metrics.
6. Support architectural preview and validation before the user approves the variant.

### Acceptance scenario

For the current L-shaped barn, extending the existing upper storey over the uncovered 16 × 6 m wing should create a two-storey building across that wing, add 96 m² of home area, keep the result at two levels, and show complete upper walls and roof geometry in the axonometric preview.

## Create an area or line of plants

### Observed request

The user asked the agent to plant hornbeam continuously alongside the outer edge of the complete plot. As a fallback, the user accepted individual plant placement but expects WebMCP to support an area of plants directly.

### Previous limitation

`propose_plant_update` can add, remove or move only one point-based plant object per ghost variant. It cannot describe a hedge line, perimeter planting, polygonal planting bed, spacing rule or repeated plant set. Creating a perimeter plant by plant would require many sequential variants and human approvals, cannot be reviewed as one design, and risks leaving a partially completed hedge.

The editable site boundary also currently covers the `/3` construction parcels, while the `/4` agricultural parcels are context-only. A complete-plot planting tool must state which parcel set and boundary source it targets.

### Implementation contract

Add an atomic WebMCP operation such as `propose_planting_area` or extend `propose_plant_update` with line and polygon modes. It should:

1. Target a boundary, polyline or polygon using stable parcel or site references.
2. Support inward offsets, plant spacing, row count and corner treatment.
3. Accept a species or planting-palette reference and create deterministic individual plant instances.
4. Respect buildings, utilities, access routes, drainage features and required boundary clearances.
5. Return plant count, total length or area, spacing, conflicts and affected parcel references.
6. Produce one ghost variant that previews, validates, approves, rejects and undoes the complete planting scheme atomically.

### Acceptance scenario

For the Zielonki project, the agent should be able to select the outer boundary of all intended parcels, offset a hornbeam hedge inside the property by a user-approved clearance, place hornbeams at a specified spacing, handle stepped parcel edges, and show the entire perimeter hedge as one reviewable variant before committing any plants.

## Group related changes into one approval

### Observed request

Moving the three raised beds 20 m farther from the house required separate WebMCP variants and approvals for every bed and its colocated crop fixture. The user asked for related approvals to be grouped.

### Previous limitation

Each modifying WebMCP call creates one independent ghost variant from the current committed revision. A bed and its crop are separate fixtures, so moving the complete three-bed garden requires six sequential approvals. Variants created from the same revision cannot safely be approved as a batch after the first approval changes the project revision. This creates repetitive confirmation work and temporarily separates related objects while the sequence is incomplete.

### Implementation contract

Support transactional grouping of related WebMCP changes. The implementation may use a general change-set tool or allow existing proposal tools to append commands to a shared draft variant. It should:

1. Create a draft change set against one explicit base revision.
2. Add multiple typed operations to that draft without committing intermediate state.
3. Validate the combined result, including relationships between beds, crops, plants, walls and other linked objects.
4. Present one preview that lists every included operation and its combined metrics and conflicts.
5. Require one human approval to apply the complete change set atomically.
6. Reject or roll back the entire group if any command fails or the base revision becomes stale.
7. Preserve granular audit output so the user can see which objects changed even though approval was grouped.

### Acceptance scenario

The agent should be able to move the tomato, potato and cucumber raised beds together with their colocated crop fixtures from `z = 5.5` to `z = 25.5`, preserve their spacing, show all six fixture moves in one ghost preview, and apply or reject the complete relocation with one approval.

## Measure building and segment heights

### Observed request

The user asked to measure the height of building segments, not only horizontal lengths and areas.

### Previous limitation

The viewer offers length and area measurement, while WebMCP reports some modeled elevations and an overall building bounding height. There is no dedicated vertical measurement workflow for selecting a building segment and reading its height between meaningful architectural reference points. This makes it difficult to verify individual walls, storeys, roof sections, openings, platforms and other vertical elements directly in the scene.

### Implementation contract

Add a height measurement mode to the human interface and a matching read-only WebMCP tool. It should:

1. Measure a free vertical distance between two picked points.
2. Measure a selected semantic object's bottom elevation, top elevation and resulting height.
3. Support buildings, storeys, walls, roof segments, openings, slabs, platforms and terrain-to-element clearances.
4. Clearly distinguish absolute elevation, local project elevation and relative height.
5. Snap to stable semantic geometry such as slab faces, wall endpoints, eaves, ridges, sills and opening heads.
6. Display the measurement in the 3D scene and return structured metres through WebMCP.
7. Include the selected object references and measurement points so the result can be reproduced and verified.

### Acceptance scenario

The user should be able to select one wing or wall of the L-shaped barn and measure ground-to-eaves height, ground-to-ridge height, storey clear height, wall height and individual opening height. The visible annotation and WebMCP result should agree and identify the exact semantic segment and reference points used.

# Part 2 — Persistent proposal review and history

## Store proposals and their decisions in one visible place

### Observed request

The user could not find the grouped garage-and-driveway proposal even though the ghost variant still existed. The user asked for a dedicated place where proposals remain visible and where pending, approved and rejected decisions are stored.

### Previous limitation

The current approval card is a temporary overlay tied to the active confirmation flow. It does not provide a persistent proposal inbox or history. A proposal can therefore be difficult to rediscover after the approval request times out, the overlay is dismissed, the browser reloads or another panel takes focus. Applied and rejected variants also disappear from the active variant list, so the user cannot review the decision trail later.

### Implementation contract

Add a persistent proposal review area shared by the human interface and WebMCP. It should:

1. Provide an always-discoverable **Proposals** entry showing counts for pending, approved, rejected and stale proposals.
2. Persist every proposal with its stable reference, label, base revision, creation time, complete operation audit, metrics, warnings and validation errors.
3. Allow a pending proposal to be reopened, refocused in the scene and returned to the approval card without recreating it.
4. Store the final decision, decision time and resulting project revision for approved proposals; rejected proposals should remain visible as read-only history and may include an optional rejection reason.
5. Clearly distinguish draft change sets, review-ready ghost variants and completed decisions.
6. Prevent stale proposals from being applied while preserving them for inspection and offering an explicit recreate-from-current-revision action.
7. Persist proposal history across reloads and sessions, while keeping undo history and proposal history conceptually separate.
8. Expose read-only WebMCP tools to list and inspect proposals, plus a safe action to reopen a pending proposal for human review.

### Acceptance scenario

After the garage-and-driveway change set is proposed, the user can leave the approval card, reload the app and later open **Proposals**. The proposal is listed as pending with its garage and driveway operations, preview, metrics and warning. Approving or rejecting it moves the same record into the corresponding history section without deleting the audit trail.

Implemented in the current project with persistent proposal and draft records, status counts, reload-safe review, stale-proposal recreation and the read-only `get_proposals` WebMCP tool.

## Add move and delete controls to the selected-object inspector

### Observed request

When a semantic object such as `plant/hydrangea` is selected, the user wants **Move** and **Delete** buttons directly in the right-hand inspector beneath the selected object's identity.

### Requested adjustment

Add contextual **Move** and **Delete** actions to the selected-object inspector for objects that support those operations. **Move** should enter the existing repositioning workflow for the selected object. **Delete** should clearly identify the object, require confirmation, and preserve the normal proposal, approval and undo safeguards. Hide or disable either action when the selected object is locked or does not support that operation.

Implemented in the current project for buildings, plants, garden fixtures and landscape zones. Move is shown only for objects with an interactive repositioning workflow; Delete creates a confirmed ghost proposal before approval.

## Raise and restyle individual roof segments through WebMCP

### Observed request

After the existing upper storey was extended over the previously single-storey wing, the user asked for that wing's roof to move up with the new level and visually match the original modern-barn roof. The walls could be changed to charred timber, but the rear roof remained visually different and could not be repositioned independently through WebMCP.

### Current limitation

`propose_roof_update` currently exposes only `buildingRef`, `roofType`, `pitchDegrees` and `overhangM`. It cannot set roof elevation or finish. The building model also stores one `roof` object for the complete L-shaped building, so the separately rendered roof planes have no stable semantic references of their own.

Adding only `baseElevationM` to the existing command would allow the complete `roof/main` object to move vertically, but it would move every roof plane together. It would not raise only the newly extended wing, align one ridge or eaves line with another, or correct the grey-versus-black finish difference. Moving a roof without coordinating its supporting walls could also leave a physical gap or overlap.

The existing storey-footprint extension updates the shared slab, walls, space and overall roof footprint, but it does not create or preserve independently targetable roof segments with their own elevation and finish properties.

### Required domain-model adjustment

Represent a building roof as one or more semantic roof segments while preserving a parent roof reference for whole-roof operations. Each segment should have:

1. A stable `roofRef` or `segmentRef`.
2. Its own footprint and relationship to the storey or space below it.
3. Base or eaves elevation, pitch, roof type and overhang.
4. Ridge direction or other orientation data needed for deterministic gable geometry.
5. Finish information such as material and opaque colour.
6. Explicit adjacency or junction information so valleys, ridges and intersections between segments remain valid.

Existing single-roof projects should remain compatible by treating their current roof as one default segment until it is split by an architectural operation.

### Required `propose_roof_update` adjustment

Extend the existing tool instead of adding another top-level WebMCP tool. The command should support:

1. `buildingRef` plus an optional `roofRef` or `segmentRef`; omitting the segment should explicitly mean the complete roof.
2. `baseElevationM`, `targetEavesElevationM` or a clearly named vertical delta for direct vertical positioning.
3. Existing roof type, pitch and overhang updates at either whole-roof or segment scope.
4. Roof finish properties, including material and colour, so a new segment can match the original roof.
5. An explicit synchronization mode that distinguishes moving only the roof from raising the roof together with supporting upper walls or changing the associated storey height.
6. Optional target alignment, such as matching another segment's eaves or ridge elevation, without requiring the agent to infer a fragile numeric offset.

The input schema, project command type, command handler, ghost-variant output and audit description must all expose the same fields. This capability is unrelated to the WebMCP tool-count limit because it extends the existing roof-update tool.

### Validation and review contract

A proposed roof update should:

1. Reject a roof below the highest supporting wall or report the resulting overlap.
2. Detect gaps between the roof and supporting walls unless the proposal also extends those walls atomically.
3. Validate ridge, valley and intersection geometry between adjacent roof segments.
4. Preserve connected segments unless the proposal explicitly changes their junction.
5. Report old and new eaves, ridge and overall building heights.
6. Produce axonometric, elevation and section previews in which the targeted segment is visibly identified.
7. Show finish changes in the same preview rather than reporting only semantic values.
8. Apply the roof, wall, storey and finish operations as one grouped variant with one approval and one undo step.

### Acceptance scenario

For the current L-shaped modern barn, WebMCP should identify the roof segment above the newly extended upper wing, raise or align its eaves with the top of the new upper-storey walls, preserve a valid junction with the original perpendicular gable, and apply the same dark modern-barn roof finish. The original roof segment must remain at its existing elevation unless included explicitly. Before approval, the architectural preview and height measurements should make the two segment elevations, ridge relationship and matching finish unambiguous.

Implemented in the current project with parent-and-segment roof semantics, per-segment elevation and finish, alignment and synchronization modes, support/junction validation, structured before/after metrics and visibly selectable segment previews. The same tool can now add a segment or atomically replace one malformed concave segment with multiple footprint-bounded segments, independent ridge directions, support links and explicitly typed valley/intersection junctions. Complete orthogonal L-shaped top-storey extensions are decomposed into perpendicular roof wings instead of being assigned to one concave gable.
