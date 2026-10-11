/** Reconstruct the architect's 2026-10-11 raster plans. Coordinates below are metres,
 * measured from the plan's top-left OUTER corner. See the source ledger in the README.
 * Re-run explicitly; never overwrite an existing publication baseline. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { pointOnSegment, splitPolygonEdges, wallLength, polygonBounds } from '../src/domain/geometry'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import type { BuildingModel, InteriorCatalogId, Polygon2, SpaceBoundaryUse, StoreyModel, Vec2 } from '../src/domain/types'

const dir = 'project-data/architekt'
mkdirSync(dir, { recursive: true })
const sourceFile = `${dir}/source-glowny-r79.json`
if (!existsSync(sourceFile)) writeFileSync(sourceFile, readFileSync('project-data/zielonki-rear-bath-room/project.json'))
const source = parseProject(JSON.parse(readFileSync(sourceFile, 'utf8')))
const project = structuredClone(source)
project.ref = 'project/architekt'; project.name = 'architekt'; project.revision = 4
project.updatedAt = '2026-10-11T20:15:00.000Z'
const house = project.buildings.find(b => b.ref === 'house/main')!
const oldHouse = structuredClone(house)
// This proper rotation preserves the existing GŁÓWNY site's orientation and the stair renderer's X run.
const pt = (u: number, v: number): Vec2 => ({ x: +(v - 5.065).toFixed(6), z: +(6.605 - u).toFixed(6) })
const poly = (pairs: number[][]): Polygon2 => pairs.map(([u, v]) => pt(u, v))
const rect = (u: number, v: number, right: number, bottom: number) => poly([[u,v],[right,v],[right,bottom],[u,bottom]])
const near = (a: Vec2, b: Vec2) => Math.hypot(a.x-b.x,a.z-b.z)<1e-5
const outer = poly([[0,0],[13.21,0],[13.21,10.13],[5.57,10.13],[5.57,7.75],[0,7.75]])
const center = poly([[.225,.225],[12.985,.225],[12.985,9.905],[5.795,9.905],[5.795,7.525],[.225,7.525]])
const g = 'storey/reference-ground', up = 'storey/reference-upper'
house.name = 'Dom · architekt'; house.designStatus = 'concept'
house.walls=[]; house.spaces=[]; house.furniture=[]; house.platforms=[]; house.ceilingFinishes=[]
house.storeys=[]
house.slabs = [
 { ref:'slab/reference-ground', footprint:outer, topElevationM:.45, thicknessM:.2, locked:false },
 { ref:'slab/reference-upper', footprint:structuredClone(outer), holes:[rect(6.69,.45,8.69,3.61),rect(6.02,7.42,12.76,9.68)], topElevationM:3.75, thicknessM:.5, edgeColorHex:'#2D3435', locked:false },
]
type Room = { ref:string; name:string; usage:string; points:Polygon2 }
const room = (id:string,name:string,usage:string,points:Polygon2):Room => ({ref:`space/reference-${id}`,name,usage,points})
const floorFinish = { presetId:'sand-tile', color:'#D4C6B1', rotationDegrees:0, tileM:.6 }
const floor = (id:'ground'|'upper', rooms:Room[]) => {
 const level=id==='ground'?0:1
 const storey:StoreyModel={ref:level?up:g,name:level?'Piętro':'Parter',level,elevationM:level?3.75:.45,clearHeightM:2.8,...(level?{kneeWallHeightM:1.4}:{}),baseSlabRef:`slab/reference-${id}`,topBoundaryRef:level?'roof/reference':'slab/reference-upper',wallRefs:[],spaceRefs:[],platformRefs:[],ceilingFinishRefs:[]}
 house.storeys.push(storey)
 for (const r of rooms) {
  const points=rooms.reduce((p,o)=>splitPolygonEdges(p,o.points),r.points)
  const boundary:SpaceBoundaryUse[]=points.map((start,i)=>{
   const end=points[(i+1)%points.length]
   const existing=house.walls.find(w=>storey.wallRefs.includes(w.ref)&&((near(start,w.start)&&near(end,w.end))||(near(end,w.start)&&near(start,w.end))))
   if(existing) return {wallRef:existing.ref,direction:near(start,existing.start)?1:-1}
   const external=center.some((p,j)=>pointOnSegment(start,p,center[(j+1)%center.length])&&pointOnSegment(end,p,center[(j+1)%center.length]))
   const constantU=Math.abs(start.z-end.z)<1e-6 ? 6.605-start.z : null
   const stairSide=!level&&constantU!==null&&[6.565,8.815].some(u=>Math.abs(u-constantU)<.001)&&Math.max(start.x,end.x)<=3.6-5.065+.001
   const guard=level&&Math.abs(start.x-(7.36-5.065))<.001&&Math.abs(end.x-start.x)<.001&&Math.min(start.z,end.z)>=6.605-8.75-.001
   const stairThreshold=!level&&Math.abs(start.x-(3.6-5.065))<.001&&Math.abs(end.x-start.x)<.001&&Math.max(start.z,end.z)<=6.605-7.69+.001
   const ref=`wall/architekt/${id}/${storey.wallRefs.length+1}`
   house.walls.push({ref,start,end,thicknessM:external?.45:stairSide?.25:.12,baseElevationM:storey.elevationM,heightM:stairThreshold?.01:guard?1.05:storey.clearHeightM,openings:[],locked:false,finish:{material:'light-render',colorHex:guard?'#353A3A':'#E9E5DC',textureId:'none'}})
   storey.wallRefs.push(ref); return {wallRef:ref,direction:1}
  })
  house.spaces.push({ref:r.ref,name:r.name,usage:r.usage,boundary,baseSlabRef:storey.baseSlabRef,topBoundaryRef:storey.topBoundaryRef,floorFinish:structuredClone(floorFinish),ceilingFinish:{presetId:'warm-white',color:'#F5F1E8',rotationDegrees:0,tileM:1},locked:false})
  storey.spaceRefs.push(r.ref)
 }
 return storey
}
const ground=floor('ground',[
 room('pantry','A/3 · Kotłownia','utility',rect(.225,.225,2.31,4.24)),
 room('wc','A/2 · Łazienka','bathroom',rect(2.31,.225,4.48,4.24)),
 room('office','A/4 · Gabinet','office',rect(.225,4.24,4.48,7.525)),
 room('understairs','A/8 · Schowek pod schodami','storage',poly([[6.565,.225],[8.815,.225],[8.815,3.6],[7.69,3.6],[6.565,3.6]])),
 room('living','Salon · jadalnia · kuchnia · hol','living',poly([[4.48,.225],[6.565,.225],[6.565,3.6],[8.815,3.6],[8.815,.225],[12.985,.225],[12.985,9.905],[5.795,9.905],[5.795,7.525],[4.48,7.525]])),
])
const upper=floor('upper',[
 room('child-one','B/4 · Pokój 1','bedroom',rect(.225,.225,3.96,4.13)),
 room('bathroom','B/3 · Łazienka','bathroom',rect(3.96,.225,6.63,2.81)),
 room('child-two','B/5 · Pokój 2','bedroom',rect(.225,4.13,5.31,7.525)),
 room('parents','B/1 · Sypialnia','bedroom',rect(8.75,.225,12.985,5.61)),
 room('wardrobe','B/2 · Garderoba','wardrobe',rect(8.75,5.61,12.985,7.36)),
 room('landing','B/6 · Komunikacja','hall',poly([[3.96,2.81],[6.63,2.81],[6.63,.225],[8.75,.225],[8.75,7.36],[5.795,7.36],[5.795,7.525],[5.31,7.525],[5.31,4.13],[3.96,4.13]])),
 room('living-void','Pustka nad salonem','void',rect(5.795,7.36,12.985,9.905)),
])
// Opening locations and widths scaled from the raster; elevations inherited/inferred, not architect dimensions.
function opening(storey:StoreyModel,ref:string,kind:'door'|'window',u:number,v:number,width:number,height=2.1,sill=0,glazed=false){
 const p=pt(u,v)
 const wall=house.walls.find(w=>storey.wallRefs.includes(w.ref)&&pointOnSegment(p,w.start,w.end)&&Math.hypot(p.x-w.start.x,p.z-w.start.z)>=width/2-.001&&Math.hypot(p.x-w.end.x,p.z-w.end.z)>=width/2-.001)
 if(!wall) throw new Error(`Missing wall for ${ref} at ${u},${v}`)
 const offsetM=+Math.hypot(p.x-wall.start.x,p.z-wall.start.z).toFixed(6)
 if(offsetM+width/2>wallLength(wall)+1e-6) throw new Error(`Opening overhang ${ref}`)
 wall.openings.push({ref,kind,wallRef:wall.ref,offsetM,widthM:width,heightM:height,sillM:sill,...(glazed?{glazed:true}:{}),...(kind==='door'?{hinge:'left' as const,swing:'in' as const}:{})})
}
opening(ground,'opening/architekt/utility-external','door',1.15,.225,.95)
opening(ground,'opening/architekt/bath-external','door',2.83,.225,.9)
opening(ground,'opening/reference-entrance','door',5.20,.225,1)
opening(ground,'opening/reference-wc','door',4.48,3.24,.85)
opening(ground,'opening/reference-office','door',4.48,6.75,.85)
opening(ground,'opening/architekt/storage','door',7.18,3.6,.85)
opening(ground,'opening/reference-office-window','window',3.20,7.525,1.5,1.5,.8)
opening(ground,'opening/reference-kitchen','window',12.985,2.78,2,1.5,.85)
opening(ground,'opening/architekt/living-left','door',7.77,9.905,2.5,2.35,0,true)
opening(ground,'opening/architekt/living-right','door',11.04,9.905,2.5,2.35,0,true)
opening(ground,'opening/architekt/terrace-side','door',5.795,8.57,1.8,2.35,0,true)
opening(upper,'opening/reference-child-one','door',3.96,3.56,.85)
opening(upper,'opening/reference-child-two','door',5.31,6.20,.85)
opening(upper,'opening/reference-bathroom','door',5.08,2.81,.85)
opening(upper,'opening/reference-parents','door',8.75,4.93,.85)
opening(upper,'opening/architekt/wardrobe','door',9.37,5.61,.85)
opening(upper,'opening/reference-children-west-window','window',.225,2.24,2,1.5,.7)
opening(upper,'opening/reference-children-east-window','window',.225,5.52,1.8,1.45,.8)
opening(upper,'opening/architekt/bath-window','window',5.02,.225,1,.6,.7)
opening(upper,'opening/architekt/parents-window','window',12.985,2.78,2,1.5,.8)
opening(upper,'opening/architekt/void-left','window',7.77,9.905,2.5,1.4,0)
opening(upper,'opening/architekt/void-right','window',11.04,9.905,2.5,1.4,0)
house.stairs=[{ref:'stairs/reference-main',fromStoreyRef:g,toStoreyRef:up,start:pt(8.69,.45),runM:2.2,widthM:.95,steps:18,uTurn:{landingDepthM:.95,gapM:.1}}]
// A void has enclosing facade/guard walls but is not a habitable room or floor area.
house.spaces=house.spaces.filter(s=>s.usage!=='void')
upper.spaceRefs=upper.spaceRefs.filter(ref=>ref!=='space/reference-living-void')
// User selected the retained attic roof. Preserve actual eaves AND shared ridge;
// solve compliant pitches for the changed wall-axis spans instead of raising the roof.
const ridge=Math.max(...roofWings(oldHouse).filter(w=>w.type==='gable').map(w=>w.ridgeElevationM))
const eaves=oldHouse.roof.baseElevationM
const finish=structuredClone(oldHouse.roof.finish)
const segment=(ref:string,points:Polygon2,axis:'x'|'z',adjacent:string)=>{
 const bounds=polygonBounds(points),span=axis==='x'?bounds.maxZ-bounds.minZ:bounds.maxX-bounds.minX
 return {ref,footprint:points,storeyRef:up,baseElevationM:eaves,type:'gable' as const,pitchDegrees:Math.atan((ridge-eaves)/(span/2))*180/Math.PI,overhangM:0,ridgeDirection:axis,finish:structuredClone(finish),adjacentSegmentRefs:[adjacent],gableWallFinishes:{min:{material:'light-render' as const,colorHex:'#E9E5DC'},max:{material:'light-render' as const,colorHex:'#E9E5DC'}}}
}
const front='roof/reference/front-barn',rear='roof/reference/rear-barn'
house.roof={ref:'roof/reference',type:'gable',baseElevationM:eaves,pitchDegrees:0,overhangM:0,footprint:center,finish,segments:[segment(front,rect(.225,.225,12.985,7.525),'z',rear),segment(rear,rect(5.795,3.875,12.985,9.905),'x',front)],junctions:[{ref:'roof/reference/barn-valley',type:'valley',segmentRefs:[front,rear]}]}
house.roof.pitchDegrees=house.roof.segments[0].pitchDegrees
// Retain familiar semantic refs where furnishings represent the same object. Positions follow the new plans.
function item(ref:string,catalogId:InteriorCatalogId,name:string,u:number,v:number,w:number,d:number,h:number,angle=0,storey=g,color='#B99A72'){
 house.furniture!.push({ref,catalogId,name,storeyRef:storey,position:pt(u,v),widthM:w,depthM:d,heightM:h,rotationDegrees:angle+90,color})
}
item('interior/reference-cabinet-one','kitchen-counter','Szafki kuchenne',9.56,.775,1.20,.65,.9)
item('interior/architekt/cooker','cooker','Płyta kuchenna',10.51,.775,.7,.65,.92)
item('interior/reference-counter','kitchen-counter','Blat kuchenny',11.16,.775,.60,.65,.9)
item('interior/reference-sink','sink','Zlew kuchenny',12.06,.775,1.14,.65,.9)
item('interior/reference-island','kitchen-island','Wyspa kuchenna',10.84,2.73,1.9,1.2,.92)
item('interior/reference-stool-one','bar-stool','Hoker 1',10.4,3.63,.42,.42,.75)
item('interior/reference-stool-two','bar-stool','Hoker 2',11.3,3.63,.42,.42,.75)
item('interior/reference-sofa','corner-sofa','Narożnik',10.45,6.40,2.5,1.8,.86,90,g,'#C8BCAE')
item('interior/reference-coffee','coffee-table','Stolik kawowy',11.86,6.86,.75,.75,.4)
item('interior/reference-dining','dining-table','Stół i krzesła',7.46,7.18,2.4,1.7,.85,90)
item('interior/architekt/lounge-chair','armchair','Fotel',11.65,8.66,.8,.8,.85,0,g,'#C8BCAE')
item('interior/architekt/vestibule-storage','wardrobe','Szafa wiatrołapu',6.12,2.05,.6,3.15,2.5)
item('interior/carport-study/shower','shower','Prysznic',3.84,1.03,1.1,1.1,2.1)
item('interior/carport-study/wc','toilet','WC',2.76,2.31,.45,.7,.8,90,g,'#F3F0E8')
item('interior/carport-study/vanity','vanity','Umywalka',4.12,2.30,.7,.5,.85,90)
item('interior/architekt/bath-cabinet','wardrobe','Szafka łazienkowa',3.38,3.96,2.0,.4,.9)
item('interior/architekt/utility-washer','washer','Pralka',1.89,2.33,.60,.60,.85,90,g,'#EEEDE8')
item('interior/architekt/utility-dryer','washer','Suszarka',1.89,2.98,.60,.60,.85,90,g,'#EEEDE8')
item('interior/carport-study/storage','wardrobe','Zabudowa kotłowni',1.92,3.73,.6,.8,2.1)
item('interior/architekt/boiler','thermal-buffer','Urządzenie techniczne · obrys z planu',.79,3.84,.6,.6,1.2)
item('interior/office-c5/wardrobe','wardrobe','Szafa gabinetu',1.71,4.62,2.5,.6,2.3)
item('interior/office-c5/desk','desk','Biurko gabinetu',1.37,6.94,1.75,.65,.75)
item('interior/office-c5/chair','armchair','Krzesło gabinetu',1.37,6.15,.5,.5,.95)
item('interior/1cad2482-e19c-4b56-8cdf-f8d07664ae95','sofa','Sofa gabinetu',3.94,5.25,1.8,.9,.82,90,g,'#B2A693')
item('interior/reference-parents-bed','bed','Łóżko sypialni',10.78,1.75,1.8,2.1,1,0,up)
item('interior/architekt/parents-nightstand-1','coffee-table','Szafka nocna',9.45,.77,.45,.5,.48,0,up)
item('interior/architekt/parents-nightstand-2','coffee-table','Szafka nocna',12.09,.77,.45,.5,.48,0,up)
item('interior/architekt/parents-chair','armchair','Fotel sypialni',12.1,4.68,.75,.75,.85,0,up)
item('interior/architekt/closet-south','wardrobe','Garderoba · zabudowa dolna',10.55,6.98,3.45,.6,1.35,0,up)
item('interior/architekt/closet-east','wardrobe','Garderoba · zabudowa prawa',12.42,6.08,.6,.72,1.35,0,up)
item('interior/reference-child-one-bed','bed','Łóżko · pokój 1',3.30,1.52,1,2.05,.85,0,up)
item('interior/architekt/child-one-desk','desk','Biurko · pokój 1',1.4,.78,1.2,.6,.75,0,up)
item('interior/architekt/child-one-chair','armchair','Krzesło · pokój 1',1.4,1.49,.45,.45,.85,0,up)
item('interior/architekt/child-one-storage','wardrobe','Szafa · pokój 1',1.45,3.73,1.9,.6,1.3,0,up)
item('interior/reference-child-two-bed','bed','Łóżko · pokój 2',4.02,4.78,1,2.05,.85,90,up)
item('interior/architekt/child-two-desk','desk','Biurko · pokój 2',1.57,4.55,1.7,.6,.75,0,up)
item('interior/architekt/child-two-chair','armchair','Krzesło · pokój 2',1.57,5.26,.45,.45,.85,0,up)
item('interior/architekt/child-two-storage','wardrobe','Szafa · pokój 2',1.75,6.97,2.5,.6,1.3,0,up)
item('interior/reference-bathtub','bathtub','Wanna',6.14,1.34,.75,1.7,.6,0,up,'#F3F0E8')
item('interior/reference-upper-toilet','toilet','WC piętro',4.41,.96,.45,.7,.8,90,up,'#F3F0E8')
item('interior/reference-upper-vanity','vanity','Umywalka piętro',4.30,2.06,.6,.45,.85,90,up)

// The site sheet shows uncovered parking, not the old roofed carport. The distant
// agricultural outbuilding is retained solely as pre-existing GŁÓWNY context.
project.buildings=project.buildings.filter(b=>b.ref!=='building/south-carport')
// Site diagram: front building line about 5.04 m from the road-side boundary,
// with an 8 m access/parking strip on the entrance side. Translation in plan axes.
const a=house.rotationDegrees*Math.PI/180,du=.66,dv=-.28
house.position={x:house.position.x+dv*Math.cos(a)-du*Math.sin(a),z:house.position.z-dv*Math.sin(a)-du*Math.cos(a)}
const world=(p:Vec2)=>{const a=house.rotationDegrees*Math.PI/180;return {x:house.position.x+p.x*Math.cos(a)+p.z*Math.sin(a),z:house.position.z-p.x*Math.sin(a)+p.z*Math.cos(a)}}
const zone=(ref:string,name:string,kind:'terrace'|'driveway'|'path',footprint:Polygon2)=>({ref,name,kind,footprint:footprint.map(world),locked:false,textureId:'concrete-tiles'})
// Reuse the current site's surveyed/cadastral alignment. Site placements are diagram-derived.
project.landscape.zones=project.landscape.zones.filter(z=>!['zone/terrace','zone/driveway','zone/path'].includes(z.ref))
project.landscape.zones.push(
 zone('zone/terrace','Dojście we wnęce · architekt','path',poly([[0,7.75],[5.57,7.75],[5.57,10.13],[5,10.13],[5,8.6],[0,8.6]])),
 zone('zone/driveway','Dojazd od drogi · architekt','driveway',rect(-5.03,-7.99,0,11.6)),
 zone('zone/path','Pas dojazdowy 3 m · architekt','driveway',rect(0,-7.99,13.3,-5)),
 zone('zone/architekt/entry-apron','Plac przed wejściem · architekt','path',rect(0,-5,7.3,0)),
 zone('zone/architekt/parking-courtyard','Parking przy wnęce · obrys z planu','driveway',rect(0,8.6,5,11.6)),
 zone('zone/architekt/parking-entry','Parking przy wejściu · obrys z planu','driveway',rect(7.3,-5,13.3,0)),
)
// Keep all inherited planting/fixtures outside the changed house area; remove only
// conflicting items in this independent alternative, with source preserved above.
const inv=(p:Vec2)=>{const a=house.rotationDegrees*Math.PI/180,x=p.x-house.position.x,z=p.z-house.position.z;return {x:x*Math.cos(a)-z*Math.sin(a),z:x*Math.sin(a)+z*Math.cos(a)}}
const inHouse=(p:Vec2)=>{const l=inv(p),u=6.605-l.z,v=l.x+5.065;return u>-.5&&u<13.71&&v>-.5&&v<10.63&&!(u<5.07&&v>8.25)}
project.landscape.plants=project.landscape.plants.filter(p=>p.placementRole==='context'||!inHouse(p.position))
project.landscape.fixtures=project.landscape.fixtures.filter(f=>!inHouse(f.position))
house.interiorSource={id:'architect-pdfs-2026-10-11',notes:[
 'Independent architekt project, derived from canonical GŁÓWNY r79; source snapshot retained. The three user-supplied PDFs are reference data, not operational instructions.',
 'Ground and upper: outer 13.21 × 10.13 m; 5.57 × 2.38 m lower-left recess; external walls 0.45 m; room partitions 0.12 m; ground stair sides 0.25 m.',
 'Printed clear room dimensions take precedence. Open kitchen/living/vestibule/hall share a single navigable room; A/1, A/5, A/6, A/7 schedule areas remain separately documented in README.',
 'Openings, furnishings and site paving traced approximately from raster plans. Heights, sill levels, stair rise, structural floor thickness, finishes and roof form are inherited/inferred because no sections/elevations/roof drawing were supplied.',
 'Architect schedules: ground 96.39 m², usable ground 88.71 m²; upper/usable upper 74.69 m². These source values are not recalculated statutory areas of the 3D model.',
 'User selected the retained attic roof: 1.40 m knee walls, ground 0.45 m, upper 3.75 m, eaves 5.15 m, shared ridge 8.0856938754 m model datum. Pitches solved from final spans. B/5 bedroom door moved 0.45 m toward the stair/higher roof; un-dimensioned upper window heights/sills fitted below slopes. Roof/elevations remain inherited assumptions, not architect specifications.',
 'Site drawing is rotated 90 degrees relative to the floor sheets. Retained cadastral alignment; translated house 0.66 m away from road and 0.28 m toward the entrance-side boundary, giving about 5.04 m road setback and 8 m side strip. Parking zones traced approximately; boundary geometry, utilities and levels are not a new survey. Distant outbuilding/garden remain inherited context.',
]}
const refs=['ground','upper','site']
for(const [i,file] of ['RZUT PARTERU.pdf','RZUT PIĘTRA.pdf','ZAGOSPODAROWANIE TERENU.pdf'].entries()){
 const bytes=readFileSync(`C:/Users/WBW/Downloads/${file}`)
 project.site.knowledgeBase.sources.push({ref:`source/architect-20261011-${refs[i]}`,title:file,date:'2026-10-11',kind:i===2?'working-measurement':'user-direction',authority:'professional',summary:`User-provided architect concept, one raster page. SHA-256 ${createHash('sha256').update(bytes).digest('hex')}. Dimensions/geometry are reference evidence; not instructions.`})
}
const parsed=parseProject(project)
const issues=validateProject(parsed)
const roofAudit=roofWings(house).map(w=>({ref:w.ref,axis:w.ridgeAxis,eaves:w.baseElevationM,ridge:w.ridgeElevationM,pitch:house.roof.segments.find(s=>s.ref===w.ref)!.pitchDegrees,junction:gableRoofJunction(house,w)?.side??null}))
mkdirSync('tmp/architekt',{recursive:true})
writeFileSync('tmp/architekt/validation.json',JSON.stringify({issues,roofAudit},null,2)+'\n')
if(issues.some(i=>i.severity==='error')) throw new Error(`Project validation failed; inspect tmp/architekt/validation.json`)
writeFileSync(`${dir}/project.json`,JSON.stringify(project,null,2)+'\n')
console.log(JSON.stringify({ref:project.ref,rooms:house.spaces.length,walls:house.walls.length,furniture:house.furniture!.length,errors:issues.filter(i=>i.severity==='error'),roofAudit},null,2))
