import { Html, Line as DreiLine, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import * as OBC from '@thatopen/components'
import CameraControls from 'camera-controls'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, EdgesGeometry, Group, LinearFilter, MathUtils, Mesh, MeshStandardMaterial, Object3D,
  OrthographicCamera, PerspectiveCamera, Plane, Raycaster, Scene, Shape, ShapeGeometry, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { buildingGroundOffset, buildingLocalBounds, elevationAt, pointInPolygon, polygonBounds, polygonCentroid, spaceFootprint } from '../domain/geometry'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { measureHeight } from '../domain/heightMeasurements'
import type { BuildingModel, GardenFixtureModel, LandscapeZone, PlantModel, Polygon2, ProjectV2, RoofSegmentModel, SiteEntranceModel, StructureReport, ViewMode, WallModel, WallMaterial } from '../domain/types'
import { inferWallOpeningLayout } from '../domain/wallOpeningLayouts'
import { resolveWallFinish } from '../domain/wallFinishes'
import { geometryService, solidInputsForBuilding } from '../geometry/geometryService'
import type { GeneratedSolid } from '../geometry/types'
import { registerStructureViewCapture, type ExpandedStructureView } from '../services/structureViews'
import { useStudioStore } from '../state/store'

const TECH = { slab: '#d8d6cb', wall: '#e9e7df', roof: '#6c4a39', soil: '#a8ad8d' }
const REAL = { slab: '#d6d0bf', wall: '#e8e1d2', roof: '#6f4735', soil: '#918867' }
const BARN = { slab: '#777269', wall: '#282d2c', roof: '#343a3b' }
const TERRAIN_SURFACE_Y = 0
const MAX_ORBIT_DISTANCE = 420
const SCENE_FAR = 1200
const KEYBOARD_PAN_STEP_M = 2.5
const STOREY_EXPLODE_GAP_M = 2.8
const ROOM_EXPLODE_DISTANCE_M = 2.6
export const CLEAR_MEASUREMENT_EVENT = 'projectv2:clear-measurement'

const polygonShape = (points: Polygon2) => {
  const shape = new Shape()
  points.forEach((point, index) => index ? shape.lineTo(point.x, -point.z) : shape.moveTo(point.x, -point.z))
  shape.closePath()
  return shape
}

const localPolygonGeometry = (points: Polygon2) => {
  const geometry = new ShapeGeometry(polygonShape(points))
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

class SharedRenderer extends OBC.BaseRenderer {
  three: WebGLRenderer
  constructor(components: OBC.Components, renderer: WebGLRenderer) { super(components); this.three = renderer }
  update() { /* React Three Fiber owns the render loop. */ }
  dispose() { this.clippingPlanes = []; this.onDisposed.trigger(undefined) }
  getSize() { return this.three.getSize(new Vector2()) }
  resize(_size?: Vector2) { this.onResize.trigger(this.getSize()) }
}

class SharedScene extends OBC.BaseScene {
  three: Object3D
  constructor(components: OBC.Components, shared: Scene) { super(components); this.three = shared }
  override dispose() { this.onDisposed.trigger(undefined) }
}

function MeasurementPoint({ position, waiting = false }: { position: Vector3; waiting?: boolean }) {
  const point = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!point.current) return
    const scale = waiting ? 1 + Math.sin(clock.elapsedTime * 5) * 0.18 : 1
    point.current.scale.setScalar(scale)
  })
  return <mesh ref={point} position={position} renderOrder={30} userData={{ editorOnly: true, measurementOverlay: true }}>
    <sphereGeometry args={[0.13, 16, 12]} />
    <meshBasicMaterial color="#b9e84d" depthTest={false} />
  </mesh>
}

function MeasurementLabel({ position, type, children }: { position: Vector3; type: 'length' | 'area' | 'height'; children: React.ReactNode }) {
  return <Html position={position} center zIndexRange={[18, 0]}><div className={`spatial-measurement-label ${type}`} role="status" aria-label={`${type === 'length' ? 'Length' : type === 'area' ? 'Area' : 'Height'} measurement`}>{children}</div></Html>
}

function InteractiveMeasurements() {
  const { camera, gl, scene } = useThree()
  const viewerMode = useStudioStore((state) => state.viewerMode)
  const selectedRef = useStudioStore((state) => state.selectedRef)
  const heightMeasureKind = useStudioStore((state) => state.heightMeasureKind)
  const project = useStudioStore((state) => state.project)
  const setToast = useStudioStore((state) => state.setToast)
  const [lengthPoints, setLengthPointsState] = useState<Vector3[]>([])
  const [areaRect, setAreaRectState] = useState<{ start: Vector3; end: Vector3; dragging: boolean } | null>(null)
  const [freeHeightPoints, setFreeHeightPointsState] = useState<Vector3[]>([])
  const lengthRef = useRef<Vector3[]>([])
  const areaRef = useRef<{ start: Vector3; end: Vector3; dragging: boolean } | null>(null)
  const freeHeightRef = useRef<Vector3[]>([])
  const raycaster = useMemo(() => new Raycaster(), [])
  const groundPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const setLengthPoints = (points: Vector3[]) => { lengthRef.current = points; setLengthPointsState(points) }
  const setAreaRect = (rect: { start: Vector3; end: Vector3; dragging: boolean } | null) => { areaRef.current = rect; setAreaRectState(rect) }
  const setFreeHeightPoints = (points: Vector3[]) => { freeHeightRef.current = points; setFreeHeightPointsState(points) }
  const clear = () => { setLengthPoints([]); setAreaRect(null); setFreeHeightPoints([]); setToast(null) }

  useEffect(() => { setLengthPoints([]); setAreaRect(null); setFreeHeightPoints([]) }, [viewerMode])
  useEffect(() => {
    const onClear = () => clear()
    window.addEventListener(CLEAR_MEASUREMENT_EVENT, onClear)
    return () => window.removeEventListener(CLEAR_MEASUREMENT_EVENT, onClear)
  })
  useEffect(() => {
    if (viewerMode !== 'measure-length' && viewerMode !== 'measure-area' && viewerMode !== 'measure-height') return
    const element = gl.domElement
    const pointOnGround = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      const pointer = new Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const point = raycaster.ray.intersectPlane(groundPlane, new Vector3())
      if (!point) return null
      point.y = elevationAt(project, point.x, point.z) + 0.14
      return point
    }
    const stopEditorClick = (event: PointerEvent) => { event.preventDefault(); event.stopImmediatePropagation() }
    const pointOnGeometry = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      const pointer = new Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(scene.children, true).find((intersection) => !intersection.object.userData.editorOnly && !intersection.object.userData.measurementOverlay)
      return hit?.point.clone() ?? null
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (viewerMode === 'measure-height') {
        if (!event.shiftKey) return
        const point = pointOnGeometry(event)
        if (!point) return
        stopEditorClick(event)
        if (freeHeightRef.current.length === 1) {
          const points = [freeHeightRef.current[0], point]; setFreeHeightPoints(points)
          setToast(`Vertical height: ${Math.abs(points[1].y - points[0].y).toFixed(2)} m.`)
        } else { setFreeHeightPoints([point]); setToast('First height point placed. Shift-click the second point.') }
        return
      }
      const point = pointOnGround(event)
      if (!point) return
      stopEditorClick(event)
      if (viewerMode === 'measure-length') {
        if (lengthRef.current.length === 1) {
          const points = [lengthRef.current[0], point]
          setLengthPoints(points)
          setToast(`Length: ${points[0].distanceTo(points[1]).toFixed(2)} m.`)
        } else {
          setLengthPoints([point])
          setToast('First point placed. Click the second point.')
        }
      } else {
        element.setPointerCapture(event.pointerId)
        setAreaRect({ start: point, end: point.clone(), dragging: true })
        setToast('Drag to size the rectangle, then release.')
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (viewerMode !== 'measure-area' || !areaRef.current?.dragging) return
      const point = pointOnGround(event)
      if (!point) return
      stopEditorClick(event)
      setAreaRect({ start: areaRef.current.start, end: point, dragging: true })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (viewerMode !== 'measure-area' || !areaRef.current?.dragging) return
      const point = pointOnGround(event) ?? areaRef.current.end
      stopEditorClick(event)
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
      const rect = { start: areaRef.current.start, end: point, dragging: false }
      setAreaRect(rect)
      const width = Math.abs(rect.end.x - rect.start.x); const depth = Math.abs(rect.end.z - rect.start.z)
      setToast(width < 0.05 || depth < 0.05 ? 'Drag a larger rectangle to measure area.' : `Area: ${(width * depth).toFixed(2)} m².`)
    }
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
    }
  }, [camera, gl, groundPlane, project, raycaster, scene, setToast, viewerMode])

  const length = lengthPoints.length === 2 ? lengthPoints[0].distanceTo(lengthPoints[1]) : null
  const areaWidth = areaRect ? Math.abs(areaRect.end.x - areaRect.start.x) : 0
  const areaDepth = areaRect ? Math.abs(areaRect.end.z - areaRect.start.z) : 0
  const areaCenter = areaRect ? new Vector3((areaRect.start.x + areaRect.end.x) / 2, Math.max(areaRect.start.y, areaRect.end.y) + 0.08, (areaRect.start.z + areaRect.end.z) / 2) : null
  const areaCorners = areaRect && areaCenter ? [
    new Vector3(areaRect.start.x, areaCenter.y, areaRect.start.z), new Vector3(areaRect.end.x, areaCenter.y, areaRect.start.z),
    new Vector3(areaRect.end.x, areaCenter.y, areaRect.end.z), new Vector3(areaRect.start.x, areaCenter.y, areaRect.end.z), new Vector3(areaRect.start.x, areaCenter.y, areaRect.start.z),
  ] : []
  const semanticHeight = useMemo(() => {
    if (viewerMode !== 'measure-height' || !selectedRef || freeHeightPoints.length) return null
    try { return measureHeight(project, { mode: 'semantic', objectRef: selectedRef, measurement: heightMeasureKind }) }
    catch { return null }
  }, [freeHeightPoints.length, heightMeasureKind, project, selectedRef, viewerMode])
  const semanticHeightPoints = semanticHeight ? [new Vector3(semanticHeight.bottomPoint.x, semanticHeight.bottomPoint.y, semanticHeight.bottomPoint.z), new Vector3(semanticHeight.topPoint.x, semanticHeight.topPoint.y, semanticHeight.topPoint.z)] : []
  const freeVerticalPoints = freeHeightPoints.length === 2 ? [freeHeightPoints[0], new Vector3(freeHeightPoints[0].x, freeHeightPoints[1].y, freeHeightPoints[0].z)] : []
  return <group userData={{ editorOnly: true, measurementOverlay: true }}>
    {viewerMode === 'measure-length' && lengthPoints.map((point, index) => <MeasurementPoint key={index} position={point} waiting={lengthPoints.length === 1} />)}
    {viewerMode === 'measure-length' && lengthPoints.length === 2 && <>
      <DreiLine points={lengthPoints} color="#b9e84d" lineWidth={3} depthTest={false} renderOrder={29} />
      <MeasurementLabel type="length" position={lengthPoints[0].clone().lerp(lengthPoints[1], 0.5).add(new Vector3(0, 0.35, 0))}><strong>{length?.toFixed(2)} m</strong><span>point to point</span></MeasurementLabel>
    </>}
    {viewerMode === 'measure-area' && areaRect && areaCenter && <>
      <mesh position={areaCenter} rotation={[-Math.PI / 2, 0, 0]} renderOrder={28} userData={{ editorOnly: true, measurementOverlay: true }}><planeGeometry args={[Math.max(areaWidth, 0.01), Math.max(areaDepth, 0.01)]} /><meshBasicMaterial color="#b9e84d" transparent opacity={0.22} depthWrite={false} depthTest side={DoubleSide} /></mesh>
      <DreiLine points={areaCorners} color="#b9e84d" lineWidth={3} depthTest renderOrder={29} />
      <MeasurementPoint position={areaRect.start} /><MeasurementPoint position={areaRect.end} />
      {areaWidth >= 0.05 && areaDepth >= 0.05 && <MeasurementLabel type="area" position={areaCenter.clone().add(new Vector3(0, 0.35, 0))}><strong>{(areaWidth * areaDepth).toFixed(2)} m²</strong><span>{areaWidth.toFixed(2)} × {areaDepth.toFixed(2)} m</span></MeasurementLabel>}
    </>}
    {viewerMode === 'measure-height' && freeHeightPoints.map((value, index) => <MeasurementPoint key={`free-height-${index}`} position={value} waiting={freeHeightPoints.length === 1} />)}
    {viewerMode === 'measure-height' && freeVerticalPoints.length === 2 && <>
      <DreiLine points={freeVerticalPoints} color="#b9e84d" lineWidth={3} depthTest={false} renderOrder={29} />
      <MeasurementLabel type="height" position={freeVerticalPoints[0].clone().lerp(freeVerticalPoints[1], 0.5).add(new Vector3(0.35, 0, 0))}><strong>{Math.abs(freeVerticalPoints[1].y - freeVerticalPoints[0].y).toFixed(2)} m</strong><span>free vertical · local project</span></MeasurementLabel>
    </>}
    {viewerMode === 'measure-height' && semanticHeight && semanticHeightPoints.length === 2 && <>
      <MeasurementPoint position={semanticHeightPoints[0]} /><MeasurementPoint position={semanticHeightPoints[1]} />
      <DreiLine points={semanticHeightPoints} color="#b9e84d" lineWidth={3} depthTest={false} renderOrder={29} />
      <MeasurementLabel type="height" position={semanticHeightPoints[0].clone().lerp(semanticHeightPoints[1], 0.5).add(new Vector3(0.35, 0, 0))}><strong>{semanticHeight.heightM.toFixed(2)} m</strong><span>{semanticHeight.label} · {semanticHeight.bottomElevation.absoluteM.toFixed(2)}–{semanticHeight.topElevation.absoluteM.toFixed(2)} m abs.</span></MeasurementLabel>
    </>}
  </group>
}

function ThatOpenBridge() {
  const { gl, scene, set, size } = useThree()
  const viewerMode = useStudioStore((state) => state.viewerMode)
  const explode = useStudioStore((state) => state.explodeStoreys)
  const project = useStudioStore((state) => state.project)
  const refocusRequest = useStudioStore((state) => state.cameraRefocusRequest)
  const gardenFocusRequest = useStudioStore((state) => state.gardenFocusRequest)
  const handledRefocusRequest = useRef(refocusRequest)
  const handledGardenFocusRequest = useRef(gardenFocusRequest.sequence)
  const handledExplode = useRef(explode)
  const bridge = useRef<{ components: OBC.Components; world: OBC.SimpleWorld; camera: OBC.OrthoPerspectiveCamera; renderer: SharedRenderer; clipper: OBC.Clipper } | null>(null)

  useEffect(() => {
    const components = new OBC.Components()
    const world = components.get(OBC.Worlds).create()
    const renderer = new SharedRenderer(components, gl)
    world.scene = new SharedScene(components, scene)
    world.renderer = renderer
    const camera = new OBC.OrthoPerspectiveCamera(components)
    world.camera = camera
    camera.threePersp.near = 0.1; camera.threePersp.far = SCENE_FAR; camera.threePersp.updateProjectionMatrix()
    camera.threeOrtho.near = 0.1; camera.threeOrtho.far = SCENE_FAR; camera.threeOrtho.updateProjectionMatrix()
    camera.controls.maxDistance = MAX_ORBIT_DISTANCE
    camera.controls.mouseButtons.middle = CameraControls.ACTION.TRUCK
    camera.three.position.set(22, 13, 27)
    camera.controls?.setLookAt(22, 13, 27, 0, 3, 1.5, false)
    set({ camera: camera.three })
    const clipper = components.get(OBC.Clipper); clipper.enabled = false; clipper.setup({})
    components.init()
    bridge.current = { components, world, camera, renderer, clipper }
    return () => {
      clipper.dispose(); camera.dispose()
      world.enabled = false; renderer.dispose(); components.enabled = false; bridge.current = null
    }
  }, [gl, scene, set])

  useEffect(() => {
    let pointerOverViewport = false
    const setPointerInside = () => { pointerOverViewport = true }
    const setPointerOutside = () => { pointerOverViewport = false }
    const panWithArrows = (event: KeyboardEvent) => {
      if (!pointerOverViewport || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable)) return
      const controls = bridge.current?.camera.controls
      if (!controls) return
      const position = controls.getPosition(new Vector3())
      const target = controls.getTarget(new Vector3())
      const forward = target.clone().sub(position).setY(0)
      if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1)
      forward.normalize()
      const right = new Vector3(-forward.z, 0, forward.x)
      const direction = event.key === 'ArrowUp' ? forward : event.key === 'ArrowDown' ? forward.clone().negate() : event.key === 'ArrowRight' ? right : right.clone().negate()
      direction.multiplyScalar(KEYBOARD_PAN_STEP_M)
      event.preventDefault()
      void controls.setLookAt(position.x + direction.x, position.y, position.z + direction.z, target.x + direction.x, target.y, target.z + direction.z, true)
    }
    gl.domElement.addEventListener('pointerenter', setPointerInside)
    gl.domElement.addEventListener('pointerleave', setPointerOutside)
    window.addEventListener('keydown', panWithArrows)
    return () => {
      gl.domElement.removeEventListener('pointerenter', setPointerInside)
      gl.domElement.removeEventListener('pointerleave', setPointerOutside)
      window.removeEventListener('keydown', panWithArrows)
    }
  }, [gl])

  useEffect(() => { bridge.current?.renderer.resize(new Vector2(size.width, size.height)) }, [size])
  useEffect(() => {
    const current = bridge.current
    if (!current) return
    current.clipper.enabled = viewerMode === 'section'
    current.camera.controls.mouseButtons.left = viewerMode === 'measure-area' ? CameraControls.ACTION.NONE : CameraControls.ACTION.ROTATE
    if (viewerMode === 'plan') { current.camera.set('Plan'); void current.camera.projection.set('Orthographic') }
    else { current.camera.set('Orbit'); current.camera.controls.maxDistance = MAX_ORBIT_DISTANCE; void current.camera.projection.set('Perspective') }
  }, [viewerMode])
  useEffect(() => {
    if (handledRefocusRequest.current === refocusRequest) return
    handledRefocusRequest.current = refocusRequest
    const current = bridge.current; const building = project.buildings[0]
    if (!current || !building) return
    const targetX = building.position.x; const targetY = isLShapedBarn(building) ? 3 : 1.4; const targetZ = building.position.z + (isLShapedBarn(building) ? 2.5 : 0)
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    current.camera.set('Orbit'); current.camera.controls.maxDistance = MAX_ORBIT_DISTANCE; void current.camera.projection.set('Perspective')
    void current.camera.controls.setFocalOffset(0, 0, 0, smooth)
    void current.camera.controls?.setLookAt(targetX + 22, targetY + 10, targetZ + 25, targetX, targetY, targetZ, smooth)
  }, [project, refocusRequest])
  useEffect(() => {
    if (handledGardenFocusRequest.current === gardenFocusRequest.sequence) return
    handledGardenFocusRequest.current = gardenFocusRequest.sequence
    const current = bridge.current
    if (!current) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    current.camera.set('Orbit'); current.camera.controls.maxDistance = MAX_ORBIT_DISTANCE; void current.camera.projection.set('Perspective')
    void current.camera.controls.setFocalOffset(5.5, 0, 0, smooth)
    void current.camera.controls.setLookAt(gardenFocusRequest.targetX + 11, 8.5, gardenFocusRequest.targetZ - 13, gardenFocusRequest.targetX, 0.7, gardenFocusRequest.targetZ, smooth)
  }, [gardenFocusRequest])
  useEffect(() => {
    if (handledExplode.current === explode) return
    handledExplode.current = explode
    const current = bridge.current; const building = project.buildings[0]
    if (!current || !building) return
    const bounds = buildingLocalBounds(building); const width = bounds.maxX - bounds.minX; const depth = bounds.maxZ - bounds.minZ
    const highestLevel = Math.max(...building.storeys.map((storey) => storey.level))
    const roofRise = building.roof.type === 'flat' ? 0.24 : Math.tan(MathUtils.degToRad(building.roof.pitchDegrees)) * width / 2
    const explodedTop = building.roof.baseElevationM + roofRise + (highestLevel + 1) * STOREY_EXPLODE_GAP_M
    const targetX = building.position.x; const targetY = explode ? explodedTop * 0.44 : 1.4; const targetZ = building.position.z
    const span = Math.max(width + ROOM_EXPLODE_DISTANCE_M * 2, depth + ROOM_EXPLODE_DISTANCE_M * 2, explodedTop)
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    current.camera.set('Orbit'); current.camera.controls.maxDistance = MAX_ORBIT_DISTANCE; void current.camera.projection.set('Perspective')
    void current.camera.controls.setFocalOffset(0, 0, 0, smooth)
    void current.camera.controls.setLookAt(
      targetX + (explode ? span * 1.05 : 18), targetY + (explode ? span * 0.72 : 12), targetZ + (explode ? span * 1.15 : 20),
      targetX, targetY, targetZ, smooth,
    )
  }, [explode, project])
  useEffect(() => {
    const current = bridge.current
    if (!current) return
    current.world.meshes.clear()
    scene.traverse((object) => { if (object instanceof Mesh && object.userData.semanticRef) current.world.meshes.add(object) })
  }, [project, scene])
  useFrame((_, delta) => { bridge.current?.world.update(delta) })
  return null
}

function useGeneratedSolids(project: ProjectV2, building: BuildingModel) {
  const [solids, setSolids] = useState<GeneratedSolid[]>([])
  useEffect(() => {
    let active = true
    geometryService.generate(project.revision, solidInputsForBuilding(building)).then((next) => { if (active && next.length) setSolids(next) })
      .catch((error) => useStudioStore.getState().setToast(`Geometry worker: ${error instanceof Error ? error.message : 'failed'}`))
    return () => { active = false }
  }, [building, project.revision])
  return solids
}

const wallSurface: Record<WallMaterial, { roughness: number; metalness: number }> = {
  'charred-timber': { roughness: 0.94, metalness: 0.01 }, 'natural-timber': { roughness: 0.86, metalness: 0.01 },
  'light-render': { roughness: 0.98, metalness: 0 }, brick: { roughness: 1, metalness: 0 }, 'metal-panel': { roughness: 0.48, metalness: 0.62 },
}

const shade = (hex: string, factor: number) => `#${new Color(hex).multiplyScalar(factor).getHexString()}`

function GeneratedMesh({ solid, mode, selected, buildingRef, style, wall, yOffset, ghost }: { solid: GeneratedSolid; mode: ViewMode; selected: boolean; buildingRef: string; style: BuildingModel['architecturalStyle']; wall?: WallModel; yOffset: number; ghost?: boolean }) {
  const geometry = useMemo(() => {
    const value = new BufferGeometry()
    value.setAttribute('position', new BufferAttribute(solid.positions, 3)); value.setIndex(new BufferAttribute(solid.indices, 1)); value.computeVertexNormals()
    computeBoundsTree.call(value)
    return value
  }, [solid])
  useEffect(() => () => { disposeBoundsTree.call(geometry); geometry.dispose() }, [geometry])
  const isWall = Boolean(wall) || solid.ref.includes('wall'); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const palette = mode === 'technical' ? TECH : style === 'barn' ? BARN : REAL
  const finish = resolveWallFinish(wall, style); const surface = wallSurface[finish.material]
  return <mesh geometry={geometry} position={[0, yOffset, 0]} castShadow receiveShadow raycast={acceleratedRaycast} userData={{ semanticRef: solid.ref, buildingRef }} onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(solid.ref) }}>
    <meshStandardMaterial color={isWall && mode !== 'technical' ? finish.colorHex : selected ? '#b9e84d' : isWall ? palette.wall : palette.slab} emissive={isWall && selected ? '#6c812f' : '#000000'} emissiveIntensity={isWall && selected ? 0.35 : 0} transparent={Boolean(ghost)} opacity={ghost ? 0.33 : 1} depthWrite={!ghost} side={isWall ? DoubleSide : undefined} roughness={isWall ? surface.roughness : 0.78} metalness={isWall ? surface.metalness : 0.02} />
  </mesh>
}

const isLShapedBarn = (building: BuildingModel) => building.architecturalStyle === 'barn'
  && building.slabs[0]?.footprint.length === 6
  && building.walls.some((wall) => wall.ref === 'wall/front-glass')

function BarnGlazing({ building, mode, ghost }: { building: BuildingModel; mode: ViewMode; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const internalWalls = new Set(['wall/rear-partition', 'wall/wing-divider', 'wall/upper-north'])
  const panes = building.walls.flatMap((wall) => internalWalls.has(wall.ref) ? [] : wall.openings.map((opening) => ({ wall, opening })))
  return <>{panes.map(({ wall, opening }) => {
    const dx = wall.end.x - wall.start.x; const dz = wall.end.z - wall.start.z; const length = Math.hypot(dx, dz)
    const ux = dx / length; const uz = dz / length; const rotation = -Math.atan2(dz, dx)
    const x = wall.start.x + ux * opening.offsetM; const z = wall.start.z + uz * opening.offsetM
    const y = wall.baseElevationM + opening.sillM + opening.heightM / 2
    const mullions = opening.widthM > 5 ? [-opening.widthM / 6, opening.widthM / 6] : opening.widthM > 2.6 ? [0] : []
    const frame = selectedRef === opening.ref ? '#b9e84d' : mode === 'technical' ? '#516f78' : '#121817'
    return <group key={opening.ref} position={[x, y, z]} rotation={[0, rotation, 0]} userData={{ semanticRef: opening.ref, buildingRef: building.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(opening.ref) }}>
      <mesh castShadow receiveShadow><boxGeometry args={[Math.max(0.08, opening.widthM - 0.08), Math.max(0.08, opening.heightM - 0.08), 0.045]} />
        <meshPhysicalMaterial color={mode === 'technical' ? '#9bc7d2' : '#78959a'} transparent opacity={ghost ? 0.2 : mode === 'technical' ? 0.34 : 0.42} transmission={mode === 'technical' ? 0.12 : 0.55} roughness={0.08} metalness={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[0, opening.heightM / 2, 0]}><boxGeometry args={[opening.widthM + 0.08, 0.075, 0.11]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
      <mesh position={[0, -opening.heightM / 2, 0]}><boxGeometry args={[opening.widthM + 0.08, 0.075, 0.11]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
      <mesh position={[opening.widthM / 2, 0, 0]}><boxGeometry args={[0.075, opening.heightM, 0.11]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
      <mesh position={[-opening.widthM / 2, 0, 0]}><boxGeometry args={[0.075, opening.heightM, 0.11]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
      {mullions.map((offset) => <mesh key={offset} position={[offset, 0, 0]}><boxGeometry args={[0.065, opening.heightM, 0.105]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>)}
    </group>
  })}</>
}

function BarnCladding({ building, ghost }: { building: BuildingModel; ghost?: boolean }) {
  const internalWalls = new Set(['wall/rear-partition', 'wall/wing-divider', 'wall/upper-north'])
  return <>{building.walls.filter((wall) => !internalWalls.has(wall.ref)).flatMap((wall) => {
    const finish = resolveWallFinish(wall, building.architecturalStyle)
    if (!['charred-timber', 'natural-timber', 'metal-panel'].includes(finish.material)) return []
    const dx = wall.end.x - wall.start.x; const dz = wall.end.z - wall.start.z; const length = Math.hypot(dx, dz)
    const ux = dx / length; const uz = dz / length; const nx = uz; const nz = -ux; const rotation = -Math.atan2(dz, dx)
    const spacing = finish.material === 'metal-panel' ? 0.64 : 0.34
    const strips = Array.from({ length: Math.floor(length / spacing) }, (_, index) => ({ offset: spacing / 2 + index * spacing, index }))
    return strips.flatMap(({ offset, index }) => {
      const blocked = wall.openings.filter((opening) => Math.abs(offset - opening.offsetM) < opening.widthM / 2 + 0.08)
        .map((opening) => ({ start: Math.max(0, opening.sillM - 0.04), end: Math.min(wall.heightM, opening.sillM + opening.heightM + 0.04) })).sort((a, b) => a.start - b.start)
      const segments: Array<{ start: number; end: number }> = []; let cursor = 0
      blocked.forEach((interval) => { if (interval.start > cursor + 0.03) segments.push({ start: cursor, end: interval.start }); cursor = Math.max(cursor, interval.end) })
      if (cursor < wall.heightM - 0.03) segments.push({ start: cursor, end: wall.heightM })
      return segments.map((segment, segmentIndex) => <mesh key={`${wall.ref}-batten-${index}-${segmentIndex}`} position={[
        wall.start.x + ux * offset + nx * (wall.thicknessM / 2 + 0.018),
        wall.baseElevationM + (segment.start + segment.end) / 2,
        wall.start.z + uz * offset + nz * (wall.thicknessM / 2 + 0.018),
      ]} rotation={[0, rotation, 0]} castShadow>
        <boxGeometry args={[finish.material === 'metal-panel' ? 0.022 : 0.026, segment.end - segment.start, 0.038]} />
        <meshStandardMaterial color={shade(finish.colorHex, index % 3 === 0 ? 1.2 : 0.72)} roughness={finish.material === 'metal-panel' ? 0.42 : 0.96} metalness={finish.material === 'metal-panel' ? 0.65 : 0} transparent={Boolean(ghost)} opacity={ghost ? 0.32 : 1} depthWrite={!ghost} />
      </mesh>)
    })
  })}</>
}

function BarnInteriorWarmth({ mode, ghost }: { mode: ViewMode; ghost?: boolean }) {
  if (mode !== 'realistic' || ghost) return null
  return <group userData={{ editorOnly: true }}>
    <mesh position={[0, 0.465, -2]} receiveShadow><boxGeometry args={[15.7, 0.035, 5.7]} /><meshStandardMaterial color="#a9855d" roughness={0.72} /></mesh>
    <mesh position={[-5, 0.475, 5.5]} receiveShadow><boxGeometry args={[5.7, 0.045, 8.7]} /><meshStandardMaterial color="#ad8b61" roughness={0.72} /></mesh>
    <mesh position={[-5, 3.465, 5.5]} receiveShadow><boxGeometry args={[5.7, 0.035, 8.7]} /><meshStandardMaterial color="#987650" roughness={0.76} /></mesh>
    <pointLight position={[-5, 2.3, 6]} color="#ffd29a" intensity={18} distance={9} decay={2} />
    <pointLight position={[-5, 5.35, 6.5]} color="#ffd6a3" intensity={14} distance={8} decay={2} />
    <pointLight position={[3.6, 2.15, -1]} color="#ffd09a" intensity={20} distance={10} decay={2} />
  </group>
}

function roofSurfaceMaterial(segment: RoofSegmentModel, selected: boolean, mode: ViewMode, ghost?: boolean) {
  const metallic = segment.finish.material === 'standing-seam-metal'
  return <meshStandardMaterial color={selected ? '#b9e84d' : mode === 'technical' ? TECH.roof : segment.finish.colorHex} roughness={mode === 'technical' ? 0.88 : metallic ? 0.42 : 0.78} metalness={mode === 'technical' ? 0.04 : metallic ? 0.62 : 0.08} transparent={ghost} opacity={ghost ? 0.35 : 1} />
}

function LBarnRoof({ building, mode, selected, yOffset, ghost }: { building: BuildingModel; mode: ViewMode; selected: boolean; yOffset: number; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const upper = building.roof.segments.find((segment) => segment.ref.includes('upper-wing')) ?? building.roof.segments.find((segment) => segment.ridgeDirection === 'z') ?? building.roof.segments[0]
  const rear = building.roof.segments.find((segment) => segment.ref.includes('rear-wing')) ?? building.roof.segments.find((segment) => segment.ref !== upper.ref) ?? upper
  const upperBounds = polygonBounds(upper.footprint); const rearBounds = polygonBounds(rear.footprint)
  const upperPitch = MathUtils.degToRad(upper.pitchDegrees); const rearPitch = MathUtils.degToRad(rear.pitchDegrees)
  const upperWidth = upperBounds.maxX - upperBounds.minX; const upperDepth = upperBounds.maxZ - upperBounds.minZ; const upperCx = (upperBounds.minX + upperBounds.maxX) / 2; const upperCz = (upperBounds.minZ + upperBounds.maxZ) / 2
  const upperHalf = upperWidth / 2 + upper.overhangM; const upperSlope = upperHalf / Math.cos(upperPitch); const upperRise = Math.tan(upperPitch) * upperHalf
  const rearWidth = rearBounds.maxX - rearBounds.minX; const rearDepth = rearBounds.maxZ - rearBounds.minZ; const rearCx = (rearBounds.minX + rearBounds.maxX) / 2; const rearCz = (rearBounds.minZ + rearBounds.maxZ) / 2
  const rearHalf = rearDepth / 2 + rear.overhangM; const rearSlope = rearHalf / Math.cos(rearPitch); const rearRise = Math.tan(rearPitch) * rearHalf
  const wallColor = mode === 'technical' ? TECH.wall : '#242927'
  const frontUpperWall = building.walls.find((wall) => wall.ref === 'wall/upper-front-glass')
  const frontGableIsGlass = frontUpperWall ? inferWallOpeningLayout(frontUpperWall) === 'full-glass' : false
  const frontWallColor = mode === 'technical' ? TECH.wall : resolveWallFinish(frontUpperWall, building.architecturalStyle).colorHex
  const upperGable = useMemo(() => {
    const value = new BufferGeometry(); value.setAttribute('position', new BufferAttribute(new Float32Array([
      upperBounds.minX, upper.baseElevationM, 0, upperBounds.maxX, upper.baseElevationM, 0, upperCx, upper.baseElevationM + Math.tan(upperPitch) * upperWidth / 2, 0,
    ]), 3)); value.setIndex([0, 1, 2]); value.computeVertexNormals(); return value
  }, [upper.baseElevationM, upperBounds.maxX, upperBounds.minX, upperCx, upperPitch, upperWidth])
  const rearGable = useMemo(() => {
    const value = new BufferGeometry(); value.setAttribute('position', new BufferAttribute(new Float32Array([
      0, rear.baseElevationM, rearBounds.minZ, 0, rear.baseElevationM, rearBounds.maxZ, 0, rear.baseElevationM + Math.tan(rearPitch) * rearDepth / 2, rearCz,
    ]), 3)); value.setIndex([0, 1, 2]); value.computeVertexNormals(); return value
  }, [rear.baseElevationM, rearBounds.maxZ, rearBounds.minZ, rearCz, rearDepth, rearPitch])
  useEffect(() => () => { upperGable.dispose(); rearGable.dispose() }, [rearGable, upperGable])
  const upperSeams = Array.from({ length: Math.max(2, Math.floor(upperDepth / 0.72)) }, (_, index) => upperBounds.minZ + 0.36 + index * 0.72)
  const rearSeams = Array.from({ length: Math.max(2, Math.floor(rearWidth / 0.78)) }, (_, index) => rearBounds.minX + 0.39 + index * 0.78)
  const select = (ref: string) => (event: { stopPropagation: () => void }) => { event.stopPropagation(); if (!ghost) setSelectedRef(ref) }
  return <group position={[0, yOffset, 0]} userData={{ semanticRef: building.roof.ref, buildingRef: building.ref }}>
    <group userData={{ semanticRef: upper.ref, buildingRef: building.ref }} onPointerDown={select(upper.ref)}>
      <mesh position={[upperCx - upperHalf / 2, upper.baseElevationM + upperRise / 2, upperCz]} rotation={[0, 0, upperPitch]} castShadow><boxGeometry args={[upperSlope, 0.2, upperDepth + upper.overhangM * 2]} />{roofSurfaceMaterial(upper, selected || selectedRef === upper.ref, mode, ghost)}</mesh>
      <mesh position={[upperCx + upperHalf / 2, upper.baseElevationM + upperRise / 2, upperCz]} rotation={[0, 0, -upperPitch]} castShadow><boxGeometry args={[upperSlope, 0.2, upperDepth + upper.overhangM * 2]} />{roofSurfaceMaterial(upper, selected || selectedRef === upper.ref, mode, ghost)}</mesh>
      <mesh geometry={upperGable} position={[0, 0, upperBounds.minZ - 0.01]} castShadow><meshStandardMaterial color={wallColor} roughness={0.92} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} /></mesh>
      <mesh geometry={upperGable} position={[0, 0, upperBounds.maxZ + 0.02]} castShadow>{frontGableIsGlass
      ? <meshPhysicalMaterial color={mode === 'technical' ? '#9bc7d2' : '#7e999c'} transparent opacity={ghost ? 0.2 : 0.43} transmission={mode === 'technical' ? 0.1 : 0.58} roughness={0.08} side={DoubleSide} depthWrite={false} />
      : <meshStandardMaterial color={frontWallColor} roughness={0.92} side={DoubleSide} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />}</mesh>
      {frontGableIsGlass && [-upperWidth / 4, 0, upperWidth / 4].map((offset, index) => { const height = offset === 0 ? Math.tan(upperPitch) * upperWidth / 2 : Math.tan(upperPitch) * upperWidth / 4; return <mesh key={`gable-mullion-${index}`} position={[upperCx + offset, upper.baseElevationM + height / 2, upperBounds.maxZ + 0.06]}><boxGeometry args={[0.075, height, 0.1]} /><meshStandardMaterial color="#111716" roughness={0.48} /></mesh> })}
      {frontGableIsGlass && <mesh position={[upperCx, upper.baseElevationM, upperBounds.maxZ + 0.06]}><boxGeometry args={[upperWidth, 0.09, 0.1]} /><meshStandardMaterial color="#111716" roughness={0.48} /></mesh>}
      {mode === 'realistic' && upper.finish.material === 'standing-seam-metal' && upperSeams.flatMap((z) => [
        <mesh key={`ul-${z}`} position={[upperCx - upperHalf / 2, upper.baseElevationM + upperRise / 2 + 0.12, z]} rotation={[0, 0, upperPitch]}><boxGeometry args={[upperSlope, 0.025, 0.032]} /><meshStandardMaterial color={shade(upper.finish.colorHex, 0.55)} metalness={0.7} roughness={0.35} /></mesh>,
        <mesh key={`ur-${z}`} position={[upperCx + upperHalf / 2, upper.baseElevationM + upperRise / 2 + 0.12, z]} rotation={[0, 0, -upperPitch]}><boxGeometry args={[upperSlope, 0.025, 0.032]} /><meshStandardMaterial color={shade(upper.finish.colorHex, 0.55)} metalness={0.7} roughness={0.35} /></mesh>,
      ])}
    </group>
    <group userData={{ semanticRef: rear.ref, buildingRef: building.ref }} onPointerDown={select(rear.ref)}>
      <mesh position={[rearCx, rear.baseElevationM + rearRise / 2, rearCz - rearHalf / 2]} rotation={[-rearPitch, 0, 0]} castShadow><boxGeometry args={[rearWidth + rear.overhangM * 2, 0.2, rearSlope]} />{roofSurfaceMaterial(rear, selected || selectedRef === rear.ref, mode, ghost)}</mesh>
      <mesh position={[rearCx, rear.baseElevationM + rearRise / 2, rearCz + rearHalf / 2]} rotation={[rearPitch, 0, 0]} castShadow><boxGeometry args={[rearWidth + rear.overhangM * 2, 0.2, rearSlope]} />{roofSurfaceMaterial(rear, selected || selectedRef === rear.ref, mode, ghost)}</mesh>
      <mesh geometry={rearGable} position={[rearBounds.minX + 0.01, 0, 0]} castShadow><meshStandardMaterial color={wallColor} roughness={0.92} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} /></mesh>
      <mesh geometry={rearGable} position={[rearBounds.maxX - 0.01, 0, 0]} castShadow><meshStandardMaterial color={wallColor} roughness={0.92} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} /></mesh>
      {mode === 'realistic' && rear.finish.material === 'standing-seam-metal' && rearSeams.flatMap((x) => [
        <mesh key={`rn-${x}`} position={[x, rear.baseElevationM + rearRise / 2 + 0.12, rearCz - rearHalf / 2]} rotation={[-rearPitch, 0, 0]}><boxGeometry args={[0.032, 0.025, rearSlope]} /><meshStandardMaterial color={shade(rear.finish.colorHex, 0.55)} metalness={0.7} roughness={0.35} /></mesh>,
        <mesh key={`rs-${x}`} position={[x, rear.baseElevationM + rearRise / 2 + 0.12, rearCz + rearHalf / 2]} rotation={[rearPitch, 0, 0]}><boxGeometry args={[0.032, 0.025, rearSlope]} /><meshStandardMaterial color={shade(rear.finish.colorHex, 0.55)} metalness={0.7} roughness={0.35} /></mesh>,
      ])}
    </group>
  </group>
}

function Roof({ building, mode, selected, yOffset, ghost }: { building: BuildingModel; mode: ViewMode; selected: boolean; yOffset: number; ghost?: boolean }) {
  if (isLShapedBarn(building)) return <LBarnRoof building={building} mode={mode} selected={selected} yOffset={yOffset} ghost={ghost} />
  const segment = building.roof.segments[0]; const bounds = polygonBounds(segment.footprint); const width = bounds.maxX - bounds.minX; const depth = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2; const cz = (bounds.minZ + bounds.maxZ) / 2; const over = segment.overhangM; const pitch = MathUtils.degToRad(segment.pitchDegrees)
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const palette = mode === 'technical' ? TECH : building.architecturalStyle === 'barn' ? BARN : REAL; const segmentSelected = selected || selectedRef === segment.ref
  const material = roofSurfaceMaterial(segment, segmentSelected, mode, ghost)
  const half = width / 2 + over; const slope = half / Math.cos(pitch); const rise = Math.tan(pitch) * half
  const gableEnds = useMemo(() => {
    const value = new BufferGeometry(); const z0 = bounds.minZ; const z1 = bounds.maxZ; const ridgeY = segment.baseElevationM + Math.tan(pitch) * width / 2
    value.setAttribute('position', new BufferAttribute(new Float32Array([
      bounds.minX, segment.baseElevationM, z0, bounds.maxX, segment.baseElevationM, z0, cx, ridgeY, z0,
      bounds.minX, segment.baseElevationM, z1, bounds.maxX, segment.baseElevationM, z1, cx, ridgeY, z1,
    ]), 3)); value.setIndex([0, 1, 2, 3, 5, 4]); value.computeVertexNormals(); return value
  }, [bounds.maxX, bounds.maxZ, bounds.minX, bounds.minZ, cx, pitch, segment.baseElevationM, width])
  const hipGeometry = useMemo(() => {
    const value = new BufferGeometry(); const apexY = segment.baseElevationM + rise
    value.setAttribute('position', new BufferAttribute(new Float32Array([
      bounds.minX - over, segment.baseElevationM, bounds.minZ - over, bounds.maxX + over, segment.baseElevationM, bounds.minZ - over,
      bounds.maxX + over, segment.baseElevationM, bounds.maxZ + over, bounds.minX - over, segment.baseElevationM, bounds.maxZ + over,
      cx, apexY, cz,
    ]), 3)); value.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]); value.computeVertexNormals(); return value
  }, [bounds.maxX, bounds.maxZ, bounds.minX, bounds.minZ, cx, cz, over, rise, segment.baseElevationM])
  useEffect(() => () => { gableEnds.dispose(); hipGeometry.dispose() }, [gableEnds, hipGeometry])
  const selectSegment = (event: { stopPropagation: () => void }) => { event.stopPropagation(); if (!ghost) setSelectedRef(segment.ref) }
  if (segment.type === 'flat') return <mesh position={[cx, segment.baseElevationM + 0.12 + yOffset, cz]} castShadow userData={{ semanticRef: segment.ref, buildingRef: building.ref }} onPointerDown={selectSegment}><boxGeometry args={[width + over * 2, 0.24, depth + over * 2]} />{material}</mesh>
  if (segment.type === 'hip') return <mesh geometry={hipGeometry} position={[0, yOffset, 0]} castShadow userData={{ semanticRef: segment.ref, buildingRef: building.ref }} onPointerDown={selectSegment}>{material}</mesh>
  return <group position={[0, yOffset, 0]} userData={{ semanticRef: segment.ref, buildingRef: building.ref }} onPointerDown={selectSegment}>
    <mesh position={[cx - half / 2, segment.baseElevationM + rise / 2, cz]} rotation={[0, 0, pitch]} castShadow><boxGeometry args={[slope, 0.2, depth + over * 2]} />{material}</mesh>
    <mesh position={[cx + half / 2, segment.baseElevationM + rise / 2, cz]} rotation={[0, 0, -pitch]} castShadow><boxGeometry args={[slope, 0.2, depth + over * 2]} />{material}</mesh>
    <mesh geometry={gableEnds} castShadow><meshStandardMaterial color={palette.wall} roughness={0.8} side={DoubleSide} transparent={ghost} opacity={ghost ? 0.35 : 1} /></mesh>
  </group>
}

function FinishSurface({ footprint, y, refValue, buildingRef, color }: { footprint: Polygon2; y: number; refValue: string; buildingRef: string; color: string }) {
  const geometry = useMemo(() => localPolygonGeometry(footprint), [footprint])
  useEffect(() => () => geometry.dispose(), [geometry])
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  return <mesh geometry={geometry} position={[0, y, 0]} userData={{ semanticRef: refValue, buildingRef }} onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(refValue) }}><meshStandardMaterial color={selectedRef === refValue ? '#b9e84d' : color} side={DoubleSide} roughness={0.75} /></mesh>
}

function PlatformsAndFinishes({ building, explodeOffset }: { building: BuildingModel; explodeOffset: number }) {
  return <>{building.platforms.map((platform) => {
    const storey = building.storeys.find((item) => item.platformRefs.includes(platform.ref)); return <FinishSurface key={platform.ref} footprint={platform.footprint} y={platform.elevationM + (storey?.level ?? 0) * explodeOffset} refValue={platform.ref} buildingRef={building.ref} color="#a18a66" />
  })}{building.ceilingFinishes.map((finish) => {
    const space = building.spaces.find((item) => item.ref === finish.spaceRef); const storey = building.storeys.find((item) => item.ceilingFinishRefs.includes(finish.ref)); if (!space) return null
    return <FinishSurface key={finish.ref} footprint={spaceFootprint(building, space)} y={finish.elevationM + (storey?.level ?? 0) * explodeOffset} refValue={finish.ref} buildingRef={building.ref} color="#d8d5c8" />
  })}</>
}

function SpaceOverlay({ building, spaceRef, explodedOffset, explode }: { building: BuildingModel; spaceRef: string; explodedOffset: number; explode: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const space = building.spaces.find((item) => item.ref === spaceRef)!; const storey = building.storeys.find((item) => item.spaceRefs.includes(space.ref))!
  const footprint = useMemo(() => spaceFootprint(building, space), [building, space])
  const geometry = useMemo(() => localPolygonGeometry(footprint), [footprint])
  useEffect(() => () => geometry.dispose(), [geometry])
  const centroid = polygonCentroid(footprint); const bounds = buildingLocalBounds(building)
  const buildingCenter = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
  const storeySpaces = storey.spaceRefs.filter((ref) => building.spaces.some((item) => item.ref === ref)); const roomIndex = Math.max(0, storeySpaces.indexOf(space.ref))
  let directionX = centroid.x - buildingCenter.x; let directionZ = centroid.z - buildingCenter.z
  if (Math.hypot(directionX, directionZ) < 0.25) {
    const angle = -Math.PI / 4 + roomIndex * (Math.PI * 2 / Math.max(1, storeySpaces.length))
    directionX = Math.cos(angle); directionZ = Math.sin(angle)
  }
  const magnitude = Math.hypot(directionX, directionZ) || 1
  const roomOffset = explode ? { x: directionX / magnitude * ROOM_EXPLODE_DISTANCE_M, z: directionZ / magnitude * ROOM_EXPLODE_DISTANCE_M } : { x: 0, z: 0 }
  const y = storey.elevationM + 0.024 + storey.level * explodedOffset
  const outline = [...footprint, footprint[0]].map((point) => new Vector3(point.x + roomOffset.x, y + 0.035, point.z + roomOffset.z))
  return <>
    {explode && <DreiLine points={[new Vector3(centroid.x, y + 0.04, centroid.z), new Vector3(centroid.x + roomOffset.x, y + 0.04, centroid.z + roomOffset.z)]} color="#7d948b" lineWidth={1} transparent opacity={0.7} depthTest={false} />}
    <group position={[roomOffset.x, y, roomOffset.z]}>
      <mesh geometry={geometry} userData={{ semanticRef: space.ref, buildingRef: building.ref, explodedRoom: explode }} onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(space.ref) }}>
        <meshBasicMaterial color={selectedRef === space.ref ? '#b9e84d' : '#72c6b7'} transparent opacity={explode ? 0.56 : selectedRef === space.ref ? 0.42 : 0.12} side={DoubleSide} depthWrite={false} />
      </mesh>
      {explode && <Html position={[centroid.x, 0.42, centroid.z]} center zIndexRange={[12, 0]}>
        <div className="exploded-room-label" aria-label={`${space.name}, ${storey.name}`} data-space-ref={space.ref} data-storey-ref={storey.ref}>
          <span>{storey.name}</span><strong>{space.name}</strong>
        </div>
      </Html>}
    </group>
    {explode && <DreiLine points={outline} color="#b9e84d" lineWidth={1.6} transparent opacity={0.88} depthTest={false} />}
  </>
}

function SpaceOverlays({ building, explodedOffset, explode }: { building: BuildingModel; explodedOffset: number; explode: boolean }) {
  return <>{building.spaces.map((space) => <SpaceOverlay key={space.ref} building={building} spaceRef={space.ref} explodedOffset={explodedOffset} explode={explode} />)}</>
}

const buildingCornersWorld = (building: BuildingModel, position = building.position) => {
  const bounds = buildingLocalBounds(building); const rotation = MathUtils.degToRad(building.rotationDegrees); const c = Math.cos(rotation); const s = Math.sin(rotation)
  return [{ x: bounds.minX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.maxZ }, { x: bounds.minX, z: bounds.maxZ }].map((point) => ({ x: position.x + point.x * c + point.z * s, z: position.z - point.x * s + point.z * c }))
}

const placementValid = (project: ProjectV2, building: BuildingModel, position: { x: number; z: number }) => {
  const corners = buildingCornersWorld(building, position)
  const constructionParcels = project.site.parcels.filter((parcel) => parcel.landRole === 'construction')
  if (!corners.every((corner) => constructionParcels.some((parcel) => pointInPolygon(corner, parcel.boundary)))) return false
  return project.buildings.filter((other) => other.ref !== building.ref).every((other) => {
    const b = buildingCornersWorld(other); const ax = corners.map((p) => p.x); const az = corners.map((p) => p.z); const bx = b.map((p) => p.x); const bz = b.map((p) => p.z)
    return Math.max(...ax) <= Math.min(...bx) || Math.min(...ax) >= Math.max(...bx) || Math.max(...az) <= Math.min(...bz) || Math.min(...az) >= Math.max(...bz)
  })
}

function Building({ project, building, mode, ghost }: { project: ProjectV2; building: BuildingModel; mode: ViewMode; ghost?: boolean }) {
  const solids = useGeneratedSolids(project, building); const selectedRef = useStudioStore((state) => state.selectedRef); const transformMode = useStudioStore((state) => state.transformMode)
  const viewerMode = useStudioStore((state) => state.viewerMode); const explode = useStudioStore((state) => state.explodeStoreys)
  const commitCommand = useStudioStore((state) => state.commitCommand); const setToast = useStudioStore((state) => state.setToast); const repositioningRef = useStudioStore((state) => state.repositioningRef); const endReposition = useStudioStore((state) => state.endReposition)
  const group = useRef<Group>(null); const invalid = useRef(false); const selected = selectedRef === building.ref
  const explodedOffset = explode ? STOREY_EXPLODE_GAP_M : 0
  const terrainOffset = buildingGroundOffset(building, TERRAIN_SURFACE_Y)
  const offsetFor = (ref: string) => {
    const storey = building.storeys.find((item) => item.wallRefs.includes(ref) || item.baseSlabRef === ref)
    return (storey?.level ?? 0) * explodedOffset
  }
  const roofOffset = explode ? (Math.max(...building.storeys.map((storey) => storey.level)) + 1) * explodedOffset : 0
  const roofBounds = buildingLocalBounds(building); const roofWidth = roofBounds.maxX - roofBounds.minX + building.roof.overhangM * 2; const roofDepth = roofBounds.maxZ - roofBounds.minZ + building.roof.overhangM * 2
  return <>
    <group ref={group} position={[building.position.x, terrainOffset, building.position.z]} rotation={[0, -MathUtils.degToRad(building.rotationDegrees), 0]} userData={{ semanticRef: building.ref, buildingRef: building.ref, captureRoot: true, captureSource: ghost ? 'ghost' : 'committed' }} onDoubleClick={(event) => { event.stopPropagation(); useStudioStore.getState().setSelectedRef(building.ref) }}>
      {solids.map((solid) => <GeneratedMesh key={solid.ref} solid={solid} mode={mode} selected={selectedRef === solid.ref} buildingRef={building.ref} style={building.architecturalStyle} wall={building.walls.find((wall) => wall.ref === solid.ref)} yOffset={offsetFor(solid.ref)} ghost={ghost} />)}
      {isLShapedBarn(building) && <BarnGlazing building={building} mode={mode} ghost={ghost} />}
      {isLShapedBarn(building) && mode === 'realistic' && <BarnCladding building={building} ghost={ghost} />}
      {isLShapedBarn(building) && <BarnInteriorWarmth mode={mode} ghost={ghost} />}
      <Roof building={building} mode={mode} selected={selectedRef === building.roof.ref} yOffset={roofOffset} ghost={ghost} />
      {!ghost && <><SpaceOverlays building={building} explodedOffset={explodedOffset} explode={explode} /><PlatformsAndFinishes building={building} explodeOffset={explodedOffset} /></>}
      {!ghost && <RigidBody type="fixed" colliders={false}>{solids.map((solid) => <CuboidCollider key={solid.ref} args={solid.collider.halfExtents} position={[solid.collider.center[0], solid.collider.center[1] + offsetFor(solid.ref), solid.collider.center[2]]} rotation={[0, solid.collider.rotationY, 0]} />)}<CuboidCollider args={[roofWidth / 2, 0.2, roofDepth / 2]} position={[(roofBounds.minX + roofBounds.maxX) / 2, building.roof.baseElevationM + 0.2 + roofOffset, (roofBounds.minZ + roofBounds.maxZ) / 2]} /></RigidBody>}
    </group>
    {selected && repositioningRef === building.ref && !ghost && viewerMode === 'edit' && group.current && <TransformControls object={group.current} mode={transformMode === 'scale' ? 'translate' : transformMode} showY={false} userData={{ editorOnly: true }}
      onObjectChange={() => {
        if (!group.current) return
        invalid.current = !placementValid(project, building, { x: group.current.position.x, z: group.current.position.z })
        group.current.traverse((object) => { if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) object.material.emissive.set(invalid.current ? '#8b161d' : '#000000') })
      }}
      onMouseUp={() => {
        if (!group.current) return
        if (invalid.current) { group.current.position.set(building.position.x, terrainOffset, building.position.z); setToast('Placement reverted: collision, missing site support, or out-of-site footprint.') }
        else commitCommand({ type: 'building.update', action: 'move', buildingRef: building.ref, position: { x: group.current.position.x, z: group.current.position.z }, rotationDegrees: MathUtils.radToDeg(-group.current.rotation.y) })
        endReposition()
      }} />}
  </>
}

function ParcelSurface({ boundary, landRole, mode }: { boundary: Polygon2; landRole: 'construction' | 'agricultural'; mode: ViewMode }) {
  const geometry = useMemo(() => localPolygonGeometry(boundary), [boundary])
  const edges = useMemo(() => new EdgesGeometry(geometry, 1), [geometry])
  useEffect(() => () => { edges.dispose(); geometry.dispose() }, [edges, geometry])
  const construction = landRole === 'construction'
  const fill = construction
    ? (mode === 'technical' ? '#8fa57c' : '#829665')
    : (mode === 'technical' ? '#84996d' : '#627b50')
  return <group>
    <mesh geometry={geometry} position={[0, TERRAIN_SURFACE_Y + 0.006, 0]} renderOrder={1} receiveShadow>
      <meshStandardMaterial color={fill} transparent opacity={construction ? 0.34 : 0.82} roughness={1} side={DoubleSide} depthWrite={!construction} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
    <lineSegments geometry={edges} position={[0, TERRAIN_SURFACE_Y + 0.012, 0]} renderOrder={2}>
      <lineBasicMaterial color={construction ? '#526b45' : '#4d6841'} transparent opacity={construction ? 0.95 : 0.88} depthWrite={false} />
    </lineSegments>
  </group>
}

function RoadEntranceMarker({ entrance, mode }: { entrance: SiteEntranceModel; mode: ViewMode }) {
  const start = entrance.start; const end = entrance.end
  const centerX = (start.x + end.x) / 2; const centerZ = (start.z + end.z) / 2
  const length = Math.hypot(end.x - start.x, end.z - start.z); const angle = -Math.atan2(end.z - start.z, end.x - start.x)
  const markerColor = mode === 'technical' ? '#f4c84a' : '#e9b92f'
  return <group position={[centerX, TERRAIN_SURFACE_Y + 0.055, centerZ]} rotation={[0, angle, 0]} userData={{ semanticRef: entrance.ref }}>
    <mesh renderOrder={5} receiveShadow><boxGeometry args={[length, 0.07, 0.72]} /><meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={0.14} roughness={0.72} /></mesh>
    {[-length / 2, length / 2].map((offset, index) => <mesh key={index} position={[offset, 0.43, 0]} castShadow><cylinderGeometry args={[0.09, 0.11, 0.86, 10]} /><meshStandardMaterial color="#f7d568" roughness={0.62} /></mesh>)}
    <Html center position={[0, 1.25, 0]} distanceFactor={15} style={{ pointerEvents: 'none' }}>
      <span className="site-entrance-label">{entrance.name}</span>
    </Html>
  </group>
}

function TerrainAndSite({ project, mode }: { project: ProjectV2; mode: ViewMode }) {
  const boundaryGeometry = useMemo(() => localPolygonGeometry(project.site.boundary), [project.site.boundary])
  const landBounds = useMemo(() => project.site.parcels.flatMap((parcel) => parcel.boundary).reduce((box, point) => box.expandByPoint(new Vector3(point.x, 0, point.z)), new Box3()), [project.site.parcels])
  const landCenter = landBounds.getCenter(new Vector3()); const landSize = landBounds.getSize(new Vector3())
  useEffect(() => () => boundaryGeometry.dispose(), [boundaryGeometry])
  return <group userData={{ semanticRef: 'site' }}>
    <mesh geometry={boundaryGeometry} position={[0, TERRAIN_SURFACE_Y, 0]} receiveShadow userData={{ semanticRef: 'site/terrain' }}><meshStandardMaterial color={mode === 'technical' ? TECH.soil : REAL.soil} roughness={1} side={DoubleSide} /></mesh>
    {project.site.parcels.map((parcel) => <ParcelSurface key={parcel.ref} boundary={parcel.boundary} landRole={parcel.landRole} mode={mode} />)}
    {project.site.entrances.map((entrance) => <RoadEntranceMarker key={entrance.ref} entrance={entrance} mode={mode} />)}
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[Math.max(1, landSize.x / 2), 0.08, Math.max(1, landSize.z / 2)]} position={[landCenter.x, TERRAIN_SURFACE_Y - 0.08, landCenter.z]} /></RigidBody>
  </group>
}

const zoneColor: Record<LandscapeZone['kind'], string> = { lawn: '#738e55', terrace: '#c5b99b', path: '#c1b695', driveway: '#a69f8f', bed: '#684f44', 'rain-garden': '#4f8075', vegetable: '#66834d' }
function Landscape({ project }: { project: ProjectV2 }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  return <>{project.landscape.zones.map((zone) => {
    const center = polygonCentroid(zone.footprint); const y = elevationAt(project, center.x, center.z) + 0.02
    return <mesh key={zone.ref} geometry={localPolygonGeometry(zone.footprint)} position={[0, y, 0]} receiveShadow userData={{ semanticRef: zone.ref }} onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(zone.ref) }}><meshStandardMaterial color={selectedRef === zone.ref ? '#b9e84d' : zoneColor[zone.kind]} roughness={0.95} side={DoubleSide} /></mesh>
  })}{project.landscape.plants.map((plant) => <Plant key={plant.ref} plant={plant} project={project} selected={selectedRef === plant.ref} onSelect={() => setSelectedRef(plant.ref)} />)}</>
}

function Plant({ plant, project, selected, onSelect, ghost = false }: { plant: PlantModel; project: ProjectV2; selected: boolean; onSelect: () => void; ghost?: boolean }) {
  const month = useStudioStore((state) => state.month); const repositioningRef = useStudioStore((state) => state.repositioningRef); const commitCommand = useStudioStore((state) => state.commitCommand); const endReposition = useStudioStore((state) => state.endReposition); const setToast = useStudioStore((state) => state.setToast)
  const y = elevationAt(project, plant.position.x, plant.position.z); const canopy = Math.max(0.25, plant.canopyM / 2); const visibleLeaf = plant.leafMonths.includes(month); const group = useRef<Group>(null)
  return <><group ref={group} position={[plant.position.x, y, plant.position.z]} userData={{ semanticRef: plant.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) onSelect() }}>
    <mesh position={[0, plant.matureHeightM * 0.28, 0]} castShadow={!ghost}><cylinderGeometry args={[0.1, 0.15, plant.matureHeightM * 0.56, 8]} /><meshStandardMaterial color="#584434" transparent={ghost} opacity={ghost ? 0.42 : 1} /></mesh>
    <mesh position={[0, plant.matureHeightM * 0.72, 0]} castShadow={!ghost}><sphereGeometry args={[canopy, 12, 9]} /><meshStandardMaterial color={selected ? '#b9e84d' : ghost ? '#b9e84d' : visibleLeaf ? '#477348' : '#756955'} transparent opacity={ghost ? 0.38 : visibleLeaf ? 0.92 : 0.52} depthWrite={!ghost} /></mesh>
  </group>{selected && !ghost && repositioningRef === plant.ref && group.current && <TransformControls object={group.current} mode="translate" showY={false} userData={{ editorOnly: true }} onMouseUp={() => {
    if (!group.current) return
    try { commitCommand({ type: 'plant.update', action: 'move', plantRef: plant.ref, position: { x: group.current.position.x, z: group.current.position.z } }) }
    catch (error) { group.current.position.set(plant.position.x, y, plant.position.z); setToast(error instanceof Error ? error.message : 'Plant move could not be applied.') }
    finally { endReposition() }
  }} />}</>
}

const fixtureMaterial = (color: string, selected: boolean, ghost: boolean) => <meshStandardMaterial color={selected ? '#b9e84d' : color} roughness={0.82} transparent={ghost} opacity={ghost ? 0.42 : 1} />

function RaisedBedFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <mesh position={[0, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[2.16, 0.32, 0.96]} />{fixtureMaterial('#473426', selected, ghost)}</mesh>
    <mesh position={[0, 0.43, 0]} castShadow><boxGeometry args={[2.08, 0.09, 0.88]} />{fixtureMaterial('#5c4936', selected, ghost)}</mesh>
    {[[-1.13, 0], [1.13, 0]].map(([x, z], index) => <mesh key={`end-${index}`} position={[x, 0.28, z]} castShadow><boxGeometry args={[0.12, 0.46, 1.2]} />{fixtureMaterial('#8b623d', selected, ghost)}</mesh>)}
    {[[-0.54], [0.54]].map(([z], index) => <mesh key={`side-${index}`} position={[0, 0.28, z]} castShadow><boxGeometry args={[2.4, 0.46, 0.12]} />{fixtureMaterial('#8b623d', selected, ghost)}</mesh>)}
  </group>
}

function TomatoRowFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>{[-0.78, -0.26, 0.26, 0.78].map((x, index) => <group key={x} position={[x, 0, index % 2 ? 0.12 : -0.12]}>
    <mesh position={[0, 0.72, 0]} castShadow><cylinderGeometry args={[0.018, 0.025, 1.44, 6]} />{fixtureMaterial('#705039', selected, ghost)}</mesh>
    <mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.86, 7]} />{fixtureMaterial('#3e703f', selected, ghost)}</mesh>
    {[0.36, 0.58, 0.78].map((y, leafIndex) => <mesh key={y} position={[leafIndex % 2 ? -0.1 : 0.1, y, 0]} scale={[1.4, 0.7, 1]} castShadow><sphereGeometry args={[0.14, 8, 6]} />{fixtureMaterial('#4f8248', selected, ghost)}</mesh>)}
    {[0.43, 0.66].map((y, fruitIndex) => <mesh key={y} position={[fruitIndex ? 0.08 : -0.08, y, 0.1]} castShadow><sphereGeometry args={[0.055, 8, 6]} />{fixtureMaterial('#b84f36', selected, ghost)}</mesh>)}
  </group>)}</group>
}

function PotatoRowFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>{[-0.84, -0.42, 0, 0.42, 0.84].map((x, index) => <group key={x} position={[x, 0, index % 2 ? 0.1 : -0.1]}>
    {[[-0.1, 0.25, 0], [0.08, 0.32, 0.06], [0.02, 0.21, -0.1]].map(([dx, y, dz], leafIndex) => <mesh key={leafIndex} position={[dx, y, dz]} rotation={[0, leafIndex * 0.9, 0.3]} scale={[1.2, 0.55, 0.8]} castShadow><sphereGeometry args={[0.2, 8, 6]} />{fixtureMaterial('#527b43', selected, ghost)}</mesh>)}
  </group>)}</group>
}

function CucumberTrellisFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    {[-1.02, 1.02].map((x) => <mesh key={x} position={[x, 0.72, 0]} castShadow><cylinderGeometry args={[0.035, 0.045, 1.44, 6]} />{fixtureMaterial('#886444', selected, ghost)}</mesh>)}
    <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.035, 0.04, 2.12, 6]} />{fixtureMaterial('#886444', selected, ghost)}</mesh>
    {[-0.82, -0.41, 0, 0.41, 0.82].map((x, index) => <group key={x} position={[x, 0, 0]}>
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.012, 0.018, 1.34, 5]} />{fixtureMaterial('#467143', selected, ghost)}</mesh>
      {[0.28, 0.58, 0.9].map((y, leafIndex) => <mesh key={y} position={[leafIndex % 2 ? -0.09 : 0.09, y, 0.05]} scale={[1.2, 0.65, 1]} castShadow><sphereGeometry args={[0.12, 7, 5]} />{fixtureMaterial('#548249', selected, ghost)}</mesh>)}
      {index % 2 === 0 && <mesh position={[0.07, 0.68, 0.12]} rotation={[0, 0, 0.25]} castShadow><capsuleGeometry args={[0.035, 0.18, 4, 7]} />{fixtureMaterial('#6a9a4c', selected, ghost)}</mesh>}
    </group>)}
  </group>
}

function GardenFixture({ fixture, project, ghost = false }: { fixture: GardenFixtureModel; project: ProjectV2; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const repositioningRef = useStudioStore((state) => state.repositioningRef); const commitCommand = useStudioStore((state) => state.commitCommand); const endReposition = useStudioStore((state) => state.endReposition); const setToast = useStudioStore((state) => state.setToast)
  const definition = gardenFixtureById(fixture.catalogId)
  const hostedInBed = definition.category === 'crop' && project.landscape.fixtures.some((candidate) => candidate.catalogId === 'raised-bed-2x1' && Math.hypot(candidate.position.x - fixture.position.x, candidate.position.z - fixture.position.z) < 0.15)
  const y = elevationAt(project, fixture.position.x, fixture.position.z) + (hostedInBed ? 0.43 : 0.02)
  const selected = selectedRef === fixture.ref; const group = useRef<Group>(null)
  return <><group ref={group} position={[fixture.position.x, y, fixture.position.z]} rotation={[0, -MathUtils.degToRad(fixture.rotationDegrees), 0]} userData={{ semanticRef: fixture.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(fixture.ref) }}>
    {fixture.catalogId === 'raised-bed-2x1' ? <RaisedBedFixture selected={selected} ghost={ghost} /> : fixture.catalogId === 'tomato-row' ? <TomatoRowFixture selected={selected} ghost={ghost} /> : fixture.catalogId === 'potato-row' ? <PotatoRowFixture selected={selected} ghost={ghost} /> : <CucumberTrellisFixture selected={selected} ghost={ghost} />}
  </group>{selected && !ghost && repositioningRef === fixture.ref && group.current && <TransformControls object={group.current} mode="translate" showY={false} userData={{ editorOnly: true }} onMouseUp={() => {
    if (!group.current) return
    try { commitCommand({ type: 'garden-fixture.update', action: 'move', fixtureRef: fixture.ref, position: { x: group.current.position.x, z: group.current.position.z } }) }
    catch (error) { group.current.position.set(fixture.position.x, y, fixture.position.z); setToast(error instanceof Error ? error.message : 'Fixture move could not be applied.') }
    finally { endReposition() }
  }} />}</>
}

function GardenFixtures({ project, fixtures = project.landscape.fixtures, ghost = false }: { project: ProjectV2; fixtures?: GardenFixtureModel[]; ghost?: boolean }) {
  return <>{fixtures.map((fixture) => <GardenFixture key={`${ghost ? 'ghost-' : ''}${fixture.ref}`} fixture={fixture} project={project} ghost={ghost} />)}</>
}

const selectedBounds = (project: ProjectV2, refs: string[]) => refs.reduce((box, ref) => {
  const building = project.buildings.find((item) => item.ref === ref)!; const bounds = buildingLocalBounds(building)
  const y0 = Math.min(...building.slabs.map((slab) => slab.topElevationM - slab.thicknessM)); const y1 = building.roof.baseElevationM + 5
  buildingCornersWorld(building).forEach((point) => { box.expandByPoint(new Vector3(point.x, y0, point.z)); box.expandByPoint(new Vector3(point.x, y1, point.z)) })
  return box
}, new Box3())

const makeCaptureCamera = (view: ExpandedStructureView, project: ProjectV2, aspect: number) => {
  const bounds = view.type === 'site-plan'
    ? project.site.boundary.reduce((box, point) => box.expandByPoint(new Vector3(point.x, 0, point.z)), new Box3()).expandByScalar(1.5)
    : selectedBounds(project, view.buildingRefs)
  const center = bounds.getCenter(new Vector3()); const size = bounds.getSize(new Vector3()); const span = Math.max(size.x, size.y, size.z, 10)
  if (view.type === 'axonometric') { const camera = new PerspectiveCamera(34, aspect, 0.1, 500); camera.position.copy(center).add(new Vector3(span * 1.5, span, span * 1.5)); camera.lookAt(center); camera.updateProjectionMatrix(); return camera }
  const camera = new OrthographicCamera(-span * aspect * 0.62, span * aspect * 0.62, span * 0.62, -span * 0.62, 0.1, 500)
  if (view.type === 'site-plan' || view.type === 'storey-plan') camera.position.copy(center).add(new Vector3(0, span * 3, 0.001))
  else {
    const north = MathUtils.degToRad(project.site.northDegrees); let angle = north
    if (view.type === 'south-elevation') angle += Math.PI
    if (view.type === 'east-elevation') angle += Math.PI / 2
    if (view.type === 'west-elevation') angle -= Math.PI / 2
    if (view.type === 'section') angle += view.axis === 'transverse' ? Math.PI / 2 : 0
    camera.position.copy(center).add(new Vector3(Math.sin(angle) * span * 3, size.y * 0.15, Math.cos(angle) * span * 3))
  }
  camera.lookAt(center); camera.updateProjectionMatrix(); return camera
}

const pixelsToBlob = (pixels: Uint8Array, width: number, height: number, title: string, project: ProjectV2, names: string[], annotations: boolean) => new Promise<Blob>((resolve, reject) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d')
  if (!context) { reject(new Error('2D report canvas unavailable.')); return }
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y += 1) image.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4)
  context.putImageData(image, 0, 0)
  if (annotations) {
    context.fillStyle = 'rgba(10,16,15,.82)'; context.fillRect(0, 0, width, 62); context.fillRect(0, height - 42, width, 42)
    context.fillStyle = '#f1f5ed'; context.font = '600 24px system-ui'; context.fillText(title, 24, 39); context.font = '13px system-ui'; context.fillStyle = '#c8d3cc'; context.fillText(names.join(' · '), 24, height - 16)
    context.strokeStyle = '#b9e84d'; context.lineWidth = 3; context.beginPath(); context.moveTo(width - 48, 44); context.lineTo(width - 48, 18); context.stroke(); context.fillStyle = '#b9e84d'; context.beginPath(); context.moveTo(width - 48, 12); context.lineTo(width - 54, 23); context.lineTo(width - 42, 23); context.fill(); context.fillText('N', width - 72, 30)
    context.strokeStyle = '#f1f5ed'; context.lineWidth = 4; context.beginPath(); context.moveTo(width - 180, height - 20); context.lineTo(width - 80, height - 20); context.stroke(); context.fillText('5 m', width - 172, height - 27); context.fillText(`site north ${project.site.northDegrees.toFixed(1)}°`, width - 340, height - 16)
  }
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG report encoding failed.')), 'image/png')
})

function StructureCaptureController() {
  const { gl, scene } = useThree()
  useEffect(() => registerStructureViewCapture(async (project, views, includeAnnotations, signal) => {
    const width = 960; const height = 640; const target = new WebGLRenderTarget(width, height, { minFilter: LinearFilter, magFilter: LinearFilter })
    const previousTarget = gl.getRenderTarget(); const previousClipping = [...gl.clippingPlanes]; const previousLocal = gl.localClippingEnabled; const visibility = new Map<Object3D, boolean>(); const materialState = new Map<MeshStandardMaterial, { transparent: boolean; opacity: number }>(); const results: StructureReport['views'] = []
    const source = project === useStudioStore.getState().project ? 'committed' : 'ghost'
    scene.traverse((object) => { if (object.userData.editorOnly) { visibility.set(object, object.visible); object.visible = false } })
    try {
      for (const view of views) {
        if (signal.aborted) throw new DOMException('Architectural report cancelled.', 'AbortError')
        scene.traverse((object) => {
          if (!object.userData.captureRoot) return
          const ref = object.userData.buildingRef as string
          if (!visibility.has(object)) visibility.set(object, object.visible)
          object.visible = view.buildingRefs.includes(ref) && object.userData.captureSource === source
          if (object.visible) object.traverse((child) => {
            if (!(child instanceof Mesh)) return
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((material) => {
              if (!(material instanceof MeshStandardMaterial) || materialState.has(material)) return
              materialState.set(material, { transparent: material.transparent, opacity: material.opacity }); material.transparent = false; material.opacity = 1
            })
          })
        })
        const camera = makeCaptureCamera(view, project, width / height); gl.clippingPlanes = []
        if (view.type === 'storey-plan') { const storey = project.buildings.flatMap((building) => building.storeys).find((item) => item.ref === view.storeyRef)!; gl.clippingPlanes = [new Plane(new Vector3(0, -1, 0), storey.elevationM + storey.clearHeightM + 0.08)] }
        if (view.type === 'section') { const box = selectedBounds(project, view.buildingRefs); const center = box.getCenter(new Vector3()); const offset = view.offsetM ?? 0; gl.clippingPlanes = [new Plane(view.axis === 'longitudinal' ? new Vector3(0, 0, -1) : new Vector3(-1, 0, 0), view.axis === 'longitudinal' ? center.z + offset : center.x + offset)] }
        gl.localClippingEnabled = true; gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera)
        const pixels = new Uint8Array(width * height * 4); gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
        const names = view.buildingRefs.map((ref) => project.buildings.find((building) => building.ref === ref)!.name); const blob = await pixelsToBlob(pixels, width, height, view.title, project, names, includeAnnotations)
        results.push({ type: view.type, title: view.title, buildingRefs: view.buildingRefs, ...(view.type === 'storey-plan' ? { storeyRef: view.storeyRef } : {}), presentation: 'visible-in-page', imageUrl: URL.createObjectURL(blob) })
      }
      return results
    } catch (error) { results.forEach((view) => URL.revokeObjectURL(view.imageUrl)); throw error }
    finally { visibility.forEach((visible, object) => { object.visible = visible }); materialState.forEach((state, material) => { material.transparent = state.transparent; material.opacity = state.opacity }); gl.setRenderTarget(previousTarget); gl.clippingPlanes = previousClipping; gl.localClippingEnabled = previousLocal; target.dispose() }
  }), [gl, scene])
  return null
}

function Lighting({ mode }: { mode: ViewMode }) { return <><ambientLight intensity={mode === 'technical' ? 1.4 : 0.72} /><directionalLight position={[18, 28, 14]} intensity={mode === 'technical' ? 2 : 2.8} castShadow shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} /></> }

export function StudioScene() {
  const project = useStudioStore((state) => state.project); const mode = useStudioStore((state) => state.viewMode); const confirmation = useStudioStore((state) => state.confirmationVariantRef)
  const ghost = useStudioStore((state) => state.variants.find((variant) => variant.ref === confirmation)?.project); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const changedGhostFixtures = ghost?.landscape.fixtures.filter((fixture) => {
    const committed = project.landscape.fixtures.find((item) => item.ref === fixture.ref)
    return !committed || committed.catalogId !== fixture.catalogId || committed.position.x !== fixture.position.x || committed.position.z !== fixture.position.z || committed.rotationDegrees !== fixture.rotationDegrees
  }) ?? []
  const changedGhostPlants = ghost?.landscape.plants.filter((plant) => {
    const committed = project.landscape.plants.find((item) => item.ref === plant.ref)
    return !committed || committed.position.x !== plant.position.x || committed.position.z !== plant.position.z
  }) ?? []
  return <>
    <color attach="background" args={[mode === 'technical' ? '#cfd5cd' : '#aebdb1']} />{mode === 'realistic' && <fog attach="fog" args={['#aebdb1', 450, 1100]} />}
    <ThatOpenBridge /><InteractiveMeasurements /><StructureCaptureController /><Lighting mode={mode} />
    <Physics gravity={[0, 0, 0]}><group onPointerMissed={() => setSelectedRef(null)}><TerrainAndSite project={project} mode={mode} /><Landscape project={project} /><GardenFixtures project={project} />
      {project.buildings.map((building) => <Building key={building.ref} project={project} building={building} mode={mode} />)}
      {ghost?.buildings.map((building) => <Building key={`ghost-${building.ref}`} project={ghost} building={building} mode={mode} ghost />)}
      {ghost && <GardenFixtures project={ghost} fixtures={changedGhostFixtures} ghost />}
      {ghost && changedGhostPlants.map((plant) => <Plant key={`ghost-${plant.ref}`} plant={plant} project={ghost} selected={false} onSelect={() => undefined} ghost />)}
    </group></Physics>
  </>
}
