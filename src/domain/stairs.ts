import { atticClearanceAt } from './attic'
import { pointInPolygon, pointOnPolygonBoundary } from './geometry'
import type { BuildingModel, Polygon2, StairModel, Vec2 } from './types'

export interface StairSurface { x: number; z: number; width: number; depth: number; top: number }

/** Both flights share a going and riser; only their number of risers may differ. */
export function uStairLayout(stairs: StairModel, rise: number) {
  if (!stairs.uTurn) return null
  const lowerSteps = stairs.uTurn.lowerSteps ?? stairs.steps / 2
  const upperSteps = stairs.steps - lowerSteps
  if (![lowerSteps, upperSteps].every(n => Number.isInteger(n) && n >= 2)) return null
  const tread = stairs.runM / (lowerSteps - 1), riser = rise / stairs.steps
  const landing = stairs.uTurn.landingDepthM
  return { lowerSteps, upperSteps, tread, riser, landingHeight: lowerSteps * riser,
    lowerLength: landing + stairs.runM, upperLength: landing + (upperSteps - 1) * tread }
}

/** Walking surfaces relative to the lower floor and stair start; landings replace a tread. */
export function uStairSurfaces(stairs: StairModel, rise: number): StairSurface[] {
  const layout = uStairLayout(stairs, rise)
  if (!stairs.uTurn || !layout) return []
  const { lowerSteps, upperSteps, tread, riser, landingHeight } = layout
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn
  const depth = stairs.widthM * 2 + gap
  const side = (z: number) => stairs.uTurn?.entrySide === 'max-z' ? depth - z : z
  const surfaces: StairSurface[] = [{ x: landing / 2, z: (2 * stairs.widthM + gap) / 2, width: landing, depth: 2 * stairs.widthM + gap, top: landingHeight }]
  for (let i = 0; i < Math.max(lowerSteps, upperSteps) - 1; i++) {
    const x = landing + (i + .5) * tread
    if (i < lowerSteps - 1) surfaces.push({ x, z: side(stairs.widthM / 2), width: tread, depth: stairs.widthM, top: (lowerSteps - 1 - i) * riser })
    if (i < upperSteps - 1) surfaces.push({ x, z: side(stairs.widthM * 1.5 + gap), width: tread, depth: stairs.widthM, top: (lowerSteps + 1 + i) * riser })
  }
  return surfaces
}

export function uStairOpening(building: BuildingModel, stairs: StairModel) {
  if (!stairs.uTurn) return undefined
  const upper = building.storeys.find(s => s.ref === stairs.toStoreyRef)
  const centre = { x: stairs.start.x + stairs.uTurn.landingDepthM / 2, z: stairs.start.z + stairs.widthM + stairs.uTurn.gapM / 2 }
  return building.slabs.find(s => s.ref === upper?.baseSlabRef)?.holes?.find(hole => pointInPolygon(centre, hole))
}

/** Glass panel profiles in the unreflected stair frame; the renderer reflects the whole assembly. */
export function uStairGlassPanels(stairs: StairModel, rise: number) {
  const layout = uStairLayout(stairs, rise)
  if (!layout || !stairs.uTurn) return []
  const { lowerLength, upperLength, landingHeight, riser } = layout
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn, width = stairs.widthM
  // The straight line can sit one riser below a tread edge. New splits retain
  // 0.92 m there; existing equal-flight projects keep their published appearance.
  const height = stairs.uTurn.lowerSteps === undefined ? 1 : .92 + riser
  const lower = { x1: landing, x2: lowerLength, bottom1: landingHeight-riser, bottom2: 0, height }
  const upper = { x1: landing, x2: upperLength, bottom1: landingHeight, bottom2: rise-riser, height }
  const inner = [{ ...lower, z: width }, { ...upper, z: width+gap }]
  if (stairs.uTurn.lowerSteps === undefined) return [...inner,
    stairs.uTurn.entrySide === 'max-z' ? { ...lower, z: 0 } : { ...upper, z: width*2+gap }]
  return [...inner, { ...lower, z: 0 }, { ...upper, z: width*2+gap },
    ...[0, width*2+gap].map(z => ({ x1: 0, x2: landing, z, bottom1: landingHeight, bottom2: landingHeight, height: 1 }))]
}

/** Guards follow the actual near edge of the slab hole, leaving the upper flight exit open.
 * Coordinates are relative to stair start, already reflected for entrySide. */
export function uStairExitGuards(stairs: StairModel, opening?: Polygon2): { start: Vec2; end: Vec2 }[] {
  const layout = uStairLayout(stairs, 1)
  if (!layout || !stairs.uTurn) return []
  const width = stairs.widthM, depth = width * 2 + stairs.uTurn.gapM
  const exitMinZ = stairs.uTurn.entrySide === 'max-z' ? 0 : width + stairs.uTurn.gapM
  const exitMaxZ = exitMinZ + width
  const length = Math.max(layout.lowerLength, layout.upperLength)
  const hole = opening?.map(p => ({ x: p.x - stairs.start.x, z: p.z - stairs.start.z }))
    ?? [{ x: 0, z: 0 }, { x: length, z: 0 }, { x: length, z: depth }, { x: 0, z: depth }]
  const minX = Math.min(layout.lowerLength, layout.upperLength), epsilon = 1e-6
  return hole.flatMap((p, i) => {
    let start = { ...p }, end = { ...hole[(i + 1) % hole.length] }
    if (Math.max(start.x, end.x) < minX - epsilon) return []
    if (Math.abs(start.x - end.x) > epsilon) {
      if (start.x < minX) { const t = (minX - start.x) / (end.x - start.x); start = { x: minX, z: start.z + t * (end.z - start.z) } }
      if (end.x < minX) { const t = (minX - end.x) / (start.x - end.x); end = { x: minX, z: end.z + t * (start.z - end.z) } }
    }
    if (Math.hypot(end.x - start.x, end.z - start.z) < epsilon) return []
    if (Math.abs(start.x - layout.upperLength) < epsilon && Math.abs(end.x - layout.upperLength) < epsilon) {
      const lo = Math.min(start.z, end.z), hi = Math.max(start.z, end.z)
      return [[lo, Math.min(hi, exitMinZ)], [Math.max(lo, exitMaxZ), hi]]
        .filter(([a, b]) => b - a > epsilon).map(([a, b]) => ({ start: { x: start.x, z: a }, end: { x: start.x, z: b } }))
    }
    return [{ start, end }]
  })
}

/** Minimum vertical model clearance over every tread/landing corner, including slab openings. */
export function uStairHeadroom(building: BuildingModel, stairs: StairModel) {
  const lower = building.storeys.find(s => s.ref === stairs.fromStoreyRef)
  const upper = building.storeys.find(s => s.ref === stairs.toStoreyRef)
  if (!lower || !upper) return 0
  const contains = (polygon: Polygon2, point: { x: number; z: number }) => pointInPolygon(point, polygon) || pointOnPolygonBoundary(point, polygon)
  const clearance = uStairSurfaces(stairs, upper.elevationM - lower.elevationM).flatMap(surface => {
    const floor = lower.elevationM + surface.top
    return [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dz => {
      const point = { x: stairs.start.x + surface.x + dx * surface.width / 2, z: stairs.start.z + surface.z + dz * surface.depth / 2 }
      let ceiling = upper.elevationM + atticClearanceAt(building, upper, point)
      for (const slab of building.slabs) {
        if (slab.topElevationM > floor && contains(slab.footprint, point) && !slab.holes?.some(hole => contains(hole, point))) ceiling = Math.min(ceiling, slab.topElevationM - slab.thicknessM)
      }
      return ceiling - floor
    }))
  })
  return clearance.length ? Math.min(...clearance) : 0
}
