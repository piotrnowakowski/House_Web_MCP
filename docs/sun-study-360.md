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
