import { describe, expect, it } from 'vitest'
import { assignPlanarUvs, transformWallLocalToBuilding } from './uv'

/** Indexed box centred on the origin with shared corner vertices, the way Manifold emits a cube. */
const indexedBox = (width: number, height: number, depth: number) => {
  const x = width / 2; const y = height / 2; const z = depth / 2
  const positions = new Float32Array([-x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z, -x, -y, z, x, -y, z, x, y, z, -x, y, z])
  const indices = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5])
  return { positions, indices }
}
const faceNormal = (p: Float32Array, i: number) => {
  const a = [p[i * 9], p[i * 9 + 1], p[i * 9 + 2]]; const b = [p[i * 9 + 3], p[i * 9 + 4], p[i * 9 + 5]]; const c = [p[i * 9 + 6], p[i * 9 + 7], p[i * 9 + 8]]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}
const range = (values: number[]) => [Math.min(...values), Math.max(...values)]

describe('planar UV assignment', () => {
  it('un-indexes the mesh so every triangle owns its vertices', () => {
    const { positions, indices } = indexedBox(2, 3, 0.2)
    const result = assignPlanarUvs(positions, indices)
    expect(result.indices).toHaveLength(36)
    expect(result.positions).toHaveLength(36 * 3)
    expect(result.uvs).toHaveLength(36 * 2)
    expect(Array.from(result.indices)).toEqual(Array.from({ length: 36 }, (_, index) => index))
  })

  it('maps side faces in metres with u along the wall and v up, starting at zero', () => {
    const { positions, indices } = indexedBox(2, 3, 0.2)
    const result = assignPlanarUvs(positions, indices)
    const sideU: number[] = []; const sideV: number[] = []; const topU: number[] = []; const topV: number[] = []; const endU: number[] = []; const endV: number[] = []
    for (let triangle = 0; triangle < 12; triangle += 1) {
      const normal = faceNormal(result.positions, triangle).map(Math.abs)
      for (let corner = 0; corner < 3; corner += 1) {
        const u = result.uvs[(triangle * 3 + corner) * 2]; const v = result.uvs[(triangle * 3 + corner) * 2 + 1]
        if (normal[2] >= normal[0] && normal[2] >= normal[1]) { sideU.push(u); sideV.push(v) }
        else if (normal[1] >= normal[0]) { topU.push(u); topV.push(v) }
        else { endU.push(u); endV.push(v) }
      }
    }
    const close = (values: number[], expected: [number, number]) => { const [low, high] = range(values); expect(low).toBeCloseTo(expected[0], 5); expect(high).toBeCloseTo(expected[1], 5) }
    close(sideU, [0, 2]); close(sideV, [0, 3])
    close(topU, [0, 2]); close(topV, [0, 0.2])
    close(endU, [0, 0.2]); close(endV, [0, 3])
  })

  it('never produces NaN for tilted or degenerate triangles', () => {
    const positions = new Float32Array([0, 0, 0, 1, 1, 1, 2, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1])
    const result = assignPlanarUvs(positions, new Uint32Array([0, 1, 2, 3, 4, 5]))
    expect(Array.from(result.uvs).every(Number.isFinite)).toBe(true)
  })
})

describe('wall placement in building space', () => {
  it('rotates a wall-local point with the same yaw convention as the worker collider and translates it to the wall centre', () => {
    const positions = new Float32Array([1, 0, 0, 0, 2, 0])
    const along = { x: 0, z: 1 }
    const result = transformWallLocalToBuilding(positions, along, { x: 5, y: 0.45, z: -3 })
    expect(Array.from(result).map((value) => Math.round(value * 1e6) / 1e6)).toEqual([5, 0.45, -2, 5, 2.45, -3])
  })
})
