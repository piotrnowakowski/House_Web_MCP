import { gardenFixtureById } from './gardenFixtures'
import { buildingGroundOffset, elevationAt, pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonBounds } from './geometry'
import { roofWings } from './roofWings'
import { solarPosition, sunDirectionModel, sunriseSunset, type SolarSite, type SunTime } from './solar'
import type { BuildingModel, Polygon2, ProjectV2, Vec2, Vec3 } from './types'

export type SunTarget = { kind: 'zone'; ref: string } | { kind: 'plant'; ref: string } | { kind: 'fixture'; ref: string } | { kind: 'point'; x: number; z: number } | { kind: 'site' }
export interface SunlightInput { target: SunTarget; month: number; day?: number; stepMinutes?: number; cellM?: number; includeGrid?: boolean; hours?: { from: number; to: number } }
export interface SunlightGrid { width: number; height: number; originX: number; originZ: number; cellM: number; hours: number[] }
export interface SunlightAnalysis {
  target: SunTarget; month: number; day: number; stepMinutes: number; cellM: number
  sunriseLocal: number | null; sunsetLocal: number | null; daylightHours: number; window: { fromLocal: number; toLocal: number } | null
  sunHours: { mean: number; min: number; max: number }; firstSunLocal: number | null; lastSunLocal: number | null
  shadedFraction: number; expectedSunHours: number; sampleCount: number; grid?: SunlightGrid
}

type Plane = { normal: Vec3; d: number }
/** Convex volumes keep a horizontal circle and top height for a cheap broad phase. */
export type Occluder =
  | { kind: 'convex'; ref: string; planes: Plane[]; centre: Vec2; radius: number; top: number }
  | { kind: 'sphere'; ref: string; center: Vec3; radius: number }

const MAX_CELLS = 2500
const SAMPLE_HEIGHT_M = 0.3
const CORE_HOURS = { from: 9, to: 17 }
const SUN_LOVING_MIN_CORE_HOURS = 6
const SHADE_MAX_CORE_HOURS = 3
const rad = (degrees: number) => degrees * Math.PI / 180
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1))
const siteOf = (project: ProjectV2): SolarSite => ({ latitude: project.climateProfile.latitude, longitude: project.climateProfile.longitude, timezone: project.climateProfile.timezone })

type Frame = { position: Vec2; yaw: number; offsetY: number }
const rotateXZ = (point: Vec3, yaw: number): Vec3 => { const c = Math.cos(yaw); const s = Math.sin(yaw); return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c } }
const toWorldPlane = (plane: Plane, frame: Frame): Plane => {
  const normal = rotateXZ(plane.normal, frame.yaw)
  return { normal, d: plane.d + dot(normal, { x: frame.position.x, y: frame.offsetY, z: frame.position.z }) }
}
const toWorldPoint = (point: Vec3, frame: Frame): Vec3 => { const rotated = rotateXZ(point, frame.yaw); return { x: rotated.x + frame.position.x, y: rotated.y + frame.offsetY, z: rotated.z + frame.position.z } }

const convexFromLocalPlanes = (ref: string, planes: Plane[], localCorners: Vec3[], frame: Frame): Occluder => {
  const corners = localCorners.map((corner) => toWorldPoint(corner, frame))
  const centre = { x: corners.reduce((sum, c) => sum + c.x, 0) / corners.length, z: corners.reduce((sum, c) => sum + c.z, 0) / corners.length }
  return {
    kind: 'convex', ref, planes: planes.map((plane) => toWorldPlane(plane, frame)), centre,
    radius: Math.max(...corners.map((c) => Math.hypot(c.x - centre.x, c.z - centre.z))), top: Math.max(...corners.map((c) => c.y)),
  }
}

/** Oriented box in a local frame: centre, half extents, and a yaw of the box's own x axis about y. */
const boxOccluder = (ref: string, centre: Vec3, half: Vec3, boxYaw: number, frame: Frame): Occluder => {
  const axisX = rotateXZ({ x: 1, y: 0, z: 0 }, boxYaw); const axisZ = rotateXZ({ x: 0, y: 0, z: 1 }, boxYaw); const axisY = { x: 0, y: 1, z: 0 }
  const planes: Plane[] = [
    { normal: axisX, d: dot(axisX, centre) + half.x }, { normal: scale(axisX, -1), d: -dot(axisX, centre) + half.x },
    { normal: axisY, d: centre.y + half.y }, { normal: scale(axisY, -1), d: -centre.y + half.y },
    { normal: axisZ, d: dot(axisZ, centre) + half.z }, { normal: scale(axisZ, -1), d: -dot(axisZ, centre) + half.z },
  ]
  const corners: Vec3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    corners.push({ x: centre.x + axisX.x * half.x * sx + axisZ.x * half.z * sz, y: centre.y + half.y * sy, z: centre.z + axisX.z * half.x * sx + axisZ.z * half.z * sz })
  }
  return convexFromLocalPlanes(ref, planes, corners, frame)
}

const slopePlane = (axis: 'x' | 'z', from: number, fromY: number, to: number, toY: number): Plane => {
  // Points under the roof satisfy y <= fromY + k * (coord - from) along the given axis.
  const k = (toY - fromY) / (to - from)
  const normal = normalize(axis === 'x' ? { x: -k, y: 1, z: 0 } : { x: 0, y: 1, z: -k })
  return { normal, d: dot(normal, axis === 'x' ? { x: from, y: fromY, z: 0 } : { x: 0, y: fromY, z: from }) }
}

const roofOccluders = (building: BuildingModel, frame: Frame): Occluder[] => roofWings(building).map((wing, index) => {
  const bounds = polygonBounds(wing.footprint); const over = wing.overhangM
  const x0 = bounds.minX - over; const x1 = bounds.maxX + over; const z0 = bounds.minZ - over; const z1 = bounds.maxZ + over
  const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2; const base = wing.baseElevationM; const ridge = wing.ridgeElevationM
  const ref = `${building.roof.ref}/wing-${index + 1}`
  if (wing.type === 'flat') return boxOccluder(ref, { x: cx, y: (base + ridge) / 2, z: cz }, { x: (x1 - x0) / 2, y: (ridge - base) / 2, z: (z1 - z0) / 2 }, 0, frame)
  const bottom: Plane = { normal: { x: 0, y: -1, z: 0 }, d: -base }
  const ends: Plane[] = [{ normal: { x: 0, y: 0, z: 1 }, d: z1 }, { normal: { x: 0, y: 0, z: -1 }, d: -z0 }, { normal: { x: 1, y: 0, z: 0 }, d: x1 }, { normal: { x: -1, y: 0, z: 0 }, d: -x0 }]
  const corners: Vec3[] = [{ x: x0, y: base, z: z0 }, { x: x1, y: base, z: z0 }, { x: x1, y: base, z: z1 }, { x: x0, y: base, z: z1 }, { x: cx, y: ridge, z: cz }]
  if (wing.type === 'hip') {
    return convexFromLocalPlanes(ref, [bottom, ...ends, slopePlane('x', x0, base, cx, ridge), slopePlane('x', x1, base, cx, ridge), slopePlane('z', z0, base, cz, ridge), slopePlane('z', z1, base, cz, ridge)], corners, frame)
  }
  const slopes = wing.ridgeAxis === 'z'
    ? [slopePlane('x', x0, base, cx, ridge), slopePlane('x', x1, base, cx, ridge)]
    : [slopePlane('z', z0, base, cz, ridge), slopePlane('z', z1, base, cz, ridge)]
  const ridgeCorners: Vec3[] = wing.ridgeAxis === 'z' ? [{ x: cx, y: ridge, z: z0 }, { x: cx, y: ridge, z: z1 }] : [{ x: x0, y: ridge, z: cz }, { x: x1, y: ridge, z: cz }]
  return convexFromLocalPlanes(ref, [bottom, ...ends, ...slopes], [...corners.slice(0, 4), ...ridgeCorners], frame)
})

export const collectOccluders = (project: ProjectV2): Occluder[] => {
  const occluders: Occluder[] = []
  for (const building of project.buildings) {
    const frame: Frame = { position: building.position, yaw: rad(building.rotationDegrees), offsetY: buildingGroundOffset(building, 0) }
    for (const wall of building.walls) {
      const dx = wall.end.x - wall.start.x; const dz = wall.end.z - wall.start.z; const length = Math.hypot(dx, dz)
      const centre = { x: (wall.start.x + wall.end.x) / 2, y: wall.baseElevationM + wall.heightM / 2, z: (wall.start.z + wall.end.z) / 2 }
      occluders.push(boxOccluder(wall.ref, centre, { x: length / 2, y: wall.heightM / 2, z: wall.thicknessM / 2 }, -Math.atan2(dz, dx), frame))
    }
    for (const slab of building.slabs) {
      const bounds = polygonBounds(slab.footprint)
      occluders.push(boxOccluder(slab.ref, { x: (bounds.minX + bounds.maxX) / 2, y: slab.topElevationM - slab.thicknessM / 2, z: (bounds.minZ + bounds.maxZ) / 2 }, { x: (bounds.maxX - bounds.minX) / 2, y: slab.thicknessM / 2, z: (bounds.maxZ - bounds.minZ) / 2 }, 0, frame))
    }
    occluders.push(...roofOccluders(building, frame))
  }
  for (const plant of project.landscape.plants) {
    occluders.push({ kind: 'sphere', ref: plant.ref, center: { x: plant.position.x, y: elevationAt(project, plant.position.x, plant.position.z) + plant.matureHeightM * 0.72, z: plant.position.z }, radius: Math.max(0.25, plant.canopyM / 2) })
  }
  for (const fixture of project.landscape.fixtures) {
    const definition = gardenFixtureById(fixture.catalogId)
    const lift = definition.category === 'crop' ? 0.43 : 0
    const baseY = elevationAt(project, fixture.position.x, fixture.position.z) + lift
    const frame: Frame = { position: fixture.position, yaw: rad(fixture.rotationDegrees), offsetY: 0 }
    occluders.push(boxOccluder(fixture.ref, { x: 0, y: baseY + definition.heightM / 2, z: 0 }, { x: definition.widthM / 2, y: definition.heightM / 2, z: definition.depthM / 2 }, 0, frame))
  }
  return occluders
}

const rayHitsConvex = (origin: Vec3, direction: Vec3, occluder: Extract<Occluder, { kind: 'convex' }>) => {
  let tMin = 0; let tMax = Number.POSITIVE_INFINITY
  for (const plane of occluder.planes) {
    const denominator = dot(plane.normal, direction); const distance = plane.d - dot(plane.normal, origin)
    if (Math.abs(denominator) < 1e-12) { if (distance < 0) return false; continue }
    const t = distance / denominator
    if (denominator > 0) tMax = Math.min(tMax, t); else tMin = Math.max(tMin, t)
    if (tMin > tMax) return false
  }
  return tMax >= 0
}
const rayHitsSphere = (origin: Vec3, direction: Vec3, occluder: Extract<Occluder, { kind: 'sphere' }>) => {
  const offset = { x: origin.x - occluder.center.x, y: origin.y - occluder.center.y, z: origin.z - occluder.center.z }
  const b = dot(offset, direction); const c = dot(offset, offset) - occluder.radius * occluder.radius
  if (c <= 0) return true
  if (b > 0) return false
  return b * b - c >= 0
}

const rayIsBlocked = (origin: Vec3, direction: Vec3, occluders: Occluder[]) => {
  const horizontal = Math.hypot(direction.x, direction.z)
  for (const occluder of occluders) {
    if (occluder.kind === 'sphere') { if (rayHitsSphere(origin, direction, occluder)) return true; continue }
    if (origin.y >= occluder.top) continue
    const reach = direction.y > 1e-9 ? (occluder.top - origin.y) / direction.y * horizontal : Number.POSITIVE_INFINITY
    if (Math.hypot(occluder.centre.x - origin.x, occluder.centre.z - origin.z) - occluder.radius > reach) continue
    if (rayHitsConvex(origin, direction, occluder)) return true
  }
  return false
}

/** True when the sun is above the horizon and no occluder blocks the ray from `point` toward it. */
export const isLitAt = (project: ProjectV2, occluders: Occluder[], point: Vec3, time: SunTime) => {
  const sun = solarPosition(siteOf(project), time)
  if (sun.altitudeDeg <= 0) return false
  return !rayIsBlocked(point, sunDirectionModel(sun.azimuthDeg, sun.altitudeDeg, project.site.northDegrees), occluders)
}

type Samples = { points: Vec3[]; cells: number[]; width: number; height: number; originX: number; originZ: number; cellM: number; excludeRef?: string }
const gridSamples = (project: ProjectV2, polygon: Polygon2, requestedCellM: number, height: number): Samples => {
  const bounds = polygonBounds(polygon)
  const cellM = Math.max(requestedCellM, Math.sqrt(polygonArea(polygon) / MAX_CELLS), 0.05)
  const width = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellM)); const depth = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellM))
  const points: Vec3[] = []; const cells: number[] = []
  for (let row = 0; row < depth; row += 1) for (let column = 0; column < width; column += 1) {
    const x = bounds.minX + (column + 0.5) * cellM; const z = bounds.minZ + (row + 0.5) * cellM
    if (pointInPolygon({ x, z }, polygon) || pointOnPolygonBoundary({ x, z }, polygon)) { points.push({ x, y: elevationAt(project, x, z) + height, z }); cells.push(row * width + column) }
  }
  return { points, cells, width, height: depth, originX: bounds.minX, originZ: bounds.minZ, cellM }
}
const patchSamples = (project: ProjectV2, centre: Vec2, height: number, excludeRef?: string): Samples => {
  const cellM = 0.5; const points: Vec3[] = []; const cells: number[] = []
  for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
    const x = centre.x + (column - 1) * cellM; const z = centre.z + (row - 1) * cellM
    points.push({ x, y: elevationAt(project, x, z) + height, z }); cells.push(row * 3 + column)
  }
  return { points, cells, width: 3, height: 3, originX: centre.x - 1.5 * cellM, originZ: centre.z - 1.5 * cellM, cellM, excludeRef }
}

export const sampleTargetPoints = (project: ProjectV2, target: SunTarget, cellM: number): Samples => {
  if (target.kind === 'site') return gridSamples(project, project.site.boundary, cellM, SAMPLE_HEIGHT_M)
  if (target.kind === 'zone') {
    const zone = project.landscape.zones.find((item) => item.ref === target.ref)
    if (!zone) throw new Error(`Landscape zone not found: ${target.ref}`)
    return gridSamples(project, zone.footprint, cellM, SAMPLE_HEIGHT_M)
  }
  if (target.kind === 'plant') {
    const plant = project.landscape.plants.find((item) => item.ref === target.ref)
    if (!plant) throw new Error(`Plant not found: ${target.ref}`)
    return patchSamples(project, plant.position, SAMPLE_HEIGHT_M, plant.ref)
  }
  if (target.kind === 'fixture') {
    const fixture = project.landscape.fixtures.find((item) => item.ref === target.ref)
    if (!fixture) throw new Error(`Garden fixture not found: ${target.ref}`)
    const definition = gardenFixtureById(fixture.catalogId)
    return patchSamples(project, fixture.position, (definition.category === 'crop' ? 0.43 : definition.heightM) + SAMPLE_HEIGHT_M, fixture.ref)
  }
  return patchSamples(project, { x: target.x, z: target.z }, SAMPLE_HEIGHT_M)
}

export const analyzeSunlight = (project: ProjectV2, input: SunlightInput): SunlightAnalysis => {
  const day = input.day ?? 21; const stepMinutes = input.stepMinutes ?? 30; const requestedCellM = input.cellM ?? 0.5
  const site = siteOf(project); const events = sunriseSunset(site, { month: input.month, day, hour: 12 })
  const samples = sampleTargetPoints(project, input.target, requestedCellM)
  const occluders = collectOccluders(project).filter((occluder) => occluder.ref !== samples.excludeRef)
  const hours = new Array<number>(samples.points.length).fill(0)
  let firstSunLocal: number | null = null; let lastSunLocal: number | null = null
  const daylight = events?.daylightHours ?? 0
  const windowFrom = events ? Math.max(events.sunriseHour, input.hours?.from ?? events.sunriseHour) : 0
  const windowTo = events ? Math.min(events.sunsetHour, input.hours?.to ?? events.sunsetHour) : 0
  const span = Math.max(0, windowTo - windowFrom)
  if (events && span > 0 && samples.points.length) {
    const steps = Math.max(1, Math.ceil(span * 60 / stepMinutes)); const weight = span / steps
    for (let step = 0; step < steps; step += 1) {
      const hour = windowFrom + (step + 0.5) * weight
      const sun = solarPosition(site, { month: input.month, day, hour })
      if (sun.altitudeDeg <= 0) continue
      const direction = sunDirectionModel(sun.azimuthDeg, sun.altitudeDeg, project.site.northDegrees)
      let lit = 0
      samples.points.forEach((point, index) => { if (!rayIsBlocked(point, direction, occluders)) { hours[index] += weight; lit += 1 } })
      if (lit * 2 >= samples.points.length) { firstSunLocal ??= hour; lastSunLocal = hour }
    }
  }
  const count = hours.length || 1
  const mean = hours.reduce((sum, value) => sum + value, 0) / count
  const sunshine = project.climateProfile.months.find((item) => item.month === input.month)?.sunshineHours ?? 0
  const result: SunlightAnalysis = {
    target: input.target, month: input.month, day, stepMinutes, cellM: samples.cellM,
    sunriseLocal: events ? round(events.sunriseHour, 2) : null, sunsetLocal: events ? round(events.sunsetHour, 2) : null, daylightHours: round(daylight, 2),
    window: events && span > 0 ? { fromLocal: round(windowFrom, 2), toLocal: round(windowTo, 2) } : null,
    sunHours: { mean: round(mean, 2), min: round(hours.length ? Math.min(...hours) : 0, 2), max: round(hours.length ? Math.max(...hours) : 0, 2) },
    firstSunLocal: firstSunLocal === null ? null : round(firstSunLocal, 2), lastSunLocal: lastSunLocal === null ? null : round(lastSunLocal, 2),
    shadedFraction: round(hours.filter((value) => value < 1).length / count, 3),
    expectedSunHours: daylight > 0 ? round(mean * sunshine / (daylight * 30.44), 2) : 0, sampleCount: hours.length,
  }
  if (input.includeGrid) {
    const cells = new Array<number>(samples.width * samples.height).fill(-1)
    samples.cells.forEach((cell, index) => { cells[cell] = round(hours[index], 2) })
    result.grid = { width: samples.width, height: samples.height, originX: round(samples.originX, 3), originZ: round(samples.originZ, 3), cellM: round(samples.cellM, 3), hours: cells }
  }
  return result
}

/** Sun-loving plants and crop fixtures that get little direct sun between 09:00 and 17:00 on 21 June, and shade plants that get too much. */
export const sunMismatchIssues = (project: ProjectV2) => {
  const targets = [
    ...project.landscape.plants.filter((plant) => plant.sunNeed !== 'partial').map((plant) => ({ ref: plant.ref, name: plant.name, need: plant.sunNeed as 'sun' | 'shade', target: { kind: 'plant', ref: plant.ref } as SunTarget })),
    ...project.landscape.fixtures.filter((fixture) => gardenFixtureById(fixture.catalogId).category === 'crop').map((fixture) => ({ ref: fixture.ref, name: fixture.name, need: 'sun' as const, target: { kind: 'fixture', ref: fixture.ref } as SunTarget })),
  ]
  return targets.flatMap(({ ref, name, need, target }) => {
    const mean = analyzeSunlight(project, { target, month: 6, day: 21, stepMinutes: 60, hours: CORE_HOURS }).sunHours.mean
    const hours = `${name} gets about ${mean.toFixed(1)} h of direct sun between 09:00 and 17:00 on 21 June`
    if (need === 'sun' && mean < SUN_LOVING_MIN_CORE_HOURS) return [{ severity: 'warning' as const, code: 'planting.sun-mismatch', message: `${hours}; sun-loving planting needs at least ${SUN_LOVING_MIN_CORE_HOURS} h.`, subjectRef: ref }]
    if (need === 'shade' && mean > SHADE_MAX_CORE_HOURS) return [{ severity: 'warning' as const, code: 'planting.sun-mismatch', message: `${hours}; shade planting should stay under ${SHADE_MAX_CORE_HOURS} h.`, subjectRef: ref }]
    return []
  })
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const formatSunMoment = (month: number, day: number, hour: number) => {
  const minutes = Math.round(hour * 60)
  return `${day} ${MONTH_ABBREVIATIONS[month - 1] ?? month} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Resolves an agent-supplied reference or point into a sun target, rejecting refs that are not sun-analysable. */
export const resolveSunTarget = (project: ProjectV2, targetRef: string | undefined, point: Vec2 | undefined): SunTarget => {
  if (point) return { kind: 'point', x: point.x, z: point.z }
  if (!targetRef) throw new Error('Provide a targetRef (zone, plant, fixture or site) or a point.')
  if (targetRef === 'site') return { kind: 'site' }
  if (project.landscape.zones.some((zone) => zone.ref === targetRef)) return { kind: 'zone', ref: targetRef }
  if (project.landscape.plants.some((plant) => plant.ref === targetRef)) return { kind: 'plant', ref: targetRef }
  if (project.landscape.fixtures.some((fixture) => fixture.ref === targetRef)) return { kind: 'fixture', ref: targetRef }
  throw new Error(`Sun analysis target not found: ${targetRef}. Use a landscape zone, plant or garden fixture ref, or site.`)
}

/** Averages the grid down so neither side exceeds `maxCells`, keeping -1 for cells with no covered samples. */
export const downsampleSunGrid = (grid: SunlightGrid, maxCells: number): SunlightGrid => {
  const factor = Math.ceil(Math.max(grid.width, grid.height) / maxCells)
  if (factor <= 1) return grid
  const width = Math.ceil(grid.width / factor); const height = Math.ceil(grid.height / factor)
  const hours = new Array<number>(width * height).fill(-1)
  for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) {
    let sum = 0; let count = 0
    for (let dz = 0; dz < factor; dz += 1) for (let dx = 0; dx < factor; dx += 1) {
      const sourceRow = row * factor + dz; const sourceColumn = column * factor + dx
      if (sourceRow >= grid.height || sourceColumn >= grid.width) continue
      const value = grid.hours[sourceRow * grid.width + sourceColumn]
      if (value >= 0) { sum += value; count += 1 }
    }
    if (count) hours[row * width + column] = round(sum / count, 2)
  }
  return { width, height, originX: grid.originX, originZ: grid.originZ, cellM: round(grid.cellM * factor, 3), hours }
}
