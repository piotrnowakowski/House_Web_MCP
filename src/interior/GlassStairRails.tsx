import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { StairModel } from '../domain/types'

function Panel({ x1, x2, z, bottom1, bottom2 }: { x1: number; x2: number; z: number; bottom1: number; bottom2: number }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([x1,bottom1,z,x2,bottom2,z,x2,bottom2+1,z,x1,bottom1+1,z],3))
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g
  }, [x1,x2,z,bottom1,bottom2])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry}><meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} metalness={.05} side={DoubleSide} depthWrite={false} /></mesh>
}

export function GlassStairRails({ stairs, rise }: { stairs: StairModel; rise: number }) {
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn!
  const length = landing + stairs.runM, width = stairs.widthM, riser = rise / stairs.steps
  const lowerOuter = stairs.uTurn!.entrySide === 'max-z'
  return <group name='glass-stair-rails'>
    {[width, width + gap].map((z,i) => <Panel key={z} x1={landing} x2={length} z={z} bottom1={rise / 2 + (i ? 0 : -riser)} bottom2={i ? rise - riser : 0} />)}
    <Panel x1={landing} x2={length} z={lowerOuter ? 0 : width*2+gap} bottom1={rise/2-(lowerOuter ? riser : 0)} bottom2={lowerOuter ? 0 : rise-riser} />
    {/* Guard the hole beside the upper exit, leaving the return flight unobstructed. */}
    <mesh position={[length, rise + .5, (width + gap) / 2]}><boxGeometry args={[.012,1,width+gap]} /><meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} depthWrite={false} /></mesh>
  </group>
}
