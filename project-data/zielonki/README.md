# Versioned Zielonki project

`project.json` is the canonical published house, initially recovered from the user's Codex browser at **http://127.0.0.1:5173/** on 2026-09-09 as revision **40**, saved **2026-09-09T14:11:23.399Z**. The current revision is **45**, retaining **6 plants**, **6 garden fixtures** and the user's **40.13423424862029°** main and perpendicular gable pitch. Code, furniture catalogue and assets remain those of the merged interior editor.

## Revision 45 — optional neighbors and verified true north

Eight surrounding context buildings are stored in the optional `site.neighbors` array; each has a stable ref, source and confidence. Seven footprints derive from the geodetic map and one from a Google Maps visual estimate. All heights/roof forms are estimates and no windows are invented. See [evidence and transforms](../../knowledge-bank/zielonki/NEIGHBORS.md). Owner geometry and planting are unchanged. True north is corrected from -56.7 to -124.187875 degrees, with solar coordinates at the surveyed origin (50.135450043, 19.902235433).

Before editing on 10 September 2026, the actual public-origin browser workspace was backed up under ignored `tmp/neighbors/recovery-*/`. Its working r45 (saved 2026-09-10T13:21:39.726Z) has the same content as its published r44 baseline and tracked r44 after excluding revision/time metadata; there were no local design changes or conflicts to merge. The browser's r45 counter is a previous migration result, not this publication. `published-base-r44.json` preserves the previous canonical snapshot; the legacy baseline is unchanged. The new canonical r45 merges by content against each browser's baseline. Local north edits produce conflicts rather than being overwritten, and independent deletions remain deleted.

View visibility is an origin-local preference, not a project edit. The layer is initially off; enabling it activates matching scene shadows and sun-hours occluders. Facade camera positions are explicitly approximate.

## Revision 44 — 140 cm knee walls at the existing roof pitch

Both gable segments now start at 4.85 m: 1.40 m above the upper floor at 3.45 m. Their pitches remain exactly 40.13423424862029 degrees and both ridges move down by 1.40 m. Ground-floor walls, floor slabs, connected flat terraces, house placement, landscape and furniture are retained. The cancelled terrace extension has not been added.

The upper storey's additive `kneeWallHeightM` is separate from its nominal 2.8 m interior ceiling cap. Eave walls are 1.4 m; partitions and the lower gable walls follow the roof profile where necessary. `attic.ts` derives exact linear wall caps at roof boundaries, ridges and intersecting slopes. The geometry worker, interior perspective walls, opening checks and wall-height measurements use these caps; furniture placement checks available sloping clearance. Older projects without the field keep their previous behavior.

The two balcony doors retain their positions and widths, with a 2.10 m height and the existing 4 cm sill. Their supporting gable wall sections reach 2.20 m, followed by the divided trapezoid panes. The large upper window bands on the other gables are 1.24 m high above their existing 8 cm sill, continuing into the roof-shaped glazing above the 1.4 m knee-wall line. This avoids glazing or wall solids protruding through the lowered roof.

Before editing on 2026-09-10, the actual public-origin Codex browser workspace and its published baseline were backed up in ignored `tmp/knee-wall-recovery/`. Both still contained identical r40 data, so no additional local edits conflicted with tracked r43. `published-base-r43.json` preserves the previous published project; the immutable legacy baseline remains unchanged. The change and its migration tests retain all six surviving plants and the existing furniture.

## Revision 43 — one terrace composition across both levels

Following the user's correction, the garage roof terrace and the ground-floor canopy now form one continuous L-shaped upper deck. Both retain their existing footprints and 3.49 m top elevation. A shared charcoal fascia wraps the whole exposed outer perimeter; the glass guard follows that perimeter, with no barrier across the garage/canopy seam. The former canopy top uses the same deck finish as the garage terrace. Timber lining, courtyard wall cladding, posts, rooms, glazing, furniture and landscape remain intact.

Before editing on 2026-09-10, the actual public-origin Codex browser data was backed up to ignored `tmp/unified-terrace-recovery/`. Its r40 workspace still exactly matched its own r40 published baseline, so there were no additional local edits to merge. This correction extends tracked r42; `published-base-r42.json` preserves that prior published project, and the immutable legacy baseline is unchanged.

`terrace.connectedSegmentRefs` derives the shared perimeter from semantic roof footprints. `openEdgeIndices` identifies the house-facing edges of that merged perimeter, while `fasciaHeightM` describes its continuous fascia. Older single-roof terraces retain `openEdgeIndex` behavior. Validation rejects missing/duplicate references, unequal deck elevations, disconnected footprints and a second guard on a connected deck. One shared perimeter helper is used for rendering and validation.

## Revision 42 — ground-floor courtyard canopy

The user clarified that the reference applies to the ground-floor terrace, not the terrace above the garage. A flat canopy now spans the courtyard (3.50 × 10.56 m), joining the garage cap at the same 3.49 m top elevation and meeting the projecting living wing facade. Its 65 cm charcoal fascia, textured timber soffit, warm timber courtyard wall cladding and two 20 cm posts follow the reference image. The outer fascia leaves 2.39 m above terrace level. The upstairs glass guard, divided trapezoid windows, rooms, furniture and landscape are preserved.

Before editing on 2026-09-10, the actual Codex browser's public-origin workspace and published baseline were copied to ignored `tmp/terrace-style-recovery/`. Both contain identical r40 project data (saved 2026-09-09T14:11:23.399Z): there are no unmerged browser edits or conflicts. The change therefore extends tracked r41, retaining its window changes. `published-base-r41.json` preserves the immediately previous published project for recovery and merge regression tests; `legacy-base.json` remains immutable. Runtime migration still uses each browser's own stored published baseline.

The additive `RoofSegmentModel.canopy` field stores fascia edges/height, timber tint and building-local post positions/elevation. It participates in schema parsing, semantic project diffs and geometry validation; the renderer uses the existing flat roof surface and shared timber texture. This is the visual architectural model, not a structural specification.
## Revision 41 — divided bedroom glazing above the garage

Before editing, the actual Codex browser workspace at **http://natan203.mikrus.xyz:20203/** was extracted into ignored `tmp/garage-glazing-recovery/`. Its project matched tracked r40 exactly, so there were no data conflicts. The previous published snapshot remains in Git as the merge base; `legacy-base.json` is unchanged.

The driveway-side gable now references `opening/reference-children-west-window` and `opening/reference-children-east-window` through `hostOpeningRefs`. Each upper window continues its balcony door's width and central mullion, with a sloping roof-parallel top: two separate trapezoids, separated by the solid wall between bedrooms. Changes to door width/position and roof pitch update the upper panes; removing a hosted door removes its upper pane. The rest of the house and landscape are unchanged. The optional schema field keeps older project files readable.

`recovered-workspace-r40.json` preserves the full source workspace, including 19 proposal records (18 approved, 1 rejected). It is an audit/recovery snapshot and is not imported into the runtime bundle. Raw browser files are backed up only in ignored `tmp/project-recovery-20260909/raw/`.

`legacy-base.json` is the pre-publication house recovered from **http://127.0.0.1:5187/**, revision **7**, saved **2026-09-09T17:59:09.105Z**. It has 20 plants and a 38.325166934898895° roof pitch. The comparison found the same site, room/furniture geometry, garden fixtures and terrace geometry; other differences were annotation order and snapshot metadata. The initial merge explicitly retains r40's plant deletions and roof adjustments. This file is the immutable compatibility baseline for browsers that have never received tracked project data, not proof of an earlier Git ancestor.

The six retained plants are `plant/survey-5012`, `plant/survey-5015`, `plant/survey-5018`, `plant/survey-501b`, `plant/apple`, and `plant/orchard-plum`. Do not recreate the other 14 entries from catalogue defaults.

## Capture and merge procedure

1. Read `AGENTS.md`. Export the **actual user's workspace**, with origin, revision and save time, before merging code or deploying. The app's **House interior → Export project JSON** exports the current project. Keep a full workspace backup when proposal history matters. A headless test profile is not the user's browser.
2. Keep the previous tracked `project.json` as the Git merge base. Compare records by stable `ref`, including nested openings, rooms, furniture and landscape. Review deletes and edit/delete conflicts. Never choose a version by revision counter or timestamp alone.
3. Merge the captured edits and branch changes into `project.json`, increment its revision and update `updatedAt`. Resolve geometry conflicts as connected entities, validate the schema and domain rules, and record resolutions here. Unresolved conflicts must preserve both snapshots and block publication of a purported merged project.
4. Commit the data with the code. Do not replace `legacy-base.json` on subsequent releases. Preserve audit snapshots outside the runtime bundle. Run merge/persistence tests and browser checks for a fresh profile, an existing baseline and conflicting local edits.
5. On first opening the application, `synchronizePublishedProject` creates the published project for a fresh browser. Existing browsers merge their working copy against their last published baseline (or the initial legacy baseline). Successful changes are applied atomically with a recoverable “before published update” workspace. Local edits on unrelated fields survive. Same-field and edit/delete conflicts preserve the entire local workspace and expose a separate published copy with a conflict notice.
6. Verify both the deployed code SHA and project revision/contents. Browser edits remain local working changes until captured and committed; this is not cloud collaboration or automatic Git synchronization.

The runtime does not overwrite other projects or rewrite the user's original browser profile files. Existing local proposal history remains with its working copy; proposals invalidated by a merged revision become stale. The recovered r40 history remains available in the tracked audit snapshot.

Run `node scripts/audit-published-project.mjs --url http://127.0.0.1:5173/` (or the public URL) to verify a fresh desktop/mobile profile, the legacy project, recovered r40 history, conflicts and reload. It writes screenshots and `audit.json` to `output/published-project/` by default and only uses isolated browser contexts.
