import { pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonBounds, polygonCentroid } from './geometry'
import type { BuildingModel, Polygon2, RoofFinish, RoofSegmentModel } from './types'

export const defaultRoofFinish: RoofFinish = { material: 'standing-seam-metal', colorHex: '#2D3435' }

export const roofSegmentRise = (segment: RoofSegmentModel) => {
  if (segment.type === 'flat') return 0.24
  const bounds = polygonBounds(segment.footprint)
  const span = segment.ridgeDirection === 'z' ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ
  return Math.tan(segment.pitchDegrees * Math.PI / 180) * span / 2
}

export const roofSegmentRidgeElevation = (segment: RoofSegmentModel) => segment.baseElevationM + roofSegmentRise(segment)

export const highestRoofElevation = (building: BuildingModel) => Math.max(...building.roof.segments.map(roofSegmentRidgeElevation), building.roof.baseElevationM)

const box = (minX: number, maxX: number, minZ: number, maxZ: number): Polygon2 => [
  { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ },
]

/** Resolves a simple orthogonal six-corner L into the two rectangular wings that form it. */
export const decomposeOrthogonalLFootprint = (footprint: Polygon2): [Polygon2, Polygon2] | null => {
  if (footprint.length !== 6) return null
  const xs = [...new Set(footprint.map((point) => point.x))].sort((a, b) => a - b)
  const zs = [...new Set(footprint.map((point) => point.z))].sort((a, b) => a - b)
  if (xs.length !== 3 || zs.length !== 3 || footprint.some((point, index) => {
    const next = footprint[(index + 1) % footprint.length]
    return point.x !== next.x && point.z !== next.z
  })) return null
  const [minX, midX, maxX] = xs; const [minZ, midZ, maxZ] = zs
  const candidates: Array<[Polygon2, Polygon2]> = [
    [box(minX, maxX, minZ, midZ), box(minX, midX, midZ, maxZ)],
    [box(minX, maxX, minZ, midZ), box(midX, maxX, midZ, maxZ)],
    [box(minX, maxX, midZ, maxZ), box(minX, midX, minZ, midZ)],
    [box(minX, maxX, midZ, maxZ), box(midX, maxX, minZ, midZ)],
  ]
  const area = polygonArea(footprint)
  return candidates.find((candidate) => Math.abs(candidate.reduce((sum, polygon) => sum + polygonArea(polygon), 0) - area) < 0.02
    && candidate.every((polygon) => {
      const center = polygonCentroid(polygon)
      return pointInPolygon(center, footprint) || pointOnPolygonBoundary(center, footprint)
    })) ?? null
}

export const ridgeDirectionForFootprint = (footprint: Polygon2): RoofSegmentModel['ridgeDirection'] => {
  const bounds = polygonBounds(footprint)
  return bounds.maxX - bounds.minX >= bounds.maxZ - bounds.minZ ? 'x' : 'z'
}

export const segmentContainsFootprint = (segment: RoofSegmentModel, footprint: Polygon2) => {
  const center = polygonCentroid(segment.footprint)
  return pointInPolygon(center, footprint) || pointOnPolygonBoundary(center, footprint)
}

export const supportingWallRefs = (building: BuildingModel, segment: RoofSegmentModel) => {
  if (segment.spaceRef) {
    const space = building.spaces.find((item) => item.ref === segment.spaceRef)
    if (space) return [...new Set(space.boundary.map((item) => item.wallRef))]
  }
  const storey = building.storeys.find((item) => item.ref === segment.storeyRef)
  if (!storey) return []
  return storey.wallRefs.filter((ref) => {
    const wall = building.walls.find((item) => item.ref === ref)
    if (!wall) return false
    const middle = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }
    return pointInPolygon(middle, segment.footprint) || pointOnPolygonBoundary(middle, segment.footprint)
  })
}

export const roofSegmentSummary = (segment: RoofSegmentModel, junctions: BuildingModel['roof']['junctions'] = []) => ({
  segmentRef: segment.ref,
  footprint: segment.footprint,
  storeyRef: segment.storeyRef,
  spaceRef: segment.spaceRef,
  eavesElevationM: Number(segment.baseElevationM.toFixed(3)),
  ridgeElevationM: Number(roofSegmentRidgeElevation(segment).toFixed(3)),
  roofType: segment.type,
  pitchDegrees: segment.pitchDegrees,
  overhangM: segment.overhangM,
  ridgeDirection: segment.ridgeDirection,
  finish: segment.finish,
  gableWallFinishes: segment.gableWallFinishes,
  junctions: junctions.filter((junction) => junction.segmentRefs.includes(segment.ref)),
})
