/** Apply the corrected drawing to the preserved r5; dimensions are metres in the PDF's current orientation. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { pointOnSegment, splitPolygonEdges, polygonBounds, spaceFootprint } from '../src/domain/geometry'
import { interiorsOverlap, landUseAreas } from '../src/domain/zoning'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import { mergeProjects } from '../src/domain/projectMerge'
import type { InteriorCatalogId, Polygon2, Vec2, WallModel } from '../src/domain/types'

const dir = 'project-data/architekt'
const source = parseProject(JSON.parse(readFileSync(`${dir}/before-correction-r5.json`, 'utf8')))
assert.equal(source.revision, 5)
assert.ok(JSON.parse(readFileSync(`${dir}/project.json`, 'utf8')).revision <= 6, 'Refuse to overwrite a later design')
const project = structuredClone(source), house = project.buildings.find(b => b.ref === 'house/main')!
const original = structuredClone(house)
const pt = (a: number, b: number): Vec2 => ({ x: +(a - 5.065).toFixed(6), z: +(b - 6.605).toFixed(6) })
const poly = (points: number[][]): Polygon2 => points.map(([a,b]) => pt(a,b))
const rect = (a:number,b:number,c:number,d:number) => poly([[a,b],[c,b],[c,d],[a,d]])
const same = (a:Vec2,b:Vec2) => Math.hypot(a.x-b.x,a.z-b.z)<1e-6
const outerEdges = poly([[.225,.225],[9.905,.225],[9.905,7.415],[7.525,7.415],[7.525,12.985],[.225,12.985]])
type Room = {ref:string;name:string;usage:string;points:Polygon2}
const room = (suffix:string,name:string,usage:string,points:Polygon2):Room => ({ref:`space/reference-${suffix}`,name,usage,points})
// Match unchanged walls by endpoints, and moved partitions by their adjacent room refs.
// This keeps entity identity without borrowing a deleted wall's array index.
function floor(level:number, rooms:Room[]) {
  const storey=house.storeys.find(s=>s.level===level)!, oldStorey=original.storeys.find(s=>s.level===level)!
  const oldWalls=original.walls.filter(w=>oldStorey.wallRefs.includes(w.ref))
  const oldRooms=original.spaces.filter(s=>oldStorey.spaceRefs.includes(s.ref))
  const oldNeighbors=(w:WallModel)=>oldRooms.filter(s=>s.boundary.some(e=>e.wallRef===w.ref)).map(s=>s.ref).sort().join('|')
  const used=new Set<string>(), walls:WallModel[]=[]
  house.walls=house.walls.filter(w=>!oldStorey.wallRefs.includes(w.ref))
  house.spaces=house.spaces.filter(s=>!oldStorey.spaceRefs.includes(s.ref))
  for(const r of rooms) {
    const points=rooms.reduce((p,other)=>splitPolygonEdges(p,other.points),r.points)
    const boundary=points.map((start,i)=>{
      const end=points[(i+1)%points.length]
      let wall=walls.find(w=>(same(w.start,start)&&same(w.end,end))||(same(w.end,start)&&same(w.start,end)))
      if(!wall){
        const external=outerEdges.some((p,j)=>pointOnSegment(start,p,outerEdges[(j+1)%outerEdges.length])&&pointOnSegment(end,p,outerEdges[(j+1)%outerEdges.length]))
        const neighbors=rooms.filter(o=>o.points.some((p,j)=>pointOnSegment(start,p,o.points[(j+1)%o.points.length])&&pointOnSegment(end,p,o.points[(j+1)%o.points.length]))).map(o=>o.ref).sort().join('|')
        const exact=oldWalls.find(w=>!used.has(w.ref)&&((same(w.start,start)&&same(w.end,end))||(same(w.end,start)&&same(w.start,end))))
        const horizontal=Math.abs(start.z-end.z)<1e-6
        const matching=oldWalls.filter(w=>!used.has(w.ref)&&oldNeighbors(w)===neighbors&&(Math.abs(w.start.z-w.end.z)<1e-6)===horizontal)
          .sort((a,b)=>Math.hypot(a.start.x+a.end.x-start.x-end.x,a.start.z+a.end.z-start.z-end.z)-Math.hypot(b.start.x+b.end.x-start.x-end.x,b.start.z+b.end.z-start.z-end.z))[0]
        const old=exact??matching
        const ref=old?.ref??`wall/architekt/correction/${level}/${r.ref.replace('space/reference-','')}/${i+1}`
        used.add(ref)
        wall={...(old??{ref,baseElevationM:storey.elevationM,heightM:storey.clearHeightM,locked:false}),start,end,thicknessM:external?.45:.12,openings:[],finish:structuredClone(old?.finish??{material:'light-render',colorHex:'#E9E5DC',textureId:'none'})}
        // Preserve stair enclosure thickness and its open lower-flight threshold.
        const stair=old?.ref.match(/ground\/(11|12|13|14|15)$/)
        if(stair) { wall.thicknessM=old!.thicknessM; wall.heightM=old!.heightM }
        walls.push(wall)
      }
      return {wallRef:wall.ref,direction:(same(wall.start,start)?1:-1) as 1|-1}
    })
    const previous=oldRooms.find(s=>s.ref===r.ref)??oldRooms[0]
    house.spaces.push({...structuredClone(previous),ref:r.ref,name:r.name,usage:r.usage,boundary})
  }
  storey.wallRefs=walls.map(w=>w.ref);storey.spaceRefs=rooms.map(r=>r.ref);house.walls.push(...walls)
}
floor(0,[
  room('pantry','Kotłownia','utility',rect(.225,11,4.84,12.985)),
  room('wc','Łazienka','bathroom',rect(2.51,8.33,4.84,11)),
  room('office','Gabinet','office',rect(4.84,8.33,7.525,12.985)),
  room('utility-access','Pomieszczenie przy kotłowni','storage',rect(.225,8.33,2.51,11)),
  room('kitchen-pantry','Kuchnia · część przy schodach','kitchen',poly([[.225,.225],[2.11,.225],[2.11,2.89],[2.11,3.69],[2.11,4.395],[.225,4.395]])),
  room('understairs','Schowek pod schodami','storage',poly([[.225,4.395],[3.6,4.395],[3.6,5.52],[3.6,6.645],[.225,6.645]])),
  room('living','Salon · jadalnia · kuchnia · hol','living',poly([[2.11,.225],[9.905,.225],[9.905,7.415],[7.525,7.415],[7.525,8.33],[.225,8.33],[.225,6.645],[3.6,6.645],[3.6,4.395],[2.11,4.395]])),
])
const oldUpper=(suffix:string)=>spaceFootprint(original,original.spaces.find(s=>s.ref===`space/reference-${suffix}`)!)
floor(1,[
  room('child-one','Pokój 1','bedroom',oldUpper('child-one')),
  room('bathroom','Łazienka piętro','bathroom',oldUpper('bathroom')),
  room('parents','Sypialnia','bedroom',oldUpper('parents')),
  room('child-two','Pokój 2','bedroom',poly([[4.13,9.25],[5.61,9.25],[5.61,7.415],[7.525,7.415],[7.525,12.985],[4.13,12.985]])),
  room('landing','Komunikacja','hall',poly([[.225,4.46],[5.61,4.46],[5.61,7.415],[5.61,9.25],[2.81,9.25],[2.81,6.58],[.225,6.58]])),
  room('living-void','Pustka nad salonem','void',rect(5.61,.225,9.905,7.415)),
])
const upper=house.storeys.find(s=>s.level===1)!
const voidRoom=house.spaces.find(s=>s.usage==='void')!
for(const edge of voidRoom.boundary){const w=house.walls.find(w=>w.ref===edge.wallRef)!;if(Math.abs(w.start.x-pt(5.61,0).x)<1e-6&&Math.abs(w.end.x-w.start.x)<1e-6&&Math.min(w.start.z,w.end.z)>=pt(0,4.46).z-1e-6)w.heightM=1.05}
house.spaces=house.spaces.filter(s=>s.usage!=='void');upper.spaceRefs=upper.spaceRefs.filter(r=>r!==voidRoom.ref)
house.slabs.find(s=>s.ref==='slab/reference-upper')!.holes![1]=rect(5.67,.45,9.68,7.19)

function opening(level:number,ref:string,a:number,b:number,width:number,height=2.1,sill=0,glazed=false){
  const p=pt(a,b),storey=house.storeys.find(s=>s.level===level)!
  const wall=house.walls.find(w=>storey.wallRefs.includes(w.ref)&&pointOnSegment(p,w.start,w.end)&&Math.hypot(p.x-w.start.x,p.z-w.start.z)>=width/2-.0001&&Math.hypot(p.x-w.end.x,p.z-w.end.z)>=width/2-.0001)
  assert.ok(wall,`Missing opening host: ${ref}`)
  const old=original.walls.flatMap(w=>w.openings).find(o=>o.ref===ref)
  wall.openings.push({...old,ref,kind:glazed||!old?'door':old.kind,wallRef:wall.ref,offsetM:Math.hypot(p.x-wall.start.x,p.z-wall.start.z),widthM:width,heightM:height,sillM:sill,...(glazed?{glazed:true}:{}),hinge:'left',swing:'in'})
}
opening(0,'opening/reference-entrance',.225,7.52,1)
opening(0,'opening/reference-wc',3.77,8.33,.85)
opening(0,'opening/reference-office',6.62,8.33,.85)
opening(0,'opening/architekt/utility-access',1.58,8.33,.85)
opening(0,'opening/architekt/utility-internal',1.58,11,.85)
// The drawing has an open passage here, with no door leaf.
const kitchenPassage=house.walls.find(w=>same(w.start,pt(2.11,2.89))&&same(w.end,pt(2.11,3.69)))!
kitchenPassage.heightM=.01
opening(0,'opening/architekt/storage',3.6,6.01,.85)
opening(0,'opening/reference-office-window',7.525,10.01,1.5,1.5,.8)
opening(0,'opening/reference-kitchen',3.77,.225,2,1.45,.9)
opening(0,'opening/architekt/living-right',9.905,2.20,2.5,2.35,0,true)
opening(0,'opening/architekt/living-left',9.905,5.44,2.5,2.35,0,true)
opening(0,'opening/architekt/terrace-side',8.415,7.415,1.78,2.35,0,true)
opening(1,'opening/reference-child-one',3.56,9.25,.85)
opening(1,'opening/reference-child-two',5.61,8.55,.85)
opening(1,'opening/reference-bathroom',2.81,8.13,.85)
opening(1,'opening/reference-parents',4.23,4.46,.85)
opening(1,'opening/reference-children-west-window',2.26,12.985,2,1.8,.3)
opening(1,'opening/reference-children-east-window',5.49,12.985,2,1.8,.3)
opening(1,'opening/architekt/bath-window',.225,8.13,1,.6,.7)
opening(1,'opening/architekt/parents-window',3.88,.225,2.16,1.3199999999999998,.08)
opening(1,'opening/architekt/void-right',9.905,2.20,2.5,1.3199999999999998,.08)
opening(1,'opening/architekt/void-left',9.905,5.44,2.5,1.3199999999999998,.08)
house.walls.flatMap(w=>w.openings).find(o=>o.ref==='opening/reference-office-window')!.kind='window'

const oldFurniture=new Map(original.furniture!.map(i=>[i.ref,i]))
house.furniture=[]
function item(ref:string,catalogId:InteriorCatalogId,name:string,a:number,b:number,w:number,d:number,h:number,angle=0,level=0){
  const old=oldFurniture.get(ref)
  house.furniture!.push({...old,ref,catalogId,name,storeyRef:house.storeys.find(s=>s.level===level)!.ref,position:pt(a,b),widthM:w,depthM:d,heightM:h,rotationDegrees:angle,color:old?.color??'#B99A72'})
}
item('interior/reference-cabinet-one','kitchen-counter','Zabudowa kuchenna',2.47,2.36,.6,1.98,.9)
item('interior/reference-sink','sink','Zlew',2.47,.95,.6,.8,.92)
item('interior/reference-counter','kitchen-counter','Blat kuchenny',3.15,.77,.76,.6,.9)
item('interior/architekt/fridge','fridge','Lodówka',1.72,3.95,.6,.6,1.9)
item('interior/reference-island','kitchen-island','Wyspa 0,90 × 2,00',4.32,2.17,.9,2,.92)
item('interior/architekt/cooker','cooker','Płyta na wyspie',4.32,2.17,.58,.6,.04,0)
house.furniture!.at(-1)!.elevationM=.92
item('interior/reference-stool-one','bar-stool','Hoker 1',5.08,1.83,.42,.42,.75)
item('interior/reference-stool-two','bar-stool','Hoker 2',5.08,2.42,.42,.42,.75)
item('interior/reference-sofa','corner-sofa','Narożnik',7.14,2.9,2.5,1.8,.86,90)
item('interior/reference-coffee','coffee-table','Stolik kawowy',8.55,2.85,.75,.75,.4)
item('interior/architekt/lounge-chair','armchair','Fotel',9.05,1.89,.8,.8,.85)
item('interior/reference-dining','dining-table','Stół i krzesła',7.45,5.65,2.4,1.7,.85)
item('interior/architekt/vestibule-storage','wardrobe','Szafa przy kotłowni',.78,9.71,.6,2.45,2.5)
item('interior/carport-study/shower','shower','Prysznic',3.68,10.5,2.08,.75,2.1)
item('interior/carport-study/wc','toilet','WC',3.09,9.02,.45,.7,.8)
item('interior/carport-study/vanity','vanity','Umywalka',4.45,9.02,.6,.45,.85,90)
item('interior/architekt/utility-washer','washer','Pralka',4.45,12.4,.6,.6,.85)
item('interior/architekt/boiler','thermal-buffer','Bufor kotłowni',4.42,11.48,.6,.6,1.2)
item('interior/office-c5/desk','desk','Biurko gabinetu',6.1,12.39,2.25,.65,.75)
item('interior/office-c5/chair','armchair','Krzesło gabinetu',6.1,11.55,.5,.5,.95)
item('interior/reference-parents-bed','bed','Łóżko sypialni',1.57,2.48,1.8,2.1,1,90,1)
item('interior/architekt/parents-nightstand-1','coffee-table','Szafka nocna',.76,1.26,.45,.5,.48,0,1)
item('interior/architekt/parents-nightstand-2','coffee-table','Szafka nocna',.76,3.73,.45,.5,.48,0,1)
item('interior/architekt/parents-chair','armchair','Fotel sypialni',4.47,1.01,.75,.75,.85,0,1)
item('interior/reference-child-one-bed','bed','Łóżko · pokój 1',1.52,9.95,1,2.05,.85,90,1)
item('interior/architekt/child-one-desk','desk','Biurko · pokój 1',.78,11.75,1.2,.6,.75,90,1)
item('interior/architekt/child-one-chair','armchair','Krzesło · pokój 1',1.5,11.75,.45,.45,.85,0,1)
item('interior/architekt/child-one-storage','wardrobe','Szafa · pokój 1',3.74,11.7,1.9,.6,1.3,90,1)
item('interior/reference-child-two-bed','bed','Łóżko · pokój 2',4.82,10.51,1,2.05,.85,0,1)
item('interior/architekt/child-two-storage','wardrobe','Szafa · pokój 2',6.96,11.25,2.5,.6,1.3,90,1)
item('interior/reference-bathtub','bathtub','Wanna',.88,8.345,.75,1.65,.6,0,1)
item('interior/architekt/upper-shower','shower','Prysznic piętro',.91,7.065,.85,.85,1.55,0,1)
item('interior/reference-upper-toilet','toilet','WC piętro',2.06,8.82,.45,.7,.8,0,1)
item('interior/reference-upper-vanity','vanity','Umywalka piętro',2.07,6.93,.6,.45,.85,0,1)

// The new outline replaces the projecting terrace canopy; the enclosed footprint stays unchanged.
const roofBase=parseProject(JSON.parse(readFileSync(`${dir}/before-glowny-exterior-r4.json`,'utf8'))).buildings[0].roof
house.roof.footprint=structuredClone(roofBase.footprint)
house.roof.segments=house.roof.segments.filter(s=>s.type==='gable')
house.slabs=house.slabs.filter(s=>s.ref!=='slab/recessed-terrace')
house.roof.overhangM=.825 // Wall axes are 0.225 m inside the exterior face: 0.825 gives a 0.60 m projection.
for(const segment of house.roof.segments){segment.footprint=structuredClone(roofBase.segments.find(s=>s.ref===segment.ref)!.footprint);segment.overhangM=.825;delete segment.gableRecess}
// Full-height timber frames at the six drawn support positions; section sizes are visual assumptions.
const frames=[[-.6,-.6,0,.6],[7.15,-.6,7.75,0],[9.53,-.6,10.73,0],[9.53,7.64,10.73,8.24],[-.6,12.61,0,13.81],[7.75,12.61,8.35,13.81]]
for(const [i,[a,b,c,d]] of frames.entries())for(const [j,q] of [rect(a+.06,b+.06,c-.06,d-.06)[0],rect(a+.06,b+.06,c-.06,d-.06)[1],rect(a+.06,b+.06,c-.06,d-.06)[2],rect(a+.06,b+.06,c-.06,d-.06)[3]].entries()){
  const wings=roofWings(house).filter(w=>{const bb=polygonBounds(w.footprint);return q.x>=bb.minX-w.overhangM-.01&&q.x<=bb.maxX+w.overhangM+.01&&q.z>=bb.minZ-w.overhangM-.01&&q.z<=bb.maxZ+w.overhangM+.01})
  const top=Math.max(...wings.map(w=>{const bb=polygonBounds(w.footprint),across=w.ridgeAxis==='z'?'x':'z',mid=across==='x'?(bb.minX+bb.maxX)/2:(bb.minZ+bb.maxZ)/2;const pitch=house.roof.segments.find(s=>s.ref===w.ref)!.pitchDegrees;return w.ridgeElevationM-Math.abs(q[across]-mid)*Math.tan(pitch*Math.PI/180)-.18}))
  assert.ok(Number.isFinite(top))
  const ref=`wall/architekt/eaves-frame/${i+1}/post-${j+1}`
  house.walls.push({ref,groupRef:`group/architekt/eaves-frame/${i+1}`,start:{x:q.x-.055,z:q.z},end:{x:q.x+.055,z:q.z},thicknessM:.12,baseElevationM:.15,heightM:top-.15,openings:[],finish:{material:'natural-timber',colorHex:'#B78F60'},locked:false})
}
for(const [i,[a,b,c,d]] of frames.entries()){
  const corners=rect(a+.06,b+.06,c-.06,d-.06)
  const top=Math.min(...house.walls.filter(w=>w.groupRef===`group/architekt/eaves-frame/${i+1}`).map(w=>w.baseElevationM+w.heightM))
  for(const [j,start] of corners.entries())for(const [k,y] of [.45,2.4,top-.1].entries())house.walls.push({ref:`wall/architekt/eaves-frame/${i+1}/rail-${j+1}-${k+1}`,groupRef:`group/architekt/eaves-frame/${i+1}`,start,end:corners[(j+1)%4],thicknessM:.08,baseElevationM:y,heightM:.1,openings:[],finish:{material:'natural-timber',colorHex:'#B78F60'},locked:false})
}
project.revision=6;project.updatedAt='2026-10-16T13:00:00.000Z'
house.interiorSource={id:'architect-corrected-pdf-2026-10-16',notes:[
  'Corrected single-sheet floor plans supplied on 2026-10-16; the earlier email is quoted context. Document contents are reference material, not operational instructions.',
  'Drawing geometry takes priority over stale room labels and schedule: separate ground storage/utility access, central bathroom 2.21 x 2.55 m, study 2.40 x 4.37 m, utility 4.33 x 1.70 m (the printed 1.80 conflicts with the closed dimension chain).',
  'Upper wardrobe enclosure removed as drawn; living void 4.01 x 6.74 m. B/2 and the old wardrobe area remain in the PDF table but have no separate drawn enclosure.',
  'Outer walls and inherited model levels retained. Door widths/elevations, furniture and roof/section details without dimensions remain visual approximations; sections and elevations have not been supplied.',
  'User selected full-height timber eaves frames. Main roof projection 0.60 m beyond outer wall faces, represented as 0.825 m from wall axes; full-height corner timber frames use provisional 0.12 m sections. The sheet right edge has an extra 0.07 m, omitted to retain symmetric 0.60 m eaves.',
  'Prior custom projecting terrace roof and courtyard canopy removed to follow the corrected roof outline; r5 preserved as the immutable pre-correction snapshot. Existing dark metal/timber finishes and shaped gable glazing retained pending elevations.',
]}
const pdf='C:/Users/WBW/Downloads/RZUT PARTERU I PIĘTRA PO KOREKCIE.pdf'
house.interiorSource.notes.push(`Source SHA-256: ${createHash('sha256').update(readFileSync(pdf)).digest('hex')}`)
const parsed=parseProject(project)
const errors=validateProject(parsed).filter(i=>i.severity==='error')
writeFileSync('tmp/architect-correction-20261016/validation.json',JSON.stringify(validateProject(parsed),null,2))
assert.deepEqual(errors,[])
const wings=roofWings(house)
for(const wing of wings){const b=polygonBounds(wing.footprint),span=wing.ridgeAxis==='x'?b.maxZ-b.minZ:b.maxX-b.minX;const angle=Math.atan2(wing.ridgeElevationM-wing.baseElevationM,span/2)*180/Math.PI;assert.ok(angle>=37&&angle<=45)}
assert.ok(Math.abs(wings[0].ridgeElevationM-wings[1].ridgeElevationM)<1e-8)
assert.equal(gableRoofJunction(house,wings[1])?.side,'min')
const a=house.rotationDegrees*Math.PI/180
const world=(p:Vec2)=>({x:house.position.x+p.x*Math.cos(a)+p.z*Math.sin(a),z:house.position.z-p.x*Math.sin(a)+p.z*Math.cos(a)})
for(const wing of wings){const b=polygonBounds(wing.footprint),d=wing.overhangM;const outline=[{x:b.minX-d,z:b.minZ-d},{x:b.maxX+d,z:b.minZ-d},{x:b.maxX+d,z:b.maxZ+d},{x:b.minX-d,z:b.maxZ+d}].map(world);assert.ok(!landUseAreas(parsed).some(z=>z.landRole==='agricultural'&&interiorsOverlap(outline,z.boundary)),`${wing.ref} eaves cross agricultural land`)}
for(const folder of ['iab-backup','chrome-backup'])for(const ws of JSON.parse(readFileSync(`tmp/architect-correction-20261016/${folder}/workspaces.json`,'utf8'))){
  const local=ws.entries.find(([k]:[string])=>k==='workspace/project/architekt')?.[1].project
  if(local)assert.deepEqual(mergeProjects(source,parseProject(local),parsed).conflicts,[],ws.origin)
}
writeFileSync(`${dir}/project.json`,JSON.stringify(parsed,null,2)+'\n')
console.log(JSON.stringify({revision:parsed.revision,rooms:house.spaces.length,walls:house.walls.length,roof:wings.map(w=>({ref:w.ref,ridge:w.ridgeElevationM})),warnings:validateProject(parsed).filter(i=>i.severity==='warning')},null,2))
