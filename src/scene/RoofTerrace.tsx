import { DoubleSide } from 'three'
import { offsetPolygon } from '../domain/geometry'
import type { RoofSegmentModel } from '../domain/types'

/** Follow the flat roof perimeter, leaving the house-facing edge open for terrace doors. */
export function RoofTerrace({ segment, selected, ghost }: { segment: RoofSegmentModel; selected: boolean; ghost?: boolean }) {
  const terrace = segment.terrace!
  const outline = offsetPolygon(segment.footprint, 0.08)
  const height = terrace.railingHeightM
  const frame = <meshStandardMaterial color={selected ? '#b9e84d' : terrace.frameColorHex} metalness={0.5} roughness={0.35} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />
  return <group position={[0, segment.baseElevationM + 0.24, 0]} userData={{ roofTerrace: true }}>
    {outline.map((a, index) => {
      if (index === terrace.openEdgeIndex) return null
      const b = outline[(index + 1) % outline.length]
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      const panels = Math.ceil(length / 1.2)
      const panelWidth = length / panels
      return <group key={index} position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]} rotation={[0, -Math.atan2(b.z - a.z, b.x - a.x), 0]}>
        {[0.055, height - 0.025].map((y) => <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[length, 0.05, 0.055]} />{frame}
        </mesh>)}
        {Array.from({ length: panels + 1 }, (_, i) => <mesh key={`post-${i}`} position={[-length / 2 + i * panelWidth, height / 2, 0]} castShadow>
          <boxGeometry args={[0.035, height, 0.055]} />{frame}
        </mesh>)}
        {Array.from({ length: panels }, (_, i) => <mesh key={`glass-${i}`} position={[-length / 2 + (i + 0.5) * panelWidth, height / 2 + 0.025, 0]}>
          <boxGeometry args={[panelWidth - 0.045, height - 0.15, 0.016]} />
          <meshPhysicalMaterial color="#343e42" transparent opacity={ghost ? 0.18 : 0.5} transmission={0.45} roughness={0.08} metalness={0.05} side={DoubleSide} depthWrite={false} />
        </mesh>)}
      </group>
    })}
  </group>
}
