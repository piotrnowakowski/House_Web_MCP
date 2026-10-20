import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/nowe-mpzp/project.json'
import initial from '../../project-data/nowe-mpzp/initial-r1.json'
import previous from '../../project-data/nowe-mpzp/before-front-frame-r10.json'
import beforeSide from '../../project-data/nowe-mpzp/before-black-side-r12.json'
import beforeWindows from '../../project-data/nowe-mpzp/before-full-height-windows-r11.json'
import beforeTrees from '../../project-data/nowe-mpzp/before-tree-review-r9.json'
import architect from '../../project-data/architekt/project.json'
import source from '../../project-data/nowe-mpzp/source-architekt-r7.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonArea, polygonBounds, buildingFootprintsWorld, distanceToSegment, pointInPolygon } from '../domain/geometry'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { roomDimensions } from '../domain/roomDimensions'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { zielonkiSurveyTrees, surveyTreePosition, surveyTreeRef } from '../../knowledge-bank/zielonki/trees'
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
  for (const key of ['spaces','storeys','furniture'] as const) expect(house[key]).toEqual(base.buildings[0][key])
  expect(house.slabs.map(({edgeColorHex,...slab})=>slab)).toEqual(base.buildings[0].slabs.map(({edgeColorHex,...slab})=>slab))
  expect(house.walls.map(({finish,heightM,openings,...wall})=>wall)).toEqual(base.buildings[0].walls.map(({finish,heightM,openings,...wall})=>wall))
  expect(house.roof.junctions).toEqual(base.buildings[0].roof.junctions)
  expect(validateProject(p).filter(i=>i.severity==='error'||i.code==='building.zoning')).toEqual([])
  expect(landUseAreas(p).filter(z=>z.landRole==='construction').reduce((sum,z)=>sum+polygonArea(z.boundary),0)).toBeCloseTo(888.806452)
  const {slope,intercept}=draftZoningLine
  expect(draftZoningBoundary.every(p=>Math.abs(p.z-slope*p.x-intercept)<1e-8)).toBe(true)
  for (const b of p.buildings) for (const polygon of buildingFootprintsWorld(b)) for (const point of polygon) expect(point.z-slope*point.x-intercept).toBeLessThan(0)
  const carport=p.buildings.find(b=>b.ref==='building/south-carport')!
  expect(polygonArea(carport.slabs[0].footprint)).toBeCloseTo(42.24)
  expect(carport.furniture?.filter(f=>f.catalogId==='car')).toHaveLength(2)
  const posts=carport.roof.segments[0].canopy!, postBounds=polygonBounds(posts.posts)
  expect(postBounds.maxX-postBounds.minX-posts.postWidthM).toBeGreaterThanOrEqual(6)
  const canopyRoof=carport.roof.segments[0]
  expect(canopyRoof.baseElevationM+.24-posts.fasciaHeightM-carport.slabs[0].topElevationM).toBeCloseTo(3.54)
  expect(p.landscape.zones.filter(z=>z.kind==='driveway')).toHaveLength(1)
  expect(p.landscape.zones.some(z=>['zone/path','zone/nowe-mpzp/carport-access','zone/outbuilding/apron'].includes(z.ref))).toBe(false)
  const angle=house.rotationDegrees*Math.PI/180
  const local=(v:{x:number,z:number})=>({x:(v.x-house.position.x)*Math.cos(angle)-(v.z-house.position.z)*Math.sin(angle),z:(v.x-house.position.x)*Math.sin(angle)+(v.z-house.position.z)*Math.cos(angle)})
  const canopy=polygonBounds(buildingFootprintsWorld(carport)[0].map(local)), home=polygonBounds(buildingFootprintsWorld(house)[0].map(local))
  expect(home.minX-canopy.maxX).toBeCloseTo(0,8)
  expect(canopy.minZ).toBeCloseTo(home.minZ,8)
  expect(canopy.maxZ-canopy.minZ).toBeCloseTo(6.4)
  expect(carport.slabs).toEqual(previous.buildings[1].slabs)
  expect(carport.roof).toEqual(previous.buildings[1].roof)
  expect(carport.furniture).toEqual(previous.buildings[1].furniture)
  expect(carport.roof.footprint).toEqual(carport.slabs[0].footprint)
  expect(carport.roof.segments[0].footprint).toEqual(carport.slabs[0].footprint)
  const access=p.landscape.zones.find(z=>z.ref==='zone/driveway')!.footprint.map(local)
  const entrance=p.site.entrances.find(e=>e.ref==='entrance/house-road')!, gate=[entrance.start,entrance.end].map(local), driveway=polygonBounds(access)
  expect(access).toHaveLength(4)
  expect(driveway.minZ).toBeCloseTo(canopy.maxZ,8)
  expect(driveway.maxX-driveway.minX).toBeCloseTo(6.4,8)
  expect((driveway.minX+driveway.maxX)/2).toBeCloseTo((canopy.minX+canopy.maxX)/2,8)
  expect(Math.min(...gate.map(v=>v.x))).toBeCloseTo(driveway.minX,8)
  expect(Math.max(...gate.map(v=>v.x))).toBeCloseTo(driveway.maxX,8)
  for(const v of access)expect(Math.min(Math.abs(v.x-driveway.minX),Math.abs(v.x-driveway.maxX))).toBeLessThan(1e-8)
  for(const x of [-11,-6])for(const z of [0,4,10])expect(pointInPolygon({x,z},access)).toBe(true)
  // The hard surface stops at the carport; the former rear lane and garage apron stay removed.
  for(const z of [-7,-10])expect(pointInPolygon({x:-8,z},access)).toBe(false)
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
    {minimum:1.5,line:[{x:18.21,z:-15.861},{x:18.591,z:-6.318},{x:19.477,z:15.883}]},
    {minimum:1.5,line:[{x:-19.778,z:-15.1},{x:8.7,z:-16.628},{x:8.77,z:-15.63},{x:18.21,z:-15.861}]},
  ]
  for (const {minimum,line} of setbacks) expect(Math.min(...footprint.flatMap(point=>line.slice(1).map((end,i)=>distanceToSegment(point,line[i],end))))).toBeCloseTo(minimum,8)
  const rb=polygonBounds(roofWings(garage)[0].footprint),o=garage.roof.overhangM,angle=garage.rotationDegrees*Math.PI/180
  const roof=[{x:rb.minX-o,z:rb.minZ-o},{x:rb.maxX+o,z:rb.minZ-o},{x:rb.maxX+o,z:rb.maxZ+o},{x:rb.minX-o,z:rb.maxZ+o}].map(v=>({x:garage.position.x+v.x*Math.cos(angle)+v.z*Math.sin(angle),z:garage.position.z-v.x*Math.sin(angle)+v.z*Math.cos(angle)}))
  for(const {line} of setbacks)expect(Math.min(...roof.flatMap(point=>line.slice(1).map((end,i)=>distanceToSegment(point,line[i],end))))).toBeGreaterThanOrEqual(1)
  expect(garage.walls.find(w=>w.ref==='wall/outbuilding/back')!.openings).toEqual([])
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

it('preserves flush side eaves, slopes, ridge junctions and building placement around the new front frame', () => {
  const p=parseProject(data),old=parseProject(previous)
  expect(p.site.entrances).toEqual(old.site.entrances)
  expect({...p.landscape,zones:p.landscape.zones.filter(z=>z.ref!=='zone/nowe-mpzp/front-frame')}).toEqual(old.landscape)
  expect(p.buildings[1]).toEqual(old.buildings[1])
  for(const index of [0,2]){
    const b=p.buildings[index],before=old.buildings[index],halfWall=index===0?.225:.15
    expect(b.position).toEqual(before.position)
    expect(b.rotationDegrees).toBe(before.rotationDegrees)
    expect(b.roof.overhangM-halfWall).toBeCloseTo(0,10)
    expect(b.walls.map(({finish,heightM,openings,...wall})=>wall)).toEqual(before.walls.map(({finish,heightM,openings,...wall})=>wall))
    const oldWings=roofWings(before)
    for(const wing of roofWings(b)){
      const prior=oldWings.find(w=>w.ref===wing.ref)!
      expect(wing.footprint).toEqual(prior.footprint.map(v=>wing.ref==='roof/reference/rear-barn'&&v.x===4.84?{...v,x:v.x+1}:v))
      expect(wing.ridgeElevationM).toBeCloseTo(prior.ridgeElevationM,10)
      expect(wing.baseElevationM).toBe(prior.baseElevationM)
      expect(wing.overhangM-halfWall).toBeCloseTo(0,10)
      const bounds=polygonBounds(wing.footprint),span=wing.ridgeAxis==='z'?bounds.maxX-bounds.minX:bounds.maxZ-bounds.minZ
      const slope=Math.atan2(wing.ridgeElevationM-wing.baseElevationM,span/2)*180/Math.PI
      expect(slope).toBeGreaterThanOrEqual(37);expect(slope).toBeLessThanOrEqual(45)
    }
    expect(b.roof.finish).toEqual({material:'standing-seam-metal',colorHex:'#303638'})
  }
})

it('projects the living-room portal outward without moving glazing or changing any room', () => {
  const p=parseProject(data),old=parseProject(previous),house=p.buildings[0],before=old.buildings[0]
  const {roof,walls,...unchanged}=house, {roof:oldRoof,walls:oldWalls,...original}=before
  expect(walls.map(({openings,...wall})=>wall)).toEqual(oldWalls.map(({openings,...wall})=>wall))
  expect(unchanged).toEqual(original)
  expect(roof.footprint).toEqual(oldRoof.footprint?.map(v=>v.x===4.84?{...v,x:v.x+1}:v))
  expect(roof.segments[0]).toEqual(oldRoof.segments[0])
  const front=roof.segments[1]
  expect(front.gableFrame).toEqual({widthM:.4,depthM:.26,colorHex:'#181C1D'})
  expect(front.gableRecess?.max).toMatchObject({depthM:1,baseElevationM:.45,soffitColorHex:'#B78F60',sideColorHex:'#AD845B',sideExteriorColorHex:'#181C1D'})
  expect(gableWallsForBuilding(house)).toEqual(gableWallsForBuilding(before))
  expect(gableGlazingProfile(front,'max',house)).toEqual(gableGlazingProfile(oldRoof.segments[1],'max',before))
  const outline=p.landscape.zones.find(z=>z.ref==='zone/nowe-mpzp/front-frame')!.footprint
  expect(polygonArea(outline)).toBeCloseTo(7.64)
  const {slope,intercept}=draftZoningLine
  expect(Math.min(...outline.map(v=>(intercept+slope*v.x-v.z)/Math.hypot(1,slope)))).toBeGreaterThan(.4)
  for(const t of p.landscape.plants)expect(pointInPolygon(t.position,outline)).toBe(false)
})

it('matches current architect clear room dimensions and wall heights and removes the grey floor band', () => {
  const house=parseProject(data).buildings[0],reference=parseProject(architect).buildings[0]
  expect(house.walls.map(({finish,openings,...wall})=>wall)).toEqual(reference.walls.map(({finish,openings,...wall})=>wall))
  expect(house.storeys).toEqual(reference.storeys)
  const expected=parseProject(beforeWindows).buildings[0]
  for (const opening of expected.walls.flatMap(w=>w.openings)) if (['opening/reference-office-window','opening/reference-kitchen'].includes(opening.ref)) {
    opening.sillM=0; opening.heightM=2.35
  }
  expected.roof.segments[1].gableRecess!.max!.sideExteriorColorHex='#181C1D'
  expect(house).toEqual(expected)
  for(const room of house.spaces)expect(roomDimensions(house,room)).toEqual(roomDimensions(reference,reference.spaces.find(r=>r.ref===room.ref)!))
  expect(house.slabs.find(s=>s.ref==='slab/reference-upper')!.edgeColorHex).toBe('#303638')
  for(const wall of house.walls.filter(w=>w.thicknessM>=.4))expect(['natural-timber','charred-timber']).toContain(wall.finish?.material)
})

it('keeps draft zoning and user deletions through list, reload and a later published merge without changing architekt', async () => {
  const original={version:1 as const,project:parseProject(architect),proposals:[],draftChangeSets:[]}
  original.project.name='Mój architekt'; original.project.landscape.plants.pop()
  await saveWorkspace(original)
  expect(await synchronizePublishedProject(parseProject(beforeSide),parseProject(initial))).toEqual([])
  const w=(await loadWorkspace(NOWE_MPZP_REF))!, removed=w.project.landscape.plants.pop()!.ref
  w.project.name='Moje nowe mpzp'; await saveWorkspace(w); await listWorkspaces()
  expect(await synchronizePublishedNoweMpzp()).toEqual([])
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[2].position).toEqual(data.buildings[2].position)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[2].rotationDegrees).toBe(data.buildings[2].rotationDegrees)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[1].position).toEqual(data.buildings[1].position)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.landscape.zones).toEqual(data.landscape.zones)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.site.entrances).toEqual(data.site.entrances)
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.buildings[0]).toEqual(data.buildings[0])
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

it('restores the sole omitted tree outside the current buildings and paving, preserving original coordinates and later deletion', async () => {
  const p=parseProject(data),old=parseProject(beforeTrees),footprints=p.buildings.flatMap(buildingFootprintsWorld)
  const candidates=zielonkiSurveyTrees.filter(t=>!old.landscape.plants.some(v=>v.ref===surveyTreeRef(t.handle))).filter(t=>{
    const point=surveyTreePosition(t.handle)
    return !footprints.some(poly=>pointInPolygon(point,poly))&&!p.landscape.zones.some(z=>pointInPolygon(point,z.footprint))
  })
  expect(candidates.map(t=>t.handle)).toEqual(['503A'])
  expect(p.buildings.map(b=>b.position)).toEqual(old.buildings.map(b=>b.position))
  expect(p.landscape.plants).toHaveLength(11)
  for(const tree of p.landscape.plants)expect(tree.position).toEqual(surveyTreePosition(tree.surveyHandle!))
  await synchronizePublishedProject(old,parseProject(initial));await synchronizePublishedNoweMpzp()
  const saved=(await loadWorkspace(NOWE_MPZP_REF))!
  expect(saved.project.landscape.plants.some(t=>t.ref==='plant/survey-503a')).toBe(true)
  saved.project.landscape.plants=saved.project.landscape.plants.filter(t=>t.ref!=='plant/survey-503a');saved.project.revision++
  await saveWorkspace(saved);await synchronizePublishedNoweMpzp()
  expect((await loadWorkspace(NOWE_MPZP_REF))!.project.landscape.plants.some(t=>t.ref==='plant/survey-503a')).toBe(false)
})
