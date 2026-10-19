import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import initial from '../../project-data/nowe-mpzp/initial-r1.json'
import previous from '../../project-data/nowe-mpzp/before-boundary-alignment-r2.json'
import architect from '../../project-data/architekt/project.json'
import source from '../../project-data/nowe-mpzp/source-architekt-r7.json'
import main from '../../project-data/zielonki-rear-bath-room/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonArea, polygonBounds, buildingFootprintsWorld, distanceToSegment } from '../domain/geometry'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { roomDimensions } from '../domain/roomDimensions'
import { landUseAreas } from '../domain/zoning'
import { DRAFT_PLAN_VERSION, draftZoningBoundary, draftZoningLine } from '../../knowledge-bank/zielonki/draftPlan'
import { loadWorkspace, saveWorkspace, deleteWorkspace, listWorkspaces, synchronizePublishedProject } from './persistence'
import { NOWE_MPZP_REF, synchronizePublishedNoweMpzp } from './publishedNoweMpzp'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('moves only the independent house, preserves cadastral parcels and contains roofs in the draft construction zone', () => {
  const p = parseProject(data), house = p.buildings[0], base = parseProject(source)
  expect(p.ref).toBe(NOWE_MPZP_REF)
  expect(p.site.boundary).toEqual(base.site.boundary)
  expect(p.site.parcels.map(({ref,boundary,officialAreaM2})=>({ref,boundary,officialAreaM2}))).toEqual(base.site.parcels.map(({ref,boundary,officialAreaM2})=>({ref,boundary,officialAreaM2})))
  expect(house.position.z-base.buildings[0].position.z).toBeCloseTo(4.3284132811)
  for (const key of ['walls','slabs','spaces','storeys','furniture','roof'] as const) expect(house[key]).toEqual(base.buildings[0][key])
  expect(validateProject(p).filter(i=>i.severity==='error'||i.code==='building.zoning')).toEqual([])
  expect(landUseAreas(p).filter(z=>z.landRole==='construction').reduce((sum,z)=>sum+polygonArea(z.boundary),0)).toBeCloseTo(888.806452)
  const {slope,intercept}=draftZoningLine
  expect(draftZoningBoundary.every(p=>Math.abs(p.z-slope*p.x-intercept)<1e-8)).toBe(true)
  for (const b of p.buildings) for (const polygon of buildingFootprintsWorld(b)) for (const point of polygon) expect(point.z-slope*point.x-intercept).toBeLessThan(0)
  const carport=p.buildings.find(b=>b.ref==='building/south-carport')!
  expect(carport.roof).toEqual(parseProject(main).buildings.find(b=>b.ref===carport.ref)!.roof)
  const wings=roofWings(house)
  for (const wing of wings) {
    const b=polygonBounds(wing.footprint), span=wing.ridgeAxis==='z'?b.maxX-b.minX:b.maxZ-b.minZ
    const angle=Math.atan2(wing.ridgeElevationM-wing.baseElevationM,span/2)*180/Math.PI
    expect(angle).toBeGreaterThanOrEqual(37); expect(angle).toBeLessThanOrEqual(45)
  }
  expect(wings[0].ridgeElevationM).toBeCloseTo(wings[1].ridgeElevationM,8)
  expect(gableRoofJunction(house,wings[1])?.side).toBe('min')
  expect(gableWallsForBuilding(house).some(w=>w.segmentRef===wings[1].ref&&w.side==='min')).toBe(false)
})

it('fits the camper, working room and entrance below the six metre conceptual height limit', () => {
  const p=parseProject(data), garage=p.buildings.find(b=>b.ref==='building/garden-outbuilding')!
  expect(garage.rotationDegrees+180).toBeCloseTo(p.buildings[0].rotationDegrees,10)
  expect(polygonArea(garage.slabs[0].footprint)).toBeCloseTo(67.32)
  const footprint=buildingFootprintsWorld(garage)[0]
  const setbacks=[
    {minimum:4,line:[{x:18.21,z:-15.861},{x:18.591,z:-6.318},{x:19.477,z:15.883}]},
    {minimum:3,line:[{x:-19.778,z:-15.1},{x:8.7,z:-16.628},{x:8.77,z:-15.63},{x:18.21,z:-15.861}]},
  ]
  for (const {minimum,line} of setbacks) expect(Math.min(...footprint.flatMap(point=>line.slice(1).map((end,i)=>distanceToSegment(point,line[i],end))))).toBeCloseTo(minimum,8)
  const gate=garage.walls.flatMap(w=>w.openings).find(o=>o.ref==='opening/outbuilding/camper-gate')!
  expect([gate.widthM,gate.heightM]).toEqual([3.5,3.5])
  const camperRoom=roomDimensions(garage,garage.spaces.find(s=>s.usage==='garage')!)
  expect(Math.min(camperRoom.width,camperRoom.depth)).toBeCloseTo(4.5)
  expect(Math.max(camperRoom.width,camperRoom.depth)).toBeCloseTo(9)
  const workshop=roomDimensions(garage,garage.spaces.find(s=>s.usage==='workshop')!)
  expect(workshop.width*workshop.depth).toBeCloseTo(14.85)
  expect(roofWings(garage)[0].ridgeElevationM).toBeCloseTo(5.75852972)
  const garageWing=roofWings(garage)[0], bounds=polygonBounds(garageWing.footprint)
  expect(Math.atan2(garageWing.ridgeElevationM-garageWing.baseElevationM,(bounds.maxX-bounds.minX)/2)*180/Math.PI).toBeCloseTo(37,8)
  expect(roofWings(garage)[0].ridgeElevationM).toBeLessThan(6)
  expect(validateProject(p).filter(i=>i.subjectRef?.includes('outbuilding'))).toEqual([])
})

it('keeps draft zoning and user deletions through list, reload and a later published merge without changing architekt', async () => {
  const original={version:1 as const,project:parseProject(architect),proposals:[],draftChangeSets:[]}
  original.project.name='Mój architekt'; original.project.landscape.plants.pop()
  await saveWorkspace(original)
  expect(await synchronizePublishedProject(parseProject(previous),parseProject(initial))).toEqual([])
  const w=(await loadWorkspace(NOWE_MPZP_REF))!, removed=w.project.landscape.plants.pop()!.ref
  w.project.name='Moje nowe mpzp'; await saveWorkspace(w); await listWorkspaces()
  expect(await synchronizePublishedNoweMpzp()).toEqual([])
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[2].position).toEqual(data.buildings[2].position)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[2].rotationDegrees).toBe(data.buildings[2].rotationDegrees)
  const next=parseProject(data); next.revision++; next.buildings[2].name='Garaż i warsztat — opis'
  expect(await synchronizePublishedProject(next,parseProject(data))).toEqual([])
  const saved=(await loadWorkspace(NOWE_MPZP_REF))!
  expect(saved.project.site.knowledgeBase.datasetVersion).toBe(DRAFT_PLAN_VERSION)
  expect(saved.project.site.parcels).toEqual(data.site.parcels)
  expect(saved.project.landscape.plants.some(p=>p.ref===removed)).toBe(false)
  expect(saved.project.name).toBe('Moje nowe mpzp')
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  await deleteWorkspace(NOWE_MPZP_REF); await synchronizePublishedNoweMpzp()
  expect(await loadWorkspace(NOWE_MPZP_REF)).toBeNull()
})
