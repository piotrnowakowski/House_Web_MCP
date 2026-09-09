import { Grid, Html, Line, OrbitControls } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DoubleSide, Line3, Object3D, Path, Plane, Raycaster, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { polygonBounds, polygonCentroid, spaceFootprint, wallLength } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { interiorCorners } from '../domain/interior'
import type { BuildingModel, InteriorItem, Polygon2, StoreyModel, Vec2, WallModel } from '../domain/types'
import { interiorFloorTexture } from '../scene/materialCatalog'
import { TexturedMaterial } from '../scene/materials'
import { FurnitureModel } from './FurnitureModel'
import { interiorMeasurementEdges, measurementScreenPoint, snapMeasurementPoint } from '../scene/measurementSnapping'
import { MeasurementPoint } from '../scene/MeasurementPoint'

function Floor({ points, holes, onPick, tiled = false, plan = false }: { points: Polygon2; holes?: Polygon2[]; onPick: (event: ThreeEvent<PointerEvent>) => void; tiled?: boolean; plan?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new Shape(); points.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)); shape.closePath()
    for (const points of holes ?? []) { const path = new Path(); points.forEach((p, i) => i ? path.lineTo(p.x, -p.z) : path.moveTo(p.x, -p.z)); path.closePath(); shape.holes.push(path) }
    const result = new ShapeGeometry(shape); result.rotateX(-Math.PI / 2); return result
  }, [points, holes])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} receiveShadow onPointerDown={onPick}>
    {plan ? <meshBasicMaterial color='#fafaf7' side={DoubleSide} toneMapped={false} /> : tiled ? <meshStandardMaterial color='#b5b5ab' roughness={0.88} side={DoubleSide} /> : <TexturedMaterial asset={interiorFloorTexture.asset} color='#fff3df' roughness={0.8} side={DoubleSide} />}
  </mesh>
}

function CutawayWall({ wall, plan }: { wall: WallModel; plan: boolean }) {
  const length = wallLength(wall); const height = plan ? 0.14 : Math.min(1.15, wall.heightM)
  const openings = [...wall.openings].sort((a, b) => a.offsetM - b.offsetM)
  let cursor = 0
  const pieces: { start: number; end: number; height: number }[] = []
  for (const opening of openings) {
    const start = Math.max(cursor, opening.offsetM - opening.widthM / 2); const end = Math.min(length, opening.offsetM + opening.widthM / 2)
    if (start > cursor) pieces.push({ start: cursor, end: start, height })
    if (opening.kind === 'window' && opening.sillM > 0) pieces.push({ start, end, height: Math.min(height, opening.sillM) })
    cursor = end
  }
  if (cursor < length) pieces.push({ start: cursor, end: length, height })
  return <group position={[wall.start.x, 0.025, wall.start.z]} rotation={[0, -Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x), 0]}>
    {pieces.map((piece, index) => <group key={index}><mesh position={[(piece.start + piece.end) / 2, piece.height / 2, 0]} castShadow receiveShadow><boxGeometry args={[piece.end - piece.start, piece.height, wall.thicknessM]} /><meshStandardMaterial color={plan ? '#283b36' : '#eceae2'} roughness={0.82} /></mesh><mesh position={[(piece.start + piece.end) / 2, 0.055, 0]}><boxGeometry args={[piece.end - piece.start, 0.09, wall.thicknessM + 0.022]} /><meshStandardMaterial color={plan ? '#283b36' : '#f7f3e9'} /></mesh></group>)}
    {openings.filter((o) => o.kind === 'window' || o.glazed).map((opening) => {
      const sill = plan ? 0.04 : Math.min(height, opening.sillM); const glassHeight = plan ? 0.035 : Math.max(0.35, height - sill)
      return <group key={opening.ref} position={[opening.offsetM, 0, 0]}><mesh position={[0, sill + glassHeight / 2, 0]}><boxGeometry args={[opening.widthM, glassHeight, 0.035]} /><meshPhysicalMaterial color='#adc8d0' transparent opacity={plan ? 0.8 : 0.25} roughness={0.08} depthWrite={false} /></mesh>{[-1, 0, 1].map((x) => <mesh key={x} position={[x * opening.widthM / 2, sill + glassHeight / 2, 0]}><boxGeometry args={[0.045, glassHeight + 0.035, 0.055]} /><meshStandardMaterial color={opening.glazed ? '#121817' : '#f6f4ec'} /></mesh>)}{[-1, 1].map((y) => <mesh key={y} position={[0, sill + glassHeight / 2 + y * glassHeight / 2, 0]}><boxGeometry args={[opening.widthM, 0.04, 0.055]} /><meshStandardMaterial color={opening.glazed ? '#121817' : '#f6f4ec'} /></mesh>)}</group>
    })}
    {openings.filter((o) => o.kind === 'door' && !o.glazed).map((opening) => <group key={opening.ref} position={[opening.offsetM - opening.widthM / 2, 0, 0]}>
      {plan && opening.widthM > 3 ? <Line points={[[0, 0.17, 0], [opening.widthM, 0.17, 0]]} color='#7e9496' lineWidth={2} /> : plan ? <><Line points={[[0, 0.17, 0], [0, 0.17, opening.widthM]]} color='#8c8677' lineWidth={1} /><Line points={Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI / 2; return [Math.cos(a) * opening.widthM, 0.17, Math.sin(a) * opening.widthM] as [number, number, number] })} color='#afa998' lineWidth={0.65} /></> : opening.widthM > 3 ? <group position={[opening.widthM / 2, 0.48, 0]}><mesh><boxGeometry args={[opening.widthM, 0.92, 0.065]} /><meshStandardMaterial color='#b7cbd1' roughness={0.5} /></mesh>{[0.15, 0.35, 0.55, 0.75].map((y) => <mesh key={y} position={[0, y - 0.46, 0.04]}><boxGeometry args={[opening.widthM, 0.015, 0.02]} /><meshStandardMaterial color='#e5eded' /></mesh>)}</group> : <group rotation={[0, -0.55, 0]}><mesh position={[opening.widthM / 2, 0.53, 0]} castShadow><boxGeometry args={[opening.widthM - 0.04, 1.04, 0.045]} /><meshStandardMaterial color='#c6a477' roughness={0.7} /></mesh><mesh position={[opening.widthM - 0.15, 0.55, 0.045]}><boxGeometry args={[0.1, 0.025, 0.05]} /><meshStandardMaterial color='#6d7876' metalness={0.65} roughness={0.3} /></mesh></group>}
    </group>)}
  </group>
}

function Camera({ footprint, plan, reset, enabled }: { footprint: Polygon2; plan: boolean; reset: number; enabled: boolean }) {
  const controls = useRef<OrbitControlsType>(null); const { camera, size } = useThree()
  const footprintKey = JSON.stringify(footprint)
  useEffect(() => {
    const b = polygonBounds(footprint); const x = (b.minX + b.maxX) / 2; const z = (b.minZ + b.maxZ) / 2
    camera.position.set(x + (plan ? 0 : 3), plan ? 35 : 32, z + (plan ? 0.001 : 14))
    camera.lookAt(x, 0, z)
    camera.zoom = Math.min(size.width / ((b.maxX - b.minX + 5) * 1.15), size.height / (b.maxZ - b.minZ + 5))
    if (!plan) {
      camera.zoom = 1; camera.updateProjectionMatrix(); camera.updateMatrixWorld()
      const projected = footprint.flatMap((p) => [0, 3].map((y) => new Vector3(p.x, y, p.z).project(camera)))
      const halfWidth = Math.max(...projected.map((p) => Math.abs(p.x))) * size.width / 2
      const halfHeight = Math.max(...projected.map((p) => Math.abs(p.y))) * size.height / 2
      camera.zoom = Math.min((size.width - 70) / (halfWidth * 2), (size.height - 200) / (halfHeight * 2))
    }
    camera.updateProjectionMatrix(); controls.current?.target.set(x, 0, z); controls.current?.update()
  }, [camera, footprintKey, plan, reset, size.width, size.height])
  return <OrbitControls ref={controls} makeDefault enabled={enabled} enableRotate={!plan} maxPolarAngle={Math.PI / 2.2} minZoom={8} maxZoom={180} enableDamping dampingFactor={0.12} />
}

interface Props {
  building: BuildingModel; storey: StoreyModel; plan: boolean; reset: number; selected: string | null; mode: 'select' | 'measure'; placing: boolean; snap: boolean; labels: boolean
  dimensions: boolean; points: Vec2[]; onPointsChange: (points: Vec2[]) => void; onPick: (point: Vec2) => void; onSelect: (ref: string | null) => void; onMove: (item: InteriorItem) => void
}
export function InteriorScene(props: Props) {
  const { building, storey, plan, selected, mode, placing, snap, labels, onPick, onSelect, onMove } = props
  const slab = building.slabs.find((item) => item.ref === storey.baseSlabRef)!
  const [drag, setDrag] = useState<{ item: InteriorItem; origin: Vec2; position: Vec2 } | null>(null)
  const dragRef = useRef(drag); dragRef.current = drag
  const { camera, gl, get, scene } = useThree()
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
  const onFloor = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation(); if (event.button !== 0) return
    onPick({ x: event.point.x, z: event.point.z })
  }
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return; event.stopPropagation()
    const point = event.ray.intersectPlane(plane, new Vector3()); if (!point) return
    const current = dragRef.current; const round = (n: number) => snap ? Math.round(n * 10) / 10 : n
    const next = { ...current, position: { x: round(current.item.position.x + point.x - current.origin.x), z: round(current.item.position.z + point.z - current.origin.z) } }
    dragRef.current = next; setDrag(next)
  }
  const finish = (event: ThreeEvent<PointerEvent>, cancel = false) => {
    const current = dragRef.current; if (!current) return
    event.stopPropagation(); dragRef.current = null; setDrag(null)
    const target = event.target as HTMLElement
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
    if (!cancel && Math.hypot(current.position.x - current.item.position.x, current.position.z - current.item.position.z) > 0.005) onMove({ ...current.item, position: current.position })
  }
  const items = (building.furniture ?? []).filter((item) => item.storeyRef === storey.ref)
  const selectedItem = items.find((item) => item.ref === selected)
  return <>
    <color attach='background' args={['#eeeee8']} />
    <ambientLight intensity={0.9} /><hemisphereLight args={['#e8f1ff', '#b6a387', 1.3]} />
    <directionalLight position={[-12, 20, -8]} intensity={3.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-normalBias={0.025} shadow-bias={-0.0002} />
    <Camera footprint={slab.footprint} plan={plan} reset={props.reset} enabled={!drag && mode === 'select' && !placing} />
    <Grid position={[0, -storey.elevationM - 0.06, 0]} infiniteGrid cellSize={1} cellThickness={0.5} cellColor='#d1d4cd' sectionSize={5} sectionThickness={0.65} sectionColor='#c3c8bf' fadeDistance={95} />
    <Floor points={slab.footprint} holes={slab.holes} onPick={onFloor} tiled={building.kind === 'garage'} plan={plan} />
    {(building.stairs ?? []).filter((stairs) => stairs.fromStoreyRef === storey.ref || stairs.toStoreyRef === storey.ref).map((stairs) => {
      const lower = building.storeys.find((s) => s.ref === stairs.fromStoreyRef)!; const upper = building.storeys.find((s) => s.ref === stairs.toStoreyRef)!
      const rise = upper.elevationM - lower.elevationM; const base = lower.elevationM - storey.elevationM
      return <group key={stairs.ref} position={[stairs.start.x, plan ? 0.03 : base, stairs.start.z]}>{Array.from({ length: stairs.steps }, (_, i) => {
        const h = plan ? 0.035 : rise * (stairs.steps - i) / stairs.steps
        return <mesh key={i} position={[(i + 0.5) * stairs.runM / stairs.steps, h / 2, stairs.widthM / 2]} castShadow receiveShadow><boxGeometry args={[stairs.runM / stairs.steps - 0.012, h, stairs.widthM]} /><meshStandardMaterial color={i % 2 ? '#b99365' : '#c49c6b'} roughness={0.8} /></mesh>
      })}{plan && <Line points={[[stairs.runM - 0.12, 0.16, stairs.widthM / 2], [0.14, 0.16, stairs.widthM / 2], [0.35, 0.16, stairs.widthM / 2 - 0.17], [0.14, 0.16, stairs.widthM / 2], [0.35, 0.16, stairs.widthM / 2 + 0.17]]} color='#675d4b' lineWidth={1} />}</group>
    })}
    {building.walls.filter((wall) => storey.wallRefs.includes(wall.ref)).map((wall) => <CutawayWall key={wall.ref} wall={wall} plan={plan} />)}
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
        {selected === room.ref && <Line points={[...footprint, footprint[0]].map((p) => [p.x, 0.06, p.z] as [number, number, number])} color='#287466' lineWidth={2.5} />}
        {labels && <Html center position={[centre.x, 0.06, centre.z]} zIndexRange={[8, 0]} style={{ pointerEvents: mode === 'measure' || placing ? 'none' : 'auto' }}><button className={`interior-room-label ${selected === room.ref ? 'selected' : ''}`} style={sizes.width < 3 ? { width: 72, whiteSpace: 'normal' } : undefined} onClick={() => onSelect(room.ref)}><strong>{room.name}</strong><span>{sizes.area.toFixed(2)} m²</span></button></Html>}
        {plan && props.dimensions && [horizontal, vertical].map((edge, i) => {
          if (!edge) return null
          const length = Math.hypot(edge.q.x - edge.p.x, edge.q.z - edge.p.z); const nx = -(edge.q.z - edge.p.z) / length * 0.24; const nz = (edge.q.x - edge.p.x) / length * 0.24
          return <group key={i}><Line points={[[edge.p.x + nx, 0.19, edge.p.z + nz], [edge.q.x + nx, 0.19, edge.q.z + nz]]} color='#7c837b' lineWidth={0.75} />{[edge.p, edge.q].map((p, j) => <Line key={j} points={[[p.x + nx * 0.6, 0.19, p.z + nz * 0.6], [p.x + nx * 1.4, 0.19, p.z + nz * 1.4]]} color='#7c837b' lineWidth={0.75} />)}<Html center position={[(edge.p.x + edge.q.x) / 2 + nx, 0.2, (edge.p.z + edge.q.z) / 2 + nz]} style={{ pointerEvents: 'none' }} zIndexRange={[7, 0]}><span className={`interior-dimension ${i ? 'is-vertical' : ''}`}>{length.toFixed(2)} m</span></Html></group>
        })}
      </group>
    })}
    {items.map((item) => {
      const current = drag?.item.ref === item.ref ? { ...item, position: drag.position } : item
      return <group key={item.ref} position={[current.position.x, 0.025, current.position.z]} rotation={[0, item.rotationDegrees * Math.PI / 180, 0]} userData={{ measurementFootprint: interiorCorners(current) }}
        onPointerDown={(event) => {
          if (event.button !== 0) return; event.stopPropagation()
          if (mode === 'measure' || placing) { onPick({ x: event.point.x, z: event.point.z }); return }
          const point = event.ray.intersectPlane(plane, new Vector3()); if (!point) return
          // Disable immediately, before the next pointer event or controls update.
          const controls = get().controls as OrbitControlsType | null
          if (controls) {
            const position = camera.position.clone(); const target = controls.target.clone(); const zoom = camera.zoom
            controls.enableDamping = false; controls.update()
            camera.position.copy(position); camera.zoom = zoom; camera.updateProjectionMatrix(); controls.target.copy(target); controls.update()
            controls.enableDamping = true; controls.enabled = false
          }
          onSelect(item.ref); (event.target as HTMLElement).setPointerCapture(event.pointerId)
          const next = { item, origin: { x: point.x, z: point.z }, position: item.position }; dragRef.current = next; setDrag(next)
        }} onPointerMove={move} onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}>
        <FurnitureModel item={item} />
      </group>
    })}
    {selectedItem && <Line points={(() => { const corners = interiorCorners(drag ? { ...selectedItem, position: drag.position } : selectedItem); return [...corners, corners[0]].map((p) => [p.x, 0.07, p.z] as [number, number, number]) })()} color='#287466' lineWidth={2} />}
    {props.points.length > 0 && <>
      {props.points.map((point, i) => <MeasurementPoint key={i} position={new Vector3(point.x, 0.09, point.z)} color='#236959' waiting={props.points.length === 1} />)}
      {props.points.length === 2 && <><Line points={props.points.map((p) => [p.x, 0.1, p.z] as [number, number, number])} color='#236959' lineWidth={2.5} dashed dashSize={0.16} gapSize={0.07} /><Html center style={{ pointerEvents: 'none' }} position={[(props.points[0].x + props.points[1].x) / 2, 0.14, (props.points[0].z + props.points[1].z) / 2]}><span className='interior-measure-label'>{Math.hypot(props.points[1].x - props.points[0].x, props.points[1].z - props.points[0].z).toFixed(2)} m</span></Html></>}
    </>}
    {preview && mode === 'measure' && <Html center position={preview} style={{ pointerEvents: 'none' }}><span className='measurement-snap-preview'>Snapped</span></Html>}
  </>
}
