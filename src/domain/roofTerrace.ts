import { mergeAdjacentPolygons } from './geometry'
import type { BuildingModel, RoofSegmentModel } from './types'

/** One outer perimeter for adjoining terrace decks, with no railing on their shared seams. */
export function roofTerraceOutline(building: BuildingModel, segment: RoofSegmentModel) {
  let outline = segment.footprint
  const seen = new Set([segment.ref])
  for (const ref of segment.terrace?.connectedSegmentRefs ?? []) {
    const other = building.roof.segments.find((item) => item.ref === ref)
    if (!other || seen.has(ref) || other.terrace || other.type !== 'flat' || segment.type !== 'flat' || Math.abs(other.baseElevationM - segment.baseElevationM) > 0.001) {
      throw new Error('Connected terrace decks must be distinct, flat, at the same elevation and share one guard.')
    }
    seen.add(ref)
    outline = mergeAdjacentPolygons(outline, other.footprint)
  }
  return outline
}
