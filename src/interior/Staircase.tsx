import { Line } from '@react-three/drei'
import { uStairSurfaces } from '../domain/stairs'
import type { StairModel } from '../domain/types'

export function Staircase({ stairs, rise, base, plan }: { stairs: StairModel; rise: number; base: number; plan: boolean }) {
  if (!stairs.uTurn) return <group position={[stairs.start.x, plan ? .03 : base, stairs.start.z]}>
    {Array.from({ length: stairs.steps }, (_, i) => {
      const h = plan ? .035 : rise * (stairs.steps - i) / stairs.steps
      return <mesh key={i} position={[(i + .5) * stairs.runM / stairs.steps, h / 2, stairs.widthM / 2]} castShadow receiveShadow><boxGeometry args={[stairs.runM / stairs.steps - .012, h, stairs.widthM]} /><meshStandardMaterial color={i % 2 ? '#b99365' : '#c49c6b'} roughness={.8} /></mesh>
    })}
    {plan && <Line points={[[stairs.runM - .12, .16, stairs.widthM / 2], [.14, .16, stairs.widthM / 2], [.35, .16, stairs.widthM / 2 - .17], [.14, .16, stairs.widthM / 2], [.35, .16, stairs.widthM / 2 + .17]]} color='#675d4b' lineWidth={1} />}
  </group>

  const surfaces = uStairSurfaces(stairs, rise)
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn
  const width = stairs.widthM, depth = width * 2 + gap, length = landing + stairs.runM
  const tread = stairs.runM / (stairs.steps / 2 - 1)
  const flightRails = [0, width, width + gap, depth].map((z, index) => {
    const returning = index >= 2
    return surfaces.slice(1).filter(surface => (surface.z > width) === returning).map(surface => [surface.x, surface.top + .9, z] as [number, number, number])
  })
  return <group position={[stairs.start.x, plan ? .03 : base, stairs.start.z]}>
    {surfaces.map((surface, i) => <mesh key={i} position={[surface.x, plan ? .02 : surface.top - .04, surface.z]} castShadow receiveShadow>
      <boxGeometry args={[surface.width - (i ? .008 : 0), plan ? .035 : .08, surface.depth]} /><meshStandardMaterial color={i ? '#bd9365' : '#c49c6b'} roughness={.8} />
    </mesh>)}
    {!plan && <>
      {flightRails.map((points, i) => <group key={i}>
        <Line points={points} color='#343b39' lineWidth={3} />
        {points.map(([x, y, z], j) => <mesh key={j} position={[x, y - .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>)}
      </group>)}
      <Line points={[[landing + tread / 2, rise / 2 - rise / stairs.steps + .9, 0], [0, rise / 2 + .9, 0], [0, rise / 2 + .9, depth], [landing + tread / 2, rise / 2 + rise / stairs.steps + .9, depth]]} color='#343b39' lineWidth={3} />
      {[0, depth].map(z => <mesh key={z} position={[.02, rise / 2 + .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>)}
      {/* Upper-floor guard leaves only the return-flight exit open. */}
      <Line points={[[length, rise + .9, width + gap], [length, rise + .9, 0], [0, rise + .9, 0], [0, rise + .9, depth], [length, rise + .9, depth]]} color='#343b39' lineWidth={3} />
      {[0, length / 2, length].flatMap(x => [0, depth].map(z => <mesh key={`${x}/${z}`} position={[x, rise + .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>))}
    </>}
    {plan && <Line points={[[length, .16, width / 2], [landing / 2, .16, width / 2], [landing / 2, .16, depth - width / 2], [length, .16, depth - width / 2], [length - .2, .16, depth - width / 2 - .14], [length, .16, depth - width / 2], [length - .2, .16, depth - width / 2 + .14]]} color='#675d4b' lineWidth={1.5} />}
  </group>
}
