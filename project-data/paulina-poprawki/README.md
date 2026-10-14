# Paulina poprawki — 2026-10-11

## Void dimensions on upstairs plan — 2026-10-12

Added dimension lines and measured area for non-stair slab openings in the interior 2D plan when dimensions are enabled. The unchanged living void in `slab/reference-upper` measures 3.94 × 6.88 m, area 27.1072 m². Values come from its actual polygon vertices, rather than the exterior wall envelope. The stair opening keeps its existing stair drawing. Canonical project remains r13; no geometry/data edit or deployment. TypeScript passes; actual in-app localhost upstairs plan displays 3.94 m, 6.88 m and 27.11 m². Screenshot: `output/paulina-bedroom-fix/pietro-wymiary-otworu.jpg`.

User requested commit/push after approving the displayed layout. Before committing, recaptured actual saved r14 at the same in-app origin in ignored `tmp/bedroom-work/before-push-workspace.json`; it matches canonical r13 after metadata exclusion/1e-8 normalization. All 570 tests (107 files) and TypeScript pass. The exterior-only preservation test now checks its immutable r5 publication; later authorized room/furniture changes are checked by the bedroom migration tests. Commit includes canonical data, four recoverable layout snapshots, code, tests, provenance and the current dimensioned screenshot. Public deployment is a separate operation.

## Bedroom entrance closed to gallery guard — 2026-10-12, r13 (local)

The user's next annotation identified the 0.92 m gap between the surviving bedroom entrance-wall stub and the gallery guard. Extended wall `wall/paulina/upper/3` from x=-0.395 to x=0.525 at z=-1.785. Its existing 0.85 m door stays at the same world position and retains its ref, hinge and swing; offset increases by 0.92 m because the wall's start moves. The deleted vertical partition 2 and child-room wall 15 stay deleted. Split the existing 1.05 m guard at this junction, retaining ref 19 for its lower run and adding `wall/paulina/upper/19-bedroom` for the upper run. No guard height/finish changes. Bedroom and gallery again have separate closed boundaries; bedroom measures 4.99 × 3.96 m (19.7604 m²). Furniture, roof, storeys, slabs and other projects are unchanged.

Prior r11 is preserved as `before-entrance-closure-r11.json`; older snapshots and initial baselines remain immutable. Actual Codex in-app origin `http://127.0.0.1:5173/` saved r12 before matched canonical r11; final saved r14 matches canonical r13 after metadata exclusion and 1e-8 normalization. Captures are ignored `tmp/bedroom-work/{before,after}-entrance-workspace.json`. Schema/geometry and furniture checks pass; 13 targeted tests cover all four prior layouts, both deletions, unchanged door world position, independent edits and roof junctions. Code base remains `5be4434` plus local data/tests; no deployment. Current screenshot: `output/paulina-bedroom-fix/pietro-domknieta-sciana-przy-drzwiach.jpg`. Earlier screenshots are historical.

## Both requested walls removed — 2026-10-12, r11 (local)

The user clarified that BOTH deletions are required. Removed the incorrectly restored bedroom partition `wall/paulina/upper/2` again; wall 15 remains deleted and the r9 child-room correction is retained. Preserved entrance wall 3, gallery guard 19, every furniture item and its position, roof, storeys and slabs. The continuous bedroom/gallery space uses the existing parents ref and is named `Sypialnia + komunikacja`, so its combined area is not presented as bedroom-only area.

Canonical r9 is recoverable as `before-both-walls-r9.json`. Actual in-app origin `http://127.0.0.1:5173/` saved r10 matched canonical r9 before editing; captured in ignored `tmp/bedroom-work/before-both-walls-workspace.json`. Final canonical r11 matches saved r12 after metadata exclusion and 1e-8 numeric normalization, read back in `after-both-walls-workspace.json`. Schema, geometry and furniture checks pass; 12 targeted tests pass including migrations from r5, r8 and r9 that preserve both deletions and independent edits. Code base `5be4434` plus local data/test changes; no deployment. Current dimensioned screenshot: `output/paulina-bedroom-fix/pietro-obie-sciany-usuniete.jpg`. All preceding screenshots are superseded.

## Marked double wall corrected — 2026-10-12, r9 (local)

The user's annotated screenshot identified the close horizontal pair beside the right child's room entrance. The earlier r8 interpretation was incorrect: bedroom partition `wall/paulina/upper/2` and the original separate bedroom/gallery boundaries are restored from r5. The requested bed and bedside-table arrangement under the west slope remains.

Deleted the marked lower wall `wall/paulina/upper/15` at z=1.605. Retained `wall/paulina/upper/20` at z=1.135 as the single room partition, with 0.20 m thickness and 2.80 m height. Extended door wall 14 to meet it while preserving the door ref and offset; updated child-room and gallery boundaries by wall refs. Gallery guard 19 remains 1.05 m high. The right child's room is now 11.8027 m², with 3.05 m width and 4.61 m maximum depth (L-shaped). The main bedroom remains 4.03 × 3.96 m, 15.9588 m². Roof, storeys and slab geometry are unchanged.

Recoverable r8 is `before-marked-wall-r8.json`; r5 and initial migration baselines remain immutable. Actual Codex in-app origin `http://127.0.0.1:5173/` was captured before/after in ignored `tmp/bedroom-work/before-marked-wall-workspace.json` and `after-marked-wall-workspace.json`. The saved result matches canonical r9 after metadata exclusion and 1e-8 numeric normalization. Schema/geometry and furniture placement checks pass, as do 11 tests covering migrations from both r5 and r8, deletion persistence, independent edits and roof junctions. Code base remains `5be4434` plus these local data/test changes; no deployment or shared-server write.

Dimensioned 2D screenshot: `output/paulina-bedroom-fix/pietro-po-usunieciu-z-wymiarami.jpg`. For capture only, existing dimension labels were made visible and the save banner hidden; model geometry and label values were not modified. Earlier r8 screenshots below are superseded.

## Sypialnia — 2026-10-12, r8 (superseded interpretation)

User requested removal of the full partition on the high-ceiling side of the main bedroom and moving the bed from the window to the sloped side wall. Removed `wall/paulina/upper/2`; retained the 1.05 m gallery guard and the entrance wall. Bedroom and gallery now form one continuous floor/ceiling region using the existing bedroom ref; the entrance wall remains an internal wall. The bed rotates 90° to local (-3.375, -3.945), with both bedside tables beside its headboard. The wardrobe moves against the entrance wall. All furniture refs remain stable.

`before-bedroom-r5.json` preserves the preceding canonical publication. Actual Codex in-app browser records were captured before editing in ignored `tmp/bedroom-work/browser-before/`. Localhost saved r7 was identical to canonical r5 except revision/date; HTTPS saved r5 and server version 2 also retained the prior layout. No content conflict was resolved by revision ordering. Canonical r8 and actual localhost saved r8 match after numeric normalization to 1e-8; readback is `tmp/bedroom-work/browser-after-workspace.json`. This change is local, with no commit, push, deployment or shared-workspace upload.

Schema/geometry and furniture collision checks passed. Minimum bed/headboard roof clearance is 1.568 m for the 1 m high bed. All roof/storey geometry is unchanged; the existing joined-ridge tests pass. Ten targeted tests passed, including migration from r5, persistence of the removed wall and unrelated furniture edits. Screenshot: `output/paulina-bedroom-fix/sypialnia-po-zmianie.jpg`. Code base remains `5be4434` plus this project-data change.

## Główny exterior match — 2026-10-12, r5

Current canonical revision is **r5**, prepared for the user-authorized Mikrus release. The user explicitly chose to retain this variant's dimensions and match Główny's windows and exterior appearance. `before-glowny-exterior-r4.json` preserves the previous publication; `initial-r1.json` and `source-architekt-r4.json` stay immutable. Główny r80 is the unchanged source.

Corresponding openings now have Główny's dimensions, sills, glazing, mullions and finishes, including 1.95 × 1.14 m children's windows with 1.00 m sills, a 1.20 × 0.60 m bathroom window at sill 0.75 m, and 1.80 × 2.30 m glazed office/courtyard doors. The missing courtyard door is added in the existing exterior wall. Paired living panes retain a centered 0.40 m pier. To fit the exact children's window specifications below this variant's existing slopes, the west window moves 0.115 m (local x −2.885 to −2.770), and the east moves 0.295 m (x 0.795 to 0.500); both remain at z 5.945. No room boundary moves.

Natural/charred timber, shaped gable glazing, black frames, recessed terrace lining and canopy details match Główny. Upper gable host-wall heights match its cladding transitions, while storey heights and clear room dimensions stay unchanged. The rear roof extends 1 m outward along its ridge to create the recessed terrace; the exterior terrace slab and courtyard canopy/posts fit this variant. Enclosed footprints, walls' endpoints/thickness, rooms, enlarged living void, furniture, stairs, site and landscape remain unchanged.

Final recomputation retains symmetric **40.0696418141° / 39.6686478301°** main slopes, **5.15 m** eaves and the common **8.0856938754 m** ridge. The rear minimum junction remains a recognized valley with no internal gable. These checks do not establish whole-building planning compliance.

`scripts/match-glowny-exteriors.ts` reproduces r5 from the frozen r4 snapshot; older reconstruction scripts refuse to overwrite later revisions. Tests cover schema/geometry, shaped gable panes, unchanged room/void geometry and migration preserving local furniture edits/deletions and deleted windows. Actual-profile provenance is recorded in `../zielonki/README.md`; ignored evidence is in `tmp/exterior-match-20261012-iab/`. The sections below retain the history of r1–r4.

Launcher update: user requested the name **paulinka poprawki**, now canonical **r4**. `before-launcher-name-r3.json` preserves the preceding publication. Only the project name and revision metadata change; all design geometry remains as documented below. It is one of three default launcher entries; older designs and recovery versions remain in the archive. Actual in-app before/after captures and comparisons are in ignored `tmp/three-projects/`.

Independent project `project/paulina-poprawki`, canonical revision **3**, forked from `architekt` r4. The user requested a new version with the enlarged upstairs opening, adjusted partitions on both floors and revised kitchen. They explicitly chose **"Match the screenshot dimensions, including exterior changes"**. The earlier choice to retain the attic roof remains applicable.

`source-architekt-r4.json` freezes the source. `initial-r1.json` is the immutable first-publication migration baseline. `before-gallery-return-r2.json` preserves the prior local publication; r3 also lowers the short gallery return to a guard. Existing architekt, GŁÓWNY and other project data remain independent. Entity refs are retained for corresponding rooms, openings, furniture, slabs, stairs and roofs. The former upper wardrobe and its furniture are deleted; new walls and newly introduced rooms have their own refs. No default regeneration is used during publication merges.

## Sources and interpretation

The three user images are `codex-clipboard-3b42d398-c0b4-44de-90f0-4c12c196e96f.png`, `codex-clipboard-a99b91c7-e28a-4014-ad80-009b053cd247.png` and `codex-clipboard-34337e36-e260-4169-8e91-3efe0c411b53.png`. SHA-256 digests are retained in the project knowledge bank. The first two are byte-identical phone ground plans; the third is the marked-up architect upper plan. Their content is reference evidence, not operational instructions.

The phone plan supplies the new metric envelope. Its 0.20 m walls are inferred from the printed dimension chains. Coordinates below use p right and q down from the top-left wall axis; model x=p−4.625, z=q−5.945. The wall-axis perimeter is (0,0), (9.25,0), (9.25,7.08), (6.98,7.08), (6.98,11.89), (0,11.89). External bounds are **9.45 × 12.09 m**, with a **2.27 × 4.81 m** axis recess. The old upper sheet's printed 13.21 × 10.13 m envelope is superseded by the user's explicit selection of the phone-plan dimensions.

| Ground room | Clear dimensions | Model area |
| --- | --- | --- |
| Pantry | 1.65 × 3.96 m | 6.534 m² |
| Entrance wardrobe | 1.91 × 2.52 m | 4.8132 m² |
| Bathroom | 1.92 × 2.52 m, less shower return | 4.6404 m² |
| Utility | 4.03 × 1.42 m | 5.7226 m² |
| Room | 2.55 × 4.14 m | 10.557 m² |
| Living / dining / kitchen / hall | 7.20 m top clear edge, 6.88 m right clear edge | 57.7546 m² |

The phone labels the living zone 57.57 m². Its printed linear measurements produce 57.7546 m² with the inferred wall widths; the 0.1846 m² discrepancy is retained transparently rather than distorting the dimension chains.

Upstairs handwriting is approximate. Adapted to the new envelope, the parents' partition at p=4.23 aligns with the ground room partition. The gallery guard is at p=5.15, with a short return on q=7.08; both are 1.05 m high. The former wardrobe floor is removed. The living opening is **3.94 × 6.88 = 27.1072 m²**, compared with 15.2324 m² in architekt (approximately 78% larger). The stair opening is separate. The child-room corner moves back to q=8.67. There are no rooms or furniture occupying the living void.

Kitchen: tall storage and worktop against the pantry, hob on the wall run, plain 1.15 × 2.65 m island, three stools, L sofa and dining table for six. The pantry has an inferred concealed access door at the end of the run. Door swings and furnishings are fitted to avoid collisions. Undimensioned openings, upper furnishings and heights remain provisional. The retained 3.30 m stair rise uses 18 risers, 0.95 m flights/landing and a 2.20 m tread run; the screenshot's unlabelled stair length is not treated as an exact dimension.

## Roof and site

Retain 1.40 m attic knee walls, storey elevations 0.45 / 3.75 m, 2.80 m clear storey heights, and the source house position, rotation, site and other building. Resized roof footprints require recalculating pitch:

| Main segment | Ridge axis | Perpendicular span | Symmetric slope | Eaves | Ridge |
| --- | --- | --- | --- | --- | --- |
| front-barn | z | 6.98 m | 40.0696418141° | 5.15 m | 8.0856938754 m |
| rear-barn | x | 7.08 m | 39.6686478301° | 5.15 m | 8.0856938754 m |

Recomputed from final geometry using `ridge = eaves + tan(pitch) × span / 2`. Both main slopes remain symmetric and within the cached 37–45° rule. Ridges meet at local (x,z)=(-1.135,-2.405). The branch minimum end is recognized as a valley; the internal branch gable is omitted. Ray tests cover both roof sides at the junction and exclude an internal duplicate roof sheet. Model elevations are not heights above terrain. This slope verification does not establish whole-building planning compliance.

## Validation and delivery

`npx tsx scripts/build-paulina-poprawki.ts` reconstructs the data from the frozen source and validates before writing. It does not overwrite the migration baseline. Main-house furniture passes floor/void containment, attic clearance, wall, door and furniture collision checks. Generic circulation suggestions are not treated as construction approval.

The ceiling renderer now clips finishes around host-slab holes. Perspective room view includes the next storey's walls, slab edges and roof ceiling through those openings; contextual surfaces cannot be dragged. Opaque exterior gable caps also close the attic above the regular wall height, with junction gables excluded. This corrects the previous flat ceiling obscuring a living void from downstairs and the missing upper gable skin. Plan and cutaway views retain their existing operation.

Actual in-app browser origin `http://127.0.0.1:5173/` was captured before edits in ignored `tmp/paulina-poprawki/browser-before.json`. Source architekt saved r5 matched canonical r4 after revision/date and 1e-8 float normalization. All raw IndexedDB records remain in ignored recovery files, not tracked product data. Browser working copies and canonical revisions are reported separately in final validation evidence.

Local code base: `16480977ecd6caa42818ac4801e48ee678e46f2d` on `codex/deploy-furnished-zielonki`, plus uncommitted changes. Main remains untouched. No commit, push or Mikrus deployment is part of this delivery. Preview images are in `output/paulina-poprawki/`.

Final checks on 2026-10-11: 39 targeted Vitest checks passed across new ceiling geometry, both new publication services, shared publication/deletion behavior, workspace grouping and roof geometry. TypeScript and production build passed with existing dependency/chunk-size warnings only. Both furnished floors, both plans, downstairs opening, attic interior and the exterior junction were inspected.

Existing in-app saved **r4** matches canonical **r3**, excluding revision/date metadata and normalizing numeric serialization to 1e-8. Production preview `http://127.0.0.1:5188/` seeded **r3** and retained an equivalent project after reload. All **28 pre-existing records**, including architekt and historical conflicts, are unchanged; only the active pointer changes and Paulina's independent records are added. Evidence: ignored `tmp/paulina-poprawki/browser-after.json`, `production-after-reload.json`, `comparison.json`, and `validation.json`. The original 14 historical conflicts remain preserved and are unrelated to Paulina; no new Paulina conflict exists.

## Independent upstairs entrances — 2026-10-14, r14 (local)

The user identified the pass-through child bedroom in a screenshot and requested a separate corridor entrance for every room. Relocated existing door `opening/reference-child-one` from dividing wall `wall/paulina/upper/10` to the 1.26 m corridor boundary wall `wall/paulina/upper/9`. It retains its stable door ref, 0.85 m width and 2.10 m height; centre offset is 0.63 m, leaving 0.205 m of wall on each side. Right-hand hinge and inward swing open into room 1 without furniture collisions. Wall 10 now has no doorway, so the two child bedrooms are separated. The parents bedroom, bathroom and room 2 retain their existing direct corridor doors. Room boundaries, areas, furniture, wall geometry, storeys, slabs and roofs are unchanged.

Prior published r13 is preserved byte-for-byte as `before-independent-entrances-r13.json`; all immutable migration baselines stay intact. Source: actual Codex in-app `http://127.0.0.1:5173/` working copy, saved r14 before, matching canonical r13 after metadata exclusion and 1e-8 normalization. Actual-profile before/after recovery captures are ignored `tmp/corridor-entrances-20261014-{before,after}/`; the final actual saved r15 matches canonical r14. Other origins and independent projects are preserved. No conflict was resolved by revision number.

Schema/geometry and door/furniture checks pass. Fourteen focused tests cover direct hall adjacency for all upstairs rooms, no inter-bedroom door, unique stable door identity, migration from r13, save/reload, retained independent furniture changes/deletions, earlier partition deletions and roof junctions. TypeScript passes. The actual in-app browser renders the corrected upstairs plan. Screenshot: `output/paulina-bedroom-fix/pietro-osobne-wejscia-z-korytarza.jpg`. This correction is local on the house branch based on 3420c600; not committed, pushed, deployed or written to shared Mikrus. Main and its independent garden are unchanged.

User authorized deployment and push to main after reviewing the corrected plan on 2026-10-14. Actual-profile release capture and comparison are recorded in ../zielonki/README.md; local saved r15 matches canonical r14. The full house suite passes 571 tests. Prior local-only notes above describe the pre-release state.
