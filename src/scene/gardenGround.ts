import { Path, Shape, ShapeGeometry } from 'three'
import { pointInPolygon } from '../domain/geometry'
import type { GardenFixtureModel, Polygon2, ProjectV2 } from '../domain/types'

export const FIRE_LOUNGE_DEPTH = 0.54
export const FIRE_LOUNGE_HALF_SPAN = 3.2

/** The excavation follows the fixture's persistent position and rotation. */
export function fireLoungeExcavation(fixture: GardenFixtureModel): Polygon2 {
  const a = fixture.rotationDegrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: fixture.position.x + FIRE_LOUNGE_HALF_SPAN * (x * c - z * s),
    z: fixture.position.z + FIRE_LOUNGE_HALF_SPAN * (x * s + z * c),
  }))
}

export const gardenExcavations = (project: ProjectV2) => project.landscape.fixtures
  .filter(fixture => fixture.catalogId === 'sunken-fire-lounge').map(fireLoungeExcavation)

/** Split a polygon by a directed line. Used to cut even across parcel/zone edges. */
function clip(points: Polygon2, a: Polygon2[number], b: Polygon2[number], inside: boolean): Polygon2 {
  const cross = (p: Polygon2[number]) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
  const result: Polygon2 = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length], dp = cross(p), dq = cross(q)
    const keepP = inside ? dp >= -1e-9 : dp <= 1e-9, keepQ = inside ? dq >= -1e-9 : dq <= 1e-9
    if (keepP) result.push(p)
    if (keepP !== keepQ) { const t = dp / (dp - dq); result.push({ x: p.x + t * (q.x - p.x), z: p.z + t * (q.z - p.z) }) }
  }
  return result
}

const path = (points: Polygon2, target: Shape | Path) => {
  points.forEach((p, i) => i ? target.lineTo(p.x, -p.z) : target.moveTo(p.x, -p.z))
  target.closePath()
  return target
}

/** Cut all ground skins, including the planning tint; never hide a sunken floor under a flat mesh. */
export function excavatedGroundGeometry(boundary: Polygon2, holes: Polygon2[]) {
  let pieces: Array<{ outline: Polygon2; holes: Polygon2[] }> = [{ outline: boundary, holes: [] }]
  for (const hole of holes) {
    pieces = pieces.flatMap(piece => {
      if (hole.every(p => pointInPolygon(p, piece.outline))) return [{ ...piece, holes: [...piece.holes, hole] }]
      // Clip the touching case against the convex rectangular excavation.
      let remaining = piece.outline
      const outside: typeof pieces = []
      for (let i = 0; i < hole.length && remaining.length >= 3; i++) {
        const a = hole[i], b = hole[(i + 1) % hole.length]
        const fragment = clip(remaining, a, b, false)
        if (fragment.length >= 3) outside.push({ outline: fragment, holes: piece.holes.filter(h => h.every(p => pointInPolygon(p, fragment))) })
        remaining = clip(remaining, a, b, true)
      }
      return outside
    })
  }
  const shapes = pieces.map(piece => {
    const shape = path(piece.outline, new Shape()) as Shape
    shape.holes = piece.holes.map(hole => path(hole, new Path()) as Path)
    return shape
  })
  return new ShapeGeometry(shapes).rotateX(-Math.PI / 2)
}
