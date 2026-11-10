import { pointInPolygon, polygonBounds, polygonCentroid, spaceFootprint } from '../../domain/geometry'
import { roofWindowLayout } from '../../domain/roofWindows'
import type { BuildingModel, Polygon2, StoreyModel, Vec2 } from '../../domain/types'
import { observerPointIssue } from './observer'

export interface WindowStudy {
  id: string
  name: string
  description: string
  roomLabel: string
  storey: StoreyModel
  room: Polygon2
  window: Polygon2
  target: Vec2
  targetHeight: number
  probe: Vec2
  originalHasWindow: boolean
  alternative: BuildingModel
}

function compass(local: Vec2, rotation: number, north: number) {
  const degrees = (north - rotation - Math.atan2(local.x, local.z) * 180 / Math.PI + 720) % 360
  return ['północ', 'północny wschód', 'wschód', 'południowy wschód', 'południe', 'południowy zachód', 'zachód', 'północny zachód'][Math.round(degrees / 45) % 8]
}

export function windowStudies(building: BuildingModel, north: number): WindowStudy[] {
  const studies: WindowStudy[] = []
  const sideRef = 'opening/architekt/terrace-side'
  const wall = building.walls.find(w => w.openings.some(o => o.ref === sideRef))
  const opening = wall?.openings.find(o => o.ref === sideRef)
  const living = building.spaces.find(s => s.ref === 'space/reference-living')
  const ground = building.storeys.find(s => living && s.spaceRefs.includes(living.ref) && wall && s.wallRefs.includes(wall.ref))
  if (wall && opening && living && ground) {
    const room = spaceFootprint(building, living)
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    const ux = (wall.end.x - wall.start.x) / length, uz = (wall.end.z - wall.start.z) / length
    const target = { x: wall.start.x + ux * opening.offsetM, z: wall.start.z + uz * opening.offsetM }
    const sign = pointInPolygon({ x: target.x + uz * .25, z: target.z - ux * .25 }, room) ? -1 : 1
    const outward = { x: sign * uz, z: -sign * ux }
    const window = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) => ({
      x: target.x + a * ux * opening.widthM / 2 + b * uz * wall.thicknessM / 2,
      z: target.z + a * uz * opening.widthM / 2 - b * ux * wall.thicknessM / 2,
    }))
    studies.push({
      id: 'terrace', name: 'Salon · boczne przy tarasie', roomLabel: 'Otwarta strefa dzienna', storey: ground, room, window, target,
      description: `${opening.kind === 'door' && opening.glazed ? 'Przeszklone drzwi' : 'Okno'} ${Math.round(opening.widthM * 100)} × ${Math.round(opening.heightM * 100)} cm · ${compass(outward, building.rotationDegrees, north)}. Wariant bez okna zamyka tylko ten otwór.`,
      targetHeight: wall.baseElevationM + opening.sillM + opening.heightM / 2,
      probe: { x: target.x - outward.x * 1.25, z: target.z - outward.z * 1.25 },
      originalHasWindow: true,
      alternative: { ...building, walls: building.walls.map(w => w !== wall ? w : { ...w, openings: w.openings.filter(o => o !== opening) }) },
    })
  }
  const roof = building.roof.segments.find(s => s.ref === 'roof/reference/front-barn' && s.type === 'gable')
  if (!roof) return studies
  const bounds = polygonBounds(roof.footprint)
  // One independent trial per bedroom. Fractions locate the proposed opening inside the room.
  for (const [roomRef, fx, fz] of [
    ['space/reference-child-one', .40, .38], ['space/reference-child-two', .52, .55], ['space/reference-parents', .33, .63],
  ] as const) {
    const space = building.spaces.find(s => s.ref === roomRef)
    const storey = building.storeys.find(s => space && s.spaceRefs.includes(space.ref) && s.ref === roof.storeyRef)
    if (!space || !storey) continue
    const room = spaceFootprint(building, space), b = polygonBounds(room)
    const target = { x: b.minX + fx * (b.maxX - b.minX), z: b.minZ + fz * (b.maxZ - b.minZ) }
    const trial = { ref: 'study/roof-window/' + space.ref, position: target, widthM: .78, lengthM: 1.18 }
    const layout = roofWindowLayout(roof, trial)
    if (!layout.fits || !layout.footprint.every(p => pointInPolygon(p, room))) continue
    const cut = polygonBounds(layout.footprint)
    if (roof.windows?.some(w => {
      const other = polygonBounds(roofWindowLayout(roof, w).footprint)
      return cut.minX < other.maxX && cut.maxX > other.minX && cut.minZ < other.maxZ && cut.maxZ > other.minZ
    })) continue
    const outward = roof.ridgeDirection === 'z' ? { x: Math.sign(target.x - (bounds.minX + bounds.maxX) / 2), z: 0 }
      : { x: 0, z: Math.sign(target.z - (bounds.minZ + bounds.maxZ) / 2) }
    const name = roomRef.endsWith('parents') ? 'Sypialnia rodziców' : space.name
    studies.push({ id: roomRef, name, roomLabel: name, storey, room, target, window: layout.footprint,
      description: `Okno dachowe 78 × 118 cm · połać na ${compass(outward, building.rotationDegrees, north)}.`,
      targetHeight: layout.elevationM, probe: polygonCentroid(room), originalHasWindow: false,
      alternative: { ...building, roof: { ...building.roof, segments: building.roof.segments.map(s => s !== roof ? s : { ...s, windows: [...(s.windows ?? []), trial] }) } },
    })
  }
  return studies
}

/** Combine independent roof openings while retaining all existing roof and wall openings. */
export function allBedroomWindows(building: BuildingModel, studies: WindowStudy[]): BuildingModel {
  const bedrooms = studies.filter(study => !study.originalHasWindow)
  return { ...building, roof: { ...building.roof, segments: building.roof.segments.map(segment => {
    const added = bedrooms.flatMap(study => (study.alternative.roof.segments.find(s => s.ref === segment.ref)?.windows ?? []).filter(w => w.ref === 'study/roof-window/' + study.id))
    return added.length ? { ...segment, windows: [...(segment.windows ?? []), ...added] } : segment
  }) } }
}

export function studyObserver(building: BuildingModel, study: WindowStudy, eyes: number) {
  const bounds = polygonBounds(study.room)
  let best: Vec2 | undefined, distance = Infinity
  for (let z = bounds.minZ + .25; z < bounds.maxZ; z += .35) for (let x = bounds.minX + .25; x < bounds.maxX; x += .35) {
    const d = Math.hypot(x - study.probe.x, z - study.probe.z)
    if (d < distance && pointInPolygon({ x, z }, study.room) && !observerPointIssue(building, study.storey, { x, z }, eyes)) {
      best = { x, z }; distance = d
    }
  }
  return best
}
