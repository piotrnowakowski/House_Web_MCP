import { BoxGeometry, BufferAttribute, BufferGeometry, Euler, Matrix4, Plane, Quaternion, Vector3 } from 'three'
import { polygonBounds } from '../domain/geometry'
import type { gableRoofJunction } from '../domain/roofWings'

/** Local building-space planes keep the branch on its side of the ridge and above the host roof surface. */
export function roofJunctionPlanes(junction: ReturnType<typeof gableRoofJunction>): Plane[] {
  if (!junction) return []
  const { host, side } = junction
  const bounds = polygonBounds(host.footprint)
  const alongX = host.ridgeAxis === 'z'
  const center = alongX ? (bounds.minX + bounds.maxX) / 2 : (bounds.minZ + bounds.maxZ) / 2
  const halfSpan = (alongX ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ) / 2
  const slope = (host.ridgeElevationM - host.baseElevationM) / halfSpan
  const direction = side === 'min' ? 1 : -1
  const normal = new Vector3(alongX ? direction * slope : 0, 1, alongX ? 0 : direction * slope)
  // Roof panels are 0.20 m thick, measured perpendicular to the slope.
  const surfaceHeight = host.ridgeElevationM + 0.1 * Math.sqrt(1 + slope * slope)
  return [
    new Plane(normal, -surfaceHeight - direction * slope * center).normalize(),
    new Plane(new Vector3(alongX ? direction : 0, 0, alongX ? 0 : direction), -direction * center),
  ]
}

/** Trim a roof panel or seam in building coordinates, so rotation, shadows and exploded views share the same cut. */
export function clippedRoofBox(size: [number, number, number], position: [number, number, number], rotation: [number, number, number], planes: Plane[]): BufferGeometry {
  const box = new BoxGeometry(...size)
  box.applyMatrix4(new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(1, 1, 1)))
  if (!planes.length) return box
  const vertices = box.getAttribute('position'); const indices = box.index!
  const positions: number[] = []
  for (let i = 0; i < indices.count; i += 3) {
    let polygon = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(vertices, indices.getX(i + offset)))
    for (const plane of planes) {
      const clipped: Vector3[] = []
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j]; const b = polygon[(j + 1) % polygon.length]
        const da = plane.distanceToPoint(a); const db = plane.distanceToPoint(b)
        if (da >= 0) clipped.push(a)
        if ((da >= 0) !== (db >= 0)) clipped.push(a.clone().lerp(b, da / (da - db)))
      }
      polygon = clipped
    }
    for (let j = 1; j + 1 < polygon.length; j++) positions.push(...polygon[0].toArray(), ...polygon[j].toArray(), ...polygon[j + 1].toArray())
  }
  box.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.computeVertexNormals()
  return geometry
}
