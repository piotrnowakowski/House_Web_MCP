import { wallLength } from './geometry'
import { moveConnectedWall } from './interiorLayout'
import type { BuildingModel, InteriorItem, ProjectCommand, StoreyModel, Vec2, WallModel } from './types'

/** Probe the same connected-wall constraints as a real edit, without changing project data. */
export function wallLengthAnchors(building: BuildingModel, storey: StoreyModel, wall: WallModel) {
  return (['start', 'center', 'end'] as const).filter(anchor => [.01, -.01].some(delta => {
    try {
      const copy = structuredClone(building)
      const next = wallWithLength(wall, wallLength(wall) + delta, anchor)
      moveConnectedWall(copy, copy.storeys.find(s => s.ref === storey.ref)!, {
        type: 'interior.update', action: 'wall', buildingRef: building.ref, storeyRef: storey.ref,
        wallRef: wall.ref, start: next.start, end: next.end,
      })
      return true
    } catch { return false }
  }))
}

/** Resize along the existing direction, preserving the requested anchor. */
export function wallWithLength(wall: WallModel, length: number, anchor: 'start' | 'center' | 'end'): WallModel {
  if (!Number.isFinite(length) || length < 0.11) throw new Error('Wall length must be at least 0.11 m.')
  const old = wallLength(wall), dx = (wall.end.x - wall.start.x) / old, dz = (wall.end.z - wall.start.z) / old
  const shift = (length - old) * (anchor === 'start' ? 0 : anchor === 'end' ? 1 : 0.5)
  const start = { x: wall.start.x - dx * shift, z: wall.start.z - dz * shift }
  return { ...wall, start, end: { x: start.x + dx * length, z: start.z + dz * length } }
}

/** A grouped furniture move is one command batch; dimensions and local relationships survive. */
export function furnitureMoveCommands(building: BuildingModel, original: InteriorItem, changed: InteriorItem): ProjectCommand[] {
  const angle = (changed.rotationDegrees - original.rotationDegrees) * Math.PI / 180
  return (building.furniture ?? []).filter(i => i.ref === original.ref || (original.groupRef && i.groupRef === original.groupRef)).map(i => {
    const x = i.position.x - original.position.x, z = i.position.z - original.position.z
    const item = i.ref === original.ref ? changed : { ...i,
      position: { x: changed.position.x + x * Math.cos(angle) + z * Math.sin(angle), z: changed.position.z - x * Math.sin(angle) + z * Math.cos(angle) },
      rotationDegrees: i.rotationDegrees + changed.rotationDegrees - original.rotationDegrees,
      elevationM: (i.elevationM ?? 0) + (changed.elevationM ?? 0) - (original.elevationM ?? 0),
    }
    return { type: 'interior.update', action: 'put', buildingRef: building.ref, storeyRef: i.storeyRef, item }
  })
}

export function transformedPoint(point: Vec2, origin: Vec2, target: Vec2, degrees: number): Vec2 {
  const a = degrees * Math.PI / 180, x = point.x - origin.x, z = point.z - origin.z
  return { x: target.x + x * Math.cos(a) + z * Math.sin(a), z: target.z - x * Math.sin(a) + z * Math.cos(a) }
}
