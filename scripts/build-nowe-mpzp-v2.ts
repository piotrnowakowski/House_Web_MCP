import fs from 'node:fs'
import assert from 'node:assert/strict'
import Module from 'manifold-3d'
import { CatmullRomCurve3, Vector3 } from 'three'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon, polygonSelfIntersects, polygonArea } from '../src/domain/geometry'
import { gardenFixtureById } from '../src/domain/gardenFixtures'
import type { GardenFixtureCatalogId, GardenZoneKind, PlantModel, Vec2 } from '../src/domain/types'

const dir = 'project-data/nowe-mpzp-v2'
fs.mkdirSync(dir, { recursive: true })
const sourceFile = `${dir}/source-nowe-mpzp-r19.json`
if (!fs.existsSync(sourceFile)) fs.copyFileSync('project-data/nowe-mpzp/project.json', sourceFile, fs.constants.COPYFILE_EXCL)
const source = parseProject(JSON.parse(fs.readFileSync(sourceFile, 'utf8'))), p = structuredClone(source)
assert.equal(source.revision, 19)
p.ref = 'project/nowe-mpzp-v2'; p.name = 'nowe mpzp — wariant 2'; p.revision = 2; p.updatedAt = '2026-10-20T19:00:00.000Z'
const pt = (x: number, z: number): Vec2 => ({ x: +x.toFixed(4), z: +z.toFixed(4) })
const rect = (x: number, z: number, w: number, d: number) => [pt(x-w/2,z-d/2),pt(x+w/2,z-d/2),pt(x+w/2,z+d/2),pt(x-w/2,z+d/2)]
const circle = (x: number, z: number, r: number) => Array.from({length:48},(_,i)=>pt(x+r*Math.cos(i*Math.PI/24),z+r*Math.sin(i*Math.PI/24)))
const curve = (points: number[][], width: number) => {
  const path = new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z))), left:Vec2[]=[],right:Vec2[]=[]
  for(let i=0;i<=32;i++){const v=path.getPoint(i/32),t=path.getTangent(i/32);left.push(pt(v.x-t.z*width/2,v.z+t.x*width/2));right.push(pt(v.x+t.z*width/2,v.z-t.x*width/2))}
  return [...left,...right.reverse()]
}
const zone = (ref: string, name: string, kind: GardenZoneKind, footprint: Vec2[], textureId: string) =>
  p.landscape.zones.push({ref,name,kind,footprint,textureId,locked:false})
const fixture = (suffix: string, catalogId: GardenFixtureCatalogId, name: string, x: number, z: number, rotationDegrees=0) =>
  p.landscape.fixtures.push({ref:`fixture/nowe-mpzp-v2/${suffix}`,catalogId,name,position:pt(x,z),rotationDegrees,locked:false})
const zref = (suffix: string) => `zone/nowe-mpzp-v2/${suffix}`
// The new identity keeps the parent and its surveyed trees independent.
p.landscape.plants = p.landscape.plants.filter(t=>t.surveyHandle)
p.landscape.zones = p.landscape.zones.filter(z=>['zone/driveway','zone/architekt/entry-apron','zone/nowe-mpzp/front-frame'].includes(z.ref))

// A metre-sized wraparound deck meets the two existing garden-facing elevations.
zone('zone/terrace','Taras drewniany przy salonie i jadalni','terrace',[
  pt(-13.901,4.685),pt(-8.339,4.387),pt(-8.212,6.764),pt(-.583,6.355),
  pt(-.32,11.25),pt(-13.55,11.96),
],'coated-pine')
fixture('terrace-lounge','garden-lounge-set','Wypoczynek na tarasie · 3,8 × 3,1 m',-11.0,7.65,0)
fixture('terrace-dining','outdoor-dining-set','Stół tarasowy z sześcioma krzesłami · 3,4 × 2,5 m',-5.1,9.45,0)
const fire=p.landscape.fixtures.find(f=>f.catalogId==='round-fire-lounge')!
fire.position=pt(11.8,5.3)
zone('zone/nowe-mpzp/garden/fire-court','Palenisko · placyk Ø6 m','terrace',circle(11.8,5.3,3),'river-pebbles')
zone('zone/nowe-mpzp/garden/house-fire-path','Łukowe dojście od tarasu · 1,4 m','path',curve([[-.5,10.2],[3.5,11.4],[7.8,10.8],[11.8,8.2]],1.4),'river-pebbles')
zone('zone/nowe-mpzp/garden/garden-path','Dojście do kuchni letniej · 1,4 m','path',curve([[7.6,10.8],[9.5,11.7],[11,13],[11.3,14.5]],1.4),'river-pebbles')

zone(zref('summer-deck'),'Drewniany pomost kuchni, jacuzzi i sauny · 7,8 × 17 m','terrace',rect(11.9,22,7.8,17),'coated-pine')
fixture('pergola','kitchen-pergola','Kuchnia letnia · pergola 5 × 7 m · lokalizacja warunkowa',12.3,17.8)
fixture('kitchen','outdoor-kitchen','Grill, zlew i blat · 3,6 × 0,8 m',14.2,18.0,-90)
fixture('pizza','pizza-oven','Piec do pizzy obok otwartej pergoli · 1 × 1,05 m',14.8,12.7,-90)
zone(zref('oven-pad'),'Kamienny podest pieca · 1,5 × 1,5 m','terrace',rect(14.8,12.7,1.5,1.5),'concrete-tiles')
fixture('summer-table','outdoor-dining-set','Stół kuchni letniej · sześć miejsc',11.5,17.9,90)
fixture('hot-tub','round-hot-tub','Jacuzzi okrągłe · Ø2,4 m',10.0,26.7,0)
fixture('sauna','garden-sauna','Sauna · 2,5 × 3 m · R3, lokalizacja warunkowa',14.0,27.0,0)

const greenhouse=p.landscape.fixtures.find(f=>f.catalogId==='greenhouse')!
greenhouse.position=pt(12.6,39.8);greenhouse.rotationDegrees=90
const beds=p.landscape.fixtures.filter(f=>f.catalogId==='raised-bed-2x1')
beds.forEach((bed,i)=>{
  const pos=pt(i<3?5.2:8.6,36.7+(i%3)*2.6)
  const crop=p.landscape.fixtures.find(f=>f.ref===bed.ref.replace('/bed-','/crop-'))!
  bed.position=pos;crop.position={...pos}
})
zone('zone/nowe-mpzp/garden/kitchen-garden','Warzywnik i szklarnia po prawej · przejścia 1–1,4 m','path',rect(8.9,39.4,11.8,9.4),'river-pebbles')
// Larger individual slabs preserve a walkable route instead of enlarging the fixtures.
for(let i=0;i<6;i++)zone(zref(`spa-garden-step-${i+1}`),`Płyta dojścia ${i+1} · 1,2 × 0,55 m`,'path',rect(13,30.75+i*.7,1.2,.55),'concrete-tiles')

// Five fruit trees across the back and seven along the right, as in the reference.
const fruit=source.landscape.plants.filter(t=>t.ref.startsWith('plant/nowe-mpzp/fruit-'))
fruit.forEach((old,i)=>{
  const tree=structuredClone(old)
  tree.position=i<7?pt(16.4,33+i*4.2):pt(-11+(i-7)*6,62.5)
  tree.name=tree.name.replace('miejsce na odmianę słabo rosnącą','rezerwa podkładki słabo rosnącej; korona 3,2 m')
  p.landscape.plants.push(tree)
  zone(`zone/nowe-mpzp/garden/fruit-mulch-${i+1}`,`Misa drzewa owocowego ${i+1}`,'bed',circle(tree.position.x,tree.position.z,.8),'forest-floor')
})

const module = await Module(); module.setup()
const {CrossSection:C}=module
const cs=(poly:Vec2[])=>new C([poly.map(v=>[v.x,v.z])],'EvenOdd')
const union=(polys:Vec2[][])=>C.union(polys.map(cs))
const bodies=p.buildings.flatMap(buildingFootprintsWorld)
const deck=p.landscape.zones.find(z=>z.ref==='zone/terrace')!
const frame=p.landscape.zones.find(z=>z.ref==='zone/nowe-mpzp/front-frame')!
const deckParts=cs(deck.footprint).subtract(union([...bodies,frame.footprint])).toPolygons()
assert.equal(deckParts.length,1)
deck.footprint=deckParts[0].map(([x,z])=>({x,z}))
const hard=p.landscape.zones.filter(z=>!['lawn','bed'].includes(z.kind)).map(z=>z.footprint)
const obstacles=[...bodies,...hard]
const planted: PlantModel[]=[]
const templates: Array<Pick<PlantModel,'name'|'species'|'kind'|'matureHeightM'|'canopyM'|'sunNeed'|'waterNeed'|'hardinessMinC'|'leafMonths'|'bloomMonths'>>=[
  {name:'Hortensja bukietowa Little Lime',species:"Hydrangea paniculata 'Jane' LITTLE LIME",kind:'shrub',matureHeightM:1.5,canopyM:1.5,sunNeed:'partial',waterNeed:.8,hardinessMinC:-25,leafMonths:[4,5,6,7,8,9,10],bloomMonths:[7,8,9]},
  {name:'Trzcinnik Karl Foerster',species:"Calamagrostis × acutiflora 'Karl Foerster'",kind:'grass',matureHeightM:1.8,canopyM:.6,sunNeed:'sun',waterNeed:.5,hardinessMinC:-25,leafMonths:[3,4,5,6,7,8,9,10,11],bloomMonths:[6,7,8]},
  {name:'Lawenda Hidcote · stanowisko przepuszczalne',species:"Lavandula angustifolia 'Hidcote'",kind:'perennial',matureHeightM:.5,canopyM:1,sunNeed:'sun',waterNeed:.3,hardinessMinC:-15,leafMonths:[1,2,3,4,5,6,7,8,9,10,11,12],bloomMonths:[6,7,8]},
]
const edgeDistance=(q:Vec2,poly:Vec2[])=>Math.min(...poly.map((v,i)=>distanceToSegment(q,v,poly[(i+1)%poly.length])))
function border(suffix:string,points:number[][],width:number,spacing:number){
  const path=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z)))
  const outline=cs(curve(points,width)).subtract(union(obstacles))
  for(const [i,poly] of outline.toPolygons().entries())zone(zref(`${suffix}-${i+1}`),'Rabata mieszana · docelowe rozmiary roślin','bed',poly.map(([x,z])=>({x,z})),'forest-floor')
  const count=Math.max(1,Math.floor(path.getLength()/spacing))
  for(let i=0;i<=count;i++){
    const t=templates[i%3],v=path.getPointAt(i/count),q=pt(v.x,v.z),r=t.canopyM/2
    if(obstacles.some(poly=>pointInPolygon(q,poly)||edgeDistance(q,poly)<r+.15))continue
    if(!pointInPolygon(q,p.site.boundary)||edgeDistance(q,p.site.boundary)<r+.25)continue
    if(p.landscape.plants.some(other=>Math.hypot(other.position.x-q.x,other.position.z-q.z)<other.canopyM/2+r+.1))continue
    if(planted.some(other=>Math.hypot(other.position.x-q.x,other.position.z-q.z)<(other.canopyM+t.canopyM)/2+.05))continue
    planted.push({...t,ref:`plant/nowe-mpzp-v2/${suffix}-${i+1}`,position:q,locked:false,placementRole:'site'})
  }
}
border('west-border',[[-17,10],[-16.3,23],[-16.9,41],[-16.3,56],[-15.9,65.6]],2.2,1.4)
border('east-border',[[17.2,-7],[17.8,4],[17.7,20],[17.4,31],[17.1,48],[16.4,65.8]],2.0,1.4)
border('rear-border',[[-15.9,66.2],[-6,66.5],[5,66.2],[16.3,66.5]],2.1,1.4)
border('terrace-front',[[-13.8,13.0],[-10,13.0],[-5,12.5],[-1,12.4]],1.8,1.4)
border('terrace-side',[[-15,7],[-15,10],[-14.4,12.7]],1.5,1.4)
border('spa-lawn-edge',[[7,13.4],[6.9,18],[7,23],[6.9,28],[7.5,31]],1.7,1.4)
border('spa-rear',[[7.5,31.6],[10.2,31.8],[11.9,32.2]],1.4,1.4)
border('vegetable-left',[[1.9,35],[1.9,39.5],[1.9,44.5],[7.7,45.5],[14.5,45.4]],1.65,1.4)
border('vegetable-front',[[3.1,33.7],[7.5,33.7],[11.3,33.7]],1.2,1.4)
border('fire-border',[[8.5,1.9],[12.8,1.0],[15.5,4.2],[15.6,8.7],[13.7,10.4]],1.5,1.4)
p.landscape.plants.push(...planted)

// Polygon zones cannot contain holes; split the lawn at every obstacle centre.
const garden=cs(p.site.boundary).offset(-.25).intersect(cs(rect(0,26.5,60,84.5)))
const exclusions=[...bodies,...p.landscape.zones.map(z=>z.footprint)]
const lawn=garden.subtract(union(exclusions))
const cuts=[-15.75,68.75,...exclusions.map(poly=>poly.reduce((s,v)=>s+v.z,0)/poly.length)].filter(z=>z>=-15.75&&z<=68.75).sort((a,b)=>a-b)
const parts:Vec2[][]=[]
for(let i=1;i<cuts.length;i++){
  if(cuts[i]-cuts[i-1]<1e-6)continue
  for(const contour of lawn.intersect(cs(rect(0,(cuts[i]+cuts[i-1])/2,80,cuts[i]-cuts[i-1]))).toPolygons()){
    const area=contour.reduce((s,v,j)=>s+v[0]*contour[(j+1)%contour.length][1]-contour[(j+1)%contour.length][0]*v[1],0)/2
    assert(area>0,'Lawn hole needs an additional cut')
    parts.push(contour.map(([x,z])=>({x,z})))
  }
}
assert(Math.abs(union(parts).area()-lawn.area())<1e-5)
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const merged=union([parts[i],parts[j]]).toPolygons()
  const poly=merged[0]?.map(([x,z])=>({x,z}))
  if(merged.length===1&&!polygonSelfIntersects(poly)){parts[i]=poly;parts.splice(j,1);i=-1;break}
}
assert(parts.filter(poly=>polygonArea(poly)<.01).reduce((sum,poly)=>sum+polygonArea(poly),0)<.02)
parts.filter(poly=>polygonArea(poly)>=.01).forEach((poly,i)=>zone(zref(`lawn-${i+1}`),'Trawnik otwarty','lawn',poly,'leafy-grass'))

p.site.knowledgeBase.sources.push({
  ref:'source/nowe-mpzp-v2-reference',title:'Ilustracja użytkownika — ogród, koncepcja zagospodarowania',date:'2026-10-20',kind:'user-direction',authority:'user-provided',
  summary:'Osobny wariant 2 na bazie nowe mpzp r19. Układ stref odtworzony na rzeczywistym obrysie. Ilustracja bez skali i listy gatunków; gabaryty wyposażenia nominalne, rozmiary roślin docelowe.',
})
p.site.knowledgeBase.caveats=p.site.knowledgeBase.caveats.filter(c=>!/^Ogród r14:/.test(c))
p.site.knowledgeBase.caveats.push(
  'Wariant 2: ilustracja bez skali. Dom, garaż, wiata, granice, ogrodzenie i 11 drzew geodezyjnych zachowane z r19. Ogród dostosowany do rzeczywistych metrów, bez skalowania budynków i miniaturyzacji drzew.',
  'Wariant 2: sauna, pergola kuchni i szklarnia w 18.R3.1 są lokalizacjami warunkowymi. Projekt planu §37 zakazuje nowych budynków; to odtworzenie zamówionej koncepcji, nie potwierdzenie dopuszczalności realizacji.',
  'Wariant 2: palenisko Ø6 m i piec pokazano bez ognia. Odsunięcie pieca poza pergolę nie stanowi projektu ochrony przeciwpożarowej; wymagane instrukcje konkretnych urządzeń, odstępy od drewna i koron oraz projekt podłoża.',
  'Wariant 2: meble i konstrukcje mają nominalne gabaryty w metrach, bez wskazania producenta. Jacuzzi Ø2,4 m, sauna 2,5 × 3 m, pergola 5 × 7 m, szklarnia 4,14 × 3,2 m, grządki 2,4 × 1,2 m. Posadowienie i instalacje nie są zaprojektowane.',
  'Wariant 2: hortensja Little Lime 1,5 × 1,5 m, trzcinnik Karl Foerster 1,8 × 0,6 m, lawenda Hidcote 0,5 × 1 m. To dobór interpretacyjny zdjęcia. Lawenda wymaga przepuszczalnej gleby i osłoniętego stanowiska; potwierdzić lokalną zimotrwałość.',
  'Wariant 2: dwanaście drzew owocowych z koronami Ø3,2 m i wysokością 3,5 m, rozstaw 4,2 m po boku i 6 m z tyłu. Rzeczywiste odmiany, podkładki i zapylacze należy dobrać do tych gabarytów.',
)
assert.deepEqual(p.buildings,source.buildings)
assert.deepEqual(p.site.parcels,source.site.parcels)
assert.deepEqual(p.site.fences,source.site.fences)
for(const tree of source.landscape.plants.filter(t=>t.surveyHandle))assert.deepEqual(p.landscape.plants.find(t=>t.ref===tree.ref),tree)
for(const f of p.landscape.fixtures){
  const {widthM:w,depthM:d}=gardenFixtureById(f.catalogId),a=f.rotationDegrees*Math.PI/180
  for(const v of rect(0,0,w,d)){
    const q=pt(f.position.x+v.x*Math.cos(a)+v.z*Math.sin(a),f.position.z-v.x*Math.sin(a)+v.z*Math.cos(a))
    assert(pointInPolygon(q,p.site.boundary),f.ref+' outside boundary')
    assert(!bodies.some(poly=>pointInPolygon(q,poly)),f.ref+' inside building')
  }
}
assert.deepEqual(validateProject(p).filter(i=>i.severity==='error'),[])
parseProject(p)
fs.writeFileSync(`${dir}/project.json`,JSON.stringify(p,null,2)+'\n','utf8')
if(!fs.existsSync(`${dir}/initial-r1.json`))fs.copyFileSync(`${dir}/project.json`,`${dir}/initial-r1.json`,fs.constants.COPYFILE_EXCL)
console.log({project:p.ref,revision:p.revision,fixtures:p.landscape.fixtures.length,newBorderPlants:planted.length,lawnM2:lawn.area(),lawnParts:parts.length})
