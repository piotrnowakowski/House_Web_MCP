import { BoxGeometry } from 'three'

/** A box whose UVs are in metres per face (three.js face order: +x, -x, +y, -y, +z, -z). */
export const metreBoxGeometry = (width: number, height: number, depth: number) => {
  const geometry = new BoxGeometry(width, height, depth); const uv = geometry.attributes.uv
  const spans: Array<[number, number]> = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]]
  for (let index = 0; index < uv.count; index += 1) { const [u, v] = spans[Math.floor(index / 4)]; uv.setXY(index, uv.getX(index) * u, uv.getY(index) * v) }
  return geometry
}
