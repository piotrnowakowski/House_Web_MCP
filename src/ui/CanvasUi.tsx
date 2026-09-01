import { Hud, OrthographicCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, LinearFilter } from 'three'
import { calculateMetrics } from '../domain/commands'
import { analyzeSeason } from '../domain/seasonal'
import type { ProjectCommand, RoomModel } from '../domain/types'
import { exportProjectJson, exportSceneGlb, exportScenePng } from '../services/export'
import { resolveExportConfirmation, resolveVariantConfirmation } from '../services/webmcp'
import { useStudioStore } from '../state/store'

interface TextSpriteProps {
  text: string
  width?: number
  height?: number
  color?: string
  fontSize?: number
  align?: CanvasTextAlign
  opacity?: number
}

const useLabelTexture = (text: string, color: string, fontSize: number, align: CanvasTextAlign) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = color
    context.font = `600 ${fontSize}px Inter, Segoe UI, sans-serif`
    context.textAlign = align
    context.textBaseline = 'middle'
    context.fillText(text, align === 'left' ? 24 : align === 'right' ? 1000 : 512, 128, 980)
    const result = new CanvasTexture(canvas)
    result.minFilter = LinearFilter
    result.generateMipmaps = false
    result.needsUpdate = true
    return result
  }, [text, color, fontSize, align])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

export function TextSprite({ text, width = 180, height = 34, color = '#edf5ef', fontSize = 92, align = 'center', opacity = 1 }: TextSpriteProps) {
  const texture = useLabelTexture(text, color, fontSize, align)
  return <sprite scale={[width, height, 1]} renderOrder={1000}>
    <spriteMaterial map={texture} transparent opacity={opacity} depthTest={false} depthWrite={false} />
  </sprite>
}

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

function CanvasButton({ label, x, y, width = 104, height = 34, active = false, danger = false, disabled = false, onClick }: CanvasButtonProps) {
  const [hovered, setHovered] = useState(false)
  const fill = danger ? '#5f2d2b' : active ? '#b8ed89' : hovered ? '#314039' : '#202a26'
  const text = active ? '#172017' : disabled ? '#728078' : '#edf5ef'
  return <group position={[x, y, 2]}>
    <mesh
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = disabled ? 'not-allowed' : 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
      onClick={(event) => { event.stopPropagation(); if (!disabled) onClick() }}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={fill} transparent opacity={disabled ? 0.55 : 0.96} depthTest={false} depthWrite={false} />
    </mesh>
    <group position={[0, 0, 1]}><TextSprite text={label} width={width - 10} height={height * 0.66} color={text} fontSize={82} /></group>
  </group>
}

function Panel({ x, y, width, height, opacity = 0.94, children }: { x: number; y: number; width: number; height: number; opacity?: number; children?: React.ReactNode }) {
  return <group position={[x, y, 0]}>
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color="#111816" transparent opacity={opacity} depthTest={false} depthWrite={false} />
    </mesh>
    {children}
  </group>
}

const findSelectedRoom = (ref: string | null): { room: RoomModel; buildingRef: string; floorRef: string } | null => {
  if (!ref) return null
  const project = useStudioStore.getState().project
  for (const building of project.buildings) for (const floor of building.floors) {
    const room = floor.rooms.find((item) => item.ref === ref)
    if (room) return { room, buildingRef: building.ref, floorRef: floor.ref }
  }
  return null
}

function StudioHudContent() {
  const { width, height } = useThree((state) => state.size)
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
  const selected = findSelectedRoom(selectedRef)
  const metrics = useMemo(() => calculateMetrics(project), [project])
  const season = useMemo(() => analyzeSeason(project, [month])[0], [project, month])
  const latestVariant = variants.at(-1)

  const safe = (action: () => unknown | Promise<unknown>) => Promise.resolve().then(action).catch((error) => setToast(error instanceof Error ? error.message : 'Action failed.'))
  const roomCommand = (input: Partial<Extract<ProjectCommand, { type: 'room.update' }>>) => {
    if (!selected) return
    safe(() => commitCommand({ type: 'room.update', action: 'resize', buildingRef: selected.buildingRef, floorRef: selected.floorRef, roomRef: selected.room.ref, ...input }))
  }
  const createFeatureVariant = (kind: 'floor' | 'garage' | 'garden') => safe(() => {
    if (kind === 'floor') createVariant('Upper floor concept', [{ type: 'floor.update', action: 'add', buildingRef: 'house/main', floorRef: `floor/upper-${project.revision}`, name: 'Upper floor', heightM: 2.9 }])
    if (kind === 'garage') createVariant('Attached garage concept', [{ type: 'garage.update', action: 'add', garageRef: `garage/attached-${project.revision}`, mode: 'attached', position: { x: 10, z: -2 }, widthM: 6.2, depthM: 6.8, heightM: 2.8 }])
    if (kind === 'garden') createVariant('Low-water garden concept', [{ type: 'garden.plan', goals: ['low water', 'family lawn', 'year-round interest', 'vegetable garden'], preserveRefs: ['zone/terrace', 'plant/apple'], waterPreference: 'low' }])
  })

  const top = height / 2 - 34
  const left = -width / 2 + 22
  const right = width / 2 - 22
  const bottom = -height / 2 + 26

  return <>
    <OrthographicCamera makeDefault manual position={[0, 0, 100]} left={-width / 2} right={width / 2} top={height / 2} bottom={-height / 2} near={0.1} far={200} />

    <Panel x={0} y={top} width={width - 28} height={52} opacity={0.91}>
      <group position={[-width / 2 + 132, 0, 3]}><TextSprite text="House_Web_MCP" width={218} height={29} color="#dff5cf" fontSize={82} align="left" /></group>
      <group position={[-width / 2 + 326, -1, 3]}><TextSprite text={`R${project.revision}  /  ${metrics.homeAreaM2} m²`} width={150} height={24} color="#8fa398" fontSize={72} align="left" /></group>
      <CanvasButton label="TECHNICAL" x={-92} y={0} width={106} active={viewMode === 'technical'} onClick={() => setViewMode('technical')} />
      <CanvasButton label="REALISTIC" x={24} y={0} width={106} active={viewMode === 'realistic'} onClick={() => setViewMode('realistic')} />
      <CanvasButton label="PREV" x={143} y={0} width={54} onClick={() => setMonth(month - 1)} />
      <group position={[211, 0, 3]}><TextSprite text={new Date(2026, month - 1, 1).toLocaleString('en', { month: 'long' }).toUpperCase()} width={82} height={25} color="#d8e3dc" fontSize={76} /></group>
      <CanvasButton label="NEXT" x={279} y={0} width={54} onClick={() => setMonth(month + 1)} />
      <CanvasButton label="EXPLODE" x={363} y={0} width={94} active={explodeFloors} onClick={() => setExplodeFloors(!explodeFloors)} />
      <group position={[width / 2 - 118, 0, 3]}><TextSprite text={webMcpAvailable ? 'WEBMCP READY' : 'WEBMCP UNAVAILABLE'} width={180} height={24} color={webMcpAvailable ? '#b8ed89' : '#e7aa7d'} fontSize={66} align="right" /></group>
    </Panel>

    <Panel x={left + 50} y={30} width={100} height={350}>
      <group position={[0, 150, 3]}><TextSprite text="TOOLS" width={74} height={22} color="#8fa398" fontSize={66} /></group>
      <CanvasButton label="MOVE" x={0} y={108} width={76} active={transformMode === 'translate'} onClick={() => setTransformMode('translate')} />
      <CanvasButton label="SCALE" x={0} y={68} width={76} active={transformMode === 'scale'} onClick={() => setTransformMode('scale')} />
      <CanvasButton label="ROTATE" x={0} y={28} width={76} active={transformMode === 'rotate'} onClick={() => setTransformMode('rotate')} />
      <CanvasButton label="+ FLOOR" x={0} y={-28} width={76} onClick={() => createFeatureVariant('floor')} />
      <CanvasButton label="+ GARAGE" x={0} y={-68} width={76} onClick={() => createFeatureVariant('garage')} />
      <CanvasButton label="GARDEN" x={0} y={-108} width={76} onClick={() => createFeatureVariant('garden')} />
      <CanvasButton label="UNDO" x={0} y={-150} width={76} disabled={!history.length} onClick={() => safe(() => { undo() })} />
    </Panel>

    <Panel x={right - 137} y={25} width={274} height={396}>
      <group position={[0, 165, 3]}><TextSprite text="INSPECTOR" width={222} height={26} color="#8fa398" fontSize={70} align="left" /></group>
      {selected ? <>
        <group position={[0, 127, 3]}><TextSprite text={selected.room.name.toUpperCase()} width={222} height={31} color="#edf5ef" fontSize={86} align="left" /></group>
        <group position={[0, 97, 3]}><TextSprite text={selected.room.ref} width={222} height={22} color="#9aada2" fontSize={78} align="left" /></group>
        <group position={[0, 57, 3]}><TextSprite text={`${selected.room.widthM.toFixed(1)} × ${selected.room.depthM.toFixed(1)} × ${selected.room.heightM.toFixed(1)} m`} width={222} height={28} color="#c8d7ce" fontSize={74} align="left" /></group>
        <group position={[0, 28, 3]}><TextSprite text={`${(selected.room.widthM * selected.room.depthM).toFixed(1)} m²  /  ${selected.room.ceilingType}`} width={222} height={24} color="#8fa398" fontSize={66} align="left" /></group>
        <CanvasButton label="WIDTH +" x={-57} y={-20} width={104} onClick={() => roomCommand({ widthM: selected.room.widthM + 0.5 })} disabled={selected.room.locked} />
        <CanvasButton label="WIDTH −" x={57} y={-20} width={104} onClick={() => roomCommand({ widthM: Math.max(1, selected.room.widthM - 0.5) })} disabled={selected.room.locked} />
        <CanvasButton label="DEPTH +" x={-57} y={-62} width={104} onClick={() => roomCommand({ depthM: selected.room.depthM + 0.5 })} disabled={selected.room.locked} />
        <CanvasButton label="DEPTH −" x={57} y={-62} width={104} onClick={() => roomCommand({ depthM: Math.max(1, selected.room.depthM - 0.5) })} disabled={selected.room.locked} />
        <CanvasButton label="CEILING −" x={-57} y={-104} width={104} onClick={() => roomCommand({ action: 'set-ceiling', heightM: Math.max(2.2, selected.room.heightM - 0.25), ceilingType: 'lowered' })} disabled={selected.room.locked} />
        <CanvasButton label="MEZZANINE" x={57} y={-104} width={104} onClick={() => safe(() => createVariant('Mezzanine concept', [{ type: 'mezzanine.update', action: 'add', buildingRef: selected.buildingRef, floorRef: selected.floorRef, roomRef: selected.room.ref, mezzanineRef: `${selected.room.ref}/mezzanine-${project.revision}` }]))} disabled={selected.room.locked || selected.room.mezzanines.length > 0} />
        <group position={[0, -145, 3]}><TextSprite text={selected.room.locked ? 'LOCKED — agent and manual edits disabled' : 'Drag the gizmo or use exact controls'} width={222} height={22} color={selected.room.locked ? '#e7aa7d' : '#9aada2'} fontSize={76} align="left" /></group>
      </> : <group position={[0, 60, 3]}><TextSprite text="SELECT A 3D ELEMENT" width={220} height={28} color="#8fa398" fontSize={72} /></group>}
    </Panel>

    <Panel x={-78} y={bottom} width={Math.min(width - 510, 790)} height={48} opacity={0.92}>
      <group position={[-Math.min(width - 510, 790) / 2 + 130, 0, 3]}><TextSprite text={`${new Date(2026, month - 1, 1).toLocaleString('en', { month: 'short' }).toUpperCase()}  ${season.representativeSunHours}h SUN  ${season.waterBalanceMm > 0 ? '+' : ''}${season.waterBalanceMm}mm WATER`} width={240} height={25} color="#9db1a6" fontSize={66} align="left" /></group>
      {latestVariant ? <>
        <group position={[-30, 0, 3]}><TextSprite text={`${latestVariant.label.toUpperCase()}  /  ${latestVariant.issues.length} ISSUES`} width={310} height={25} color="#c9f1a4" fontSize={66} /></group>
        <CanvasButton label="APPLY" x={240} y={0} width={78} active onClick={() => safe(() => confirmationVariantRef ? resolveVariantConfirmation(true) : applyVariant(latestVariant.ref))} />
        <CanvasButton label="DISCARD" x={326} y={0} width={84} danger onClick={() => confirmationVariantRef ? resolveVariantConfirmation(false) : discardVariant(latestVariant.ref)} />
      </> : <group position={[45, 0, 3]}><TextSprite text="NO ACTIVE VARIANT — ASK AN AGENT OR USE THE LEFT TOOLS" width={420} height={24} color="#73877c" fontSize={61} /></group>}
    </Panel>

    <Panel x={right - 137} y={-height / 2 + 77} width={274} height={78} opacity={0.9}>
      <CanvasButton label="JSON" x={-90} y={12} width={76} onClick={() => safe(() => { exportProjectJson(project) })} />
      <CanvasButton label="GLB" x={0} y={12} width={76} onClick={() => safe(exportSceneGlb)} />
      <CanvasButton label="PNG" x={90} y={12} width={76} onClick={() => safe(() => { exportScenePng() })} />
      <CanvasButton label="IMPORT PROJECT" x={0} y={-27} width={256} height={28} onClick={() => window.dispatchEvent(new Event('house-web-mcp:import'))} />
    </Panel>

    {toast && <Panel x={0} y={top - 74} width={Math.min(700, width - 430)} height={34} opacity={0.86}>
      <group position={[0, 0, 8]}><TextSprite text={toast.toUpperCase()} width={Math.min(660, width - 470)} height={24} color="#e6f0e9" fontSize={84} /></group>
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
