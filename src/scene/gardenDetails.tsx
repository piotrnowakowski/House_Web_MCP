import { GardenInstances } from './gardenFoliage'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, CircleGeometry, CylinderGeometry, DoubleSide, LatheGeometry, RingGeometry, Vector2 } from 'three'
import { TexturedMaterial } from './materials'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GardenPavingMaterial, type PavingFinish } from './gardenPaving'
import type { TextureId } from '../domain/textures'
import { FIRE_LOUNGE_DEPTH } from './gardenGround'

export type GardenVisualProps = { selected: boolean; ghost: boolean }
type Triple = [number, number, number]

/** Physical metre UVs: timber grain remains the same size on a rail and a long board. */
export function GardenBox({ size, at = [0, 0, 0], rotation = [0, 0, 0], asset, paving, color = '#ffffff', selected, ghost, roughness = 0.8 }: GardenVisualProps & { size: Triple; at?: Triple; rotation?: Triple; asset?: TextureId; paving?: PavingFinish; color?: string; roughness?: number }) {
  const [w, h, d] = size
  const geometry = useMemo(() => {
    const g = paving ? new RoundedBoxGeometry(w, h, d, 2, 0.004) : new BoxGeometry(w, h, d), uv = g.attributes.uv
    if (paving) {
      const p = g.attributes.position, n = g.attributes.normal
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i))
        if (ny >= nx && ny >= nz) uv.setXY(i, p.getX(i) + w / 2, p.getZ(i) + d / 2)
        else if (nx >= nz) uv.setXY(i, p.getZ(i) + d / 2, p.getY(i) + h / 2)
        else uv.setXY(i, p.getX(i) + w / 2, p.getY(i) + h / 2)
      }
      return g
    }
    const dimensions = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
    for (let i = 0; i < uv.count; i++) { const [u, v] = dimensions[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v) }
    return g
  }, [w, h, d, paving])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={at} rotation={rotation} castShadow={!ghost} receiveShadow>
    {paving ? <GardenPavingMaterial finish={paving} color={color} selected={selected} ghost={ghost} />
      : asset ? <TexturedMaterial asset={asset} color={selected ? '#bedb84' : color} normalScale={0.35} roughness={roughness} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
      : <meshStandardMaterial color={selected ? '#bedb84' : color} roughness={roughness} metalness={color === '#343936' ? 0.55 : 0} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />}
  </mesh>
}

/** Separate coping/step units have real joints, not a pavement photo folded over an edge. */
function PavingCourse({ size, at, ...props }: GardenVisualProps & { size: Triple; at: Triple }) {
  const axis = size[0] >= size[2] ? 0 : 2, count = Math.ceil(size[axis] / 0.6), module = size[axis] / count
  return <group>{Array.from({ length: count }, (_, i) => {
    const unit: Triple = [...size], position: Triple = [...at]
    unit[axis] = module - 0.004; position[axis] += -size[axis] / 2 + (i + 0.5) * module
    return <GardenBox key={i} size={unit} at={position} paving="stone" color={i % 3 === 0 ? '#f1f2ee' : '#f7f8f4'} {...props} />
  })}</group>
}

export function DetailedGreenhouse(props: GardenVisualProps) {
  const frame = (key: string, at: Triple, size: Triple, rotation?: Triple) => <GardenBox key={key} at={at} size={size} rotation={rotation} color="#343936" roughness={0.38} {...props} />
  const glass = <meshPhysicalMaterial color={props.selected ? '#c8e8af' : '#e0ede7'} roughness={0.12} metalness={0.12} transparent opacity={props.ghost ? 0.12 : 0.18} depthWrite={false} side={DoubleSide} clearcoat={1} clearcoatRoughness={0.08} />
  const pitch = Math.atan2(0.7, 1.5), slope = Math.hypot(1.5, 0.7)
  return <group>
    <GardenBox size={[4.12, 0.16, 3.12]} at={[0, 0.08, 0]} asset="brick-floor" {...props} />
    <GardenBox size={[0.95, 0.035, 2.95]} at={[0, 0.175, 0]} paving="pavers" {...props} />
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

export function DetailedGardenDining(props: GardenVisualProps) {
  return <group>
    {Array.from({ length: 7 }, (_, i) => <GardenBox key={i} at={[0, 0.75, -0.45 + i * 0.15]} size={[2.18, 0.04, 0.13]} asset="hinoki" color="#c8b294" {...props} />)}
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => <GardenBox key={`${sx}-${sz}`} at={[sx * 0.88, 0.36, sz * 0.37]} size={[0.055, 0.72, 0.055]} color="#343936" {...props} />))}
    {[-1, 1].flatMap(side => [-0.76, 0, 0.76].map(x => <group key={`${side}-${x}`} position={[x, 0, side * 0.97]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
      {[-1, 1].flatMap(sx => [-1, 1].map(sz => <GardenBox key={`${sx}-${sz}`} at={[sx * 0.22, 0.22, sz * 0.22]} size={[0.03, 0.44, 0.03]} color="#343936" {...props} />))}
      {Array.from({ length: 4 }, (_, i) => <GardenBox key={i} at={[0, 0.44, -0.2 + i * 0.13]} size={[0.51, 0.026, 0.105]} asset="hinoki" color="#c8b294" {...props} />)}
      {[-1, 1].map(s => <GardenBox key={s} at={[s * 0.23, 0.63, 0.26]} size={[0.028, 0.48, 0.028]} rotation={[0.12, 0, 0]} color="#343936" {...props} />)}
      {[0.58, 0.68, 0.78].map(y => <GardenBox key={y} at={[0, y, 0.28 + (y - 0.58) * 0.12]} size={[0.51, 0.07, 0.025]} asset="hinoki" color="#c8b294" {...props} />)}
    </group>))}
  </group>
}

const logBark = new CylinderGeometry(0.95, 1, 1, 7)
const logEnd = new CircleGeometry(1, 7)
const logRing = new RingGeometry(0.44, 0.49, 12)

function WoodScreen({ at, rotation = 0, length, ...props }: GardenVisualProps & { at: Triple; rotation?: number; length: number }) {
  const logs = useMemo(() => Array.from({ length: Math.floor(length / 0.19) * 7 }, (_, i) => {
    const columns = Math.floor(length / 0.19), row = Math.floor(i / columns)
    return { x: -length / 2 + 0.16 + (i % columns) * 0.19 + (row % 2) * 0.035, y: 0.19 + row * 0.185, radius: 0.07 + (Math.sin(i * 5.7) + 1) * 0.009 }
  }), [length])
  return <group position={at} rotation={[0, rotation, 0]}>
    {/* Solid noncombustible inner face remains a windbreak even with the firewood removed. */}
    <GardenBox at={[0, 0.87, -0.25]} size={[length, 1.74, 0.1]} paving="stone" color="#c6c8c3" {...props} />
    {[-length / 2, 0, length / 2].map(x => <GardenBox key={x} at={[x, 0.88, 0]} size={[0.055, 1.76, 0.64]} color="#343936" {...props} />)}
    {[0.1, 1.65].map(y => <GardenBox key={y} at={[0, y, 0.04]} size={[length + 0.12, 0.045, 0.7]} color="#343936" {...props} />)}
    <GardenBox at={[0, 1.73, 0.04]} size={[length + 0.2, 0.045, 0.85]} rotation={[0.06, 0, 0]} color="#343936" {...props} />
    <GardenInstances geometry={logBark} items={logs.map((log, i) => ({ p: [log.x, log.y, 0.06], s: [log.radius, 0.48, log.radius], r: [Math.PI / 2, (i % 3) * 0.13, 0] }))} color="#69513a" {...props} />
    <GardenInstances geometry={logEnd} items={logs.map(log => ({ p: [log.x, log.y, 0.306], s: [log.radius * 0.83, log.radius * 0.83, 1] }))} color="#c2a47b" {...props} />
    <GardenInstances geometry={logRing} items={logs.map(log => ({ p: [log.x, log.y, 0.308], s: [log.radius, log.radius, 1] }))} color="#8b7152" {...props} />
  </group>
}

export function SunkenFireLounge(props: GardenVisualProps) {
  const floor = -FIRE_LOUNGE_DEPTH
  const bowl = useMemo(() => new LatheGeometry([new Vector2(0.14, 0), new Vector2(0.32, 0.05), new Vector2(0.49, 0.18), new Vector2(0.58, 0.34), new Vector2(0.55, 0.35), new Vector2(0.46, 0.2), new Vector2(0.27, 0.085), new Vector2(0.14, 0.04)], 48), [])
  useEffect(() => () => bowl.dispose(), [bowl])
  return <group>
    <GardenBox size={[6.4, 0.14, 6.4]} at={[0, floor - 0.07, 0]} paving="pavers" {...props} />
    {/* Retaining walls and separate coping. Entrance is a 1.5 m opening in the north wall. */}
    {[-1, 1].map(side => <group key={side}>
      <GardenBox size={[0.22, 0.68, 6.4]} at={[side * 3.09, -0.2, 0]} paving="stone" color="#d8dad5" {...props} />
      <PavingCourse size={[0.36, 0.07, 6.55]} at={[side * 3.09, 0.145, 0]} {...props} />
      <GardenBox size={[2.36, 0.68, 0.22]} at={[side * 1.98, -0.2, -3.09]} paving="stone" color="#d8dad5" {...props} />
      <PavingCourse size={[2.11, 0.07, 0.36]} at={[side * 1.855, 0.145, -3.09]} {...props} />
    </group>)}
    <GardenBox size={[6.4, 0.68, 0.22]} at={[0, -0.2, 3.09]} paving="stone" color="#d8dad5" {...props} />
    <PavingCourse size={[5.82, 0.07, 0.36]} at={[0, 0.145, 3.09]} {...props} />
    {[0, 1, 2].map(step => <PavingCourse key={step} size={[1.5, 0.18 * (3 - step), 0.38]} at={[0, floor + 0.09 * (3 - step), -3.01 + step * 0.38]} {...props} />)}
    {/* Two deep built-in side benches and a rear bench; seat 43 cm over the sunken floor. */}
    {[-1, 1].map(side => <group key={`seat-${side}`} position={[side * 2.46, floor, 0]}>
      <GardenBox size={[0.65, 0.35, 4.5]} at={[0, 0.175, 0]} paving="stone" color="#d8dad5" {...props} />
      {[-0.25, -0.08, 0.09, 0.26].map(x => <GardenBox key={x} size={[0.145, 0.07, 4.65]} at={[x, 0.4, 0]} asset="hinoki" color="#c3ac86" {...props} />)}
      {[0.65, 0.82].map(y => <GardenBox key={y} size={[0.08, 0.14, 4.65]} at={[side * 0.3, y, 0]} asset="hinoki" color="#b9a17b" {...props} />)}
    </group>)}
    <group position={[0, floor, 2.45]}>
      <GardenBox size={[3.8, 0.35, 0.65]} at={[0, 0.175, 0]} paving="stone" color="#d8dad5" {...props} />
      {[-0.25, -0.08, 0.09, 0.26].map(z => <GardenBox key={z} size={[3.9, 0.07, 0.145]} at={[0, 0.4, z]} asset="hinoki" color="#c3ac86" {...props} />)}
    </group>
    <group position={[0, floor, 0]}>
      <mesh position-y={0.025} receiveShadow><cylinderGeometry args={[1.0, 1, 0.05, 64]} /><meshStandardMaterial color="#b4a998" roughness={0.96} /></mesh>
      <mesh geometry={bowl} position-y={0.1} castShadow receiveShadow><meshStandardMaterial color={props.selected ? '#b9db8a' : '#7f4830'} roughness={0.88} metalness={0.45} side={DoubleSide} /></mesh>
      <mesh position-y={0.15} rotation-x={-Math.PI / 2}><circleGeometry args={[0.28, 32]} /><meshStandardMaterial color="#25231e" roughness={1} /></mesh>
      {[-0.13, 0.12].map((z, i) => <mesh key={z} position={[0, 0.24, z]} rotation={[Math.PI / 2, i * 0.45, Math.PI / 2]} castShadow><cylinderGeometry args={[0.065, 0.07, 0.54, 9]} /><meshStandardMaterial color="#3f3429" roughness={1} /></mesh>)}
      {/* Drain grate is visible; drainage design is explicitly a construction follow-up. */}
      <GardenBox at={[1.55, 0.015, 1.8]} size={[0.3, 0.025, 0.3]} color="#343936" {...props} />
      {[-0.1, -0.05, 0, 0.05, 0.1].map(x => <GardenBox key={x} at={[1.55 + x, 0.03, 1.8]} size={[0.015, 0.01, 0.27]} color="#8b8e85" {...props} />)}
    </group>
    {/* Logs face outwards, behind the noncombustible wind screen; over 3 m from the bowl rim. */}
    <WoodScreen at={[4.05, 0, 0]} rotation={Math.PI / 2} length={5.6} {...props} />
    <WoodScreen at={[2.5, 0, -4.05]} rotation={Math.PI} length={2.5} {...props} />
  </group>
}
