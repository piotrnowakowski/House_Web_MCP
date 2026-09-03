import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import { polygonBounds } from '../../domain/geometry'
import { useStudioStore } from '../../state/store'

const RADIUS_M = 1.8

/** A ground compass rose whose N arm follows the site's true north. Editor overlay only. */
export function CompassRose() {
  const project = useStudioStore((state) => state.project)
  const north = useMemo(() => { const angle = project.site.northDegrees * Math.PI / 180; return { x: Math.sin(angle), z: Math.cos(angle) } }, [project.site.northDegrees])
  const position = useMemo(() => {
    const bounds = polygonBounds(project.buildings[0]?.slabs[0]?.footprint ?? project.site.boundary)
    const origin = project.buildings[0]?.position ?? { x: 0, z: 0 }
    return new Vector3(origin.x + bounds.minX - 4, 0.09, origin.z + bounds.minZ - 4)
  }, [project])
  const ring = useMemo(() => Array.from({ length: 49 }, (_, index) => { const angle = index / 48 * Math.PI * 2; return new Vector3(Math.cos(angle) * RADIUS_M, 0, Math.sin(angle) * RADIUS_M) }), [])
  const arrow = useMemo(() => [new Vector3(-north.x * RADIUS_M * 0.5, 0, -north.z * RADIUS_M * 0.5), new Vector3(north.x * RADIUS_M, 0, north.z * RADIUS_M)], [north])
  return <group position={position} userData={{ editorOnly: true }}>
    <Line points={ring} color="#dce5df" lineWidth={1.2} transparent opacity={0.8} />
    <Line points={arrow} color="#f7d568" lineWidth={2.4} />
    <Html position={[north.x * RADIUS_M * 1.35, 0, north.z * RADIUS_M * 1.35]} center distanceFactor={40} style={{ pointerEvents: 'none' }}><span className="compass-label">N</span></Html>
  </group>
}
