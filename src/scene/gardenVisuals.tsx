import { useGLTF } from '@react-three/drei'
import { Component, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react'
import { Box3, DoubleSide, Mesh, MeshStandardMaterial } from 'three'
import type { PlantModel } from '../domain/types'

const gardenAsset = (filename: string) => `${import.meta.env.BASE_URL}models/garden/${filename}`
const treeAsset = gardenAsset('orchard-tree-realistic.glb')
const tomatoFoliageAsset = gardenAsset('crop-tomato-foliage.glb')
const potatoFoliageAsset = gardenAsset('crop-potato-foliage.glb')

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Optional garden model could not be loaded; using procedural fallback.', error, info.componentStack)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function AccentMaterial({ color, selected, ghost, doubleSided = false }: { color: string; selected: boolean; ghost: boolean; doubleSided?: boolean }) {
  return <meshStandardMaterial
    color={color}
    roughness={0.78}
    emissive={selected ? '#667b2c' : '#000000'}
    emissiveIntensity={selected ? 0.12 : 0}
    side={doubleSided ? DoubleSide : undefined}
    transparent={ghost}
    opacity={ghost ? 0.36 : 1}
    depthWrite={!ghost}
  />
}

function usePreparedScene(path: string, selected: boolean, ghost: boolean, leavesVisible = true) {
  const { scene } = useGLTF(path)
  const bounds = useMemo(() => new Box3().setFromObject(scene), [scene])
  const prepared = useMemo(() => {
    const next = scene.clone(true)
    next.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = !ghost
      object.receiveShadow = true
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const materials = sourceMaterials.map((material) => {
        const copy = material.clone() as MeshStandardMaterial
        const leafMaterial = copy.name.toLowerCase().includes('leav')
        if (leafMaterial && !leavesVisible) {
          copy.transparent = true
          copy.opacity = 0
          copy.depthWrite = false
        } else if (ghost) {
          copy.transparent = true
          copy.opacity = 0.3
          copy.depthWrite = false
        } else if (leafMaterial || copy.transparent) {
          copy.transparent = false
          copy.opacity = 1
          copy.alphaTest = 0.22
          copy.depthWrite = true
          copy.side = DoubleSide
        }
        if (selected && copy.emissive) {
          copy.emissive.set('#748a39')
          copy.emissiveIntensity = 0.1
        }
        return copy
      })
      object.material = Array.isArray(object.material) ? materials : materials[0]
    })
    return next
  }, [ghost, leavesVisible, scene, selected])
  useEffect(() => () => prepared.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material.dispose())
  }), [prepared])
  return { prepared, bounds }
}

function ImportedPlant({ path, width, height, depth, position: groupPosition = [0, 0, 0], rotation = 0, selected, ghost }: { path: string; width: number; height: number; depth: number; position?: [number, number, number]; rotation?: number; selected: boolean; ghost: boolean }) {
  const { prepared, bounds } = usePreparedScene(path, selected, ghost)
  const sourceWidth = Math.max(0.01, bounds.max.x - bounds.min.x)
  const sourceHeight = Math.max(0.01, bounds.max.y - bounds.min.y)
  const sourceDepth = Math.max(0.01, bounds.max.z - bounds.min.z)
  const scale: [number, number, number] = [width / sourceWidth, height / sourceHeight, depth / sourceDepth]
  const position: [number, number, number] = [
    -((bounds.min.x + bounds.max.x) / 2) * scale[0],
    -bounds.min.y * scale[1],
    -((bounds.min.z + bounds.max.z) / 2) * scale[2],
  ]
  return <group position={groupPosition} rotation={[0, rotation, 0]}><primitive object={prepared} scale={scale} position={position} /></group>
}

function FallbackPlant({ position, height, selected, ghost }: { position: [number, number, number]; height: number; selected: boolean; ghost: boolean }) {
  return <group position={position}>
    <mesh position={[0, height * 0.48, 0]} castShadow={!ghost}><cylinderGeometry args={[0.012, 0.018, height * 0.96, 7]} /><AccentMaterial color="#47713b" selected={selected} ghost={ghost} /></mesh>
    {[-0.22, 0.05, 0.25].map((offset, index) => <mesh key={offset} position={[offset, height * (0.38 + index * 0.18), index % 2 ? -0.04 : 0.04]} scale={[1.35, 0.55, 0.8]} rotation={[0, 0, index % 2 ? 0.32 : -0.32]} castShadow={!ghost}>
      <sphereGeometry args={[0.16, 10, 7]} /><AccentMaterial color={index === 1 ? '#4f7d3f' : '#5e8a48'} selected={selected} ghost={ghost} />
    </mesh>)}
  </group>
}

const tomatoPositions = [-0.92, -0.46, 0, 0.46, 0.92]

export function TomatoRowVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <AssetBoundary fallback={<>{tomatoPositions.map((x, index) => <FallbackPlant key={x} position={[x, 0, index % 2 ? 0.08 : -0.06]} height={0.86} selected={selected} ghost={ghost} />)}</>}>
      {tomatoPositions.map((x, index) => <ImportedPlant key={`foliage-${x}`} path={tomatoFoliageAsset} width={0.62} height={0.86} depth={0.58} position={[x, 0, index % 2 ? 0.08 : -0.06]} rotation={index * 0.73} selected={selected} ghost={ghost} />)}
    </AssetBoundary>
    {tomatoPositions.map((x, index) => <group key={x} position={[x, 0, index % 2 ? 0.07 : -0.07]}>
      <mesh position={[0, 0.56, 0.02]} castShadow={!ghost}><cylinderGeometry args={[0.012, 0.018, 1.12, 8]} /><AccentMaterial color="#6f563d" selected={selected} ghost={ghost} /></mesh>
      {[[0.07, 0.34, 0.11], [-0.055, 0.44, 0.12], [0.045, 0.54, 0.1]].map(([dx, y, z], fruitIndex) => <mesh key={fruitIndex} position={[dx, y, z]} castShadow={!ghost}>
        <sphereGeometry args={[0.038 - fruitIndex * 0.003, 12, 9]} />
        <AccentMaterial color={fruitIndex === 2 ? '#d9824d' : '#b63d2e'} selected={selected} ghost={ghost} />
      </mesh>)}
    </group>)}
  </group>
}

function PotatoFlower({ position, selected, ghost }: { position: [number, number, number]; selected: boolean; ghost: boolean }) {
  return <group position={position} scale={0.55}>
    {[0, 1, 2, 3, 4].map((petal) => <mesh key={petal} position={[Math.cos(petal * Math.PI * 0.4) * 0.04, Math.sin(petal * Math.PI * 0.4) * 0.04, 0]} scale={[1.35, 0.72, 1]}>
      <sphereGeometry args={[0.026, 8, 6]} /><AccentMaterial color="#f1eee8" selected={selected} ghost={ghost} />
    </mesh>)}
    <mesh position={[0, 0, 0.015]}><sphereGeometry args={[0.014, 8, 6]} /><AccentMaterial color="#d6b84f" selected={selected} ghost={ghost} /></mesh>
  </group>
}

export function PotatoRowVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <AssetBoundary fallback={<>{[-0.78, 0, 0.78].flatMap((x) => [-0.22, 0.22].map((z, row) => <FallbackPlant key={`${x}-${z}`} position={[x + (row ? 0.08 : -0.08), 0, z]} height={0.5} selected={selected} ghost={ghost} />))}</>}>
      {[-0.78, 0, 0.78].flatMap((x, column) => [-0.22, 0.22].map((z, row) => <ImportedPlant key={`${x}-${z}`} path={potatoFoliageAsset} width={0.72} height={0.5} depth={0.6} position={[x + (row ? 0.08 : -0.08), 0, z]} rotation={(column * 0.84) + (row * 1.37)} selected={selected} ghost={ghost} />))}
    </AssetBoundary>
    <PotatoFlower position={[-0.72, 0.47, 0.12]} selected={selected} ghost={ghost} />
    <PotatoFlower position={[0.02, 0.49, -0.08]} selected={selected} ghost={ghost} />
    <PotatoFlower position={[0.73, 0.45, 0.14]} selected={selected} ghost={ghost} />
  </group>
}

export function CucumberTrellisVisual({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <AssetBoundary fallback={<>{[-0.82, -0.41, 0, 0.41, 0.82].map((x, index) => <FallbackPlant key={x} position={[x, 0, index % 2 ? 0.05 : -0.04]} height={1.16 - (index % 2) * 0.1} selected={selected} ghost={ghost} />)}</>}>
      {[-0.82, -0.41, 0, 0.41, 0.82].map((x, index) => <ImportedPlant key={x} path={tomatoFoliageAsset} width={0.52} height={1.16 - (index % 2) * 0.1} depth={0.48} position={[x, 0, index % 2 ? 0.05 : -0.04]} rotation={index * 0.61} selected={selected} ghost={ghost} />)}
    </AssetBoundary>
    {[-1.02, 1.02].map((x) => <mesh key={x} position={[x, 0.72, 0]} castShadow={!ghost}><cylinderGeometry args={[0.025, 0.035, 1.44, 8]} /><AccentMaterial color="#826347" selected={selected} ghost={ghost} /></mesh>)}
    <mesh position={[0, 1.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={!ghost}><cylinderGeometry args={[0.025, 0.03, 2.1, 8]} /><AccentMaterial color="#826347" selected={selected} ghost={ghost} /></mesh>
    {[0.32, 0.59, 0.86, 1.13].map((y) => <mesh key={y} position={[0, y, 0.02]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.004, 0.004, 2.02, 5]} /><AccentMaterial color="#b5a27e" selected={selected} ghost={ghost} /></mesh>)}
    {[-0.74, -0.38, 0.02, 0.42, 0.77].map((x, index) => <mesh key={x} position={[x, 0.55 + (index % 3) * 0.17, 0.2]} rotation={[0, 0, index % 2 ? -0.18 : 0.14]} castShadow={!ghost}>
      <capsuleGeometry args={[0.022, 0.12 + index * 0.006, 7, 10]} />
      <AccentMaterial color={index % 2 ? '#557f3b' : '#658f46'} selected={selected} ghost={ghost} />
    </mesh>)}
  </group>
}

type FruitTreeKind = 'apple' | 'cherry' | 'pear' | 'plum'
const speciesKind = (species: string): FruitTreeKind | null => species === 'Malus domestica' ? 'apple' : species === 'Prunus cerasus' ? 'cherry' : species === 'Pyrus communis' ? 'pear' : species === 'Prunus domestica' ? 'plum' : null
const harvestMonths: Record<FruitTreeKind, number[]> = { apple: [8, 9, 10], cherry: [7, 8], pear: [8, 9, 10], plum: [8, 9] }
const fruitColors: Record<FruitTreeKind, string> = { apple: '#a9342d', cherry: '#741825', pear: '#a2a43c', plum: '#49315f' }
const speciesShape: Record<FruitTreeKind, { x: number; z: number; rotation: number }> = {
  apple: { x: 1.08, z: 1.02, rotation: 0.15 },
  cherry: { x: 1, z: 0.96, rotation: 1.42 },
  pear: { x: 0.8, z: 0.76, rotation: 2.35 },
  plum: { x: 0.93, z: 0.9, rotation: 3.18 },
}
const fruitPoints = [
  [-0.29, 0.68, 0.15], [0.1, 0.76, 0.22], [0.28, 0.67, -0.07], [-0.1, 0.59, -0.25], [0.01, 0.82, -0.1],
  [-0.34, 0.76, -0.1], [0.34, 0.73, 0.12], [0.16, 0.57, 0.27], [-0.18, 0.72, 0.29], [0.23, 0.82, -0.19],
  [-0.39, 0.63, 0.03], [0.4, 0.64, -0.02], [-0.03, 0.65, 0.35], [0.05, 0.71, -0.35], [-0.23, 0.83, 0.08],
] as const
const blossomPoints = fruitPoints.slice(0, 10)

export const hasFruitTreeVisual = (plant: PlantModel) => speciesKind(plant.species) !== null

function Fruit({ kind, position, selected, ghost }: { kind: FruitTreeKind; position: [number, number, number]; selected: boolean; ghost: boolean }) {
  const radius = kind === 'cherry' ? 0.024 : kind === 'plum' ? 0.038 : 0.045
  return <group position={position}>
    <mesh scale={kind === 'pear' ? [0.76, 1.2, 0.76] : [1, 1, 1]} castShadow={!ghost}><sphereGeometry args={[radius, 10, 8]} /><AccentMaterial color={fruitColors[kind]} selected={selected} ghost={ghost} /></mesh>
    {kind === 'cherry' && <mesh position={[0.03, -0.008, 0.008]} castShadow={!ghost}><sphereGeometry args={[radius * 0.88, 9, 7]} /><AccentMaterial color="#8b1e2b" selected={selected} ghost={ghost} /></mesh>}
    <mesh position={[0, radius * 1.25, 0]}><cylinderGeometry args={[0.0035, 0.0035, radius * 1.4, 6]} /><AccentMaterial color="#465333" selected={selected} ghost={ghost} /></mesh>
  </group>
}

export function FruitTreeVisual({ plant, month, selected, ghost }: { plant: PlantModel; month: number; selected: boolean; ghost: boolean }) {
  const kind = speciesKind(plant.species) ?? 'apple'
  const visibleLeaf = plant.leafMonths.includes(month)
  const shape = speciesShape[kind]
  const hasFruit = visibleLeaf && harvestMonths[kind].includes(month)
  const hasBlossom = visibleLeaf && plant.bloomMonths.includes(month)
  return <group rotation={[0, shape.rotation, 0]}>
    <AssetBoundary fallback={<FallbackTree plant={plant} visibleLeaf={visibleLeaf} selected={selected} ghost={ghost} />}>
      <ImportedTree plant={plant} visibleLeaf={visibleLeaf} selected={selected} ghost={ghost} shape={shape} />
    </AssetBoundary>
    {hasFruit && fruitPoints.map(([x, y, z], index) => <Fruit key={index} kind={kind} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} selected={selected} ghost={ghost} />)}
    {hasBlossom && blossomPoints.map(([x, y, z], index) => <mesh key={index} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} castShadow={!ghost}><sphereGeometry args={[0.03, 8, 6]} /><AccentMaterial color={kind === 'cherry' ? '#e7b7c0' : '#eee1d9'} selected={selected} ghost={ghost} /></mesh>)}
    {(selected || ghost) && <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[plant.canopyM * 0.45, plant.canopyM * 0.5, 40]} /><meshBasicMaterial color="#b9e84d" transparent opacity={ghost ? 0.35 : 0.78} side={DoubleSide} /></mesh>}
  </group>
}

function ImportedTree({ plant, visibleLeaf, selected, ghost, shape }: { plant: PlantModel; visibleLeaf: boolean; selected: boolean; ghost: boolean; shape: { x: number; z: number } }) {
  const { prepared, bounds } = usePreparedScene(treeAsset, selected, ghost, visibleLeaf)
  const sourceWidth = Math.max(0.1, bounds.max.x - bounds.min.x)
  const sourceHeight = Math.max(0.1, bounds.max.y - bounds.min.y)
  const sourceDepth = Math.max(0.1, bounds.max.z - bounds.min.z)
  const scale: [number, number, number] = [plant.canopyM * shape.x / sourceWidth, plant.matureHeightM / sourceHeight, plant.canopyM * shape.z / sourceDepth]
  const position: [number, number, number] = [
    -((bounds.min.x + bounds.max.x) / 2) * scale[0],
    -bounds.min.y * scale[1],
    -((bounds.min.z + bounds.max.z) / 2) * scale[2],
  ]
  return <primitive object={prepared} scale={scale} position={position} />
}

function FallbackTree({ plant, visibleLeaf, selected, ghost }: { plant: PlantModel; visibleLeaf: boolean; selected: boolean; ghost: boolean }) {
  return <group>
    <mesh position={[0, plant.matureHeightM * 0.34, 0]} castShadow={!ghost}><cylinderGeometry args={[plant.canopyM * 0.06, plant.canopyM * 0.1, plant.matureHeightM * 0.68, 9]} /><AccentMaterial color="#68503b" selected={selected} ghost={ghost} /></mesh>
    {visibleLeaf && [[0, 0.7, 0], [-0.22, 0.61, 0.08], [0.21, 0.63, -0.06]].map(([x, y, z], index) => <mesh key={index} position={[x * plant.canopyM, y * plant.matureHeightM, z * plant.canopyM]} scale={[plant.canopyM * 0.48, plant.matureHeightM * 0.2, plant.canopyM * 0.45]} castShadow={!ghost}>
      <sphereGeometry args={[1, 14, 10]} /><AccentMaterial color={index === 0 ? '#486f38' : '#567d42'} selected={selected} ghost={ghost} />
    </mesh>)}
  </group>
}
