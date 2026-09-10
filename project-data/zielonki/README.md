# Versioned Zielonki project

`project.json` is the canonical published house, initially recovered from the user's Codex browser at **http://127.0.0.1:5173/** on 2026-09-09 as revision **40**, saved **2026-09-09T14:11:23.399Z**. The current revision is **46**, retaining **6 plants**, **6 garden fixtures** and the user's **40.13423424862029°** main and perpendicular gable pitch. Code, furniture catalogue and assets remain those of the merged interior editor.

## V2 terrace trim, 2026-09-10

Existing `project/zielonki-v2` is now r49: the highlighted front terrace/pergola is removed and the retained side terrace ends flush with the house wall. The actual public-origin capture contained no new changes; the previous published v2 r48 is preserved in `before-terrace-trim-r48.json`. This original project remains untouched at r46. See [v2 provenance](../zielonki-v2/README.md).

## V2 rotation, 2026-09-10

The user-requested 180° turn applies only to existing `project/zielonki-v2`, now published r48; this original project stays at r46. See [v2 provenance and geometry](../zielonki-v2/README.md). Actual public-origin records captured at 18:37:30 Europe/Warsaw were unchanged from the previous deployment capture, with no new design edits or conflicts. Previous v2 r47 is preserved separately for recovery; neither original migration baseline is replaced.

## Revision 46 — cadastral correction of the eighth neighbor

The optional neighbor with stable ref `neighbor/south-east-map` now uses cadastral building `120617_2.0018.64/2.1_BUD` instead of the inaccurate Google Maps estimate. Its centroid moves 14.836 m and its outline is corrected; the nearest house clearance changes from 53.431 m to 62.473 m. Heights remain estimates. All other neighbors, owner geometry, north and landscape are unchanged. See [distance verification](../../knowledge-bank/zielonki/NEIGHBOR_DISTANCES.md).

Before editing, the actual public-origin Codex browser was backed up under ignored `tmp/neighbors/recovery-distances-*/`. Its working r46, saved 2026-09-10T14:25:40.096Z, equals its published r45 baseline and tracked r45 after excluding revision/time metadata. No user design changes or conflicts were present. The browser counter reflects the previous migration, not this publication. `published-base-r45.json` preserves the previous canonical data; the immutable legacy baseline is unchanged. Changes to the same neighbor footprint remain merge conflicts; independent edits and deletions remain intact.

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

## 2026-09-10 — independent local copy: zielonki v2

Captured the user's actual Codex in-app browser workspace at http://localhost:5173/, revision 45, at 2026-09-10T14:59:25.866Z. Its JSON values match the current canonical project. Created the separately saved project project/zielonki-v2 (name "zielonki v2", revision 45), changing only project identity, name and copy time. No merge was needed; entity refs and all deletions are preserved. The original workspace, published project and migration baselines remain unchanged. The recoverable source export and browser/session backup are in ignored tmp/zielonki-v2-2026-09-10T14-59-25-899Z. See ../zielonki-v2/README.md and ../zielonki-v2/project.json for the copied data and verification. This is a local copy only, with no commit or deployment.

## 2026-09-10 — v2 pergola study (separate from the published house)

At 2026-09-10T15:02:44.450Z the active project/zielonki-v2 r45 workspace was captured from the actual Codex in-app browser origin http://localhost:5173/. Its complete recovery snapshot is ../zielonki-v2/before-pergola-r45.json; raw browser exports are in ignored tmp/zielonki-v2-pergola-2026-09-10T15-02-45-869Z. The independent v2 r46 removes the projecting garage bay and roof terrace, retains the upstairs rooms, converts the covered ground-floor remainder to a garden room, and replaces the heavy canopy with a slatted pergola. Stable retained refs and deletions are preserved. No merge into the canonical house or replacement of any published/legacy baseline was performed by this change. See ../zielonki-v2/README.md for geometry decisions, recovery and validation.
## 2026-09-10 — publish the existing zielonki v2 with south carport

The car icon beside Neighbors opens the existing `project/zielonki-v2` (not a third project). Original house r46 remains unchanged. Actual Codex-profile v2 data from `http://localhost:5173/` was captured at 18:09:26 Europe/Warsaw in ignored `tmp/v2-carport-recovery-20260910-180926/`; its r46 equals the tracked v2 exactly. The complete before-pergola r45 workspace and new immutable before-carport r46 project are retained. V2 r47 keeps both pergolas and adds the carport, revised ground floor and placement. The reviewed neighbor correction is merged by ref/field against the common before-pergola baseline; no conflicts were found. See [v2 provenance and geometry](../zielonki-v2/README.md).

The actual public origin `http://natan203.mikrus.xyz:20203/` was separately backed up under ignored `tmp/carport-recovery-20260910-174346/`: its browser r46 equals its own published r45 baseline except revision/date metadata. The later tracked r46 neighbor correction remains the incoming original-house data. Both origins retain their separate working copies; no browser profile was reset.

## 2026-09-10 — precision editor, code-only release

Before release, the actual Codex profile for http://natan203.mikrus.xyz:20203/ was copied and exported read-only at 19:17:55 Europe/Warsaw. Recovery files are in ignored tmp/precision-editor-recovery-20260910-191755/. The complete export equals the pre-rotation capture from 18:37:30: original project r46, saved 2026-09-10T14:25:40.096Z, with its recoverable workspaces and no separate v2 working copy in this profile. No additional project edits or conflicts were found. Original canonical r46 and v2 r49 remain byte-identical to release 651ea3fcbd660356a88f7b67ed6065ca27d69561. This release adds editing controls only; it does not alter project revisions, entity refs, deletions or migration baselines. Browser regression edits use isolated disposable profiles.

## 2026-09-10 — v2 road-facing carport, revision 50

Captured the actual Codex profile for http://natan203.mikrus.xyz:20203/ before editing, with all raw and exported records recoverable in ignored tmp/v2-road-carport-recovery-20260910-193220/. Active project/zielonki-v2 r49 equals its published baseline and tracked r49 exactly; original browser r47 equals tracked original r46 apart from revision/date metadata. No independent content changes or conflicts were found. The requested v2 move therefore starts from the common r49 baseline, preserved in ../zielonki-v2/before-road-carport-r49.json. Original canonical r46, its legacy baseline and v2's immutable r46 baseline remain unchanged. V2 r50 moves the house and carport, reconnects the approach and removes the obsolete front pad. See ../zielonki-v2/README.md for dimensions, constraints, merge decisions and validation. Existing tree and terrace deletions remain deletions.

## 2026-09-10 — direct interior gestures, code-only release

The actual Codex public-origin profile was copied and exported read-only before release; raw records are recoverable in ignored tmp/direct-drag-recovery-20260910-200026/. The complete export equals tmp/v2-road-carport-recovery-20260910-193220/export-20203.json: active v2 r49 equals its saved published baseline; original r47 has only revision/date differences from its published r46 baseline. No independent edits or conflicts were introduced since that capture. The incoming tracked v2 remains r50 and the original remains r46. Canonical JSON, entity refs, deleted elements, roof geometry and migration baselines are unchanged by this code-only gesture release. Browser regressions use disposable fixture profiles.
