import { Edges, Environment, Grid, Lightformer, Line, OrbitControls, RoundedBox, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AmbientLight,
  BackSide,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  MathUtils,
  Object3D,
  ShaderMaterial,
  ShapeUtils,
  Vector2,
} from 'three'
import { sunPositionForMonth } from '../domain/seasonal'
import type { BuildingModel, GardenZone, PlantModel, ProjectV1, RoomModel, VariantModel, ViewMode } from '../domain/types'
import { setExportSceneRoot, setRenderCanvas } from '../services/export'
import { useStudioStore } from '../state/store'
import { TextSprite } from '../ui/CanvasUi'

const roomPalette: Record<string, string> = {
  living: '#e4dacb', kitchen: '#d8ddd2', work: '#d4dce0', utility: '#d3d0c9', sleeping: '#ddd4d8', garage: '#c3c9c5', flex: '#dbd4c9',
}

const elevationAt = (project: ProjectV1, x: number, z: number) => {
  let weighted = 0
  let total = 0
  project.plot.elevationPoints.forEach((point) => {
    const distance = Math.max(0.4, Math.hypot(point.x - x, point.z - z))
    const weight = 1 / (distance * distance)
    weighted += point.elevation * weight
    total += weight
  })
  return weighted / total
}

function Terrain({ project, mode }: { project: ProjectV1; mode: ViewMode }) {
  const { topGeometry, skirtGeometry } = useMemo(() => {
    const outline = project.plot.boundary.map((point) => new Vector2(point.x, point.z))
    const triangles = ShapeUtils.triangulateShape(outline, [])
    const positions: number[] = []
    triangles.forEach((triangle) => triangle.forEach((index) => {
      const point = project.plot.boundary[index]
      positions.push(point.x, elevationAt(project, point.x, point.z), point.z)
    }))
    const top = new BufferGeometry()
    top.setAttribute('position', new Float32BufferAttribute(positions, 3))
    top.computeVertexNormals()

    const skirtPositions: number[] = []
    const skirtDepth = 0.38
    const push = (x: number, y: number, z: number) => skirtPositions.push(x, y, z)
    project.plot.boundary.forEach((point, index) => {
      const next = project.plot.boundary[(index + 1) % project.plot.boundary.length]
      const y1 = elevationAt(project, point.x, point.z)
      const y2 = elevationAt(project, next.x, next.z)
      push(point.x, y1, point.z); push(next.x, y2, next.z); push(next.x, y2 - skirtDepth, next.z)
      push(point.x, y1, point.z); push(next.x, y2 - skirtDepth, next.z); push(point.x, y1 - skirtDepth, point.z)
    })
    const skirt = new BufferGeometry()
    skirt.setAttribute('position', new Float32BufferAttribute(skirtPositions, 3))
    skirt.computeVertexNormals()
    return { topGeometry: top, skirtGeometry: skirt }
  }, [project])
  useEffect(() => () => {
    topGeometry.dispose()
    skirtGeometry.dispose()
  }, [skirtGeometry, topGeometry])
  const boundary = useMemo(() => [
    ...project.plot.boundary,
    project.plot.boundary[0],
  ].map((point) => [point.x, elevationAt(project, point.x, point.z) + 0.045, point.z] as [number, number, number]), [project])
  return <group>
    <mesh geometry={topGeometry} receiveShadow>
      <meshStandardMaterial
        color={mode === 'technical' ? '#14211d' : '#8fa77d'}
        roughness={0.96}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
    <mesh geometry={skirtGeometry} receiveShadow>
      <meshStandardMaterial color={mode === 'technical' ? '#0a1210' : '#6f7461'} roughness={1} side={DoubleSide} />
    </mesh>
    <Line
      points={boundary}
      color={mode === 'technical' ? '#bfe876' : '#e8eadf'}
      lineWidth={mode === 'technical' ? 1.5 : 0.75}
      transparent
      opacity={mode === 'technical' ? 0.9 : 0.5}
    />
  </group>
}

function Opening({ opening, room, mode }: { opening: RoomModel['openings'][number]; room: RoomModel; mode: ViewMode }) {
  const onX = opening.wall === 'east' || opening.wall === 'west'
  const x = opening.wall === 'east' ? room.widthM / 2 + 0.012 : opening.wall === 'west' ? -room.widthM / 2 - 0.012 : opening.offsetM
  const z = opening.wall === 'north' ? -room.depthM / 2 - 0.012 : opening.wall === 'south' ? room.depthM / 2 + 0.012 : opening.offsetM
  const isWindow = opening.kind === 'window'
  return <group position={[x, opening.heightM / 2 + 0.18, z]} rotation={[0, onX ? Math.PI / 2 : 0, 0]}>
    <mesh>
      <planeGeometry args={[opening.widthM, opening.heightM]} />
      <meshPhysicalMaterial
        color={isWindow ? (mode === 'technical' ? '#9fd6d1' : '#77aab2') : '#765038'}
        roughness={isWindow ? 0.08 : 0.78}
        metalness={isWindow ? 0.08 : 0}
        transmission={isWindow && mode === 'realistic' ? 0.52 : 0}
        transparent
        opacity={isWindow ? 0.78 : 1}
        side={DoubleSide}
      />
      <Edges color={isWindow ? '#d7eeea' : '#422d20'} lineWidth={1.1} />
    </mesh>
    {isWindow && <mesh position={[0, 0, 0.008]}>
      <boxGeometry args={[0.035, opening.heightM, 0.015]} />
      <meshStandardMaterial color="#e7e5dc" roughness={0.5} />
    </mesh>}
  </group>
}

function RoomBody({ room, mode, selected, ghost = false }: { room: RoomModel; mode: ViewMode; selected: boolean; ghost?: boolean }) {
  const color = ghost ? '#c7f36e' : mode === 'technical' ? (selected ? '#9cc4ae' : '#76a18e') : roomPalette[room.usage] ?? '#ded8cc'
  return <>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[room.widthM, room.heightM, room.depthM]} />
      <meshPhysicalMaterial
        color={color}
        emissive={selected && !ghost ? '#6f8e49' : '#000000'}
        emissiveIntensity={selected && !ghost ? 0.12 : 0}
        transparent
        opacity={ghost ? 0.18 : mode === 'technical' ? 0.2 : 0.96}
        roughness={mode === 'technical' ? 0.55 : 0.88}
        metalness={0}
        transmission={ghost ? 0.1 : mode === 'technical' ? 0.08 : 0}
        depthWrite={!ghost}
      />
      <Edges
        color={ghost ? '#d8ff8e' : selected ? '#b9e45e' : mode === 'technical' ? '#8ab4a1' : '#807a6d'}
        threshold={15}
        lineWidth={ghost || selected ? 1.8 : 0.65}
      />
    </mesh>
    {!ghost && room.openings.map((opening) => <Opening key={opening.ref} opening={opening} room={room} mode={mode} />)}
    {room.mezzanines.map((mezzanine) => <mesh key={mezzanine.ref} position={[mezzanine.position.x, mezzanine.elevationM - room.heightM / 2, mezzanine.position.z]} castShadow>
      <boxGeometry args={[mezzanine.widthM, mezzanine.thicknessM, mezzanine.depthM]} />
      <meshStandardMaterial color={ghost ? '#c7f36e' : '#aa7b52'} roughness={0.72} transparent opacity={ghost ? 0.32 : 1} />
      <Edges color={ghost ? '#d8ff8e' : '#5b3d29'} />
    </mesh>)}
    {!ghost && mode === 'technical' && <group position={[0, room.heightM / 2 + 0.32, 0]}>
      <TextSprite text={room.name.toUpperCase()} width={Math.min(3.8, Math.max(1.8, room.widthM * 0.65))} height={0.42} color={mode === 'technical' ? '#d9e7df' : '#34423b'} fontSize={72} />
    </group>}
  </>
}

function EditableRoom({ room, building, floorY, mode, ghost = false }: { room: RoomModel; building: BuildingModel; floorY: number; mode: ViewMode; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef)
  const transformMode = useStudioStore((state) => state.transformMode)
  const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const commitCommand = useStudioStore((state) => state.commitCommand)
  const setToast = useStudioStore((state) => state.setToast)
  const groupRef = useRef<Group>(null)
  const selected = !ghost && selectedRef === room.ref
  const body = <group
    ref={groupRef}
    position={[room.position.x, floorY + room.heightM / 2, room.position.z]}
    rotation={[0, MathUtils.degToRad(room.rotationDegrees), 0]}
    onClick={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(room.ref) }}
  >
    <RoomBody room={room} mode={mode} selected={selected} ghost={ghost} />
  </group>
  if (!selected || room.locked || ghost) return body
  const finishTransform = () => {
    const object = groupRef.current
    if (!object) return
    try {
      if (transformMode === 'translate') commitCommand({ type: 'room.update', action: 'move', buildingRef: building.ref, floorRef: building.floors.find((floor) => floor.rooms.some((item) => item.ref === room.ref))!.ref, roomRef: room.ref, position: { x: object.position.x, z: object.position.z } })
      if (transformMode === 'scale') commitCommand({ type: 'room.update', action: 'resize', buildingRef: building.ref, floorRef: building.floors.find((floor) => floor.rooms.some((item) => item.ref === room.ref))!.ref, roomRef: room.ref, widthM: Math.max(1, room.widthM * object.scale.x), depthM: Math.max(1, room.depthM * object.scale.z) })
      if (transformMode === 'rotate') commitCommand({ type: 'room.update', action: 'move', buildingRef: building.ref, floorRef: building.floors.find((floor) => floor.rooms.some((item) => item.ref === room.ref))!.ref, roomRef: room.ref, rotationDegrees: MathUtils.radToDeg(object.rotation.y) })
      object.scale.set(1, 1, 1)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Transform failed.') }
  }
  return <TransformControls
    mode={transformMode} translationSnap={0.5} rotationSnap={Math.PI / 12} scaleSnap={0.1}
    showX={transformMode !== 'rotate'} showY={transformMode === 'rotate'} showZ={transformMode !== 'rotate'}
    onMouseUp={finishTransform}
  >{body}</TransformControls>
}

const buildingBounds = (building: BuildingModel) => {
  const rooms = building.floors.flatMap((floor) => floor.rooms)
  if (!rooms.length) return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }
  return rooms.reduce((bounds, room) => ({
    minX: Math.min(bounds.minX, room.position.x - room.widthM / 2), maxX: Math.max(bounds.maxX, room.position.x + room.widthM / 2),
    minZ: Math.min(bounds.minZ, room.position.z - room.depthM / 2), maxZ: Math.max(bounds.maxZ, room.position.z + room.depthM / 2),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

function Roof({ building, mode, ghost, explodeOffset }: { building: BuildingModel; mode: ViewMode; ghost: boolean; explodeOffset: number }) {
  const bounds = buildingBounds(building)
  const width = bounds.maxX - bounds.minX + building.roof.overhangM * 2
  const depth = bounds.maxZ - bounds.minZ + building.roof.overhangM * 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerZ = (bounds.minZ + bounds.maxZ) / 2
  const highestFloor = building.floors.reduce((highest, floor) => floor.elevationM + floor.defaultHeightM > highest.elevationM + highest.defaultHeightM ? floor : highest, building.floors[0])
  if (!highestFloor) return null
  const top = highestFloor.elevationM + highestFloor.defaultHeightM + explodeOffset
  const material = <meshStandardMaterial
    color={ghost ? '#c7f36e' : mode === 'technical' ? '#6f9182' : '#594238'}
    roughness={mode === 'technical' ? 0.55 : 0.82}
    metalness={mode === 'realistic' ? 0.03 : 0}
    transparent
    opacity={ghost ? 0.16 : mode === 'technical' ? 0.2 : 1}
    depthWrite={!ghost}
    side={DoubleSide}
  />
  if (building.roof.type === 'flat') return <mesh position={[centerX, top + 0.12, centerZ]} castShadow receiveShadow>
    <boxGeometry args={[width, 0.22, depth]} />{material}<Edges color={ghost ? '#d8ff8e' : mode === 'technical' ? '#9fc3b2' : '#392a24'} lineWidth={0.8} />
  </mesh>
  if (building.roof.type === 'hip') {
    const rise = Math.tan(MathUtils.degToRad(building.roof.pitchDegrees)) * Math.min(width, depth) / 2
    return <mesh position={[centerX, top + rise / 2, centerZ]} rotation={[0, Math.PI / 4, 0]} scale={[width / Math.max(width, depth), 1, depth / Math.max(width, depth)]} castShadow>
      <coneGeometry args={[Math.max(width, depth) / Math.sqrt(2), rise, 4]} />{material}<Edges color={ghost ? '#d8ff8e' : mode === 'technical' ? '#9fc3b2' : '#392a24'} lineWidth={0.8} />
    </mesh>
  }
  const pitch = MathUtils.degToRad(building.roof.pitchDegrees)
  const half = width / 2
  const panel = Math.sqrt(half * half + Math.tan(pitch) * half * Math.tan(pitch) * half)
  const rise = Math.tan(pitch) * half
  return <group position={[centerX, top, centerZ]}>
    <mesh position={[-width / 4, rise / 2, 0]} rotation={[0, 0, pitch]} castShadow receiveShadow><boxGeometry args={[panel, 0.18, depth]} />{material}</mesh>
    <mesh position={[width / 4, rise / 2, 0]} rotation={[0, 0, -pitch]} castShadow receiveShadow><boxGeometry args={[panel, 0.18, depth]} />{material}</mesh>
    <mesh position={[0, rise + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.09, 0.09, depth + 0.12, 8]} />
      <meshStandardMaterial color={ghost ? '#c7f36e' : mode === 'technical' ? '#91b7a5' : '#3d2d27'} roughness={0.78} transparent opacity={ghost ? 0.2 : mode === 'technical' ? 0.45 : 1} />
    </mesh>
  </group>
}

function BuildingScene({ building, mode, explode, ghost = false }: { building: BuildingModel; mode: ViewMode; explode: boolean; ghost?: boolean }) {
  return <group position={[building.position.x, 0, building.position.z]} rotation={[0, MathUtils.degToRad(building.rotationDegrees), 0]}>
    {building.floors.map((floor) => {
      const floorY = floor.elevationM + (explode ? floor.level * 1.9 : 0)
      return <group key={floor.ref}>
        {floor.rooms.map((room) => <EditableRoom key={room.ref} room={room} building={building} floorY={floorY} mode={mode} ghost={ghost} />)}
      </group>
    })}
    <Roof building={building} mode={mode} ghost={ghost} explodeOffset={explode ? Math.max(0, building.floors.length - 1) * 1.9 : 0} />
  </group>
}

const zoneColor: Record<GardenZone['kind'], string> = {
  lawn: '#7ea36a', terrace: '#cdb58f', path: '#bbb09d', driveway: '#9d9e95', bed: '#755b43', 'rain-garden': '#5f9184', vegetable: '#819b59',
}

function GardenZoneScene({ zone, project, mode, ghost = false }: { zone: GardenZone; project: ProjectV1; mode: ViewMode; ghost?: boolean }) {
  const y = elevationAt(project, zone.position.x, zone.position.z) + 0.08
  return <group position={[zone.position.x, y, zone.position.z]} rotation={[0, MathUtils.degToRad(zone.rotationDegrees), 0]}>
    <RoundedBox args={[zone.widthM, zone.kind === 'rain-garden' ? 0.1 : 0.14, zone.depthM]} radius={0.08} smoothness={3} receiveShadow>
      <meshStandardMaterial
        color={ghost ? '#c7f36e' : mode === 'technical' ? new Color(zoneColor[zone.kind]).multiplyScalar(0.58) : zoneColor[zone.kind]}
        roughness={zone.kind === 'rain-garden' ? 0.65 : 0.95}
        transparent
        opacity={ghost ? 0.16 : mode === 'technical' ? 0.46 : 0.98}
        depthWrite={!ghost}
      />
      {(ghost || mode === 'technical') && <Edges color={ghost ? '#d8ff8e' : '#82998d'} lineWidth={0.75} />}
    </RoundedBox>
    {!ghost && mode === 'technical' && <group position={[0, 0.35, 0]}><TextSprite text={zone.name.toUpperCase()} width={Math.min(3.5, zone.widthM * 0.75)} height={0.38} color="#d3dfd8" fontSize={64} /></group>}
  </group>
}

const seasonalCanopy = (plant: PlantModel, month: number) => {
  if (!plant.leafMonths.includes(month)) return { visible: false, color: '#75634c' }
  if (plant.bloomMonths.includes(month)) return { visible: true, color: plant.kind === 'tree' ? '#c7d29d' : '#b66f91' }
  if (month >= 9 && month <= 11) return { visible: true, color: '#ad6d38' }
  return { visible: true, color: plant.kind === 'wetland' ? '#4f8f79' : '#3f7048' }
}

const foliageLobes: Array<[number, number, number, number]> = [
  [0, 0.2, 0, 1], [-0.42, -0.04, 0.08, 0.72], [0.38, -0.02, 0.12, 0.76],
  [0.08, 0.04, -0.4, 0.7], [-0.12, 0.1, 0.38, 0.68],
]

const bloomDots: Array<[number, number, number]> = [
  [-0.52, 0.12, 0.2], [0.48, 0.2, 0.16], [0.08, 0.48, -0.12], [-0.15, -0.05, 0.52], [0.3, -0.08, -0.46],
]

function PlantScene({ plant, project, month, mode, ghost = false }: { plant: PlantModel; project: ProjectV1; month: number; mode: ViewMode; ghost?: boolean }) {
  const ground = elevationAt(project, plant.position.x, plant.position.z)
  const canopy = seasonalCanopy(plant, month)
  const isTree = plant.kind === 'tree'
  const crownRadius = Math.max(0.28, plant.canopyM / 2)
  const crownHeight = Math.max(0.35, plant.matureHeightM * (isTree ? 0.48 : 0.68))
  const trunkHeight = isTree ? plant.matureHeightM - crownHeight * 0.52 : Math.max(0.25, plant.matureHeightM * 0.32)
  const color = ghost ? '#c7f36e' : mode === 'technical' ? '#6f9c84' : canopy.color
  const isBlooming = plant.bloomMonths.includes(month) && canopy.visible && !ghost
  return <group position={[plant.position.x, ground, plant.position.z]}>
    <mesh position={[0, Math.max(0.2, trunkHeight / 2), 0]} castShadow>
      <cylinderGeometry args={[isTree ? 0.13 : 0.05, isTree ? 0.24 : 0.11, Math.max(0.3, trunkHeight), 10]} />
      <meshStandardMaterial color={ghost ? '#c7f36e' : '#674631'} roughness={1} transparent opacity={ghost ? 0.22 : 1} />
    </mesh>
    {canopy.visible && plant.kind === 'hedge' && <RoundedBox args={[plant.canopyM, plant.matureHeightM, Math.min(1.15, plant.canopyM * 0.24)]} radius={0.38} smoothness={4} position={[0, plant.matureHeightM / 2, 0]} castShadow>
      <meshStandardMaterial color={color} roughness={0.96} transparent opacity={ghost ? 0.18 : mode === 'technical' ? 0.68 : 1} />
      {mode === 'technical' && <Edges color="#a3b9ac" lineWidth={0.7} />}
    </RoundedBox>}
    {canopy.visible && plant.kind === 'wetland' && <group position={[0, 0.1, 0]}>
      {Array.from({ length: 11 }, (_, index) => {
        const angle = index * 2.19
        const radius = (index % 4) * 0.16
        const height = plant.matureHeightM * (0.72 + (index % 3) * 0.12)
        return <mesh key={index} position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]} rotation={[0.08 * Math.sin(angle), angle, 0.08 * Math.cos(angle)]} castShadow>
          <coneGeometry args={[0.055, height, 5]} />
          <meshStandardMaterial color={index % 2 ? color : '#7d9b5c'} roughness={0.95} transparent opacity={ghost ? 0.2 : 1} />
        </mesh>
      })}
    </group>}
    {canopy.visible && plant.kind !== 'hedge' && plant.kind !== 'wetland' && <group position={[0, trunkHeight, 0]}>
      {foliageLobes.map(([x, y, z, scale], index) => <mesh
        key={index}
        position={[x * crownRadius, y * crownHeight, z * crownRadius]}
        scale={[scale, scale * (isTree ? 0.88 : 0.68), scale]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[crownRadius * 0.68, mode === 'technical' ? 1 : 2]} />
        <meshStandardMaterial
          color={index % 2 && mode === 'realistic' ? new Color(color).offsetHSL(0.01, 0.02, -0.045) : color}
          roughness={0.96}
          flatShading={mode === 'realistic'}
          transparent
          opacity={ghost ? 0.17 : mode === 'technical' ? 0.64 : 1}
        />
        {mode === 'technical' && <Edges color="#9db5a7" lineWidth={0.55} />}
      </mesh>)}
      {isBlooming && bloomDots.map(([x, y, z], index) => <mesh key={`bloom-${index}`} position={[x * crownRadius, y * crownHeight, z * crownRadius]} castShadow>
        <sphereGeometry args={[Math.max(0.08, crownRadius * 0.075), 8, 6]} />
        <meshStandardMaterial color={isTree ? '#f0e7dc' : '#dfb0bf'} roughness={0.82} />
      </mesh>)}
    </group>}
  </group>
}

function ProjectScene({ project, mode, explode, month, ghost = false }: { project: ProjectV1; mode: ViewMode; explode: boolean; month: number; ghost?: boolean }) {
  return <group>
    {!ghost && <Terrain project={project} mode={mode} />}
    {project.garden.zones.map((zone) => <GardenZoneScene key={zone.ref} zone={zone} project={project} mode={mode} ghost={ghost} />)}
    {project.garden.plants.map((plant) => <PlantScene key={plant.ref} plant={plant} project={project} month={month} mode={mode} ghost={ghost} />)}
    {project.buildings.map((building) => <BuildingScene key={building.ref} building={building} mode={mode} explode={explode} ghost={ghost} />)}
  </group>
}

function SceneLighting({ project, month, mode }: { project: ProjectV1; month: number; mode: ViewMode }) {
  const ambient = useRef<AmbientLight>(null)
  const hemisphere = useRef<HemisphereLight>(null)
  const light = useRef<DirectionalLight>(null)
  const target = useRef<Object3D>(null)
  const sun = useMemo(() => sunPositionForMonth(project.climateProfile.latitude, month), [project.climateProfile.latitude, month])
  const colors = useMemo(() => ({
    ambient: new Color(mode === 'technical' ? '#8eb1a1' : '#f6ead5'),
    sky: new Color(mode === 'technical' ? '#88aa9b' : '#d8e8ed'),
    ground: new Color(mode === 'technical' ? '#07100d' : '#7a6a52'),
    sun: new Color(mode === 'technical' ? '#d6f3e5' : '#fff0ce'),
  }), [mode])
  useEffect(() => { if (light.current && target.current) light.current.target = target.current }, [])
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * 3.2)
    if (ambient.current) {
      ambient.current.intensity = MathUtils.lerp(ambient.current.intensity, mode === 'technical' ? 0.52 : 0.72, blend)
      ambient.current.color.lerp(colors.ambient, blend)
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = MathUtils.lerp(hemisphere.current.intensity, mode === 'technical' ? 0.6 : 1.15, blend)
      hemisphere.current.color.lerp(colors.sky, blend)
      hemisphere.current.groundColor.lerp(colors.ground, blend)
    }
    if (light.current) {
      light.current.intensity = MathUtils.lerp(light.current.intensity, mode === 'technical' ? 1.05 : 2.45, blend)
      light.current.color.lerp(colors.sun, blend)
    }
  })
  return <>
    <ambientLight ref={ambient} color={colors.ambient} intensity={mode === 'technical' ? 0.52 : 0.72} />
    <hemisphereLight ref={hemisphere} color={colors.sky} groundColor={colors.ground} intensity={mode === 'technical' ? 0.6 : 1.15} />
    <directionalLight
      ref={light}
      position={[sun.x, sun.y, sun.z]}
      color={colors.sun}
      intensity={mode === 'technical' ? 1.05 : 2.45}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-38}
      shadow-camera-right={38}
      shadow-camera-top={38}
      shadow-camera-bottom={-38}
      shadow-bias={-0.00012}
      shadow-normalBias={0.035}
      shadow-radius={2.2}
    />
    <object3D ref={target} position={[0, 0, 0]} />
    {mode === 'realistic' && <Environment resolution={128}>
      <Lightformer form="rect" intensity={1.8} color="#fff3dd" position={[-18, 22, 12]} rotation={[Math.PI / 2, 0, 0]} scale={[24, 24, 1]} />
      <Lightformer form="rect" intensity={0.75} color="#b9d4d2" position={[22, 9, -18]} rotation={[0, -Math.PI / 3, 0]} scale={[18, 10, 1]} />
      <Lightformer form="ring" intensity={0.45} color="#d5e5da" position={[0, 6, 24]} scale={[12, 12, 1]} />
    </Environment>}
  </>
}

function Atmosphere({ mode }: { mode: ViewMode }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    topColor: { value: new Color(mode === 'technical' ? '#101d19' : '#b8d0d3') },
    horizonColor: { value: new Color(mode === 'technical' ? '#09110f' : '#e9ebe4') },
    floorColor: { value: new Color(mode === 'technical' ? '#050908' : '#d9ddd5') },
  }), [])
  const targets = useMemo(() => ({
    top: new Color(mode === 'technical' ? '#101d19' : '#b8d0d3'),
    horizon: new Color(mode === 'technical' ? '#09110f' : '#e9ebe4'),
    floor: new Color(mode === 'technical' ? '#050908' : '#d9ddd5'),
  }), [mode])
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * 2.8)
    uniforms.topColor.value.lerp(targets.top, blend)
    uniforms.horizonColor.value.lerp(targets.horizon, blend)
    uniforms.floorColor.value.lerp(targets.floor, blend)
  })
  return <mesh scale={145} renderOrder={-1000} frustumCulled={false}>
    <sphereGeometry args={[1, 48, 24]} />
    <shaderMaterial
      ref={material}
      side={BackSide}
      depthWrite={false}
      uniforms={uniforms}
      vertexShader={`varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
      fragmentShader={`
        varying vec3 vPosition;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 floorColor;
        void main() {
          float h = normalize(vPosition).y;
          vec3 lower = mix(floorColor, horizonColor, smoothstep(-0.42, 0.08, h));
          vec3 color = mix(lower, topColor, smoothstep(0.02, 0.78, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `}
    />
  </mesh>
}

function CameraRig() {
  const camera = useThree((state) => state.camera)
  const initialized = useRef(false)
  useFrame(() => {
    if (!initialized.current) {
      camera.lookAt(0, 2, 0)
      initialized.current = true
    }
  })
  return null
}

export function StudioScene() {
  const project = useStudioStore((state) => state.project)
  const mode = useStudioStore((state) => state.viewMode)
  const month = useStudioStore((state) => state.month)
  const explode = useStudioStore((state) => state.explodeFloors)
  const variants = useStudioStore((state) => state.variants)
  const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const root = useRef<Group>(null)
  const latestVariant: VariantModel | undefined = variants.at(-1)
  useEffect(() => { setExportSceneRoot(root.current); return () => setExportSceneRoot(null) }, [])
  const { gl, scene } = useThree()
  useEffect(() => { setRenderCanvas(gl.domElement); return () => setRenderCanvas(null) }, [gl])
  useEffect(() => {
    scene.background = new Color(mode === 'technical' ? '#050908' : '#d9ddd5')
    scene.fog = null
  }, [mode, scene])
  return <>
    <CameraRig />
    <Atmosphere mode={mode} />
    <SceneLighting project={project} month={month} mode={mode} />
    {mode === 'technical' && <Grid
      args={[90, 90]}
      position={[0, -0.19, 0]}
      cellSize={1}
      cellThickness={0.45}
      cellColor="#20332b"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#496556"
      fadeDistance={72}
      fadeStrength={1.3}
      infiniteGrid
    />}
    <group ref={root} onPointerMissed={() => setSelectedRef(null)}>
      <ProjectScene project={project} mode={mode} explode={explode} month={month} />
      {latestVariant && <ProjectScene project={latestVariant.project} mode="technical" explode={explode} month={month} ghost />}
    </group>
    <OrbitControls
      makeDefault
      target={[0, 2.1, 1.4]}
      minDistance={10}
      maxDistance={78}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.46}
      enableDamping
      dampingFactor={0.055}
    />
  </>
}
