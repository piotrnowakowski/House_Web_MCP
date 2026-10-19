import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt/project.json'
import beforeCorrection from '../../project-data/architekt/before-correction-r5.json'
import beforeFrameRemoval from '../../project-data/architekt/before-remove-eaves-frames-r6.json'
import beforeFacadeFix from '../../project-data/architekt/before-facade-carport-r7.json'
import beforeTwoCars from '../../project-data/architekt/before-two-cars-r8.json'
import beforeAttachedCarport from '../../project-data/architekt/before-attached-carport-r9.json'
import source from '../../project-data/architekt/source-glowny-r79.json'
import main from '../../project-data/zielonki-rear-bath-room/project.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, distanceToSegment, pointInPolygon, pointOnPolygonBoundary, polygonArea, polygonBounds } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { isExteriorWall } from '../domain/zielonkiInterior'
import { uStairHeadroom } from '../domain/stairs'
import { placementWarnings } from '../domain/interiorPlacement'
import { availableInteriorHeight, itemFitsFloor } from '../domain/interior'
import { interiorsOverlap, landUseAreas } from '../domain/zoning'
import { ARCHITEKT_REF, synchronizePublishedArchitekt } from './publishedArchitekt'
import { loadWorkspace, saveWorkspace, deleteWorkspace, synchronizePublishedProject, listWorkspaces } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('matches the printed footprint and clear rectangular room dimensions without altering GŁÓWNY', () => {
  // The launcher rename changes only identity metadata, not the source house design.
  expect({ ...main, name: source.name, revision: source.revision, updatedAt: source.updatedAt }).toEqual(source)
  const project = parseProject(data), house = project.buildings[0]
  expect(project.ref).toBe(ARCHITEKT_REF)
  expect(project.name).toBe('architekt')
  expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
  const bounds = polygonBounds(house.slabs[0].footprint)
  expect(bounds.maxX - bounds.minX).toBeCloseTo(10.13, 6)
  expect(bounds.maxZ - bounds.minZ).toBeCloseTo(13.21, 6)
  expect(polygonArea(house.slabs[0].footprint)).toBeCloseTo(13.21 * 10.13 - 5.57 * 2.38, 6)
  for (const [ref, width, depth] of [
    ['pantry', 4.33, 1.70], ['wc', 2.21, 2.55], ['office', 2.4, 4.37],
    ['child-one', 3.62, 3.45],
    ['parents', 5.10, 3.95], ['bathroom', 2.3, 2.55],
  ] as const) {
    const dimensions = roomDimensions(house, house.spaces.find(s => s.ref === `space/reference-${ref}`)!)
    expect(dimensions.width, ref).toBeCloseTo(width, 5)
    expect(dimensions.depth, ref).toBeCloseTo(depth, 5)
  }
  expect(house.slabs[1].holes).toHaveLength(2)
  expect(polygonArea(house.slabs[1].holes![1])).toBeCloseTo(4.01 * 6.74, 6)
  expect(house.spaces.some(s => s.ref === 'space/reference-wardrobe')).toBe(false)
  expect(house.spaces.some(s => s.usage === 'void')).toBe(false)
  expect(uStairHeadroom(house, house.stairs![0])).toBeGreaterThan(2)
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
  expect(house.roof.baseElevationM).toBeCloseTo(source.buildings[0].roof.baseElevationM, 8)
  for (const item of house.furniture!) {
    const storey = house.storeys.find(s => s.ref === item.storeyRef)!
    const slab = house.slabs.find(s => s.ref === storey.baseSlabRef)!
    expect(itemFitsFloor(item, slab.footprint, slab.holes), item.ref).toBe(true)
    expect(availableInteriorHeight(item, house, storey), item.ref).toBeGreaterThanOrEqual(item.heightM)
    expect(placementWarnings(item, house, storey).filter(w => w.kind !== 'circulation'), item.ref).toEqual([])
  }
  expect(project.buildings.some(b => b.ref === 'building/south-carport')).toBe(true)
  expect(project.buildings.find(b => b.ref === 'building/garden-outbuilding')).toEqual(source.buildings.find(b => b.ref === 'building/garden-outbuilding'))
})

it('recomputes symmetric compliant main slopes and recognizes the perpendicular roof junction', () => {
  const house = parseProject(data).buildings[0], wings = roofWings(house).filter(w => w.type === 'gable')
  expect(wings).toHaveLength(2)
  for (const wing of wings) {
    const b = polygonBounds(wing.footprint)
    const halfSpan = (wing.ridgeAxis === 'x' ? b.maxZ - b.minZ : b.maxX - b.minX) / 2
    const angle = Math.atan2(wing.ridgeElevationM - wing.baseElevationM, halfSpan) * 180 / Math.PI
    expect(angle).toBeGreaterThanOrEqual(37)
    expect(angle).toBeLessThanOrEqual(45)
  }
  expect(wings[0].ridgeElevationM).toBeCloseTo(wings[1].ridgeElevationM, 8)
  expect(gableRoofJunction(house, wings[1])?.side).toBe('min')
  expect(gableWallsForBuilding(house).some(w => w.segmentRef === wings[1].ref && w.side === 'min')).toBe(false)
})

it('adds an independent saved project and preserves existing source edits and deletions', async () => {
  const original = { version:1 as const, project:parseProject(source), proposals:[], draftChangeSets:[] }
  original.project.name = 'My independently edited GŁÓWNY'
  await saveWorkspace(original)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  const workspace = (await loadWorkspace(ARCHITEKT_REF))!
  const deleted = workspace.project.buildings[0].furniture!.pop()!.ref
  await saveWorkspace(workspace)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  expect((await loadWorkspace(ARCHITEKT_REF))!.project.buildings[0].furniture!.some(i => i.ref === deleted)).toBe(false)
  await deleteWorkspace(ARCHITEKT_REF)
  await synchronizePublishedArchitekt()
  expect(await loadWorkspace(ARCHITEKT_REF)).toBeNull()
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
})

it('keeps the complete 60 cm eaves outside agricultural land after removing the corner frames', () => {
  const project=parseProject(data),house=project.buildings[0],angle=house.rotationDegrees*Math.PI/180
  const world=(p:{x:number;z:number})=>({x:house.position.x+p.x*Math.cos(angle)+p.z*Math.sin(angle),z:house.position.z-p.x*Math.sin(angle)+p.z*Math.cos(angle)})
  for(const roof of roofWings(house)){
    expect(roof.overhangM-.225).toBeCloseTo(.6,8)
    const b=polygonBounds(roof.footprint),o=roof.overhangM
    const outline=[{x:b.minX-o,z:b.minZ-o},{x:b.maxX+o,z:b.minZ-o},{x:b.maxX+o,z:b.maxZ+o},{x:b.minX-o,z:b.maxZ+o}].map(world)
    expect(landUseAreas(project).filter(z=>z.landRole==='agricultural'&&interiorsOverlap(outline,z.boundary))).toEqual([])
  }
  expect(house.walls.filter(w=>w.ref.includes('/eaves-frame/'))).toEqual([])
  expect(house.roof).toEqual(parseProject(beforeFrameRemoval).buildings[0].roof)
})

it.each([beforeCorrection,beforeFrameRemoval,beforeFacadeFix,beforeTwoCars,beforeAttachedCarport])('migrates architect r$revision, retaining unrelated edits and deletions through reload',async(previous)=>{
  const before=parseProject(previous)
  await synchronizePublishedProject(before,before)
  const local=(await loadWorkspace(ARCHITEKT_REF))!
  local.project.buildings[0].spaces.find(s=>s.ref==='space/reference-office')!.floorFinish!.color='#123456'
  const deleted=local.project.buildings[1].furniture!.pop()!.ref
  const windowWall=local.project.buildings[1].walls.find(w=>w.openings.some(o=>o.ref==='opening/outbuilding/workshop-window'))!
  windowWall.openings=windowWall.openings.filter(o=>o.ref!=='opening/outbuilding/workshop-window')
  await saveWorkspace(local)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  const migrated=(await loadWorkspace(ARCHITEKT_REF))!
  expect(migrated.project.buildings[0].spaces.some(s=>s.ref==='space/reference-wardrobe')).toBe(false)
  expect(migrated.project.buildings[0].walls.some(w=>w.ref.includes('/eaves-frame/'))).toBe(false)
  expect(migrated.project.buildings[0].spaces.find(s=>s.ref==='space/reference-office')!.floorFinish!.color).toBe('#123456')
  expect(migrated.project.buildings[1].furniture!.some(f=>f.ref===deleted)).toBe(false)
  expect(migrated.project.buildings[1].walls.flatMap(w=>w.openings).some(o=>o.ref==='opening/outbuilding/workshop-window')).toBe(false)
  const carport=migrated.project.buildings.find(b=>b.ref==='building/south-carport')!
  expect(carport.furniture!.map(f=>f.catalogId)).toEqual(['car','car'])
  await saveWorkspace(migrated)
  expect(await synchronizePublishedArchitekt()).toEqual([])
  expect((await loadWorkspace(ARCHITEKT_REF))!.project).toEqual(migrated.project)
  expect((await listWorkspaces()).some(w=>w.ref.includes('/before-published-'))).toBe(true)
})

it('preserves a locally deleted office window and both complete versions when publication edits that window',async()=>{
  const previous=parseProject(beforeFacadeFix)
  await synchronizePublishedProject(previous,previous)
  const local=(await loadWorkspace(ARCHITEKT_REF))!
  const wall=local.project.buildings[0].walls.find(w=>w.openings.some(o=>o.ref==='opening/reference-office-window'))!
  wall.openings=[]
  await saveWorkspace(local)
  expect(await synchronizePublishedArchitekt()).toEqual(['/buildings/house/main/walls/wall/architekt/ground/9/openings/opening/reference-office-window'])
  expect((await loadWorkspace(ARCHITEKT_REF))!.project).toEqual(local.project)
  expect((await listWorkspaces()).some(w=>w.ref.includes(`/published-${data.revision}-`))).toBe(true)
})

it('repairs the photographed facade, continuous gable and corner opening without changing the rooms or roof',()=>{
  const house=parseProject(data).buildings[0],before=parseProject(beforeFacadeFix).buildings[0]
  expect(house.spaces).toEqual(before.spaces)
  expect(house.roof).toEqual(before.roof)
  expect(house.walls.filter(w=>isExteriorWall(house,w)).every(w=>w.finish?.material!=='light-render')).toBe(true)
  for(const ref of ['opening/reference-office-window','opening/reference-kitchen']){
    const current=house.walls.flatMap(w=>w.openings).find(o=>o.ref===ref)!
    const old=before.walls.flatMap(w=>w.openings).find(o=>o.ref===ref)!
    expect(current.sillM).toBe(0)
    expect(current.heightM).toBeCloseTo(old.sillM+old.heightM,8)
  }
  const profile=gableGlazingProfile(house.roof.segments[0],'min',house)!
  expect(profile.panels).toHaveLength(1)
  expect(profile.panels[0].connected).toBe(true)
  expect(profile.outline[0].z).toBeCloseTo(house.roof.baseElevationM,8)
  const corner=house.walls.find(w=>w.ref==='wall/architekt/ground/20')!,opening=corner.openings[0]
  const length=Math.hypot(corner.end.x-corner.start.x,corner.end.z-corner.start.z)
  expect(length-opening.offsetM-opening.widthM/2).toBeCloseTo(.225,8)
})

it('attaches the two-car canopy behind the entrance, flush with the house end, with clear bays',()=>{
  const project=parseProject(data),carport=project.buildings.find(b=>b.ref==='building/south-carport')!
  const roof=carport.roof.segments[0],canopy=roof.canopy!,cars=carport.furniture!
  const bounds=polygonBounds(roof.footprint),floor=carport.slabs[0].topElevationM
  expect(bounds.maxX-bounds.minX).toBeCloseTo(5,8)
  expect(bounds.maxZ-bounds.minZ).toBeCloseTo(6.4,8)
  const house=project.buildings[0],houseBounds=polygonBounds(house.slabs[0].footprint)
  expect(carport.position).toEqual(house.position)
  expect(carport.rotationDegrees).toBe(house.rotationDegrees)
  expect(bounds.maxX).toBeCloseTo(houseBounds.minX,8)
  expect(bounds.minZ).toBeCloseTo(houseBounds.minZ,8)
  const entranceWall=house.walls.find(w=>w.openings.some(o=>o.ref==='opening/reference-entrance'))!
  const entrance=entranceWall.openings.find(o=>o.ref==='opening/reference-entrance')!
  expect(entranceWall.start.z-entrance.offsetM-entrance.widthM/2-bounds.maxZ).toBeCloseTo(.62,8)
  const clearance=Math.min(roof.baseElevationM-.025,roof.baseElevationM+.24-canopy.fasciaHeightM)-floor
  expect(clearance).toBeCloseTo(2.5,8)
  expect(cars.map(c=>c.catalogId)).toEqual(['car','car'])
  expect(cars[0].position.z).toBe(cars[1].position.z)
  expect(cars[1].position.x-cars[0].position.x).toBeCloseTo(2.5,8)
  for(const car of cars){
    expect(clearance-car.heightM).toBeGreaterThanOrEqual(1)
    expect(itemFitsFloor(car,carport.slabs[0].footprint)).toBe(true)
    expect(itemFitsFloor({...car,widthM:2.5,depthM:5},carport.slabs[0].footprint)).toBe(true)
    for(const post of canopy.posts){
      expect(Math.abs(post.x-car.position.x)-canopy.postWidthM/2).toBeGreaterThan(car.widthM/2)
      expect(Math.abs(post.z-car.position.z)-canopy.postWidthM/2).toBeGreaterThan(2.5)
    }
  }
  const angle=carport.rotationDegrees*Math.PI/180
  const world=roof.footprint.map(p=>({x:carport.position.x+p.x*Math.cos(angle)+p.z*Math.sin(angle),z:carport.position.z-p.x*Math.sin(angle)+p.z*Math.cos(angle)}))
  expect(world.every(p=>pointInPolygon(p,project.site.boundary))).toBe(true)
  // The rounded cadastral model has effectively no margin beyond 3 m; this is not a survey certification.
  expect(Math.min(...world.flatMap(p=>project.site.boundary.map((q,i)=>distanceToSegment(p,q,project.site.boundary[(i+1)%project.site.boundary.length]))))).toBeCloseTo(3,2)
  expect(buildingFootprintsWorld(project.buildings[0]).some(f=>interiorsOverlap(f,world))).toBe(false)
  expect(landUseAreas(project).filter(z=>z.landRole==='agricultural'&&interiorsOverlap(world,z.boundary))).toEqual([])
  expect(project.buildings.filter(b=>b.ref!==carport.ref)).toEqual(parseProject(beforeAttachedCarport).buildings.filter(b=>b.ref!==carport.ref))
  const apron=project.landscape.zones.find(z=>z.ref==='zone/architekt/carport-apron')!
  expect(world.every(p=>pointInPolygon(p,apron.footprint)||pointOnPolygonBoundary(p,apron.footprint))).toBe(true)
})
