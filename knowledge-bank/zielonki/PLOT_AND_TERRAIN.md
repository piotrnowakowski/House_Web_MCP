# Plot and terrain

## Parcel model

The `/3` parcels each contain residential/services land **06.MNU.8** and agricultural land **06.R.21**. The zoning boundary cuts across their interiors; it is not the cadastral boundary with `/4`. See [Zoning verification](ZONING.md) for sources, derived areas and permitted uses.

| Parcel | App role | Official area | 3D geometry |
| --- | --- | ---: | --- |
| 54/3 | Part MNU, part R | 282 m² | Surveyed from v2 DWG |
| 55/3 | Part MNU, part R | 315 m² | Surveyed from v2 DWG |
| 58/3 | Part MNU, part R | 603 m² | Surveyed from v2 DWG |
| 54/4 | Agricultural | 1,558 m² | Context-only footprint preserving official area |
| 55/4 | Agricultural | 1,458 m² | Context-only footprint preserving official area |
| 58/4 | Agricultural | 993 m² | Context-only footprint preserving official area |

Totals:

- Cadastral `/3`: 1,200 m²; approximately 699 m² MNU and 501 m² R.
- Agricultural `/4`: 4,009 m².
- All six parcels: 5,209 m².

The app's primary site outline is the complete six-parcel ownership area (`54/3 + 55/3 + 58/3 + 54/4 + 55/4 + 58/4`). Only the MNU portions of `/3` are designated for residential/services development, subject to the remaining planning requirements. All `/4` parcels and the R portions of `/3` are agricultural.

Two road entrances are shown on the outer road-facing edge of parcel 54. Their positions are approximate, transcribed from the owner's annotated screenshot on 3 September 2026, and are not survey setting-out coordinates.

The map closes the `/3` cadastral geometry used by the app but not the remote ends of every long `/4` parcel. The `/4` strips preserve official areas, their shared edge with `/3`, and the subdivision-map topology: `54/4` and `55/4` continue together to the far end, while `58/4` ends earlier. They remain context geometry rather than cadastral setting-out geometry.

## Working dimensions

For the combined `54/3 + 55/3 + 58/3` area:

- Road-side width: 28.5 m.
- Middle width: 33.2 m.
- Width at the cadastral boundary with `/4`: 37.9 m.
- Centreline depth: 32.3 m.

These describe the complete cadastral `/3` parcels, not the MNU area. They were calculated from DWG geometry and are not surveyor-signed dimensions.

## Terrain

- Cadastral district: `120617_2.0018 Zielonki`.
- Coordinate system: PL-2000 zone 7.
- Height system: PL-EVRF2007-NH.
- Survey spot-height range on and around the `/3` parcels: approximately 246.2–247.1 m.
- General fall: north-east toward south-west.
- Demo terrain gradient: approximately 1.8% relative to a 246.5 m local datum.

Keep new house mass within **06.MNU.8**. The MPZP zoning boundary and building setback lines are different constraints. Confirm all dimensions, offsets, utilities and planning constraints before setting out.
