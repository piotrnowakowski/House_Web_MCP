import type { Polygon2 } from '../domain/types'

/** Manifold needs a counterclockwise contour after mapping the plan into XY. */
export function slabContour(footprint: Polygon2): [number, number][] {
  const points = footprint.map(p => [p.x, -p.z] as [number, number])
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]
    return sum + p[0] * next[1] - next[0] * p[1]
  }, 0)
  return area < 0 ? points.reverse() : points
}
