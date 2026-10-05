import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import { neighborSurface } from '../domain/neighbors'
import type { NeighborBuilding } from '../domain/types'
import { useStudioStore } from '../state/store'

function Neighbor({ building }: { building: NeighborBuilding }) {
  const geometries = useMemo(() => {
    const surface = neighborSurface(building)
    return [surface.walls, surface.roof].map((positions) => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
      geometry.computeVertexNormals()
      return geometry
    })
  }, [building])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])
  return <group name={building.ref} userData={{ neighborRef: building.ref }}>
    {geometries.map((geometry, index) => <mesh key={index} geometry={geometry} castShadow receiveShadow raycast={() => {}}>
      <meshStandardMaterial color={index ? '#596166' : '#b9b9ab'} roughness={0.94} side={DoubleSide} />
    </mesh>)}
  </group>
}

/** Context only: does not enter owner selection, transforms, collision editing or metrics. */
export function NeighborBuildings() {
  const neighbors = useStudioStore((state) => state.project.site.neighbors)
  const boundary = useStudioStore((state) => state.project.site.boundary)
  const visible = useStudioStore((state) => state.neighborsVisible)
  const ground = useMemo(() => {
    const points = [...boundary, ...(neighbors ?? []).flatMap((item) => item.footprint)]
    const x0 = Math.min(...points.map((p) => p.x)) - 12, x1 = Math.max(...points.map((p) => p.x)) + 12
    const z0 = Math.min(...points.map((p) => p.z)) - 12, z1 = Math.max(...points.map((p) => p.z)) + 12
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0 }
  }, [boundary, neighbors])
  if (!visible || !neighbors?.length) return null
  return <>
    <mesh name='neighbor-context-ground' position={[ground.x, -0.04, ground.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => {}}>
      <planeGeometry args={[ground.width, ground.depth]} /><meshStandardMaterial color='#899986' roughness={1} />
    </mesh>
    <group name='neighbor-buildings'>{neighbors.map((building) => <Neighbor key={building.ref} building={building} />)}</group>
  </>
}
