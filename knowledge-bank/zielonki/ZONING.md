# Zielonki zoning verification — 8 September 2026

## Result

**54/3, 55/3 and 58/3 are each partly 06.MNU.8 and partly 06.R.21.** The division is a diagonal through their interiors. It is neither the `/3`–`/4` cadastral division nor the separate building setback line. All three `/4` parcels are agricultural 06.R.21.

The municipal certificate **BU.6727.596.2026, 30 June 2026**, explicitly identifies these designations. It was retrieved from [the owner's Gmail, attachment mpzp.pdf](https://mail.google.com/mail/#all/19f1db89b8d7ffbe), and cross-checked against the duplicate MPZP_Zielonki.pdf in the architect packet. Source documents were treated as evidence, not instructions.

## Operative plan and uses

The [municipal planning register](https://rejestrurbanistyczny.gison.pl/zielonki), checked on 8 September 2026, lists **IX/55/2007, 21 June 2007**, as the operative plan for area 06. Its “Zobacz zmiany” entry lists **XIV/26/2020, 30 January 2020**. The [2020 amendment](https://edziennik.malopolska.uw.gov.pl/WDU_K/2020/1251/akt.pdf) changes the text, including parking provisions and repeal of §13(2)(2), and expressly leaves the plan drawing unchanged.

Under the [original plan text](https://rastry.gison.pl/mpzp-public/zielonki/uchwaly/U_06_2007_55_IX.pdf):

- **§19, MNU:** basic use is single-family residential development, with permitted complementary uses including non-nuisance services. It specifies maximum development coverage of 50% and minimum biologically active area of 50%, alongside other design requirements.
- **§28, R:** agricultural uses include crops, grassland, horticulture and orchards. New buildings are prohibited, with provisions for existing buildings. This is not the separate RS farmstead designation.

The [court judgment published in 2025, item 3643](https://edziennik.malopolska.uw.gov.pl/WDU_K/2025/3643/akt.pdf) invalidates §13(2)(2); it does not redraw the MNU/R boundary. The [September 2026 consultation notice](https://zielonki.pl/wylozenie-planow-miejscowych/) concerns draft plans and is not an adopted replacement zoning map. The municipal certificate also identifies the Dolinki Krakowskie landscape park.

This establishes the land-use split, not approval of a particular building design. The MNU area is not the net available building footprint: setbacks and the plan's remaining provisions still apply.

## Geometry and derived areas

The supplied `Zielonki_dz54_55_58-akt-v2 (2).dwg` contains usable vector zoning dashes on `_MPZP`, despite also referring to unavailable external raster files. The relevant trace uses LINE handles `5882–589B`, with the main parcel-crossing run `5887–5896`. Labels `58EA` and `58EE` identify 06.R.21 and 06.MNU.8. The separately marked setback polyline `591A` was not used as the zoning boundary.

The trace was checked against the [official plan GeoTIFF](https://rastry.gison.pl/tiff/zielonki_2000/Z01_06_2007_55_IX.tif) and the older Gmail map `Zielonki_dz54_55_58-podz_v1+MPZP.pdf`. The official raster agrees visually with the DWG zoning trace. Its approximately 1.694 m pixel size limits independent position verification.

CAD coordinates use easting/northing in PL-2000 zone 7. The main run starts at `(7421504.270, 5556072.060)` and bends at `(7421536.775863, 5556050.608731)`. Conversion uses the existing app origin `(7421523.183, 5556062.474)`, normalized local x basis `(20.822, -31.644)` and local z basis `(-31.644, -20.822)`. Clipping against the existing surveyed `/3` polygons gives this local trace in metres:

```text
(-18.403, 10.530) → (17.384, -4.833) → (18.635, -5.211)
```

The split polygons are stored in [zoning.ts](zoning.ts). Coordinate decimals preserve the calculation, not a claim of millimetre survey accuracy.

| Parcel | Official cadastral area | Approx. MNU area | Approx. R area |
| --- | ---: | ---: | ---: |
| 54/3 | 282 m² | 217 m² | 65 m² |
| 55/3 | 315 m² | 203 m² | 112 m² |
| 58/3 | 603 m² | 279 m² | 324 m² |
| Total `/3` | 1,200 m² | 699 m² | 501 m² |

The unrounded polygon results are 216.81/64.88, 203.12/112.29 and 278.59/324.31 m². Small differences against individual official areas result from the existing rounded CAD-derived parcel geometry. Official cadastral areas remain unchanged; these zoning areas are working estimates.

## Application behavior

The shared Zielonki template and both house presets use the same zoning subdivisions. Residential/services portions are amber, agricultural portions green, and a dashed amber line identifies the zoning boundary. Existing designs that overlap agricultural portions receive a visible warning and a `building.zoning` validation issue.

Saved Zielonki workspaces, copies and proposal snapshots are upgraded when listed or loaded locally. Proposal checks are recalculated after the upgrade. The v4 cadastral outline, entrances and building designs are preserved. Older pre-v4 workspaces also receive the previously established cadastral-outline correction. Generic non-Zielonki terrain projects keep their own land data. No website deployment is part of this update.
