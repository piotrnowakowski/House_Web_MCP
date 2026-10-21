import { useEffect, useMemo } from 'react'
import type { Vec2 } from '../domain/types'
import { fenceGeometry } from './fenceGeometry'
import { groundContactY } from './groundContact'

export function SiteFence({ start, end, heightM, colorHex, material, semanticRef }: {
  start: Vec2; end: Vec2; heightM: number; colorHex: string; material: 'concrete' | 'panel' | 'gate'; semanticRef: string
}) {
  const length = Math.hypot(end.x - start.x, end.z - start.z)
  const geometry = useMemo(() => fenceGeometry(length, heightM, material), [length, heightM, material])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[(start.x + end.x) / 2, groundContactY(), (start.z + end.z) / 2]}
    rotation={[0, -Math.atan2(end.z - start.z, end.x - start.x), 0]} castShadow receiveShadow userData={{ semanticRef }}>
    <meshStandardMaterial color={colorHex} roughness={material === 'concrete' ? 0.96 : 0.65} metalness={material === 'concrete' ? 0 : 0.25} />
  </mesh>
}
