import { pointInPolygon, polygonArea, polygonBounds, spaceFootprint, wallLength } from './geometry'
import type { BuildingModel, Polygon2, SpaceModel, Vec2 } from './types'

/** Offset each boundary centre line by that wall's half thickness, including mitred corners. */
export function roomInsideFootprint(building: BuildingModel, room: SpaceModel): Polygon2 {
  const points = spaceFootprint(building, room)
  const signed = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.z - q.x * p.z }, 0)
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % points.length]; const dx = q.x - p.x; const dz = q.z - p.z; const length = Math.hypot(dx, dz)
    const half = (building.walls.find((w) => w.ref === room.boundary[i].wallRef)?.thicknessM ?? 0.2) / 2 * Math.sign(signed)
    return { p: { x: p.x - dz / length * half, z: p.z + dx / length * half }, d: { x: dx, z: dz } }
  })
  return lines.map((b, i) => {
    const a = lines[(i + lines.length - 1) % lines.length]
    const cross = (p: Vec2, q: Vec2) => p.x * q.z - p.z * q.x
    const denominator = cross(a.d, b.d)
    if (Math.abs(denominator) < 1e-8) return b.p
    const t = cross({ x: b.p.x - a.p.x, z: b.p.z - a.p.z }, b.d) / denominator
    return { x: a.p.x + t * a.d.x, z: a.p.z + t * a.d.z }
  })
}

export function roomDimensions(building: BuildingModel, room: SpaceModel) {
  const footprint = roomInsideFootprint(building, room); const bounds = polygonBounds(footprint)
  const storey = building.storeys.find((s) => s.spaceRefs.includes(room.ref))
  const innerWalls = building.walls.filter((wall) => storey?.wallRefs.includes(wall.ref) && !room.boundary.some((b) => b.wallRef === wall.ref)
    && pointInPolygon({ x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }, footprint))
  // Stub partitions occupy usable floor, but their open ends aren't part of a closed room boundary.
  const partitionArea = innerWalls.reduce((sum, wall) => {
    const length = wallLength(wall)
    const direction = { x: (wall.end.x - wall.start.x) / length, z: (wall.end.z - wall.start.z) / length }
    const startInside = pointInPolygon(wall.start, footprint); const endInside = pointInPolygon(wall.end, footprint)
    const clipped = length - (!startInside ? wall.thicknessM / 2 : 0) - (!endInside ? wall.thicknessM / 2 : 0)
    return sum + (Number.isFinite(direction.x) ? Math.max(0, clipped) * wall.thicknessM : 0)
  }, 0)
  const slab = building.slabs.find((s) => s.ref === room.baseSlabRef)
  const holeArea = (slab?.holes ?? []).filter((hole) => hole.every((p) => pointInPolygon(p, footprint))).reduce((sum, hole) => sum + polygonArea(hole), 0)
  return { footprint, bounds, width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ, area: Math.max(0, polygonArea(footprint) - partitionArea - holeArea) }
}
