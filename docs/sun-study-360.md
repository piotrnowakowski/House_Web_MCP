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
