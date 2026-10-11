import { interiorMessage } from './interiorLocale'
import { useRenderQuality } from '../scene/renderingPreferences'
import { floorGeometry } from './floorGeometry'
import { Grid, Html, Line } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoxGeometry, DoubleSide, ExtrudeGeometry, Line3, Object3D, OrthographicCamera, Plane, PlaneGeometry, Raycaster, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { atticWallProfile, wallProfileHeightAt } from '../domain/attic'
import { useDirectManipulation } from './useDirectManipulation'
import { pointInPolygon, polygonCentroid, spaceFootprint, wallLength } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { gablePlanGuides } from '../domain/gablePlanGuides'
import { gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { interiorCorners } from '../domain/interior'
import type { BuildingModel, InteriorFinish, InteriorItem, Polygon2, ProjectV2, ProjectCommand, StoreyModel, Vec2, WallModel } from '../domain/types'
import { interiorFloorTexture } from '../scene/materialCatalog'
import { TexturedMaterial } from '../scene/materials'
import { ProductModel } from './ProductModel'
import { FinishMaterial } from './FinishMaterial'
import { RoomCeiling } from './RoomCeiling'
import { GlazedGable } from '../scene/GlazedGable'
import { polygonBounds } from '../domain/geometry'
import { Staircase } from './Staircase'
import { InteriorCamera, type InteriorView } from './InteriorCamera'
import { placementWarnings, wallDistances, type SnapSettings } from '../domain/interiorPlacement'
import { itemFitsFloor } from '../domain/interior'
import { interiorMeasurementEdges, measurementScreenPoint, snapMeasurementPoint } from '../scene/measurementSnapping'
import { MeasurementPoint } from '../scene/MeasurementPoint'
import { PlanLabelLayout } from './PlanLabelLayout'

function RoomLabel({ centre, name, area, width, depth, plan, selected }: {
  centre: Vec2; name: string; area: number; width: number; depth: number; plan: boolean; selected: boolean
}) {
  const label = useRef<HTMLDivElement>(null)
  const previous = useRef('')
  useFrame(({ camera, size }) => {
    if (!label.current) return
    const scale = camera instanceof OrthographicCamera ? camera.zoom * size.width / (camera.right - camera.left) : 1
    const availableWidth = Math.floor(width * scale - 12)
    const availableHeight = depth * scale - 24
    const visible = !plan || (availableWidth >= (selected ? 44 : 90) && availableHeight >= (selected ? 38 : 60))
    const cssWidth = plan ? `${Math.max(selected ? 80 : 44, Math.min(220, availableWidth))}px` : width < 3 ? '72px' : 'auto'
    const signature = `${visible}/${cssWidth}`
    if (signature === previous.current) return
    previous.current = signature
    label.current.dataset.spaceVisible = String(visible)
    label.current.style.visibility = visible ? 'visible' : 'hidden'
    label.current.style.width = 'max-content'
    label.current.style.maxWidth = cssWidth === 'auto' ? 'none' : cssWidth
  })
  return <Html center position={[centre.x, 0.06, centre.z]} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
    <div ref={label} data-plan-label={selected ? 35 : 20} title={name} className={`interior-room-label ${plan ? 'is-plan' : ''} ${selected ? 'selected' : ''}`} style={{ whiteSpace: 'normal' }}>
      <strong>{name}</strong><span>{area.toFixed(2)} m²</span>
    </div>
  </Html>
}

function Floor({ points, holes, slab, onPick, tiled = false, plan = false, finish, elevation = 0, onHover }: { points: Polygon2; holes?: Polygon2[]; slab?: Polygon2; onPick: (event: ThreeEvent<MouseEvent>) => void; onHover?: (point: Vec2) => void; tiled?: boolean; plan?: boolean; finish?: InteriorFinish; elevation?: number }) {
  const geometry = useMemo(() => floorGeometry(points, holes, slab), [points, holes, slab])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position-y={elevation} receiveShadow onClick={onPick} onPointerMove={onHover ? (event) => onHover({ x: event.point.x, z: event.point.z }) : undefined}>
    {finish ? <FinishMaterial finish={finish} /> : plan ? <meshBasicMaterial color='#fafaf7' side={DoubleSide} toneMapped={false} /> : tiled ? <meshStandardMaterial color='#b5b5ab' roughness={0.88} side={DoubleSide} /> : <TexturedMaterial asset={interiorFloorTexture.asset} color='#fff3df' roughness={0.8} side={DoubleSide} />}
  </mesh>
}

function WallFace({ width, height, finish, outline }: { width: number; height: number; finish: InteriorFinish; outline?: Vec2[] }) {
  const geometry = useMemo(() => {
    if (outline) return new ShapeGeometry(new Shape(outline.map((p) => new Vector2(p.x, p.z))))
    const result = new PlaneGeometry(width, height); const uv = result.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
    return result
  }, [width, height, outline])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow><FinishMaterial finish={finish} /></mesh>
}

function WallBody({ width, height, thickness, outline, plan }: { width: number; height: number; thickness: number; outline?: Vec2[]; plan: boolean }) {
  const geometry = useMemo(() => outline
    ? new ExtrudeGeometry(new Shape(outline.map((p) => new Vector2(p.x, p.z))), { depth: thickness, bevelEnabled: false }).translate(0, 0, -thickness / 2)
    : new BoxGeometry(width, height, thickness), [width, height, thickness, outline])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={plan ? '#283b36' : '#eceae2'} roughness={0.82} /></mesh>
}

function CutawayWall({ wall, profile, plan, fullHeight, selected, onSelect, onPick }: { wall: WallModel; profile?: Vec2[]; plan: boolean; fullHeight?: boolean; selected?: string | null; onSelect?: (ref: string) => void; onPick?: (point: Vec2) => void }) {
  const length = wallLength(wall); const height = plan ? 0.14 : fullHeight ? wall.heightM : Math.min(1.15, wall.heightM)
  const openings = [...wall.openings].sort((a, b) => a.offsetM - b.offsetM)
  let cursor = 0
  const pieces: { start: number; end: number; height: number; base?: number }[] = []
  for (const opening of openings) {
    const start = Math.max(cursor, opening.offsetM - opening.widthM / 2); const end = Math.min(length, opening.offsetM + opening.widthM / 2)
    if (start > cursor) pieces.push({ start: cursor, end: start, height })
    if (opening.kind === 'window' && opening.sillM > 0) pieces.push({ start, end, height: Math.min(height, opening.sillM) })
    if (fullHeight && opening.sillM + opening.heightM < height) pieces.push({ start, end, height: height - opening.sillM - opening.heightM, base: opening.sillM + opening.heightM })
    cursor = end
  }
  if (cursor < length) pieces.push({ start: cursor, end: length, height })
  const outlineFor = (piece: typeof pieces[number]) => {
    if (!fullHeight || !profile) return undefined
    const base = piece.base ?? 0, top = base + piece.height, middle = (piece.start + piece.end) / 2
    const xs = new Set([piece.start, piece.end, ...profile.filter((p) => p.x > piece.start && p.x < piece.end).map((p) => p.x)])
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1], b = profile[i]
      if ((a.z - top) * (b.z - top) < 0) { const x = a.x + (b.x - a.x) * (top - a.z) / (b.z - a.z); if (x > piece.start && x < piece.end) xs.add(x) }
    }
    return [{ x: piece.start - middle, z: -piece.height / 2 }, { x: piece.end - middle, z: -piece.height / 2 },
      ...[...xs].sort((a, b) => b - a).map((x) => ({ x: x - middle, z: Math.max(base, Math.min(top, wallProfileHeightAt(profile, x))) - base - piece.height / 2 }))]
  }
  return <group userData={{ dragTarget: { kind: 'wall', ref: wall.ref } }} position={[wall.start.x, 0.025, wall.start.z]} rotation={[0, -Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x), 0]} onClick={(event) => { if (event.delta >= 5) return; if (onPick) { event.stopPropagation(); onPick({ x: event.point.x, z: event.point.z }) } else if (onSelect) { event.stopPropagation(); onSelect(wall.ref) } }}>
    {openings.map(opening => <mesh key={`opening-hit-${opening.ref}`} userData={{ dragTarget: { kind: 'opening', ref: opening.ref } }} position={[opening.offsetM, plan ? .2 : Math.min(height, opening.sillM) + .12, 0]}><boxGeometry args={[opening.widthM, plan ? .35 : .25, Math.max(wall.thicknessM, .28)]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>)}
    {pieces.map((piece, index) => <mesh key={`hit-${index}`} position={[(piece.start + piece.end) / 2, height / 2, 0]}><boxGeometry args={[piece.end - piece.start, height, Math.max(wall.thicknessM, .28)]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>)}
    {pieces.map((piece, index) => <group key={`finish-${index}`} position={[(piece.start + piece.end) / 2, (piece.base ?? 0) + piece.height / 2, 0]}>
      {wall.faceFinishes?.left && <group position-z={wall.thicknessM / 2 + 0.001}><WallFace width={piece.end - piece.start} height={piece.height} outline={outlineFor(piece)} finish={wall.faceFinishes.left} /></group>}
      {wall.faceFinishes?.right && <group position-z={-wall.thicknessM / 2 - 0.001} rotation-y={Math.PI}><WallFace width={piece.end - piece.start} height={piece.height} outline={outlineFor(piece)?.map((p) => ({ x: -p.x, z: p.z })).reverse()} finish={wall.faceFinishes.right} /></group>}
    </group>)}
    {selected === wall.ref && <Line points={[[0, height + 0.03, 0], [length, height + 0.03, 0]]} color='#287466' lineWidth={5} />}
    {pieces.map((piece, index) => <group key={index}><group position={[(piece.start + piece.end) / 2, (piece.base ?? 0) + piece.height / 2, 0]}><WallBody width={piece.end - piece.start} height={piece.height} thickness={wall.thicknessM} outline={outlineFor(piece)} plan={plan} /></group><mesh position={[(piece.start + piece.end) / 2, 0.055, 0]}><boxGeometry args={[piece.end - piece.start, 0.09, wall.thicknessM + 0.022]} /><meshStandardMaterial color={plan ? '#283b36' : '#f7f3e9'} /></mesh></group>)}
    {openings.filter((o) => o.kind === 'window' || o.glazed).map((opening) => {
      const sill = plan ? 0.04 : Math.min(height, opening.sillM); const glassHeight = plan ? 0.035 : Math.max(0.035, Math.min(opening.heightM, height - sill))
      return <group key={opening.ref} userData={{ dragTarget: { kind: 'opening', ref: opening.ref } }} position={[opening.offsetM, 0, 0]} onClick={(event) => { if (onSelect && event.delta < 5) { event.stopPropagation(); onSelect(opening.ref) } }}><mesh position={[0, sill + glassHeight / 2, 0]}><boxGeometry args={[opening.widthM, glassHeight, 0.035]} /><meshPhysicalMaterial color='#adc8d0' transparent opacity={plan ? 0.8 : 0.25} roughness={0.08} depthWrite={false} /></mesh>{[-1, ...(opening.mullionFractions ?? [0.5]).map(f => 2 * f - 1), 1].map((x) => <mesh key={x} position={[x * opening.widthM / 2, sill + glassHeight / 2, 0]}><boxGeometry args={[0.045, glassHeight + 0.035, 0.055]} /><meshStandardMaterial color={opening.glazed ? '#121817' : '#f6f4ec'} /></mesh>)}{[-1, 1].map((y) => <mesh key={y} position={[0, sill + glassHeight / 2 + y * glassHeight / 2, 0]}><boxGeometry args={[opening.widthM, 0.04, 0.055]} /><meshStandardMaterial color={opening.glazed ? '#121817' : '#f6f4ec'} /></mesh>)}</group>
    })}
    {openings.filter((o) => o.kind === 'door' && !o.glazed).map((opening) => <group key={opening.ref} userData={{ dragTarget: { kind: 'opening', ref: opening.ref } }} position={[opening.offsetM + (opening.hinge === 'right' ? 1 : -1) * opening.widthM / 2, 0, 0]} scale={[opening.hinge === 'right' ? -1 : 1, 1, opening.swing === 'out' ? -1 : 1]} onClick={(event) => { if (onSelect && event.delta < 5) { event.stopPropagation(); onSelect(opening.ref) } }}>
      {plan && opening.widthM > 3 ? <Line points={[[0, 0.17, 0], [opening.widthM, 0.17, 0]]} color='#7e9496' lineWidth={2} /> : plan ? <><Line points={[[0, 0.17, 0], [0, 0.17, opening.widthM]]} color='#8c8677' lineWidth={1} /><Line points={Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI / 2; return [Math.cos(a) * opening.widthM, 0.17, Math.sin(a) * opening.widthM] as [number, number, number] })} color='#afa998' lineWidth={0.65} /></> : opening.widthM > 3 ? <group position={[opening.widthM / 2, 0.48, 0]}><mesh><boxGeometry args={[opening.widthM, 0.92, 0.065]} /><meshStandardMaterial color='#b7cbd1' roughness={0.5} /></mesh>{[0.15, 0.35, 0.55, 0.75].map((y) => <mesh key={y} position={[0, y - 0.46, 0.04]}><boxGeometry args={[opening.widthM, 0.015, 0.02]} /><meshStandardMaterial color='#e5eded' /></mesh>)}</group> : <group rotation={[0, -0.55, 0]}><mesh position={[opening.widthM / 2, (fullHeight ? opening.heightM : 1.04) / 2, 0]} castShadow><boxGeometry args={[opening.widthM - 0.04, fullHeight ? opening.heightM : 1.04, 0.045]} /><FinishMaterial finish={opening.finish ?? {presetId:'warm-wood',color:'#c6a477',rotationDegrees:0,tileM:1}} /></mesh><mesh position={[opening.widthM - 0.15, 0.55, 0.045]}><boxGeometry args={[0.1, 0.025, 0.05]} /><meshStandardMaterial color='#6d7876' metalness={0.65} roughness={0.3} /></mesh></group>}
    </group>)}
  </group>
}

interface Props {
  projectRef: string; project: ProjectV2; onCommit: (commands: ProjectCommand[]) => boolean; onNotice: (message: string, error?: boolean) => void; interactionDisabled?: boolean; selectOnly?: boolean; touchMoveEnabled?: boolean
  building: BuildingModel; storey: StoreyModel; plan: boolean; reset: number; selected: string | null; mode: 'select' | 'measure' | 'partition'; placing: boolean; snap: boolean; labels: boolean
  view?: InteriorView; selectedRefs?: string[]; mobile?: boolean; ghost?: InteriorItem | null; snapSettings?: SnapSettings; focusFootprint?: Polygon2; framingKey?: string | null; topInset?: number; wallPreview?: WallModel; bottomInset?: number; rightInset?: number; onHover?: (point: Vec2) => void
  dimensions: boolean; points: Vec2[]; onPointsChange: (points: Vec2[]) => void; onPick: (point: Vec2) => void; onSelect: (ref: string | null, additive?: boolean) => void
}

// Room mode keeps the next floor visible through the real slab openings.
// Its surfaces are context only: selecting/editing still targets the active floor.
function UpperRoomContext({ building, storey }: { building: BuildingModel; storey: StoreyModel }) {
  const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)!
  const rooms = building.spaces.filter(room => storey.spaceRefs.includes(room.ref))
  const root = useRef<Object3D>(null)
  useEffect(() => { root.current?.traverse(object => { object.raycast = () => {} }) }, [building, storey])
  return <group ref={root}>
    <Floor points={slab.footprint} holes={slab.holes} onPick={() => {}} />
    {[slab.footprint, ...(slab.holes ?? [])].flatMap((ring, ringIndex) => ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length]
      return <mesh key={`${ringIndex}/${i}`} position={[(a.x + b.x) / 2, -slab.thicknessM / 2, (a.z + b.z) / 2]} rotation-y={-Math.atan2(b.z - a.z, b.x - a.x)}>
        <boxGeometry args={[Math.hypot(b.x - a.x, b.z - a.z), slab.thicknessM, .01]} /><meshStandardMaterial color='#E9E5DC' />
      </mesh>
    }))}
    {building.walls.filter(wall => storey.wallRefs.includes(wall.ref)).map(wall =>
      <CutawayWall key={wall.ref} wall={wall} profile={atticWallProfile(building, wall)} plan={false} fullHeight />)}
    {rooms.map(room => room.ceilingFinish && <RoomCeiling key={room.ref} building={building} storey={storey} footprint={spaceFootprint(building, room)} finish={room.ceilingFinish} flatHeight={storey.clearHeightM} />)}
    <VoidCeilings building={building} storey={storey} />
  </group>
}

function VoidCeilings({ building, storey }: { building: BuildingModel; storey: StoreyModel }) {
  if (storey.kneeWallHeightM === undefined) return null
  const slab = building.slabs.find(s => s.ref === storey.baseSlabRef)
  const finish: InteriorFinish = { presetId: 'warm-white', color: '#F5F1E8', rotationDegrees: 0, tileM: 1 }
  return <>{slab?.holes?.map((hole, index) => <RoomCeiling key={index} building={building} storey={storey} footprint={hole} finish={finish} flatHeight={storey.clearHeightM} overVoid />)}</>
}

function InteriorGableCaps({ building, storeyRefs }: { building: BuildingModel; storeyRefs: string[] }) {
  return <>{gableWallsForBuilding(building).map(gable => {
    const segment = building.roof.segments.find(s => s.ref === gable.segmentRef)!
    if (!segment.storeyRef || !storeyRefs.includes(segment.storeyRef) || segment.gableGlazing?.[gable.side]) return null
    const wing = roofWings(building).find(w => w.ref === segment.ref)!
    const storey = building.storeys.find(s => s.ref === segment.storeyRef)!
    const bounds = polygonBounds(segment.footprint)
    const base = Math.max(segment.baseElevationM, storey.elevationM + storey.clearHeightM)
    const rise = wing.ridgeElevationM - base
    if (rise <= 0) return null
    const half = rise / Math.tan(segment.pitchDegrees * Math.PI / 180)
    const center = gable.axis === 'z' ? (bounds.minX + bounds.maxX) / 2 : (bounds.minZ + bounds.maxZ) / 2
    const edge = gable.value + (gable.side === 'min' ? .1 : -.1)
    return <group key={gable.ref} position={gable.axis === 'z' ? [center, base, edge] : [edge, base, center]} rotation-y={gable.axis === 'z' ? 0 : Math.PI / 2}>
      <WallFace width={2 * half} height={rise} outline={[{ x: -half, z: 0 }, { x: half, z: 0 }, { x: 0, z: rise }]} finish={{ presetId: 'warm-white', color: '#E9E5DC', rotationDegrees: 0, tileM: 1 }} />
    </group>
  })}</>
}

export function InteriorScene(props: Props) {
  const { storey, plan, selected, mode, placing, snap, labels, onPick, onSelect } = props
  const manipulation = useDirectManipulation({ project: props.project, building: props.building, storey, enabled: mode === 'select' && !placing && !props.interactionDisabled, snap: props.snapSettings ?? { enabled: snap, gridM: .1, alignment: true }, selectedRefs: props.selectedRefs ?? [], onSelect, selectOnly: props.selectOnly, touchMoveEnabled: props.touchMoveEnabled, onCommit: props.onCommit, onNotice: props.onNotice })
  const building = manipulation.preview ?? props.building
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  const upper = building.slabs.find(s => s.ref === storey.topBoundaryRef)?.holes?.length
    ? building.storeys.find(s => s.baseSlabRef === storey.topBoundaryRef) : undefined
  const { camera, gl, scene } = useThree()
  const [preview, setPreview] = useState<Vector3 | null>(null)
  const pointsRef = useRef(props.points); pointsRef.current = props.points
  const measurementEdges = useMemo(() => interiorMeasurementEdges(building, storey), [building, storey])
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  useEffect(() => {
    if (mode !== 'measure') { setPreview(null); return }
    const element = gl.domElement; const raycaster = new Raycaster()
    let dragging: { index: number; pointerId: number; original: Vec2[] } | null = null
    const pick = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      const pointer = new Vector2(event.clientX, event.clientY)
      const snapped = event.altKey ? null : snapMeasurementPoint(pointer, measurementEdges, camera, bounds)
      setPreview(snapped)
      if (snapped) return { x: snapped.x, z: snapped.z }
      raycaster.setFromCamera(new Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2), camera)
      if (!event.altKey) {
        const objects: Object3D[] = []
        scene.traverse((object) => { if (object.userData.measurementFootprint) objects.push(object) })
        const hit = raycaster.intersectObjects(objects, true)[0]
        if (hit) {
          let object: Object3D | null = hit.object
          while (object && !object.userData.measurementFootprint) object = object.parent
          const polygon: Polygon2 = object!.userData.measurementFootprint
          const point = hit.point.clone().setY(0.09)
          let closest: Vector3 | null = null; let distance = Infinity
          for (const [i, a] of polygon.entries()) {
            const b = polygon[(i + 1) % polygon.length]
            const candidate = new Line3(new Vector3(a.x, 0.09, a.z), new Vector3(b.x, 0.09, b.z)).closestPointToPoint(point, true, new Vector3())
            if (candidate.distanceToSquared(point) < distance) { closest = candidate; distance = candidate.distanceToSquared(point) }
          }
          if (closest) { setPreview(closest); return { x: closest.x, z: closest.z } }
        }
      }
      const point = raycaster.ray.intersectPlane(plane, new Vector3())
      return point ? { x: point.x, z: point.z } : null
    }
    const update = (points: Vec2[]) => { pointsRef.current = points; props.onPointsChange(points) }
    const stop = (event: PointerEvent) => { event.preventDefault(); event.stopImmediatePropagation() }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || dragging) return
      stop(event)
      const bounds = element.getBoundingClientRect()
      const index = pointsRef.current.findIndex((point) => {
        const screen = measurementScreenPoint(new Vector3(point.x, 0.09, point.z), camera, bounds)
        return screen && screen.distanceTo(new Vector2(event.clientX, event.clientY)) <= 16
      })
      if (index >= 0) {
        dragging = { index, pointerId: event.pointerId, original: pointsRef.current }
        element.setPointerCapture(event.pointerId); element.style.cursor = 'grabbing'
        return
      }
      const point = pick(event)
      if (point) update(pointsRef.current.length === 1 ? [...pointsRef.current, point] : [point])
    }
    const move = (event: PointerEvent) => {
      if (dragging && event.pointerId !== dragging.pointerId) return
      const point = pick(event)
      if (dragging) {
        stop(event)
        if (point) update(pointsRef.current.map((value, index) => index === dragging!.index ? point : value))
      } else {
        const bounds = element.getBoundingClientRect()
        const overPoint = pointsRef.current.some((value) => {
          const screen = measurementScreenPoint(new Vector3(value.x, 0.09, value.z), camera, bounds)
          return screen && screen.distanceTo(new Vector2(event.clientX, event.clientY)) <= 16
        })
        element.style.cursor = overPoint ? 'grab' : 'crosshair'
      }
    }
    const finish = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragging.pointerId) return
      stop(event)
      if (event.type === 'pointerup') move(event)
      else update(dragging.original)
      dragging = null
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
      element.style.cursor = 'crosshair'
    }
    const leave = () => { if (!dragging) setPreview(null) }
    element.addEventListener('pointerdown', down, true)
    element.addEventListener('pointermove', move, true)
    element.addEventListener('pointerup', finish, true)
    element.addEventListener('pointercancel', finish, true)
    element.addEventListener('lostpointercapture', finish, true)
    element.addEventListener('pointerleave', leave)
    return () => {
      element.removeEventListener('pointerdown', down, true)
      element.removeEventListener('pointermove', move, true)
      element.removeEventListener('pointerup', finish, true)
      element.removeEventListener('pointercancel', finish, true)
      element.removeEventListener('lostpointercapture', finish, true)
      element.removeEventListener('pointerleave', leave)
      if (dragging && element.hasPointerCapture(dragging.pointerId)) element.releasePointerCapture(dragging.pointerId)
      element.style.cursor = ''
    }
  }, [camera, gl, measurementEdges, mode, plane, props.onPointsChange, scene])
  const quality = useRenderQuality()
  const onFloor = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation(); if (event.button !== 0 || event.delta > 5) return
    if (mode === 'select' && !placing) {
      const room = building.spaces.find(r => storey.spaceRefs.includes(r.ref) && pointInPolygon({ x: event.point.x, z: event.point.z }, spaceFootprint(building, r)))
      onSelect(room?.ref ?? null)
      return
    }
    onPick({ x: event.point.x, z: event.point.z })
  }
  const items = (building.furniture ?? []).filter((item) => item.storeyRef === storey.ref)
  const selectedItem = items.find((item) => item.ref === selected)
  const dragWarnings = selectedItem ? placementWarnings(selectedItem, building, storey) : []
  return <>
    {manipulation.dragging && <Html fullscreen style={{ pointerEvents: 'none' }}><div className={`interior-drag-status ${manipulation.error ? 'invalid' : dragWarnings.length ? 'warning' : ''}`} role='status'>{manipulation.error ? interiorMessage(manipulation.error) : dragWarnings.length ? interiorMessage(dragWarnings[0].message) : props.mobile ? 'Puść, aby zapisać · drugi palec anuluje' : 'Puść, aby zapisać · Esc anuluje'}</div></Html>}
    <color attach='background' args={['#eeeee8']} />
    <ambientLight intensity={0.9} /><hemisphereLight args={['#e8f1ff', '#b6a387', 1.3]} />
    <directionalLight key={quality} position={[-12, 20, -8]} intensity={3.1} castShadow={quality !== 'fast'} shadow-mapSize={quality === 'detailed' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-normalBias={0.025} shadow-bias={-0.0002} />
    <InteriorCamera view={props.view ?? (plan ? 'plan' : 'cutaway')} footprint={props.focusFootprint ?? slab.footprint} reset={props.reset} enabled={!manipulation.dragging && mode === 'select' && !placing} cameraKey={`${props.projectRef}/${building.ref}/${storey.ref}`} bottomInset={props.bottomInset} rightInset={props.rightInset} topInset={props.topInset} framingKey={props.framingKey} />
    <Grid position={[0, -storey.elevationM - 0.06, 0]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor='#d1d4cd' sectionSize={5} sectionThickness={0.65} sectionColor='#c3c8bf' fadeDistance={95} />
    <Floor points={slab.footprint} holes={slab.holes} onPick={onFloor} onHover={props.onHover} tiled={building.kind === 'garage'} plan={plan} />
    {props.view === 'room' && <>
      <VoidCeilings building={building} storey={storey} />
      {upper && <group position-y={upper.elevationM - storey.elevationM}><UpperRoomContext building={building} storey={upper} /></group>}
    </>}
    {(building.stairs ?? []).filter((stairs) => stairs.fromStoreyRef === storey.ref || stairs.toStoreyRef === storey.ref).map((stairs) => {
      const lower = building.storeys.find((s) => s.ref === stairs.fromStoreyRef)!; const upper = building.storeys.find((s) => s.ref === stairs.toStoreyRef)!
      const rise = upper.elevationM - lower.elevationM; const base = lower.elevationM - storey.elevationM
      return <Staircase key={stairs.ref} stairs={stairs} rise={rise} base={base} plan={plan} />
    })}
    {building.walls.filter((wall) => storey.wallRefs.includes(wall.ref)).map((wall) => <CutawayWall key={wall.ref} wall={wall} profile={atticWallProfile(building, wall)} plan={plan} fullHeight={props.view === 'room'} selected={props.selectedRefs?.includes(wall.ref) ? wall.ref : selected} onPick={mode === 'partition' ? onPick : undefined} onSelect={mode === 'select' && !placing ? onSelect : undefined} />)}
    {building.spaces.filter((room) => storey.spaceRefs.includes(room.ref)).map((room) => {
      const footprint = spaceFootprint(building, room); const centre = polygonCentroid(footprint); const sizes = roomDimensions(building, room)
      // Merge collinear wall joins before dimensioning; dimensions follow real edges, including L-shaped rooms.
      const corners = sizes.footprint.filter((p, i, points) => {
        const a = points[(i + points.length - 1) % points.length]; const b = points[(i + 1) % points.length]
        return Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > 0.0001
      })
      const edges = corners.map((p, i) => ({ p, q: corners[(i + 1) % corners.length] }))
      const horizontal = edges.filter(({ p, q }) => Math.abs(q.z - p.z) < 0.01).sort((a, b) => Math.abs(b.q.x - b.p.x) - Math.abs(a.q.x - a.p.x))[0]
      const vertical = edges.find(({ p, q }) => Math.abs(q.x - p.x) < 0.03 && Math.abs(q.z - p.z) > 1)
      return <group key={room.ref}>
        {room.floorFinish && <Floor points={footprint} holes={slab.holes} slab={slab.footprint} elevation={0.008} finish={room.floorFinish} onPick={onFloor} onHover={props.onHover} />}
        {room.ceilingFinish && props.view === 'room' && <RoomCeiling building={building} storey={storey} footprint={footprint} finish={room.ceilingFinish} flatHeight={Math.min(storey.clearHeightM, ...building.ceilingFinishes.filter(c => c.spaceRef === room.ref).map(c => c.elevationM - storey.elevationM - c.thicknessM))} />}
        {selected === room.ref && <Line points={[...footprint, footprint[0]].map((p) => [p.x, 0.06, p.z] as [number, number, number])} color='#287466' lineWidth={2.5} />}
        {labels && <RoomLabel centre={centre} name={room.name} area={sizes.area} width={sizes.width} depth={sizes.depth} plan={plan} selected={selected === room.ref} />}
        {plan && props.dimensions && [horizontal, vertical].map((edge, i) => {
          if (!edge) return null
          const length = Math.hypot(edge.q.x - edge.p.x, edge.q.z - edge.p.z); const nx = -(edge.q.z - edge.p.z) / length * 0.24; const nz = (edge.q.x - edge.p.x) / length * 0.24
          return <group key={i}><Line points={[[edge.p.x + nx, 0.19, edge.p.z + nz], [edge.q.x + nx, 0.19, edge.q.z + nz]]} color='#7c837b' lineWidth={0.75} />{[edge.p, edge.q].map((p, j) => <Line key={j} points={[[p.x + nx * 0.6, 0.19, p.z + nz * 0.6], [p.x + nx * 1.4, 0.19, p.z + nz * 1.4]]} color='#7c837b' lineWidth={0.75} />)}<Html center position={[(edge.p.x + edge.q.x) / 2 + nx, 0.2, (edge.p.z + edge.q.z) / 2 + nz]} style={{ pointerEvents: 'none' }} zIndexRange={[7, 0]}><span data-plan-label="10" className={`interior-dimension ${i ? 'is-vertical' : ''}`}>{length.toFixed(2)} m</span></Html></group>
        })}
      </group>
    })}
    {plan && props.dimensions && gablePlanGuides(building, storey).map(guide => {
      const dx = (guide.end.x - guide.start.x) / guide.width, dz = (guide.end.z - guide.start.z) / guide.width
      const nx = -dz, nz = dx
      const point = (p: Vec2, offset: number): [number, number, number] => [p.x + nx * offset, .3, p.z + nz * offset]
      return <group key={`gable-guide-${guide.ref}`}>
        <Line points={[point(guide.start, -.5), point(guide.end, -.5)]} color='#1676b9' lineWidth={2.5} />
        {[guide.start, guide.end].map((p, i) => <Line key={i} points={[point(p, -.65), point(p, .8)]} color='#1676b9' lineWidth={1.5} dashed dashSize={.09} gapSize={.05} />)}
        <Html center position={[(guide.start.x + guide.end.x) / 2 - nx * .85, .3, (guide.start.z + guide.end.z) / 2 - nz * .85]} style={{ pointerEvents: 'none' }} zIndexRange={[8, 0]}><span data-plan-label='25' className='interior-dimension' style={{ color: '#12699f' }}>Okno · {guide.width.toFixed(2)} m</span></Html>
      </group>
    })}
    {props.view === 'room' && <group position-y={-storey.elevationM}><InteriorGableCaps building={building} storeyRefs={[storey.ref, ...(upper ? [upper.ref] : [])]} />{building.roof.segments.filter(s => s.storeyRef === storey.ref || s.storeyRef === upper?.ref).flatMap(segment => (['min','max'] as const).flatMap(side => {
      if (!segment.gableGlazing?.[side]) return []
      const bounds=polygonBounds(segment.footprint)
      const value=(segment.ridgeDirection === 'z' ? (side==='min'?bounds.minZ:bounds.maxZ) : (side==='min'?bounds.minX:bounds.maxX)) + (side==='min'?1:-1)*(segment.gableRecess?.[side]?.depthM ?? 0)
      return [<GlazedGable key={segment.ref+side} building={building} segment={segment} side={side} value={value} finish={{material:'light-render',colorHex:'#E5DDCE'}} selected={false}/>]
    }))}</group>}
    {items.map((item) => <group key={item.ref} position={[item.position.x, 0.025 + (item.elevationM ?? 0), item.position.z]} rotation={[0, item.rotationDegrees * Math.PI / 180, 0]} userData={{ measurementFootprint: interiorCorners(item), dragTarget: { kind: 'item', ref: item.ref } }}
      onPointerDown={event => { if (mode !== 'select' || placing) { event.stopPropagation(); onPick({ x: event.point.x, z: event.point.z }) } }}>
      <ProductModel item={item} mobile={props.mobile} />
    </group>)}
    {items.filter((item) => item.ref === selected || props.selectedRefs?.includes(item.ref)).map((item) => <Line key={`selection-${item.ref}`} points={(() => { const corners = interiorCorners(item); return [...corners, corners[0]].map((p) => [p.x, (item.elevationM ?? 0) + 0.07, p.z] as [number, number, number]) })()} color={placementWarnings(item, building, storey).length ? '#c47b12' : item.locked ? '#ad8551' : '#287466'} lineWidth={3} />)}
    {props.wallPreview && <group>
      <Line points={[props.wallPreview.start, props.wallPreview.end].map(p => [p.x, plan ? .24 : 1.3, p.z] as [number, number, number])} color="#1676b9" lineWidth={3} dashed dashSize={.12} gapSize={.06} />
      {[props.wallPreview.start, props.wallPreview.end].map((p, i) => <Html key={i} center position={[p.x, plan ? .3 : 1.35, p.z]} style={{ pointerEvents: 'none' }} zIndexRange={[9, 0]}><span className="interior-wall-anchor">{i ? 'B' : 'A'}</span></Html>)}
    </group>}
    {selectedItem && !manipulation.dragging && mode === 'select' && wallDistances(selectedItem, building, storey).map((entry) => <group key={`distance-${entry.ref}`}>
      <Line points={[[entry.point.x, 0.09, entry.point.z], [entry.wallPoint.x, 0.09, entry.wallPoint.z]]} color='#287466' lineWidth={1} dashed dashSize={0.06} gapSize={0.04} />
      <Html center position={[(entry.point.x + entry.wallPoint.x) / 2, 0.1, (entry.point.z + entry.wallPoint.z) / 2]} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}><span className='interior-dimension' data-plan-label="50" data-movable="true"><i className="interior-label-leader" />{entry.distanceM.toFixed(2)} m</span></Html>
    </group>)}
    {props.ghost && <group position={[props.ghost.position.x, (props.ghost.elevationM ?? 0) + props.ghost.heightM / 2 + 0.02, props.ghost.position.z]} rotation-y={props.ghost.rotationDegrees * Math.PI / 180}>
      <mesh raycast={() => {}}><boxGeometry args={[props.ghost.widthM, props.ghost.heightM, props.ghost.depthM]} /><meshBasicMaterial color={!itemFitsFloor(props.ghost, slab.footprint, slab.holes) ? '#c57054' : placementWarnings(props.ghost, building, storey).length ? '#c47b12' : '#438b77'} transparent opacity={0.25} depthWrite={false} /></mesh>
    </group>}
    {props.points.length > 0 && <>
      {props.points.map((point, i) => <MeasurementPoint key={i} position={new Vector3(point.x, 0.09, point.z)} color='#236959' waiting={props.points.length === 1} />)}
      {props.points.length === 2 && <><Line points={props.points.map((p) => [p.x, 0.1, p.z] as [number, number, number])} color='#236959' lineWidth={2.5} dashed dashSize={0.16} gapSize={0.07} /><Html center style={{ pointerEvents: 'none' }} position={[(props.points[0].x + props.points[1].x) / 2, 0.14, (props.points[0].z + props.points[1].z) / 2]}><span data-plan-label='60' className='interior-measure-label'>{Math.hypot(props.points[1].x - props.points[0].x, props.points[1].z - props.points[0].z).toFixed(2)} m</span></Html></>}
    </>}
    {preview && mode === 'measure' && <Html center position={preview} style={{ pointerEvents: 'none' }}><span className='measurement-snap-preview'>Przyciągnięto</span></Html>}
    <PlanLabelLayout />
  </>
}
