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
