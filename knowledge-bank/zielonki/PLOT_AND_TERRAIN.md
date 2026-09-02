# Plot and terrain

## Parcel model

The owner brief treats suffix `/3` as the house construction site and suffix `/4` as agricultural land. This is an application constraint, not an independent legal zoning determination.

| Parcel | App role | Official area | 3D geometry |
| --- | --- | ---: | --- |
| 54/3 | Construction | 282 m² | Surveyed from v2 DWG |
| 55/3 | Construction | 315 m² | Surveyed from v2 DWG |
| 58/3 | Construction | 603 m² | Surveyed from v2 DWG |
| 54/4 | Agricultural | 1,558 m² | Context-only footprint preserving official area |
| 55/4 | Agricultural | 1,458 m² | Context-only footprint preserving official area |
| 58/4 | Agricultural | 993 m² | Context-only footprint preserving official area |

Totals:

- Construction `/3`: 1,200 m².
- Agricultural `/4`: 4,009 m².
- All six parcels: 5,209 m².

The map closes the `/3` construction geometry used by the app but not the remote ends of every long `/4` parcel. The `/4` strips preserve official areas and their shared edge with `/3`, but they are context geometry rather than cadastral setting-out geometry.

## Working dimensions

For the combined `54/3 + 55/3 + 58/3` area:

- Road-side width: 28.5 m.
- Middle width: 33.2 m.
- Width at the agricultural boundary: 37.9 m.
- Centreline depth: 32.3 m.

These values were calculated from DWG geometry and are not surveyor-signed dimensions.

## Terrain

- Cadastral district: `120617_2.0018 Zielonki`.
- Coordinate system: PL-2000 zone 7.
- Height system: PL-EVRF2007-NH.
- Survey spot-height range on and around the construction band: approximately 246.2–247.1 m.
- General fall: north-east toward south-west.
- Demo terrain gradient: approximately 1.8% relative to a 246.5 m local datum.

Keep permanent house mass within `54/3 + 55/3 + 58/3`. Confirm all dimensions, offsets, utilities and planning constraints before setting out.
