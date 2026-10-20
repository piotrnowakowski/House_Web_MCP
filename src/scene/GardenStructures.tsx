import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three'
import { metreBoxGeometry } from './metreGeometry'
import { TexturedMaterial } from './materials'
import type { TextureId } from '../domain/textures'

type GardenVisualProps = { selected: boolean; ghost: boolean }
type Triple = [number, number, number]

function GardenBox({ size, at = [0, 0, 0], rotation = [0, 0, 0], asset, color = '#ffffff', selected, ghost, roughness = 0.8 }: GardenVisualProps & { size: Triple; at?: Triple; rotation?: Triple; asset?: TextureId; color?: string; roughness?: number }) {
  const [w, h, d] = size
  const geometry = useMemo(() => metreBoxGeometry(w, h, d), [w, h, d])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={at} rotation={rotation} castShadow={!ghost} receiveShadow>
    {asset ? <TexturedMaterial asset={asset} color={selected ? '#bedb84' : color} roughness={roughness} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
      : <meshStandardMaterial color={selected ? '#bedb84' : color} roughness={roughness} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />}
  </mesh>
}

export function DetailedGreenhouse(props: GardenVisualProps) {
  const frame = (key: string, at: Triple, size: Triple, rotation?: Triple) => <GardenBox key={key} at={at} size={size} rotation={rotation} color="#343936" roughness={0.38} {...props} />
  const glass = <meshPhysicalMaterial color={props.selected ? '#c8e8af' : '#e0ede7'} roughness={0.12} metalness={0.12} transparent opacity={props.ghost ? 0.12 : 0.18} depthWrite={false} side={DoubleSide} clearcoat={1} clearcoatRoughness={0.08} />
  const pitch = Math.atan2(0.7, 1.5), slope = Math.hypot(1.5, 0.7)
  return <group>
    <GardenBox size={[4.12, 0.16, 3.12]} at={[0, 0.08, 0]} asset="brick-floor" {...props} />
    <GardenBox size={[0.95, 0.035, 2.95]} at={[0, 0.175, 0]} asset="brick-floor" {...props} />
    {[-1, 1].map(side => <group key={side}>
      {Array.from({ length: 8 }, (_, i) => {
        const x = -1.75 + i * 0.5
        // The central front bays are genuinely open; the sliding door is parked beside them.
        if (side === 1 && (i === 3 || i === 4)) return null
        return <mesh key={i} position={[x, 1.02, side * 1.5]}><planeGeometry args={[0.46, 1.66]} />{glass}</mesh>
      })}
      <mesh position={[0, 2.25, side * 0.75]} rotation={[-Math.PI / 2 + side * pitch, 0, 0]}><planeGeometry args={[4, slope]} />{glass}</mesh>
      {[-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2].map(x => frame(`post-${side}-${x}`, [x, 1.02, side * 1.5], [0.032, 1.72, 0.045]))}
      {[-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map(x => frame(`rafter-${side}-${x}`, [x, 2.25, side * 0.75], [0.033, 0.04, slope], [side * pitch, 0, 0]))}
      {[0.2, 1.02, 1.9].flatMap(y => side === 1 && y === 1.02
        ? [-1, 1].map(s => frame(`door-rail-${s}`, [s * 1.25, y, 1.5], [1.48, 0.035, 0.04]))
        : [frame(`rail-${side}-${y}`, [0, y, side * 1.5], [4.04, 0.035, 0.04])])}
      {frame(`gutter-${side}`, [0, 1.91, side * 1.54], [4.12, 0.055, 0.09])}
      {/* Glazed gable ends with fine vertical mullions. */}
      <mesh position={[side * 2, 1.02, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3, 1.66]} />{glass}</mesh>
      {[-1, -0.5, 0, 0.5, 1].map(z => frame(`end-${side}-${z}`, [side * 2, 1.0, z], [0.032, 1.78, 0.032]))}
      {[-1, 1].map(s => <mesh key={s} position={[side * 2, 1.9, s * 0.75]} rotation={[0, Math.PI / 2, 0]}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-0.75, 0, 0, 0.75, 0, 0, s * 0.75, 0.7, 0]), 3]} /></bufferGeometry>{glass}
      </mesh>)}
    </group>)}
    {frame('ridge', [0, 2.61, 0], [4.14, 0.055, 0.07])}
    {/* Open sliding door, handle, guide track and gutter downpipe. */}
    {frame('track', [0.45, 1.96, 1.55], [2.0, 0.035, 0.055])}
    <mesh position={[1.0, 1.02, 1.56]}><planeGeometry args={[0.94, 1.66]} />{glass}</mesh>
    {[-0.47, 0.47].map(x => frame(`door-${x}`, [1 + x, 1.02, 1.56], [0.032, 1.72, 0.032]))}
    {frame('handle', [0.58, 1.02, 1.60], [0.025, 0.18, 0.035])}
    {frame('downpipe', [2.05, 1.0, -1.48], [0.055, 1.8, 0.055])}
    {/* Potting benches with legs, soil trays and recognisable terracotta pots. */}
    {[-1, 1].map(side => <group key={`bench-${side}`}>
      <GardenBox at={[side * 1.25, 0.82, -0.1]} size={[0.75, 0.055, 2.45]} asset="hinoki" {...props} />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <GardenBox key={`${x}-${z}`} at={[side * 1.25 + x * 0.29, 0.49, -0.1 + z * 1.0]} size={[0.055, 0.65, 0.055]} color="#343936" {...props} />))}
      {[-0.95, -0.45, 0.1, 0.65].map((z, i) => <group key={z} position={[side * 1.25, 0.85, z]}>
        <mesh position-y={0.11} castShadow><cylinderGeometry args={[0.13, 0.085, 0.22, 18]} /><meshStandardMaterial color={i % 2 ? '#ac694d' : '#b78161'} roughness={0.92} /></mesh>
        <mesh position-y={0.22} rotation-x={-Math.PI / 2}><circleGeometry args={[0.118, 18]} /><meshStandardMaterial color="#3e3426" /></mesh>
        {[0, 1, 2, 3, 4].map(leaf => <mesh key={leaf} position={[Math.cos(leaf * 1.25) * 0.06, 0.27 + leaf * 0.025, Math.sin(leaf * 1.25) * 0.06]} rotation={[0.4, leaf * 1.25, 0.5]} scale={[0.07, 0.012, 0.13]}><sphereGeometry args={[1, 9, 6]} /><meshStandardMaterial color={leaf % 2 ? '#526b34' : '#708946'} roughness={0.8} /></mesh>)}
      </group>)}
    </group>)}
  </group>
}

export function RoundFireLounge(props: GardenVisualProps) {
  const bowl = useMemo(() => new LatheGeometry([
    new Vector2(0.24, 0.12), new Vector2(0.42, 0.16), new Vector2(0.72, 0.4),
    new Vector2(0.75, 0.48), new Vector2(0.7, 0.48), new Vector2(0.38, 0.22), new Vector2(0.24, 0.18),
  ], 48), [])
  useEffect(() => () => bowl.dispose(), [bowl])
  return <group>
    <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={4} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <TexturedMaterial asset="river-pebbles" color={props.selected ? '#bedb84' : '#dedbd0'} transparent opacity={props.ghost ? 0.35 : 1} roughness={1} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
      <ringGeometry args={[2.9, 3, 64]} /><meshStandardMaterial color="#626760" roughness={0.9} />
    </mesh>
    <mesh geometry={bowl} castShadow={!props.ghost} receiveShadow>
      <meshStandardMaterial color={props.selected ? '#bedb84' : '#292d2b'} metalness={0.65} roughness={0.65} side={DoubleSide} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} />
    </mesh>
    {[-1, 0, 1].map(i => <group key={i} rotation-y={i * Math.PI / 2}>
      <GardenBox size={[2.05, 0.26, 0.75]} at={[0, 0.28, -2.12]} color="#292d2b" {...props} />
      <GardenBox size={[1.9, 0.16, 0.65]} at={[0, 0.49, -2.1]} color="#c9beaa" {...props} />
      <GardenBox size={[2.05, 0.39, 0.1]} at={[0, 0.7, -2.47]} color="#292d2b" {...props} />
      <GardenBox size={[1.9, 0.28, 0.12]} at={[0, 0.69, -2.38]} color="#c9beaa" {...props} />
    </group>)}
  </group>
}

export function OrnamentalGrass({ height, width, selected, ghost }: GardenVisualProps & { height: number; width: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    for (let leaf = 0; leaf < 32; leaf++) {
      const angle = leaf * 2.39996, reach = width * (0.3 + (leaf % 5) * 0.045)
      const h = height * (0.64 + (leaf % 7) * 0.055)
      const point = (t: number, side: number) => {
        const spread = reach * t * t, half = 0.018 * Math.sin(Math.PI * t)
        return [Math.cos(angle) * spread - Math.sin(angle) * half * side, h * Math.sin(t * 1.8), Math.sin(angle) * spread + Math.cos(angle) * half * side]
      }
      for (let step = 0; step < 7; step++) {
        const a = point(step / 7, -1), b = point(step / 7, 1), c = point((step + 1) / 7, -1), d = point((step + 1) / 7, 1)
        positions.push(...a, ...b, ...c, ...b, ...d, ...c)
      }
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3)); result.computeVertexNormals()
    return result
  }, [height, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow={!ghost} receiveShadow>
    <meshStandardMaterial color={selected ? '#bedb84' : '#7d874d'} side={DoubleSide} roughness={0.9} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
  </mesh>
}

