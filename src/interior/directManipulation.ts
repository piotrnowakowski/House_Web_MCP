import { wallLength } from '../domain/geometry'
import { snapFurniture, type SnapSettings } from '../domain/interiorPlacement'
import type { BuildingModel, ProjectCommand, StoreyModel, Vec2 } from '../domain/types'

export interface DragTarget { kind: 'wall' | 'opening' | 'item'; ref: string }

/** Build one atomic edit from the press-time model, never from a preceding preview. */
export function dragCommands(building: BuildingModel, storey: StoreyModel, target: DragTarget, delta: Vec2, snap: SnapSettings, selectedRefs: string[]): ProjectCommand[] {
  const base = { type: 'interior.update' as const, buildingRef: building.ref, storeyRef: storey.ref }
  const step = snap.enabled ? snap.gridM : .001
  const round = (v: number) => Math.round(v / step) * step
  if (target.kind === 'item') {
    const item = building.furniture!.find(i => i.ref === target.ref)!
    const position = snapFurniture({ ...item, position: { x: item.position.x + delta.x, z: item.position.z + delta.z } }, building, storey, snap)
    if (Math.hypot(position.x - item.position.x, position.z - item.position.z) < .0001) return []
    return (building.furniture ?? []).filter(i => i.ref === item.ref || selectedRefs.includes(i.ref) || (item.groupRef && i.groupRef === item.groupRef)).map(i => ({
      ...base, storeyRef: i.storeyRef, action: 'put', item: { ...i, position: { x: i.position.x + position.x - item.position.x, z: i.position.z + position.z - item.position.z } },
    }))
  }
  const wall = building.walls.find(w => target.kind === 'wall' ? w.ref === target.ref : w.openings.some(o => o.ref === target.ref))!
  const length = wallLength(wall), ux = (wall.end.x - wall.start.x) / length, uz = (wall.end.z - wall.start.z) / length
  if (target.kind === 'opening') {
    const opening = wall.openings.find(o => o.ref === target.ref)!
    const offsetM = round(opening.offsetM + delta.x * ux + delta.z * uz)
    if (Math.abs(offsetM - opening.offsetM) < .0001) return []
    return [{ ...base, action: 'opening', wallRef: wall.ref, opening: { ...opening, offsetM } }]
  }
  // Slide the partition perpendicular to itself, keeping its length and shared junctions.
  const distance = round(-uz * delta.x + ux * delta.z)
  if (Math.abs(distance) < .0001) return []
  const move = (p: Vec2) => ({ x: p.x - uz * distance, z: p.z + ux * distance })
  return [{ ...base, action: 'wall', wallRef: wall.ref, start: move(wall.start), end: move(wall.end) }]
}
