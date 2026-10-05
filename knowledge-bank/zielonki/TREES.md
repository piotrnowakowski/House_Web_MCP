# Trees registered to the emailed map

The source is `Zielonki_dz54_55_58-akt-v2 (1).pdf`, Gmail message `1a0196e4bcf56171`, re-fetched on 8 September 2026. SHA-256: `2F3E37E8EF694014184C32D173A8CEF4B5385FB7F249BFF2B1C22642FCF6A204`.

There are 17 symbols in the construction-area cluster: 11 conifers, three deciduous trees and three fruit trees. Distant roadside trees and the fruit-tree symbol in the legend are excluded. The three fruit-tree symbols are grouped at the right; two lie beyond the construction band in the neighbouring plot.

## Position correction

Version four combined tree INSERT coordinates from the CAD file with a displayed parcel layout that does not align with the emailed PDF. It put the conifers through the conceptual house. Those coordinates are retained only for migration regression coverage, not used for current placement.

`trees.ts` records the centres extracted from the PDF vector paths in page points (top-left origin). Four visible construction-band corners are registered to the displayed construction band's four corners using bilinear interpolation. The conifers now follow the garden edge, with the left-hand cluster farther inward; the three fruit trees are on the right. This is an approximate visual registration to the existing model, not survey-grade setting-out coordinates: the PDF outline and the model's parcel polygon are not congruent. Parcel geometry and the solar north setting are unchanged.

Version five repairs existing saves once. The original apple/cherry/pear/plum identifiers are reused for four mapped symbols rather than drawing duplicate demo trees: the default study now contains 17 trees, not 21. Their source categories are recorded without inventing species. Non-tree planting, buildings and fixtures are preserved. The migration preserves explicit heights and locks; subsequent tree edits and deletions are preserved. Older pending proposals become stale so they cannot restore the incorrect layout.

## Appearance and height

The owner-reported approximate height is 15 m. Mapped trees use detailed, locally bundled, textured meshes for bark, branches and foliage: a pine representation for conifers and the existing photorealistic deciduous asset for the other categories. Models are rooted on the rendered terrain and scaled to the specified total height. Two neighbouring trees have a separate ground patch that does not extend the owned parcel boundary.

Crown diameters (5.2 m conifers, 7 m deciduous, 6 m fruit), generic growing requirements and evergreen conifer seasonality are illustrative. Tree species, heights and crowns are not measured by the map. Analytical shade uses coarse crown envelopes; rendered shadows use the mesh. Asset attribution and processing details are in `public/models/garden/README.md`.
