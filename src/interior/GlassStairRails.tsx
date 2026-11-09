import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { StairModel } from '../domain/types'
import { uStairGlassPanels } from '../domain/stairs'

function Panel({ x1, x2, z, bottom1, bottom2, height = 1 }: { x1: number; x2: number; z: number; bottom1: number; bottom2: number; height?: number }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([x1,bottom1,z,x2,bottom2,z,x2,bottom2+height,z,x1,bottom1+height,z],3))
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g
  }, [x1,x2,z,bottom1,bottom2,height])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry}><meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} metalness={.05} side={DoubleSide} depthWrite={false} /></mesh>
}

export function GlassStairRails({ stairs, rise }: { stairs: StairModel; rise: number }) {
  return <group name='glass-stair-rails'>
    {uStairGlassPanels(stairs, rise).map(panel => <Panel key={`${panel.z}/${panel.x1}`} {...panel} />)}
  </group>
}
