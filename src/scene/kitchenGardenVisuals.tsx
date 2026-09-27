import { useLayoutEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three'
import { AssetBoundary, FallbackPlant, ImportedPlant, potatoFoliageAsset, tomatoFoliageAsset } from './gardenVisuals'

type VisualProps = { selected: boolean; ghost: boolean }
type Instance = { position: [number, number, number]; scale: [number, number, number]; rotation?: number }

const SELECTED = '#b9e84d'
const sphere = new SphereGeometry(1, 10, 7)
const spike = new CylinderGeometry(0.2, 1, 1, 6)
const flowerCone = new CylinderGeometry(0.15, 1, 1, 9)

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

const larch = ['#b88c5a', '#a97f50', '#c29966', '#b08655']

/** Larch raised bed built from stacked boards with corner posts and a capping rail. `length` runs along local x. */
export function LarchBedVisual({ length, width, ...props }: VisualProps & { length: number; width: number }) {
  const boards = 4; const board = 0.14; const t = 0.045; const height = boards * board
  return <group>
    <mesh position={[0, height - 0.04, 0]} receiveShadow><boxGeometry args={[length - 2 * t, 0.02, width - 2 * t]} />{plain('#56402d', props, 1)}</mesh>
    {Array.from({ length: boards }, (_, row) => {
      const y = row * board + board / 2; const color = larch[row % larch.length]
      return <group key={row}>
        {[-1, 1].map(side => <mesh key={`long-${side}`} position={[0, y, side * (width / 2 - t / 2)]} castShadow={!props.ghost} receiveShadow><boxGeometry args={[length, board - 0.008, t]} />{plain(color, props)}</mesh>)}
        {[-1, 1].map(side => <mesh key={`end-${side}`} position={[side * (length / 2 - t / 2), y, 0]} castShadow={!props.ghost} receiveShadow><boxGeometry args={[t, board - 0.008, width - 2 * t]} />{plain(larch[(row + 1) % larch.length], props)}</mesh>)}
      </group>
    })}
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => <mesh key={`post-${sx}-${sz}`} position={[sx * (length / 2 - 0.06), height / 2 + 0.02, sz * (width / 2 - 0.06)]} castShadow={!props.ghost}><boxGeometry args={[0.09, height + 0.04, 0.09]} />{plain('#94703f', props)}</mesh>))}
    {[-1, 1].map(side => <mesh key={`cap-${side}`} position={[0, height + 0.02, side * (width / 2 - 0.04)]} castShadow={!props.ghost}><boxGeometry args={[length + 0.04, 0.035, 0.11]} />{plain('#c9a06b', props)}</mesh>)}
    {[-1, 1].map(side => <mesh key={`cap-end-${side}`} position={[side * (length / 2 - 0.04), height + 0.02, 0]} castShadow={!props.ghost}><boxGeometry args={[0.11, 0.035, width - 0.04]} />{plain('#c9a06b', props)}</mesh>)}
  </group>
}

/** Lettuce clumps and cabbage heads with spreading outer leaves, in staggered rows. */
export function LeafyGreensVisual({ length, ...props }: VisualProps & { length: number }) {
  const { lettuce, hearts, leaves } = useMemo(() => {
    const rand = random(Math.round(length * 97)); const lettuce: Instance[] = []; const hearts: Instance[] = []; const leaves: Instance[] = []
    const columns = Math.floor(length / 0.38)
    for (let column = 0; column < columns; column++) for (const [row, z] of [-0.27, 0, 0.27].entries()) {
      const x = -length / 2 + 0.21 + column * (length - 0.38) / Math.max(1, columns - 1) + (row === 1 ? 0.1 : 0) + (rand() - 0.5) * 0.05
      if (row === 1 && column % 2 === 0) {
        const size = 0.1 + rand() * 0.025; hearts.push({ position: [x, size * 0.8, z], scale: [size, size * 0.85, size] })
        for (let leaf = 0; leaf < 7; leaf++) { const a = leaf * 0.9 + rand() * 0.4; leaves.push({ position: [x + Math.cos(a) * 0.12, 0.07, z + Math.sin(a) * 0.12], scale: [0.13, 0.035, 0.085], rotation: -a }) }
      } else if (row !== 1 || column % 2 === 1) lettuce.push({ position: [x, 0, z], scale: [0.46, 0.3 + rand() * 0.08, 0.46], rotation: rand() * 6.28 })
    }
    return { lettuce, hearts, leaves }
  }, [length])
  return <group>
    <AssetBoundary fallback={<Instances geometry={sphere} items={lettuce.map(item => ({ position: [item.position[0], 0.1, item.position[2]], scale: [0.15, 0.1, 0.15] }))} color="#8fbf4a" {...props} />}>
      {lettuce.map((item, index) => <ImportedPlant key={index} path={potatoFoliageAsset} width={item.scale[0]} height={item.scale[1]} depth={item.scale[2]} position={item.position} rotation={item.rotation} {...props} />)}
    </AssetBoundary>
    <Instances geometry={sphere} items={hearts} color="#c8dc98" {...props} roughness={0.55} />
    <Instances geometry={sphere} items={leaves} color="#86ad8c" {...props} roughness={0.6} />
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

const bloom = ['#e8547a', '#f2f0ea', '#f4c542', '#c23b52', '#f08bb1', '#ffffff']

/** Mixed cottage planting: textured foliage, colourful flower heads and lavender/salvia spikes. */
export function FlowerMixVisual({ length, width = 0.9, seed = 1, ...props }: VisualProps & { length: number; width?: number; seed?: number }) {
  const { foliage, flowers, spikes } = useMemo(() => {
    const rand = random(Math.round(length * 131 + width * 17 + seed * 7919)); const foliage: Instance[] = []; const spikes: Instance[] = []
    const flowers = bloom.map(() => [] as Instance[])
    const clumps = Math.max(1, Math.round(length / 0.45))
    for (let clump = 0; clump < clumps; clump++) for (const z of width > 0.6 ? [-width * 0.22, width * 0.22] : [0]) {
      const x = -length / 2 + (clump + 0.5) * length / clumps + (rand() - 0.5) * 0.12; const cz = z + (rand() - 0.5) * 0.1
      const height = 0.32 + rand() * 0.3
      foliage.push({ position: [x, 0, cz], scale: [0.36 + rand() * 0.12, height, 0.34 + rand() * 0.1], rotation: rand() * 6.28 })
      if (rand() < 0.3) for (let s = 0; s < 6; s++) spikes.push({ position: [x + (rand() - 0.5) * 0.24, height + 0.08, cz + (rand() - 0.5) * 0.2], scale: [0.03, 0.2 + rand() * 0.1, 0.03] })
      else { const colour = Math.floor(rand() * bloom.length); for (let f = 0; f < 7; f++) flowers[colour].push({ position: [x + (rand() - 0.5) * 0.34, height * (0.8 + rand() * 0.35), cz + (rand() - 0.5) * 0.3], scale: [0.045, 0.03, 0.045].map(v => v * (0.8 + rand() * 0.5)) as [number, number, number] }) }
    }
    return { foliage, flowers, spikes }
  }, [length, width, seed])
  return <group>
    <AssetBoundary fallback={<>{foliage.map((item, index) => <FallbackPlant key={index} position={item.position} height={item.scale[1]} {...props} />)}</>}>
      {foliage.map((item, index) => <ImportedPlant key={index} path={index % 3 ? potatoFoliageAsset : tomatoFoliageAsset} width={item.scale[0]} height={item.scale[1]} depth={item.scale[2]} position={item.position} rotation={item.rotation} {...props} />)}
    </AssetBoundary>
    {flowers.map((items, index) => items.length > 0 && <Instances key={index} geometry={sphere} items={items} color={bloom[index]} {...props} roughness={0.55} castShadow={false} />)}
    {spikes.length > 0 && <Instances geometry={spike} items={spikes} color="#8a6fc9" {...props} castShadow={false} />}
  </group>
}

/** Panicle hydrangea: leafy rounded shrub carrying upright cream cone-shaped flower heads. */
export function HydrangeaVisual(props: VisualProps) {
  const heads = useMemo(() => {
    const rand = random(4242); const heads: Instance[] = []
    for (let i = 0; i < 22; i++) { const a = rand() * 6.28; const r = 0.1 + rand() * 0.45; const size = 0.8 + rand() * 0.4; heads.push({ position: [Math.cos(a) * r, 0.95 + rand() * 0.2 - r * 0.35, Math.sin(a) * r], scale: [0.085 * size, 0.2 * size, 0.085 * size], rotation: rand() * 6.28 }) }
    return heads
  }, [])
  return <group>
    <AssetBoundary fallback={<mesh position={[0, 0.5, 0]} scale={[0.6, 0.5, 0.6]} castShadow={!props.ghost}><sphereGeometry args={[1, 12, 9]} />{plain('#4c7a3c', props)}</mesh>}>
      {[0, 1.3, 2.6, 3.9, 5.2].map((rotation, index) => <ImportedPlant key={index} path={index % 2 ? tomatoFoliageAsset : potatoFoliageAsset} width={0.85} height={0.95} depth={0.8} position={[Math.cos(rotation) * 0.25, 0, Math.sin(rotation) * 0.25]} rotation={rotation} {...props} />)}
    </AssetBoundary>
    <Instances geometry={flowerCone} items={heads} color="#efe8d2" {...props} roughness={0.95} />
  </group>
}

/** Horizontal-slatted larch fence panel, 2.4 m long, with posts at both ends. */
export function TimberFenceVisual(props: VisualProps) {
  const length = 2.4; const height = 1.1
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * (length / 2 - 0.045), height / 2 + 0.03, 0]} castShadow={!props.ghost}><boxGeometry args={[0.09, height + 0.06, 0.09]} />{plain('#8f6a3e', props)}</mesh>)}
    {Array.from({ length: 7 }, (_, row) => <mesh key={row} position={[0, 0.12 + row * 0.15, 0]} castShadow={!props.ghost} receiveShadow><boxGeometry args={[length - 0.09, 0.1, 0.028]} />{plain(larch[row % larch.length], props)}</mesh>)}
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
      items.push({ position: [(x0 + x1) / 2, (y(x0) + y(x1)) / 2, 0], scale: [x1 - x0, 0.012, 0.012] })
    }
    return items
  }, [length])
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * length / 2, (top + 0.1) / 2, 0]} castShadow={!props.ghost}><boxGeometry args={[0.09, top + 0.1, 0.09]} />{plain('#6f5234', props)}</mesh>)}
    {cable.map((item, index) => <mesh key={index} position={item.position} rotation={[0, 0, Math.atan2(-sag * 8 * item.position[0] / (length * length), 1)]}><boxGeometry args={item.scale} />{plain('#1b1b1b', props)}</mesh>)}
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

