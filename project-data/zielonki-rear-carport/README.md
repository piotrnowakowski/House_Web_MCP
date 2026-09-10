# Z garażem za domem przy sąsiadach

Independent third project, explicitly requested on 2026-09-10 from the supplied screenshot `codex-clipboard-00f41bd6-6c62-430e-9a5e-f342174cc37b.png`. Stable identity: `project/zielonki-rear-carport`; initial geometry revision: **r49**. The user-facing name follows the request; the pictured parking structure is an open two-car carport.

## Source and preservation

Source is the tracked, recoverable `../zielonki-v2/before-road-carport-r49.json`, saved at **2026-09-10T16:51:13.514Z**. It preserves the layout before v2's r50 move of the carport to the road-facing facade: parking behind/beside the house on the neighbor side, with the trimmed side pergola and no front pergola bay. The archived r49 preview and supplied screenshot were compared visually. This is a historical design fork, not a capture or merge of today's active browser working copy.

The initial r49 differed from that source only in the top-level project ref and name. Its building/entity refs, geometry, furniture, finishes, landscape and prior deletions are preserved in `initial-r49.json`. Both main gables retain approximately 40.134234 degrees and the existing knee walls. The original project and current v2 remain independent. The source's date and revision are retained as historical provenance.

`initial-r49.json` is the immutable first-publication baseline for this new identity. Existing local edits use the normal three-way published-project merge; conflicts preserve both records. Subsequent revisions and recovery copies belong to this project's expandable history. Do not repurpose or replace the original project's or v2's baselines.

## Delivery and validation

The Projects launcher seeds the third project without selecting or overwriting an existing project. It appears after the original two project groups. Opening an existing saved third project preserves its local edits. This independent r49 snapshot is included in the working-house release alongside original r49 and v2 r66; see [deployment verification](../../docs/mikrus-deployment.md).

Focused checks cover exact source equality except identity/name, schema and geometry validation, main roof pitches, independent project switching, name/car-deletion persistence, repeat synchronization and grouping the third project's own recovery copies.

## Revision 50 — compact house from the front-carport design, 11 September 2026

The user requested the reduced house and current interior of **Garaz przód r66** in this existing rear-carport project, then placement toward the construction/agricultural division while keeping 4 m from the front road. Walls, rooms, openings, furniture, stairs, storeys and slabs now match the source house, including the 1.5 m shortening and narrowing, wider bathroom/storage and removed internal doorway. Ground slab bounds are 9.69 × 13.64 m; the upper slab retains the source's additional 9 cm width. Both gables retain 40.13423424862029°, 4.85 m eaves and 1.40 m knee walls.

The rear carport remains a 6.40 × 6.40 m structure with the same vehicles, roof and local geometry. It follows the narrowed facade by 1.5 m in house-local X. The side pergola and terrace shorten by 1.5 m to remain flush with the new end wall; the path follows the relocated entrance facade. The approach connects the retained site entrance to the moved parking area. Other landscape entities, source survey, original house project and front-carport project are retained.

House anchor: **(-8.093726348992222, -2.3629195784171224) m**. Carport anchor: **(-8.013411451837227, -0.8650712825957524) m**. Both retain rotation **273.06927082481445°**. The complete outer envelope, including canopy fascia, is **4.000000 m** from the surveyed road edge; the nearest slab/outside house face is **4.000096 m** away. The limiting house corner is **0.15 m** inside the mapped MNU/R division, retaining the prior map-fit margin. The carport is approximately **11.08 m** from the road and **9.38 m** from that division. The combined footprint has **0 m²** outside mapped construction zoning. These are model distances against existing evidence, not a new statutory building-line or permit assessment.

Source: actual Codex in-app browser **http://localhost:5173/**, captured at **2026-09-10T22:22 UTC** (11 September locally), with front r66 and rear r49. Recovery records are in ignored `tmp/rear-compact-1789078954834/`. Ref/field comparison against each project's own saved published baseline and canonical snapshot found no conflicts or independent design changes. `before-compact-r49.json` preserves the previous publication; `initial-r49.json` remains immutable. Only this project's canonical data change, to **r50**; existing-browser migration produces working **r51** with a recoverable r49 workspace.

Validation: schema/domain checks retain the same 11 existing warnings, with no errors or new warnings. The focused persistence/migration suite passes 22 tests; TypeScript passes. Independent Chromium fixtures verify fresh r50, r49-to-r51 migration with retained rename and car deletion, and deletion persistence after reload. The actual user profile opens the revised project; all other project/baseline records remain unchanged. Application code baseline is **8232c12**; only the project and its focused regression tests/documentation change. No Git commit, push or external deployment was performed.
