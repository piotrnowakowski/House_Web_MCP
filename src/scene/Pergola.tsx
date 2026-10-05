import { pergolaMembers } from '../domain/pergola'
import type { RoofSegmentModel } from '../domain/types'

export function Pergola({ segment, selected, ghost }: { segment: RoofSegmentModel; selected: boolean; ghost?: boolean }) {
  const canopy = segment.canopy!
  return <group userData={{ pergola: true }}>
    {pergolaMembers(segment).map((member, index) => <mesh key={index}
      position={[member.centre.x, member.centre.y, member.centre.z]} rotation={[0, member.yaw, 0]} castShadow receiveShadow>
      <boxGeometry args={[member.size.x, member.size.y, member.size.z]} />
      <meshStandardMaterial color={selected ? '#b9e84d' : member.timber ? canopy.soffitColorHex : canopy.frameColorHex ?? segment.finish.colorHex}
        roughness={member.timber ? 0.85 : 0.65} metalness={member.timber ? 0 : 0.25} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} />
    </mesh>)}
  </group>
}
