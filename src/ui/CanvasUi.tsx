import { Hud, OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Group, LinearFilter, MathUtils, Shape, SRGBColorSpace } from 'three'
import { calculateMetrics } from '../domain/commands'
import { analyzeSeason } from '../domain/seasonal'
import type { ArchitecturalStyle, GardenZone, PlantModel, ProjectCommand, RoomModel } from '../domain/types'
import { exportProjectJson, exportSceneGlb, exportScenePng } from '../services/export'
import { resolveExportConfirmation, resolveVariantConfirmation } from '../services/webmcp'
import { useStudioStore } from '../state/store'

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface TextSpriteProps {
  text: string
  width?: number
  height?: number
  color?: string
  fontSize?: number
  align?: CanvasTextAlign
  opacity?: number
}

const useLabelTexture = (text: string, color: string, fontSize: number, align: CanvasTextAlign, width: number, height: number) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = 256
    canvas.width = Math.min(3072, Math.max(512, Math.round(canvas.height * width / Math.max(1, height))))
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = color
    context.font = `600 ${fontSize * 1.52}px "Segoe UI", Inter, sans-serif`
    context.textAlign = align
    context.textBaseline = 'middle'
    context.fillText(text, align === 'left' ? 24 : align === 'right' ? canvas.width - 24 : canvas.width / 2, canvas.height / 2, canvas.width - 48)
    const result = new CanvasTexture(canvas)
    result.minFilter = LinearFilter
    result.magFilter = LinearFilter
    result.generateMipmaps = false
    result.colorSpace = SRGBColorSpace
    result.needsUpdate = true
    return result
  }, [text, color, fontSize, align, width, height])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

export function TextSprite({ text, width = 180, height = 34, color = '#edf5ef', fontSize = 92, align = 'center', opacity = 1 }: TextSpriteProps) {
  const texture = useLabelTexture(text, color, fontSize, align, width, height)
  return <sprite scale={[width, height, 1]} renderOrder={1000}>
    <spriteMaterial map={texture} transparent opacity={opacity} depthTest={false} depthWrite={false} />
  </sprite>
}

const useRoundedShape = (width: number, height: number, radius: number) => useMemo(() => {
  const halfW = width / 2
  const halfH = height / 2
  const r = Math.min(radius, halfW, halfH)
  const shape = new Shape()
  shape.moveTo(-halfW + r, -halfH)
  shape.lineTo(halfW - r, -halfH)
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r)
  shape.lineTo(halfW, halfH - r)
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH)
  shape.lineTo(-halfW + r, halfH)
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r)
  shape.lineTo(-halfW, -halfH + r)
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH)
  return shape
}, [height, radius, width])

interface CanvasButtonProps {
  label: string
  x: number
  y: number
  width?: number
  height?: number
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

function CanvasButton({ label, x, y, width = 104, height = 44, active = false, danger = false, disabled = false, onClick }: CanvasButtonProps) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<Group>(null)
  const shape = useRoundedShape(width, height, Math.min(10, height * 0.28))
  const fill = danger ? (hovered ? '#874740' : '#6f3935') : active ? '#c6ed76' : hovered ? '#31453c' : '#1a2621'
  const text = active ? '#172017' : disabled ? '#66766e' : '#edf3ee'
  useFrame((_, delta) => {
    if (!group.current) return
    const target = hovered && !disabled ? 1.025 : 1
    const scale = prefersReducedMotion ? target : MathUtils.lerp(group.current.scale.x, target, 1 - Math.exp(-delta * 16))
    group.current.scale.set(scale, scale, 1)
  })
  return <group ref={group} position={[x, y, 2]}>
    <mesh
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = disabled ? 'not-allowed' : 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
      onClick={(event) => { event.stopPropagation(); if (!disabled) onClick() }}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={fill} transparent opacity={disabled ? 0.46 : 0.96} depthTest={false} depthWrite={false} />
    </mesh>
    <group position={[0, 0, 1]}><TextSprite text={label} width={width - 14} height={height * 0.62} color={text} fontSize={78} /></group>
  </group>
}

function Panel({ x, y, width, height, opacity = 0.9, radius = 14, children }: { x: number; y: number; width: number; height: number; opacity?: number; radius?: number; children?: React.ReactNode }) {
  const shape = useRoundedShape(width, height, radius)
  const border = useRoundedShape(width + 2, height + 2, radius + 1)
  return <group position={[x, y, 0]}>
    <mesh position={[0, 0, -0.12]}>
      <shapeGeometry args={[border]} />
      <meshBasicMaterial color="#6b7b72" transparent opacity={0.28} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color="#101815" transparent opacity={opacity} depthTest={false} depthWrite={false} />
    </mesh>
    {children}
  </group>
}

type StudioSelection =
  | { kind: 'room'; room: RoomModel; buildingRef: string; floorRef: string }
  | { kind: 'zone'; zone: GardenZone }
  | { kind: 'plant'; plant: PlantModel }

const findSelection = (ref: string | null): StudioSelection | null => {
  if (!ref) return null
  const project = useStudioStore.getState().project
  for (const building of project.buildings) for (const floor of building.floors) {
    const room = floor.rooms.find((item) => item.ref === ref)
    if (room) return { kind: 'room', room, buildingRef: building.ref, floorRef: floor.ref }
  }
  const zone = project.garden.zones.find((item) => item.ref === ref)
  if (zone) return { kind: 'zone', zone }
  const plant = project.garden.plants.find((item) => item.ref === ref)
  if (plant) return { kind: 'plant', plant }
  return null
}

function StudioHudContent() {
  const { width, height } = useThree((state) => state.size)
  const [exporting, setExporting] = useState<'json' | 'glb' | 'png' | null>(null)
  const project = useStudioStore((state) => state.project)
  const variants = useStudioStore((state) => state.variants)
  const selectedRef = useStudioStore((state) => state.selectedRef)
  const viewMode = useStudioStore((state) => state.viewMode)
  const transformMode = useStudioStore((state) => state.transformMode)
  const month = useStudioStore((state) => state.month)
  const explodeFloors = useStudioStore((state) => state.explodeFloors)
  const webMcpAvailable = useStudioStore((state) => state.webMcpAvailable)
  const confirmationVariantRef = useStudioStore((state) => state.confirmationVariantRef)
  const pendingExport = useStudioStore((state) => state.pendingExport)
  const toast = useStudioStore((state) => state.toast)
  const history = useStudioStore((state) => state.history)
  const helpOpen = useStudioStore((state) => state.helpOpen)
  const setViewMode = useStudioStore((state) => state.setViewMode)
  const setTransformMode = useStudioStore((state) => state.setTransformMode)
  const setMonth = useStudioStore((state) => state.setMonth)
  const setExplodeFloors = useStudioStore((state) => state.setExplodeFloors)
  const createVariant = useStudioStore((state) => state.createVariant)
  const applyVariant = useStudioStore((state) => state.applyVariant)
  const discardVariant = useStudioStore((state) => state.discardVariant)
  const commitCommand = useStudioStore((state) => state.commitCommand)
  const undo = useStudioStore((state) => state.undo)
  const setToast = useStudioStore((state) => state.setToast)
  const setHelpOpen = useStudioStore((state) => state.setHelpOpen)
  const selected = findSelection(selectedRef)
  const selectedLocked = selected?.kind === 'room'
    ? selected.room.locked
    : selected?.kind === 'zone'
      ? selected.zone.locked
      : selected?.kind === 'plant'
        ? selected.plant.locked
        : false
  const roomTransformUnavailable = (!!selected && selected.kind !== 'room') || selectedLocked
  const metrics = useMemo(() => calculateMetrics(project), [project])
  const constructionArea = project.plot.parcels.filter((parcel) => parcel.landRole === 'construction').reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)
  const agriculturalArea = project.plot.parcels.filter((parcel) => parcel.landRole === 'agricultural').reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)
  const season = useMemo(() => analyzeSeason(project, [month])[0], [project, month])
  const latestVariant = variants.at(-1)
  const mainHouse = project.buildings.find((building) => building.kind === 'house')
  const architecturalStyle = mainHouse?.architecturalStyle ?? 'classic'

  const safe = (action: () => unknown | Promise<unknown>) => Promise.resolve().then(action).catch((error) => setToast(error instanceof Error ? error.message : 'Action failed.'))
  const runExport = (kind: 'json' | 'glb' | 'png', action: () => unknown | Promise<unknown>) => {
    if (exporting) return
    setExporting(kind)
    safe(action).finally(() => setExporting(null))
  }
  const applyArchitecturalStyle = (style: ArchitecturalStyle) => safe(() => {
    if (!mainHouse || mainHouse.architecturalStyle === style) return
    commitCommand({ type: 'building.update', action: 'set-style', buildingRef: mainHouse.ref, architecturalStyle: style })
    setViewMode('realistic')
    setToast(`${style[0].toUpperCase()}${style.slice(1)} house style applied. Use Undo to return.`)
  })
  const roomCommand = (input: Partial<Extract<ProjectCommand, { type: 'room.update' }>>) => {
    if (!selected || selected.kind !== 'room') return
    safe(() => commitCommand({ type: 'room.update', action: 'resize', buildingRef: selected.buildingRef, floorRef: selected.floorRef, roomRef: selected.room.ref, ...input }))
  }
  const createFeatureVariant = (kind: 'floor' | 'garage' | 'garden') => safe(() => {
    if (kind === 'floor') createVariant('Upper floor concept', [{ type: 'floor.update', action: 'add', buildingRef: 'house/main', floorRef: `floor/upper-${project.revision}`, name: 'Upper floor', heightM: 2.9 }])
    if (kind === 'garage') createVariant('Attached garage concept', [{ type: 'garage.update', action: 'add', garageRef: `garage/attached-${project.revision}`, mode: 'attached', position: { x: 10, z: -2 }, widthM: 6.2, depthM: 6.8, heightM: 2.8 }])
    if (kind === 'garden') createVariant('Low-water garden concept', [{ type: 'garden.plan', goals: ['low water', 'family lawn', 'year-round interest', 'vegetable garden'], preserveRefs: ['zone/terrace', 'plant/apple'], waterPreference: 'low' }])
  })

  const top = height / 2 - 44
  const left = -width / 2 + 20
  const right = width / 2 - 20
  const bottom = -height / 2 + 34
  const compactHeader = width < 1180

  return <>
    <OrthographicCamera makeDefault manual position={[0, 0, 100]} left={-width / 2} right={width / 2} top={height / 2} bottom={-height / 2} near={0.1} far={200} />

    <Panel x={0} y={top} width={width - 40} height={64} opacity={0.88} radius={18}>
      <group position={[-width / 2 + 128, 8, 3]}><TextSprite text="House_Web_MCP" width={196} height={27} color="#f1f5ef" fontSize={82} align="left" /></group>
      <group position={[-width / 2 + 128, -15, 3]}><TextSprite text={`ZIELONKI  ·  /3 BUILD ${constructionArea.toLocaleString('en')} m²  ·  R${project.revision}`} width={260} height={16} color="#8fa298" fontSize={65} align="left" /></group>
      <CanvasButton label="Technical" x={-92} y={0} width={108} height={44} active={viewMode === 'technical'} onClick={() => setViewMode('technical')} />
      <CanvasButton label="Realistic" x={26} y={0} width={108} height={44} active={viewMode === 'realistic'} onClick={() => setViewMode('realistic')} />
      <CanvasButton label="‹" x={151} y={0} width={44} height={44} onClick={() => setMonth(month - 1)} />
      <group position={[208, 0, 3]}><TextSprite text={new Date(2026, month - 1, 1).toLocaleString('en', { month: 'long' })} width={78} height={23} color="#dce7e0" fontSize={76} /></group>
      <CanvasButton label="›" x={265} y={0} width={44} height={44} onClick={() => setMonth(month + 1)} />
      <CanvasButton label="Floors F" x={329} y={0} width={78} height={44} active={explodeFloors} onClick={() => setExplodeFloors(!explodeFloors)} />
      <CanvasButton label="?" x={400} y={0} width={44} height={44} active={helpOpen} onClick={() => setHelpOpen(!helpOpen)} />
      <mesh position={[compactHeader ? width / 2 - 45 : width / 2 - 190, 0, 4]}><circleGeometry args={[4, 24]} /><meshBasicMaterial color={webMcpAvailable ? '#c6ed76' : '#d78b65'} depthTest={false} /></mesh>
      {!compactHeader && <group position={[width / 2 - 98, 0, 3]}><TextSprite text={webMcpAvailable ? 'WebMCP ready' : 'WebMCP unavailable'} width={164} height={22} color={webMcpAvailable ? '#dbeeb6' : '#e7aa7d'} fontSize={68} align="right" /></group>}
    </Panel>

    <Panel x={left + 47} y={18} width={94} height={420} opacity={0.86} radius={18}>
      <group position={[0, 181, 3]}><TextSprite text="MODEL" width={66} height={19} color="#82958b" fontSize={68} /></group>
      <CanvasButton label="Move  T" x={0} y={137} width={72} height={44} active={!selectedLocked && transformMode === 'translate'} disabled={selectedLocked} onClick={() => setTransformMode('translate')} />
      <CanvasButton label="Scale  S" x={0} y={87} width={72} height={44} active={!roomTransformUnavailable && transformMode === 'scale'} disabled={roomTransformUnavailable} onClick={() => setTransformMode('scale')} />
      <CanvasButton label="Rotate  R" x={0} y={37} width={72} height={44} active={!roomTransformUnavailable && transformMode === 'rotate'} disabled={roomTransformUnavailable} onClick={() => setTransformMode('rotate')} />
      <CanvasButton label="+ Floor" x={0} y={-23} width={72} height={44} onClick={() => createFeatureVariant('floor')} />
      <CanvasButton label="+ Garage" x={0} y={-73} width={72} height={44} onClick={() => createFeatureVariant('garage')} />
      <CanvasButton label="Garden" x={0} y={-123} width={72} height={44} onClick={() => createFeatureVariant('garden')} />
      <CanvasButton label="Undo" x={0} y={-175} width={72} height={44} disabled={!history.length} onClick={() => safe(() => { undo() })} />
    </Panel>

    <Panel x={left + 130} y={-height / 2 + 118} width={260} height={88} opacity={0.9} radius={16}>
      <group position={[0, 22, 3]}><TextSprite text="HOUSE STYLE" width={224} height={17} color="#82958b" fontSize={66} /></group>
      <CanvasButton label="Classic" x={-84} y={-17} width={76} height={34} active={architecturalStyle === 'classic'} onClick={() => applyArchitecturalStyle('classic')} />
      <CanvasButton label="Future" x={0} y={-17} width={76} height={34} active={architecturalStyle === 'futuristic'} onClick={() => applyArchitecturalStyle('futuristic')} />
      <CanvasButton label="Barn" x={84} y={-17} width={76} height={34} active={architecturalStyle === 'barn'} onClick={() => applyArchitecturalStyle('barn')} />
    </Panel>

    <Panel x={right - 146} y={18} width={292} height={420} opacity={0.88} radius={18}>
      <group position={[0, 178, 3]}><TextSprite text="INSPECTOR" width={236} height={20} color="#82958b" fontSize={68} align="left" /></group>
      {selected?.kind === 'room' ? <>
        <group position={[0, 138, 3]}><TextSprite text={selected.room.name} width={236} height={32} color="#f2f5f1" fontSize={90} align="left" /></group>
        <group position={[0, 108, 3]}><TextSprite text={selected.room.ref} width={236} height={18} color="#81948a" fontSize={70} align="left" /></group>
        <group position={[0, 67, 3]}><TextSprite text={`${selected.room.widthM.toFixed(1)} × ${selected.room.depthM.toFixed(1)} × ${selected.room.heightM.toFixed(1)} m`} width={236} height={27} color="#d3dfd8" fontSize={78} align="left" /></group>
        <group position={[0, 38, 3]}><TextSprite text={`${(selected.room.widthM * selected.room.depthM).toFixed(1)} m²  ·  ${selected.room.ceilingType}`} width={236} height={20} color="#8fa298" fontSize={68} align="left" /></group>
        <CanvasButton label="Width +" x={-61} y={-10} width={112} height={44} onClick={() => roomCommand({ widthM: selected.room.widthM + 0.5 })} disabled={selected.room.locked} />
        <CanvasButton label="Width −" x={61} y={-10} width={112} height={44} onClick={() => roomCommand({ widthM: Math.max(1, selected.room.widthM - 0.5) })} disabled={selected.room.locked} />
        <CanvasButton label="Depth +" x={-61} y={-60} width={112} height={44} onClick={() => roomCommand({ depthM: selected.room.depthM + 0.5 })} disabled={selected.room.locked} />
        <CanvasButton label="Depth −" x={61} y={-60} width={112} height={44} onClick={() => roomCommand({ depthM: Math.max(1, selected.room.depthM - 0.5) })} disabled={selected.room.locked} />
        <CanvasButton label="Lower ceiling" x={-61} y={-110} width={112} height={44} onClick={() => roomCommand({ action: 'set-ceiling', heightM: Math.max(2.2, selected.room.heightM - 0.25), ceilingType: 'lowered' })} disabled={selected.room.locked} />
        <CanvasButton label="Mezzanine" x={61} y={-110} width={112} height={44} onClick={() => safe(() => createVariant('Mezzanine concept', [{ type: 'mezzanine.update', action: 'add', buildingRef: selected.buildingRef, floorRef: selected.floorRef, roomRef: selected.room.ref, mezzanineRef: `${selected.room.ref}/mezzanine-${project.revision}` }]))} disabled={selected.room.locked || selected.room.mezzanines.length > 0} />
        <group position={[0, -151, 3]}><TextSprite text={selected.room.locked ? 'Locked — edits are disabled' : 'Drag the gizmo or use exact controls'} width={236} height={19} color={selected.room.locked ? '#e5a071' : '#81948a'} fontSize={70} align="left" /></group>
      </> : selected?.kind === 'zone' ? <>
        <group position={[0, 138, 3]}><TextSprite text={selected.zone.name} width={236} height={32} color="#f2f5f1" fontSize={90} align="left" /></group>
        <group position={[0, 108, 3]}><TextSprite text={selected.zone.ref} width={236} height={18} color="#81948a" fontSize={70} align="left" /></group>
        <group position={[0, 66, 3]}><TextSprite text={`${selected.zone.kind.replace('-', ' ')}  ·  ${(selected.zone.widthM * selected.zone.depthM).toFixed(1)} m²`} width={236} height={26} color="#d3dfd8" fontSize={76} align="left" /></group>
        <group position={[0, 34, 3]}><TextSprite text={`${selected.zone.widthM.toFixed(1)} × ${selected.zone.depthM.toFixed(1)} m`} width={236} height={21} color="#8fa298" fontSize={70} align="left" /></group>
        <CanvasButton label="Move  T" x={0} y={-24} width={236} height={44} active={!selected.zone.locked && transformMode === 'translate'} disabled={selected.zone.locked} onClick={() => setTransformMode('translate')} />
        <group position={[0, -79, 3]}><TextSprite text={selected.zone.locked ? 'Locked — this zone is preserved' : 'Drag on the site · snaps every 0.5 m'} width={236} height={21} color={selected.zone.locked ? '#e5a071' : '#8fa298'} fontSize={70} align="left" /></group>
      </> : selected?.kind === 'plant' ? <>
        <group position={[0, 138, 3]}><TextSprite text={selected.plant.name} width={236} height={32} color="#f2f5f1" fontSize={88} align="left" /></group>
        <group position={[0, 108, 3]}><TextSprite text={selected.plant.species} width={236} height={19} color="#8fb9aa" fontSize={72} align="left" /></group>
        <group position={[0, 67, 3]}><TextSprite text={`${selected.plant.kind}  ·  ${selected.plant.matureHeightM.toFixed(1)} m high`} width={236} height={25} color="#d3dfd8" fontSize={76} align="left" /></group>
        <group position={[0, 36, 3]}><TextSprite text={`${selected.plant.canopyM.toFixed(1)} m canopy  ·  ${selected.plant.sunNeed} sun`} width={236} height={21} color="#8fa298" fontSize={70} align="left" /></group>
        <CanvasButton label="Move  T" x={0} y={-24} width={236} height={44} active={!selected.plant.locked && transformMode === 'translate'} disabled={selected.plant.locked} onClick={() => setTransformMode('translate')} />
        <group position={[0, -79, 3]}><TextSprite text={selected.plant.locked ? 'Locked — this plant is preserved' : 'Drag on the site · snaps every 0.5 m'} width={236} height={21} color={selected.plant.locked ? '#e5a071' : '#8fa298'} fontSize={70} align="left" /></group>
      </> : <>
        <group position={[0, 140, 3]}><TextSprite text="Zielonki survey site" width={236} height={30} color="#f2f5f1" fontSize={86} align="left" /></group>
        <group position={[0, 105, 3]}><TextSprite text="54/3  ·  55/3  ·  58/3" width={236} height={22} color="#9ad8ca" fontSize={72} align="left" /></group>
        <group position={[0, 70, 3]}><TextSprite text={`${constructionArea.toLocaleString('en')} m²  CONSTRUCTION`} width={236} height={24} color="#d3dfd8" fontSize={74} align="left" /></group>
        <group position={[0, 40, 3]}><TextSprite text={`${agriculturalArea.toLocaleString('en')} m²  AGRICULTURAL /4`} width={236} height={21} color="#c5bd91" fontSize={68} align="left" /></group>
        <group position={[0, -8, 3]}><TextSprite text="SOIL REVIEW REQUIRED" width={236} height={22} color="#f0a4c4" fontSize={72} align="left" /></group>
        <group position={[0, -39, 3]}><TextSprite text="Weak-bearing ground to ~4.0 m" width={236} height={20} color="#d8c4cc" fontSize={66} align="left" /></group>
        <group position={[0, -67, 3]}><TextSprite text="Groundwater 1.6–2.3 m below ground" width={236} height={20} color="#d8c4cc" fontSize={63} align="left" /></group>
        <group position={[0, -95, 3]}><TextSprite text="Micropile concept: gravel at ≥5.5 m" width={236} height={20} color="#d8c4cc" fontSize={63} align="left" /></group>
        <group position={[0, -139, 3]}><TextSprite text="Concept only · verify with project engineers" width={236} height={18} color="#81948a" fontSize={62} align="left" /></group>
      </>}
    </Panel>

    <Panel x={-78} y={bottom} width={Math.min(width - 530, 780)} height={52} opacity={0.88} radius={16}>
      <group position={[-Math.min(width - 510, 790) / 2 + 130, 0, 3]}><TextSprite text={`${new Date(2026, month - 1, 1).toLocaleString('en', { month: 'short' }).toUpperCase()}  ${season.representativeSunHours}h SUN  ${season.waterBalanceMm > 0 ? '+' : ''}${season.waterBalanceMm}mm WATER`} width={240} height={25} color="#9db1a6" fontSize={66} align="left" /></group>
      {latestVariant ? <>
        <group position={[-30, 0, 3]}><TextSprite text={`${latestVariant.label.toUpperCase()}  /  ${latestVariant.issues.length} ISSUES`} width={310} height={25} color="#c9f1a4" fontSize={66} /></group>
        <CanvasButton label="APPLY" x={240} y={0} width={78} active onClick={() => safe(() => confirmationVariantRef ? resolveVariantConfirmation(true) : applyVariant(latestVariant.ref))} />
        <CanvasButton label="DISCARD" x={326} y={0} width={84} danger onClick={() => confirmationVariantRef ? resolveVariantConfirmation(false) : discardVariant(latestVariant.ref)} />
      </> : <group position={[45, 0, 3]}><TextSprite text="NO ACTIVE VARIANT — ASK AN AGENT OR USE THE LEFT TOOLS" width={420} height={24} color="#73877c" fontSize={61} /></group>}
    </Panel>

    <Panel x={right - 146} y={-height / 2 + 91} width={292} height={108} opacity={0.86} radius={16}>
      <CanvasButton label={exporting === 'json' ? 'JSON…' : 'JSON'} x={-94} y={24} width={82} height={44} disabled={exporting !== null} onClick={() => runExport('json', () => { exportProjectJson(project) })} />
      <CanvasButton label={exporting === 'glb' ? 'GLB…' : 'GLB'} x={0} y={24} width={82} height={44} disabled={exporting !== null} onClick={() => runExport('glb', exportSceneGlb)} />
      <CanvasButton label={exporting === 'png' ? 'PNG…' : 'PNG'} x={94} y={24} width={82} height={44} disabled={exporting !== null} onClick={() => runExport('png', () => { exportScenePng() })} />
      <CanvasButton label="Import project" x={0} y={-29} width={270} height={44} disabled={exporting !== null} onClick={() => window.dispatchEvent(new Event('house-web-mcp:import'))} />
    </Panel>

    {toast && <Panel x={0} y={top - 58} width={Math.min(590, width - 470)} height={36} opacity={0.82} radius={18}>
      <group position={[0, 0, 8]}><TextSprite text={toast} width={Math.min(550, width - 510)} height={21} color="#e7eee9" fontSize={76} /></group>
    </Panel>}

    {helpOpen && !confirmationVariantRef && !pendingExport && <Panel x={0} y={0} width={530} height={332} opacity={0.97} radius={22}>
      <group position={[0, 128, 4]}><TextSprite text="Controls" width={458} height={34} color="#f2f5f1" fontSize={94} align="left" /></group>
      <group position={[0, 92, 4]}><TextSprite text="Everything stays in the 3D workspace" width={458} height={20} color="#8fa298" fontSize={70} align="left" /></group>
      <group position={[0, 47, 4]}><TextSprite text="NAVIGATE    drag orbit  ·  right-drag pan  ·  wheel zoom" width={458} height={22} color="#d3dfd8" fontSize={68} align="left" /></group>
      <group position={[0, 14, 4]}><TextSprite text="EDIT             T move  ·  S scale  ·  R rotate  ·  Esc clear" width={458} height={22} color="#d3dfd8" fontSize={68} align="left" /></group>
      <group position={[0, -19, 4]}><TextSprite text="VIEW             1 technical  ·  2 realistic  ·  F floors" width={458} height={22} color="#d3dfd8" fontSize={68} align="left" /></group>
      <group position={[0, -52, 4]}><TextSprite text="SEASON        [ previous month  ·  ] next month" width={458} height={22} color="#d3dfd8" fontSize={68} align="left" /></group>
      <group position={[0, -85, 4]}><TextSprite text="HISTORY        Ctrl / Cmd + Z undo" width={458} height={22} color="#d3dfd8" fontSize={68} align="left" /></group>
      <CanvasButton label="Close" x={0} y={-132} width={132} height={44} active onClick={() => setHelpOpen(false)} />
    </Panel>}

    {(confirmationVariantRef || pendingExport) && <Panel x={0} y={0} width={430} height={188} opacity={0.98}>
      <group position={[0, 55, 4]}><TextSprite text={pendingExport ? `EXPORT ${pendingExport.toUpperCase()}?` : 'APPLY THIS 3D VARIANT?'} width={360} height={34} color="#eff8f1" fontSize={86} /></group>
      <group position={[0, 18, 4]}><TextSprite text={pendingExport ? 'An agent requested a file download.' : 'Review the translucent model before committing.'} width={370} height={24} color="#9eb1a6" fontSize={62} /></group>
      <CanvasButton label="CONFIRM" x={-64} y={-43} width={112} active onClick={() => pendingExport ? safe(() => resolveExportConfirmation(true)) : resolveVariantConfirmation(true)} />
      <CanvasButton label="REJECT" x={64} y={-43} width={112} danger onClick={() => pendingExport ? safe(() => resolveExportConfirmation(false)) : resolveVariantConfirmation(false)} />
    </Panel>}
  </>
}

export function StudioHud() {
  return <Hud renderPriority={1}><StudioHudContent /></Hud>
}
