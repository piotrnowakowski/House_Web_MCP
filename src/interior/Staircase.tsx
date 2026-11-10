import { Line } from '@react-three/drei'
import { uStairExitGuards, uStairLayout, uStairSurfaces } from '../domain/stairs'
import type { Polygon2, StairModel } from '../domain/types'
import { GlassStairRails } from './GlassStairRails'
import { WinderStaircase } from './WinderStaircase'

export function Staircase({ stairs, rise, base, plan, opening, upperPlan = false }: { stairs: StairModel; rise: number; base: number; plan: boolean; opening?: Polygon2; upperPlan?: boolean }) {
  if (stairs.uTurn?.winders) return <WinderStaircase {...{stairs,rise,base,plan,opening,upperPlan}} />
  if (!stairs.uTurn) return <group userData={{ semanticRef: stairs.ref }} position={[stairs.start.x, plan ? .03 : base, stairs.start.z]}>
    {Array.from({ length: stairs.steps }, (_, i) => {
      const h = plan ? .035 : rise * (stairs.steps - i) / stairs.steps
      return <mesh key={i} position={[(i + .5) * stairs.runM / stairs.steps, h / 2, stairs.widthM / 2]} castShadow receiveShadow><boxGeometry args={[stairs.runM / stairs.steps - .012, h, stairs.widthM]} /><meshStandardMaterial color={i % 2 ? '#b99365' : '#c49c6b'} roughness={.8} /></mesh>
    })}
    {plan && <Line points={[[stairs.runM - .12, .16, stairs.widthM / 2], [.14, .16, stairs.widthM / 2], [.35, .16, stairs.widthM / 2 - .17], [.14, .16, stairs.widthM / 2], [.35, .16, stairs.widthM / 2 + .17]]} color='#675d4b' lineWidth={1} />}
  </group>

  // Reflect the entire assembly once, including risers, arrow and exit guard.
  const surfaces = uStairSurfaces({ ...stairs, uTurn: { ...stairs.uTurn, entrySide: 'min-z' } }, rise)
  const layout = uStairLayout(stairs, rise)
  if (!layout) return null
  const mirrored = stairs.uTurn.entrySide === 'max-z'
  const { landingDepthM: landing, gapM: gap } = stairs.uTurn
  const width = stairs.widthM, depth = width * 2 + gap
  const { lowerLength: length, upperLength, landingHeight, tread } = layout
  // The extended foot lies under the upper slab. Preserve actual elevations in
  // its upper-floor plan so the floor occludes it outside the L-shaped opening.
  const belowSlabPlan = plan && upperPlan && stairs.uTurn.lowerSteps !== undefined
  const arrowY = belowSlabPlan ? rise + .16 : .16
  const arrowStart = belowSlabPlan && opening ? Math.min(length, Math.max(...opening.map(p => p.x-stairs.start.x))) : length
  const color = stairs.finish?.treadColor
  const flightRails = [0, width, width + gap, depth].map((z, index) => {
    const returning = index >= 2
    return surfaces.slice(1).filter(surface => (surface.z > width) === returning).map(surface => [surface.x, surface.top + .9, z] as [number, number, number])
  })
  return <group userData={{ semanticRef: stairs.ref }} position={[stairs.start.x, plan && !belowSlabPlan ? .03 : base, stairs.start.z]}>
    <group position-z={mirrored ? depth : 0} scale-z={mirrored ? -1 : 1}>
    {surfaces.map((surface, i) => <mesh key={i} position={[surface.x, plan ? belowSlabPlan ? surface.top-.0175 : .02 : surface.top-.04, surface.z]} castShadow receiveShadow>
      <boxGeometry args={[surface.width - (i && !stairs.finish?.closedRisers ? .008 : 0), plan ? .035 : .08, surface.depth]} /><meshStandardMaterial color={color ?? (i ? '#bd9365' : '#c49c6b')} roughness={.8} />
    </mesh>)}
    {!plan && stairs.finish?.closedRisers && <group name='closed-stair-risers'>
      {surfaces.slice(1).map((s,i) => <mesh key={i} position={[s.x + (s.z > width ? -1 : 1) * (s.width / 2 - .04), s.top - rise / stairs.steps / 2, s.z]} castShadow receiveShadow><boxGeometry args={[.08,rise/stairs.steps,s.depth]} /><meshStandardMaterial color={color} roughness={.8} /></mesh>)}
      <mesh position={[landing-.04,landingHeight-rise/stairs.steps/2,width/2]}><boxGeometry args={[.08,rise/stairs.steps,width]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[upperLength-.04,rise-rise/stairs.steps/2,width*1.5+gap]}><boxGeometry args={[.08,rise/stairs.steps,width]} /><meshStandardMaterial color={color} /></mesh>
    </group>}
    {!plan && stairs.finish?.railing === 'glass' && <GlassStairRails stairs={stairs} rise={rise} />}
    {!plan && stairs.finish?.railing !== 'glass' && <>
      {flightRails.map((points, i) => <group key={i}>
        <Line points={points} color='#343b39' lineWidth={3} />
        {points.map(([x, y, z], j) => <mesh key={j} position={[x, y - .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>)}
      </group>)}
      <Line points={[[landing + tread / 2, landingHeight - rise / stairs.steps + .9, 0], [0, landingHeight + .9, 0], [0, landingHeight + .9, depth], [landing + tread / 2, landingHeight + rise / stairs.steps + .9, depth]]} color='#343b39' lineWidth={3} />
      {[0, depth].map(z => <mesh key={z} position={[.02, landingHeight + .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>)}
      {/* Upper-floor guard leaves only the return-flight exit open. */}
      {!stairs.uTurn.lowerSteps && <>
      <Line points={[[length, rise + .9, width + gap], [length, rise + .9, 0], [0, rise + .9, 0], [0, rise + .9, depth], [length, rise + .9, depth]]} color='#343b39' lineWidth={3} />
      {[0, length / 2, length].flatMap(x => [0, depth].map(z => <mesh key={`${x}/${z}`} position={[x, rise + .45, z]}><boxGeometry args={[.025, .9, .025]} /><meshStandardMaterial color='#343b39' /></mesh>))}
      </>}
    </>}
    {plan && <Line points={[[arrowStart, arrowY, width / 2], [landing / 2, arrowY, width / 2], [landing / 2, arrowY, depth - width / 2], [upperLength, arrowY, depth - width / 2], [upperLength - .2, arrowY, depth - width / 2 - .14], [upperLength, arrowY, depth - width / 2], [upperLength - .2, arrowY, depth - width / 2 + .14]]} color='#675d4b' lineWidth={1.5} />}
    </group>
    {!plan && (stairs.finish?.railing === 'glass' || stairs.uTurn.lowerSteps) && <group name='upper-stair-opening-guards'>
      {uStairExitGuards(stairs, opening).map(({ start, end }, i) => <mesh key={i}
        position={[(start.x+end.x)/2,rise+.5,(start.z+end.z)/2]} rotation-y={-Math.atan2(end.z-start.z,end.x-start.x)}>
        <boxGeometry args={[Math.hypot(end.x-start.x,end.z-start.z),1,.012]} />
        {stairs.finish?.railing === 'glass' ? <meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} depthWrite={false} /> : <meshStandardMaterial color='#343b39' />}
      </mesh>)}
    </group>}
  </group>
}
