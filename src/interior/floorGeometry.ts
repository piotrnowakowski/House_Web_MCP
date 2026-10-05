import { Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three'
import type { Polygon2, Vec2 } from '../domain/types'

const cross = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
function shapeGeometry(points: Polygon2, holes: Polygon2[]) {
  const shape = new Shape()
  points.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
  shape.closePath()
  for (const hole of holes) {
    const path = new Path()
    hole.forEach((p, i) => (i ? path.lineTo(p.x, -p.z) : path.moveTo(p.x, -p.z)))
    path.closePath()
    shape.holes.push(path)
  }
  const geometry = new ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** Clip triangulated floor-with-voids to a room, including holes that touch its boundary. */
export function floorGeometry(room: Polygon2, holes: Polygon2[] = [], slab?: Polygon2) {
  if (!slab || !holes.length) return shapeGeometry(room, holes)
  const floor = shapeGeometry(slab, holes)
  const mask = shapeGeometry(room, [])
  const triangles = (geometry: ShapeGeometry) => {
    const indices = geometry.index!
    const positions = geometry.attributes.position
    return Array.from({ length: indices.count / 3 }, (_, i) =>
      [0, 1, 2].map((j) => ({
        x: positions.getX(indices.getX(i * 3 + j)),
        z: positions.getZ(indices.getX(i * 3 + j)),
      })),
    )
  }
  const positions: number[] = []
  for (const floorTriangle of triangles(floor))
    for (const roomTriangle of triangles(mask)) {
      let polygon = floorTriangle
      const sign = Math.sign(cross(roomTriangle[0], roomTriangle[1], roomTriangle[2]))
      for (let edge = 0; edge < 3 && polygon.length; edge++) {
        const a = roomTriangle[edge],
          b = roomTriangle[(edge + 1) % 3],
          next: Polygon2 = []
        for (let i = 0; i < polygon.length; i++) {
          const p = polygon[i],
            q = polygon[(i + 1) % polygon.length]
          const dp = sign * cross(a, b, p),
            dq = sign * cross(a, b, q)
          if (dp >= -1e-7) next.push(p)
          if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
            const t = dp / (dp - dq)
            next.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
          }
        }
        polygon = next
      }
      for (let i = 1; i < polygon.length - 1; i++)
        if (Math.abs(cross(polygon[0], polygon[i], polygon[i + 1])) > 1e-8)
          for (const p of [polygon[0], polygon[i], polygon[i + 1]]) positions.push(p.x, 0, p.z)
    }
  floor.dispose()
  mask.dispose()
  const result = new ShapeGeometry()
  result.setIndex(null)
  result.setAttribute('position', new Float32BufferAttribute(positions, 3))
  result.setAttribute(
    'uv',
    new Float32BufferAttribute(
      positions.flatMap((_, i) => (i % 3 === 0 ? [positions[i], -positions[i + 2]] : [])),
      2,
    ),
  )
  result.deleteAttribute('normal')
  result.computeVertexNormals()
  return result
}
