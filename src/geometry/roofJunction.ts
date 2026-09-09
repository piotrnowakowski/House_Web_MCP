import { BoxGeometry, BufferAttribute, BufferGeometry, Euler, Matrix4, Plane, Quaternion, Vector3 } from 'three'
import { polygonBounds } from '../domain/geometry'
import { gableRoofJunction, roofWings, type RoofWing } from '../domain/roofWings'
import type { BuildingModel } from '../domain/types'

/** Half-spaces inside a gable, offset perpendicular to its two roof panels. */
export function gableVolumePlanes(wing: RoofWing, surfaceOffsetM = 0): Plane[] {
  const b = polygonBounds(wing.footprint)
  const acrossX = wing.ridgeAxis === 'z'
  const center = acrossX ? (b.minX + b.maxX) / 2 : (b.minZ + b.maxZ) / 2
  const halfSpan = (acrossX ? b.maxX - b.minX : b.maxZ - b.minZ) / 2
  const slope = (wing.ridgeElevationM - wing.baseElevationM) / halfSpan
  const top = wing.ridgeElevationM + surfaceOffsetM * Math.sqrt(1 + slope * slope)
  return [
    new Plane(new Vector3(1, 0, 0), -b.minX + wing.overhangM),
    new Plane(new Vector3(-1, 0, 0), b.maxX + wing.overhangM),
    new Plane(new Vector3(0, 0, 1), -b.minZ + wing.overhangM),
    new Plane(new Vector3(0, 0, -1), b.maxZ + wing.overhangM),
    ...[-1, 1].map((sign) => new Plane(new Vector3(acrossX ? sign * slope : 0, -1, acrossX ? 0 : sign * slope), top - sign * slope * center).normalize()),
  ]
}

/** Remove the host slope inside each joined branch, keeping the external valley intact. */
export function roofJunctionCutouts(building: BuildingModel, host: RoofWing): Plane[][] {
  return roofWings(building).flatMap((branch) => {
    const junction = gableRoofJunction(building, branch)
    if (junction?.host.ref !== host.ref) return []
    return [[...gableVolumePlanes(branch, 0.1), roofJunctionPlanes(junction)[1]]]
  })
}

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
export function clippedRoofBox(size: [number, number, number], position: [number, number, number], rotation: [number, number, number], planes: Plane[], cutouts: Plane[][] = []): BufferGeometry {
  const box = new BoxGeometry(...size)
  box.applyMatrix4(new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(1, 1, 1)))
  if (!planes.length && !cutouts.length) return box
  const vertices = box.getAttribute('position'); const indices = box.index!
  const positions: number[] = []
  for (let i = 0; i < indices.count; i += 3) {
    let polygon = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(vertices, indices.getX(i + offset)))
    for (const plane of planes) polygon = clipPolygon(polygon, plane)
    let fragments = [polygon]
    for (const cutout of cutouts) {
      fragments = fragments.flatMap((fragment) => {
        const outside: Vector3[][] = []
        let inside = fragment
        for (const plane of cutout) {
          const piece = clipPolygon(inside, plane.clone().negate())
          if (piece.length >= 3) outside.push(piece)
          inside = clipPolygon(inside, plane)
          if (inside.length < 3) break
        }
        return outside
      })
    }
    for (const fragment of fragments) {
      for (let j = 1; j + 1 < fragment.length; j++) positions.push(...fragment[0].toArray(), ...fragment[j].toArray(), ...fragment[j + 1].toArray())
    }
  }
  box.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.computeVertexNormals()
  return geometry
}

function clipPolygon(polygon: Vector3[], plane: Plane): Vector3[] {
  const clipped: Vector3[] = []
  for (let j = 0; j < polygon.length; j++) {
    const a = polygon[j]; const b = polygon[(j + 1) % polygon.length]
    const da = plane.distanceToPoint(a); const db = plane.distanceToPoint(b)
    if (da >= 0) clipped.push(a)
    if ((da >= 0) !== (db >= 0)) clipped.push(a.clone().lerp(b, da / (da - db)))
  }
  return clipped
}
