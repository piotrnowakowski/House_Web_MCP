import { Html, Line as DreiLine, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import * as OBC from '@thatopen/components'
import CameraControls from 'camera-controls'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, EdgesGeometry, Group, LinearFilter, MathUtils, Mesh, MeshStandardMaterial, Object3D,
  OrthographicCamera, PerspectiveCamera, Plane, PlaneGeometry, Raycaster, Scene, Shape, ShapeGeometry, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { buildingGroundOffset, buildingLocalBounds, elevationAt, pointInPolygon, polygonBounds, polygonCentroid, spaceFootprint } from '../domain/geometry'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { measureHeight } from '../domain/heightMeasurements'
import type { BuildingModel, GardenFixtureModel, LandscapeZone, PlantModel, Polygon2, ProjectV2, RoofSegmentModel, SiteEntranceModel, StructureReport, Vec2, WallModel, WallMaterial } from '../domain/types'
import { inferWallOpeningLayout } from '../domain/wallOpeningLayouts'
import { resolveWallFinish } from '../domain/wallFinishes'
import { geometryService, solidInputsForBuilding } from '../geometry/geometryService'
import type { GeneratedSolid } from '../geometry/types'
import { registerStructureViewCapture, type ExpandedStructureView } from '../services/structureViews'
import { roofWings, type RoofWing } from '../domain/roofWings'
import { CompassRose, SUN_DISTANCE_M, SunHoursOverlay, SunLight, SunPath, sunStateFor } from './sun'
import { CucumberTrellisVisual, FruitTreeVisual, hasFruitTreeVisual, PotatoRowVisual, TomatoRowVisual } from './gardenVisuals'
import { interiorFloorTexture, raisedBedSoilTexture, raisedBedTexture, resolveWallTexture, resolveZoneTexture, terrainTexture, tintForTexturedFinish, zoneTintFor } from './materialCatalog'
import { TexturedMaterial, TexturePreloader, waitForTextures } from './materials'
import { useStudioStore } from '../state/store'

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

/** A flat plane whose UVs are in metres so textures tile at physical scale. */
const metrePlaneGeometry = (width: number, depth: number) => {
  const geometry = new PlaneGeometry(width, depth); const uv = geometry.attributes.uv
  for (let index = 0; index < uv.count; index += 1) uv.setXY(index, uv.getX(index) * width, uv.getY(index) * depth)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** A box whose UVs are in metres per face (three.js face order: +x, -x, +y, -y, +z, -z). */
const metreBoxGeometry = (width: number, height: number, depth: number) => {
  const geometry = new BoxGeometry(width, height, depth); const uv = geometry.attributes.uv
  const spans: Array<[number, number]> = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]]
  for (let index = 0; index < uv.count; index += 1) { const [u, v] = spans[Math.floor(index / 4)]; uv.setXY(index, uv.getX(index) * u, uv.getY(index) * v) }
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
  const bridge = useRef<{ components: OBC.Components; world: OBC.SimpleWorld; camera: OBC.OrthoPerspectiveCamera; renderer: SharedRenderer } | null>(null)

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
    components.init()
    bridge.current = { components, world, camera, renderer }
    return () => {
      camera.dispose()
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
    void current.camera.controls.setFocalOffset(2.4, 0, 0, smooth)
    void current.camera.controls.setLookAt(gardenFocusRequest.targetX + 5.5, 4.6, gardenFocusRequest.targetZ + 7, gardenFocusRequest.targetX, 0.65, gardenFocusRequest.targetZ, smooth)
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

function GeneratedMesh({ solid, selected, buildingRef, style, wall, yOffset, ghost }: { solid: GeneratedSolid; selected: boolean; buildingRef: string; style: BuildingModel['architecturalStyle']; wall?: WallModel; yOffset: number; ghost?: boolean }) {
  const geometry = useMemo(() => {
    const value = new BufferGeometry()
    value.setAttribute('position', new BufferAttribute(solid.positions, 3)); value.setAttribute('uv', new BufferAttribute(solid.uvs, 2)); value.setIndex(new BufferAttribute(solid.indices, 1)); value.computeVertexNormals()
    computeBoundsTree.call(value)
    return value
  }, [solid])
  useEffect(() => () => { disposeBoundsTree.call(geometry); geometry.dispose() }, [geometry])
  const isWall = Boolean(wall) || solid.ref.includes('wall'); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const palette = style === 'barn' ? BARN : REAL
  const finish = resolveWallFinish(wall, style); const surface = wallSurface[finish.material]
  const texture = isWall ? resolveWallTexture(finish) : undefined
  const material = texture
    ? <TexturedMaterial asset={texture.id} rotation={texture.rotation} color={selected ? '#b9e84d' : tintForTexturedFinish(finish.colorHex)} fallbackColor={selected ? '#b9e84d' : finish.colorHex} emissive={selected ? '#6c812f' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} transparent={Boolean(ghost)} opacity={ghost ? 0.33 : 1} depthWrite={!ghost} side={DoubleSide} roughness={surface.roughness} metalness={surface.metalness} />
    : <meshStandardMaterial color={isWall ? finish.colorHex : selected ? '#b9e84d' : palette.slab} emissive={isWall && selected ? '#6c812f' : '#000000'} emissiveIntensity={isWall && selected ? 0.35 : 0} transparent={Boolean(ghost)} opacity={ghost ? 0.33 : 1} depthWrite={!ghost} side={isWall ? DoubleSide : undefined} roughness={isWall ? surface.roughness : 0.78} metalness={isWall ? surface.metalness : 0.02} />
  return <mesh geometry={geometry} position={[0, yOffset, 0]} castShadow receiveShadow raycast={acceleratedRaycast} userData={{ semanticRef: solid.ref, buildingRef }} onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(solid.ref) }}>
    {material}
  </mesh>
}

const isLShapedBarn = (building: BuildingModel) => building.architecturalStyle === 'barn'
  && building.slabs[0]?.footprint.length === 6
  && building.walls.some((wall) => wall.ref === 'wall/front-glass')

function BarnGlazing({ building, ghost }: { building: BuildingModel; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const internalWalls = new Set(['wall/rear-partition', 'wall/wing-divider', 'wall/upper-north'])
  const panes = building.walls.flatMap((wall) => internalWalls.has(wall.ref) ? [] : wall.openings.map((opening) => ({ wall, opening })))
  return <>{panes.map(({ wall, opening }) => {
    const dx = wall.end.x - wall.start.x; const dz = wall.end.z - wall.start.z; const length = Math.hypot(dx, dz)
    const ux = dx / length; const uz = dz / length; const rotation = -Math.atan2(dz, dx)
    const x = wall.start.x + ux * opening.offsetM; const z = wall.start.z + uz * opening.offsetM
    const y = wall.baseElevationM + opening.sillM + opening.heightM / 2
    const mullions = opening.widthM > 5 ? [-opening.widthM / 6, opening.widthM / 6] : opening.widthM > 2.6 ? [0] : []
    const frame = selectedRef === opening.ref ? '#b9e84d' : '#121817'
    return <group key={opening.ref} position={[x, y, z]} rotation={[0, rotation, 0]} userData={{ semanticRef: opening.ref, buildingRef: building.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(opening.ref) }}>
      <mesh castShadow receiveShadow><boxGeometry args={[Math.max(0.08, opening.widthM - 0.08), Math.max(0.08, opening.heightM - 0.08), 0.045]} />
        <meshPhysicalMaterial color="#78959a" transparent opacity={ghost ? 0.2 : 0.42} transmission={0.55} roughness={0.08} metalness={0.08} depthWrite={false} />
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
    if (!['charred-timber', 'metal-panel'].includes(finish.material) || resolveWallTexture(finish)) return []
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

function InteriorFloor({ position, width, depth, color }: { position: [number, number, number]; width: number; depth: number; color: string }) {
  const geometry = useMemo(() => metrePlaneGeometry(width, depth), [depth, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={position} receiveShadow><TexturedMaterial asset={interiorFloorTexture.asset} color={interiorFloorTexture.tint} fallbackColor={color} roughness={0.55} normalScale={0.35} /></mesh>
}

function BarnInteriorWarmth({ ghost }: { ghost?: boolean }) {
  if (ghost) return null
  return <group userData={{ editorOnly: true }}>
    <InteriorFloor position={[0, 0.483, -2]} width={15.7} depth={5.7} color="#a9855d" />
    <InteriorFloor position={[-5, 0.498, 5.5]} width={5.7} depth={8.7} color="#ad8b61" />
    <InteriorFloor position={[-5, 3.483, 5.5]} width={5.7} depth={8.7} color="#987650" />
    <pointLight position={[-5, 2.3, 6]} color="#ffd29a" intensity={18} distance={9} decay={2} />
    <pointLight position={[-5, 5.35, 6.5]} color="#ffd6a3" intensity={14} distance={8} decay={2} />
    <pointLight position={[3.6, 2.15, -1]} color="#ffd09a" intensity={20} distance={10} decay={2} />
  </group>
}

function roofSurfaceMaterial(segment: RoofSegmentModel, selected: boolean, ghost?: boolean) {
  const metallic = segment.finish.material === 'standing-seam-metal'
  return <meshStandardMaterial color={selected ? '#b9e84d' : segment.finish.colorHex} roughness={metallic ? 0.42 : 0.78} metalness={metallic ? 0.58 : 0.04} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
}

const gableEndIsGlass = (building: BuildingModel, wing: RoofWing, axis: 'x' | 'z', value: number) => building.architecturalStyle === 'barn' && building.walls.some((wall) => {
  const onLine = (point: Vec2) => Math.abs((axis === 'x' ? point.x : point.z) - value) < 0.05
  return onLine(wall.start) && onLine(wall.end) && wall.baseElevationM + wall.heightM > wing.baseElevationM - 0.05 && inferWallOpeningLayout(wall) === 'full-glass'
})

/** One gable roof segment: two slopes whose ridge sits at the shared segment ridge elevation and whose eaves drop past the wall line by the overhang. */
function GableWing({ building, wing, segment, ghost, selected, wallColor }: { building: BuildingModel; wing: RoofWing; segment: RoofSegmentModel; ghost?: boolean; selected: boolean; wallColor: string }) {
  const bounds = polygonBounds(wing.footprint); const over = wing.overhangM; const pitch = MathUtils.degToRad(segment.pitchDegrees)
  const base = wing.baseElevationM; const ridge = wing.ridgeElevationM; const alongZ = wing.ridgeAxis === 'z'
  const width = bounds.maxX - bounds.minX; const depth = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2; const cz = (bounds.minZ + bounds.maxZ) / 2
  const span = alongZ ? width : depth; const eaveY = base - Math.tan(pitch) * over
  const half = span / 2 + over; const slope = half / Math.cos(pitch); const midY = (eaveY + ridge) / 2
  const roofMaterial = roofSurfaceMaterial(segment, selected, ghost)
  const gable = useMemo(() => {
    const value = new BufferGeometry()
    const positions = alongZ ? [bounds.minX, base, 0, bounds.maxX, base, 0, cx, ridge, 0] : [0, base, bounds.minZ, 0, base, bounds.maxZ, 0, ridge, cz]
    value.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); value.setIndex([0, 1, 2]); value.computeVertexNormals(); return value
  }, [alongZ, base, bounds.maxX, bounds.maxZ, bounds.minX, bounds.minZ, cx, cz, ridge])
  useEffect(() => () => gable.dispose(), [gable])
  const ends = alongZ ? [bounds.minZ, bounds.maxZ] : [bounds.minX, bounds.maxX]
  const seamSpacing = alongZ ? 0.72 : 0.78
  const seams = segment.finish.material === 'standing-seam-metal' ? Array.from({ length: Math.max(2, Math.floor((alongZ ? depth : width) / seamSpacing)) }, (_, index) => (alongZ ? bounds.minZ : bounds.minX) + seamSpacing / 2 + index * seamSpacing) : []
  const seamMaterial = <meshStandardMaterial color="#151b1c" metalness={0.7} roughness={0.35} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
  const frameMaterial = <meshStandardMaterial color="#111716" roughness={0.48} />
  return <group>
    {alongZ ? <>
      <mesh position={[cx - half / 2, midY, cz]} rotation={[0, 0, pitch]} castShadow><boxGeometry args={[slope, 0.2, depth + over * 2]} />{roofMaterial}</mesh>
      <mesh position={[cx + half / 2, midY, cz]} rotation={[0, 0, -pitch]} castShadow><boxGeometry args={[slope, 0.2, depth + over * 2]} />{roofMaterial}</mesh>
    </> : <>
      <mesh position={[cx, midY, cz - half / 2]} rotation={[-pitch, 0, 0]} castShadow><boxGeometry args={[width + over * 2, 0.2, slope]} />{roofMaterial}</mesh>
      <mesh position={[cx, midY, cz + half / 2]} rotation={[pitch, 0, 0]} castShadow><boxGeometry args={[width + over * 2, 0.2, slope]} />{roofMaterial}</mesh>
    </>}
    {ends.map((value, index) => {
      const outward = index === 0 ? -1 : 1; const offset = value + outward * 0.02; const frameOffset = value + outward * 0.06
      const glass = gableEndIsGlass(building, wing, alongZ ? 'z' : 'x', value)
      const at = (across: number, y: number, along: number): [number, number, number] => alongZ ? [across, y, along] : [along, y, across]
      return <group key={index}>
        <mesh geometry={gable} position={alongZ ? [0, 0, offset] : [offset, 0, 0]} castShadow>{glass
          ? <meshPhysicalMaterial color="#7e999c" transparent opacity={ghost ? 0.2 : 0.43} transmission={0.58} roughness={0.08} side={DoubleSide} depthWrite={false} />
          : <meshStandardMaterial color={wallColor} roughness={0.92} side={DoubleSide} transparent={Boolean(ghost)} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />}</mesh>
        {glass && [-span / 4, 0, span / 4].map((mullion, mullionIndex) => {
          const height = mullion === 0 ? ridge - base : (ridge - base) / 2
          return <mesh key={mullionIndex} position={at((alongZ ? cx : cz) + mullion, base + height / 2, frameOffset)}><boxGeometry args={alongZ ? [0.075, height, 0.1] : [0.1, height, 0.075]} />{frameMaterial}</mesh>
        })}
        {glass && <mesh position={at(alongZ ? cx : cz, base, frameOffset)}><boxGeometry args={alongZ ? [span, 0.09, 0.1] : [0.1, 0.09, span]} />{frameMaterial}</mesh>}
      </group>
    })}
    {seams.flatMap((along) => alongZ ? [
      <mesh key={`a-${along}`} position={[cx - half / 2, midY + 0.12, along]} rotation={[0, 0, pitch]}><boxGeometry args={[slope, 0.025, 0.032]} />{seamMaterial}</mesh>,
      <mesh key={`b-${along}`} position={[cx + half / 2, midY + 0.12, along]} rotation={[0, 0, -pitch]}><boxGeometry args={[slope, 0.025, 0.032]} />{seamMaterial}</mesh>,
    ] : [
      <mesh key={`a-${along}`} position={[along, midY + 0.12, cz - half / 2]} rotation={[-pitch, 0, 0]}><boxGeometry args={[0.032, 0.025, slope]} />{seamMaterial}</mesh>,
      <mesh key={`b-${along}`} position={[along, midY + 0.12, cz + half / 2]} rotation={[pitch, 0, 0]}><boxGeometry args={[0.032, 0.025, slope]} />{seamMaterial}</mesh>,
    ])}
  </group>
}

/** Flat or hip roof segment drawn from the same segment numbers the height tools report. */
function SegmentRoof({ wing, segment, ghost, selected }: { wing: RoofWing; segment: RoofSegmentModel; ghost?: boolean; selected: boolean }) {
  const bounds = polygonBounds(wing.footprint); const width = bounds.maxX - bounds.minX; const depth = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2; const cz = (bounds.minZ + bounds.maxZ) / 2; const over = wing.overhangM; const pitch = MathUtils.degToRad(segment.pitchDegrees)
  const eaveY = wing.baseElevationM - Math.tan(pitch) * over
  const hipGeometry = useMemo(() => {
    const value = new BufferGeometry()
    value.setAttribute('position', new BufferAttribute(new Float32Array([
      bounds.minX - over, eaveY, bounds.minZ - over, bounds.maxX + over, eaveY, bounds.minZ - over,
      bounds.maxX + over, eaveY, bounds.maxZ + over, bounds.minX - over, eaveY, bounds.maxZ + over,
      cx, wing.ridgeElevationM, cz,
    ]), 3)); value.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]); value.computeVertexNormals(); return value
  }, [bounds.maxX, bounds.maxZ, bounds.minX, bounds.minZ, cx, cz, eaveY, over, wing.ridgeElevationM])
  useEffect(() => () => hipGeometry.dispose(), [hipGeometry])
  if (segment.type === 'flat') return <mesh position={[cx, wing.baseElevationM + 0.12, cz]} castShadow><boxGeometry args={[width + over * 2, 0.24, depth + over * 2]} />{roofSurfaceMaterial(segment, selected, ghost)}</mesh>
  return <mesh geometry={hipGeometry} castShadow>{roofSurfaceMaterial(segment, selected, ghost)}</mesh>
}

/** Roofs are drawn segment by segment from the roofWings adapter over roof.segments, so the picture matches heights and sun occlusion. */
function Roof({ building, selected, yOffset, ghost }: { building: BuildingModel; selected: boolean; yOffset: number; ghost?: boolean }) {
  const wings = useMemo(() => roofWings(building), [building])
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const barn = building.architecturalStyle === 'barn'; const palette = barn ? BARN : REAL
  const wallColor = barn ? '#242927' : palette.wall
  return <group position={[0, yOffset, 0]} userData={{ semanticRef: building.roof.ref, buildingRef: building.ref }}>
    {wings.map((wing) => {
      const segment = building.roof.segments.find((item) => item.ref === wing.ref) ?? building.roof.segments[0]
      const highlighted = selected || selectedRef === wing.ref
      return <group key={wing.ref} userData={{ semanticRef: wing.ref, buildingRef: building.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(wing.ref) }}>
        {segment.type === 'gable' ? <GableWing building={building} wing={wing} segment={segment} ghost={ghost} selected={highlighted} wallColor={wallColor} /> : <SegmentRoof wing={wing} segment={segment} ghost={ghost} selected={highlighted} />}
      </group>
    })}
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

function Building({ project, building, ghost }: { project: ProjectV2; building: BuildingModel; ghost?: boolean }) {
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
      {solids.map((solid) => <GeneratedMesh key={solid.ref} solid={solid} selected={selectedRef === solid.ref} buildingRef={building.ref} style={building.architecturalStyle} wall={building.walls.find((wall) => wall.ref === solid.ref)} yOffset={offsetFor(solid.ref)} ghost={ghost} />)}
      {isLShapedBarn(building) && <BarnGlazing building={building} ghost={ghost} />}
      {isLShapedBarn(building) && <BarnCladding building={building} ghost={ghost} />}
      {isLShapedBarn(building) && <BarnInteriorWarmth ghost={ghost} />}
      <Roof building={building} selected={selectedRef === building.roof.ref} yOffset={roofOffset} ghost={ghost} />
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

function ParcelSurface({ boundary, landRole }: { boundary: Polygon2; landRole: 'construction' | 'agricultural' }) {
  const geometry = useMemo(() => localPolygonGeometry(boundary), [boundary])
  const edges = useMemo(() => new EdgesGeometry(geometry, 1), [geometry])
  useEffect(() => () => { edges.dispose(); geometry.dispose() }, [edges, geometry])
  const construction = landRole === 'construction'
  const fill = construction
    ? '#829665'
    : '#627b50'
  return <group>
    <mesh geometry={geometry} position={[0, TERRAIN_SURFACE_Y + 0.006, 0]} renderOrder={1} receiveShadow>
      <meshStandardMaterial color={fill} transparent opacity={construction ? 0.34 : 0.82} roughness={1} side={DoubleSide} depthWrite={!construction} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
    <lineSegments geometry={edges} position={[0, TERRAIN_SURFACE_Y + 0.012, 0]} renderOrder={2}>
      <lineBasicMaterial color={construction ? '#526b45' : '#4d6841'} transparent opacity={construction ? 0.95 : 0.88} depthWrite={false} />
    </lineSegments>
  </group>
}

function RoadEntranceMarker({ entrance }: { entrance: SiteEntranceModel }) {
  const start = entrance.start; const end = entrance.end
  const centerX = (start.x + end.x) / 2; const centerZ = (start.z + end.z) / 2
  const length = Math.hypot(end.x - start.x, end.z - start.z); const angle = -Math.atan2(end.z - start.z, end.x - start.x)
  const markerColor = '#e9b92f'
  return <group position={[centerX, TERRAIN_SURFACE_Y + 0.055, centerZ]} rotation={[0, angle, 0]} userData={{ semanticRef: entrance.ref }}>
    <mesh renderOrder={5} receiveShadow><boxGeometry args={[length, 0.07, 0.72]} /><meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={0.14} roughness={0.72} /></mesh>
    {[-length / 2, length / 2].map((offset, index) => <mesh key={index} position={[offset, 0.43, 0]} castShadow><cylinderGeometry args={[0.09, 0.11, 0.86, 10]} /><meshStandardMaterial color="#f7d568" roughness={0.62} /></mesh>)}
    <Html center position={[0, 1.25, 0]} distanceFactor={15} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <span className="site-entrance-label">{entrance.name}</span>
    </Html>
  </group>
}

function TerrainAndSite({ project }: { project: ProjectV2 }) {
  const boundaryGeometry = useMemo(() => localPolygonGeometry(project.site.boundary), [project.site.boundary])
  const landBounds = useMemo(() => project.site.parcels.flatMap((parcel) => parcel.boundary).reduce((box, point) => box.expandByPoint(new Vector3(point.x, 0, point.z)), new Box3()), [project.site.parcels])
  const landCenter = landBounds.getCenter(new Vector3()); const landSize = landBounds.getSize(new Vector3())
  useEffect(() => () => boundaryGeometry.dispose(), [boundaryGeometry])
  return <group userData={{ semanticRef: 'site' }}>
    <mesh geometry={boundaryGeometry} position={[0, TERRAIN_SURFACE_Y, 0]} receiveShadow userData={{ semanticRef: 'site/terrain' }}><TexturedMaterial asset={terrainTexture.asset} color={terrainTexture.tint} fallbackColor={REAL.soil} roughness={1} side={DoubleSide} normalScale={0.4} /></mesh>
    {project.site.parcels.map((parcel) => <ParcelSurface key={parcel.ref} boundary={parcel.boundary} landRole={parcel.landRole} />)}
    {project.site.entrances.map((entrance) => <RoadEntranceMarker key={entrance.ref} entrance={entrance} />)}
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[Math.max(1, landSize.x / 2), 0.08, Math.max(1, landSize.z / 2)]} position={[landCenter.x, TERRAIN_SURFACE_Y - 0.08, landCenter.z]} /></RigidBody>
  </group>
}

const zoneColor: Record<LandscapeZone['kind'], string> = { lawn: '#738e55', terrace: '#c5b99b', path: '#c1b695', driveway: '#a69f8f', bed: '#684f44', 'rain-garden': '#4f8075', vegetable: '#66834d' }

function ZoneSurface({ zone, project }: { zone: LandscapeZone; project: ProjectV2 }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef); const month = useStudioStore((state) => state.month)
  const repositioningRef = useStudioStore((state) => state.repositioningRef); const commitCommand = useStudioStore((state) => state.commitCommand); const endReposition = useStudioStore((state) => state.endReposition); const setToast = useStudioStore((state) => state.setToast)
  const geometry = useMemo(() => localPolygonGeometry(zone.footprint), [zone.footprint])
  useEffect(() => () => geometry.dispose(), [geometry])
  const center = polygonCentroid(zone.footprint); const y = elevationAt(project, center.x, center.z) + 0.02
  const selected = selectedRef === zone.ref; const texture = resolveZoneTexture(zone); const grass = texture?.id === 'leafy-grass'; const group = useRef<Group>(null)
  return <><group ref={group} position={[0, y, 0]} userData={{ semanticRef: zone.ref }}>
    <mesh geometry={geometry} receiveShadow onPointerDown={(event) => { event.stopPropagation(); setSelectedRef(zone.ref) }}>{texture
      ? <TexturedMaterial asset={texture.id} color={selected ? '#b9e84d' : zoneTintFor(zone, month)} fallbackColor={selected ? '#b9e84d' : zoneColor[zone.kind]} roughness={grass ? 1 : 0.9} side={DoubleSide} normalScale={grass ? 0.5 : 0.7} />
      : <meshStandardMaterial color={selected ? '#b9e84d' : zoneColor[zone.kind]} roughness={0.95} side={DoubleSide} />}</mesh>
  </group>{selected && !zone.locked && repositioningRef === zone.ref && group.current && <TransformControls object={group.current} mode="translate" showY={false} userData={{ editorOnly: true }} onMouseUp={() => {
    if (!group.current) return
    try { commitCommand({ type: 'landscape.update', action: 'move', zoneRef: zone.ref, delta: { x: group.current.position.x, z: group.current.position.z } }) }
    catch (error) { group.current.position.set(0, y, 0); setToast(error instanceof Error ? error.message : 'Landscape zone move could not be applied.') }
    finally { endReposition() }
  }} />}</>
}

function Landscape({ project }: { project: ProjectV2 }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  return <>{project.landscape.zones.map((zone) => <ZoneSurface key={zone.ref} zone={zone} project={project} />)}
    {project.landscape.plants.map((plant) => <Plant key={plant.ref} plant={plant} project={project} selected={selectedRef === plant.ref} onSelect={() => setSelectedRef(plant.ref)} />)}</>
}

function Plant({ plant, project, selected, onSelect, ghost = false }: { plant: PlantModel; project: ProjectV2; selected: boolean; onSelect: () => void; ghost?: boolean }) {
  const month = useStudioStore((state) => state.month); const repositioningRef = useStudioStore((state) => state.repositioningRef); const commitCommand = useStudioStore((state) => state.commitCommand); const endReposition = useStudioStore((state) => state.endReposition); const setToast = useStudioStore((state) => state.setToast)
  const y = elevationAt(project, plant.position.x, plant.position.z); const canopy = Math.max(0.25, plant.canopyM / 2); const visibleLeaf = plant.leafMonths.includes(month); const group = useRef<Group>(null)
  return <><group ref={group} position={[plant.position.x, y, plant.position.z]} userData={{ semanticRef: plant.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) onSelect() }}>
    {hasFruitTreeVisual(plant) ? <FruitTreeVisual plant={plant} month={month} selected={selected} ghost={ghost} /> : <>
      <mesh position={[0, plant.matureHeightM * 0.28, 0]} castShadow={!ghost}><cylinderGeometry args={[0.1, 0.15, plant.matureHeightM * 0.56, 8]} /><meshStandardMaterial color="#584434" transparent={ghost} opacity={ghost ? 0.42 : 1} /></mesh>
      <mesh position={[0, plant.matureHeightM * 0.72, 0]} castShadow={!ghost}><sphereGeometry args={[canopy, 12, 9]} /><meshStandardMaterial color={selected ? '#b9e84d' : ghost ? '#b9e84d' : visibleLeaf ? '#477348' : '#756955'} transparent opacity={ghost ? 0.38 : visibleLeaf ? 0.92 : 0.52} depthWrite={!ghost} /></mesh>
    </>}
  </group>{selected && !ghost && repositioningRef === plant.ref && group.current && <TransformControls object={group.current} mode="translate" showY={false} userData={{ editorOnly: true }} onMouseUp={() => {
    if (!group.current) return
    try { commitCommand({ type: 'plant.update', action: 'move', plantRef: plant.ref, position: { x: group.current.position.x, z: group.current.position.z } }) }
    catch (error) { group.current.position.set(plant.position.x, y, plant.position.z); setToast(error instanceof Error ? error.message : 'Plant move could not be applied.') }
    finally { endReposition() }
  }} />}</>
}

const fixtureMaterial = (color: string, selected: boolean, ghost: boolean) => <meshStandardMaterial color={selected ? '#b9e84d' : color} roughness={0.82} transparent={ghost} opacity={ghost ? 0.42 : 1} />

function TimberBoard({ position, size, selected, ghost, textured }: { position: [number, number, number]; size: [number, number, number]; selected: boolean; ghost: boolean; textured: boolean }) {
  const geometry = useMemo(() => metreBoxGeometry(size[0], size[1], size[2]), [size])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={position} castShadow>{textured && !selected
    ? <TexturedMaterial asset={raisedBedTexture.asset} color={raisedBedTexture.tint} fallbackColor="#8b623d" roughness={0.85} transparent={ghost} opacity={ghost ? 0.42 : 1} />
    : fixtureMaterial('#8b623d', selected, ghost)}</mesh>
}

function SoilFill({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  const geometry = useMemo(() => metreBoxGeometry(2.16, 0.32, 0.96), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, 0.24, 0]} castShadow receiveShadow>{selected
    ? fixtureMaterial('#473426', selected, ghost)
    : <TexturedMaterial asset={raisedBedSoilTexture.asset} color={raisedBedSoilTexture.tint} fallbackColor="#473426" roughness={1} transparent={ghost} opacity={ghost ? 0.42 : 1} />}</mesh>
}

function RaisedBedFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  const textured = true
  return <group>
    <SoilFill selected={selected} ghost={ghost} />
    <mesh position={[0, 0.43, 0]} castShadow><boxGeometry args={[2.08, 0.09, 0.88]} />{fixtureMaterial('#5c4936', selected, ghost)}</mesh>
    {([[-1.13, 0], [1.13, 0]] as const).map(([x, z], index) => <TimberBoard key={`end-${index}`} position={[x, 0.28, z]} size={[0.12, 0.46, 1.2]} selected={selected} ghost={ghost} textured={textured} />)}
    {([[-0.54], [0.54]] as const).map(([z], index) => <TimberBoard key={`side-${index}`} position={[0, 0.28, z]} size={[2.4, 0.46, 0.12]} selected={selected} ghost={ghost} textured={textured} />)}
  </group>
}

function TomatoRowFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <TomatoRowVisual selected={selected} ghost={ghost} />
}

function PotatoRowFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <PotatoRowVisual selected={selected} ghost={ghost} />
}

function CucumberTrellisFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <CucumberTrellisVisual selected={selected} ghost={ghost} />
}

function DiningChair({ position, rotation = 0, selected, ghost }: { position: [number, number, number]; rotation?: number; selected: boolean; ghost: boolean }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[0.54, 0.1, 0.52]} />{fixtureMaterial('#9a704a', selected, ghost)}</mesh>
    <mesh position={[0, 0.77, 0.22]} rotation={[Math.PI / 18, 0, 0]} castShadow><boxGeometry args={[0.54, 0.54, 0.08]} />{fixtureMaterial('#8b623d', selected, ghost)}</mesh>
    {[[-0.21, -0.18], [0.21, -0.18], [-0.21, 0.18], [0.21, 0.18]].map(([x, z], index) => <mesh key={index} position={[x, 0.23, z]} castShadow><boxGeometry args={[0.055, 0.46, 0.055]} />{fixtureMaterial('#4b4138', selected, ghost)}</mesh>)}
  </group>
}

function OutdoorDiningSetFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  const chairs = [[-0.72, -0.92, 0], [0, -0.92, 0], [0.72, -0.92, 0], [-0.72, 0.92, Math.PI], [0, 0.92, Math.PI], [0.72, 0.92, Math.PI]] as const
  return <group>
    <mesh position={[0, 0.75, 0]} castShadow receiveShadow><boxGeometry args={[2.25, 0.13, 1.02]} />{fixtureMaterial('#a4774d', selected, ghost)}</mesh>
    {[-0.91, 0.91].flatMap((x) => [-0.34, 0.34].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.37, z]} castShadow><boxGeometry args={[0.09, 0.74, 0.09]} />{fixtureMaterial('#4b4138', selected, ghost)}</mesh>))}
    {chairs.map(([x, z, rotation], index) => <DiningChair key={index} position={[x, 0, z]} rotation={rotation} selected={selected} ghost={ghost} />)}
  </group>
}

function LoungeSeat({ width, position, rotation = 0, selected, ghost }: { width: number; position: [number, number, number]; rotation?: number; selected: boolean; ghost: boolean }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[width, 0.32, 0.78]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>
    <mesh position={[0, 0.51, -0.02]} castShadow><boxGeometry args={[Math.max(0.42, width - 0.22), 0.16, 0.58]} />{fixtureMaterial('#d8c9aa', selected, ghost)}</mesh>
    <mesh position={[0, 0.72, 0.31]} rotation={[-Math.PI / 18, 0, 0]} castShadow><boxGeometry args={[Math.max(0.42, width - 0.2), 0.5, 0.14]} />{fixtureMaterial('#c8b894', selected, ghost)}</mesh>
    {[-width / 2 + 0.07, width / 2 - 0.07].map((x) => <mesh key={x} position={[x, 0.48, 0]} castShadow><boxGeometry args={[0.12, 0.32, 0.8]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>)}
  </group>
}

function GardenLoungeSetFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <LoungeSeat width={2.25} position={[0, 0, 1.03]} rotation={Math.PI} selected={selected} ghost={ghost} />
    <LoungeSeat width={0.9} position={[-1.4, 0, -0.55]} rotation={Math.PI / 2} selected={selected} ghost={ghost} />
    <LoungeSeat width={0.9} position={[1.4, 0, -0.55]} rotation={-Math.PI / 2} selected={selected} ghost={ghost} />
    <mesh position={[0, 0.31, -0.45]} castShadow receiveShadow><boxGeometry args={[1.25, 0.1, 0.72]} />{fixtureMaterial('#986f4a', selected, ghost)}</mesh>
    {[-0.5, 0.5].flatMap((x) => [-0.25, 0.25].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.15, z - 0.45]}><boxGeometry args={[0.05, 0.3, 0.05]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>))}
  </group>
}

function SlattedBenchFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    {[-0.24, -0.12, 0, 0.12, 0.24].map((z) => <mesh key={z} position={[0, 0.49, z]} castShadow><boxGeometry args={[1.8, 0.07, 0.09]} />{fixtureMaterial('#9a704a', selected, ghost)}</mesh>)}
    {[0.64, 0.76, 0.88].map((y) => <mesh key={y} position={[0, y, 0.29]} rotation={[Math.PI / 24, 0, 0]} castShadow><boxGeometry args={[1.8, 0.075, 0.09]} />{fixtureMaterial('#8b623d', selected, ghost)}</mesh>)}
    {[-0.71, 0.71].map((x) => <mesh key={x} position={[x, 0.3, 0]} castShadow><boxGeometry args={[0.09, 0.6, 0.52]} />{fixtureMaterial('#414744', selected, ghost)}</mesh>)}
  </group>
}

function SunLoungerFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <mesh position={[0, 0.31, -0.35]} rotation={[0.02, 0, 0]} castShadow><boxGeometry args={[0.7, 0.12, 1.25]} />{fixtureMaterial('#d8c9aa', selected, ghost)}</mesh>
    <mesh position={[0, 0.58, 0.55]} rotation={[-Math.PI / 5.5, 0, 0]} castShadow><boxGeometry args={[0.7, 0.12, 0.9]} />{fixtureMaterial('#c8b894', selected, ghost)}</mesh>
    {[-0.34, 0.34].map((x) => <mesh key={x} position={[x, 0.22, 0]} castShadow><boxGeometry args={[0.07, 0.12, 1.95]} />{fixtureMaterial('#8b623d', selected, ghost)}</mesh>)}
    {[-0.7, 0.66].map((z) => [-0.31, 0.31].map((x) => <mesh key={`${x}-${z}`} position={[x, 0.11, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.12, 10]} />{fixtureMaterial('#414744', selected, ghost)}</mesh>))}
  </group>
}

function CantileverParasolFixture({ selected, ghost }: { selected: boolean; ghost: boolean }) {
  return <group>
    <mesh position={[1.12, 0.07, 0]} castShadow receiveShadow><cylinderGeometry args={[0.32, 0.38, 0.14, 12]} />{fixtureMaterial('#333a38', selected, ghost)}</mesh>
    <mesh position={[1.12, 1.18, 0]} castShadow><cylinderGeometry args={[0.045, 0.055, 2.22, 10]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>
    <mesh position={[0.55, 2.25, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.035, 0.045, 1.18, 10]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>
    <mesh position={[0, 2.28, 0]} castShadow><coneGeometry args={[1.5, 0.34, 12]} />{fixtureMaterial('#d8c9aa', selected, ghost)}</mesh>
    <mesh position={[0, 2.08, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />{fixtureMaterial('#343a38', selected, ghost)}</mesh>
  </group>
}

function GardenFixtureModel({ catalogId, selected, ghost }: { catalogId: GardenFixtureModel['catalogId']; selected: boolean; ghost: boolean }) {
  switch (catalogId) {
    case 'outdoor-dining-set': return <OutdoorDiningSetFixture selected={selected} ghost={ghost} />
    case 'garden-lounge-set': return <GardenLoungeSetFixture selected={selected} ghost={ghost} />
    case 'slatted-bench': return <SlattedBenchFixture selected={selected} ghost={ghost} />
    case 'sun-lounger': return <SunLoungerFixture selected={selected} ghost={ghost} />
    case 'cantilever-parasol': return <CantileverParasolFixture selected={selected} ghost={ghost} />
    case 'raised-bed-2x1': return <RaisedBedFixture selected={selected} ghost={ghost} />
    case 'tomato-row': return <TomatoRowFixture selected={selected} ghost={ghost} />
    case 'potato-row': return <PotatoRowFixture selected={selected} ghost={ghost} />
    case 'cucumber-trellis': return <CucumberTrellisFixture selected={selected} ghost={ghost} />
  }
}

function GardenFixture({ fixture, project, ghost = false }: { fixture: GardenFixtureModel; project: ProjectV2; ghost?: boolean }) {
  const selectedRef = useStudioStore((state) => state.selectedRef); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const repositioningRef = useStudioStore((state) => state.repositioningRef); const commitCommand = useStudioStore((state) => state.commitCommand); const endReposition = useStudioStore((state) => state.endReposition); const setToast = useStudioStore((state) => state.setToast)
  const definition = gardenFixtureById(fixture.catalogId)
  const hostedInBed = definition.category === 'crop' && project.landscape.fixtures.some((candidate) => candidate.catalogId === 'raised-bed-2x1' && Math.hypot(candidate.position.x - fixture.position.x, candidate.position.z - fixture.position.z) < 0.15)
  const y = elevationAt(project, fixture.position.x, fixture.position.z) + (hostedInBed ? 0.43 : 0.02)
  const selected = selectedRef === fixture.ref; const group = useRef<Group>(null)
  return <><group ref={group} position={[fixture.position.x, y, fixture.position.z]} rotation={[0, -MathUtils.degToRad(fixture.rotationDegrees), 0]} userData={{ semanticRef: fixture.ref }} onPointerDown={(event) => { event.stopPropagation(); if (!ghost) setSelectedRef(fixture.ref) }}>
    <GardenFixtureModel catalogId={fixture.catalogId} selected={selected} ghost={ghost} />
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
    : view.type === 'sun-study' ? selectedBounds(project, view.buildingRefs).expandByScalar(20) : selectedBounds(project, view.buildingRefs)
  const center = bounds.getCenter(new Vector3()); const size = bounds.getSize(new Vector3()); const span = Math.max(size.x, size.y, size.z, 10)
  if (view.type === 'axonometric') { const camera = new PerspectiveCamera(34, aspect, 0.1, 500); camera.position.copy(center).add(new Vector3(span * 1.5, span, span * 1.5)); camera.lookAt(center); camera.updateProjectionMatrix(); return camera }
  const camera = new OrthographicCamera(-span * aspect * 0.62, span * aspect * 0.62, span * 0.62, -span * 0.62, 0.1, 500)
  if (view.type === 'site-plan' || view.type === 'storey-plan' || view.type === 'sun-study') camera.position.copy(center).add(new Vector3(0, span * 3, 0.001))
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

const pixelsToBlob = (pixels: Uint8Array, width: number, height: number, title: string, project: ProjectV2, names: string[], annotations: boolean, planView: boolean) => new Promise<Blob>((resolve, reject) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d')
  if (!context) { reject(new Error('2D report canvas unavailable.')); return }
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y += 1) image.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4)
  context.putImageData(image, 0, 0)
  if (annotations) {
    context.fillStyle = 'rgba(10,16,15,.82)'; context.fillRect(0, 0, width, 62); context.fillRect(0, height - 42, width, 42)
    context.fillStyle = '#f1f5ed'; context.font = '600 24px system-ui'; context.fillText(title, 24, 39); context.font = '13px system-ui'; context.fillStyle = '#c8d3cc'; context.fillText(names.join(' · '), 24, height - 16)
    // Plan views look straight down with screen up = -z, so true north on paper is (sin θ, cos θ) in canvas coordinates; other views keep a plain up arrow as a label.
    const north = project.site.northDegrees * Math.PI / 180; const direction = planView ? { x: Math.sin(north), y: Math.cos(north) } : { x: 0, y: -1 }
    const arrowBase = { x: width - 48, y: 31 }; const tip = { x: arrowBase.x + direction.x * 16, y: arrowBase.y + direction.y * 16 }; const tail = { x: arrowBase.x - direction.x * 12, y: arrowBase.y - direction.y * 12 }
    const side = { x: -direction.y * 6, y: direction.x * 6 }
    context.strokeStyle = '#b9e84d'; context.lineWidth = 3; context.beginPath(); context.moveTo(tail.x, tail.y); context.lineTo(tip.x, tip.y); context.stroke()
    context.fillStyle = '#b9e84d'; context.beginPath(); context.moveTo(tip.x + direction.x * 7, tip.y + direction.y * 7); context.lineTo(tip.x + side.x, tip.y + side.y); context.lineTo(tip.x - side.x, tip.y - side.y); context.fill()
    context.fillText('N', tip.x + direction.x * 14 - 4, tip.y + direction.y * 14 + 4)
    context.strokeStyle = '#f1f5ed'; context.lineWidth = 4; context.beginPath(); context.moveTo(width - 180, height - 20); context.lineTo(width - 80, height - 20); context.stroke(); context.fillText('5 m', width - 172, height - 27); context.fillText(`site north ${project.site.northDegrees.toFixed(1)}°`, width - 340, height - 16)
  }
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG report encoding failed.')), 'image/png')
})

/** Temporarily points the scene sun at the requested moment for a sun-study capture; returns the restore function. */
const overrideSunForStudy = (scene: Scene, project: ProjectV2, view: Extract<ExpandedStructureView, { type: 'sun-study' }>) => {
  let light: DirectionalLight | null = null
  scene.traverse((object) => { if (!light && object instanceof DirectionalLight && object.userData.sunLight) light = object })
  if (!light) return null
  const sunLight: DirectionalLight = light
  const previous = { position: sunLight.position.clone(), intensity: sunLight.intensity, color: sunLight.color.clone() }
  const sun = sunStateFor(project, { month: view.month, day: view.day, hour: view.hour })
  const centre = sunLight.target.position
  sunLight.position.set(centre.x + sun.direction.x * SUN_DISTANCE_M, centre.y + Math.max(0.02, sun.direction.y) * SUN_DISTANCE_M, centre.z + sun.direction.z * SUN_DISTANCE_M)
  sunLight.intensity = sun.altitudeDeg <= 0 ? 0 : 2.6; sunLight.color.set('#fff3dc')
  return () => { sunLight.position.copy(previous.position); sunLight.intensity = previous.intensity; sunLight.color.copy(previous.color) }
}

function StructureCaptureController() {
  const { gl, scene } = useThree()
  useEffect(() => registerStructureViewCapture(async (project, views, includeAnnotations, signal) => {
    await waitForTextures()
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
        const restoreSun = view.type === 'sun-study' ? overrideSunForStudy(scene, project, view) : null
        gl.localClippingEnabled = true; gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera); restoreSun?.()
        const pixels = new Uint8Array(width * height * 4); gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
        const names = view.buildingRefs.map((ref) => project.buildings.find((building) => building.ref === ref)!.name); const blob = await pixelsToBlob(pixels, width, height, view.title, project, names, includeAnnotations, view.type === 'site-plan' || view.type === 'storey-plan' || view.type === 'sun-study')
        results.push({ type: view.type, title: view.title, buildingRefs: view.buildingRefs, ...(view.type === 'storey-plan' ? { storeyRef: view.storeyRef } : {}), presentation: 'visible-in-page', imageUrl: URL.createObjectURL(blob) })
      }
      return results
    } catch (error) { results.forEach((view) => URL.revokeObjectURL(view.imageUrl)); throw error }
    finally { visibility.forEach((visible, object) => { object.visible = visible }); materialState.forEach((state, material) => { material.transparent = state.transparent; material.opacity = state.opacity }); gl.setRenderTarget(previousTarget); gl.clippingPlanes = previousClipping; gl.localClippingEnabled = previousLocal; target.dispose() }
  }), [gl, scene])
  return null
}

export function StudioScene() {
  const project = useStudioStore((state) => state.project); const confirmation = useStudioStore((state) => state.confirmationVariantRef)
  const ghost = useStudioStore((state) => state.variants.find((variant) => variant.ref === confirmation)?.project); const setSelectedRef = useStudioStore((state) => state.setSelectedRef)
  const changedGhostFixtures = ghost?.landscape.fixtures.filter((fixture) => {
    const committed = project.landscape.fixtures.find((item) => item.ref === fixture.ref)
    return !committed || committed.catalogId !== fixture.catalogId || committed.position.x !== fixture.position.x || committed.position.z !== fixture.position.z || committed.rotationDegrees !== fixture.rotationDegrees
  }) ?? []
  const sunTime = useStudioStore((state) => state.sunTime)
  const sunAltitude = sunStateFor(project, sunTime).altitudeDeg
  const sky = sunAltitude > 12 ? '#aebdb1' : sunAltitude > 0 ? `#${new Color('#aebdb1').lerp(new Color('#c9a98c'), 1 - sunAltitude / 12).getHexString()}` : '#4b5461'
  const changedGhostPlants = ghost?.landscape.plants.filter((plant) => {
    const committed = project.landscape.plants.find((item) => item.ref === plant.ref)
    return !committed || committed.position.x !== plant.position.x || committed.position.z !== plant.position.z
  }) ?? []
  return <>
    <color attach="background" args={[sky]} /><fog attach="fog" args={[sky, 450, 1100]} />
    <ThatOpenBridge /><InteractiveMeasurements /><StructureCaptureController /><SunLight /><SunPath /><CompassRose /><SunHoursOverlay /><TexturePreloader />
    <Physics gravity={[0, 0, 0]}><group onPointerMissed={() => setSelectedRef(null)}><TerrainAndSite project={project} /><Landscape project={project} /><GardenFixtures project={project} />
      {project.buildings.map((building) => <Building key={building.ref} project={project} building={building} />)}
      {ghost?.buildings.map((building) => <Building key={`ghost-${building.ref}`} project={ghost} building={building} ghost />)}
      {ghost && <GardenFixtures project={ghost} fixtures={changedGhostFixtures} ghost />}
      {ghost && changedGhostPlants.map((plant) => <Plant key={`ghost-${plant.ref}`} plant={plant} project={ghost} selected={false} onSelect={() => undefined} ghost />)}
    </group></Physics>
  </>
}
