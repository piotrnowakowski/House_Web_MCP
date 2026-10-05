import { pointInPolygon, pointOnPolygonBoundary, polygonBounds, wallLength } from './geometry'
import { roofSegmentRidgeElevation } from './roofs'
import type { BuildingModel, RoofSegmentModel, StoreyModel, Vec2, WallModel } from './types'

const contains = (roof: RoofSegmentModel, point: Vec2) => pointInPolygon(point, roof.footprint) || pointOnPolygonBoundary(point, roof.footprint)
const elevation = (roof: RoofSegmentModel, point: Vec2) => {
  const bounds = polygonBounds(roof.footprint)
  const across = roof.ridgeDirection === 'z' ? 'x' : 'z'
  const center = across === 'x' ? (bounds.minX + bounds.maxX) / 2 : (bounds.minZ + bounds.maxZ) / 2
  return roofSegmentRidgeElevation(roof) - Math.abs(point[across] - center) * Math.tan(roof.pitchDegrees * Math.PI / 180)
}

export function wallProfileHeightAt(profile: Vec2[], x: number) {
  const index = profile.findIndex((p) => p.x >= x)
  if (index === 0) return profile[0].z
  if (index < 0) return profile[profile.length - 1].z
  const a = profile[index - 1], b = profile[index]
  return a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x)
}

/** Overlapping gable volumes form the valley; the higher roof bounds their shared interior. */
export function atticClearanceAt(building: BuildingModel, storey: StoreyModel, point: Vec2) {
  if (storey.kneeWallHeightM === undefined) return storey.clearHeightM
  const roofs = building.roof.segments.filter((roof) => roof.type === 'gable' && roof.storeyRef === storey.ref && contains(roof, point))
  return roofs.length ? Math.max(...roofs.map((roof) => elevation(roof, point))) - storey.elevationM : storey.kneeWallHeightM
}

/** Exact piecewise-linear wall cap, split at eaves, ridges, wall caps and roof intersections. */
export function atticWallProfile(building: BuildingModel, wall: WallModel): Vec2[] | undefined {
  const storey = building.storeys.find((s) => s.wallRefs.includes(wall.ref))
  if (!storey || storey.kneeWallHeightM === undefined) return undefined
  const roofs = building.roof.segments.filter((roof) => roof.type === 'gable' && roof.storeyRef === storey.ref)
  const point = (t: number) => ({ x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t })
  const knots = new Set([0, 1])
  const add = (t: number) => { if (t > 0 && t < 1) knots.add(t) }
  for (const roof of roofs) {
    const b = polygonBounds(roof.footprint)
    for (const axis of ['x', 'z'] as const) {
      const delta = wall.end[axis] - wall.start[axis]
      if (Math.abs(delta) < 1e-9) continue
      const values = axis === 'x' ? [b.minX, b.maxX] : [b.minZ, b.maxZ]
      if ((roof.ridgeDirection === 'z' ? 'x' : 'z') === axis) values.push((values[0] + values[1]) / 2)
      for (const value of values) add((value - wall.start[axis]) / delta)
    }
  }
  const intervals = [...knots].sort((a, b) => a - b)
  for (let i = 1; i < intervals.length; i++) {
    const a = intervals[i - 1], b = intervals[i]
    const active = roofs.filter((roof) => contains(roof, point((a + b) / 2)))
    const lines = active.map((roof) => [elevation(roof, point(a)), elevation(roof, point(b))])
    lines.push([wall.baseElevationM + wall.heightM, wall.baseElevationM + wall.heightM])
    for (let j = 0; j < lines.length; j++) for (let k = j + 1; k < lines.length; k++) {
      const start = lines[j][0] - lines[k][0], end = lines[j][1] - lines[k][1]
      if (start * end < 0) add(a + (b - a) * start / (start - end))
    }
  }
  return [...knots].sort((a, b) => a - b).map((t) => ({ x: t * wallLength(wall), z: Math.min(wall.heightM, atticClearanceAt(building, storey, point(t)) + storey.elevationM - wall.baseElevationM) }))
}
