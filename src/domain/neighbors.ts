import { ShapeUtils, Vector2 } from 'three'
import { polygonCentroid } from './geometry'
import type { NeighborBuilding, Polygon2, Vec2, Vec3 } from './types'

type RoofPlane = { x: number; z: number; c: number }
const height = (plane: RoofPlane, p: Vec2) => plane.x * p.x + plane.z * p.z + plane.c

/** Clip a roof facet to the region where its plane is the lowest roof plane. */
function clip(points: Polygon2, plane: RoofPlane): Polygon2 {
  const result: Polygon2 = []
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length], da = height(plane, a), db = height(plane, b)
    if (da <= 1e-8) result.push(a)
    if ((da < -1e-8 && db > 1e-8) || (da > 1e-8 && db < -1e-8)) {
      const t = da / (da - db)
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  })
  return result
}

/** Shared closed surface for rendering and shadow rays; metres in the site's coordinate frame. */
export function neighborSurface(building: NeighborBuilding) {
  const centre = polygonCentroid(building.footprint)
  const angle = building.ridgeDirectionDegrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  const points = building.footprint.map((p) => ({ x: (p.x - centre.x) * cos + (p.z - centre.z) * sin, z: -(p.x - centre.x) * sin + (p.z - centre.z) * cos }))
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x))
  const minZ = Math.min(...points.map((p) => p.z)), maxZ = Math.max(...points.map((p) => p.z))
  const cz = (minZ + maxZ) / 2
  const rise = building.ridgeHeightM - building.eavesHeightM
  const slope = rise / Math.max(0.01, (maxZ - minZ) / 2)
  const hipSlope = rise / Math.max(0.01, Math.min((maxX - minX) / 2, (maxZ - minZ) / 2))
  const planes: RoofPlane[] = building.roofType === 'flat' ? [{ x: 0, z: 0, c: building.eavesHeightM }] : [
    { x: 0, z: slope, c: building.ridgeHeightM - slope * cz },
    { x: 0, z: -slope, c: building.ridgeHeightM + slope * cz },
    ...(building.roofType === 'hip' ? [
      { x: hipSlope, z: 0, c: building.eavesHeightM - hipSlope * minX },
      { x: -hipSlope, z: 0, c: building.eavesHeightM + hipSlope * maxX },
    ] : []),
  ]
  const walls: number[] = [], roof: number[] = []
  const vertex = (p: Vec2, y: number) => [centre.x + p.x * cos - p.z * sin, building.groundElevationM + y, centre.z + p.x * sin + p.z * cos]
  const quad = (output: number[], a: number[], b: number[], c: number[], d: number[]) => output.push(...a, ...b, ...c, ...a, ...c, ...d)
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    quad(walls, vertex(a, 0), vertex(b, 0), vertex(b, building.eavesHeightM), vertex(a, building.eavesHeightM))
    // A plinth joins estimated positive threshold offsets to the conceptual flat context ground.
    if (building.groundElevationM > 0) quad(walls, vertex(a, -building.groundElevationM), vertex(b, -building.groundElevationM), vertex(b, 0), vertex(a, 0))
  })
  for (const plane of planes) {
    let facet = points
    for (const other of planes) if (other !== plane) facet = clip(facet, { x: plane.x - other.x, z: plane.z - other.z, c: plane.c - other.c })
    if (facet.length < 3) continue
    for (const triangle of ShapeUtils.triangulateShape(facet.map((p) => new Vector2(p.x, p.z)), [])) {
      for (const index of triangle) roof.push(...vertex(facet[index], height(plane, facet[index])))
    }
    facet.forEach((a, i) => {
      const b = facet[(i + 1) % facet.length]
      quad(walls, vertex(a, building.eavesHeightM), vertex(b, building.eavesHeightM), vertex(b, height(plane, b)), vertex(a, height(plane, a)))
    })
  }
  return { walls, roof, centre, radius: Math.max(...building.footprint.map((p) => Math.hypot(p.x - centre.x, p.z - centre.z))), top: building.groundElevationM + building.ridgeHeightM }
}

/** Double-sided Möller–Trumbore ray test against the same triangles shown in the scene. */
export function rayHitsNeighbor(origin: Vec3, direction: Vec3, triangles: number[]) {
  for (let i = 0; i < triangles.length; i += 9) {
    const ax = triangles[i], ay = triangles[i + 1], az = triangles[i + 2]
    const ex = triangles[i + 3] - ax, ey = triangles[i + 4] - ay, ez = triangles[i + 5] - az
    const fx = triangles[i + 6] - ax, fy = triangles[i + 7] - ay, fz = triangles[i + 8] - az
    const px = direction.y * fz - direction.z * fy, py = direction.z * fx - direction.x * fz, pz = direction.x * fy - direction.y * fx
    const det = ex * px + ey * py + ez * pz
    if (Math.abs(det) < 1e-9) continue
    const tx = origin.x - ax, ty = origin.y - ay, tz = origin.z - az
    const u = (tx * px + ty * py + tz * pz) / det
    if (u < 0 || u > 1) continue
    const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex
    const v = (direction.x * qx + direction.y * qy + direction.z * qz) / det
    if (v < 0 || u + v > 1) continue
    if ((fx * qx + fy * qy + fz * qz) / det > 1e-5) return true
  }
  return false
}

/** Point just outside the facade facing the house; no unverified window positions are implied. */
export function neighborViewpoint(building: NeighborBuilding, target: Vec2, eyeHeightM: number): Vec3 {
  const centre = polygonCentroid(building.footprint)
  const dx = target.x - centre.x, dz = target.z - centre.z, length = Math.hypot(dx, dz) || 1
  const direction = { x: dx / length, z: dz / length }
  let distance = 0
  building.footprint.forEach((a, i) => {
    const b = building.footprint[(i + 1) % building.footprint.length], ex = b.x - a.x, ez = b.z - a.z
    const determinant = direction.x * ez - direction.z * ex
    if (Math.abs(determinant) < 1e-8) return
    const rx = a.x - centre.x, rz = a.z - centre.z
    const t = (rx * ez - rz * ex) / determinant, u = (rx * direction.z - rz * direction.x) / determinant
    if (t >= 0 && u >= 0 && u <= 1) distance = Math.max(distance, t)
  })
  return { x: centre.x + direction.x * (distance + 0.3), z: centre.z + direction.z * (distance + 0.3), y: building.groundElevationM + eyeHeightM }
}
