import { BufferGeometry, Float32BufferAttribute } from 'three'
import { atticClearanceAt } from '../domain/attic'
import type { BuildingModel, Polygon2, StoreyModel } from '../domain/types'
import { floorGeometry } from './floorGeometry'

/** A ceiling skin respects the holes in its host slab, including a hole crossing a room edge. */
export function ceilingGeometry(building: BuildingModel, storey: StoreyModel, footprint: Polygon2, flatHeight: number, overVoid = false) {
  const host = building.slabs.find(slab => slab.ref === storey.topBoundaryRef)
  const mask = host ?? (!overVoid && storey.kneeWallHeightM !== undefined ? building.slabs.find(s => s.ref === storey.baseSlabRef) : undefined)
  const source = floorGeometry(footprint, mask?.holes, mask?.footprint)
  const flat = source.index ? source.toNonIndexed() : source
  const points = flat.getAttribute('position'), vertices: number[] = [], uv: number[] = []
  type P = [number, number]
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const triangle = (a: P, b: P, c: P, depth: number) => {
    if (depth) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a)
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1)
      triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1)
      return
    }
    for (const [x, z] of [a, b, c]) {
      vertices.push(x, (storey.kneeWallHeightM === undefined ? flatHeight : atticClearanceAt(building, storey, { x, z })) - .015, z)
      uv.push(x, z)
    }
  }
  for (let i = 0; i < points.count; i += 3)
    triangle([points.getX(i), points.getZ(i)], [points.getX(i + 1), points.getZ(i + 1)], [points.getX(i + 2), points.getZ(i + 2)], storey.kneeWallHeightM === undefined ? 0 : 5)
  if (flat !== source) flat.dispose()
  source.dispose()
  const result = new BufferGeometry()
  result.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  result.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  result.computeVertexNormals()
  return result
}
