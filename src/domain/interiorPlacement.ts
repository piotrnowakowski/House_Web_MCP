import { interiorCorners } from './interior'
import { ikeaProduct } from './ikeaCatalog'
import { closestWallPoint } from './interiorLayout'
import type { BuildingModel, InteriorItem, Polygon2, StoreyModel, Vec2 } from './types'

/** Separating-axis test for oriented rectangular footprints. Touching edges are allowed. */
export function footprintsOverlap(a: Polygon2, b: Polygon2) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i]
      const q = polygon[(i + 1) % polygon.length]
      const axis = { x: -(q.z - p.z), z: q.x - p.x }
      const project = (points: Polygon2) => points.map((point) => point.x * axis.x + point.z * axis.z)
      const ap = project(a)
      const bp = project(b)
      if (Math.max(...ap) <= Math.min(...bp) + 0.00001 || Math.max(...bp) <= Math.min(...ap) + 0.00001) return false
    }
  }
  return true
}

export interface PlacementWarning {
  ref: string
  message: string
  kind: 'overlap' | 'door' | 'circulation' | 'wall'
}

export function placementWarnings(
  item: InteriorItem,
  building: BuildingModel,
  storey: StoreyModel,
): PlacementWarning[] {
  if (ikeaProduct(item.productId)?.category === 'Rugs') return []
  const footprint = interiorCorners(item)
  const warnings: PlacementWarning[] = []
  for (const other of building.furniture ?? []) {
    if (other.ref === item.ref || other.storeyRef !== storey.ref || ikeaProduct(other.productId)?.category === 'Rugs') continue
    const bottom = Math.max(item.elevationM ?? 0, other.elevationM ?? 0)
    const top = Math.min((item.elevationM ?? 0) + item.heightM, (other.elevationM ?? 0) + other.heightM)
    if (bottom >= top - 0.015) continue
    const otherFootprint = interiorCorners(other)
    if (footprintsOverlap(footprint, otherFootprint))
      warnings.push({ ref: other.ref, kind: 'overlap', message: `Overlaps ${other.name}.` })
    else if (
      footprintsOverlap(
        interiorCorners({ ...item, widthM: item.widthM + 0.6, depthM: item.depthM + 0.6 }),
        otherFootprint,
      )
    )
      warnings.push({ ref: other.ref, kind: 'circulation', message: `Less than 30 cm to ${other.name}; check access.` })
  }
  for (const wall of building.walls.filter((entry) => storey.wallRefs.includes(entry.ref))) {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    const ux = (wall.end.x - wall.start.x) / length
    const uz = (wall.end.z - wall.start.z) / length
    const local = (x: number, z: number) => ({ x: wall.start.x + ux * x - uz * z, z: wall.start.z + uz * x + ux * z })
    if ((item.elevationM ?? 0) < wall.heightM) {
      const wallFootprint = [
        local(0, -wall.thicknessM / 2),
        local(length, -wall.thicknessM / 2),
        local(length, wall.thicknessM / 2),
        local(0, wall.thicknessM / 2),
      ]
      if (footprintsOverlap(footprint, wallFootprint))
        warnings.push({ ref: wall.ref, kind: 'wall', message: 'Intersects a wall; move the furniture clear of it.' })
    }
    for (const door of wall.openings.filter((opening) => opening.kind === 'door' && !opening.glazed)) {
      if ((item.elevationM ?? 0) >= door.heightM) continue
      const side = door.swing === 'out' ? -1 : 1
      const hinge = door.hinge === 'right' ? 1 : -1
      const hingeX = door.offsetM + (hinge * door.widthM) / 2
      const sector = [
        local(hingeX, 0),
        ...Array.from({ length: 13 }, (_, i) =>
          local(
            hingeX - hinge * Math.cos(((i / 12) * Math.PI) / 2) * door.widthM,
            side * Math.sin(((i / 12) * Math.PI) / 2) * door.widthM,
          ),
        ),
      ]
      if (footprintsOverlap(footprint, sector))
        warnings.push({ ref: door.ref, kind: 'door', message: 'Blocks a door swing.' })
    }
  }
  return warnings
}

export interface SnapSettings {
  enabled: boolean
  gridM: number
  alignment: boolean
}

export function snapFurniture(
  item: InteriorItem,
  building: BuildingModel,
  storey: StoreyModel,
  settings: SnapSettings,
): Vec2 {
  if (!settings.enabled) return item.position
  const step = Math.max(0.01, settings.gridM)
  let position = { x: Math.round(item.position.x / step) * step, z: Math.round(item.position.z / step) * step }
  if (!settings.alignment) return position
  const threshold = 0.12
  const angle = (item.rotationDegrees * Math.PI) / 180
  for (const wall of building.walls.filter((entry) => storey.wallRefs.includes(entry.ref))) {
    const closest = closestWallPoint(position, wall)
    const dx = position.x - closest.x
    const dz = position.z - closest.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.0001) continue
    const nx = dx / distance
    const nz = dz / distance
    const radius =
      (Math.abs(nx * Math.cos(angle) - nz * Math.sin(angle)) * item.widthM) / 2 +
      (Math.abs(nx * Math.sin(angle) + nz * Math.cos(angle)) * item.depthM) / 2
    const gap = radius + wall.thicknessM / 2 + 0.005
    if (Math.abs(distance - gap) < threshold) position = { x: closest.x + nx * gap, z: closest.z + nz * gap }
  }
  for (const other of building.furniture ?? []) {
    if (other.ref === item.ref || other.storeyRef !== storey.ref || (item.groupRef && other.groupRef === item.groupRef))
      continue
    if (Math.abs(position.x - other.position.x) < 0.06) position.x = other.position.x
    if (Math.abs(position.z - other.position.z) < 0.06) position.z = other.position.z
  }
  return position
}

export function wallDistances(item: InteriorItem, building: BuildingModel, storey: StoreyModel) {
  return building.walls
    .filter((wall) => storey.wallRefs.includes(wall.ref))
    .map((wall) => {
      const points = interiorCorners(item).map((point) => ({ point, wallPoint: closestWallPoint(point, wall) }))
      const nearest = points.sort(
        (a, b) =>
          Math.hypot(a.point.x - a.wallPoint.x, a.point.z - a.wallPoint.z) -
          Math.hypot(b.point.x - b.wallPoint.x, b.point.z - b.wallPoint.z),
      )[0]
      return {
        ...nearest,
        ref: wall.ref,
        distanceM: Math.max(
          0,
          Math.hypot(nearest.point.x - nearest.wallPoint.x, nearest.point.z - nearest.wallPoint.z) -
            wall.thicknessM / 2,
        ),
      }
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 2)
}
