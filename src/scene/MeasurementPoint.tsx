import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Mesh, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

/** Keep endpoints easy to see and grab even when the view is zoomed out. */
export function MeasurementPoint({ position, waiting = false, color = '#b9e84d' }: { position: Vector3; waiting?: boolean; color?: string }) {
  const point = useRef<Mesh>(null)
  useFrame(({ camera, size, clock }) => {
    if (!point.current) return
    const depth = -position.clone().applyMatrix4(camera.matrixWorldInverse).z
    const worldPerPixel = camera instanceof OrthographicCamera
      ? (camera.top - camera.bottom) / camera.zoom / size.height
      : camera instanceof PerspectiveCamera ? 2 * depth * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / size.height : 0.02
    const pulse = waiting ? 1 + Math.sin(clock.elapsedTime * 5) * 0.18 : 1
    point.current.scale.setScalar(Math.max(worldPerPixel, 0.001) * 6 / 0.13 * pulse)
  })
  return <mesh ref={point} position={position} renderOrder={30} userData={{ editorOnly: true, measurementOverlay: true, measurementPoint: true }}>
    <sphereGeometry args={[0.13, 16, 12]} />
    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
  </mesh>
}
