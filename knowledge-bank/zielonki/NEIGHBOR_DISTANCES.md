# Neighbor distance recheck — 10 September 2026

The seven survey-derived footprints match the original PDF vector outlines. The eighth, estimated from two Google Maps image anchors, was misplaced. Revision 46 replaces that footprint with the cadastral building `120617_2.0018.64/2.1_BUD`, while retaining `neighbor/south-east-map` for migration and saved references. Its estimated roof direction now follows its corrected long edge. All heights remain estimates.

## Independent evidence

- Reopened the original survey PDF and inspected its labelled grid cross, E=7421600 / N=5556050. Repeated 50 m grid spans are 283.32–283.44 PDF points, agreeing with the 283.38-point scale used by the import. All 17 known CAD tree insertion coordinates overlay their corresponding symbols; no shifted origin, mirrored axis or wrong scale was found.
- Queried the [official EGiB aggregate WFS](https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza?SERVICE=WFS&REQUEST=GetCapabilities), described by [Geoportal](https://www.geoportal.gov.pl/pl/dane/ewidencja-gruntow-i-budynkow-egib/). GetFeature used version 2.0.0, `ms:budynki` and `ms:dzialki`, CRS `urn:ogc:def:crs:EPSG::2178`, bbox `5555990,7421450,5556190,7421690` in **northing,easting** axis order, count 200. Returned 13 buildings and 63 parcels; no truncation. Only geometry/identifiers needed for this check are retained in the evidence extract; raw responses remain in ignored `tmp/neighbors/`.
- The three `/3` parcel boundaries match cadastral vectors within 0.008 m (parcel response date 2026-09-06). The apparent PDF line mismatch was resolved by this independent coordinate comparison; no parcel change is warranted.
- Building 34/5 (`120617_2.0015.34/5.1_BUD`), 34/3 (`120617_2.0015.34/3.1_BUD`) and the parcel-59 outbuilding (`120617_2.0018.59.1_BUD`) agree with cadastral vectors within 0.025 m. The other four outlines are confirmed against the survey PDF, not independently against WFS: they were absent from its returned building set. Labels/construction status in the survey need not imply a currently registered completed building.
- The eighth building's centroid was displaced **14.836 m**; the old four-corner footprint also had the wrong outline. Its maximum boundary discrepancy was 18.541 m. The corrected raw coordinate ring and source ID are in [neighbor-distance-evidence.json](neighbor-distance-evidence.json).

Small residuals above quantify agreement between transcriptions and sources, not ground-truth survey accuracy. Google roof images include overhangs, perspective/parallax and uncertain capture date; the retired image calibration is not a distance reference.

## Horizontal clearances in canonical r46

Distances use the shortest gap from the current designed house's outside wall faces and slabs across both floors to each neighbor's mapped outline. They are not centre-to-centre distances and exclude roof overhangs. The second column measures to the union of surveyed parcels 54/3, 55/3 and 58/3, not to a presumed fence.

| Neighbor ref | House → neighbor | Parcels /3 → neighbor |
| --- | ---: | ---: |
| 34-5 | 19.8 m | 11.6 m |
| 34-4 | 16.4 m | 10.3 m |
| 34-3 | 50.0 m | 44.0 m |
| 59-main | 52.8 m | 46.1 m |
| 59-outbuilding | 54.1 m | 49.5 m |
| 59-shed-a | 37.4 m | 33.4 m |
| 59-shed-b | 40.3 m | 36.2 m |
| south-east-map → cadastral 64/2 | **62.5 m** (previously 53.4 m) | **52.3 m** (previously 42.1 m) |

House geometry, placement, knee walls, roofs, plot, north, landscape and the other seven neighbors are unchanged. This check verifies the eight modeled footprints; it does not establish that the optional layer contains every building in the surrounding area. Heights, roof forms and window locations still limit privacy and shadow accuracy.
