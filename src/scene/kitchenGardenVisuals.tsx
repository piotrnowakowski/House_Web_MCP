import { GardenBox } from './gardenDetails'
export { RealisticGreens as LeafyGreensVisual, RealisticFlowers as FlowerMixVisual, RealisticHydrangea as HydrangeaVisual } from './gardenFoliage'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three'
import { AssetBoundary, FallbackPlant, ImportedPlant, tomatoFoliageAsset } from './gardenVisuals'

type VisualProps = { selected: boolean; ghost: boolean }
type Instance = { position: [number, number, number]; scale: [number, number, number]; rotation?: number }

const SELECTED = '#b9e84d'
const sphere = new SphereGeometry(1, 10, 7)

/** Deterministic pseudo-random sequence so plantings look natural but render identically every time. */
const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

function Instances({ geometry, items, color, selected, ghost, roughness = 0.8, emissive, castShadow = true }: { geometry: BufferGeometry; items: Instance[]; color: string; selected: boolean; ghost: boolean; roughness?: number; emissive?: string; castShadow?: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const matrix = new Matrix4(); const rotation = new Quaternion(); const up = new Vector3(0, 1, 0)
    items.forEach((item, index) => mesh.current!.setMatrixAt(index, matrix.compose(new Vector3(...item.position), rotation.setFromAxisAngle(up, item.rotation ?? 0), new Vector3(...item.scale))))
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={mesh} args={[geometry, undefined, items.length]} castShadow={castShadow && !ghost} receiveShadow>
    <meshStandardMaterial color={selected ? SELECTED : color} roughness={roughness} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 2.4 : 0} transparent={ghost} opacity={ghost ? 0.36 : 1} depthWrite={!ghost} />
  </instancedMesh>
}

const plain = (color: string, { selected, ghost }: VisualProps, roughness = 0.82) =>
  <meshStandardMaterial color={selected ? SELECTED : color} roughness={roughness} transparent={ghost} opacity={ghost ? 0.36 : 1} depthWrite={!ghost} />


/** Larch raised bed built from stacked boards with corner posts and a capping rail. `length` runs along local x. */
export function LarchBedVisual({ length, width, ...props }: VisualProps & { length: number; width: number }) {
  const boards = 4; const board = 0.14; const t = 0.045; const height = boards * board
  return <group>
    <GardenBox at={[0, height - 0.04, 0]} size={[length - 2 * t, 0.02, width - 2 * t]} asset="dirt" color="#80705b" {...props} />
    {Array.from({ length: boards }, (_, row) => {
      const y = row * board + board / 2
      return <group key={row}>
        {[-1, 1].map(side => <GardenBox key={`long-${side}`} at={[0, y, side * (width / 2 - t / 2)]} size={[length, board - 0.006, t]} asset="hinoki" color={['#c5b399', '#beaa90', '#cbb99e', '#bda990'][row]} {...props} />)}
        {[-1, 1].map(side => <GardenBox key={`end-${side}`} at={[side * (length / 2 - t / 2), y, 0]} size={[t, board - 0.006, width - 2 * t]} asset="hinoki" color="#c1ad90" {...props} />)}
      </group>
    })}
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => <group key={`${sx}-${sz}`}>
      <GardenBox at={[sx * (length / 2 - 0.06), height / 2, sz * (width / 2 - 0.06)]} size={[0.09, height, 0.09]} asset="hinoki" color="#a08b6d" {...props} />
      <GardenBox at={[sx * (length / 2 - 0.1), height / 2, sz * (width / 2 + 0.003)]} size={[0.038, height - 0.03, 0.008]} color="#343936" {...props} />
      {[0.08, 0.47].map(y => <mesh key={y} position={[sx * (length / 2 - 0.1), y, sz * (width / 2 + 0.01)]}><sphereGeometry args={[0.008, 6, 4]} /><meshStandardMaterial color="#9b9a8d" metalness={0.8} roughness={0.5} /></mesh>)}
    </group>))}
    {[-1, 1].map(side => <GardenBox key={`cap-${side}`} at={[0, height + 0.02, side * (width / 2 - 0.04)]} size={[length + 0.04, 0.035, 0.11]} asset="hinoki" color="#cfbfa6" {...props} />)}
    {[-1, 1].map(side => <GardenBox key={`cap-end-${side}`} at={[side * (length / 2 - 0.04), height + 0.02, 0]} size={[0.11, 0.035, width - 0.04]} asset="hinoki" color="#cfbfa6" {...props} />)}
    {[-0.28, 0.28].map(z => <mesh key={z} position={[0, height - 0.015, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.007, 0.007, length - 0.18, 6]} />{plain('#363d32', props)}</mesh>)}
  </group>
}

/** Staked tomatoes filling a long bed: dense foliage, timber stakes and ripening trusses. */
export function TomatoBedVisual({ length, ...props }: VisualProps & { length: number }) {
  const { plants, red, orange } = useMemo(() => {
    const rand = random(Math.round(length * 53)); const plants: Instance[] = []; const red: Instance[] = []; const orange: Instance[] = []
    const count = Math.round(length / 0.5)
    for (let i = 0; i < count; i++) {
      const x = -length / 2 + (i + 0.5) * length / count; const z = i % 2 ? 0.2 : -0.2; const height = 1.05 + rand() * 0.25
      plants.push({ position: [x, 0, z], scale: [0.62, height, 0.58], rotation: rand() * 6.28 })
      for (let f = 0; f < 6; f++) (f % 3 ? red : orange).push({ position: [x + (rand() - 0.5) * 0.3, 0.35 + rand() * 0.55, z + (rand() - 0.5) * 0.3], scale: [0.04, 0.038, 0.04] })
    }
    return { plants, red, orange }
  }, [length])
  return <group>
    <AssetBoundary fallback={<>{plants.map((item, index) => <FallbackPlant key={index} position={item.position} height={item.scale[1]} {...props} />)}</>}>
      {plants.map((item, index) => <ImportedPlant key={index} path={tomatoFoliageAsset} width={item.scale[0]} height={item.scale[1]} depth={item.scale[2]} position={item.position} rotation={item.rotation} {...props} />)}
    </AssetBoundary>
    {plants.map((item, index) => <mesh key={index} position={[item.position[0] + 0.05, 0.7, item.position[2]]} castShadow={!props.ghost}><cylinderGeometry args={[0.012, 0.016, 1.4, 6]} />{plain('#7a5b3a', props)}</mesh>)}
    <Instances geometry={sphere} items={red} color="#b8352a" {...props} roughness={0.45} castShadow={false} />
    <Instances geometry={sphere} items={orange} color="#de7f3f" {...props} roughness={0.45} castShadow={false} />
  </group>
}

/** Horizontal-slatted larch fence panel, 2.4 m long, with posts at both ends. */
export function TimberFenceVisual(props: VisualProps) {
  const length = 2.4; const height = 1.1
  return <group>
    {[-1, 1].map(side => <GardenBox key={side} at={[side * (length / 2 - 0.045), height / 2 + 0.03, 0]} size={[0.09, height + 0.06, 0.09]} asset="hinoki" color="#a38f73" {...props} />)}
    {Array.from({ length: 7 }, (_, row) => <GardenBox key={row} at={[0, 0.12 + row * 0.15, 0]} size={[length - 0.09, 0.1, 0.028]} asset="hinoki" color={row % 2 ? '#bfaf96' : '#c9baa0'} {...props} />)}
  </group>
}

/** Festoon lights: warm bulbs on a sagging cable between two timber posts; `length` runs along local x. */
export function FestoonLightsVisual({ length, ...props }: VisualProps & { length: number }) {
  const top = 2.75; const sag = 0.45
  const bulbs = useMemo(() => {
    const count = Math.round(length / 0.45); const items: Instance[] = []
    for (let i = 0; i <= count; i++) { const x = -length / 2 + i * length / count; const u = (2 * x) / length; items.push({ position: [x, top - sag * (1 - u * u) - 0.07, 0], scale: [0.045, 0.06, 0.045] }) }
    return items
  }, [length])
  const cable = useMemo(() => {
    const segments = 24; const items: Instance[] = []
    for (let i = 0; i < segments; i++) {
      const x0 = -length / 2 + i * length / segments; const x1 = x0 + length / segments; const y = (x: number) => top - sag * (1 - (2 * x / length) ** 2)
      items.push({ position: [(x0 + x1) / 2, (y(x0) + y(x1)) / 2, 0], scale: [Math.hypot(x1 - x0, y(x1) - y(x0)), 0.009, 0.009], rotation: Math.atan2(y(x1) - y(x0), x1 - x0) })
    }
    return items
  }, [length])
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * length / 2, (top + 0.1) / 2, 0]} castShadow={!props.ghost}><boxGeometry args={[0.09, top + 0.1, 0.09]} />{plain('#6f5234', props)}</mesh>)}
    {cable.map((item, index) => <mesh key={index} position={item.position} rotation={[0, 0, item.rotation ?? 0]}><boxGeometry args={item.scale} />{plain('#1b1b1b', props)}</mesh>)}
    <Instances geometry={sphere} items={bulbs} color="#fff1c2" emissive="#ffc766" {...props} roughness={0.3} castShadow={false} />
  </group>
}

/** 300 l rain-water butt on a low stand. */
export function WaterButtVisual(props: VisualProps) {
  return <group>
    <mesh position={[0, 0.1, 0]} castShadow={!props.ghost}><boxGeometry args={[0.62, 0.2, 0.62]} />{plain('#7e6042', props)}</mesh>
    <mesh position={[0, 0.62, 0]} castShadow={!props.ghost}><cylinderGeometry args={[0.3, 0.27, 0.86, 20]} />{plain('#34443a', props, 0.6)}</mesh>
    <mesh position={[0, 1.06, 0]} castShadow={!props.ghost}><cylinderGeometry args={[0.31, 0.31, 0.03, 20]} />{plain('#27332c', props, 0.6)}</mesh>
    {[0.3, 0.9].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.295, 0.012, 6, 24]} />{plain('#1f2a24', props)}</mesh>)}
  </group>
}

