import { buildingBaseElevation, buildingLocalBounds, pointInPolygon, polygonBounds, polygonCentroid, rectangle } from './geometry'
import type { BuildingModel, Polygon2, RoofType, Vec2 } from './types'

/** One pitched roof volume. Rectangular footprints have a single wing; an axis-aligned L footprint has two. */
export interface RoofWing { footprint: Polygon2; ridgeAxis: 'x' | 'z'; baseElevationM: number; ridgeElevationM: number; overhangM: number; type: RoofType }

const FLAT_ROOF_THICKNESS_M = 0.24
const EPSILON = 1e-6
const rad = (degrees: number) => degrees * Math.PI / 180
const boundsRectangle = (footprint: Polygon2): Polygon2 => {
  const bounds = polygonBounds(footprint)
  return rectangle({ x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
}
const longerAxis = (footprint: Polygon2): 'x' | 'z' => { const bounds = polygonBounds(footprint); return bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ ? 'x' : 'z' }

/** Splits an axis-aligned six-vertex L into a full-span wing and a projecting wing; null for any other shape. */
const splitLFootprint = (footprint: Polygon2): Array<{ footprint: Polygon2; ridgeAxis: 'x' | 'z' }> | null => {
  if (footprint.length !== 6) return null
  const axisAligned = footprint.every((point, index) => { const next = footprint[(index + 1) % footprint.length]; return Math.abs(point.x - next.x) < EPSILON || Math.abs(point.z - next.z) < EPSILON })
  if (!axisAligned) return null
  const bounds = polygonBounds(footprint)
  const notch = footprint.find((point) => point.x > bounds.minX + EPSILON && point.x < bounds.maxX - EPSILON && point.z > bounds.minZ + EPSILON && point.z < bounds.maxZ - EPSILON)
  if (!notch) return null
  const centre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
  const corners: Vec2[] = [{ x: bounds.minX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.maxZ }, { x: bounds.minX, z: bounds.maxZ }]
  const missing = corners.find((corner) => !pointInPolygon({ x: corner.x + Math.sign(centre.x - corner.x) * 1e-3, z: corner.z + Math.sign(centre.z - corner.z) * 1e-3 }, footprint))
  if (!missing) return null
  const fullSpanZ = missing.z === bounds.maxZ ? [bounds.minZ, notch.z] : [notch.z, bounds.maxZ]
  const projectingX = missing.x === bounds.maxX ? [bounds.minX, notch.x] : [notch.x, bounds.maxX]
  const projectingZ = missing.z === bounds.maxZ ? [notch.z, bounds.maxZ] : [bounds.minZ, notch.z]
  const fullSpan = rectangle({ x: centre.x, z: (fullSpanZ[0] + fullSpanZ[1]) / 2 }, bounds.maxX - bounds.minX, fullSpanZ[1] - fullSpanZ[0])
  const projecting = rectangle({ x: (projectingX[0] + projectingX[1]) / 2, z: (projectingZ[0] + projectingZ[1]) / 2 }, projectingX[1] - projectingX[0], projectingZ[1] - projectingZ[0])
  return [fullSpan, projecting].map((part) => ({ footprint: part, ridgeAxis: longerAxis(part) }))
}

/** Top of the highest storey whose base slab covers the wing centroid; falls back to the roof's own base. */
const wingBaseElevation = (building: BuildingModel, footprint: Polygon2) => {
  const centroid = polygonCentroid(footprint)
  const covering = building.storeys
    .filter((storey) => { const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef); return Boolean(slab && pointInPolygon(centroid, slab.footprint)) })
    .sort((a, b) => b.level - a.level)[0]
  return covering ? covering.elevationM + covering.clearHeightM : building.roof.baseElevationM
}

export const roofWings = (building: BuildingModel): RoofWing[] => {
  const footprint = building.roof.footprint ?? building.slabs[0]?.footprint ?? rectangle({ x: 0, z: 0 }, 4, 4)
  const parts = (building.roof.type === 'gable' ? splitLFootprint(footprint) : null) ?? [{ footprint: boundsRectangle(footprint), ridgeAxis: 'z' as const }]
  return parts.map((part) => {
    const bounds = polygonBounds(part.footprint)
    const span = part.ridgeAxis === 'x' ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX
    const baseElevationM = wingBaseElevation(building, part.footprint)
    const rise = building.roof.type === 'flat' ? FLAT_ROOF_THICKNESS_M : Math.tan(rad(building.roof.pitchDegrees)) * (span / 2 + building.roof.overhangM)
    return { footprint: part.footprint, ridgeAxis: part.ridgeAxis, baseElevationM, ridgeElevationM: baseElevationM + rise, overhangM: building.roof.overhangM, type: building.roof.type }
  })
}

export const roofRidgeElevation = (building: BuildingModel) => Math.max(...roofWings(building).map((wing) => wing.ridgeElevationM))

export const buildingPlacement = (building: BuildingModel) => {
  const bounds = buildingLocalBounds(building)
  const baseElevationM = buildingBaseElevation(building)
  return {
    ref: building.ref, name: building.name, positionM: building.position, rotationDegrees: building.rotationDegrees,
    widthM: bounds.maxX - bounds.minX, depthM: bounds.maxZ - bounds.minZ,
    heightM: roofRidgeElevation(building) - baseElevationM, baseElevationM,
  }
}
