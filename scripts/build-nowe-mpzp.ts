/** Reproducible first publication; never replace a later working copy or migration baseline. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { parseProject } from '../src/domain/schema'
import { validateProject } from '../src/domain/commands'
import { polygonArea, polygonBounds, buildingFootprintsWorld, pointInPolygon, rectangle } from '../src/domain/geometry'
import { roofWings, gableRoofJunction } from '../src/domain/roofWings'
import { DRAFT_PLAN_VERSION, draftZoningLine } from '../knowledge-bank/zielonki/draftPlan'
import type { BuildingModel, Polygon2, Vec2, WallModel } from '../src/domain/types'

const dir = 'project-data/nowe-mpzp'
if (existsSync(`${dir}/project.json`)) throw Error('First-publication builder: preserve the existing project and baseline.')
const read = (path: string) => parseProject(JSON.parse(readFileSync(path, 'utf8')))
const source = read('project-data/architekt/project.json'), main = read('project-data/zielonki-rear-bath-room/project.json')
assert.equal(source.revision, 7, 'Recreate r1 only from the preserved architect r7, not a newer independent design.')
const project = structuredClone(source)
project.ref = 'project/nowe-mpzp'; project.name = 'nowe mpzp'; project.revision = 1; project.updatedAt = '2026-10-19T19:30:00.000Z'
const { slope, intercept } = draftZoningLine
const side = (p: Vec2) => p.z - slope * p.x - intercept
function clip(points: Polygon2, construction: boolean): Polygon2 {
  const result: Polygon2 = [], sign = construction ? 1 : -1
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length], da = side(a) * sign, db = side(b) * sign
    if (da <= 1e-9) result.push({ ...a })
    if (da * db < 0) { const t = da / (da - db); result.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) }) }
  })
  return result
}
for (const parcel of project.site.parcels) {
  const construction = clip(parcel.boundary, true), agricultural = clip(parcel.boundary, false)
  parcel.landUseZones = [
    ...(construction.length >= 3 ? [{ ref: `zoning/${parcel.cadastralNumber.replace('/', '-')}/construction`, code: '18.1.MU.1', landRole: 'construction' as const, boundary: construction, sourceRef: 'source/mpzp-draft-2026-10-19', geometryConfidence: 'derived' as const }] : []),
    ...(agricultural.length >= 3 ? [{ ref: `zoning/${parcel.cadastralNumber.replace('/', '-')}/agricultural`, code: '18.R3.1', landRole: 'agricultural' as const, boundary: agricultural, sourceRef: 'source/mpzp-draft-2026-10-19', geometryConfidence: 'derived' as const }] : []),
  ]
  parcel.landRole = parcel.landUseZones.length === 2 ? 'mixed' : parcel.landUseZones[0].landRole
  assert.ok(Math.abs(parcel.landUseZones.reduce((s, z) => s + polygonArea(z.boundary), 0) - polygonArea(parcel.boundary)) < 1e-6)
}
const knowledge = project.site.knowledgeBase
knowledge.datasetVersion = DRAFT_PLAN_VERSION
knowledge.sources.push({ ref: 'source/mpzp-draft-2026-10-19', title: 'Zielonki — projekt MPZP, wyłożenie 19.10–10.11.2026', date: '2026-10-19', kind: 'planning-document', authority: 'official', url: 'https://bip.malopolska.pl/gzielonki,m,478626,zielonki.html', summary: 'Rysunek: plik 4273326; tekst: 4273429. Koncepcyjne odwzorowanie granicy 18.1.MU.1 / 18.R3.1 według siatki PL-2000 PDF, nie granica ewidencyjna ani uchwalony plan.' })
knowledge.designRules = knowledge.designRules.filter(r => !/mpzp|zoning/i.test(r.sourceRef))
knowledge.designRules.push({ rule: 'Koncepcja według wyłożenia: 18.1.MU.1; dachy 37–45°, dom do 9 m, garaż/gospodarczy do 6 m; zabudowa maks. 40%, biologicznie czynne min. 50%.', basis: 'Projekt MPZP, §21; ostateczny projekt i pomiar wysokości wymagają weryfikacji architekta.', sourceRef: 'source/mpzp-draft-2026-10-19' })
knowledge.caveats.unshift('NOWE MPZP: osobna koncepcja według wyłożenia z 19.10.2026, nie plan obowiązujący. Granica przeznaczenia odtworzona z PDF; przyjęty bufor 0,75 m nie jest odległością ustawową. Sprawdzić mapę do celów projektowych, linię zabudowy, ochronę pożarową, wjazd i hałas warsztatu. Wiata jak w Głównym pozostaje koncepcją do oceny.')

const house = project.buildings[0], oldPosition = { ...house.position }
const world = (building: BuildingModel, p: Vec2): Vec2 => {
  const angle = building.rotationDegrees * Math.PI / 180
  return { x: building.position.x + p.x * Math.cos(angle) + p.z * Math.sin(angle), z: building.position.z - p.x * Math.sin(angle) + p.z * Math.cos(angle) }
}
const roofEnvelope = (building: BuildingModel) => building.roof.segments.flatMap(s => {
  const b = polygonBounds(s.footprint)
  return rectangle({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }, b.maxX - b.minX + s.overhangM * 2, b.maxZ - b.minZ + s.overhangM * 2).map(p => world(building, p))
})
const shift = Math.min(...roofEnvelope(house).map(p => -side(p))) - 0.75 * Math.hypot(1, slope)
assert.ok(shift > 0)
house.position.z += shift
house.name = 'Dom · nowe mpzp'
house.interiorSource!.notes.push(`Kopia architekt r${source.revision}; przesunięcie w stronę ogrodu +${shift.toFixed(3)} m w osi z, bez zmiany wnętrza i dachów.`)

const carport = structuredClone(main.buildings.find(b => b.ref === 'building/south-carport')!)
carport.position.x += house.position.x - main.buildings[0].position.x
carport.position.z += house.position.z - main.buildings[0].position.z
carport.name = 'Wiata z tyłu · 2 samochody · jak Główny'

const oldOutbuilding = project.buildings.find(b => b.ref === 'building/garden-outbuilding')!
const garage: BuildingModel = {
  ref: oldOutbuilding.ref, name: 'Garaż kampera + warsztat stolarski', kind: 'garage', architecturalStyle: 'barn', designStatus: 'concept',
  position: { x: 11.5, z: -4.2 }, rotationDegrees: 0,
  storeys: [{ ref: 'storey/outbuilding', name: 'Kamper i stolarnia', level: 0, elevationM: 0.2, clearHeightM: 3.75, baseSlabRef: 'slab/outbuilding', topBoundaryRef: 'roof/outbuilding', wallRefs: [], spaceRefs: [], platformRefs: [], ceilingFinishRefs: [] }],
  slabs: [{ ref: 'slab/outbuilding', footprint: rectangle({ x: 0, z: 0 }, 5.1, 13.2), topElevationM: 0.2, thicknessM: 0.2, locked: false, edgeColorHex: '#3B403F' }],
  walls: [], spaces: [], platforms: [], ceilingFinishes: [], furniture: [],
  roof: { ref: 'roof/outbuilding', type: 'gable', baseElevationM: 3.95, pitchDegrees: 37, overhangM: 0.6, finish: structuredClone(house.roof.finish), segments: [], junctions: [] },
  interiorSource: { id: 'nowe-mpzp-camper-workshop-2026-10-19', notes: ['Zastępuje wcześniejszy budynek koncepcyjny w polu tylko w tym podprojekcie.', 'Światło stanowiska 4,50 × 9,00 m; brama 3,50 × 3,50 m; warsztat 4,50 × 3,30 m. Kamper referencyjny 7,40 × 2,35 × 3,10 m.'] },
}
const floor = garage.storeys[0], wallFinish = { material: 'charred-timber' as const, colorHex: '#242927' }
const wall = (id: string, a: Vec2, b: Vec2): WallModel => {
  const w: WallModel = { ref: `wall/outbuilding/${id}`, start: a, end: b, thicknessM: 0.3, baseElevationM: 0.2, heightM: 3.75, openings: [], locked: false, finish: { ...wallFinish } }
  garage.walls.push(w); floor.wallRefs.push(w.ref); return w
}
const pt = (x: number, z: number) => ({ x, z })
const front = wall('front', pt(-2.4, -6.45), pt(2.4, -6.45))
const east = wall('camper-east', pt(2.4, -6.45), pt(2.4, 2.85))
const partition = wall('partition', pt(2.4, 2.85), pt(-2.4, 2.85))
const west = wall('camper-west', pt(-2.4, 2.85), pt(-2.4, -6.45))
const workshopEast = wall('workshop-east', pt(2.4, 2.85), pt(2.4, 6.45))
const back = wall('back', pt(2.4, 6.45), pt(-2.4, 6.45))
const workshopWest = wall('workshop-west', pt(-2.4, 6.45), pt(-2.4, 2.85))
front.openings.push({ ref: 'opening/outbuilding/camper-gate', kind: 'door', wallRef: front.ref, offsetM: 2.4, widthM: 3.5, heightM: 3.5, sillM: 0, swing: 'out' })
partition.openings.push({ ref: 'opening/outbuilding/workshop-access', kind: 'door', wallRef: partition.ref, offsetM: 1.6, widthM: 0.9, heightM: 2.1, sillM: 0 })
workshopWest.openings.push({ ref: 'opening/outbuilding/workshop-door', kind: 'door', wallRef: workshopWest.ref, offsetM: 2.7, widthM: 0.9, heightM: 2.1, sillM: 0, swing: 'out' })
back.openings.push({ ref: 'opening/outbuilding/workshop-window', kind: 'window', wallRef: back.ref, offsetM: 2.4, widthM: 2.4, heightM: 1.2, sillM: 1.2 })
for (const [id, name, usage, walls] of [
  ['camper', 'Garaż kampera · 4,50 × 9,00 m', 'garage', [front, east, partition, west]],
  ['workshop', 'Warsztat stolarski · 14,85 m²', 'workshop', [partition, workshopEast, back, workshopWest]],
] as const) {
  const ref = `space/outbuilding/${id}`; floor.spaceRefs.push(ref)
  garage.spaces.push({ ref, name, usage, boundary: walls.map((w, i) => ({ wallRef: w.ref, direction: id === 'workshop' && i === 0 ? -1 : 1 })), baseSlabRef: 'slab/outbuilding', topBoundaryRef: 'roof/outbuilding', locked: false, floorFinish: { presetId: 'concrete', color: '#A9AAA4', rotationDegrees: 0, tileM: 1 } })
}
garage.roof.footprint = rectangle({ x: 0, z: 0 }, 4.8, 12.9)
garage.roof.segments.push({ ref: 'roof/outbuilding/gable', footprint: structuredClone(garage.roof.footprint), storeyRef: floor.ref, baseElevationM: 3.95, type: 'gable', pitchDegrees: 37, overhangM: 0.6, ridgeDirection: 'z', finish: structuredClone(house.roof.finish), adjacentSegmentRefs: [], gableWallFinishes: { min: { ...wallFinish }, max: { ...wallFinish } } })
for (const id of ['camper', 'workbench', 'tool-storage', 'timber-rack']) garage.furniture!.push(structuredClone(oldOutbuilding.furniture!.find(i => i.ref === `interior/outbuilding/${id}`)!))
Object.assign(garage.furniture![0], { position: pt(0, -1.8), rotationDegrees: 180 })
Object.assign(garage.furniture![1], { position: pt(0, 5.85), widthM: 2.4, depthM: 0.8, rotationDegrees: 0 })
Object.assign(garage.furniture![2], { position: pt(1.95, 4.5), widthM: 0.5, depthM: 2.1, rotationDegrees: 0 })
Object.assign(garage.furniture![3], { position: pt(-1.95, 4.85), widthM: 0.5, depthM: 1.9, rotationDegrees: 0 })
project.buildings = [house, carport, garage]

// The earlier remote camper/SPA proposal is superseded in this new variant; the source remains intact.
project.landscape.fixtures = project.landscape.fixtures.filter(f => !f.ref.startsWith('fixture/outbuilding/'))
project.landscape.zones = project.landscape.zones.filter(z => !z.ref.startsWith('zone/outbuilding/') && !/parking-entry|parking-courtyard/.test(z.ref))
for (const z of project.landscape.zones) {
  if (z.ref === 'zone/path') continue
  z.footprint = z.footprint.map(p => ({ x: p.x, z: p.z > -15 ? p.z + shift : p.z }))
  if (z.ref === 'zone/driveway') z.footprint = z.footprint.map(p => ({ ...p, x: Math.max(p.x, (p.z >= 10.53 ? -18.403 : -19.778 + (p.z + 15.1) * 1.375 / 25.63) + 0.05) }))
}
const canopyPad = buildingFootprintsWorld(carport)[0]
project.landscape.zones.push({ ref: 'zone/nowe-mpzp/carport-access', name: 'Dojazd do tylnej wiaty', kind: 'driveway', footprint: [pt(Math.min(...canopyPad.map(p => p.x)), -15), pt(Math.max(...canopyPad.map(p => p.x)), -15), ...[...canopyPad].sort((a,b) => b.z-a.z).slice(0,2).sort((a,b) => b.x-a.x)], locked: false, textureId: 'concrete-tiles' })
project.landscape.zones.push({ ref: 'zone/outbuilding/apron', name: 'Wjazd kampera · brama 3,50 m', kind: 'driveway', footprint: rectangle(pt(11.5, -13.1), 5.1, 4.6), locked: false, textureId: 'concrete-tiles' })
const proposedTreeRemovals: string[] = []
project.landscape.plants = project.landscape.plants.filter(plant => {
  if (plant.placementRole === 'context') return true
  const clash = project.buildings.some(b => buildingFootprintsWorld(b).some(poly => pointInPolygon(plant.position, poly)))
  if (clash) proposedTreeRemovals.push(plant.ref)
  return !clash
})
knowledge.caveats.push(`Drzewa kolidujące z koncepcją, wyłączone wyłącznie z tego wariantu: ${proposedTreeRemovals.join(', ') || 'brak'}. Oryginały w source-architekt-r7.json; to nie zezwolenie na wycinkę.`)

const parsed = parseProject(project), errors = validateProject(parsed).filter(i => i.severity === 'error')
assert.deepEqual(errors, [])
assert.ok(project.buildings.every(b => roofEnvelope(b).every(p => side(p) <= 1e-6)))
assert.equal(validateProject(parsed).filter(i => i.code === 'building.zoning').length, 0)
assert.deepEqual(validateProject(parsed).filter(i => i.subjectRef?.includes('outbuilding')), [])
const wings = roofWings(house)
assert.ok(wings.every(w => { const b=polygonBounds(w.footprint), span=w.ridgeAxis==='z'?b.maxX-b.minX:b.maxZ-b.minZ; const pitch=Math.atan2(w.ridgeElevationM-w.baseElevationM,span/2)*180/Math.PI; return pitch>=37&&pitch<=45 }))
assert.ok(Math.abs(wings[0].ridgeElevationM-wings[1].ridgeElevationM)<1e-8)
assert.ok(gableRoofJunction(house,wings[1]))
assert.ok(roofWings(garage)[0].ridgeElevationM < 6)
mkdirSync(dir, { recursive: true })
writeFileSync(`${dir}/source-architekt-r7.json`, readFileSync('project-data/architekt/project.json'), { flag: 'wx' })
for (const file of ['project.json', 'initial-r1.json']) writeFileSync(`${dir}/${file}`, JSON.stringify(parsed,null,2)+'\n', {flag:'wx'})
console.log(JSON.stringify({shift,oldPosition,newPosition:house.position,constructionArea:project.site.parcels.flatMap(p=>p.landUseZones!).filter(z=>z.landRole==='construction').reduce((s,z)=>s+polygonArea(z.boundary),0),mainRoofs:wings,garageRoof:roofWings(garage),proposedTreeRemovals,warnings:validateProject(parsed).filter(i=>i.severity==='warning')},null,2))
