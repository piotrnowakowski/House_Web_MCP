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

## Roof check — 9 September 2026

For MN/MNU, **§13(6)(4)** of [IX/55/2007, page 15](https://rastry.gison.pl/mpzp-public/zielonki/uchwaly/U_06_2007_55_IX.pdf#page=15) specifies a symmetric gable or hipped roof, main slopes **37–45°**, ridge height up to **9 m**, and eaves/verge projection at least **0.60 m**. Dark grey roofs are among the colours described in §13(6)(11). The [2020 amendment](https://edziennik.malopolska.uw.gov.pl/WDU_K/2020/1251/akt.pdf), checked in the downloaded PDF, does not change §13(6)(4); it repeals the innovative-architecture exception and changes parking requirements.

The fitted house now uses pitches within 37–45°, preserving the perpendicular ridge junction and dark standing-seam finish. Its main gable stops at the upper-floor wall, with a separate flat roof over the exposed garage as requested by the user. The cited text does **not** establish general permission for this flat garage terrace; its acceptability requires project-specific confirmation. Eaves projection, roofing material and the remainder of the building have not been certified as compliant by this change. The app's 8.90 m target is a measurement over modelled terrain at roof centres, not a legal assessment of building height.

## Outbuilding roof follow-up — 10 September 2026

The user's question about the r52 flat outbuilding roof prompted a recheck of the original plan and the official indexed text of the [2020 amendment](https://edziennik.malopolska.uw.gov.pl/GetActPdf.ashx?book=0&position=1251&year=2020). Direct retrieval of the amendment PDF returned a gateway error during this check; its indexed official text confirms the repeal of §13(2)(2), and the previously inspected local evidence records that §13(6)(4) was not amended. The municipal consultation notice still describes draft plans, not an adopted replacement.

**A flat roof on this outbuilding has not been established as permissible.** In the original plan, §13(9)(1) extends §13(6)(4–12) to economic buildings associated with business activity, and §13(9)(2) gives a 7 m ridge-height limit. The below-37° provision in §13(8)(1) concerns its U/ZPU context; it is not a general flat-roof exemption for this site. Classification of the mixed private garage/workshop/sauna concept requires project-specific assessment. More fundamentally, its requested location is 06.R.21, where §28 prohibits new buildings.

R53 therefore uses a symmetric 37° outbuilding gable, 0.60 m overhangs, 3.80 m eaves and approximately 6.25 m ridge as a conservative visual revision. This is not a finding that the whole building, open pergola, use or location complies. The main-house roofs remain unchanged. The prior flat-roof r52 is retained in `project-data/zielonki-v2/before-house-facing-outbuilding-r52.json` for recovery.

## Geometry and derived areas

### Roof rule cached for geometry work — 11 September 2026

Rechecked the original official plan PDF, page 15, §13(6)(4): **37–45°**, symmetric gable or hipped main slopes for MN/MNU. The 2020 official amendment remains indexed, but both direct PDF endpoints returned gateway errors during this recheck; the previously downloaded/inspected amendment evidence above records no change to this clause. Use the cached rule in `AGENTS.md` for routine edits; reopen the legal sources only when the plan/site changes, new amendment evidence appears or a fresh legal verification is requested.

Narrowing the house had left both slopes at 40.134234° despite unequal 6.08/7.55 m spans, separating their ridge elevations by about 0.620 m and leaving the branch termination 0.75 m away from the new host ridge. Front-carport r67 and rear-carport r88 restore the common model ridge at **7.7856938754 m**, with respective front/rear slopes **44° / 37.8710376967°**, eaves 4.85 m and existing 1.40 m knee walls. The branch now terminates at host centre X **-0.955 m**, restoring valley clipping and removing the hidden interior gable/host sheet. Model ridge elevation is not legal ground-to-ridge height; all previously recorded limitations regarding overhangs, flat structures and whole-building compliance remain.

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
