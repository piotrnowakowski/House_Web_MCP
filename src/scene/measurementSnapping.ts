import { Camera, Vector2, Vector3, Vector4 } from 'three'
import { elevationAt } from '../domain/geometry'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { interiorCorners } from '../domain/interior'
import type { BuildingModel, Polygon2, ProjectV2, StoreyModel } from '../domain/types'

export type MeasurementEdge = [Vector3, Vector3]
type Viewport = { left: number; top: number; width: number; height: number }

export function polygonMeasurementEdges(points: Vector3[]): MeasurementEdge[] {
  return points.map((point, index) => [point, points[(index + 1) % points.length]])
}

export function measurementScreenPoint(point: Vector3, camera: Camera, viewport: Viewport) {
  const projected = point.clone().project(camera)
  if (projected.z < -1 || projected.z > 1) return null
  return new Vector2(viewport.left + (projected.x + 1) * viewport.width / 2, viewport.top + (1 - projected.y) * viewport.height / 2)
}

/** Use pixels for the snap radius so picking stays predictable at every zoom level. */
export function snapMeasurementPoint(pointer: Vector2, edges: MeasurementEdge[], camera: Camera, viewport: Viewport, radius = 14): Vector3 | null {
  let result: Vector3 | null = null
  let closest = radius
  for (const [start, end] of edges) {
    const a = measurementScreenPoint(start, camera, viewport)
    const b = measurementScreenPoint(end, camera, viewport)
    if (!a || !b) continue
    const direction = b.clone().sub(a)
    const fraction = direction.lengthSq() ? Math.max(0, Math.min(1, pointer.clone().sub(a).dot(direction) / direction.lengthSq())) : 0
    const distance = pointer.distanceTo(a.clone().addScaledVector(direction, fraction))
    if (distance > closest) continue
    // Screen interpolation is nonlinear in perspective; compensate using clip-space w.
    const wa = new Vector4(start.x, start.y, start.z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix).w
    const wb = new Vector4(end.x, end.y, end.z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix).w
    const t = fraction * wa / ((1 - fraction) * wb + fraction * wa)
    result = start.clone().lerp(end, t)
    closest = distance
  }
  return result
}

export function interiorMeasurementEdges(building: BuildingModel, storey: StoreyModel): MeasurementEdge[] {
  const slab = building.slabs.find((value) => value.ref === storey.baseSlabRef)!
  const polygons: Polygon2[] = [slab.footprint, ...(slab.holes ?? [])]
  for (const wall of building.walls.filter((value) => storey.wallRefs.includes(value.ref))) {
    const dx = wall.end.x - wall.start.x; const dz = wall.end.z - wall.start.z
    const length = Math.hypot(dx, dz)
    if (!length) continue
    const nx = -dz / length * wall.thicknessM / 2; const nz = dx / length * wall.thicknessM / 2
    // Snap to wall faces, rather than their centre lines, including opening jambs.
    let cursor = 0
    const intervals: [number, number][] = []
    for (const opening of [...wall.openings].sort((a, b) => a.offsetM - b.offsetM)) {
      const start = Math.max(cursor, opening.offsetM - opening.widthM / 2)
      if (start > cursor) intervals.push([cursor, start])
      cursor = Math.max(cursor, Math.min(length, opening.offsetM + opening.widthM / 2))
    }
    if (cursor < length) intervals.push([cursor, length])
    for (const [start, end] of intervals) {
      const a = { x: wall.start.x + dx * start / length, z: wall.start.z + dz * start / length }
      const b = { x: wall.start.x + dx * end / length, z: wall.start.z + dz * end / length }
      polygons.push([{ x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz }, { x: b.x - nx, z: b.z - nz }, { x: a.x - nx, z: a.z - nz }])
    }
  }
  polygons.push(...(building.furniture ?? []).filter((item) => item.storeyRef === storey.ref).map(interiorCorners))
  return polygons.flatMap((polygon) => polygonMeasurementEdges(polygon.map((point) => new Vector3(point.x, 0.09, point.z))))
}

export function siteMeasurementEdges(project: ProjectV2): MeasurementEdge[] {
  const polygons = [project.site.boundary, ...project.site.parcels.map((parcel) => parcel.boundary), ...project.landscape.zones.map((zone) => zone.footprint)]
  for (const building of project.buildings) {
    const angle = building.rotationDegrees * Math.PI / 180
    const lowest = Math.min(...building.slabs.map((slab) => slab.topElevationM))
    for (const slab of building.slabs.filter((value) => value.topElevationM === lowest)) {
      polygons.push(slab.footprint.map((p) => ({ x: building.position.x + p.x * Math.cos(angle) + p.z * Math.sin(angle), z: building.position.z - p.x * Math.sin(angle) + p.z * Math.cos(angle) })))
    }
  }
  for (const fixture of project.landscape.fixtures) {
    const definition = gardenFixtureById(fixture.catalogId)
    polygons.push(interiorCorners({ ...fixture, ...definition, rotationDegrees: -fixture.rotationDegrees }))
  }
  return polygons.flatMap((polygon) => polygonMeasurementEdges(polygon.map((point) => new Vector3(point.x, elevationAt(project, point.x, point.z) + 0.14, point.z))))
}
