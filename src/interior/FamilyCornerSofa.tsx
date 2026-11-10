import { RoundedBox } from '@react-three/drei'
import type { InteriorItem } from '../domain/types'

/** Metre-based concept: back at +z, return at -x, 20 cm backs and a 44 cm seat. */
export function FamilyCornerSofa({ item }: { item: InteriorItem }) {
  const w = item.widthM, d = item.depthM, h = item.heightM, m = item.sofaModuleDepthM!
  const left = -w / 2, back = d / 2, front = -d / 2, arm = .14, seam = .012
  const box = (name: string, size: [number, number, number], position: [number, number, number], color = item.color) => (
    <RoundedBox key={name} name={name} args={size} position={position} radius={.025} smoothness={3} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={.86} />
    </RoundedBox>
  )
  const seatDepth = m - .2, straightWidth = w - m - arm, places = Math.max(2, Math.floor(straightWidth / .65))
  return <group name="family-corner-sofa">
    {box('long-base', [w, .25, m], [0, .225, back - m / 2])}
    {box('return-base', [m, .25, d - m], [left + m / 2, .225, front + (d - m) / 2])}
    {box('long-back', [w, h - .35, .2], [0, (.35 + h) / 2, back - .1])}
    {box('return-back', [.2, h - .35, d - .2], [left + .1, (.35 + h) / 2, -.1])}
    {box('right-arm', [arm, .25, m - .2], [w / 2 - arm / 2, .475, back - .2 - seatDepth / 2])}
    {box('return-end-arm', [m - .2, .25, arm], [left + .2 + seatDepth / 2, .475, front + arm / 2])}
    {box('corner-seat', [seatDepth - seam, .09, seatDepth - seam], [left + .2 + seatDepth / 2, .395, back - .2 - seatDepth / 2])}
    {Array.from({ length: places }, (_, n) => box(`long-seat-${n + 1}`, [straightWidth / places - seam, .09, seatDepth - seam], [left + m + (n + .5) * straightWidth / places, .395, back - .2 - seatDepth / 2]))}
    {box('return-seat', [seatDepth - seam, .09, d - m - arm - seam], [left + .2 + seatDepth / 2, .395, front + arm + (d - m - arm) / 2])}
  </group>
}
