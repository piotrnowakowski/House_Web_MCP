import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three'
import { Line } from '@react-three/drei'
import type { Polygon2, StairModel } from '../domain/types'
import { winderGuardEdges, winderLayout, winderSurfaces, type WinderSurface } from '../domain/winderStairs'
import { uStairExitGuards } from '../domain/stairs'

function Step({ surface:s, stairs, rise, plan, upperPlan }: {surface:WinderSurface;stairs:StairModel;rise:number;plan:boolean;upperPlan:boolean}) {
  const geometry=useMemo(()=>{
    const l=winderLayout(stairs,rise)!,poly=s.polygon
    const top=plan&&!upperPlan ? .035 : s.top
    const waist=.2/Math.cos(Math.atan(l.riser/l.tread))
    const bottom=(x:number)=>plan?top-.025:Math.max(0,s.kind==='upper'?l.landingHeight+(x-stairs.uTurn!.landingDepthM)*l.riser/l.tread-waist:s.kind==='lower'?(l.lowerLength-x)*l.riser/l.tread-waist:s.top-l.riser-waist)
    const positions=poly.flatMap(p=>[p.x,top,p.z]).concat(poly.flatMap(p=>[p.x,bottom(p.x),p.z]))
    const n=poly.length,indices=ShapeUtils.triangulateShape(poly.map(p=>new Vector2(p.x,p.z)),[]).flatMap(([a,b,c])=>[a,b,c,c+n,b+n,a+n])
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,i+n,j,j+n,i+n)}
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g
  },[s,stairs,rise,plan,upperPlan])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh name={`winder-step-${s.step}`} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={stairs.finish?.treadColor??'#F0EEE9'} roughness={.8} side={DoubleSide}/></mesh>
}

export function WinderStaircase({stairs,rise,base,plan,opening,upperPlan=false}:{stairs:StairModel;rise:number;base:number;plan:boolean;opening?:Polygon2;upperPlan?:boolean}){
  const l=winderLayout(stairs,rise)
  if(!l)return null
  const surfaces=winderSurfaces(stairs,rise),width=stairs.widthM,depth=2*width+stairs.uTurn!.gapM
  const flip=(z:number)=>stairs.uTurn!.entrySide==='max-z'?z:depth-z
  const y=plan&&upperPlan?rise+.16:.16
  const guards=winderGuardEdges(stairs,rise)
  return <group name='balanced-four-winder-staircase' position={[stairs.start.x,plan&&!upperPlan ? .03:base,stairs.start.z]}>
    {surfaces.map(s=><Step key={s.step} surface={s} stairs={stairs} rise={rise} plan={plan} upperPlan={upperPlan}/>)}
    {plan&&surfaces.map(s=><Line key={`outline-${s.step}`} points={[...s.polygon,s.polygon[0]].map(p=>[p.x,upperPlan?s.top+.005:.04,p.z])} color='#63716d' lineWidth={.7}/>)}
    {plan&&<Line points={[[l.lowerLength,y,flip(depth-width/2)],[.45,y,flip(depth-width/2)],[.45,y,flip(width/2)],[l.upperLength,y,flip(width/2)],[l.upperLength-.2,y,flip(width/2-.14)],[l.upperLength,y,flip(width/2)],[l.upperLength-.2,y,flip(width/2+.14)]]} color='#675d4b' lineWidth={1.5}/>}
    {!plan&&<group name='winder-glass-guards'>
      {guards.map(({a,b,top},i)=><mesh key={i} position={[(a.x+b.x)/2,top+.5,(a.z+b.z)/2]} rotation-y={-Math.atan2(b.z-a.z,b.x-a.x)}><boxGeometry args={[Math.hypot(b.x-a.x,b.z-a.z),1,.012]}/><meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} depthWrite={false}/></mesh>)}
      {uStairExitGuards(stairs,opening).map(({start:a,end:b},i)=><mesh key={`exit-${i}`} position={[(a.x+b.x)/2,rise+.5,(a.z+b.z)/2]} rotation-y={-Math.atan2(b.z-a.z,b.x-a.x)}><boxGeometry args={[Math.hypot(b.x-a.x,b.z-a.z),1,.012]}/><meshPhysicalMaterial color='#D2E1DF' transparent opacity={.2} roughness={.08} depthWrite={false}/></mesh>)}
    </group>}
  </group>
}
