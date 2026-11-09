import { BufferGeometry, Float32BufferAttribute } from 'three'

/** A joinery body with a top rising from its back (-z) to its front (+z). */
export function slopedCabinetGeometry(width: number, depth: number, frontHeight: number, backHeight: number, base: number) {
  const w = width / 2, d = depth / 2
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -w, base, -d, w, base, -d, w, base, d, -w, base, d,
    -w, backHeight, -d, w, backHeight, -d, w, frontHeight, d, -w, frontHeight, d,
  ], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 7, 6, 4, 6, 5, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2])
  const result = geometry.toNonIndexed()
  geometry.dispose()
  result.computeVertexNormals()
  return result
}
