import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Shape, Vector2 } from 'three'
import { polygonBounds } from '../domain/geometry'
import type { BuildingModel, RoofSegmentModel } from '../domain/types'
import { roofSegmentRidgeElevation } from '../domain/roofs'

/** A continuous folded portal, inset into the facade instead of an overhanging eave. */
export function GableFrame({ building, segment, side, selected, ghost }: {
  building: BuildingModel; segment: RoofSegmentModel; side: 'min' | 'max'; selected: boolean; ghost?: boolean
}) {
  const geometry = useMemo(() => {
    const frame = segment.gableFrame!
    const bounds = polygonBounds(segment.footprint)
    const alongZ = segment.ridgeDirection === 'z'; const across = alongZ ? 'x' : 'z'; const along = alongZ ? 'z' : 'x'
    const min = alongZ ? bounds.minX : bounds.minZ; const max = alongZ ? bounds.maxX : bounds.maxZ
    const value = alongZ ? (side === 'min' ? bounds.minZ : bounds.maxZ) : (side === 'min' ? bounds.minX : bounds.maxX)
    const walls = building.walls.filter((w) => Math.abs(w.start[along] - value) < 0.05 && Math.abs(w.end[along] - value) < 0.05
      && Math.max(w.start[across], w.end[across]) > min && Math.min(w.start[across], w.end[across]) < max)
    const bottom = walls.length ? Math.min(...walls.map((w) => w.baseElevationM)) : segment.baseElevationM
    const halfWall = walls.length ? Math.max(...walls.map((w) => w.thicknessM)) / 2 : 0.1
    const left = min - halfWall; const right = max + halfWall; const center = (min + max) / 2
    const ridge = roofSegmentRidgeElevation(segment) + 0.12; const eaves = segment.baseElevationM + 0.12
    const slope = (ridge - eaves) / (center - left)
    const insetY = frame.widthM * Math.sqrt(1 + slope * slope)
    const innerEave = eaves + frame.widthM * slope - insetY
    const shape = new Shape([
      [left, bottom], [left, eaves], [center, ridge], [right, eaves], [right, bottom],
      [right - frame.widthM, bottom], [right - frame.widthM, innerEave], [center, ridge - insetY],
      [left + frame.widthM, innerEave], [left + frame.widthM, bottom],
    ].map(([x, y]) => new Vector2(x, y)))
    const mesh = new ExtrudeGeometry(shape, { depth: frame.depthM, bevelEnabled: false })
    const positions = mesh.getAttribute('position'); const outward = side === 'min' ? -1 : 1
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i); const y = positions.getY(i); const z = value + outward * (halfWall - positions.getZ(i))
      positions.setXYZ(i, alongZ ? x : z, y, alongZ ? z : x)
    }
    // Swapping axes / reversing depth can reverse winding; recompute consistent outward faces.
    if ((alongZ ? -outward : outward) < 0) {
      for (const attribute of Object.values(mesh.attributes)) {
        for (let i = 0; i < attribute.count; i += 3) {
          for (let c = 0; c < attribute.itemSize; c++) {
            const a = attribute.array[(i + 1) * attribute.itemSize + c]
            attribute.array[(i + 1) * attribute.itemSize + c] = attribute.array[(i + 2) * attribute.itemSize + c]
            attribute.array[(i + 2) * attribute.itemSize + c] = a
          }
        }
      }
    }
    mesh.computeVertexNormals()
    return mesh
  }, [building, segment, side])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow userData={{ facadeFrame: true }}>
    <meshStandardMaterial color={selected ? '#b9e84d' : segment.gableFrame!.colorHex} metalness={0.35} roughness={0.48} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
  </mesh>
}
