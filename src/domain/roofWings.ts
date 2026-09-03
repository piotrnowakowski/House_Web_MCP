import { roofSegmentRidgeElevation } from './roofs'
import type { BuildingModel, RoofType, WallModel } from './types'

/** One roof volume, read from the building's explicit roof segments so rendering, heights and sun occlusion share one source. */
export interface RoofWing { ref: string; footprint: BuildingModel['roof']['segments'][number]['footprint']; ridgeAxis: 'x' | 'z'; baseElevationM: number; ridgeElevationM: number; overhangM: number; type: RoofType }
export interface GableWallSurface { ref: string; segmentRef: string; side: 'min' | 'max'; axis: 'x' | 'z'; value: number; supportingWallRef?: string }

export const roofWings = (building: BuildingModel): RoofWing[] => building.roof.segments.map((segment) => ({
  ref: segment.ref, footprint: segment.footprint, ridgeAxis: segment.ridgeDirection, baseElevationM: segment.baseElevationM,
  ridgeElevationM: roofSegmentRidgeElevation(segment), overhangM: segment.overhangM, type: segment.type,
}))

/** The modeled wall directly below one gable end, used for its finish, selection and openings. */
export const gableEndWall = (building: BuildingModel, wing: RoofWing, axis: 'x' | 'z', value: number): WallModel | undefined => {
  const bounds = wing.footprint.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
  const across = axis === 'x' ? 'z' : 'x'
  const min = axis === 'x' ? bounds.minZ : bounds.minX
  const max = axis === 'x' ? bounds.maxZ : bounds.maxX
  return building.walls
    .filter((wall) => {
      const onEnd = (point: WallModel['start']) => Math.abs(point[axis] - value) < 0.05
      const wallMin = Math.min(wall.start[across], wall.end[across]); const wallMax = Math.max(wall.start[across], wall.end[across])
      return onEnd(wall.start) && onEnd(wall.end)
        && wall.baseElevationM + wall.heightM >= wing.baseElevationM - 0.05
        && wallMax > min - 0.05 && wallMin < max + 0.05
    })
    .sort((a, b) => {
      const overlap = (wall: WallModel) => Math.max(0, Math.min(max, Math.max(wall.start[across], wall.end[across])) - Math.max(min, Math.min(wall.start[across], wall.end[across])))
      return overlap(b) - overlap(a) || b.baseElevationM - a.baseElevationM
    })[0]
}

/** Separate semantic wall surfaces for the triangular ends above the top-storey walls. */
export const gableWallsForBuilding = (building: BuildingModel): GableWallSurface[] => roofWings(building).flatMap((wing) => {
  if (wing.type !== 'gable') return []
  const axis = wing.ridgeAxis === 'z' ? 'z' : 'x'
  const values = wing.footprint.map((point) => point[axis])
  return ([['min', Math.min(...values)], ['max', Math.max(...values)]] as const).map(([side, value]) => ({
    ref: `${wing.ref}/gable-wall/${side}`,
    segmentRef: wing.ref,
    side,
    axis,
    value,
    supportingWallRef: gableEndWall(building, wing, axis, value)?.ref,
  }))
})

export const roofRidgeElevation = (building: BuildingModel) => Math.max(building.roof.baseElevationM, ...roofWings(building).map((wing) => wing.ridgeElevationM))
