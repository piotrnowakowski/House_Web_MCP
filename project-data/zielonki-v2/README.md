# zielonki v2

Current published data: **project/zielonki-v2, revision 49**. This continues the v2 created in “Run app locally”; it does not create a third design. Open the car icon beside **Neighbors**, then **zielonki v2 · Carport**, or open v2 in Projects. The original house remains `project/zielonki-spatial-v2` r46. Both designs preserve their independent edits when switching.

## Revision 49 — remove front terrace and trim the side pergola

The user highlighted the front pergola in `Zrzut ekranu 2026-09-10 184434.png`. That entire front bay (`roof/zielonki-v2/garden-pergola`) and the paving in front of the house are removed. The retained side bay (`roof/reference/courtyard-canopy`) is shortened to the front outside wall face at local z=8.485 m: its 12 cm end beam is centred at z=8.425 m, with slats and end posts moved accordingly. The remaining rectangular terrace has local corners (2.185, 1.095) and (5.595, 8.485), so its paving also ends flush with the wall.

House rotation/position, carport, room geometry, main roof pitch, north, neighbors, fixtures and plants remain unchanged from r48. `before-terrace-trim-r48.json` preserves the previous published project; the original r46 migration baseline is unchanged. The normal entity-based published-data merge preserves independent edits and reports edit-versus-delete conflicts.

The actual public-origin Codex browser was captured before editing in ignored `tmp/v2-terrace-trim-recovery-20260910-185010`. Its full exported records exactly match the r48 pre-deployment capture (original project only, no additional v2 working copy or new edits). This change therefore starts from tracked published v2 r48. Tests verify the physical beam/paving alignment, deletion across reload, and unchanged house/carport geometry. The original house remains published r46.

## Revision 48 — user-requested 180° rotation

On 2026-09-10 the existing v2 was turned 180° as a complete assembly: house, both retained pergolas and carport. Rotation is now **273.06927082481445°**. The anchor moves from (−8.630577683, −6.209756862) to **(−6.628904317, −3.057048028)**: rotating in place would cross MNU and reduce the outside-wall road distance to 2.17 m. The corrected position retains **4.00 m** from outside house faces to the surveyed road parcel edge, with every roof/pergola footprint inside MNU. This is still a conceptual setback, not a verified legal building line.

The carport is now north-northwest, so its visible name no longer says “South”. Its opposite open edge connects to the rebuilt road apron. Terrace and entrance path follow the house. Local room, wall, opening, furniture and roof geometry are identical to r47; 1.40 m knee walls and 40.134234° gables are unchanged. North, neighbors, plants and fixtures remain fixed in survey coordinates. Existing tree deletions remain deletions.

`before-rotation-r47.json` preserves the complete previous published project. It supplements, and does not replace, the immutable first-publication r46 baseline. Existing browser r47 data merges using its own saved published baseline; tests verify an independent room rename and car deletion survive this rotation and reload.

Actual public-origin browser data was captured on 2026-09-10 at 18:37:30 Europe/Warsaw from the Codex profile for `http://natan203.mikrus.xyz:20203/`. Raw profile backup and full exported records are in ignored `tmp/v2-rotation-recovery-20260910-183730/`. This origin contained the original project only and exactly matched the previous pre-deployment capture; no new browser edits or merge conflicts were found. V2 changes therefore use the tracked published r47, not a test profile. The original project remains untouched at published r46.

## Source, recovery and merge — r47 history

The actual Codex browser profile at `http://localhost:5173/` was captured on 2026-09-10 at 18:09:26 Europe/Warsaw, with active `project/zielonki-v2` r46, saved 2026-09-10T15:07:28.021Z. Its data equals the previous tracked v2 exactly. Raw profile plus complete workspace/proposal records are recoverable in ignored `tmp/v2-carport-recovery-20260910-180926/`.

- `project.json` is now v2 r49; `before-rotation-r47.json` preserves the r47 carport and room/placement changes.
- `before-carport-r46.json` is the immutable baseline for first publication of this existing v2 identity. Existing browser v2 projects merge against it by entity ref and field; later publications use their saved published baseline. Revision counters do not settle conflicts. A merged existing browser may display r48 while having the same design content as published r47.
- `before-pergola-r45.json` retains the complete earlier workspace and the common baseline for shared site evidence. The reviewed cadastral neighbor correction from original-house commit `244e264` is merged by ref/field against that baseline; independent v2 data is preserved and divergent fields would stop generation. No conflicts were found in the captured data.
- Conflicting browser placement, edit/delete and same-field changes retain both versions; Projects reports the conflicts. No profile is reset and the original project is not replaced.

## V2 geometry — r47 placement before the rotation

Both existing open pergolas, all upstairs spaces and the stair/slab opening are retained. The shortened building has no enclosed garage extension, garage gate, old car or roof terrace. The main roof segments remain at 40.13423424862029° and the attic knee walls remain 1.40 m.

The revised ground floor follows the supplied screenshot: open living/kitchen/dining and entrance hall, kitchen and stairs beside the carport, bathroom (about 7.18 m² clear), guest bedroom/study (14.71 m²) and utility (9.57 m²). The utility has an exterior entrance and a bathroom connection; the guest bedroom is private. Dimensions are adapted to the retained upper floor, not presented as a measured architectural reproduction. Retained room refs and geometrically unchanged wall refs remain stable; changed topology uses new wall refs.

The kitchen-side carport is south-southeast, with access toward the road. To achieve that orientation the whole house/pergolas are rotated 180° from previous v2, to 93.06927082481445°. Site north, trees, garden fixtures and neighbors retain their survey coordinates. The carport is independently selectable and has a 6.40 × 6.40 m footprint, four 16 cm posts, a graphite roof/timber soffit and two 1.90 × 4.70 m car envelopes in 3.20 m parking modules. The entrance has no middle post, 5.92 m clear width and approximately 2.44 m clearance beneath the fascia. These are visual configurations, not structural specifications or verified vehicle swept paths.

Outside house faces are 4.00 m from the surveyed road parcel edge; the carport slab is approximately 4.10 m from it. House position is x −8.630577683 m, z −6.209756862 m in model coordinates. The carport roof/fascia governs the shift toward the diagonal MNU/R limit: approximately 0.15 m remains inside MNU; the house is approximately 3.35 m away. House, carport and both pergolas remain in mapped 06.MNU.8. The entry path/apron and L-shaped garden terrace move with the design.

**4 m is the requested conceptual setback, not a confirmed legal minimum.** [MPZP IX/55/2007 §6(2)(1)](https://rastry.gison.pl/mpzp-public/zielonki/uchwaly/U_06_2007_55_IX.pdf) requires the line on the plan drawing. Road-side building line (CAD 591A), road category, driveway permission, canopy setbacks, turning paths and whole-building compliance remain unverified. Preserving the main roof pitch does not establish those permissions. See [zoning evidence](../../knowledge-bank/zielonki/ZONING.md).

Five survey trees intersect the carport: `plant/survey-5012`, `plant/survey-5015`, `plant/survey-5018`, `plant/survey-501b`, `plant/apple`. Their deletion is a **proposed removal in v2 only**, disclosed in the chooser and model notes. The original house and r46 recovery baseline preserve their records. `plant/orchard-plum` and all six garden fixtures remain at their original world positions. This visualization is not tree-removal authorization.

## Build and verification

`python scripts/build-carport-study.py --output tmp/carport.json` deterministically reconstructs the historical r47 revision in `before-rotation-r47.json` from the v2 r46 baseline, common r45 baseline and reviewed neighbor data. It does not reproduce the later rotation. Do not use it to overwrite current `project.json` or any historical baseline.

`node scripts/audit-house-studies.mjs --url http://127.0.0.1:5173/` checks desktop/mobile switching, independent saves, reload, modal focus and 44 px targets at 1440×1000, 360×640, 390×844 and 844×390. Screenshots and results are in ignored `output/carport-study/`. Unit tests verify the existing v2 migration, both retained pergolas, room/opening geometry, MNU fit, road distance, true-south side, deletion survival and conflict preservation. Worker tests prevent stale geometry when revisions decrease across projects or undo operations.

## Historical notes: v2 r46 before this publication

The following describes the earlier local-only revision and its recovery evidence, not the current publication state.

Current local project: project/zielonki-v2, revision 46, saved 2026-09-10T15:07:28.021Z. Created as an independent copy of the actual Codex in-app browser workspace at http://localhost:5173/, source project/zielonki-spatial-v2 r45. The original capture matched the tracked source JSON.

## Revision 46 — lighter house with an open pergola

The projecting garage bay was shortened by 3.17 m to the upper-floor facade at local z=8.385 m. The enclosed area beneath the retained bedrooms is now a garden room with glazed garden doors, preserving its stable space ref. The garage gate, car and garage shelving were removed. The ground slab ends at z=8.485 m. All upstairs rooms remain; both former terrace doors are now windows with 1.00 m sills.

The garage roof segment and its terrace/guards were deleted. The courtyard canopy is now a slatted pergola, with a second bay across the former projecting garage footprint. The frames have 12 cm posts and 18 cm beams, with 7 cm timber slats at approximately 45 cm spacing; top elevation is 3.10 m in building coordinates. These are open, non-walkable structures without an opaque roof, fascia skirt or glass guards. Both main gables retain 40.13423424862029 degrees, unchanged eaves/ridges and 1.40 m knee walls. This model is a design concept, not a structural design or confirmation of whole-building planning compliance.

The change uses only the captured v2 r45 as its baseline. No changes were merged into the original project. All retained entity refs, six plants, six garden fixtures, site evidence and other room/furniture data are preserved. During verification a separate canonical-project edit triggered automatic refresh; v2 was reopened and verified without importing that update.

## Recovery and storage

project.json is the current extracted v2 model. before-pergola-r45.json contains the complete previous workspace. The browser also has a recoverable project named "zielonki v2 · przed pergolą" (project/zielonki-v2/before-pergola-r45). The raw capture is in tmp/zielonki-v2-pergola-2026-09-10T15-02-45-869Z/before.json. Original pre-copy backups remain in tmp/zielonki-v2-2026-09-10T14-59-25-899Z/.

The v2 option is saved in IndexedDB at http://localhost:5173/. This data is not bundled as a fresh-profile default or published to another origin. No commit, push, deployment or migration-baseline replacement was performed. Code baseline for this work: 244220544fea63c96de1f2bd029a9385841147d9 plus existing working changes.

## Pergola model and checks

RoofSegmentModel.canopy.slats optionally specifies direction (x or z, the beam span), spacingM and widthM. Only axis-aligned rectangular flat segments with open gaps and no roof terrace are valid. The shared pergolaMembers helper supplies the renderer and sunlight occluders, so light passes through the gaps. Existing solid canopies keep their behavior.

Schema/domain validation and TypeScript checks passed. Tests cover open-versus-solid shade, schema round trips, post/beam connections, and v2 save/load, restore migrations and canonical synchronization without recreating deleted garage elements. Actual-browser reload/open preserved the exact v2 JSON. Both main gables and bedrooms equal the r45 baseline.
