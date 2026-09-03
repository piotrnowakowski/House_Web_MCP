import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import { useStudioStore } from '../../state/store'
import { shadowFocusBounds, sunStateFor } from './sunState'

const ARC_RADIUS_M = 60

/** The day's sun arc with hour ticks and a marker at the current time. Editor overlay only. */
export function SunPath() {
  const project = useStudioStore((state) => state.project)
  const sunTime = useStudioStore((state) => state.sunTime)
  const centre = useMemo(() => shadowFocusBounds(project).getCenter(new Vector3()).setY(0), [project])
  const arc = useMemo(() => {
    const events = sunStateFor(project, sunTime).events
    if (!events) return null
    const at = (hour: number) => { const sun = sunStateFor(project, { ...sunTime, hour }); return new Vector3(centre.x + sun.direction.x * ARC_RADIUS_M, Math.max(0.2, sun.direction.y * ARC_RADIUS_M), centre.z + sun.direction.z * ARC_RADIUS_M) }
    const points: Vector3[] = []
    for (let hour = events.sunriseHour; hour <= events.sunsetHour; hour += 0.25) points.push(at(hour))
    points.push(at(events.sunsetHour))
    const ticks = [] as Array<{ hour: number; position: Vector3 }>
    for (let hour = Math.ceil(events.sunriseHour); hour <= Math.floor(events.sunsetHour); hour += 1) ticks.push({ hour, position: at(hour) })
    return { points, ticks, current: at(Math.min(events.sunsetHour, Math.max(events.sunriseHour, sunTime.hour))), aboveHorizon: sunTime.hour >= events.sunriseHour && sunTime.hour <= events.sunsetHour }
  }, [centre, project, sunTime])
  if (!arc) return null
  return <group userData={{ editorOnly: true }}>
    <Line points={arc.points} color="#f7d568" lineWidth={1.4} transparent opacity={0.75} depthTest={false} renderOrder={26} />
    {arc.ticks.map((tick) => <mesh key={tick.hour} position={tick.position} renderOrder={27}>
      <sphereGeometry args={[tick.hour % 2 === 0 ? 0.55 : 0.32, 10, 8]} /><meshBasicMaterial color="#f7d568" transparent opacity={0.85} depthTest={false} />
      {tick.hour % 2 === 0 && <Html center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}><span className="sun-tick-label">{String(tick.hour).padStart(2, '0')}:00</span></Html>}
    </mesh>)}
    {arc.aboveHorizon && <mesh position={arc.current} renderOrder={28}><sphereGeometry args={[1.4, 16, 12]} /><meshBasicMaterial color="#ffe08a" depthTest={false} /></mesh>}
  </group>
}
