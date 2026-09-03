import { useEffect, useMemo, useRef } from 'react'
import { DirectionalLight, Object3D, Vector3 } from 'three'
import type { ViewMode } from '../../domain/types'
import { useStudioStore } from '../../state/store'
import { SHADOW_MARGIN_M, SUN_DISTANCE_M, shadowFocusBounds, sunColorFor, sunStateFor } from './sunState'

/** One directional light that follows the real sun in realistic mode and stays a neutral studio light in technical mode. */
export function SunLight({ mode }: { mode: ViewMode }) {
  const project = useStudioStore((state) => state.project)
  const sunTime = useStudioStore((state) => state.sunTime)
  const light = useRef<DirectionalLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const sun = useMemo(() => sunStateFor(project, sunTime), [project, sunTime])
  const bounds = useMemo(() => shadowFocusBounds(project), [project])
  const centre = useMemo(() => bounds.getCenter(new Vector3()), [bounds])
  const radius = useMemo(() => bounds.getSize(new Vector3()).length() / 2 + SHADOW_MARGIN_M, [bounds])
  const technical = mode === 'technical'
  const daylight = Math.max(0, Math.sin(sun.altitudeDeg * Math.PI / 180))
  const position: [number, number, number] = technical
    ? [centre.x + 18, centre.y + 28, centre.z + 14]
    : [centre.x + sun.direction.x * SUN_DISTANCE_M, centre.y + Math.max(0.02, sun.direction.y) * SUN_DISTANCE_M, centre.z + sun.direction.z * SUN_DISTANCE_M]
  const intensity = technical ? 2 : sun.altitudeDeg <= 0 ? 0 : 0.6 + 2.4 * Math.min(1, daylight * 1.5)
  const color = technical ? '#ffffff' : sunColorFor(sun.altitudeDeg)
  useEffect(() => {
    const current = light.current
    if (!current) return
    target.position.copy(centre)
    current.target = target
    current.shadow.camera.left = -radius; current.shadow.camera.right = radius; current.shadow.camera.top = radius; current.shadow.camera.bottom = -radius
    current.shadow.camera.near = 1; current.shadow.camera.far = SUN_DISTANCE_M + radius * 2
    current.shadow.camera.updateProjectionMatrix()
  }, [centre, radius, target])
  return <>
    <ambientLight intensity={technical ? 1.4 : 0.32 + 0.5 * daylight} color={technical ? '#ffffff' : sun.altitudeDeg <= 0 ? '#5d6c86' : '#dfe8ff'} />
    <primitive object={target} />
    <directionalLight ref={light} position={position} intensity={intensity} color={color} castShadow shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-mapSize={[2048, 2048]} userData={{ sunLight: true }} />
  </>
}
