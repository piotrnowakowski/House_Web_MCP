import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Shape } from 'three'
import type { PlantModel } from '../domain/types'

const makeLeafShape = (points: Array<[number, number]>) => {
  const shape = new Shape()
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  return shape
}

const tomatoLeafShape = makeLeafShape([
  [0, -0.58], [0.16, -0.38], [0.1, -0.22], [0.28, -0.08], [0.12, 0.02], [0.26, 0.2], [0.08, 0.24], [0, 0.58],
  [-0.08, 0.24], [-0.26, 0.2], [-0.12, 0.02], [-0.28, -0.08], [-0.1, -0.22], [-0.16, -0.38],
])
const potatoLeafShape = makeLeafShape([[0, -0.56], [0.22, -0.34], [0.3, 0], [0.2, 0.34], [0, 0.58], [-0.2, 0.34], [-0.3, 0], [-0.22, -0.34]])
const cucumberLeafShape = makeLeafShape([[0, -0.62], [0.35, -0.25], [0.5, 0.08], [0.34, 0.42], [0.13, 0.34], [0, 0.18], [-0.13, 0.34], [-0.34, 0.42], [-0.5, 0.08], [-0.35, -0.25]])

function PlantMaterial({ color, selected, ghost, doubleSided = false }: { color: string; selected: boolean; ghost: boolean; doubleSided?: boolean }) {
  return <meshStandardMaterial color={selected ? '#b9e84d' : color} roughness={0.82} side={doubleSided ? DoubleSide : undefined} transparent={ghost} opacity={ghost ? 0.42 : 1} depthWrite={!ghost} />
}

function LeafBlade({ shape, position, rotation, scale, color, selected, ghost }: {
  shape: Shape; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]
  color: string; selected: boolean; ghost: boolean
}) {
  return <mesh position={position} rotation={rotation} scale={scale} castShadow={!ghost}>
    <shapeGeometry args={[shape]} />
    <PlantMaterial color={color} selected={selected} ghost={ghost} doubleSided />
  </mesh>
}

export function TomatoRowVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>{[-0.78, -0.26, 0.26, 0.78].map((x, index) => <group key={x} position={[x, 0, index % 2 ? 0.12 : -0.12]} rotation={[0, index * 0.7, 0]}>
    <mesh position={[0, 0.72, 0]} castShadow={!ghost}><cylinderGeometry args={[0.018, 0.025, 1.44, 7]} /><PlantMaterial color="#705039" selected={selected} ghost={ghost} /></mesh>
    <mesh position={[0, 0.48, 0]} castShadow={!ghost}><cylinderGeometry args={[0.025, 0.04, 0.92, 8]} /><PlantMaterial color="#3e703f" selected={selected} ghost={ghost} /></mesh>
    {[[0.12, 0.36, 0.02, -0.88, 0.3], [-0.13, 0.53, -0.02, -1.05, -0.25], [0.14, 0.7, 0.03, -0.92, 0.5], [-0.1, 0.84, -0.01, -1.12, -0.45]].map(([dx, y, dz, tilt, roll], leafIndex) =>
      <LeafBlade key={leafIndex} shape={tomatoLeafShape} position={[dx, y, dz]} rotation={[tilt, leafIndex * 0.8, roll]} scale={[0.48, 0.38, 0.48]} color={leafIndex % 2 ? '#457a42' : '#568a4d'} selected={selected} ghost={ghost} />)}
    {[0.43, 0.6, 0.74].map((y, fruitIndex) => <mesh key={y} position={[fruitIndex % 2 ? 0.09 : -0.08, y, 0.11]} castShadow={!ghost}><sphereGeometry args={[0.06, 10, 8]} /><PlantMaterial color={fruitIndex === 2 ? '#d47a3d' : '#bf4934'} selected={selected} ghost={ghost} /></mesh>)}
  </group>)}</group>
}

export function PotatoRowVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>{[-0.84, -0.42, 0, 0.42, 0.84].map((x, index) => <group key={x} position={[x, 0, index % 2 ? 0.09 : -0.09]} rotation={[0, index * 0.95, 0]}>
    {[-0.08, 0, 0.08].map((dx, stemIndex) => <mesh key={dx} position={[dx, 0.23 + stemIndex * 0.025, 0]} rotation={[0, 0, dx * 2]} castShadow={!ghost}><cylinderGeometry args={[0.018, 0.025, 0.44, 7]} /><PlantMaterial color="#477142" selected={selected} ghost={ghost} /></mesh>)}
    {[[0.02, 0.2, 0.08, -0.95, 0.2], [-0.12, 0.25, -0.03, -1.15, -0.6], [0.13, 0.29, 0, -0.92, 0.8], [-0.03, 0.34, -0.08, -1.08, 1.7], [0.08, 0.39, 0.04, -0.9, 2.3]].map(([dx, y, dz, tilt, yaw], leafIndex) =>
      <LeafBlade key={leafIndex} shape={potatoLeafShape} position={[dx, y, dz]} rotation={[tilt, yaw, leafIndex % 2 ? -0.25 : 0.25]} scale={[0.44, 0.32, 0.44]} color={leafIndex % 2 ? '#4c7b42' : '#608c4e'} selected={selected} ghost={ghost} />)}
    {index % 2 === 0 && <group position={[0.02, 0.46, 0]}>{[0, 1, 2, 3, 4].map((petal) => <mesh key={petal} position={[Math.cos(petal * Math.PI * 0.4) * 0.045, Math.sin(petal * Math.PI * 0.4) * 0.045, 0]} scale={[1.4, 0.7, 1]}><sphereGeometry args={[0.035, 7, 5]} /><PlantMaterial color="#eee8dd" selected={selected} ghost={ghost} /></mesh>)}<mesh position={[0, 0, 0.025]}><sphereGeometry args={[0.022, 7, 5]} /><PlantMaterial color="#d8b34c" selected={selected} ghost={ghost} /></mesh></group>}
  </group>)}</group>
}

export function CucumberTrellisVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    {[-1.02, 1.02].map((x) => <mesh key={x} position={[x, 0.72, 0]} castShadow={!ghost}><cylinderGeometry args={[0.035, 0.045, 1.44, 7]} /><PlantMaterial color="#886444" selected={selected} ghost={ghost} /></mesh>)}
    <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={!ghost}><cylinderGeometry args={[0.035, 0.04, 2.12, 7]} /><PlantMaterial color="#886444" selected={selected} ghost={ghost} /></mesh>
    {[0.35, 0.7, 1.03].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 2.02, 5]} /><PlantMaterial color="#bca981" selected={selected} ghost={ghost} /></mesh>)}
    {[-0.82, -0.41, 0, 0.41, 0.82].map((x, index) => <group key={x} position={[x, 0, 0]}>
      <mesh position={[0, 0.69, 0.015]} rotation={[0, 0, index % 2 ? -0.05 : 0.05]} castShadow={!ghost}><cylinderGeometry args={[0.012, 0.02, 1.3, 6]} /><PlantMaterial color="#467143" selected={selected} ghost={ghost} /></mesh>
      {[[0.1, 0.3, 0.04, -1.02, 0.35], [-0.1, 0.59, 0, -0.95, -0.45], [0.11, 0.9, 0.035, -1.08, 0.55]].map(([dx, y, dz, tilt, roll], leafIndex) =>
        <LeafBlade key={leafIndex} shape={cucumberLeafShape} position={[dx, y, dz]} rotation={[tilt, leafIndex * 0.7, roll]} scale={[0.44, 0.36, 0.44]} color={leafIndex % 2 ? '#4f8148' : '#63934f'} selected={selected} ghost={ghost} />)}
      {index % 2 === 0 && <><mesh position={[0.08, 0.64, 0.13]} rotation={[0, 0, 0.25]} castShadow={!ghost}><capsuleGeometry args={[0.035, 0.19, 5, 8]} /><PlantMaterial color="#74a94f" selected={selected} ghost={ghost} /></mesh><mesh position={[-0.09, 0.78, 0.1]}><sphereGeometry args={[0.045, 7, 5]} /><PlantMaterial color="#e0b93f" selected={selected} ghost={ghost} /></mesh></>}
    </group>)}
  </group>
}

type FruitTreeKind = 'apple' | 'cherry' | 'pear' | 'plum'
const fruitTreeAssets: Record<FruitTreeKind, string> = {
  apple: '/models/garden/fruit-tree-apple.glb',
  cherry: '/models/garden/fruit-tree-cherry.glb',
  pear: '/models/garden/fruit-tree-pear.glb',
  plum: '/models/garden/fruit-tree-plum.glb',
}
const speciesKind = (species: string): FruitTreeKind | null => species === 'Malus domestica' ? 'apple' : species === 'Prunus cerasus' ? 'cherry' : species === 'Pyrus communis' ? 'pear' : species === 'Prunus domestica' ? 'plum' : null
const harvestMonths: Record<FruitTreeKind, number[]> = { apple: [8, 9, 10], cherry: [7, 8], pear: [8, 9, 10], plum: [8, 9] }
const fruitColors: Record<FruitTreeKind, string> = { apple: '#c94835', cherry: '#8e2230', pear: '#b7b84c', plum: '#5d3b82' }
const foliageColors: Record<FruitTreeKind, [string, string, string]> = {
  apple: ['#4f773c', '#638a48', '#759b52'],
  cherry: ['#47723e', '#5b8549', '#709650'],
  pear: ['#4d7540', '#618649', '#779957'],
  plum: ['#496e3f', '#5e8049', '#718f50'],
}
const canopyClusters: Record<FruitTreeKind, Array<[number, number, number, number, number, number]>> = {
  apple: [[0, 0.7, 0, 0.31, 0.16, 0.31], [-0.25, 0.65, 0.02, 0.24, 0.14, 0.23], [0.25, 0.66, 0.04, 0.24, 0.14, 0.23], [-0.08, 0.76, -0.2, 0.24, 0.14, 0.22], [0.08, 0.76, 0.2, 0.24, 0.14, 0.22], [0, 0.82, 0, 0.2, 0.12, 0.2]],
  cherry: [[0, 0.72, 0, 0.3, 0.14, 0.3], [-0.3, 0.68, 0.02, 0.23, 0.12, 0.22], [0.3, 0.68, -0.01, 0.23, 0.12, 0.22], [-0.12, 0.78, -0.23, 0.22, 0.12, 0.21], [0.14, 0.79, 0.22, 0.22, 0.12, 0.21]],
  pear: [[0, 0.62, 0, 0.25, 0.16, 0.25], [-0.17, 0.7, 0.02, 0.21, 0.15, 0.2], [0.17, 0.71, -0.02, 0.21, 0.15, 0.2], [0, 0.8, 0.02, 0.19, 0.14, 0.19], [0, 0.88, -0.01, 0.13, 0.1, 0.13]],
  plum: [[0, 0.69, 0, 0.28, 0.17, 0.27], [-0.23, 0.68, 0.03, 0.21, 0.14, 0.2], [0.23, 0.69, -0.03, 0.21, 0.14, 0.2], [-0.08, 0.8, -0.18, 0.2, 0.13, 0.19], [0.1, 0.81, 0.18, 0.2, 0.13, 0.19]],
}
const fruitPoints = [[-0.28, 0.7, 0.16], [0.12, 0.76, 0.24], [0.3, 0.68, -0.08], [-0.12, 0.61, -0.27], [0.02, 0.82, -0.12], [-0.36, 0.77, -0.12], [0.36, 0.74, 0.13], [0.18, 0.59, 0.3]] as const
const blossomPoints = [[-0.3, 0.74, 0.12], [0.1, 0.82, 0.2], [0.32, 0.72, -0.12], [-0.15, 0.66, -0.28], [0.02, 0.87, -0.08], [-0.37, 0.8, -0.1]] as const

export const hasFruitTreeVisual = (plant: PlantModel) => speciesKind(plant.species) !== null

function Fruit({ kind, position, selected, ghost }: { kind: FruitTreeKind; position: [number, number, number]; selected: boolean; ghost: boolean }) {
  const radius = kind === 'cherry' ? 0.055 : kind === 'plum' ? 0.072 : 0.085
  return <group position={position}>
    <mesh scale={kind === 'pear' ? [0.78, 1.18, 0.78] : [1, 1, 1]} castShadow={!ghost}><sphereGeometry args={[radius, 9, 7]} /><PlantMaterial color={fruitColors[kind]} selected={selected} ghost={ghost} /></mesh>
    {kind === 'cherry' && <mesh position={[0.065, -0.025, 0.02]} castShadow={!ghost}><sphereGeometry args={[radius * 0.9, 8, 6]} /><PlantMaterial color="#a32634" selected={selected} ghost={ghost} /></mesh>}
    <mesh position={[0, radius * 1.2, 0]}><cylinderGeometry args={[0.008, 0.008, radius * 1.5, 5]} /><PlantMaterial color="#5b6b37" selected={selected} ghost={ghost} /></mesh>
  </group>
}

export function FruitTreeVisual({ plant, month, selected, ghost }: { plant: PlantModel; month: number; selected: boolean; ghost: boolean }) {
  const kind = speciesKind(plant.species) ?? 'apple'
  const { scene } = useGLTF(fruitTreeAssets[kind])
  const visibleLeaf = plant.leafMonths.includes(month)
  const bounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const sourceHeight = Math.max(0.1, bounds.max.y - bounds.min.y)
  const scale = plant.matureHeightM / sourceHeight
  const clone = useMemo(() => {
    const next = scene.clone(true)
    next.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const leafMesh = sourceMaterials.some((material) => material.name.toLowerCase().includes('leaves'))
      object.visible = visibleLeaf || !leafMesh
      object.castShadow = !ghost
      object.receiveShadow = true
      const materials = sourceMaterials.map((material) => {
        const copy = material.clone() as MeshStandardMaterial
        if (ghost) { copy.transparent = true; copy.opacity = 0.34; copy.depthWrite = false; copy.color.set('#b9e84d') }
        else if (selected) { copy.emissive.set('#68862f'); copy.emissiveIntensity = 0.28 }
        return copy
      })
      object.material = Array.isArray(object.material) ? materials : materials[0]
    })
    return next
  }, [ghost, scene, selected, visibleLeaf])
  useEffect(() => () => clone.traverse((object) => { if (object instanceof Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()) }), [clone])
  const hasFruit = visibleLeaf && harvestMonths[kind].includes(month)
  const hasBlossom = visibleLeaf && plant.bloomMonths.includes(month)
  return <group>
    <primitive object={clone} scale={scale} position={[0, -bounds.min.y * scale, 0]} />
    {visibleLeaf && canopyClusters[kind].map(([x, y, z, sx, sy, sz], index) => <mesh key={`foliage-${index}`} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} scale={[sx * plant.canopyM, sy * plant.matureHeightM, sz * plant.canopyM]} rotation={[index * 0.19, index * 0.73, index * 0.11]} castShadow={!ghost} receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
      <PlantMaterial color={foliageColors[kind][index % foliageColors[kind].length]} selected={selected} ghost={ghost} />
    </mesh>)}
    {hasFruit && fruitPoints.map(([x, y, z], index) => <Fruit key={index} kind={kind} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} selected={selected} ghost={ghost} />)}
    {hasBlossom && blossomPoints.map(([x, y, z], index) => <mesh key={index} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} castShadow={!ghost}><sphereGeometry args={[0.075, 7, 5]} /><PlantMaterial color={kind === 'cherry' ? '#f3b8c8' : '#f3e5dc'} selected={selected} ghost={ghost} /></mesh>)}
    {(selected || ghost) && <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[plant.canopyM * 0.45, plant.canopyM * 0.5, 32]} /><meshBasicMaterial color="#b9e84d" transparent opacity={ghost ? 0.38 : 0.85} side={DoubleSide} /></mesh>}
  </group>
}

Object.values(fruitTreeAssets).forEach((asset) => useGLTF.preload(asset))
