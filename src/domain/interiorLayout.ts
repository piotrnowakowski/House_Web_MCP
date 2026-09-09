import {
  pointInPolygon,
  pointOnSegment,
  polygonArea,
  polygonSelfIntersects,
  spaceFootprint,
  wallLength,
} from './geometry'
import type {
  BuildingModel,
  InteriorCommand,
  Polygon2,
  SpaceBoundaryUse,
  SpaceModel,
  StoreyModel,
  Vec2,
  WallModel,
} from './types'

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)
const same = (a: Vec2, b: Vec2) => distance(a, b) < 0.0001
const cross = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
const onBoundary = (point: Vec2, polygon: Polygon2) =>
  polygon.some((a, i) => pointOnSegment(point, a, polygon[(i + 1) % polygon.length]))
const inside = (point: Vec2, polygon: Polygon2) => pointInPolygon(point, polygon) || onBoundary(point, polygon)
const intersects = (a: Vec2, b: Vec2, c: Vec2, d: Vec2) =>
  (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
  pointOnSegment(a, c, d) ||
  pointOnSegment(b, c, d) ||
  pointOnSegment(c, a, b) ||
  pointOnSegment(d, a, b)

function wallTouchesVoid(wall: WallModel, hole: Polygon2) {
  const length = wallLength(wall)
  const nx = ((-(wall.end.z - wall.start.z) / length) * wall.thicknessM) / 2
  const nz = (((wall.end.x - wall.start.x) / length) * wall.thicknessM) / 2
  const footprint = [
    { x: wall.start.x + nx, z: wall.start.z + nz },
    { x: wall.end.x + nx, z: wall.end.z + nz },
    { x: wall.end.x - nx, z: wall.end.z - nz },
    { x: wall.start.x - nx, z: wall.start.z - nz },
  ]
  return (
    footprint.some((p) => inside(p, hole)) ||
    hole.some((p) => inside(p, footprint)) ||
    footprint.some((a, i) => hole.some((c, j) => intersects(a, footprint[(i + 1) % 4], c, hole[(j + 1) % hole.length])))
  )
}

export function closestWallPoint(point: Vec2, wall: Pick<WallModel, 'start' | 'end'>): Vec2 {
  const dx = wall.end.x - wall.start.x
  const dz = wall.end.z - wall.start.z
  const t = Math.max(
    0,
    Math.min(1, ((point.x - wall.start.x) * dx + (point.z - wall.start.z) * dz) / (dx * dx + dz * dz)),
  )
  return { x: wall.start.x + t * dx, z: wall.start.z + t * dz }
}

export function isEnvelopeWall(building: BuildingModel, storey: StoreyModel, wall: WallModel) {
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  return slab.footprint.some(
    (a, i) =>
      pointOnSegment(wall.start, a, slab.footprint[(i + 1) % slab.footprint.length]) &&
      pointOnSegment(wall.end, a, slab.footprint[(i + 1) % slab.footprint.length]),
  )
}

function validateRooms(building: BuildingModel, storey: StoreyModel) {
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  for (const wall of building.walls.filter((item) => storey.wallRefs.includes(item.ref))) {
    if (![wall.start.x, wall.start.z, wall.end.x, wall.end.z].every(Number.isFinite))
      throw new Error('Enter finite wall coordinates.')
    if (!isEnvelopeWall(building, storey, wall) && (slab.holes ?? []).some((hole) => wallTouchesVoid(wall, hole)))
      throw new Error('Keep partitions clear of floor openings.')
    if (wallLength(wall) < 0.11) throw new Error('This edit would collapse a connected wall.')
    for (const opening of wall.openings) {
      if (
        opening.offsetM - opening.widthM / 2 < -0.0001 ||
        opening.offsetM + opening.widthM / 2 > wallLength(wall) + 0.0001 ||
        opening.sillM + opening.heightM > wall.heightM + 0.0001
      )
        throw new Error('An opening would no longer fit its wall.')
    }
  }
  for (const room of building.spaces.filter((item) => storey.spaceRefs.includes(item.ref))) {
    const polygon = spaceFootprint(building, room)
    if (
      polygonArea(polygon) < 0.25 ||
      polygonSelfIntersects(polygon) ||
      polygon.some((point) => !inside(point, slab.footprint))
    )
      throw new Error('This edit would cross or collapse a room boundary.')
    room.boundary.forEach((use, i) => {
      const wall = building.walls.find((item) => item.ref === use.wallRef)!
      if (!same(use.direction === 1 ? wall.end : wall.start, polygon[(i + 1) % polygon.length]))
        throw new Error('The room boundary must remain connected.')
    })
  }
}

/** Split a host without changing its geometry, opening positions or either neighbouring room. */
function splitHost(building: BuildingModel, storey: StoreyModel, wall: WallModel, point: Vec2, newRef: string) {
  if (same(point, wall.start) || same(point, wall.end)) return
  if (
    wall.locked ||
    building.spaces.some((room) => room.locked && room.boundary.some((use) => use.wallRef === wall.ref))
  )
    throw new Error('A partition cannot split a locked wall or room.')
  const offset = distance(wall.start, point)
  if (wall.openings.some((opening) => Math.abs(opening.offsetM - offset) < opening.widthM / 2 + 0.06))
    throw new Error('Place the partition away from doors and windows.')
  const second = structuredClone(wall)
  second.ref = newRef
  second.start = { ...point }
  second.openings = wall.openings
    .filter((opening) => opening.offsetM > offset)
    .map((opening) => ({ ...opening, wallRef: newRef, offsetM: opening.offsetM - offset }))
  wall.end = { ...point }
  wall.openings = wall.openings.filter((opening) => opening.offsetM < offset)
  building.walls.push(second)
  storey.wallRefs.push(newRef)
  for (const room of building.spaces) {
    room.boundary = room.boundary.flatMap((use): SpaceBoundaryUse[] =>
      use.wallRef !== wall.ref
        ? [use]
        : use.direction === 1
          ? [use, { wallRef: newRef, direction: 1 }]
          : [{ wallRef: newRef, direction: -1 }, use],
    )
  }
}

export function splitRoom(
  building: BuildingModel,
  storey: StoreyModel,
  command: Extract<InteriorCommand, { action: 'split' }>,
) {
  const room = building.spaces.find((item) => item.ref === command.spaceRef && storey.spaceRefs.includes(item.ref))
  if (!room || room.locked) throw new Error('Select an unlocked room to divide.')
  if (
    building.spaces.some((item) => item.ref === command.newSpaceRef) ||
    building.walls.some((item) => item.ref === command.partitionRef || item.ref.startsWith(`${command.partitionRef}/`))
  )
    throw new Error('Partition references must be unique.')
  if (
    !Number.isFinite(command.thicknessM) ||
    command.thicknessM < 0.06 ||
    command.thicknessM > 0.5 ||
    !command.name.trim()
  )
    throw new Error('Enter a room name and a wall thickness between 0.06 and 0.5 m.')
  const hosts = [command.start, command.end].map((point) => {
    const candidates = room.boundary
      .map((use) => building.walls.find((wall) => wall.ref === use.wallRef)!)
      .map((wall) => ({ wall, point: closestWallPoint(point, wall) }))
      .sort((a, b) => distance(point, a.point) - distance(point, b.point))
    if (!candidates[0] || distance(point, candidates[0].point) > 0.2)
      throw new Error('Start and end the partition on the selected room boundary.')
    return candidates[0]
  })
  const [a, b] = hosts.map((host) => host.point)
  const polygon = spaceFootprint(building, room)
  if (distance(a, b) < 0.5 || !pointInPolygon({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, polygon))
    throw new Error('Draw a partition through the room interior.')
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i]
    const d = polygon[(i + 1) % polygon.length]
    if (cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8)
      throw new Error('A partition cannot cross another room boundary.')
  }
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  for (const hole of slab.holes ?? []) {
    if (inside(a, hole) || inside(b, hole) || hole.some((c, i) => intersects(a, b, c, hole[(i + 1) % hole.length])))
      throw new Error('Keep the partition clear of stair and floor openings.')
  }
  hosts.forEach((host, i) => splitHost(building, storey, host.wall, host.point, `${command.partitionRef}/host-${i}`))
  const points = spaceFootprint(building, room)
  const ai = points.findIndex((point) => same(point, a))
  const bi = points.findIndex((point) => same(point, b))
  if (ai < 0 || bi < 0 || ai === bi) throw new Error('Could not connect the partition endpoints.')
  const walk = (from: number, to: number) => {
    const result: SpaceBoundaryUse[] = []
    for (let i = from; i !== to; i = (i + 1) % points.length) result.push(room.boundary[i])
    return result
  }
  const first = [...walk(ai, bi), { wallRef: command.partitionRef, direction: -1 as const }]
  const second = [...walk(bi, ai), { wallRef: command.partitionRef, direction: 1 as const }]
  const newRoom: SpaceModel = {
    ...structuredClone(room),
    ref: command.newSpaceRef,
    name: command.name.trim(),
    boundary: second,
  }
  room.boundary = first
  building.walls.push({
    ref: command.partitionRef,
    start: a,
    end: b,
    thicknessM: command.thicknessM,
    heightM: storey.clearHeightM,
    baseElevationM: storey.elevationM,
    openings: [],
    locked: false,
  })
  storey.wallRefs.push(command.partitionRef)
  storey.spaceRefs.push(newRoom.ref)
  building.spaces.push(newRoom)
  validateRooms(building, storey)
}

export function mergeRooms(building: BuildingModel, storey: StoreyModel, wallRef: string) {
  const wall = building.walls.find((item) => item.ref === wallRef && storey.wallRefs.includes(item.ref))
  const rooms = building.spaces.filter(
    (room) => storey.spaceRefs.includes(room.ref) && room.boundary.some((use) => use.wallRef === wallRef),
  )
  if (
    !wall ||
    wall.locked ||
    rooms.length !== 2 ||
    rooms.some((room) => room.locked) ||
    isEnvelopeWall(building, storey, wall)
  )
    throw new Error('Select an unlocked partition between two rooms.')
  if (wall.openings.length) throw new Error('Remove the partition’s openings before merging rooms.')
  const [keep, remove] = rooms
  const uses = rooms.flatMap((room) => room.boundary.filter((use) => use.wallRef !== wallRef))
  const endpoint = (use: SpaceBoundaryUse, start: boolean) => {
    const host = building.walls.find((item) => item.ref === use.wallRef)!
    return (use.direction === 1) === start ? host.start : host.end
  }
  const boundary = [uses.shift()!]
  while (uses.length) {
    const end = endpoint(boundary.at(-1)!, false)
    const index = uses.findIndex((use) => same(endpoint(use, true), end))
    if (index < 0) throw new Error('These rooms cannot be merged along a single partition.')
    boundary.push(uses.splice(index, 1)[0])
  }
  keep.boundary = boundary
  building.spaces = building.spaces.filter((room) => room.ref !== remove.ref)
  building.walls = building.walls.filter((item) => item.ref !== wallRef)
  storey.spaceRefs = storey.spaceRefs.filter((ref) => ref !== remove.ref)
  storey.wallRefs = storey.wallRefs.filter((ref) => ref !== wallRef)
  for (const segment of building.roof.segments) if (segment.spaceRef === remove.ref) segment.spaceRef = keep.ref
  for (const platform of building.platforms) if (platform.spaceRef === remove.ref) platform.spaceRef = keep.ref
  for (const ceiling of building.ceilingFinishes) if (ceiling.spaceRef === remove.ref) ceiling.spaceRef = keep.ref
  validateRooms(building, storey)
}

export function moveConnectedWall(
  building: BuildingModel,
  storey: StoreyModel,
  command: Extract<InteriorCommand, { action: 'wall' }>,
) {
  const wall = building.walls.find((item) => item.ref === command.wallRef && storey.wallRefs.includes(item.ref))
  if (!wall || wall.locked || isEnvelopeWall(building, storey, wall))
    throw new Error('The exterior envelope stays fixed. Select an unlocked interior wall.')
  const oldStart = { ...wall.start }
  const oldEnd = { ...wall.end }
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  const map = (point: Vec2) => (same(point, oldStart) ? command.start : same(point, oldEnd) ? command.end : point)
  for (const connected of building.walls.filter((item) => storey.wallRefs.includes(item.ref))) {
    const start = map(connected.start)
    const end = map(connected.end)
    if (start === connected.start && end === connected.end) continue
    if (
      connected.locked ||
      building.spaces.some((room) => room.locked && room.boundary.some((use) => use.wallRef === connected.ref))
    )
      throw new Error('A connected wall or room is locked.')
    if (
      isEnvelopeWall(building, storey, connected) &&
      !slab.footprint.some(
        (a, i) =>
          pointOnSegment(start, a, slab.footprint[(i + 1) % slab.footprint.length]) &&
          pointOnSegment(end, a, slab.footprint[(i + 1) % slab.footprint.length]),
      )
    )
      throw new Error('This edit would move the exterior envelope.')
    const oldLength = wallLength(connected)
    connected.start = { ...start }
    connected.end = { ...end }
    connected.openings.forEach((opening) => {
      opening.offsetM *= wallLength(connected) / oldLength
    })
  }
  if (command.thicknessM !== undefined) {
    if (!Number.isFinite(command.thicknessM) || command.thicknessM < 0.06 || command.thicknessM > 0.5)
      throw new Error('Wall thickness must be between 0.06 and 0.5 m.')
    wall.thicknessM = command.thicknessM
  }
  if (command.heightM !== undefined) {
    if (!Number.isFinite(command.heightM) || command.heightM < 0.2 || command.heightM > storey.clearHeightM)
      throw new Error('Keep wall height within the storey.')
    wall.heightM = command.heightM
  }
  validateRooms(building, storey)
}
