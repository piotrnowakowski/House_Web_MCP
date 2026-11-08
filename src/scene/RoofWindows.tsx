import { DoubleSide, Plane, Vector3 } from 'three'
import { roofWindowLayout } from '../domain/roofWindows'
import type { RoofSegmentModel } from '../domain/types'

export const roofWindowCutouts = (segment: RoofSegmentModel) => (segment.windows ?? []).map(window => {
  const [a,,c] = roofWindowLayout(segment, window).footprint
  return [new Plane(new Vector3(1,0,0),-a.x), new Plane(new Vector3(-1,0,0),c.x), new Plane(new Vector3(0,0,1),-a.z),new Plane(new Vector3(0,0,-1),c.z)]
})

export function RoofWindows({ segment, elevationOffset = 0 }: { segment: RoofSegmentModel; elevationOffset?: number }) {
  return <>{(segment.windows ?? []).map(window => {
    const { elevationM, rotation, size: [width, depth] } = roofWindowLayout(segment, window)
    return <group key={window.ref} userData={{ semanticRef: window.ref }} position={[window.position.x, elevationM + elevationOffset, window.position.z]} rotation={rotation}>
      <mesh position={[0,.11,0]} rotation-x={-Math.PI/2}><planeGeometry args={[width-.1,depth-.1]}/><meshStandardMaterial color="#9cb9c7" transparent opacity={.48} roughness={.08} metalness={.15} side={DoubleSide}/></mesh>
      {[-1,1].flatMap(sign => [
        <mesh key={`x${sign}`} position={[sign*(width-.05)/2,0,0]}><boxGeometry args={[.05,.3,depth]}/><meshStandardMaterial color="#333a3b"/></mesh>,
        <mesh key={`z${sign}`} position={[0,0,sign*(depth-.05)/2]}><boxGeometry args={[width-.1,.3,.05]}/><meshStandardMaterial color="#333a3b"/></mesh>,
      ])}
    </group>
  })}</>
}
