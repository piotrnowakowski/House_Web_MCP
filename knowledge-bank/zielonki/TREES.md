# Trees registered to the emailed map

The source is `Zielonki_dz54_55_58-akt-v2.pdf`, sent to Elipsa on 18 August 2026 in Gmail message `1a011cb195c5e7ff` ("Materiały do projektu domu – Zielonki"), verified on 9 September 2026. It is identical to the previously retrieved `(1).pdf` attachment. SHA-256: `2F3E37E8EF694014184C32D173A8CEF4B5385FB7F249BFF2B1C22642FCF6A204`.

There are 17 symbols in the construction-area cluster: 11 conifers, three deciduous trees and three fruit trees. Distant roadside trees and the fruit-tree symbol in the legend are excluded. The three fruit-tree symbols are grouped at the right; two lie beyond the construction band in the neighbouring plot.

## Position correction

Version five incorrectly warped PDF tree centres to four cadastral corners using bilinear interpolation. This moved the main conifer row towards the parcel edge instead of following the diagonal boundary between MNU and R shown on the emailed map.

Version six uses the original CAD INSERT coordinates and the same rigid PL-2000-to-model transform as the MPZP geometry. The main row (handles 501E–5030) sits approximately 1.4–1.7 m inside the MNU side of the boundary, with the first cluster farther inward. Trees are neither snapped onto the boundary nor moved to avoid the conceptual house. Conflicts with the house therefore need separate design review. These are model-derived positions, not survey-grade setting-out coordinates. Parcel geometry and the solar north setting are unchanged.

Version six corrects existing version-five trees once when a workspace opens, including saved copies under different project identifiers. It updates positions and site/context classification while preserving names, heights, crowns, locks and deleted trees. Subsequent edits are preserved. Earlier inventories also receive the existing duplicate cleanup: the original apple/cherry/pear/plum identifiers are reused for four mapped symbols, giving 17 default trees. Non-tree planting, buildings and fixtures are preserved. Older pending proposals become stale so they cannot restore the incorrect layout.

## Appearance and height

The owner-reported approximate height is 15 m. Mapped trees use detailed, locally bundled, textured meshes for bark, branches and foliage: a pine representation for conifers and the existing photorealistic deciduous asset for the other categories. Models are rooted on the rendered terrain and scaled to the specified total height. Two neighbouring trees have a separate ground patch that does not extend the owned parcel boundary.

Crown diameters (5.2 m conifers, 7 m deciduous, 6 m fruit), generic growing requirements and evergreen conifer seasonality are illustrative. Tree species, heights and crowns are not measured by the map. Analytical shade uses coarse crown envelopes; rendered shadows use the mesh. Asset attribution and processing details are in `public/models/garden/README.md`.
