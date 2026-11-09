# architekt 7.11 — schody 12 + 6

Independent project `project/architekt-7-11-stairs-12-6`, canonical revision 1, requested on 9 November 2026. The user explicitly selected the original architekt 7.11 r6 **with** its under-stair cabinets as the source. The parent and the separate version 2 are not modified. `source-architekt-711-r6.json` preserves the exact parent; `initial-r1.json` is this variant's immutable first-publication baseline.

## Geometry

The floor-to-floor rise stays 3.25 m. Eighteen equal risers of 180.5556 mm are redistributed as 12 lower / 6 upper, with 264 mm goings; `2h+s=625.1111 mm`. Both flights remain 950 mm wide. The middle landing remains 970 mm deep and moves from +1.625 m to +2.1666667 m above the ground floor.

The lower going is 2.904 m, extending its start 744 mm into the hall, to local x=-0.711 m. The upper going is 1.320 m, moving the exit 840 mm back to the kitchen-front plane x=-2.295 m. The original 3.160 x 2.000 m slab hole receives an 840 x 950 mm infill **only over the upper-flight end**. Its remaining polygon is L-shaped. The lower-flight opening remains unchanged; filling both lanes would produce insufficient headroom.

The recomputed minimum vertical model clearance above the lower treads under the existing slab is 2.3783333 m. The upper exit opens onto the new floor. The glass guard follows the notched slab edge and does not obstruct the exit or move to the lower flight's extended foot. Both flight rail profiles, walking surfaces, closed risers, landing closure and 2D walking arrow use the unequal flight split.

The physical stair renderer allows for 40 mm clearance deductions when validating flight/landing width. These model dimensions and the 80 mm stair finish geometry are conceptual, not structural sizing. Final slab/stair support, reinforcement, rail fixings and construction tolerances require architect/engineer confirmation.

All kitchen cabinetry, concealed pantry door, the 2.80 x 0.90 m island, living furniture, windows, fireplace, walls, storeys, roofs, landscape and other buildings are unchanged. Stable entity refs are retained. Roof geometry is unchanged: inherited main slopes 40 / 40.4037944318 degrees and common model ridge 8.3515110708 m.

## Source preservation

Before the fork, actual Chrome Default and Profile 1 house IndexedDB data were copied read-only into primary `tmp/stairs-12-6-20261109/`. Neither contains this source project. The current Codex browser partition has no IndexedDB directory; historical recovery files remain untouched. Mikrus HTTPS shared architekt 7.11 server version 6 matches canonical r6 by normalized content. All shared projects were captured independently. Raw captures and source comparisons are retained outside Git; no actual browser database was reset or overwritten.

The variant has an independent launcher entry and publication baseline. Tests cover source preservation, equal rises and goings, the partial slab infill and its headroom, unobstructed guarded exit, save/reload, future migrations retaining furniture/tree deletions, and project tombstones. Release evidence is recorded below after verification.

Local verification: 658 unit tests passed, followed by 23 focused stair/source tests after the final rail adjustment. TypeScript, frontend/API builds and the release secret scan pass. Two browser regression tests cover furniture editing/autosave and wall/opening editing. Fresh desktop/mobile and an isolated replay of the actual Chrome HTTPS project records load the new variant and retain it across reload; the parent remains unchanged. Stair, kitchen, hall, ground-plan, upper-plan and upper-exit views were inspected. New flight panels retain at least 0.92 m above tread edges; both exposed middle-landing sides have 1.00 m glass guards. Final raw browser captures and shared comparison were repeated before integration/publication. Evidence: `tmp/stairs-12-6-20261109/` and `output/stairs-12-6-20261109/`.

## Published 9 November 2026

Mikrus frontend and sync API run code `73a9eef36d709832f936e11713c7a1a9c883ba2c`. Canonical r1 was published as independent shared server version 1 with expectedVersion 0 and verified by readback. All five pre-existing shared project snapshots, including original architekt 7.11 r6 and version 2, remain exactly unchanged. HTTP/HTTPS health and API readiness, exact HTML/main/interior/project asset hashes, and fresh desktop/mobile plus captured-existing-project replay/save/reload all pass without page errors. Live hall, kitchen, ground/upper plans and upper-exit views were inspected. The upper-floor plan now occludes the extended lower treads beneath the slab. This is a conceptual model, not structural construction approval.

SFTP disconnected while downloading the pre-switch database backup. Activation resumed only after recovering the complete 2,192,355-byte backup through bounded SSH chunks and verifying SHA256 `7d73805e8946c415eb481d2956b1c61b8b7ea5f24706235a57a616d740a90ec7`. Recovery: primary `tmp/stairs-12-6-20261109/house-sync-20261109T220943Z-complete.dump`; the 393,216-byte partial download remains separate and is not a valid backup. The pending Compose configuration, release archive checksum and candidate images were revalidated before activation. Rollback: `compose.yaml.before-20261109T220747Z`. Public verification reports and screenshots are retained in primary and isolated worktree `tmp/stairs-12-6-20261109/` and `output/stairs-12-6-20261109/`. Main and GitHub Pages were not changed.
