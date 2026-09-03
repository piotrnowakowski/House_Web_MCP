export interface PlanarUvResult { positions: Float32Array; uvs: Float32Array; indices: Uint32Array }

/**
 * Un-indexes a mesh and assigns planar UVs in metres per face by dominant normal axis:
 * faces facing ±z map (x, y), faces facing ±x map (z, y), faces facing ±y map (x, z).
 * UVs are shifted so each mapped axis starts at zero, so repeat = 1 / tile width.
 */
export const assignPlanarUvs = (positions: Float32Array, indices: Uint32Array): PlanarUvResult => {
  const count = indices.length
  const outPositions = new Float32Array(count * 3); const uvs = new Float32Array(count * 2)
  const min = [Infinity, Infinity, Infinity]
  for (let index = 0; index < count; index += 1) {
    const vertex = indices[index] * 3
    for (let axis = 0; axis < 3; axis += 1) min[axis] = Math.min(min[axis], positions[vertex + axis])
  }
  for (let triangle = 0; triangle < count / 3; triangle += 1) {
    const corners = [0, 1, 2].map((corner) => indices[triangle * 3 + corner] * 3)
    const [a, b, c] = corners.map((vertex) => [positions[vertex], positions[vertex + 1], positions[vertex + 2]])
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const normal = [Math.abs(u[1] * v[2] - u[2] * v[1]), Math.abs(u[2] * v[0] - u[0] * v[2]), Math.abs(u[0] * v[1] - u[1] * v[0])]
    const axes: [number, number] = normal[2] >= normal[0] && normal[2] >= normal[1] ? [0, 1] : normal[1] >= normal[0] ? [0, 2] : [2, 1]
    corners.forEach((vertex, corner) => {
      const out = triangle * 3 + corner
      outPositions[out * 3] = positions[vertex]; outPositions[out * 3 + 1] = positions[vertex + 1]; outPositions[out * 3 + 2] = positions[vertex + 2]
      uvs[out * 2] = positions[vertex + axes[0]] - min[axes[0]]; uvs[out * 2 + 1] = positions[vertex + axes[1]] - min[axes[1]]
    })
  }
  return { positions: outPositions, uvs, indices: Uint32Array.from({ length: count }, (_, index) => index) }
}

/** Yaw a wall-local mesh so its x axis follows `along`, using the collider convention, then move it to the wall centre. */
export const transformWallLocalToBuilding = (positions: Float32Array, along: { x: number; z: number }, centre: { x: number; y: number; z: number }): Float32Array => {
  const yaw = -Math.atan2(along.z, along.x); const c = Math.cos(yaw); const s = Math.sin(yaw)
  const result = new Float32Array(positions.length)
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]; const y = positions[index + 1]; const z = positions[index + 2]
    result[index] = x * c + z * s + centre.x; result[index + 1] = y + centre.y; result[index + 2] = -x * s + z * c + centre.z
  }
  return result
}
