# architekt 7.11 wersja 2

Independent project `project/architekt-7-11-v2`, requested on 9 November 2026.
Canonical revision: 1. The parent `project/architekt-7-11` remains revision 6.

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
