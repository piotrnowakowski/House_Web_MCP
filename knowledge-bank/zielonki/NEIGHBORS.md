# Neighbor context and north verification — 10 September 2026

**Neighbors** is an optional layer, off in a fresh browser and remembered locally. Enabling it includes the same building surfaces in scene shadows and the sun-hours heatmap. Context buildings do not affect owner floor areas, plot coverage or room editing.

**Distance recheck, r46:** the original eighth Google Maps estimate was wrong by 14.84 m at its centroid. It is now replaced by cadastral building `120617_2.0018.64/2.1_BUD`, retaining ref `neighbor/south-east-map`. The shortest gap to the designed house changes from 53.43 m to 62.47 m. The other seven footprints and the north reference are unchanged. See [independent distance verification](NEIGHBOR_DISTANCES.md).

## Sources and accuracy

- Seven footprints come from black vector outlines in `Zielonki_dz54_55_58-akt-v2.pdf`, prepared 12 March 2026 and verified 1 July 2026: [surveyor's email](https://mail.google.com/mail/#all/19f27717889d2f98). They comprise three buildings across the access lane and four structures on parcel 59. Some thin outlines carry construction labels; the map alone does not establish completion or current use.
- The [owner's email](https://mail.google.com/mail/#all/19db9693355fee25) links to [Google Maps](https://maps.app.goo.gl/KwqmoWTBDVLFcUJu6), resolving to **50.135688, 19.902641**. The north-up satellite view was inspected on 10 September 2026. It corroborates the lane, road junction and roofs, and shows an additional south-east house outside the survey's building outlines. That eighth footprint is approximate. Imagery capture date was not established. No Google imagery is bundled.
- **All heights, ground offsets and roof forms are estimated.** Offsets of 0.3–1.4 m are conceptual, informed by nearby spot levels relative to the 246.5 m datum, not surveyed threshold heights. Windows and floor levels are unknown. The neutral masses omit fabricated windows. Viewpoints at 1.6 m and 4.6 m above assumed ground illustrate potential sight directions, not visibility from actual windows. Exact privacy/shadow assessment needs measured heights, terrain, roof forms and openings.
- `neighbors.json` and the canonical project retain stable refs, sources, dates and confidence. Seven footprints are PDF-derived and the eighth now uses cadastral vectors. The original aerial footprint described below is superseded; its two-anchor calibration was insufficient for reliable placement across the lane. Roof overhangs and aerial parallax are unresolved. Context ground is conceptual, consistent with the existing flat scene terrain.

## Map-to-model transform

The PDF is 1191 × 1191 points. The top-left-coordinate grid cross at **(844.8,831.0)** is labelled **E=7421600,N=5556050**, PL-2000 zone 7 (EPSG:2178). Grid spacing is approximately **283.38 points per 50 m**, with 0.12-point export rounding.

```text
E = 7421600 + (u - 844.8) / (283.38 / 50)
N = 5556050 - (v - 831.0) / (283.38 / 50)
s = hypot(20.822, 31.644)
dE = E - 7421523.183; dN = N - 5556062.474
x = (20.822*dE - 31.644*dN) / s
z = (-31.644*dE - 20.822*dN) / s
```

PDF curve indices 214, 215, 2445 and 2450 supply four thin outlines. Three closed outlines were polygonized from black 0.96-point strokes (PDF bounds 205.08/583.20–288.72/665.88, 528.60/354.96–622.44/427.32 and 752.04/574.08–800.64/620.40). These indices refer to this attachment, not stable CAD handles.

The eighth outline was traced in the north-up Google viewport at 1539 × 823 CSS pixels. Roof centres approximately (476,448) and (616,328) correspond to model (-35.988,10.680) and (-34.470,-22.849). A similarity transform maps roof corners (1012,516), (1037,555), (1081,527), (1057,488). This is an image estimate, not a verified wall footprint.

## True north correction

The old **−56.7°** had the wrong sign for north's model-z component. The unchanged CAD basis gives grid north **−123.345230°**, using `north=(sin(angle),0,cos(angle))`. PROJ transforms the CAD origin to **50.135450043 N,19.902235433 E**. The email pin lies about 39 m away in the same site area; it is not the survey origin.

Stepping latitude by 0.0001° at constant longitude and projecting back through EPSG:2178 gives true north **−124.187875°**. The −0.84265° difference is meridian convergence. Both model components of north are negative; east has positive x and negative z. `orientation.ts` records this frame and the tests verify its signs against the geographic-north step.

Compass, solar conversion and plan arrows use `site.northDegrees`. Solar latitude/longitude now use the surveyed origin. House, roofs, plot and landscape remain in the same positions; only the directional reference changed.

## Controls and checks

- Desktop: **Neighbors** and the adjacent settings button beside Sun controls.
- Mobile: building icon in the top strip; settings under **More → Neighbor buildings**. Choosing a facade viewpoint closes the sheet. Layer toggling preserves the camera. **Refocus** returns to the house overview.
- `run_analysis(kind: 'sunlight')` accepts `includeNeighbors`; omission follows the current view option in WebMCP. Results record this flag. Other domain callers default to excluding optional context; seasonal planting guidance keeps its owner-site assumptions.
- `get_project_state(detail: 'site')` returns compact summaries; `objectRef: 'neighbor/…'` returns the full context record. JSON import/export preserves the optional layer; older projects still load.
- `node scripts/audit-neighbors.mjs --url http://127.0.0.1:5173/` checks desktop, portrait, landscape, camera behavior, persistence and unchanged owner data in isolated browser profiles. Local Vite checks inspect scene meshes and shadow flags. Use `--output` to select the evidence directory.
