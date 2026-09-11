import { atticClearanceAt } from './attic'
import { pointInPolygon, pointOnPolygonBoundary } from './geometry'
import type { BuildingModel, Polygon2, StairModel } from './types'

export interface StairSurface { x: number; z: number; width: number; depth: number; top: number }

/** Walking surfaces relative to the lower floor and stair start; landings replace a tread. */
export function uStairSurfaces(stairs: StairModel, rise: number): StairSurface[] {
  if (!stairs.uTurn || stairs.steps < 4 || stairs.steps % 2) return []
  const count = stairs.steps / 2
  const tread = stairs.runM / (count - 1)
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn
  const surfaces: StairSurface[] = [{ x: landing / 2, z: (2 * stairs.widthM + gap) / 2, width: landing, depth: 2 * stairs.widthM + gap, top: rise / 2 }]
  for (let i = 0; i < count - 1; i++) {
    const x = landing + (i + .5) * tread
    surfaces.push({ x, z: stairs.widthM / 2, width: tread, depth: stairs.widthM, top: (count - 1 - i) * rise / stairs.steps })
    surfaces.push({ x, z: stairs.widthM * 1.5 + gap, width: tread, depth: stairs.widthM, top: (count + 1 + i) * rise / stairs.steps })
  }
  return surfaces
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
