import { polygonBounds, spaceFootprint } from './geometry'
import { isEnvelopeWall, moveConnectedWall } from './interiorLayout'
import type { BuildingModel, SpaceModel, StoreyModel } from './types'

/** Exact rectangular dimensions are changed by translating one internal side. */
export function resizeInteriorRoom(
  building: BuildingModel,
  storey: StoreyModel,
  room: SpaceModel,
  widthM?: number,
  depthM?: number,
) {
  for (const [axis, requested] of [
    ['x', widthM],
    ['z', depthM],
  ] as const) {
    if (requested === undefined) continue
    if (!Number.isFinite(requested) || requested < 1 || requested > 50)
      throw new Error('Room dimensions must be between 1 and 50 m.')
    const bounds = polygonBounds(spaceFootprint(building, room))
    const min = axis === 'x' ? bounds.minX : bounds.minZ
    const max = axis === 'x' ? bounds.maxX : bounds.maxZ
    const delta = requested - (max - min)
    if (Math.abs(delta) < 0.0001) continue
    const walls = building.walls.filter((wall) => room.boundary.some((use) => use.wallRef === wall.ref))
    const side = (coordinate: number) =>
      walls.filter(
        (wall) => Math.abs(wall.start[axis] - coordinate) < 0.001 && Math.abs(wall.end[axis] - coordinate) < 0.001,
      )
    const free = (coordinate: number) =>
      side(coordinate).length === 1 && side(coordinate).every((wall) => !isEnvelopeWall(building, storey, wall))
    const direction = free(max) ? 1 : free(min) ? -1 : 0
    if (!direction)
      throw new Error(
        'This dimension has no single movable interior side. Move a connected partition or use plot tools for exterior walls.',
      )
    const wall = side(direction > 0 ? max : min)[0]
    moveConnectedWall(building, storey, {
      type: 'interior.update',
      action: 'wall',
      buildingRef: building.ref,
      storeyRef: storey.ref,
      wallRef: wall.ref,
      start: { ...wall.start, [axis]: wall.start[axis] + direction * delta },
      end: { ...wall.end, [axis]: wall.end[axis] + direction * delta },
    })
  }
}
