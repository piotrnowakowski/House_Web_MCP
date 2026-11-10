# architekt 7.11 wersja 2

Independent project `project/architekt-7-11-v2`, requested on 9 November 2026.
Canonical revision: 2. The parent `project/architekt-7-11` remains revision 6.

Source: the canonical architekt 7.11 r6 and HTTPS Mikrus shared version 6 matched by content before this fork. The exact parent snapshot is retained as `source-architekt-711-r6.json`; `initial-r1.json` is this variant's immutable first-publication migration baseline.

Removed furniture by stable reference:

- `interior/architekt-711/under-stair-cabinet`: 0.95 m fitted cabinet below the upper flight.
- `interior/architekt-711/stair-junction-filler`: adjacent 0.25 m connector, ending the kitchen bank cleanly.

The under-stair space stays empty. All other furniture and entity references, stairs, pantry wall and concealed door, room and roof geometry, island and appliances, garden and other buildings are retained exactly. Updated only the obsolete interior note describing the removed extension. Roof geometry has no change.

Before editing, both actual Chrome profiles were captured across localhost, public HTTP and HTTPS into primary `tmp/architekt-711-v2-20261109/`. Neither contained an architekt 7.11 workspace. The current Codex browser partition has no IndexedDB directory; its earlier recovery captures remain intact. Live shared data is retained separately. No original browser records were overwritten or reset.

The new project is registered independently in the launcher, with its own migration baseline. Regression checks cover source preservation, schema/geometry, save/reload, later publication retaining furniture/tree deletions, and project tombstones. Public browser verification is recorded below after deployment.

Local verification: all 652 unit tests pass; TypeScript/frontend and API builds pass. Fresh desktop/mobile and an isolated replay of the actual Chrome HTTPS records show the new launcher entry, the empty stair area and stable save/reload. The parent r6 stays unchanged. Screenshots: `output/architekt-711-v2-20261109/`; reports: `tmp/architekt-711-v2-20261109/`.

Published on 9 November 2026: code `26b6f6f06d8b584ae74c997cef21eb93c64e3f20`, project r1, shared server version 1. HTTP/HTTPS health and API readiness passed; published HTML, main bundle, interior bundle and project bundle match the validated build byte-for-byte. The live launcher opens the new variant in fresh desktop/mobile contexts and an isolated replay of the captured Chrome HTTPS records. Save/reload retains the exact canonical project, without the removed cabinet/filler, and without page errors. All four prior shared workspaces remain byte-for-byte equivalent to their pre-publication snapshots, including parent architekt 7.11 r6/server version 6.

Pre-activation database recovery: `tmp/house-sync-20261109T214807Z.dump`, 2,142,347 bytes, verified SHA256 `717f693566e3cdb1788e31052238fa2167697a49ff4b7069c004baa13a3ef88e`. Rollback configuration: `compose.yaml.before-20261109T214617Z`. Recovery/evidence copies and final live screenshots are retained in the primary workspace. Main/GitHub Pages are unchanged.

## Island seating, 10 November 2026 — canonical r2

The user requested a wider island with knee space for stools. The worktop is now **280 × 110 cm**, widening only towards the living room. Its centre is x=-0.645, z=-4.035 m; the working edge remains x=-1.195 m, retaining the **110 cm** aisle to the tall kitchen fronts. Both island ends, the sink and the hob remain fixed.

The new optional `seatingOverhangM=0.38` makes a physical **38 cm** recess beneath the local +z seating edge, with a **72 cm** cabinet body. The working drawer fronts are on local -z. This is explicit per-item geometry; older islands and other projects retain their existing appearance. Both stools move 20 cm towards the living room and are lowered to 65 cm, leaving 27 cm to the nominal 92 cm worktop. The nominal clear height below the 25 mm top is 89.5 cm. Countertop material and concealed support require joinery detailing; no structural capacity is claimed.

The supplied Vento photo was clarified as a style example, not a product selection. No sofa replacement is included in this publication. The initial 320 × 220 cm rectangular reservation would be 104.5 cm from the widened island edge; the refined circulation proposal places the short sofa return by the glazing, moves the coffee table and relocates the armchair, so the recess inside the L is available behind the stools. That proposal remains an analysis artifact, separate from the actual published furniture.

`before-island-seating-r1.json` preserves the previous publication; immutable `initial-r1.json` is unchanged. Actual Chrome Default and Profile 1 house databases were copied and read separately under primary `tmp/island-seating-20261110/`; neither contains this project. The Codex browser partition has no IndexedDB directory. All six shared projects were captured independently. Shared v2 server version 1 exactly matched the r1 baseline before editing, with no local v2 changes to merge. All other projects, house/roof/stair/storey/slab geometry and garden are retained.

Validation: 660 unit tests, TypeScript/frontend and API builds pass. Focused checks verify fixed appliance positions, the retained working aisle, supported appliance footprints within the shortened cabinet body, stool height/placement, invalid overhang rejection, and r1 migration retaining independent furniture/tree deletions across reload. Fresh desktop/mobile and replay of actual captured records seeded with the prior r1 preserve canonical r2 on reload without page errors. Local kitchen views were inspected; evidence is under `tmp/island-seating-20261110/` and `output/island-seating-20261110/`. Release text assets pass the secret scan.

Published on Mikrus on 10 November: code `bc6d32899ff5216ba0f1553be9797b9b8ea54c4e`, canonical r2, shared server version 2. HTTP/HTTPS health and API readiness, exact HTML/main/interior/project asset hashes, and fresh desktop/mobile plus captured-record replay with r1 migration/reload pass. All five other shared projects remain identical to their captured snapshots. Inspection of the actual renderer element geometry also confirms 18 empty knee-space probes below the top and the retained cabinet body. Live screenshots and publication records are retained in the primary checkout. Main/GitHub Pages are unchanged.

The verified pre-activation database backup is primary `tmp/house-sync-20261110T004943Z.dump`, 2,243,397 bytes, SHA256 `b50f1a63da50ec96722451608f32663d01c17530d6aee68bc1847d06effb78b9`. Rollback configuration: `compose.yaml.before-20261110T004754Z`.
