# architekt

Independent project `project/architekt`, reconstructed on 2026-10-11 from the three user-supplied architect PDFs and GŁÓWNY. Current canonical revision **r9**, replacing the camper canopy with a two-car canopy on 2026-10-19. Earlier revision notes below remain historical evidence.

## Two cars instead of the camper — 2026-10-19, r9

The user requested a canopy for two cars in this existing project. The two cars stand side by side beneath a **6.00 × 6.00 m** canopy, with **5.52 × 5.52 m** inside the corner posts and **2.50 m** minimum fascia clearance. Each existing `car` catalogue envelope is 1.90 × 4.70 × 1.50 m; the 2.76 m centre spacing leaves 0.86 m between the body envelopes. The camper is removed; building, slab, roof and apron refs are retained. `before-two-cars-r8.json` preserves the complete previous camper design; immutable `initial-r1.json` remains unchanged.

To fit the wider canopy without intersecting the house or reducing the approximately 3.06 m saved external boundary margin, its centre shifts **5.31 m farther behind the house** and 0.90 m toward the house axis. Local roof bounds are x=-10.005..-4.005, z=-13.305..-7.305, with 0.70 m to the house's end in plan. The existing apron is retained and extended to the new roof footprint. Floor datum remains 0.45 m, roof base is 3.01 m and flat roof top 3.25 m. The roof, posts, two vehicle envelopes and paving do not overlap the house or saved agricultural areas. House, windows, rooms, main roofs and the separate garden building are unchanged. The parking arrangement and swept turning paths remain conceptual; nearby windows and construction sizing still require professional review as documented below.

Final recomputation retains symmetric main slopes **38.8097094818° / 39.2352369450°**, 7.30/7.19 m spans, eaves **5.15 m** and common model ridge **8.0856938754 m**. The perpendicular valley remains recognized at (-1.19,-2.985), with its hidden gable omitted. The flat canopy is separate from the main roof geometry and does not establish whole-building planning compliance.

Actual Chrome Default and Codex IAB captures are in ignored `tmp/architekt-two-cars-20261019/{chrome-before,iab-before}/`. Chrome HTTP/HTTPS r5/base5 and IAB local r11/base8, HTTP r8/base8, HTTPS r9/base8 merge by refs to r9 without independent design changes or conflicts. Shared architekt version 4/r9 contains canonical r8 and merges from the preserved r8 baseline while retaining proposals/drafts. The conditional publication refuses concurrent server changes. All **582 tests**, TypeScript/lint and root-path production build pass, including r8 migration, camper removal, independent edits/deletions, reload, two-car clearance, boundary and house-overlap checks. Fresh local production preview seeds r9; public readback, deployment SHA, backups and screenshots are recorded in the release evidence directory. Other project data and main/Pages are untouched.

Released application commit **c5f7684af233ddfc73edf6fc2a4de8181e310ad8**, canonical **r9**, shared **serverVersion 5 / project r10**. HTTP/HTTPS health and sync readiness pass; public HTML and project chunks exactly match the tested build. Fresh preview r9/base9 and existing public HTTPS r10/base9 match canonical before and after reload. Four public exterior views render both cars and the lowered canopy without console errors. Shared Główny, Paulina and nowe-mpzp records are unchanged. Actual IAB recapture preserves all other origins and unrelated records; startup also migrates the previously published nowe-mpzp r3 to its existing canonical r6, retaining its former workspace in recovery history. Both architekt and nowe-mpzp recovery snapshots match their captured previous designs. Evidence: `tmp/architekt-two-cars-20261019/{proof,record-comparison}.json`; public previews: `output/architekt-two-cars-20261019/`.

For this r9 position, the roof edge is approximately **1.94 m** from the kitchen window and **1.97 m** from the parents' window in plan; the r8 distances below are historical. These are model roof-edge distances, not certified parking-stall setbacks. Physical vehicle manoeuvres, construction sizing and approval of this location remain unverified.

## Photographed facade repairs and rear camper canopy — 2026-10-19, r8

The three user-supplied phone screenshots identify the ground-floor office/kitchen windows, light-render patches and a broken gable/side opening. Office and kitchen sills are now zero; their heads stay at 2.30/2.35 m above the ground-floor datum. New exterior segments at the utility access and kitchen inherit their adjacent natural/charred timber finishes. The upper living-void frontage now matches the adjoining 1.40 m gable host wall and charred timber: its former 2.80 m height incorrectly raised the common gable-cladding base and disconnected the parent's shaped glazing. The terrace-side opening moves 0.225 m away from the corner, retaining its width while clearing the perpendicular wall. Room boundaries, furniture, main roof geometry and all existing refs remain intact.

Added `building/south-carport` behind the entrance-side facade, using GŁÓWNY's existing flat-canopy model and finishes. Its 4.20 × 8.60 m footprint is local x=-10.005..-5.805, z=-9.295..-0.695, aligned with this house. The existing entrance apron remains available. This is one covered camper bay; the existing car parking areas remain. The provisional camper envelope is 7.50 × 2.50 × 3.20 m. With floor 0.45 m, roof base 4.01 m, top 4.25 m and 0.30 m fascia, the lowest edge provides **3.50 m clear height**. Inside the corner posts the clear rectangle is **3.72 × 8.12 m**. Roof and paving lie within the saved site boundary and do not overlap its agricultural polygons. Structural sizing, vehicle turning paths and permission for the flat canopy are not established by this visualization.

Recomputed unchanged house slopes from final spans: **38.8097094818°** (7.30 m) and **39.2352369450°** (7.19 m), symmetric, eaves **5.15 m**, common model ridge **8.0856938754 m**. The perpendicular junction is still at **(-1.19, -2.985)**; its valley is recognized and the hidden internal gable remains omitted. All four rendered elevations, upper cutaway and attic interior were inspected. No main roof segment was resized or repitched. These checks do not establish whole-building planning compliance.

`before-facade-carport-r7.json` preserves the previous publication; `initial-r1.json` and older snapshots are unchanged. Actual Chrome Default HTTP/HTTPS r5 and actual Codex IAB localhost r10/HTTPS r8 were backed up and compared against their individual published bases before editing. Ref-based comparisons found no independent architect edits or conflicts, using 1e-7 numeric normalization. Evidence is in ignored `tmp/architekt-fixes-20261019/`; previews are in `output/architekt-fixes-20261019/`. The phone's private Safari storage is not accessible from this workstation.

Validation on code base **cfa6e92** plus the data/test diff: **578 tests passed**, TypeScript and root-path production build passed. Tests include r5/r6/r7 migrations, unrelated edits and deletions, save/reload and explicit edit-versus-delete conflict retention. Existing localhost saved **r11** matches canonical **r8**; fresh production-preview origin `127.0.0.1:5196` seeded **r8**, matched canonical and retained it after reload. Mobile viewport 390×844 rendered without console errors. Previously existing non-architect records and public origins stayed unchanged; separately created `nowe-mpzp` records appeared during concurrent work and were left untouched. Testing used a clean copy because unrelated unfinished root changes initially prevented the root app from loading. **Local only: no commit, push, shared-server write or Mikrus deployment.**

### r8 release checks — 2026-10-19

Published application commit **a4eace6dacbd14cb4074d441e51bae288551ab1c**, canonical **r8**, shared **serverVersion 4 / project r9**. All **581 tests**, TypeScript/lint, production and sync-API builds pass. HTTP/HTTPS health reports the deployed SHA and sync readiness. Existing actual IAB HTTPS r9/base r8 matches canonical before and after reload; the previously empty actual IAB HTTP origin initializes r8/base r8. Exact public HTML/project-chunk hashes match the tested build. Public elevations and the 390×844 viewport render without console errors. Shared Główny, Paulina and nowe-mpzp records are byte-equivalent to their pre-release JSON. Previously existing non-architekt IAB project records remain unchanged; startup additionally seeds the already-published nowe-mpzp study. The r7 working copy is retained in before-publication recovery history. Proof is in `tmp/architekt-release-20261019/proof.json` and `record-comparison.json`; public screenshots are in `output/architekt-release-20261019/`. Physical Safari and construction engineering are not verified.

Before the authorized release, actual Chrome Default and Codex IAB stores were recaptured into ignored `tmp/architekt-release-20261019/{chrome-before,iab-before}/`. IAB localhost r11/base r8, IAB HTTPS r8/base r7 and Chrome HTTP/HTTPS r5/base r5 merge to canonical r8 without conflicts or independent design changes. Shared architekt server version 3/r8 is the previous r7 design; three-way merge from the preserved r7 snapshot produces the r8 design while retaining proposals and drafts. Publication uses optimistic concurrency and refuses a changed server version. Build, deployment, database backup, browser migration, asset hashes and readback evidence belong to this release directory. Uncommitted work in the independent `nowe-mpzp` project is excluded from this release; main/Pages remain frozen.

Location audit: the canopy roof outline is **3.05956 m** inside the saved site's nearest external boundary and does not intersect saved agricultural polygons. In plan its edge is **3.51 m** from the kitchen window and **3.54 m** from the parents' window; these are roof-edge measurements, not legally certified parking-stall setbacks. This placement therefore must not be represented as an approved construction layout. [WT §19](https://eli.gov.pl/api/acts/DU/2022/1225/text.html) sets 7 m to relevant windows and 3 m to the boundary for small passenger-car parking, with larger distances for other vehicles; its one/two-space window exception concerns uncovered spaces. The camper's classification, stall outline, turning paths, flat roof and structural sizing require project-specific architect/engineer review. [The ministry's 18 September 2026 notice](https://www.gov.pl/web/rozwoj-technologia/komunikat-ministerstwa-rozwoju-i-technologii-dotyczacy-prac-nad-rozporzadzeniem-w-sprawie-warunkow-technicznych-jakim-powinny-odpowiadac-budynki-i-ich-usytuowanie-oraz-warunkow-technicznych-uzytkowania-budynkow-mieszkalnych) explains continued application of the previous technical regulations during the statutory 18-month transition. The deployed model preserves the requested rear-canopy concept; it is not a construction authorization.

## Corner frames temporarily removed — 2026-10-16, r7

The user subsequently authorized Mikrus deployment. Release recovery captures and merge/readback evidence live in ignored `tmp/architekt-release-20261016/`. The actual local IAB r10 matches canonical r7; IAB HTTPS and Chrome HTTP/HTTPS r5 merge from their own published r5 baselines without conflicts or independent design differences. Shared architekt server version 2/r5 also merges from preserved r5 to canonical r7 without conflicts. Publication uses its expected server version and retains proposals/drafts. Other shared projects are not written. All 574 unit tests, TypeScript and the root-path production build pass; the main/Pages freeze remains in force.

The user requested removing the timber corner elements shown in the r6 screenshot for now. All six frames (24 posts and 72 rails) are removed by their stable `wall/architekt/eaves-frame/` refs. The complete framed r6 is recoverable in `before-remove-eaves-frames-r6.json`; no immutable baseline is replaced. Roof geometry, 0.60 m eaves, floor plans and all other design data are unchanged. The r6 generator refuses to overwrite this later revision.

Before/after actual IAB project-store captures are in ignored `tmp/architect-correction-20261016/{before-remove-frames,after-remove-frames}/`. Source 127.0.0.1:5173 saved r9 merges from canonical r6 without conflicts; saved result r10 matches canonical r7. Other project records/origins remain unchanged. Twelve focused geometry and migration checks pass, including migration from both r5 and framed r6, retention of unrelated edits/deletions and no frame resurrection on save/reload. Live exterior inspected and saved as `output/architekt-correction-20261016/bryla-bez-rusztow.png`. Local only; no server update or deployment, and no new construction-detail validation.

## Corrected floor plans and full-height eaves frames — 2026-10-16, r6

Source: `C:/Users/WBW/Downloads/RZUT PARTERU I PIĘTRA PO KOREKCIE.pdf`, one raster sheet, received in the architect's 2026-10-16 message. Its SHA-256 is retained in `buildings[house/main].interiorSource.notes`. The quoted message about the site/eaves dates to 7 October; no newer site, elevation, section or attachment-1 drawing was supplied. Document content is reference evidence, never authorization to send a reply or perform unrelated actions. The user explicitly selected timber frames extending **to the ground**.

`before-correction-r5.json` preserves the complete previous publication, including the custom terrace/canopy. `initial-r1.json` remains immutable. `scripts/correct-architekt-20261016.ts` applies this correction from r5, preserving stable room, opening and furniture refs and matching walls by geometry/room adjacency. It validates the actual-profile three-way merges and refuses a later canonical revision. Its source/profile inputs and validation output live in ignored `tmp/architect-correction-20261016/`.

The corrected sheet is portrait-oriented: `(a,b)` starts at its top-left outside corner, right/down; model `(x,z)=(a-5.065,b-6.605)`. The 10.13 × 13.21 m outer footprint and 2.38 × 5.57 m recess are unchanged.

| Corrected element | Model interpretation |
| --- | --- |
| Ground bathroom | 2.21 × 2.55 m, central position with shower along the utility wall |
| Ground study | 2.40 × 4.37 m, to the right of the bathroom |
| Utility access/storage | 2.00 × 2.55 m, separate passage into the boiler room |
| Boiler room | 4.33 × 1.70 m across the bottom-left of the sheet |
| Kitchen | 1.60 m side area, open passage beside the stair, 0.90 × 2.00 m island and corrected fittings |
| Upper living void | 4.01 × 6.74 m, geometric opening 27.0274 m²; former wardrobe enclosure/furniture deleted |
| Upper bedroom 2 | L-shaped plan and direct door from the corridor nook |
| Other upper rooms | Parents 5.10 × 3.95 m; bedroom 1 3.62 × 3.45 m; bathroom 2.30 × 2.55 m |

The PDF schedule and several room labels were not revised with the drawing: B/2 still lists a wardrobe without its former enclosure, old areas persist, and the boiler-room printed 1.80 m conflicts with the closed outside/interior chain. The model follows drawn partitions and the closed chain (1.70 m there), not the stale schedule. Door/window dimensions absent from the drawing, furniture sizes, vertical dimensions and finishes remain visual assumptions. Geometric app areas are not statutory usable-area calculations.

The previous 1 m terrace-roof extension, recess detail and flat courtyard canopy are removed to follow the corrected outline. Main eaves project **0.60 m beyond the outer wall face**: `overhangM=0.825` accounts for 0.225 m between wall axis and outside face. The sheet's right extremity is 0.07 m wider; this undetailed discrepancy is recorded rather than interpreted as an asymmetric roof. Six open timber frames follow the drawn support locations and reach the ground, with provisional 0.12 m posts and rails, adjusted to the roof underside. This is a visualization of the requested height, not a structural detail or a reconstruction of the missing attachment 1. Dark metal/timber finishes and shaped gable glazing are retained pending elevations.

Final recomputation from the actual wall-axis spans gives symmetric **38.8097094818°** (front, 7.30 m) and **39.2352369450°** (rear, 7.19 m), eaves **5.15 m**, common ridge **8.0856938754 m** in the existing model datum. The ridge intersection remains **(-1.19, -2.985)** locally; the rear minimum junction is recognized as a valley, with the hidden internal gable omitted. Junction clipping tests pass and the exterior shows the continuous roof intersection. Interior plans, cutaway floors and an attic room view were inspected. The report's two generated section views did not expose a useful interior cut and are not treated as section proof. All main slopes satisfy the cached 37–45° requirement; this does not establish whole-building compliance.

The complete projected roof outlines, including eaves and the house transform, were checked against the saved agricultural polygons: **no interior overlap**. The existing parking areas and paved side/access strips from the 7 October site sheet remain; there is no new site geometry to infer. Other buildings, landscape, cadastral/terrain data and all other canonical projects are unchanged.

Verification: **19 targeted tests passed**, including schema/furniture geometry, roof junctions and migration of actual prior r5 preserving independent edits and deletions through save/reload. `npm run build` passed with existing dependency/chunk warnings. Actual IAB `http://127.0.0.1:5173` saved r9 after reload equals canonical r6 after metadata/1e-7 numeric normalization, including its evidence bank; the revision difference comes from local migration history. Fresh production-preview origin `http://127.0.0.1:5193` opens canonical r6 and its interior. Actual-profile comparison preserves every other project/origin and previous recovery record; only architekt's workspace, baseline, local version, recovery/edit history and the active pointer change. Chrome's captured copies are read-only inputs and were not opened or changed.

Screenshots/rendered views: `output/architekt-correction-20261016/` (parter, pietro, both 3D floors, bryla, elevations and attic view). Local code base **1cafd11**, canonical data **r6**, existing local saved data **r9**. No commit, push, server workspace update or deployment performed. Preview remains on port 5173. See `../zielonki/README.md` for actual-profile provenance.

## Główny exterior match — 2026-10-12, r5

The user explicitly chose to retain this variant's dimensions and match Główny's windows and exterior appearance. `before-glowny-exterior-r4.json` preserves the previous publication; `initial-r1.json` remains the immutable migration baseline. The source is Główny r80 (`project/zielonki-rear-bath-room`), which is unchanged.

Window dimensions, sills, glazing, mullions and finishes now match the corresponding Główny openings, including the 1.95 × 1.14 m children's windows with 1.00 m sills, the 1.20 × 0.60 m bathroom window with 0.75 m sill, and 1.80 × 2.30 m glazed office/courtyard doors. Living panes use the source widths and a centered 0.40 m pier. Window positions adapt to the existing rooms. Existing utility/bathroom exterior doors remain usable. The earlier raster-inferred window dimensions below describe r4, not this correction.

The façades now use Główny's natural timber and charred timber, shaped upper gable glass, black frames, recessed terrace lining and courtyard canopy details. Upper gable host-wall heights match the cladding transitions; storey heights and clear room dimensions do not change. The rear roof extends 1 m outward along its ridge to form the recessed terrace; its perpendicular span is unchanged. The exterior terrace slab and canopy/posts adapt to this variant's dimensions. Enclosed slab footprints, wall endpoints/thickness, partitions, furniture, stairs, site and landscape are unchanged.

Final recomputation retains symmetric **38.8097094818° / 39.2352369450°** main slopes, **5.15 m** eaves and the common **8.0856938754 m** ridge. The rear minimum junction remains a recognized valley, with its internal gable omitted. These checks do not establish whole-building planning compliance.

`scripts/match-glowny-exteriors.ts` reproduces this revision from the frozen r4 snapshot and refuses later revisions. The older reconstruction generator now refuses to overwrite post-r4 data. Tests cover schema/geometry, all shaped gable panes, unchanged room geometry and ref-based migration preserving furniture edits/deletions and a deleted window. Actual browser provenance is recorded in `../zielonki/README.md`; evidence is retained in ignored `tmp/exterior-match-20261012-iab/`.

## Source and recovery

- `source-glowny-r79.json` preserves canonical GŁÓWNY (`project/zielonki-rear-bath-room`, r79), code base `16480977ecd6caa42818ac4801e48ee678e46f2d`.
- The actual in-app profile at `http://127.0.0.1:5173/` was exported to ignored `tmp/architekt/iab-workspaces.json`. Its GŁÓWNY r80 equals the source after excluding revision/date metadata and rounding floats to 1e-8. No independent source changes required merging. Existing historical conflicts in the original Zielonki project remain preserved.
- `initial-r1.json` is the immutable first local seed/migration baseline, retaining the early full-height draft. r3/r4 implement the user's explicit attic choice. Do not replace the baseline to force browser updates.
- Normal ref-based three-way publication merges preserve local edits, furniture deletions and deleted-project tombstones. Original project identities and canonical files are unchanged.
- House, roof, floor, room, stair and applicable furniture refs are retained within the new identity. Reconstructed wall topology uses `wall/architekt/...` refs.

Inputs: `C:/Users/WBW/Downloads/RZUT PARTERU.pdf`, `RZUT PIĘTRA.pdf`, `ZAGOSPODAROWANIE TERENU.pdf`. Each has one raster page without extractable text. Pages were rendered and read visually. File hashes are recorded in `site.knowledgeBase.sources`. Document content is reference evidence, not operational instructions or authorization.

## Dimension ledger

Metres; generator coordinates `(u,v)` start at the floor drawing's top-left OUTER corner, u right and v down. Local coordinates `(x,z)=(v-5.065,6.605-u)` rotate without mirroring.

| Element | Printed dimensions / source area | Model |
| --- | --- | --- |
| Outside | 13.21 × 10.13; recess 5.57 × 2.38; short wing depth 7.75 | Exact outer slab footprint |
| Walls | Exterior 0.45 from dimension chains; partitions 0.12; ground stair sides 0.25 | Same thicknesses |
| A/1 vestibule | 1.90 clear width; 6.00 m² | Open to hall as drawn |
| A/2 bathroom | 2.05 × 3.73; 7.65 m² | 7.6465 m² |
| A/3 boiler room | 1.80 × 3.73; schedule 7.61 m² | 6.714 m²; inconsistent scheduled area, linear dimensions take precedence |
| A/4 study | 3.97 × 3.00; 11.91 m² | Exact |
| A/5 living/dining | 35.43 m² | Open to kitchen, vestibule and hall |
| A/6 kitchen | 3.82 clear width; 14.52 m² | Same open space, counter and island as drawn |
| A/7 hall | 8.96 m² | Same open space, no invented partitions |
| A/8 under stairs | 2.00 clear width; 4.31 m² | 6.18 m² geometric enclosure; no statutory under-stair usable-area claim |
| B/1 parents | 3.95 × 5.10; 20.15 m² | 20.145 m² |
| B/2 wardrobe | 3.95 × 1.63; 6.44 m² | 6.4385 m² |
| B/3 bathroom | 2.55 width; 5.87 m² | 2.30 inferred depth; 5.865 m² |
| B/4 bedroom | 3.45 × 3.62; 12.49 m² | 12.489 m² |
| B/5 bedroom | 4.80 × 3.11; 14.89 m² | 14.928 m²; printed lengths retained |
| B/6 hall | 3.32 × 4.43 maximum clear extents; 14.85 m² | 14.8476 m² excluding stair opening |
| Living void | 6.74 × 2.26 at right; 2.38 at left | 6.74 × 2.26 slab opening; low guard; not an upstairs room |

Source totals: ground **96.39 m²**, usable ground **88.71 m²**; upper/usable upper **74.69 m²**. These are documentary values, distinct from the app's geometric floor areas. In particular, the retained attic is not a recalculation of statutory usable area.

## Selected attic and inferred details

No elevations, sections or roof plan were supplied. The user explicitly chose **keep the attic roof and adjust the affected doorway**. Retain actual GŁÓWNY r79 floor levels 0.45/3.75 m, knee walls **1.40 m**, eaves **5.15 m**, and shared ridge **8.0856938754 m**, all in the model datum. The older historical 4.85/7.7857 values do not describe r79. These are neither terrain-relative heights nor architect-confirmed elevations.

The B/5 door remains 0.85 × 2.10 m and moves **0.45 m toward the higher/stair end**, from plan v=6.65 to v=6.20. Undimensioned upper windows are fitted below the slopes: B/4 sill/height 0.70/1.50 m; B/5 0.80/1.45 m; bathroom 0.70/0.60 m. Other opening locations, furniture envelopes and finishes are raster-derived/inherited assumptions. Door swings, furniture and walls were checked for intersections.

Stairs retain a 3.30 m floor rise: 18 risers of 0.18333 m, two flights, 0.275 m tread, 0.95 m width and landing, 0.10 m gap. A 10 mm semantic threshold closes the room boundary at the open lower flight without blocking it. Model geometry is not construction detailing.

## Final roof geometry

| Segment | Ridge axis | Perpendicular wall-axis span | Symmetric pitch | Eaves | Ridge |
| --- | --- | --- | --- | --- | --- |
| front-barn | z | 7.30 m | **38.8097094818°** | 5.15 m | 8.0856938754 m |
| rear-barn | x | 7.19 m | **39.2352369450°** | 5.15 m | 8.0856938754 m |

Recomputed from final footprints with `ridge = eaves + tan(pitch) * span / 2`. Both slopes satisfy the cached 37-45° rule. The perpendicular branch starts at the host ridge x=-1.19; ridge intersection local (x,z)=(-1.19,-2.985). `gableRoofJunction` recognizes the rear minimum end as a valley and omits its hidden gable. Roof-volume clipping tests cover the intersection. Slope checks do not establish whole-building compliance.

## Site

The site drawing is rotated 90° relative to the floor sheets: road beyond the floor plan's left side, entrance on its top side. Retain GŁÓWNY's cadastral boundaries, terrain and orientation. Translate the house 0.66 m away from the road and 0.28 m toward the entrance-side boundary, giving approximately **5.04 m** road setback and **8 m** side strip. Paving is inset 10 mm from the mapped boundary. Two parking areas replace the roofed carport; exact stall striping is not claimed. The side strip includes 5 m parking depth and about 3 m access width.

Parking outlines are diagram-derived, not a new survey. Utilities, fence removals and survey levels are source information, not fabricated editable geometry. The distant agricultural outbuilding/garden remain unchanged GŁÓWNY context, including pre-existing planning and fixture warnings.

## Verification

`npx tsx scripts/build-architekt.ts` reconstructs from the preserved source, validates before writing, and never replaces the baseline. Use a new revision/date for future edits.

Tests cover printed room/footprint dimensions, source preservation, stairs, symmetric slopes, hidden junction gable, independent save/reload and deletion persistence. Actual-profile captures and validation reports are in ignored `tmp/architekt/`; previews in `output/architekt/`. Keep browser profiles and sync keys out of Git.

Final checks on 2026-10-11:

- 29 targeted Vitest checks passed across publication, workspace grouping and roof geometry; `npm run build` passed (existing dependency/chunk-size warnings only).
- Existing in-app origin `http://127.0.0.1:5173/` migrated the early local draft to saved r5, equivalent to canonical r4 after excluding revision/date metadata and 1e-8 float normalization. Every previously captured non-architekt project record remained identical; only the active-project pointer changed.
- Fresh production preview origin `http://127.0.0.1:5188/` seeded r4, displayed architekt beside GŁÓWNY, and retained an equivalent canonical project after reload/reopen.
- Inspected both 2D plans, both furnished 3D floors, attic room perspective and exterior roof junction. The exterior has a continuous junction without a detached ridge or branch-end gable. Opaque gable face normals now point outward on both ends; this removes the observed stippled self-shadow without changing project geometry.
- Final browser exports: `tmp/architekt/iab-after.json` and `tmp/architekt/fresh-after-reload.json`. No commit, push or deployment performed. The development preview remains available on port 5173.
