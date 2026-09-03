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

const GEOMETRY_EPSILON = 0.001
const samePoint = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z) < GEOMETRY_EPSILON

export const pointOnSegment = (point: Vec2, start: Vec2, end: Vec2, tolerance = GEOMETRY_EPSILON) => {
  const length = Math.hypot(end.x - start.x, end.z - start.z)
  if (length < tolerance) return samePoint(point, start)
  const cross = Math.abs((point.x - start.x) * (end.z - start.z) - (point.z - start.z) * (end.x - start.x)) / length
  const dot = (point.x - start.x) * (end.x - start.x) + (point.z - start.z) * (end.z - start.z)
  return cross <= tolerance && dot >= -tolerance && dot <= length * length + tolerance
}

export const pointOnPolygonBoundary = (point: Vec2, polygon: Polygon2, tolerance = GEOMETRY_EPSILON) => polygon.some((start, index) => pointOnSegment(point, start, polygon[(index + 1) % polygon.length], tolerance))

export const distanceToSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x; const dz = end.z - start.z; const lengthSquared = dx * dx + dz * dz
  if (lengthSquared < 1e-9) return Math.hypot(point.x - start.x, point.z - start.z)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz))
}

export const polygonPerimeter = (points: Polygon2) => points.reduce((sum, point, index) => sum + Math.hypot(points[(index + 1) % points.length].x - point.x, points[(index + 1) % points.length].z - point.z), 0)

/** Splits polygon edges at vertices from another polygon so shared partial edges become reusable semantic segments. */
export const splitPolygonEdges = (polygon: Polygon2, splitter: Polygon2): Polygon2 => polygon.flatMap((start, index) => {
  const end = polygon[(index + 1) % polygon.length]
  const dx = end.x - start.x; const dz = end.z - start.z; const lengthSquared = dx * dx + dz * dz
  const points = [start, ...splitter.filter((point) => !samePoint(point, start) && !samePoint(point, end) && pointOnSegment(point, start, end))]
    .map((point) => ({ point, t: ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared }))
    .sort((a, b) => a.t - b.t)
    .map(({ point }) => ({ ...point }))
  return points
})

/** Joins two non-overlapping polygons that share one or more boundary segments. */
export const mergeAdjacentPolygons = (first: Polygon2, second: Polygon2): Polygon2 => {
  const normalize = (polygon: Polygon2) => polygonSignedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon]
  const a = splitPolygonEdges(normalize(first), second)
  const b = splitPolygonEdges(normalize(second), first)
  type Edge = { start: Vec2; end: Vec2 }
  const edges: Edge[] = [...a.map((start, index) => ({ start, end: a[(index + 1) % a.length] })), ...b.map((start, index) => ({ start, end: b[(index + 1) % b.length] }))]
  const boundary = edges.filter((edge, index) => !edges.some((candidate, otherIndex) => otherIndex !== index && samePoint(edge.start, candidate.end) && samePoint(edge.end, candidate.start)))
  if (boundary.length === edges.length) throw new Error('The extension footprint must share an edge with the existing storey footprint.')
  const ordered: Vec2[] = [{ ...boundary[0].start }]
  let current = boundary[0].end; const used = new Set([0])
  while (!samePoint(current, ordered[0])) {
    ordered.push({ ...current })
    const nextIndex = boundary.findIndex((edge, index) => !used.has(index) && samePoint(edge.start, current))
    if (nextIndex < 0) throw new Error('The storey and extension footprints do not form one valid outer boundary.')
    used.add(nextIndex); current = boundary[nextIndex].end
    if (ordered.length > boundary.length + 1) throw new Error('The combined storey boundary could not be resolved.')
  }
  if (used.size !== boundary.length || polygonSelfIntersects(ordered)) throw new Error('The combined storey footprint is disconnected or self-intersecting.')
  return ordered.filter((point, index) => {
    const previous = ordered[(index + ordered.length - 1) % ordered.length]; const next = ordered[(index + 1) % ordered.length]
    return Math.abs((point.x - previous.x) * (next.z - point.z) - (point.z - previous.z) * (next.x - point.x)) > GEOMETRY_EPSILON
  })
}

const lineIntersection = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null => {
  const denominator = (a.x - b.x) * (c.z - d.z) - (a.z - b.z) * (c.x - d.x)
  if (Math.abs(denominator) < 1e-8) return null
  const determinantA = a.x * b.z - a.z * b.x; const determinantB = c.x * d.z - c.z * d.x
  return { x: (determinantA * (c.x - d.x) - (a.x - b.x) * determinantB) / denominator, z: (determinantA * (c.z - d.z) - (a.z - b.z) * determinantB) / denominator }
}

/** Straight-edge inward offset used for reviewable planting rows. */
export const offsetPolygon = (polygon: Polygon2, distance: number): Polygon2 => {
  if (distance === 0) return polygon.map((point) => ({ ...point }))
  const orientation = polygonSignedArea(polygon) >= 0 ? 1 : -1
  const shifted = polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length]; const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz)
    if (length < GEOMETRY_EPSILON) throw new Error('Boundary contains a zero-length edge.')
    const normal = { x: -dz / length * orientation * distance, z: dx / length * orientation * distance }
    return { start: { x: start.x + normal.x, z: start.z + normal.z }, end: { x: end.x + normal.x, z: end.z + normal.z } }
  })
  const result = shifted.map((edge, index) => lineIntersection(shifted[(index + shifted.length - 1) % shifted.length].start, shifted[(index + shifted.length - 1) % shifted.length].end, edge.start, edge.end) ?? edge.start)
  if (polygonArea(result) < 0.01 || polygonSelfIntersects(result)) throw new Error('The inward offset collapses or self-intersects the selected boundary.')
  return result
}

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
  const roofTop = Math.max(...building.roof.segments.map((segment) => {
    const roofBounds = polygonBounds(segment.footprint); const span = segment.ridgeDirection === 'z' ? roofBounds.maxX - roofBounds.minX : roofBounds.maxZ - roofBounds.minZ
    return segment.baseElevationM + (segment.type === 'flat' ? 0.24 : Math.tan(segment.pitchDegrees * Math.PI / 180) * span / 2)
  }))
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
