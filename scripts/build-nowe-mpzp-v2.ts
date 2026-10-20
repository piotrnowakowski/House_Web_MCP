import fs from 'node:fs'
import assert from 'node:assert/strict'
import Module from 'manifold-3d'
import { CatmullRomCurve3, Vector3 } from 'three'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon, polygonArea } from '../src/domain/geometry'
import { gardenFixtureById } from '../src/domain/gardenFixtures'
import type { GardenFixtureCatalogId, GardenZoneKind, PlantModel, Vec2 } from '../src/domain/types'

const dir = 'project-data/nowe-mpzp-v2'
fs.mkdirSync(dir, { recursive: true })
const sourceFile = `${dir}/source-nowe-mpzp-r19.json`
if (!fs.existsSync(sourceFile)) fs.copyFileSync('project-data/nowe-mpzp/project.json', sourceFile, fs.constants.COPYFILE_EXCL)
const source = parseProject(JSON.parse(fs.readFileSync(sourceFile, 'utf8'))), p = structuredClone(source)
assert.equal(source.revision, 19)
p.ref = 'project/nowe-mpzp-v2'; p.name = 'nowe mpzp — wariant 2'; p.revision = 6; p.updatedAt = '2026-10-20T23:23:14.000Z'
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
],'hinoki')
fixture('terrace-lounge','garden-lounge-set','Wypoczynek na tarasie · 3,8 × 3,1 m',-5.1,9.45,180)
fixture('terrace-dining','outdoor-dining-set','Stół tarasowy z sześcioma krzesłami · 3,4 × 2,5 m',-11.0,7.65,0)
const fire=p.landscape.fixtures.find(f=>f.catalogId==='round-fire-lounge')!
fire.position=pt(11.8,5.3)
zone('zone/nowe-mpzp/garden/fire-court','Palenisko · placyk Ø6 m','terrace',circle(11.8,5.3,3),'river-pebbles')
zone('zone/nowe-mpzp/garden/house-fire-path','Łukowe dojście od tarasu · 1,4 m','path',curve([[-.5,10.2],[3.5,11.4],[7.8,10.8],[11.8,8.2]],1.4),'river-pebbles')
zone('zone/nowe-mpzp/garden/garden-path','Dojście do kuchni letniej · 1,4 m','path',curve([[7.6,10.8],[9.5,11.7],[11,13],[11.3,14.5]],1.4),'river-pebbles')

zone(zref('summer-deck'),'Drewniany pomost kuchni, jacuzzi i sauny · 7,8 × 17 m','terrace',rect(11.9,22,7.8,17),'hinoki')
fixture('pergola','kitchen-spa-retractable','Wiata kuchni i spa · rozsuwany dach nad jacuzzi · R3, lokalizacja warunkowa',12.0,21.8)
fixture('kitchen','outdoor-kitchen','Grill, zlew i blat · 3,6 × 0,8 m',14.2,18.0,-90)
fixture('pizza','pizza-oven-tall-flue','Piec do pizzy z tyłu kuchni · komin 4,2 m · koncepcja',14.2,21.6,-90)
fixture('summer-table','outdoor-dining-set','Stół kuchni letniej · sześć miejsc',11.5,17.9,90)
fixture('hot-tub','round-hot-tub','Jacuzzi okrągłe · Ø2,4 m',10.0,26.7,0)
fixture('sauna','garden-sauna','Sauna w naturalnym drewnie · 2,5 × 3 m · R3, lokalizacja warunkowa',14.0,27.0,0)

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

// Keep the existing refs so saved deletions survive the new planting palette.
const thujaTemplate = { name: 'Tuja Szmaragd · rozmiar docelowy', species: "Thuja occidentalis 'Smaragd'", kind: 'hedge', crownShape: 'conical',
  matureHeightM: 4.6, canopyM: 1.3, sunNeed: 'sun', waterNeed: 0.7, hardinessMinC: -28, leafMonths: [1,2,3,4,5,6,7,8,9,10,11,12], bloomMonths: [] }
for (let group = 0; group < 9; group++) {
  const anchor = p.landscape.plants.find(t => t.ref === `plant/nowe-mpzp-v2/east-border-${group * 3 + 1}`)!
  const { x, z } = anchor.position
  Object.assign(anchor, thujaTemplate)
  for (let member = 0; member < 3; member++) {
    const ref = member < 2 ? `plant/nowe-mpzp-v2/east-border-${group * 3 + member + 2}` : `plant/nowe-mpzp-v2/east-grass-group-${group + 1}`
    const grass = { ...templates[1], ref, position: pt(x + (member === 2 ? 0.25 : -0.35), z + [1.6, 2.6, 2.1][member]), locked: false, placementRole: 'site' as const }
    const existing = p.landscape.plants.find(t => t.ref === ref)
    if (existing) Object.assign(existing, grass)
    else p.landscape.plants.push(grass)
  }
}

// Keep tall conifers at the ends, leaving the glazing and vegetable rows open to the garden.
const grassAccents = new Set(['terrace-front-4','terrace-front-7','vegetable-left-4','vegetable-left-10','vegetable-left-13','vegetable-front-1','vegetable-front-4'].map(ref=>`plant/nowe-mpzp-v2/${ref}`))
for (const plant of p.landscape.plants) {
  if (!plant.ref.startsWith('plant/nowe-mpzp-v2/') || !/^(Hydrangea|Lavandula)/.test(plant.species)) continue
  Object.assign(plant, plant.species.startsWith('Hydrangea') && !grassAccents.has(plant.ref) ? thujaTemplate : templates[1])
}

// Remove only the red-marked conifers and the five rear orchard trees.
const removedTrees = p.landscape.plants.filter(t =>
  (t.species.startsWith('Thuja ') && /\/(terrace-|spa-|vegetable-)/.test(t.ref)) ||
  /^plant\/nowe-mpzp\/fruit-(08|09|10|11|12)$/.test(t.ref))
p.landscape.plants = p.landscape.plants.filter(t => !removedTrees.includes(t))
p.landscape.zones = p.landscape.zones.filter(z => !/fruit-mulch-(8|9|10|11|12)$/.test(z.ref))
const fenceThujas = p.landscape.plants.filter(t => t.species.startsWith('Thuja ') && /\/(west|east|rear)-border-/.test(t.ref))
const west = fenceThujas.filter(t => t.ref.includes('/west-')).sort((a,b)=>a.position.z-b.position.z)
const east = fenceThujas.filter(t => t.ref.includes('/east-')).sort((a,b)=>a.position.z-b.position.z)
const rear = fenceThujas.filter(t => t.ref.includes('/rear-')).sort((a,b)=>a.position.x-b.position.x)
for (const row of [west, east, [west.at(-1)!, ...rear, east.at(-1)!]]) {
  for (let i=1;i<row.length;i++) {
    const a=row[i-1], b=row[i], distance=Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)
    if (distance>8) continue // Preserve the seven unmarked fruit trees beside the east fence.
    const steps=Math.ceil(distance/.95)
    for(let j=1;j<steps;j++) p.landscape.plants.push({
      ...structuredClone(a), ref:`${a.ref}-infill-${j}`, name:'Tuja Szmaragd · gęsty szpaler',
      position:pt(a.position.x+(b.position.x-a.position.x)*j/steps,a.position.z+(b.position.z-a.position.z)*j/steps),
    })
  }
}
const hedge = p.landscape.plants.filter(t => t.species.startsWith('Thuja '))
for (const grass of p.landscape.plants.filter(t=>t.kind==='grass')) {
  if (!hedge.some(t=>Math.hypot(t.position.x-grass.position.x,t.position.z-grass.position.z)<(t.canopyM+grass.canopyM)/2+.05)) continue
  const normal = grass.ref.includes('/west-') ? [1,0] : /\/(east-border|east-grass)/.test(grass.ref) ? [-1,0] : [0,-1]
  const original=grass.position
  let found=false
  for(const offset of [.7,.9,1.1,1.3,1.5,1.7,1.9]) {
    for(const along of [0,.35,-.35,.7,-.7,1.05,-1.05,1.4,-1.4,1.75,-1.75,2.1,-2.1,2.8,-2.8]) {
      const q=pt(original.x+normal[0]*offset-normal[1]*along,original.z+normal[1]*offset+normal[0]*along)
      if(!pointInPolygon(q,p.site.boundary)||edgeDistance(q,p.site.boundary)<grass.canopyM/2+.25)continue
      if(obstacles.some(poly=>pointInPolygon(q,poly)||edgeDistance(q,poly)<grass.canopyM/2+.15))continue
      if(p.landscape.plants.some(t=>t!==grass&&Math.hypot(t.position.x-q.x,t.position.z-q.z)<(t.canopyM+grass.canopyM)/2+.05))continue
      grass.position=q;found=true;break
    }
    if(found)break
  }
  assert(found,'No clear grass position: '+grass.ref)
}

// Keep the published lawn pieces and fill only the removed tree basins and oven pad.
const beforeGarden = parseProject(JSON.parse(fs.readFileSync(`${dir}/before-garden-refine-r5.json`, 'utf8')))
p.landscape.zones.push(...structuredClone(beforeGarden.landscape.zones.filter(z=>z.kind==='lawn')))
for(const removed of beforeGarden.landscape.zones.filter(z=>/fruit-mulch-(8|9|10|11|12)$/.test(z.ref)||z.ref===zref('oven-pad')))
  zone(`${removed.ref}-lawn-infill`,'Trawnik po usuniętym drzewie lub podeście','lawn',structuredClone(removed.footprint),'leafy-grass')
for(const lawnZone of p.landscape.zones.filter(z=>z.kind==='lawn')) lawnZone.colorHex='#B7D7A5'

p.site.knowledgeBase.sources.push({
  ref:'source/nowe-mpzp-v2-reference',title:'Ilustracja użytkownika — ogród, koncepcja zagospodarowania',date:'2026-10-20',kind:'user-direction',authority:'user-provided',
  summary:'Osobny wariant 2 na bazie nowe mpzp r19. Układ stref odtworzony na rzeczywistym obrysie. Ilustracja bez skali i listy gatunków; gabaryty wyposażenia nominalne, rozmiary roślin docelowe.',
})
p.site.knowledgeBase.caveats=p.site.knowledgeBase.caveats.filter(c=>!/^Ogród r14:/.test(c))
p.site.knowledgeBase.caveats.push(
  'Wariant 2: ilustracja bez skali. Dom, garaż, wiata, granice, ogrodzenie i 11 drzew geodezyjnych zachowane z r19. Ogród dostosowany do rzeczywistych metrów, bez skalowania budynków i miniaturyzacji drzew.',
  'Wariant 2: sauna, wiata kuchni i spa oraz szklarnia w 18.R3.1 są lokalizacjami warunkowymi. Projekt planu §37 zakazuje nowych budynków; to odtworzenie zamówionej koncepcji, nie potwierdzenie dopuszczalności realizacji.',
  'Wariant 2 r6: piec do pizzy z tyłu kuchni letniej ma pionowy komin pokazany do 4,2 m, z przejściem przez stałą część dachu. To koncepcja przebiegu: średnica, ciąg, izolacja, odstępy od drewna i roślin, wylot oraz niepalne podłoże wymagają projektu do konkretnego urządzenia. Palenisko i piec pokazano bez ognia.',
  'Wariant 2: meble i konstrukcje mają nominalne gabaryty w metrach, bez wskazania producenta. Jacuzzi Ø2,4 m, sauna 2,5 × 3 m, wiata 7,4 × 15,2 × 3,1 m, szklarnia 4,14 × 3,2 m, grządki 2,4 × 1,2 m. Posadowienie i instalacje nie są zaprojektowane.',
  `Wariant 2 r6: usunięto 11 zaznaczonych tui przy tarasie, wiacie i warzywniku oraz pięć tylnych drzew owocowych. Pozostałe tuje przy płocie zagęszczono do ok. 0,85–0,95 m; zachodzenie docelowych koron jest zamierzone w żywopłocie. Łącznie ${p.landscape.plants.filter(t=>t.species.startsWith('Thuja ')).length} tui (4,6 × 1,3 m) i 117 traw (1,8 × 0,6 m), z trawami przesuniętymi przed szpaler. Dobór do gleby i nasłonecznienia wymaga potwierdzenia.`,
  'Wariant 2 r6: siedem nieoznaczonych drzew owocowych po prawej zachowano z koronami Ø3,2 m, wysokością 3,5 m i rozstawem 4,2 m. Rzeczywiste odmiany, podkładki i zapylacze należy dobrać do tych gabarytów.',
  'Wariant 2 r6: nad jacuzzi otwór 2,9 × 3,85 m z rozsuwaną osłoną na prowadnicach; reszta wiaty ma pełny dach. Przycisk po wybraniu wiaty zmienia tylko podgląd otwarcia, domyślnie odsłonięty. Konstrukcja, odwodnienie i odporność na wiatr/śnieg wymagają projektu wykonawczego. Drewno, meble i sauna zachowują poprzedni układ i wykończenie.',
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
console.log({project:p.ref,revision:p.revision,fixtures:p.landscape.fixtures.length,newBorderPlants:planted.length,lawnM2:p.landscape.zones.filter(z=>z.kind==='lawn').reduce((sum,z)=>sum+polygonArea(z.footprint),0),lawnParts:p.landscape.zones.filter(z=>z.kind==='lawn').length})
