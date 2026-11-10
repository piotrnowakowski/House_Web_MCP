import type { Polygon2, StairModel, Vec2 } from './types'
import type { StairSurface } from './stairs'

export interface WinderSurface extends StairSurface {
  polygon: Polygon2
  step: number
  kind: 'lower' | 'turn' | 'upper'
}

/** Four balanced winders; dimensions use the same inner slot and walking line as the approved study. */
export function winderLayout(stairs: StairModel, rise: number) {
  const turn = stairs.uTurn
  if (!turn?.winders) return null
  const lowerTreads = (turn.lowerSteps ?? 0) - 1
  const upperTreads = stairs.steps - 1 - lowerTreads - 4
  if (lowerTreads < 1 || upperTreads < 1) return null
  const tread = stairs.runM / lowerTreads, riser = rise / stairs.steps
  const landing = turn.landingDepthM, radius = turn.gapM / 2
  const centreX = landing - turn.winders.innerExtensionM
  const walkRadius = (4 * turn.winders.walkingGoingM - 2 * turn.winders.innerExtensionM) / Math.PI
  if (radius <= 0 || centreX <= radius || walkRadius <= radius || walkRadius >= radius + stairs.widthM) return null
  return { lowerTreads, upperTreads, lowerSteps: lowerTreads + 1, upperSteps: upperTreads + 1,
    tread, riser, landingHeight: (lowerTreads + 4) * riser,
    lowerLength: landing + stairs.runM, upperLength: landing + upperTreads * tread,
    centreX, radius, walkRadius }
}

export function winderSurfaces(stairs: StairModel, rise: number): WinderSurface[] {
  const l = winderLayout(stairs, rise), turn = stairs.uTurn
  if (!l || !turn?.winders) return []
  const { lowerTreads: nl, upperTreads: nu, tread: g, riser: h, centreX: c, radius: r, walkRadius: R } = l
  const D = turn.landingDepthM, W = stairs.widthM * 2 + turn.gapM, middle = W / 2
  const quarter = (2 * turn.winders.innerExtensionM + Math.PI * r) / 4
  const phi = (turn.winders.walkingGoingM - turn.winders.innerExtensionM) / R
  const inner: Polygon2 = [{ x: D, z: middle+r }, { x: D-quarter, z: middle+r }, { x: c-r, z: middle }, { x: D-quarter, z: middle-r }, { x: D, z: middle-r }]
  const walk = { x: c-R*Math.sin(phi), z: middle+R*Math.cos(phi) }
  const ox = inner[1].x + (W-inner[1].z) / (walk.z-inner[1].z) * (walk.x-inner[1].x)
  if (!(ox > 0 && ox < D)) return []
  const outer: Polygon2 = [{ x:D,z:W },{ x:ox,z:W },{ x:0,z:middle },{ x:ox,z:0 },{ x:D,z:0 }]
  const arc = (start: number) => Array.from({length:91},(_,i)=>({x:c+r*Math.cos(start-i*Math.PI/180),z:middle+r*Math.sin(start-i*Math.PI/180)}))
  const turns = [
    [inner[0],outer[0],outer[1],inner[1]],
    [inner[1],outer[1],{x:0,z:W},outer[2],inner[2],...arc(Math.PI).slice(1)],
    [inner[2],outer[2],{x:0,z:0},outer[3],inner[3],...arc(1.5*Math.PI)],
    [inner[3],outer[3],outer[4],inner[4]],
  ]
  const result: WinderSurface[] = []
  const add = (step:number,kind:WinderSurface['kind'],points:Polygon2) => {
    const polygon = points.map(p=>({x:p.x,z:turn.entrySide==='max-z'?p.z:W-p.z}))
    const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z),left=Math.min(...xs),right=Math.max(...xs),near=Math.min(...zs),far=Math.max(...zs)
    result.push({step,kind,polygon,top:step*h,x:(left+right)/2,z:(near+far)/2,width:right-left,depth:far-near})
  }
  const rect=(x:number,z:number,w:number,d:number):Polygon2=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}]
  for(let i=0;i<nl;i++)add(i+1,'lower',rect(D+(nl-i-1)*g,W-stairs.widthM,g,stairs.widthM))
  turns.forEach((poly,i)=>add(nl+i+1,'turn',poly))
  for(let i=0;i<nu;i++)add(nl+5+i,'upper',rect(D+i*g,0,g,stairs.widthM))
  return result
}

/** Boundary edges only: no guard across shared nosings, the entrance or the upper exit. */
export function winderGuardEdges(stairs:StairModel,rise:number) {
  const l=winderLayout(stairs,rise)
  if(!l)return []
  const edges=new Map<string,{a:Vec2;b:Vec2;top:number;count:number}>()
  const key=(p:Vec2)=>`${p.x.toFixed(6)},${p.z.toFixed(6)}`
  for(const s of winderSurfaces(stairs,rise))for(let i=0;i<s.polygon.length;i++){
    const a=s.polygon[i],b=s.polygon[(i+1)%s.polygon.length]
    if(Math.hypot(a.x-b.x,a.z-b.z)<1e-8)continue
    const k=[key(a),key(b)].sort().join('|'),old=edges.get(k)
    edges.set(k,{a,b,top:s.top,count:(old?.count??0)+1})
  }
  return [...edges.values()].filter(e=>e.count===1 && ![l.lowerLength,l.upperLength].some(x=>Math.abs(e.a.x-x)<1e-8&&Math.abs(e.b.x-x)<1e-8))
}
