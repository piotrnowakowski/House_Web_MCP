import type { BuildingModel, Polygon2, ProjectV2, SpaceModel, Vec2, WallModel } from './types'

export const polygonSignedArea = (points: Polygon2) => points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]
  return sum + point.x * next.z - next.x * point.z
}, 0) / 2

export const polygonArea = (points: Polygon2) => Math.abs(polygonSignedArea(points))

export const polygonCentroid = (points: Polygon2): Vec2 => {
  const area6 = polygonSignedArea(points) * 6
  if (Math.abs(area6) < 1e-8) return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, z: sum.z + point.z / points.length }), { x: 0, z: 0 })
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    const cross = point.x * next.z - next.x * point.z
    return { x: sum.x + (point.x + next.x) * cross / area6, z: sum.z + (point.z + next.z) * cross / area6 }
  }, { x: 0, z: 0 })
}

export const polygonBounds = (points: Polygon2) => points.reduce((bounds, point) => ({
  minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
  minZ: Math.min(bounds.minZ, point.z), maxZ: Math.max(bounds.maxZ, point.z),
}), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })

const orient = (a: Vec2, b: Vec2, c: Vec2) => Math.sign((b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z))
const segmentsIntersect = (a: Vec2, b: Vec2, c: Vec2, d: Vec2) => orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b)

export const polygonSelfIntersects = (points: Polygon2) => points.some((a, index) => {
  const b = points[(index + 1) % points.length]
  return points.some((c, otherIndex) => {
    const d = points[(otherIndex + 1) % points.length]
    if (index === otherIndex || (index + 1) % points.length === otherIndex || index === (otherIndex + 1) % points.length) return false
    return segmentsIntersect(a, b, c, d)
  })
})

export const pointInPolygon = (point: Vec2, polygon: Polygon2) => polygon.reduce((inside, vertex, index) => {
  const previous = polygon[(index + polygon.length - 1) % polygon.length]
  const intersects = (vertex.z > point.z) !== (previous.z > point.z)
    && point.x < (previous.x - vertex.x) * (point.z - vertex.z) / (previous.z - vertex.z || Number.EPSILON) + vertex.x
  return intersects ? !inside : inside
}, false)

export const wallLength = (wall: WallModel) => Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)

export const spaceFootprint = (building: BuildingModel, space: SpaceModel): Polygon2 => space.boundary.map((use) => {
  const wall = building.walls.find((item) => item.ref === use.wallRef)
  if (!wall) throw new Error(`Wall not found: ${use.wallRef}`)
  return use.direction === 1 ? wall.start : wall.end
})

export const buildingLocalBounds = (building: BuildingModel) => {
  const points = building.slabs.flatMap((slab) => slab.footprint)
  return points.length ? polygonBounds(points) : { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }
}

export const buildingBaseElevation = (building: BuildingModel) => building.slabs.length
  ? Math.min(...building.slabs.map((slab) => slab.topElevationM - slab.thicknessM))
  : 0

export const buildingGroundOffset = (building: BuildingModel, terrainSurfaceY = 0) => terrainSurfaceY - buildingBaseElevation(building)

export const buildingFootprintsWorld = (building: BuildingModel) => {
  const rotation = building.rotationDegrees * Math.PI / 180; const cosine = Math.cos(rotation); const sine = Math.sin(rotation)
  return building.slabs.map((slab) => slab.footprint.map((point) => ({
    x: building.position.x + point.x * cosine + point.z * sine,
    z: building.position.z - point.x * sine + point.z * cosine,
  })))
}

export const buildingPlacement = (building: BuildingModel) => {
  const bounds = buildingLocalBounds(building)
  const baseElevationM = buildingBaseElevation(building)
  const roofTop = building.roof.baseElevationM + (building.roof.type === 'flat' ? 0.24 : Math.tan(building.roof.pitchDegrees * Math.PI / 180) * (bounds.maxX - bounds.minX) / 2)
  return {
    ref: building.ref, name: building.name, positionM: building.position, rotationDegrees: building.rotationDegrees,
    widthM: bounds.maxX - bounds.minX, depthM: bounds.maxZ - bounds.minZ,
    heightM: roofTop - baseElevationM, baseElevationM,
  }
}

export const elevationAt = (project: ProjectV2, x: number, z: number) => {
  const points = project.site.terrain.elevationPoints
  const weighted = points.reduce((result, point) => {
    const distance = Math.max(0.25, Math.hypot(point.x - x, point.z - z))
    const weight = 1 / (distance * distance)
    return { sum: result.sum + point.elevation * weight, weight: result.weight + weight }
  }, { sum: 0, weight: 0 })
  // Terrain controls are stored as local model offsets from the survey datum.
  // The absolute PL-EVRF2007 datum remains metadata and must not be subtracted again here.
  return weighted.weight ? weighted.sum / weighted.weight : 0
}

export const rectangle = (center: Vec2, width: number, depth: number): Polygon2 => [
  { x: center.x - width / 2, z: center.z - depth / 2 }, { x: center.x + width / 2, z: center.z - depth / 2 },
  { x: center.x + width / 2, z: center.z + depth / 2 }, { x: center.x - width / 2, z: center.z + depth / 2 },
]
