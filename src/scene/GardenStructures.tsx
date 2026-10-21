import { useEffect, useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three'
import { metreBoxGeometry } from './metreGeometry'
import { TexturedMaterial } from './materials'
import type { TextureId } from '../domain/textures'
import type { PlantModel } from '../domain/types'
import { pergolaMembers } from '../domain/pergola'
import { solarTable, solarTableWidthM, solarTableSlopeM, solarTableRiseM } from '../domain/gardenFixtures'

type GardenVisualProps = { selected: boolean; ghost: boolean }
type Triple = [number, number, number]

export function ThujaPlant({ plant, selected, ghost }: GardenVisualProps & { plant: PlantModel }) {
  const geometry = useMemo(() => {
    const result = new LatheGeometry([[0,0],[.32,.04],[.48,.16],[.5,.35],[.42,.58],[.28,.78],[.08,.94],[0,1]].map(([r,y]) => new Vector2(r,y)), 32)
    const positions = result.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const angle = Math.atan2(positions.getZ(i), positions.getX(i))
      const ripple = .94 + .06 * Math.cos(angle * 12 + positions.getY(i) * 15)
      positions.setXYZ(i, positions.getX(i) * ripple, positions.getY(i), positions.getZ(i) * ripple)
    }
    result.computeVertexNormals()
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} scale={[plant.canopyM, plant.matureHeightM, plant.canopyM]} castShadow={!ghost} receiveShadow>
    <meshStandardMaterial color={selected ? '#bedb84' : '#416b38'} roughness={.95} transparent={ghost} opacity={ghost ? .35 : 1} depthWrite={!ghost} />
  </mesh>
}

export function FloweringBorderPlant({ plant, month, ...props }: GardenVisualProps & { plant: PlantModel; month: number }) {
  const lavender = plant.species.startsWith('Lavandula'), flowering = plant.bloomMonths.includes(month)
  const leaves = plant.leafMonths.includes(month)
  return <group scale={[plant.canopyM, plant.matureHeightM, plant.canopyM]}>
    <mesh position-y={0.36} scale={[0.5, 0.36, 0.5]} castShadow={!props.ghost} receiveShadow>
      <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={props.selected ? '#bedb84' : lavender ? '#718671' : leaves ? '#527543' : '#74624e'} roughness={0.9} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} />
    </mesh>
    {Array.from({ length: lavender ? 13 : 9 }, (_, i) => {
      const angle=i*2.39996, radius=.3*Math.sqrt((i+.5)/(lavender?13:9)), y=.76+(i%3)*.06
      return <mesh key={i} position={[Math.cos(angle)*radius,y,Math.sin(angle)*radius]} scale={lavender?[.025,.12,.025]:[.13,.12,.13]} castShadow={!props.ghost}>
        <sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={props.selected ? '#bedb84' : flowering ? lavender ? '#8c72a7' : '#e5e7c5' : '#6b7d4e'} roughness={0.9} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} />
      </mesh>
    })}
  </group>
}

export function GardenSpaStructure({ kind, ...props }: GardenVisualProps & { kind: 'round-hot-tub' | 'garden-sauna' | 'pizza-oven' | 'pizza-oven-tall-flue' | 'kitchen-pergola' | 'kitchen-spa-canopy' | 'kitchen-spa-retractable' | 'compact-kitchen-spa' }) {
  const [coverOpen, setCoverOpen] = useState(true)
  if (kind === 'compact-kitchen-spa') return <group>
    {/* Full timber soffit with a graphite weathering layer; separate openings for the flue and sliding cover. */}
    {[
      [-3.2,3.2,-4.9,.45], [-3.2,1.8,.45,1.15], [2.5,3.2,.45,1.15],
      [-3.2,3.2,1.15,1.4], [-3.2,-3,1.4,4.65], [-.1,3.2,1.4,4.65], [-3.2,3.2,4.65,4.9],
    ].map(([x1,x2,z1,z2],i)=><group key={i}>
      <GardenBox size={[x2-x1,.08,z2-z1]} at={[(x1+x2)/2,3.03,(z1+z2)/2]} asset="hinoki" {...props} />
      <GardenBox size={[x2-x1,.03,z2-z1]} at={[(x1+x2)/2,3.085,(z1+z2)/2]} color="#343936" {...props} />
    </group>)}
    {[-1,1].flatMap(s=>[
      <GardenBox key={`side-${s}`} size={[.2,.32,9.8]} at={[s*3.1,2.84,0]} asset="hinoki" {...props} />,
      <GardenBox key={`end-${s}`} size={[6,.32,.2]} at={[0,2.84,s*4.8]} asset="hinoki" {...props} />,
    ])}
    {[-4.65,1.3,4.65].flatMap(z=>[-3,3].map(x=><group key={`${x}-${z}`}>
      <GardenBox size={[.2,2.68,.2]} at={[x,1.34,z]} asset="hinoki" {...props} />
      <GardenBox size={[.14,1.13,.14]} at={[x-Math.sign(x)*.4,2.25,z]} rotation={[0,0,-Math.sign(x)*Math.PI/4]} asset="hinoki" {...props} />
      <GardenBox size={[.14,1.13,.14]} at={[x,2.25,z-Math.sign(z)*.4]} rotation={[Math.sign(z)*Math.PI/4,0,0]} asset="hinoki" {...props} />
    </group>))}
    {Array.from({length:8},(_,i)=>-4.55+i*.65).map(z=><GardenBox key={z} size={[6,.22,.1]} at={[0,2.88,z]} asset="hinoki" {...props} />)}
    {[[4.8,-.6],[.5,2.75]].map(([w,x])=><GardenBox key={x} size={[w,.22,.1]} at={[x,2.88,.65]} asset="hinoki" {...props} />)}
    {[1.3,4.65].map(z=><GardenBox key={z} size={[6,.22,.12]} at={[0,2.88,z]} asset="hinoki" {...props} />)}
    {[2,2.65,3.3,3.95].map(z=><GardenBox key={z} size={[3.1,.22,.1]} at={[1.45,2.88,z]} asset="hinoki" {...props} />)}
    {[-2.96,-.14].map(x=><GardenBox key={x} size={[.08,.1,3.25]} at={[x,2.96,3.025]} color="#343936" {...props} />)}
    {Array.from({length:6},(_,i)=><GardenBox key={i} size={[2.82,.035,coverOpen?.2:.55]} at={[-1.55,3.025-i*.004,coverOpen?4.53-i*.12:1.675+i*.54]} color="#d6d0bd" {...props} />)}
    <GardenBox size={[.7,.04,.7]} at={[2.15,3.08,.8]} color="#737a79" {...props} />
    {[-3.8,-2.3,-.8].map(z=><group key={z} position={[.8,0,z]}>
      <GardenBox size={[.015,.48,.015]} at={[0,2.64,0]} color="#343936" {...props} />
      <mesh position={[0,2.36,0]} castShadow={!props.ghost}><coneGeometry args={[.2,.12,24,1,true]} /><meshStandardMaterial color={props.selected?'#bedb84':'#343936'} side={DoubleSide} transparent={props.ghost} opacity={props.ghost?.35:1} /></mesh>
      <mesh position={[0,2.3,0]}><sphereGeometry args={[.045,12,8]} /><meshStandardMaterial color="#ffedc0" emissive="#ffca78" emissiveIntensity={props.ghost?0:.5} transparent={props.ghost} opacity={props.ghost?.35:1} /></mesh>
    </group>)}
    {props.selected && !props.ghost && <Html position={[-1.55,3.5,3.025]} center>
      <button type="button" style={{whiteSpace:'nowrap',color:'#213026',background:'#f4f0e6',padding:'6px 10px'}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setCoverOpen(!coverOpen)}}>{coverOpen?'Zasłoń dach nad jacuzzi':'Odsłoń dach nad jacuzzi'}</button>
    </Html>}
  </group>
  const retractable = kind === 'kitchen-spa-retractable'
  if (kind === 'kitchen-spa-canopy' || retractable) return <group>
    {(retractable ? [
      [-3.7, 3.7, -7.6, -.55], [-3.7, 3.7, .15, 3.3], [-3.7, 2, -.55, .15], [2.7, 3.7, -.55, .15],
      [-3.7, 3.7, 7.15, 7.6], [-3.7, -3.4, 3.3, 7.15], [-.5, 3.7, 3.3, 7.15],
    ] : [[-3.7, 3.7, -7.6, 7.6]]).map(([x1,x2,z1,z2],i)=><group key={i}>
      <GardenBox size={[x2-x1, .18, z2-z1]} at={[(x1+x2)/2, 2.98, (z1+z2)/2]} asset="hinoki" {...props} />
      <GardenBox size={[x2-x1, .03, z2-z1]} at={[(x1+x2)/2, 3.085, (z1+z2)/2]} color="#343936" {...props} />
    </group>)}
    {retractable && <group>
      {[-3.36,-.54].map(x=><GardenBox key={x} size={[.08,.1,3.85]} at={[x,2.96,5.225]} color="#343936" {...props} />)}
      {Array.from({length:6},(_,i)=><GardenBox key={i} size={[2.82,.035,coverOpen ? .22 : .65]} at={[-1.95,3.025-i*.004,coverOpen?7.02-i*.13:3.625+i*.64]} color="#d6d0bd" {...props} />)}
      {/* Noncombustible conceptual collar; final clearances depend on the selected flue system. */}
      <GardenBox size={[.7,.04,.7]} at={[2.35,3.08,-.2]} color="#737a79" {...props} />
      {props.selected && !props.ghost && <Html position={[-1.95,3.5,5.2]} center>
        <button type="button" style={{whiteSpace:'nowrap',color:'#213026',background:'#f4f0e6',padding:'6px 10px'}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setCoverOpen(!coverOpen)}}>{coverOpen?'Zasłoń dach nad jacuzzi':'Odsłoń dach nad jacuzzi'}</button>
      </Html>}
    </group>}
    {[-1, 1].flatMap(side => [
      <GardenBox key={`side-${side}`} size={[.16, .3, 15.2]} at={[side * 3.62, 2.95, 0]} asset="hinoki" {...props} />,
      <GardenBox key={`end-${side}`} size={[7.08, .3, .16]} at={[0, 2.95, side * 7.52]} asset="hinoki" {...props} />,
    ])}
    {[-7.4, -3.7, 0, retractable ? 3.3 : 3.7, 7.4].map(z => <group key={z}>
      <GardenBox size={[7.16, .18, .16]} at={[0, 2.8, z]} asset="hinoki" {...props} />
      {[-3.5, 3.5].map(x => <GardenBox key={x} size={[.16, 2.71, .16]} at={[x, 1.355, z]} asset="hinoki" {...props} />)}
    </group>)}
  </group>
  if (kind === 'kitchen-pergola') {
    const members = pergolaMembers({
      ref: 'roof/garden-pergola', type: 'flat', footprint: [{ x: -2.43, z: -3.43 }, { x: 2.43, z: -3.43 }, { x: 2.43, z: 3.43 }, { x: -2.43, z: 3.43 }],
      baseElevationM: 2.46, pitchDegrees: 0, overhangM: 0, ridgeDirection: 'z', adjacentSegmentRefs: [], finish: { material: 'membrane', colorHex: '#343936' },
      canopy: { fasciaHeightM: 0.18, fasciaEdgeIndices: [0, 1, 2, 3], soffitColorHex: '#a78258', postWidthM: 0.14, postBaseElevationM: 0,
        posts: [-2.43, 2.43].flatMap(x => [-3.43, 0, 3.43].map(z => ({ x, z }))), slats: { direction: 'x', spacingM: 0.42, widthM: 0.08 } },
    })
    return <group>{members.map((m, i) => <GardenBox key={i} size={[m.size.x, m.size.y, m.size.z]} at={[m.centre.x, m.centre.y, m.centre.z]} rotation={[0, m.yaw, 0]} asset="hinoki" color="#94704d" {...props} />)}</group>
  }
  if (kind === 'garden-sauna') return <group>
    <GardenBox size={[2.5, 0.14, 3]} at={[0, 0.07, 0]} asset="hinoki" {...props} />
    <GardenBox size={[2.5, 0.14, 3]} at={[0, 2.43, 0]} color="#303638" {...props} />
    {[-1, 1].map(s => <GardenBox key={s} size={[0.12, 2.22, 3]} at={[s * 1.19, 1.25, 0]} asset="hinoki" {...props} />)}
    <GardenBox size={[2.26, 2.22, 0.12]} at={[0, 1.25, -1.44]} asset="hinoki" {...props} />
    {[-0.85, 0.85].map(x => <GardenBox key={x} size={[0.52, 0.1, 2.2]} at={[x, 0.58, -0.2]} asset="hinoki" {...props} />)}
    <mesh position={[0, 1.25, 1.43]}><planeGeometry args={[2.26, 2.22]} /><meshPhysicalMaterial color={props.selected ? '#bedb84' : '#d1e1d9'} transparent opacity={props.ghost ? 0.12 : 0.25} roughness={0.1} side={DoubleSide} depthWrite={false} /></mesh>
    {[-1.12, -0.48, 0.48, 1.12].map(x => <GardenBox key={x} size={[0.045, 2.22, 0.07]} at={[x, 1.25, 1.46]} color="#303638" {...props} />)}
    <GardenBox size={[0.035, 0.5, 0.06]} at={[0.38, 1.1, 1.47]} asset="hinoki" {...props} />
    <GardenBox size={[0.45, 0.7, 0.45]} at={[0, 0.49, -1]} color="#363d3f" {...props} />
  </group>
  if (kind === 'pizza-oven' || kind === 'pizza-oven-tall-flue') return <group>
    <GardenBox size={[1, 0.88, 1.05]} at={[0, 0.44, 0]} asset="brick-floor" {...props} />
    <GardenBox size={[1, 0.08, 1.05]} at={[0, 0.92, 0]} color="#aaa69b" {...props} />
    <mesh position={[0, 0.96, -0.04]} scale={[0.48, 0.48, 0.46]} castShadow={!props.ghost}><sphereGeometry args={[1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={props.selected ? '#bedb84' : '#d9cfb7'} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} /></mesh>
    <GardenBox size={[0.42, 0.28, 0.035]} at={[0, 1.1, 0.4]} color="#242725" {...props} />
    <mesh position={[0, kind === 'pizza-oven' ? 1.73 : 2.73, -0.15]} castShadow={!props.ghost}><cylinderGeometry args={[kind === 'pizza-oven' ? .08 : .13, kind === 'pizza-oven' ? .08 : .13, kind === 'pizza-oven' ? .74 : 2.74, 24]} /><meshStandardMaterial color={props.selected ? '#bedb84' : '#363d3f'} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} /></mesh>
    {kind === 'pizza-oven-tall-flue' && <mesh position={[0,4.16,-.15]} castShadow={!props.ghost}><coneGeometry args={[.22,.08,24]} /><meshStandardMaterial color={props.selected?'#bedb84':'#363d3f'} transparent={props.ghost} opacity={props.ghost ? .35 : 1} /></mesh>}
  </group>
  return <group>
    <mesh position={[0, 0.51, -0.25]} castShadow={!props.ghost}><cylinderGeometry args={[1.2, 1.18, 1.02, 48]} /><TexturedMaterial asset="hinoki" color={props.selected ? '#bedb84' : '#a78258'} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} /></mesh>
    <mesh position={[0, 1.06, -0.25]} rotation-x={-Math.PI / 2}><circleGeometry args={[1.08, 48]} /><meshPhysicalMaterial color="#78bbc4" roughness={0.17} metalness={0.1} transparent opacity={props.ghost ? 0.3 : 0.88} /></mesh>
    <mesh position={[0, 1.075, -0.25]} rotation-x={Math.PI / 2} castShadow={!props.ghost}><torusGeometry args={[1.125, 0.075, 10, 48]} /><meshStandardMaterial color={props.selected ? '#bedb84' : '#d6c2a0'} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} /></mesh>
    <GardenBox size={[1, 0.22, 0.5]} at={[0, 0.11, 1.2]} asset="hinoki" {...props} />
    <GardenBox size={[1, 0.2, 0.25]} at={[0, 0.32, 1.075]} asset="hinoki" {...props} />
  </group>
}

function GardenBox({ size, at = [0, 0, 0], rotation = [0, 0, 0], asset, color = '#ffffff', selected, ghost, roughness = 0.8 }: GardenVisualProps & { size: Triple; at?: Triple; rotation?: Triple; asset?: TextureId; color?: string; roughness?: number }) {
  const [w, h, d] = size
  const geometry = useMemo(() => metreBoxGeometry(w, h, d), [w, h, d])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={at} rotation={rotation} castShadow={!ghost} receiveShadow>
    {asset ? <TexturedMaterial asset={asset} color={selected ? '#bedb84' : color} roughness={roughness} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
      : <meshStandardMaterial color={selected ? '#bedb84' : color} roughness={roughness} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />}
  </mesh>
}

export function SolarTable(props: GardenVisualProps) {
  const t = solarTable, tilt = t.tiltDegrees * Math.PI / 180, centreY = t.lowEdgeM + solarTableRiseM / 2
  return <group>
    <group position-y={centreY} rotation-x={tilt}>
      {Array.from({ length: t.rows * t.columns }, (_, i) => {
        const x = (i % t.columns - (t.columns - 1) / 2) * (t.moduleWidthM + t.gapM)
        const z = (Math.floor(i / t.columns) - (t.rows - 1) / 2) * (t.moduleLengthM + t.gapM)
        return <group key={i} position={[x, 0, z]} userData={{ solarModulePowerW: t.modulePowerW }}>
          <GardenBox size={[t.moduleWidthM, .035, t.moduleLengthM]} color="#a9b3b5" {...props} />
          <GardenBox size={[t.moduleWidthM - .035, .008, t.moduleLengthM - .035]} at={[0, .022, 0]} color="#142d43" roughness={.28} {...props} />
        </group>
      })}
      {[-1.4, -.5, .5, 1.4].map(z => <GardenBox key={z} size={[solarTableWidthM, .08, .06]} at={[0, -.06, z]} color="#747e83" {...props} />)}
    </group>
    {[-4.6, 0, 4.6].flatMap(x => [-1, 1].map(side => {
      const z = side * solarTableSlopeM * .35 * Math.cos(tilt), height = centreY - z * Math.tan(tilt) - .1
      return <GardenBox key={`${x}/${side}`} size={[.09, height, .09]} at={[x, height / 2, z]} color="#747e83" {...props} />
    }))}
  </group>
}

export function DetailedGreenhouse(props: GardenVisualProps) {
  const frame = (key: string, at: Triple, size: Triple, rotation?: Triple) => <GardenBox key={key} at={at} size={size} rotation={rotation} color="#343936" roughness={0.38} {...props} />
  const glass = <meshPhysicalMaterial color={props.selected ? '#c8e8af' : '#e0ede7'} roughness={0.12} metalness={0.12} transparent opacity={props.ghost ? 0.12 : 0.18} depthWrite={false} side={DoubleSide} clearcoat={1} clearcoatRoughness={0.08} />
  const pitch = Math.atan2(0.7, 1.5), slope = Math.hypot(1.5, 0.7)
  return <group>
    <GardenBox size={[4.12, 0.16, 3.12]} at={[0, 0.08, 0]} asset="brick-floor" {...props} />
    <GardenBox size={[0.95, 0.035, 2.95]} at={[0, 0.175, 0]} asset="brick-floor" {...props} />
    {[-1, 1].map(side => <group key={side}>
      {Array.from({ length: 8 }, (_, i) => {
        const x = -1.75 + i * 0.5
        // The central front bays are genuinely open; the sliding door is parked beside them.
        if (side === 1 && (i === 3 || i === 4)) return null
        return <mesh key={i} position={[x, 1.02, side * 1.5]}><planeGeometry args={[0.46, 1.66]} />{glass}</mesh>
      })}
      <mesh position={[0, 2.25, side * 0.75]} rotation={[-Math.PI / 2 + side * pitch, 0, 0]}><planeGeometry args={[4, slope]} />{glass}</mesh>
      {[-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2].map(x => frame(`post-${side}-${x}`, [x, 1.02, side * 1.5], [0.032, 1.72, 0.045]))}
      {[-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map(x => frame(`rafter-${side}-${x}`, [x, 2.25, side * 0.75], [0.033, 0.04, slope], [side * pitch, 0, 0]))}
      {[0.2, 1.02, 1.9].flatMap(y => side === 1 && y === 1.02
        ? [-1, 1].map(s => frame(`door-rail-${s}`, [s * 1.25, y, 1.5], [1.48, 0.035, 0.04]))
        : [frame(`rail-${side}-${y}`, [0, y, side * 1.5], [4.04, 0.035, 0.04])])}
      {frame(`gutter-${side}`, [0, 1.91, side * 1.54], [4.12, 0.055, 0.09])}
      {/* Glazed gable ends with fine vertical mullions. */}
      <mesh position={[side * 2, 1.02, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3, 1.66]} />{glass}</mesh>
      {[-1, -0.5, 0, 0.5, 1].map(z => frame(`end-${side}-${z}`, [side * 2, 1.0, z], [0.032, 1.78, 0.032]))}
      {[-1, 1].map(s => <mesh key={s} position={[side * 2, 1.9, s * 0.75]} rotation={[0, Math.PI / 2, 0]}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-0.75, 0, 0, 0.75, 0, 0, s * 0.75, 0.7, 0]), 3]} /></bufferGeometry>{glass}
      </mesh>)}
    </group>)}
    {frame('ridge', [0, 2.61, 0], [4.14, 0.055, 0.07])}
    {/* Open sliding door, handle, guide track and gutter downpipe. */}
    {frame('track', [0.45, 1.96, 1.55], [2.0, 0.035, 0.055])}
    <mesh position={[1.0, 1.02, 1.56]}><planeGeometry args={[0.94, 1.66]} />{glass}</mesh>
    {[-0.47, 0.47].map(x => frame(`door-${x}`, [1 + x, 1.02, 1.56], [0.032, 1.72, 0.032]))}
    {frame('handle', [0.58, 1.02, 1.60], [0.025, 0.18, 0.035])}
    {frame('downpipe', [2.05, 1.0, -1.48], [0.055, 1.8, 0.055])}
    {/* Potting benches with legs, soil trays and recognisable terracotta pots. */}
    {[-1, 1].map(side => <group key={`bench-${side}`}>
      <GardenBox at={[side * 1.25, 0.82, -0.1]} size={[0.75, 0.055, 2.45]} asset="hinoki" {...props} />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <GardenBox key={`${x}-${z}`} at={[side * 1.25 + x * 0.29, 0.49, -0.1 + z * 1.0]} size={[0.055, 0.65, 0.055]} color="#343936" {...props} />))}
      {[-0.95, -0.45, 0.1, 0.65].map((z, i) => <group key={z} position={[side * 1.25, 0.85, z]}>
        <mesh position-y={0.11} castShadow><cylinderGeometry args={[0.13, 0.085, 0.22, 18]} /><meshStandardMaterial color={i % 2 ? '#ac694d' : '#b78161'} roughness={0.92} /></mesh>
        <mesh position-y={0.22} rotation-x={-Math.PI / 2}><circleGeometry args={[0.118, 18]} /><meshStandardMaterial color="#3e3426" /></mesh>
        {[0, 1, 2, 3, 4].map(leaf => <mesh key={leaf} position={[Math.cos(leaf * 1.25) * 0.06, 0.27 + leaf * 0.025, Math.sin(leaf * 1.25) * 0.06]} rotation={[0.4, leaf * 1.25, 0.5]} scale={[0.07, 0.012, 0.13]}><sphereGeometry args={[1, 9, 6]} /><meshStandardMaterial color={leaf % 2 ? '#526b34' : '#708946'} roughness={0.8} /></mesh>)}
      </group>)}
    </group>)}
  </group>
}

export function RoundFireLounge(props: GardenVisualProps) {
  const bowl = useMemo(() => new LatheGeometry([
    new Vector2(0.24, 0.12), new Vector2(0.42, 0.16), new Vector2(0.72, 0.4),
    new Vector2(0.75, 0.48), new Vector2(0.7, 0.48), new Vector2(0.38, 0.22), new Vector2(0.24, 0.18),
  ], 48), [])
  useEffect(() => () => bowl.dispose(), [bowl])
  return <group>
    <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={4} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <TexturedMaterial asset="river-pebbles" color={props.selected ? '#bedb84' : '#dedbd0'} transparent opacity={props.ghost ? 0.35 : 1} roughness={1} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
      <ringGeometry args={[2.9, 3, 64]} /><meshStandardMaterial color="#626760" roughness={0.9} />
    </mesh>
    <mesh geometry={bowl} castShadow={!props.ghost} receiveShadow>
      <meshStandardMaterial color={props.selected ? '#bedb84' : '#292d2b'} metalness={0.65} roughness={0.65} side={DoubleSide} transparent={props.ghost} opacity={props.ghost ? 0.35 : 1} />
    </mesh>
    {[-1, 0, 1].map(i => <group key={i} rotation-y={i * Math.PI / 2}>
      <GardenBox size={[2.05, 0.26, 0.75]} at={[0, 0.28, -2.12]} color="#292d2b" {...props} />
      <GardenBox size={[1.9, 0.16, 0.65]} at={[0, 0.49, -2.1]} color="#c9beaa" {...props} />
      <GardenBox size={[2.05, 0.39, 0.1]} at={[0, 0.7, -2.47]} color="#292d2b" {...props} />
      <GardenBox size={[1.9, 0.28, 0.12]} at={[0, 0.69, -2.38]} color="#c9beaa" {...props} />
    </group>)}
  </group>
}

export function OrnamentalGrass({ height, width, selected, ghost }: GardenVisualProps & { height: number; width: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    for (let leaf = 0; leaf < 32; leaf++) {
      const angle = leaf * 2.39996, reach = width * (0.3 + (leaf % 5) * 0.045)
      const h = height * (0.64 + (leaf % 7) * 0.055)
      const point = (t: number, side: number) => {
        const spread = reach * t * t, half = 0.018 * Math.sin(Math.PI * t)
        return [Math.cos(angle) * spread - Math.sin(angle) * half * side, h * Math.sin(t * 1.8), Math.sin(angle) * spread + Math.cos(angle) * half * side]
      }
      for (let step = 0; step < 7; step++) {
        const a = point(step / 7, -1), b = point(step / 7, 1), c = point((step + 1) / 7, -1), d = point((step + 1) / 7, 1)
        positions.push(...a, ...b, ...c, ...b, ...d, ...c)
      }
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3)); result.computeVertexNormals()
    return result
  }, [height, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow={!ghost} receiveShadow>
    <meshStandardMaterial color={selected ? '#bedb84' : '#7d874d'} side={DoubleSide} roughness={0.9} transparent={ghost} opacity={ghost ? 0.35 : 1} depthWrite={!ghost} />
  </mesh>
}

