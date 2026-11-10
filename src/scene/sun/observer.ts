import { atticClearanceAt } from '../../domain/attic'
import { buildingGroundOffset, distanceToSegment, pointInPolygon, polygonArea, polygonBounds, polygonCentroid, spaceFootprint } from '../../domain/geometry'
import { interiorCorners } from '../../domain/interior'
import type { BuildingModel, StoreyModel, Vec2 } from '../../domain/types'

/** Plan coordinates are local to the building; Three.js rotates X/Z clockwise about Y. */
export function observerWorldPosition(building: BuildingModel, storey: StoreyModel, point: Vec2, eyeHeight: number): [number, number, number] {
  const angle = building.rotationDegrees * Math.PI / 180
  return [building.position.x + point.x * Math.cos(angle) + point.z * Math.sin(angle),
    buildingGroundOffset(building) + storey.elevationM + eyeHeight,
    building.position.z - point.x * Math.sin(angle) + point.z * Math.cos(angle)]
}

export function observerPointIssue(building: BuildingModel, storey: StoreyModel, point: Vec2, eyeHeight: number): string | null {
  const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)
  if (!slab || !pointInPolygon(point, slab.footprint)) return 'Wybierz punkt na podłodze domu.'
  if (slab.holes?.some(hole => pointInPolygon(point, hole))) return 'Tutaj jest otwór w stropie. Wybierz punkt na podłodze.'
  if (building.walls.some(wall => storey.wallRefs.includes(wall.ref) && wall.heightM > .1 && distanceToSegment(point, wall.start, wall.end) < wall.thicknessM / 2 + .12)) return 'Punkt jest zbyt blisko ściany. Przesuń go w głąb pokoju.'
  if (building.furniture?.some(item => item.storeyRef === storey.ref && (item.elevationM ?? 0) < eyeHeight && pointInPolygon(point, interiorCorners(item)))) return 'Tutaj stoi mebel. Wybierz wolne miejsce obok.'
  let clearance = storey.kneeWallHeightM === undefined ? storey.clearHeightM : atticClearanceAt(building, storey, point)
  for (const ceiling of building.ceilingFinishes) {
    const room = building.spaces.find(room => room.ref === ceiling.spaceRef && storey.spaceRefs.includes(room.ref))
    if (room && pointInPolygon(point, spaceFootprint(building, room))) clearance = Math.min(clearance, ceiling.elevationM - storey.elevationM - ceiling.thicknessM)
  }
  return clearance < eyeHeight + .1 ? 'Tutaj sufit jest za nisko. Wybierz inne miejsce lub obniż wysokość oczu.' : null
}

export function firstObserverPoint(building: BuildingModel, storey: StoreyModel, eyeHeight = 1.6): Vec2 | null {
  const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)
  if (!slab) return null
  const rooms = building.spaces.filter(r => storey.spaceRefs.includes(r.ref))
    .sort((a, b) => polygonArea(spaceFootprint(building, b)) - polygonArea(spaceFootprint(building, a)))
  for (const room of rooms) {
    const centre = polygonCentroid(spaceFootprint(building, room))
    if (!observerPointIssue(building, storey, centre, eyeHeight)) return centre
  }
  const bounds = polygonBounds(slab.footprint)
  for (let z = bounds.minZ + .3; z < bounds.maxZ; z += .4) for (let x = bounds.minX + .3; x < bounds.maxX; x += .4) {
    if (!observerPointIssue(building, storey, { x, z }, eyeHeight)) return { x, z }
  }
  return null
}

export const studyClock = (hour: number) => {
  const minutes = Math.min(1439, Math.max(0, Math.round(hour * 60)))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
