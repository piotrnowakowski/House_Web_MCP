import { pointInPolygon, polygonCentroid, spaceFootprint } from '../domain/geometry'
import type { BuildingModel, InteriorFinish, Polygon2, StoreyModel } from '../domain/types'

const defaultFinish: InteriorFinish = { presetId: 'warm-white', color: '#F5F1E8', rotationDegrees: 0, tileM: 1 }

/** A roof lining above a slab opening belongs to the room below, independently of its flat ceiling. */
export function voidCeilingFinish(building: BuildingModel, upper: StoreyModel, hole: Polygon2): InteriorFinish {
  const centre = polygonCentroid(hole)
  const room = building.spaces.find(space => space.topBoundaryRef === upper.baseSlabRef
    && pointInPolygon(centre, spaceFootprint(building, space)))
  return room?.voidCeilingFinish ?? defaultFinish
}
