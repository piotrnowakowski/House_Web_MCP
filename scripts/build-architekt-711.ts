/** Independent 7 November copy, using the architect's 6 November drawing package. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { polygonBounds, spaceFootprint } from '../src/domain/geometry'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import { gableGlazingProfile } from '../src/domain/gableGlazing'
import { roomDimensions } from '../src/domain/roomDimensions'

const source = parseProject(JSON.parse(readFileSync('project-data/architekt/project.json','utf8')))
const project = structuredClone(source), house = project.buildings.find(b => b.ref === 'house/main')!
project.ref='project/architekt-7-11'; project.name='architekt 7.11'; project.revision=1; project.updatedAt='2026-11-07T14:00:00.000Z'
house.name='Dom · architekt 7.11'
const pt=(a:number,b:number)=>({x:+(a-5.065).toFixed(6),z:+(b-6.605).toFixed(6)})
const rect=(a:number,b:number,c:number,d:number)=>[pt(a,b),pt(c,b),pt(c,d),pt(a,d)]
const ground=house.storeys.find(s=>s.level===0)!, upper=house.storeys.find(s=>s.level===1)!
ground.clearHeightM=2.92; upper.elevationM=ground.elevationM+3.25; upper.clearHeightM=4.28; upper.kneeWallHeightM=1.4
const slab=house.slabs.find(s=>s.ref===upper.baseSlabRef)!
slab.topElevationM=upper.elevationM; slab.thicknessM=.33
for(const wall of house.walls){
  if(ground.wallRefs.includes(wall.ref)&&wall.heightM>2.5) wall.heightM=ground.clearHeightM
  if(upper.wallRefs.includes(wall.ref)) wall.baseElevationM=upper.elevationM
}
// The narrow room at the kitchen is now the separately enclosed A/9 pantry.
const pantry=house.spaces.find(s=>s.ref==='space/reference-kitchen-pantry')!
pantry.name='Spiżarnia';pantry.usage='pantry'
house.spaces.find(s=>s.ref==='space/reference-utility-access')!.name='Garderoba'
const passage=house.walls.find(w=>w.ref==='wall/architekt/correction/0/kitchen-pantry/3')!
assert.ok(passage.heightM<.02)
passage.heightM=ground.clearHeightM
passage.openings=[{ref:'opening/architekt-711/pantry',kind:'door',wallRef:passage.ref,offsetM:Math.hypot(passage.end.x-passage.start.x,passage.end.z-passage.start.z)/2,widthM:.799,heightM:2.1,sillM:0,hinge:'left',swing:'out'}]
const opening=(ref:string)=>house.walls.flatMap(w=>w.openings).find(o=>o.ref===ref)!
opening('opening/reference-kitchen').widthM=2.16
for(const ref of ['opening/reference-kitchen','opening/reference-office-window','opening/architekt/living-left','opening/architekt/living-right','opening/architekt/terrace-side','opening/reference-entrance']) opening(ref).heightM=2.4
// Printed 280 + 216 chain puts the kitchen window on the 775-wide gable axis.
const kitchenWall=house.walls.find(w=>w.openings.some(o=>o.ref==='opening/reference-kitchen'))!
opening('opening/reference-kitchen').offsetM=pt(3.88,0).x-kitchenWall.start.x
const parentsWall=house.walls.find(w=>w.openings.some(o=>o.ref==='opening/architekt/parents-window'))!
opening('opening/architekt/parents-window').offsetM=pt(3.875,0).x-parentsWall.start.x
house.walls.forEach(w=>{w.openings=w.openings.filter(o=>o.ref!=='opening/architekt/bath-window')})

// Roof footprints use external wall faces: 7.75 / 7.64 m. 40 degrees on the section's
// main span gives +7.901 m over the ground floor; the perpendicular pitch keeps one ridge.
const eaves=upper.elevationM+upper.kneeWallHeightM, ridge=eaves+Math.tan(40*Math.PI/180)*7.75/2
house.roof.baseElevationM=eaves;house.roof.pitchDegrees=40;house.roof.overhangM=.6
house.roof.footprint=structuredClone(house.slabs[0].footprint)
const front=house.roof.segments.find(s=>s.ref.endsWith('/front-barn'))!, rear=house.roof.segments.find(s=>s.ref.endsWith('/rear-barn'))!
front.footprint=rect(0,0,7.75,13.21);rear.footprint=rect(3.875,0,10.13,7.64)
for(const roof of [front,rear]){
  const b=polygonBounds(roof.footprint), span=roof.ridgeDirection==='z'?b.maxX-b.minX:b.maxZ-b.minZ
  roof.baseElevationM=eaves;roof.pitchDegrees=Math.atan2(ridge-eaves,span/2)*180/Math.PI;roof.overhangM=.6
  // Existing wall axes are 0.225 m inside the exterior face.
  roof.gableRecess={...(roof===front?{min:{depthM:.225,baseElevationM:ground.elevationM,soffitColorHex:'#B78F60'}}:{}),max:{depthM:.225,baseElevationM:ground.elevationM,soffitColorHex:'#B78F60'}}
  roof.gableFrame={widthM:.6,depthM:.26,colorHex:'#343a3e'}
  for(const side of ['min','max'] as const){const glazing=roof.gableGlazing?.[side];if(!glazing)continue;glazing.shape='roof-following';glazing.continuousWithHost=true;glazing.roofInsetM=.45;delete glazing.transomElevationsM}
}
front.gableGlazing!.min!.transomElevationsM=[upper.elevationM+2.5]
front.gableGlazing!.max!.transomElevationsM=[upper.elevationM+2.35]
for(const ref of ['opening/architekt/parents-window','opening/reference-children-west-window','opening/reference-children-east-window','opening/architekt/void-right','opening/architekt/void-left']){
  const wall=house.walls.find(w=>w.openings.some(o=>o.ref===ref))!, o=opening(ref)
  wall.heightM=1.4;o.sillM=.3;o.heightM=wall.heightM-o.sillM
}
// Roof window size is a visual allowance: the drawings do not specify a product size.
front.windows=[{ref:'roof-window/architekt-711/bathroom',position:pt(1.15,8.13),widthM:.78,lengthM:1.18}]
// Interior partition caps follow the vaulted bedrooms; hall and bathroom stay at 2.70 m.
for(const wall of house.walls.filter(w=>upper.wallRefs.includes(w.ref)&&w.thicknessM<.2&&w.heightM>2))wall.heightM=4.28
house.ceilingFinishes=upper.spaceRefs.map(ref=>({ref:`ceiling/architekt-711/${ref.split('/').at(-1)}`,spaceRef:ref,hostBoundaryRef:upper.topBoundaryRef,elevationM:upper.elevationM+(['space/reference-bathroom','space/reference-landing'].includes(ref)?2.7:4.28)+.02,thicknessM:.02}))
upper.ceilingFinishRefs=house.ceilingFinishes.map(c=>c.ref)
// Fitted pantry shelving replaces the refrigerator previously inside the pantry.
const fridge=house.furniture!.find(f=>f.ref==='interior/architekt/fridge')!
fridge.position=pt(2.47,3.95)
house.furniture!.push({...structuredClone(fridge),ref:'interior/architekt-711/pantry-shelves',catalogId:'wardrobe',name:'Regały spiżarni',position:pt(.74,2.18),widthM:.5,depthM:3.3,heightM:2.1})
// The latest elevations show full-height boxed timber eaves supports.
const frames=[[-.6,-.6,0,.6],[7.75,-.6,8.35,0],[9.53,-.6,10.73,0],[9.53,7.64,10.73,8.24],[-.6,12.61,0,13.81],[7.75,12.61,8.35,13.81]]
for(const [i,[a,b,c,d]] of frames.entries()){
  const q=rect(a+.04,b+.04,c-.04,d-.04)
  const roofs=roofWings(house)
  const top=Math.min(...q.map(p=>Math.max(...roofs.filter(r=>{const bb=polygonBounds(r.footprint);return p.x>=bb.minX-r.overhangM&&p.x<=bb.maxX+r.overhangM&&p.z>=bb.minZ-r.overhangM&&p.z<=bb.maxZ+r.overhangM}).map(r=>{const bb=polygonBounds(r.footprint),cross=r.ridgeAxis==='z'?'x':'z',mid=cross==='x'?(bb.minX+bb.maxX)/2:(bb.minZ+bb.maxZ)/2;const pitch=house.roof.segments.find(s=>s.ref===r.ref)!.pitchDegrees;return r.ridgeElevationM-Math.abs(p[cross]-mid)*Math.tan(pitch*Math.PI/180)}))))
  assert.ok(Number.isFinite(top))
  q.forEach((p,j)=>house.walls.push({ref:`wall/architekt-711/eaves/${i+1}/${j+1}`,groupRef:`group/architekt-711/eaves/${i+1}`,start:p,end:q[(j+1)%4],thicknessM:.08,baseElevationM:.2,heightM:top-.2,openings:[],finish:{material:'charred-timber',colorHex:'#343a3e'},locked:false}))
}
const hashes=readdirSync('tmp/architekt-20261107/source').filter(n=>n.endsWith('.pdf')).map(n=>`${n}: ${createHash('sha256').update(readFileSync(`tmp/architekt-20261107/source/${n}`)).digest('hex')}`)
house.interiorSource={id:'architect-email-2026-11-06',notes:[
  'Source: Gmail message 1a1b15b346d2baae, received 2026-11-06 15:55 CET; latest architect floor plans, section A-A and four elevations. Site-plan changes excluded by user instruction.',
  'Independent copy requested 2026-11-07. Current architekt r10 site, landscape, carport and outbuilding are preserved exactly. Existing project is unchanged.',
  'External house footprint 10.13 x 13.21 m, ground floor datum retained at 0.45 m; upper floor +3.25 m, slab 0.33 m, ground clear height 2.92 m; knee wall 1.40 m. Roof ridge model +7.901 m over ground floor, rounded +7.90 on section.',
  'Main section pitch 40 degrees; perpendicular wing pitch derived from its 7.64 m outer-face span to retain the common ridge. Model roof elevations denote geometry centre planes, not certified as-built top surfaces or height above terrain.',
  'Parents glazing centred on main gable; children glazing follows slopes continuously; bathroom facade window replaced by roof light. Roof light 0.78 x 1.18 m and support details are visual assumptions because the package gives no product/structural sizes.',
  'The pantry now has a door. Existing room geometry retained; printed utility depth 1.80 conflicts with the closed dimension chain (model 1.70). Finishes remain the existing dark metal/timber palette; latest boxed eaves supports restored.',
  ...hashes,
]}
const parsed=parseProject(project), issues=validateProject(parsed)
assert.deepEqual(parsed.landscape,source.landscape);assert.deepEqual(parsed.site,source.site)
assert.deepEqual(parsed.buildings.filter(b=>b.ref!=='house/main'),source.buildings.filter(b=>b.ref!=='house/main'))
const wings=roofWings(house), roofs=wings.map(w=>{const b=polygonBounds(w.footprint),span=w.ridgeAxis==='z'?b.maxX-b.minX:b.maxZ-b.minZ;return{ref:w.ref,span,eaves:w.baseElevationM,ridge:w.ridgeElevationM,angle:Math.atan2(w.ridgeElevationM-w.baseElevationM,span/2)*180/Math.PI,junction:gableRoofJunction(house,w)?.side}})
assert.ok(roofs.every(r=>r.angle>=37&&r.angle<=45));assert.ok(Math.abs(roofs[0].ridge-roofs[1].ridge)<1e-8);assert.equal(roofs[1].junction,'min')
const glazing=[front,rear].flatMap(r=>(['min','max'] as const).map(side=>({ref:r.ref,side,panels:gableGlazingProfile(r,side,house)?.panels.length??0})))
const rooms=house.spaces.map(s=>({ref:s.ref,name:s.name,...roomDimensions(house,s),footprint:spaceFootprint(house,s)}))
mkdirSync('tmp/architekt-20261107',{recursive:true})
writeFileSync('tmp/architekt-20261107/validation.json',JSON.stringify({issues,roofs,glazing,rooms},null,2)+'\n')
assert.deepEqual(issues.filter(i=>i.severity==='error'),[])
const dir='project-data/architekt-7-11';mkdirSync(dir,{recursive:true})
writeFileSync(`${dir}/source-architekt-r10.json`,JSON.stringify(source,null,2)+'\n',{flag:'wx'})
writeFileSync(`${dir}/initial-r1.json`,JSON.stringify(parsed,null,2)+'\n',{flag:'wx'})
writeFileSync(`${dir}/project.json`,JSON.stringify(parsed,null,2)+'\n')
console.log(JSON.stringify({ref:parsed.ref,revision:parsed.revision,roofs,glazing,errors:issues.filter(i=>i.severity==='error')},null,2))
