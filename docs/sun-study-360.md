# Światło 360°

Open **Światło 360°** from the plot or the interior floor toolbar. Select a floor,
then click a free spot on its plan. The dot is the observer and the fan shows the
view direction. Drag the preview or use its arrow buttons to look around at a
fixed eye position. The plan also supports arrow keys (20 cm; Shift: 50 cm).

The bottom timeline covers the selected civil date from 00:00 to 23:59. Drag it
to seek by minute, enter a time directly, or use the hour and sunrise/noon/sunset
buttons. Manual seeking pauses playback. Playback advances one simulated hour
per four seconds at 1×, stops at the end of the day and pauses in hidden tabs.
Date changes pause playback; the calendar supports leap years. All times use
the project's time zone, including its daylight-saving offset. On DST transition
dates the axis is civil clock time: it does not distinguish the repeated autumn
hour or represent the missing spring hour as an elapsed-time recording.

The view renders the existing full house, roof, furniture and surroundings.
It does not change the architectural project, revision, history or project data.
Eye position includes building rotation, ground offset and storey elevation.
Placement rejects walls, furniture, slab holes and insufficient headroom.
Trees and neighbor context can be toggled. Shadows remain enabled in this mode
even when the general renderer uses fast quality; the shadow camera focuses on
the observer's surroundings for better detail through openings.

This is a qualitative clear-sky visualization using the project's solar position
and model geometry. Ambient fill is approximate; no weather, indirect light
transport, measured illuminance, surveyed distant horizon or photometric glass
transmission is simulated. It is not a daylight-compliance calculation.

Checks: `npm test -- src/scene/sun/observer.test.ts src/state/store.test.ts
src/domain/solar.test.ts`; `npm run build`; browser coverage in
`tests/sun-study.spec.ts` (use a verified free port with `APP_URL`).


## Mobile release, 10 November 2026

Mobile widths up to 900 px open the simulation immediately. The point picker is
available under Miejsce and closes after a valid point is tapped. Portrait phones
also have an explicit Pokaz symulacje button. The launch button sits below the
compact plot toolbar, including landscape, and the bottom timeline is shortened
to keep the preview visible at 360 x 640.

The release uses the previously published house data: Architekt 7.11 r17, shared
server version 15. Actual Chrome Default and Profile 1 house storage was backed
up read-only; 39 workspace records were compared with their individual published
baselines. The one independent historical edit remains in its original storage.
All six shared workspaces were captured and compared; this code-only change
requires no project-data merge and preserves the active model and archived
identities. Other in-progress house edits remain in the original working copy.
Recovery and verification: tmp/sun-study-release-20261110/.

Published code: 52e3afd1f7259dc9a53199c5072616b7779464bc on Mikrus HTTP and
HTTPS. Public health/API checks passed; all 18 release assets match their frozen
SHA-256 manifest. All six shared workspaces match their pre-release snapshots.
The public production build passed four mobile flows: 360 x 640, 390 x 844,
844 x 390 and a replay of saved workspace data. Each verifies playback, seeking,
point selection, visible timeline, reload preservation and no shared writes or
page errors. These are touch-enabled browser checks, not a physical-device test.
The full unit suite passed 737 tests, the source browser suite passed 3 tests,
and lint plus frontend/API builds passed. Local production passed the same four
mobile flows. Evidence: live-mobile-report.json, release-verification.json and
logs in the recovery directory; images: output/sun-study-release-20261110/.

A complete 4064352-byte off-host database backup was verified with SHA-256
e030fdfbe4149c5acaf3d9c608df3673b40c265769431217d8d06d4d67fc2169.
Rollback Compose: /root/house-web-mcp/furnished-zielonki/deploy/mikrus/compose.yaml.before-20261110T193607Z.
Canonical house r17 and shared v15 remain unchanged; main/Pages were not deployed.

## Daylight rendering correction, 10 November 2026

The user's 15 July, 10:56 kitchen screenshot exposed two rendering problems:
alpha-blended lower window panes cast opaque depth shadows, and the PBR materials
had no radiance environment. Clear panes now transmit direct sun; opaque doors,
frames and mullions retain their shadows. A small generated sky/ground environment
supplies approximate diffuse fill and material reflections only in the 360 viewer.
It is generated once and scaled by solar altitude; it fades through civil twilight
and contributes zero at night. Fixed exposure is 1.2, with no night auto-brightening.

This remains a qualitative model: the environment is not a spatially occluded
indirect-light calculation and does not establish real indoor illuminance. No
material colours, house geometry, solar-position calculations or project data were
changed. Engine reference: https://threejs.org/docs/pages/MeshStandardMaterial.html
and https://threejs.org/docs/pages/Scene.html#environment.

Regression coverage renders the actual July kitchen, checks visible dark-material
pixels with/without environment illumination, verifies sunlit pixels lost when
panes are intentionally made opaque in the test, keeps opaque-door shadows and
checks day -> midnight -> day. The main unit suite passes 737 tests. Actual Chrome
Default and Profile 1 stores were captured read-only and compared independently;
39 historical workspace records are retained, including one independent edit.
The active canonical model is r17/shared v15 and all six shared snapshots match.
Evidence: tmp/sun-lighting-20261111/ and output/sun-lighting-20261111/.

## Full brightness and wider view

The footer now offers **Pełna jasność** as an explicit inspection mode. It keeps
indirect illumination on at any time of day and identifies the mode in the image;
turning it off restores the selected date's daylight/night rendering immediately.
The neighbouring **Wężej — Szerzej** slider adjusts vertical field of view from
55 to 110 degrees, starting at a more open 85 degrees. Camera position and the
observer dot remain fixed. These are view settings, never project-data edits.
Browser coverage verifies the projection changes without camera translation or
rotation, both zoom limits, brightness on/off at midnight and project preservation.
Final release evidence: tmp/sun-controls-20261110/.

On phone-sized layouts (up to 900 px), the floating "Zapisano lokalnie" bar is
hidden, as requested. Save/sync controls remain in the existing Więcej panel,
with no changes to autosave or persistence. Desktop placement is unchanged.
