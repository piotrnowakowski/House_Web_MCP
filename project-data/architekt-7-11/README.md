# architekt 7.11

Independent project `project/architekt-7-11`, canonical revision 1. Requested on 7 November 2026; deployment authorized on 8 November. `source-architekt-r10.json` preserves the parent, and `initial-r1.json` is the immutable first-publication migration baseline. Existing entity refs are retained inside the new project.

## Source and scope

Architect email received 6 November 2026 at 15:55 CET, Gmail message `1a1b15b346d2baae`, thread `1a116c730417df1c`. Six PDF attachments were downloaded and inspected: ground floor, upper floor, section A-A, both pairs of elevations, and site plan. Original PDFs and rendered evidence are retained in ignored `tmp/architekt-20261107/source/`; their SHA256 hashes are recorded in the house's `interiorSource.notes`.

The house incorporates the vaulted bedrooms, roof-following upper glazing, centred parents' window, bathroom roof light replacing its side window, pantry door/shelving, revised floor heights and boxed eaves supports. The parent's complete site, landscape, house position, ground slab, carport and outbuilding are preserved. The supplied site-plan changes are excluded as requested. Existing room boundaries and dark metal/timber finishes are retained.

The 0.78 x 1.18 m roof light and boxed support details are visual assumptions; the package provides no product or structural sizes. The utility room remains 1.70 m deep: the printed 1.80 m conflicts with the closed dimension chain. This is a design visualization, not construction detailing. Existing furnishing-access warnings remain in the validation report.

## Geometry verification

Ground clear height 2.92 m, slab 0.33 m, upper floor +3.25 m above ground floor, knee wall 1.40 m. Bedroom ceilings follow the roof; hall and bathroom are capped at 2.70 m. The roof light is cut through the exterior panel and interior ceiling.

| Main roof | Perpendicular span | Eaves model datum | Recomputed pitch | Recomputed ridge |
| --- | --- | --- | --- | --- |
| Front barn | 7.75 m | 5.10 m | 40.000000 degrees | 8.3515110708 m |
| Rear barn | 7.64 m | 5.10 m | 40.4037944318 degrees | 8.3515110708 m |

Both symmetric gables satisfy the recorded 37–45 degree main-slope rule. Ridge elevation is computed from `eaves + tan(pitch) * span / 2`; it is +7.901511 m above ground-floor datum, matching the rounded +7.90 m section. Model datums are not certified height above terrain. The perpendicular rear-wing minimum end is recognized as a valley junction; its hidden internal gable is omitted. The common ridge, connected glazing and roof-light apertures have regression coverage. Exterior ceiling surfaces use the same roof-following geometry as the interior, avoiding protruding flat planes.

## Workspace preservation and release evidence

On 8 November, before integration and deployment, the actual Chrome Default and Codex in-app browser profiles were copied and read without application migrations. Recovery files, raw databases, per-origin extracted workspaces and comparisons are under primary checkout `tmp/architekt-release-20261108/`. Origins include localhost/127.0.0.1:5173 and both Mikrus HTTP/HTTPS origins. Current architekt working copies merge against their saved baseline to canonical r10 without independent changes or conflicts. All three shared workspaces match their canonical data after numeric normalization; shared versions were architekt 6, nowe-mpzp 15, nowe-mpzp-v2 13.

An unrelated historical in-app `http://127.0.0.1:5173` nowe-mpzp r1 copy retains entrance-coordinate and knowledge-base caveat conflicts. It is preserved unchanged, independently of this new project. No actual user browser database is reset or replaced.

Validation and browser evidence are retained under `tmp/architekt-20261107/` and `output/architekt-7-11/` in the isolated release worktree. Public release records and post-deployment verification are retained under primary checkout `tmp/architekt-release-20261108/`. Code revision and shared server version are checked separately from canonical revision 1. Fresh and captured existing-profile browser checks use disposable profiles.

Pre-release checks: 639 unit tests, TypeScript, frontend/API builds and the final six roof/ceiling tests passed. The browser regression suite passed 13 of 14 cases. Its mobile furniture-dimension mesh probe returns undefined; an isolated retry and the unchanged `588ea56` baseline reproduce the identical failure. The new project's launcher, seven exterior views, upper-floor plan/cutaway/room view and reload checks pass without browser errors. This release does not claim the pre-existing mobile mesh probe passed.

## Published 8 November 2026

Mikrus frontend and sync API run code `6abe6af619011f97e34c2783e221cd9095757e5f`. Canonical r1 was created as shared server version 1 using expectedVersion 0 and verified by readback. Original architekt, nowe-mpzp and nowe-mpzp-v2 shared workspaces remain exactly unchanged. HTTP and HTTPS health endpoints report the release SHA and API readiness. Published HTML, main JS, interior-editor JS and new project chunk match local build SHA256 hashes.

Fresh Chrome and an isolated replay of the actual Chrome HTTPS capture both receive canonical r1, preserve the existing projects, survive reopening/reload and report no browser errors. These checks do not overwrite the actual user profile. The release secret scan passed across 40 text assets. Detailed results: `tmp/architekt-release-20261108/verification.json`. Database recovery: ignored `tmp/house-sync-20261108T051048Z.dump`; remote rollback configuration: `compose.yaml.before-20261108T050748Z`. Main and GitHub Pages were not changed.
