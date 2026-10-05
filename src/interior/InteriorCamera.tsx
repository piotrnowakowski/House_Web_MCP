import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { MOUSE, TOUCH, Vector3, OrthographicCamera, PerspectiveCamera } from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import { polygonBounds } from '../domain/geometry'
import type { Polygon2 } from '../domain/types'

export type InteriorView = 'plan' | 'cutaway' | 'room'
interface Props {
  view: InteriorView
  footprint: Polygon2
  reset: number
  enabled: boolean
  cameraKey: string
  bottomInset?: number
  rightInset?: number
}
interface SavedCamera {
  width: number
  height: number
  position: [number, number, number]
  target: [number, number, number]
  zoom: number
}
const cameras = new Map<string, SavedCamera>()

export function InteriorCamera({ view, footprint, reset, enabled, cameraKey, bottomInset = 0, rightInset = 0 }: Props) {
  const controls = useRef<Controls>(null)
  const { size, set } = useThree()
  const perspective = view === 'room'
  const camera = useMemo(
    () => (perspective ? new PerspectiveCamera(65, 1, 0.05, 300) : new OrthographicCamera(-1, 1, 1, -1, 0.05, 300)),
    [perspective],
  )
  useLayoutEffect(() => {
    set({ camera })
  }, [camera, set])
  const previousReset = useRef(reset)
  const key = `${cameraKey}/${view}`
  const insets = useRef({ bottomInset, rightInset })
  insets.current = { bottomInset, rightInset }
  const footprintKey = JSON.stringify(footprint)
  useLayoutEffect(() => {
    camera.clearViewOffset()
    if (camera instanceof OrthographicCamera) {
      camera.left = -size.width / 2
      camera.right = size.width / 2
      camera.top = size.height / 2
      camera.bottom = -size.height / 2
    } else camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
    const fitRequested = previousReset.current !== reset
    previousReset.current = reset
    let saved = cameras.get(key)
    if (!saved) {
      try {
        saved = JSON.parse(sessionStorage.getItem(`interior-camera/${key}`) ?? 'null') ?? undefined
      } catch {
        /* A private browser may block storage. */
      }
    }
    const bounds = polygonBounds(footprint)
    const x = (bounds.minX + bounds.maxX) / 2
    const z = (bounds.minZ + bounds.maxZ) / 2
    const target = new Vector3(x, view === 'room' ? 1.35 : 0, z)
    if (
      saved &&
      !fitRequested &&
      saved.position.every(Number.isFinite) &&
      saved.target.every(Number.isFinite) &&
      Number.isFinite(saved.zoom)
    ) {
      camera.position.set(...saved.position)
      camera.zoom =
        saved.zoom *
        (camera instanceof OrthographicCamera
          ? Math.min(size.width / (saved.width || size.width), size.height / (saved.height || size.height))
          : 1)
      target.set(...saved.target)
    } else if (view === 'room') {
      camera.position.set(x + 0.5, 1.6, bounds.maxZ - 0.45)
      camera.zoom = 1
    } else {
      camera.position.set(x + (view === 'plan' ? 0 : 8), view === 'plan' ? 35 : 27, z + (view === 'plan' ? 0.001 : 15))
      camera.lookAt(target)
      camera.zoom = 1
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      const projected = footprint.flatMap((point) =>
        [0, 2].map((y) => new Vector3(point.x, y, point.z).project(camera)),
      )
      const projectedWidth =
        Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x))
      const projectedHeight =
        Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y))
      const width = Math.max(100, size.width - insets.current.rightInset - 70)
      const height = Math.max(100, size.height - insets.current.bottomInset - 125)
      camera.zoom = Math.max(
        1,
        Math.min(width / ((projectedWidth * size.width) / 2), height / ((projectedHeight * size.height) / 2)),
      )
      // Shift the projection towards the visible area, without moving the orbit target.
      if ('setViewOffset' in camera && typeof camera.setViewOffset === 'function')
        camera.setViewOffset(
          size.width,
          size.height,
          insets.current.rightInset / 2,
          insets.current.bottomInset / 2,
          size.width,
          size.height,
        )
    }
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    controls.current?.target.copy(target)
    controls.current?.update()
  }, [camera, key, view, footprintKey, reset, size.width, size.height])
  const remember = () => {
    if (!controls.current) return
    const saved: SavedCamera = {
      width: size.width,
      height: size.height,
      position: camera.position.toArray(),
      target: controls.current.target.toArray(),
      zoom: camera.zoom,
    }
    cameras.set(key, saved)
    try {
      sessionStorage.setItem(`interior-camera/${key}`, JSON.stringify(saved))
    } catch {
      /* Navigation still works without storage. */
    }
  }
  return (
    <OrbitControls
      ref={controls}
      camera={camera}
      makeDefault
      enabled={enabled}
      enableRotate={view !== 'plan'}
      maxPolarAngle={view === 'room' ? Math.PI * 0.92 : Math.PI / 2.08}
      minZoom={1}
      maxZoom={250}
      minDistance={0.2}
      maxDistance={100}
      enableDamping
      dampingFactor={0.12}
      onEnd={remember}
      mouseButtons={{ LEFT: view === 'plan' ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: view === 'plan' ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
    />
  )
}
