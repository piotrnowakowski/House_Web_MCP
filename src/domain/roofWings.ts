import { roofSegmentRidgeElevation } from './roofs'
import type { BuildingModel, RoofType } from './types'

/** One roof volume, read from the building's explicit roof segments so rendering, heights and sun occlusion share one source. */
export interface RoofWing { ref: string; footprint: BuildingModel['roof']['segments'][number]['footprint']; ridgeAxis: 'x' | 'z'; baseElevationM: number; ridgeElevationM: number; overhangM: number; type: RoofType }

export const roofWings = (building: BuildingModel): RoofWing[] => building.roof.segments.map((segment) => ({
  ref: segment.ref, footprint: segment.footprint, ridgeAxis: segment.ridgeDirection, baseElevationM: segment.baseElevationM,
  ridgeElevationM: roofSegmentRidgeElevation(segment), overhangM: segment.overhangM, type: segment.type,
}))

export const roofRidgeElevation = (building: BuildingModel) => Math.max(building.roof.baseElevationM, ...roofWings(building).map((wing) => wing.ridgeElevationM))
