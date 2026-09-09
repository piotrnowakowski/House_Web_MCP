import { useEffect, useMemo } from 'react'
import { DoubleSide, PlaneGeometry } from 'three'
import { polygonBounds } from '../domain/geometry'
import type { RoofSegmentModel } from '../domain/types'
import { TexturedMaterial } from './materials'

/** Fascia, timber lining and posts for a flat courtyard canopy, sharing the roof's semantic selection. */
export function RoofCanopy({ segment, selected, ghost }: { segment: RoofSegmentModel; selected: boolean; ghost?: boolean }) {
  const canopy = segment.canopy!
  const bounds = polygonBounds(segment.footprint)
  const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2
  const top = segment.baseElevationM + 0.24
  const postHeight = segment.baseElevationM - canopy.postBaseElevationM
  const frame = <meshStandardMaterial color={selected ? '#b9e84d' : canopy.frameColorHex ?? segment.finish.colorHex} roughness={0.65} metalness={0.25} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />
  const lining = useMemo(() => {
    const geometry = new PlaneGeometry(width, depth)
    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * depth)
    return geometry
  }, [width, depth])
  useEffect(() => () => lining.dispose(), [lining])
  return <group userData={{ roofCanopy: true }}>
    <mesh geometry={lining} position={[cx, segment.baseElevationM - 0.025, cz]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <TexturedMaterial asset="hinoki" color={selected ? '#b9e84d' : canopy.soffitColorHex} side={DoubleSide} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />
    </mesh>
    {canopy.fasciaEdgeIndices.map((index) => {
      const a = segment.footprint[index], b = segment.footprint[(index + 1) % segment.footprint.length]
      return <mesh key={index} position={[(a.x + b.x) / 2, top - canopy.fasciaHeightM / 2, (a.z + b.z) / 2]} rotation={[0, -Math.atan2(b.z - a.z, b.x - a.x), 0]} castShadow receiveShadow>
        <boxGeometry args={[Math.hypot(b.x - a.x, b.z - a.z) + 0.12, canopy.fasciaHeightM, 0.12]} />{frame}
      </mesh>
    })}
    {canopy.posts.map((post, index) => <mesh key={index} position={[post.x, canopy.postBaseElevationM + postHeight / 2, post.z]} castShadow receiveShadow>
      <boxGeometry args={[canopy.postWidthM, postHeight, canopy.postWidthM]} />{frame}
    </mesh>)}
  </group>
}
