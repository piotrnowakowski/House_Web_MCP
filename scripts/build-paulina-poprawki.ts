/** Paulina's screenshot revision. Phone-plan coordinates: p right, q down,
 * measured from the top-left wall AXIS. See project-data/paulina-poprawki/README.md. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { pointOnSegment, splitPolygonEdges, wallLength, polygonBounds } from '../src/domain/geometry'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import { roomDimensions } from '../src/domain/roomDimensions'
import { placementWarnings } from '../src/domain/interiorPlacement'
import { availableInteriorHeight, itemFitsFloor } from '../src/domain/interior'
import type { InteriorCatalogId, Polygon2, SpaceBoundaryUse, StoreyModel, Vec2 } from '../src/domain/types'

const dir='project-data/paulina-poprawki'
const source=parseProject(JSON.parse(readFileSync(`${dir}/source-architekt-r4.json`,'utf8')))
const project=structuredClone(source), house=project.buildings.find(b=>b.ref==='house/main')!
const previous=structuredClone(house)
const current=parseProject(JSON.parse(readFileSync(`${dir}/project.json`,'utf8')))
project.ref='project/paulina-poprawki'; project.name=current.name; project.revision=current.revision
project.updatedAt=current.updatedAt
house.name='Dom · Paulina poprawki'
const pt=(p:number,q:number):Vec2=>({x:+(p-4.625).toFixed(6),z:+(q-5.945).toFixed(6)})
const poly=(a:number[][]):Polygon2=>a.map(([p,q])=>pt(p,q))
const rect=(p:number,q:number,r:number,s:number)=>poly([[p,q],[r,q],[r,s],[p,s]])
const near=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z)<1e-6
const center=poly([[0,0],[9.25,0],[9.25,7.08],[6.98,7.08],[6.98,11.89],[0,11.89]])
const outer=poly([[-.1,-.1],[9.35,-.1],[9.35,7.18],[7.08,7.18],[7.08,11.99],[-.1,11.99]])
const ground='storey/reference-ground',upper='storey/reference-upper'
house.walls=[];house.spaces=[];house.furniture=[];house.platforms=[];house.ceilingFinishes=[]
house.storeys=previous.storeys.map(s=>({...s,wallRefs:[],spaceRefs:[],platformRefs:[],ceilingFinishRefs:[]}))
house.slabs=previous.slabs.map(s=>({...s,footprint:structuredClone(outer),...(s.ref==='slab/reference-upper'?{holes:[rect(.1,4.26,3.25,6.26),rect(5.21,.1,9.15,6.98)]}:{})}))

type Room={ref:string;name:string;usage:string;points:Polygon2;void?:boolean}
const room=(id:string,name:string,usage:string,points:Polygon2,voidRoom=false):Room=>({ref:id.startsWith('space/')?id:`space/reference-${id}`,name,usage,points,void:voidRoom})
function floor(ref:string,rooms:Room[]){
 const storey=house.storeys.find(s=>s.ref===ref)!
 for(const r of rooms){
  const points=rooms.reduce((p,o)=>splitPolygonEdges(p,o.points),r.points)
  const boundary:SpaceBoundaryUse[]=points.map((start,i)=>{
   const end=points[(i+1)%points.length]
   const existing=house.walls.find(w=>storey.wallRefs.includes(w.ref)&&((near(start,w.start)&&near(end,w.end))||(near(start,w.end)&&near(end,w.start))))
   if(existing)return {wallRef:existing.ref,direction:near(start,existing.start)?1:-1}
   const external=center.some((p,j)=>pointOnSegment(start,p,center[(j+1)%center.length])&&pointOnSegment(end,p,center[(j+1)%center.length]))
   const guard=ref===upper&&!external&&(
    Math.abs(start.x-(5.15-4.625))<1e-6&&Math.abs(end.x-start.x)<1e-6&&Math.max(start.z,end.z)<=7.08-5.945+1e-6
    ||Math.abs(start.z-(7.08-5.945))<1e-6&&Math.abs(end.z-start.z)<1e-6&&Math.min(start.x,end.x)>=5.15-4.625-1e-6)
   const wallRef=`wall/paulina/${storey.level?'upper':'ground'}/${storey.wallRefs.length+1}`
   house.walls.push({ref:wallRef,start,end,thicknessM:guard?.12:.2,baseElevationM:storey.elevationM,heightM:guard?1.05:storey.clearHeightM,openings:[],locked:false,finish:{material:'light-render',colorHex:guard?'#353A3A':'#E9E5DC',textureId:'none'}})
   storey.wallRefs.push(wallRef);return {wallRef:wallRef,direction:1}
  })
  if(!r.void){
   const old=previous.spaces.find(s=>s.ref===r.ref)
   house.spaces.push({ref:r.ref,name:r.name,usage:r.usage,boundary,baseSlabRef:storey.baseSlabRef,topBoundaryRef:storey.topBoundaryRef,floorFinish:old?.floorFinish??{presetId:'sand-tile',color:'#D4C6B1',rotationDegrees:0,tileM:.6},ceilingFinish:old?.ceilingFinish??{presetId:'warm-white',color:'#F5F1E8',rotationDegrees:0,tileM:1},locked:false})
   storey.spaceRefs.push(r.ref)
  }
 }
 return storey
}
const g=floor(ground,[
 room('space/paulina-pantry','Spiżarnia','storage',rect(0,0,1.85,4.16)),
 room('space/paulina-entry-wardrobe','Garderoba przy wejściu','wardrobe',rect(0,7.55,2.11,10.27)),
 room('wc','Łazienka','bathroom',rect(2.11,7.55,4.23,10.27)),
 room('pantry','Pomieszczenie gospodarcze','utility',rect(0,10.27,4.23,11.89)),
 room('office','Pokój','bedroom',rect(4.23,7.55,6.98,11.89)),
 room('living','Salon · jadalnia · kuchnia · hol','living',poly([[1.85,0],[9.25,0],[9.25,7.08],[6.98,7.08],[6.98,7.55],[0,7.55],[0,4.16],[1.85,4.16]])),
])
const u=floor(upper,[
 room('parents','Sypialnia','bedroom',rect(0,0,4.23,4.16)),
 room('bathroom','Łazienka piętro','bathroom',rect(0,6.36,2.47,8.67)),
 room('child-one','Pokój 1','bedroom',rect(0,8.67,3.73,11.89)),
 room('child-two','Pokój 2','bedroom',poly([[3.73,8.67],[5.15,8.67],[5.15,7.55],[6.98,7.55],[6.98,11.89],[3.73,11.89]])),
 room('landing','Komunikacja · galeria nad salonem','hall',poly([[0,4.16],[4.23,4.16],[4.23,0],[5.15,0],[5.15,7.08],[6.98,7.08],[6.98,7.55],[5.15,7.55],[5.15,8.67],[2.47,8.67],[2.47,6.36],[0,6.36]])),
 room('living-void','Pustka nad salonem','void',rect(5.15,0,9.25,7.08),true),
])
// Short bathroom privacy/shower return, 0.99 m clear from its tip to the inner wall.
const bathReturn={ref:'wall/paulina/ground/bath-return',start:pt(3.14,9.13),end:pt(4.23,9.13),thicknessM:.2,baseElevationM:.45,heightM:2.1,openings:[],locked:false,finish:{material:'light-render' as const,colorHex:'#E9E5DC',textureId:'none'}}
house.walls.push(bathReturn);g.wallRefs.push(bathReturn.ref)
function opening(storey:StoreyModel,ref:string,kind:'door'|'window',p:number,q:number,width:number,height=2.1,sill=0,glazed=false){
 const at=pt(p,q),wall=house.walls.find(w=>storey.wallRefs.includes(w.ref)&&pointOnSegment(at,w.start,w.end)&&Math.hypot(at.x-w.start.x,at.z-w.start.z)>=width/2-.001&&Math.hypot(at.x-w.end.x,at.z-w.end.z)>=width/2-.001)
 if(!wall)throw Error(`No host wall ${ref}`)
 const offsetM=Math.hypot(at.x-wall.start.x,at.z-wall.start.z)
 if(offsetM+width/2>wallLength(wall)+1e-6)throw Error(`Opening outside wall ${ref}`)
 wall.openings.push({ref,wallRef:wall.ref,kind,offsetM,widthM:width,heightM:height,sillM:sill,...(glazed?{glazed:true}:{}),...(kind==='door'?{hinge:'left' as const,swing:'in' as const}:{})})
}
opening(g,'opening/reference-entrance','door',0,6.82,1)
opening(g,'opening/paulina/entry-wardrobe','door',1.15,7.55,.9)
opening(g,'opening/architekt/utility-external','door',1.15,10.27,.9)
opening(g,'opening/reference-wc','door',3.37,7.55,.9)
opening(g,'opening/reference-office','door',5.65,7.55,.9)
opening(g,'opening/paulina/pantry','door',1.85,3.55,.8)
opening(g,'opening/reference-kitchen','window',4.03,0,2.6,1.5,.85)
opening(g,'opening/architekt/living-left','door',9.25,4.93,2.2,2.35,0,true)
opening(g,'opening/architekt/living-right','window',9.25,2.01,2.2,1.5,.85)
opening(g,'opening/reference-office-window','window',6.98,9.05,1.5,1.5,.8)
opening(u,'opening/reference-parents','door',3.56,4.16,.85)
opening(u,'opening/reference-bathroom','door',2.47,7.72,.8)
opening(u,'opening/reference-child-one','door',3.73,9.24,.85)
opening(u,'opening/reference-child-two','door',5.15,8.09,.85)
opening(u,'opening/architekt/parents-window','window',2.36,0,2,1.5,.8)
opening(u,'opening/architekt/bath-window','window',0,7.65,.8,.6,.7)
opening(u,'opening/reference-children-west-window','window',1.74,11.89,1.8,1.2,.7)
opening(u,'opening/reference-children-east-window','window',5.42,11.89,1.5,1.1,.8)
opening(u,'opening/architekt/void-left','window',9.25,4.93,2.2,1.4,0)
opening(u,'opening/architekt/void-right','window',9.25,2.01,2.2,1.4,0)
// Open these doors away from the shallow entry storage and shower enclosure.
for(const wall of house.walls)for(const door of wall.openings){
 if(['opening/paulina/entry-wardrobe','opening/architekt/utility-external','opening/reference-wc'].includes(door.ref))door.swing='out'
 if(door.ref==='opening/reference-office')door.hinge='right'
}
house.stairs=[{ref:'stairs/reference-main',fromStoreyRef:ground,toStoreyRef:upper,start:pt(.1,4.26),runM:2.2,widthM:.95,steps:18,uTurn:{landingDepthM:.95,gapM:.1}}]

// Retain the chosen attic datum and equal ridges; solve pitch from the NEW spans.
const eaves=previous.roof.baseElevationM,ridge=roofWings(previous)[0].ridgeElevationM
const front='roof/reference/front-barn',rear='roof/reference/rear-barn'
const segment=(ref:string,footprint:Polygon2,axis:'x'|'z',other:string)=>{
 const b=polygonBounds(footprint),span=axis==='z'?b.maxX-b.minX:b.maxZ-b.minZ
 const original=previous.roof.segments.find(s=>s.ref===ref)!
 return {...original,footprint,baseElevationM:eaves,pitchDegrees:Math.atan((ridge-eaves)/(span/2))*180/Math.PI,ridgeDirection:axis,adjacentSegmentRefs:[other]}
}
house.roof={...previous.roof,footprint:center,segments:[segment(front,rect(0,0,6.98,11.89),'z',rear),segment(rear,rect(3.49,0,9.25,7.08),'x',front)]}
house.roof.pitchDegrees=house.roof.segments[0].pitchDegrees

function item(ref:string,catalogId:InteriorCatalogId,name:string,p:number,q:number,w:number,d:number,h:number,angle=0,storey=ground,color='#B99A72'){
 house.furniture!.push({ref,catalogId,name,storeyRef:storey,position:pt(p,q),widthM:w,depthM:d,heightM:h,rotationDegrees:angle,color})
}
item('interior/reference-cabinet-one','wardrobe','Zabudowa wysoka kuchni',2.26,.55,.6,.85,2.1)
item('interior/reference-counter','kitchen-counter','Blat kuchenny',2.26,1.24,.6,.5,.9)
item('interior/architekt/cooker','cooker','Płyta kuchenna',2.26,1.86,.6,.7,.92)
item('interior/reference-sink','sink','Zlew kuchenny',2.26,2.57,.6,.64,.9)
item('interior/reference-island','kitchen-counter','Wyspa kuchenna',3.82,2.05,1.15,2.65,.92)
for(const [i,q]of[1.27,2.05,2.83].entries())item(i<2?`interior/reference-stool-${i?'two':'one'}`:'interior/paulina/stool-three','bar-stool',`Hoker ${i+1}`,4.86,q,.42,.42,.75)
item('interior/reference-sofa','corner-sofa','Narożnik',7.02,2.27,3.4,2.6,.86,0,ground,'#C8BCAE')
item('interior/reference-dining','dining-table','Stół i sześć krzeseł',7.08,4.93,2.05,2.15,.85)
item('interior/paulina/entry-left','wardrobe','Szafa wejściowa · lewa',.43,9.1,.6,1.98,2.5)
item('interior/paulina/entry-right','wardrobe','Szafa wejściowa · prawa',1.68,9.1,.6,1.98,2.5)
item('interior/carport-study/wc','toilet','WC',2.66,8.09,.45,.7,.8,0,ground,'#F3F0E8')
item('interior/carport-study/shower','shower','Prysznic',3.68,8.52,.88,1.0,2.1)
item('interior/carport-study/vanity','vanity','Umywalka',3.72,9.76,.7,.45,.85)
item('interior/architekt/utility-washer','washer','Pralka',2.63,11.49,.6,.6,.85)
item('interior/architekt/utility-dryer','washer','Suszarka',3.38,11.49,.6,.6,.85)
item('interior/paulina/guest-bed','bed','Łóżko w pokoju',4.78,8.76,.8,2.05,.9)
// Upper layout is the annotated architect sheet adapted to the new envelope.
item('interior/reference-parents-bed','bed','Łóżko sypialni',2.43,1.5,1.8,2.1,1,0,upper)
item('interior/architekt/parents-nightstand-1','coffee-table','Szafka nocna',1.21,.66,.45,.5,.48,0,upper)
item('interior/architekt/parents-nightstand-2','coffee-table','Szafka nocna',3.66,.66,.45,.5,.48,0,upper)
item('interior/paulina/parents-storage','wardrobe','Szafa sypialni',.48,2.77,.6,1.55,1.4,0,upper)
item('interior/reference-child-one-bed','bed','Łóżko · pokój 1',2.7,10.61,1,2.05,.85,0,upper)
item('interior/architekt/child-one-desk','desk','Biurko · pokój 1',.91,11.44,1.2,.6,.75,0,upper)
item('interior/architekt/child-one-chair','armchair','Krzesło · pokój 1',.91,10.70,.45,.45,.85,0,upper)
item('interior/architekt/child-one-storage','wardrobe','Szafa · pokój 1',1.1,9.12,1.7,.6,1.3,0,upper)
item('interior/reference-child-two-bed','bed','Łóżko · pokój 2',5.89,10.68,1,2.05,.85,0,upper)
item('interior/architekt/child-two-desk','desk','Biurko · pokój 2',4.49,11.44,1.1,.6,.75,0,upper)
item('interior/architekt/child-two-chair','armchair','Krzesło · pokój 2',4.49,10.70,.45,.45,.85,0,upper)
item('interior/architekt/child-two-storage','wardrobe','Szafa · pokój 2',4.54,9.12,1.28,.6,1.3,0,upper)
item('interior/reference-bathtub','bathtub','Wanna',.60,7.44,.75,1.7,.6,0,upper,'#F3F0E8')
item('interior/reference-upper-toilet','toilet','WC piętro',1.51,6.85,.45,.7,.8,0,upper,'#F3F0E8')
item('interior/reference-upper-vanity','vanity','Umywalka piętro',1.73,8.32,.7,.45,.85,0,upper)

house.interiorSource={id:'paulina-screenshots-2026-10-11',notes:[
 'Independent Paulina poprawki fork of architekt r4. User explicitly selected screenshot dimensions including exterior changes. Source architekt and all other projects remain unchanged.',
 'Phone plan wall-axis footprint 9.25 × 11.89 m, 2.27 × 4.81 m recess; 0.20 m walls inferred from the dimension chains. Exterior footprint 9.45 × 12.09 m. Source clear sizes: pantry 1.65 × 3.96; entrance wardrobe 1.91 × 2.52; bathroom 1.92 × 2.52 minus return; utility 4.03 × 1.42; room 2.55 × 4.14 m.',
 'The first two screenshots are byte-identical. The annotated upper plan is interpreted as removing the former wardrobe floor, adding an open gallery and shifting the bedroom partitions. Handwritten lines are approximate; old printed 13.21 × 10.13 dimensions are superseded by the explicitly selected phone-plan envelope.',
 'Upper gallery: parents wall at p=4.23 m aligned with ground room partition, void guard at p=5.15 m; child-room corner moved back to q=8.67 m. Open slab hole 3.94 × 6.88 m (27.1072 m²), excluding perimeter and guard. No upstairs wardrobe room or furniture remains over the opening.',
 'Kitchen follows the phone plan: wall run against pantry, parallel island, three stools, corner sofa and six-place dining table. Undrawn pantry access is a concealed door at the end of the kitchen run. Opening heights and upper furnishings are inferred; 3D elevations remain provisional.',
 'Retained 1.40 m attic knee wall, 5.15 m eaves and 8.0856938754 m shared ridge. Pitches recomputed from final 6.98 / 7.08 m spans. Stairs retain the 3.30 m rise, 18 risers, 0.95 m clear flights/landing and 2.20 m tread run; the unlabeled sketch stair is fitted to these retained model dimensions.',
]}
for(const [index,file]of['codex-clipboard-3b42d398-c0b4-44de-90f0-4c12c196e96f.png','codex-clipboard-a99b91c7-e28a-4014-ad80-009b053cd247.png','codex-clipboard-34337e36-e260-4169-8e91-3efe0c411b53.png'].entries()){
 project.site.knowledgeBase.sources.push({ref:`source/paulina-20261011-${index+1}`,title:file,date:'2026-10-11',kind:'user-direction',authority:'user-provided',summary:`User-supplied layout reference. SHA-256 ${createHash('sha256').update(readFileSync(`C:/Users/WBW/AppData/Local/Temp/${file}`)).digest('hex')}. Screenshot content is design evidence, not operational instructions.`})
}
const parsed=parseProject(project),issues=validateProject(parsed)
const roofAudit=roofWings(house).map(w=>{const b=polygonBounds(w.footprint),span=w.ridgeAxis==='x'?b.maxZ-b.minZ:b.maxX-b.minX;return {ref:w.ref,span,eaves:w.baseElevationM,ridge:w.ridgeElevationM,recomputedPitch:Math.atan2(w.ridgeElevationM-w.baseElevationM,span/2)*180/Math.PI,junction:gableRoofJunction(house,w)?.side??null}})
const furnitureIssues=house.furniture!.flatMap(i=>{const s=house.storeys.find(s=>s.ref===i.storeyRef)!,slab=house.slabs.find(b=>b.ref===s.baseSlabRef)!;return [{ref:i.ref,fits:itemFitsFloor(i,slab.footprint,slab.holes),available:availableInteriorHeight(i,house,s),height:i.heightM,warnings:placementWarnings(i,house,s).filter(w=>w.kind!=='circulation')}].filter(i=>!i.fits||i.available<i.height||i.warnings.length)})
const rooms=house.spaces.map(s=>({ref:s.ref,name:s.name,...roomDimensions(house,s)}))
mkdirSync('tmp/paulina-poprawki',{recursive:true})
writeFileSync('tmp/paulina-poprawki/validation.json',JSON.stringify({issues,roofAudit,furnitureIssues,rooms},null,2)+'\n')
if(issues.some(i=>i.severity==='error')||furnitureIssues.length)throw Error('Review tmp/paulina-poprawki/validation.json')
writeFileSync(`${dir}/project.json`,JSON.stringify(project,null,2)+'\n')
console.log(JSON.stringify({ref:project.ref,roofAudit,rooms:rooms.map(r=>({name:r.name,area:r.area})),furnitureIssues},null,2))
