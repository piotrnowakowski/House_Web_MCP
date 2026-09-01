import { Edges, Grid, Line, OrbitControls, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, MathUtils, Mesh, Object3D } from 'three'
import { pointInPolygon } from '../domain/commands'
import { sunPositionForMonth } from '../domain/seasonal'
import type { BuildingModel, GardenZone, PlantModel, ProjectV1, RoomModel, VariantModel, ViewMode } from '../domain/types'
import { setExportSceneRoot, setRenderCanvas } from '../services/export'
import { useStudioStore } from '../state/store'
import { TextSprite } from '../ui/CanvasUi'

const roomPalette: Record<string, string> = {
  living: '#d7b889', kitchen: '#b7c8b4', work: '#a8b8cd', utility: '#b7aea5', sleeping: '#c8b6c6', garage: '#9fa9a4', flex: '#c7b9a6',
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
  const geometry = useMemo(() => {
    const xs = project.plot.boundary.map((point) => point.x)
    const zs = project.plot.boundary.map((point) => point.z)
    const minX = Math.floor(Math.min(...xs))
    const maxX = Math.ceil(Math.max(...xs))
    const minZ = Math.floor(Math.min(...zs))
    const maxZ = Math.ceil(Math.max(...zs))
    const step = 1.5
    const positions: number[] = []
    const add = (x: number, z: number) => positions.push(x, elevationAt(project, x, z), z)
    for (let x = minX; x < maxX; x += step) for (let z = minZ; z < maxZ; z += step) {
      const center = { x: x + step / 2, z: z + step / 2 }
      if (!pointInPolygon(center, project.plot.boundary)) continue
      add(x, z); add(x + step, z); add(x + step, z + step)
      add(x, z); add(x + step, z + step); add(x, z + step)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3))
    result.computeVertexNormals()
    return result
  }, [project])
  useEffect(() => () => geometry.dispose(), [geometry])
  const boundary = useMemo(() => [...project.plot.boundary, project.plot.boundary[0]].map((point) => [point.x, elevationAt(project, point.x, point.z) + 0.06, point.z] as [number, number, number]), [project])
  return <group>
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={mode === 'technical' ? '#17221f' : '#587258'} roughness={0.92} metalness={0} side={DoubleSide} />
    </mesh>
    <Line points={boundary} color={mode === 'technical' ? '#b8ed89' : '#e8e0c7'} lineWidth={mode === 'technical' ? 2 : 1} />
  </group>
}

function Opening({ opening, room }: { opening: RoomModel['openings'][number]; room: RoomModel }) {
  const onX = opening.wall === 'east' || opening.wall === 'west'
  const x = opening.wall === 'east' ? room.widthM / 2 + 0.012 : opening.wall === 'west' ? -room.widthM / 2 - 0.012 : opening.offsetM
  const z = opening.wall === 'north' ? -room.depthM / 2 - 0.012 : opening.wall === 'south' ? room.depthM / 2 + 0.012 : opening.offsetM
  return <mesh position={[x, opening.heightM / 2 + 0.18, z]} rotation={[0, onX ? Math.PI / 2 : 0, 0]}>
    <planeGeometry args={[opening.widthM, opening.heightM]} />
    <meshPhysicalMaterial color={opening.kind === 'window' ? '#b9dddf' : '#684c35'} roughness={opening.kind === 'window' ? 0.05 : 0.8} transmission={opening.kind === 'window' ? 0.45 : 0} transparent opacity={0.92} side={DoubleSide} />
  </mesh>
}

function RoomBody({ room, mode, selected, ghost = false }: { room: RoomModel; mode: ViewMode; selected: boolean; ghost?: boolean }) {
  const color = ghost ? '#aaf47c' : selected ? '#d9ffab' : mode === 'technical' ? roomPalette[room.usage] ?? '#b8c4be' : roomPalette[room.usage] ?? '#c7b9a6'
  return <>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[room.widthM, room.heightM, room.depthM]} />
      <meshPhysicalMaterial
        color={color} transparent opacity={ghost ? 0.2 : mode === 'technical' ? 0.36 : 0.88}
        roughness={mode === 'technical' ? 0.72 : 0.82} metalness={0} transmission={ghost ? 0.15 : mode === 'technical' ? 0.05 : 0}
        depthWrite={!ghost}
      />
      <Edges color={ghost ? '#b8ed89' : selected ? '#d9ffab' : mode === 'technical' ? '#7b9588' : '#5c6a62'} threshold={15} />
    </mesh>
    {!ghost && room.openings.map((opening) => <Opening key={opening.ref} opening={opening} room={room} />)}
    {room.mezzanines.map((mezzanine) => <mesh key={mezzanine.ref} position={[mezzanine.position.x, mezzanine.elevationM - room.heightM / 2, mezzanine.position.z]} castShadow>
      <boxGeometry args={[mezzanine.widthM, mezzanine.thicknessM, mezzanine.depthM]} />
      <meshStandardMaterial color={ghost ? '#b8ed89' : '#a8794d'} transparent opacity={ghost ? 0.35 : 1} />
      <Edges color="#4e3a2a" />
    </mesh>)}
    {!ghost && <group position={[0, room.heightM / 2 + 0.32, 0]}><TextSprite text={room.name.toUpperCase()} width={Math.min(3.8, Math.max(1.8, room.widthM * 0.65))} height={0.42} color={mode === 'technical' ? '#d7e3dc' : '#314039'} fontSize={72} /></group>}
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
  const material = <meshStandardMaterial color={ghost ? '#b8ed89' : mode === 'technical' ? '#6d8178' : '#544943'} transparent opacity={ghost ? 0.18 : mode === 'technical' ? 0.28 : 0.72} depthWrite={!ghost} side={DoubleSide} />
  if (building.roof.type === 'flat') return <mesh position={[centerX, top + 0.12, centerZ]} castShadow><boxGeometry args={[width, 0.22, depth]} />{material}<Edges color="#71847a" /></mesh>
  if (building.roof.type === 'hip') {
    const rise = Math.tan(MathUtils.degToRad(building.roof.pitchDegrees)) * Math.min(width, depth) / 2
    return <mesh position={[centerX, top + rise / 2, centerZ]} rotation={[0, Math.PI / 4, 0]} scale={[width / Math.max(width, depth), 1, depth / Math.max(width, depth)]} castShadow>
      <coneGeometry args={[Math.max(width, depth) / Math.sqrt(2), rise, 4]} />{material}<Edges color="#71847a" />
    </mesh>
  }
  const pitch = MathUtils.degToRad(building.roof.pitchDegrees)
  const half = width / 2
  const panel = Math.sqrt(half * half + Math.tan(pitch) * half * Math.tan(pitch) * half)
  const rise = Math.tan(pitch) * half
  return <group position={[centerX, top, centerZ]}>
    <mesh position={[-width / 4, rise / 2, 0]} rotation={[0, 0, pitch]} castShadow><boxGeometry args={[panel, 0.16, depth]} />{material}</mesh>
    <mesh position={[width / 4, rise / 2, 0]} rotation={[0, 0, -pitch]} castShadow><boxGeometry args={[panel, 0.16, depth]} />{material}</mesh>
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
  lawn: '#6d915e', terrace: '#c0a47c', path: '#a79d87', driveway: '#888c83', bed: '#72553f', 'rain-garden': '#497e73', vegetable: '#728a4d',
}

function GardenZoneScene({ zone, project, mode, ghost = false }: { zone: GardenZone; project: ProjectV1; mode: ViewMode; ghost?: boolean }) {
  const y = elevationAt(project, zone.position.x, zone.position.z) + 0.08
  return <group position={[zone.position.x, y, zone.position.z]} rotation={[0, MathUtils.degToRad(zone.rotationDegrees), 0]}>
    <mesh receiveShadow>
      <boxGeometry args={[zone.widthM, zone.kind === 'rain-garden' ? 0.12 : 0.16, zone.depthM]} />
      <meshStandardMaterial color={ghost ? '#b8ed89' : mode === 'technical' ? new Color(zoneColor[zone.kind]).multiplyScalar(0.65) : zoneColor[zone.kind]} transparent opacity={ghost ? 0.18 : mode === 'technical' ? 0.58 : 0.94} depthWrite={!ghost} />
      <Edges color={ghost ? '#b8ed89' : mode === 'technical' ? '#84988c' : zoneColor[zone.kind]} />
    </mesh>
    {!ghost && mode === 'technical' && <group position={[0, 0.35, 0]}><TextSprite text={zone.name.toUpperCase()} width={Math.min(3.5, zone.widthM * 0.75)} height={0.38} color="#d3dfd8" fontSize={64} /></group>}
  </group>
}

const seasonalCanopy = (plant: PlantModel, month: number) => {
  if (!plant.leafMonths.includes(month)) return { visible: false, color: '#75634c' }
  if (plant.bloomMonths.includes(month)) return { visible: true, color: plant.kind === 'tree' ? '#d9dcc5' : '#b88bb0' }
  if (month >= 9 && month <= 11) return { visible: true, color: '#b3763d' }
  return { visible: true, color: plant.kind === 'wetland' ? '#4f8b78' : '#47744d' }
}

function PlantScene({ plant, project, month, mode, ghost = false }: { plant: PlantModel; project: ProjectV1; month: number; mode: ViewMode; ghost?: boolean }) {
  const ground = elevationAt(project, plant.position.x, plant.position.z)
  const canopy = seasonalCanopy(plant, month)
  const crownHeight = Math.max(0.35, plant.matureHeightM * (plant.kind === 'tree' ? 0.55 : 0.72))
  const trunkHeight = plant.matureHeightM - crownHeight * 0.65
  const color = ghost ? '#b8ed89' : mode === 'technical' ? '#73957d' : canopy.color
  return <group position={[plant.position.x, ground, plant.position.z]}>
    <mesh position={[0, Math.max(0.2, trunkHeight / 2), 0]} castShadow>
      <cylinderGeometry args={[plant.kind === 'tree' ? 0.14 : 0.08, plant.kind === 'tree' ? 0.22 : 0.12, Math.max(0.35, trunkHeight), 8]} />
      <meshStandardMaterial color={ghost ? '#b8ed89' : '#6d4b31'} transparent opacity={ghost ? 0.25 : 1} />
    </mesh>
    {canopy.visible && (plant.kind === 'hedge' ? <mesh position={[0, plant.matureHeightM / 2, 0]} castShadow>
      <boxGeometry args={[plant.canopyM, plant.matureHeightM, Math.min(1.1, plant.canopyM * 0.25)]} />
      <meshStandardMaterial color={color} roughness={0.9} transparent opacity={ghost ? 0.22 : 1} />
    </mesh> : <mesh position={[0, trunkHeight, 0]} castShadow scale={[1, plant.kind === 'tree' ? 0.9 : 0.65, 1]}>
      <sphereGeometry args={[plant.canopyM / 2, mode === 'technical' ? 10 : 16, mode === 'technical' ? 7 : 12]} />
      <meshStandardMaterial color={color} roughness={0.92} transparent opacity={ghost ? 0.22 : mode === 'technical' ? 0.72 : 1} />
      {mode === 'technical' && <Edges color="#96aa9c" />}
    </mesh>)}
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
  const light = useRef<Object3D>(null)
  const target = useRef<Object3D>(null)
  const sun = useMemo(() => sunPositionForMonth(project.climateProfile.latitude, month), [project.climateProfile.latitude, month])
  useEffect(() => { if (light.current && target.current && 'target' in light.current) (light.current as never as { target: Object3D }).target = target.current }, [])
  return <>
    <ambientLight intensity={mode === 'technical' ? 0.75 : 0.58} />
    <hemisphereLight color={mode === 'technical' ? '#b5d1c4' : '#d8e4e5'} groundColor={mode === 'technical' ? '#111815' : '#6a5946'} intensity={mode === 'technical' ? 0.8 : 1.15} />
    <directionalLight ref={light} position={[sun.x, sun.y, sun.z]} color={mode === 'technical' ? '#d8eee2' : '#fff0c9'} intensity={mode === 'technical' ? 1.1 : 2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} />
    <object3D ref={target} position={[0, 0, 0]} />
  </>
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
    scene.background = new Color(mode === 'technical' ? '#0a100e' : '#c9d6cf')
    scene.fog = null
  }, [mode, scene])
  return <>
    <CameraRig />
    <SceneLighting project={project} month={month} mode={mode} />
    {mode === 'technical' && <Grid args={[80, 80]} position={[0, -0.18, 0]} cellSize={1} cellThickness={0.6} cellColor="#26352f" sectionSize={5} sectionThickness={1.1} sectionColor="#3d5349" fadeDistance={70} infiniteGrid />}
    <group ref={root} onPointerMissed={() => setSelectedRef(null)}>
      <ProjectScene project={project} mode={mode} explode={explode} month={month} />
      {latestVariant && <ProjectScene project={latestVariant.project} mode="technical" explode={explode} month={month} ghost />}
    </group>
    <OrbitControls makeDefault target={[0, 2.5, 1]} minDistance={9} maxDistance={85} maxPolarAngle={Math.PI * 0.47} enableDamping dampingFactor={0.07} />
  </>
}
