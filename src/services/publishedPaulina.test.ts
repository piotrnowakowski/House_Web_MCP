import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/paulina-poprawki/project.json'
import source from '../../project-data/paulina-poprawki/source-architekt-r4.json'
import architekt from '../../project-data/architekt/before-glowny-exterior-r4.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { polygonArea, polygonBounds } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { uStairHeadroom } from '../domain/stairs'
import { placementWarnings } from '../domain/interiorPlacement'
import { itemFitsFloor, availableInteriorHeight } from '../domain/interior'
import { PAULINA_REF, synchronizePublishedPaulina } from './publishedPaulina'
import { saveWorkspace, loadWorkspace, deleteWorkspace } from './persistence'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('matches the phone-plan dimensions and replaces the former wardrobe floor with an open void', () => {
  expect(source).toEqual(architekt)
  const project=parseProject(data),house=project.buildings[0]
  expect(project.ref).toBe(PAULINA_REF)
  expect(project.name).toBe('paulinka poprawki')
  expect(validateProject(project).filter(i=>i.severity==='error')).toEqual([])
  const bounds=polygonBounds(house.slabs[0].footprint)
  expect(bounds.maxX-bounds.minX).toBeCloseTo(9.45,6)
  expect(bounds.maxZ-bounds.minZ).toBeCloseTo(12.09,6)
  for(const [ref,width,depth,area] of [
    ['space/paulina-pantry',1.65,3.96,6.534],
    ['space/paulina-entry-wardrobe',1.91,2.52,4.8132],
    ['space/reference-wc',1.92,2.52,4.6404],
    ['space/reference-pantry',4.03,1.42,5.7226],
    ['space/reference-office',2.55,4.14,10.557],
  ] as const){
    const dims=roomDimensions(house,house.spaces.find(s=>s.ref===ref)!)
    expect(dims.width,ref).toBeCloseTo(width,5)
    expect(dims.depth,ref).toBeCloseTo(depth,5)
    expect(dims.area,ref).toBeCloseTo(area,5)
  }
  expect(polygonArea(house.slabs[1].holes![1])).toBeCloseTo(27.1072,5)
  expect(polygonArea(house.slabs[1].holes![1])).toBeGreaterThan(polygonArea(parseProject(source).buildings[0].slabs[1].holes![1])*1.7)
  expect(house.spaces.some(s=>s.ref==='space/reference-wardrobe')).toBe(false)
  expect(house.furniture!.some(i=>i.ref.startsWith('interior/architekt/closet-'))).toBe(false)
  expect(house.furniture!.filter(i=>i.catalogId==='bar-stool')).toHaveLength(3)
  expect(project.landscape).toEqual(source.landscape)
  expect(house.position).toEqual(source.buildings[0].position)
  expect(project.buildings.slice(1)).toEqual(source.buildings.slice(1))
})

it('keeps both roof ridges joined and checks stairs, furniture, openings and attic clearance',()=>{
  const house=parseProject(data).buildings[0],wings=roofWings(house).filter(w=>w.type==='gable')
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
  for(const wing of wings){
    const b=polygonBounds(wing.footprint),span=wing.ridgeAxis==='x'?b.maxZ-b.minZ:b.maxX-b.minX
    const angle=Math.atan2(wing.ridgeElevationM-wing.baseElevationM,span/2)*180/Math.PI
    expect(angle).toBeGreaterThanOrEqual(37)
    expect(angle).toBeLessThanOrEqual(45)
    expect(wing.ridgeElevationM).toBeCloseTo(8.0856938754,8)
  }
  expect(gableRoofJunction(house,wings[1])?.side).toBe('min')
  expect(gableWallsForBuilding(house)).toHaveLength(3)
  expect(uStairHeadroom(house,house.stairs![0])).toBeGreaterThanOrEqual(2)
  for(const item of house.furniture!){
    const storey=house.storeys.find(s=>s.ref===item.storeyRef)!,slab=house.slabs.find(s=>s.ref===storey.baseSlabRef)!
    expect(itemFitsFloor(item,slab.footprint,slab.holes),item.ref).toBe(true)
    expect(availableInteriorHeight(item,house,storey),item.ref).toBeGreaterThanOrEqual(item.heightM)
    expect(placementWarnings(item,house,storey).filter(w=>w.kind!=='circulation'),item.ref).toEqual([])
  }
})

it('persists separately from architekt and retains furniture and project deletions',async()=>{
  const original={version:1 as const,project:parseProject(source),proposals:[],draftChangeSets:[]}
  original.project.name='My edited architekt'
  await saveWorkspace(original)
  expect(await synchronizePublishedPaulina()).toEqual([])
  const workspace=(await loadWorkspace(PAULINA_REF))!
  const removed=workspace.project.buildings[0].furniture!.pop()!.ref
  await saveWorkspace(workspace)
  await synchronizePublishedPaulina()
  expect((await loadWorkspace(PAULINA_REF))!.project.buildings[0].furniture!.some(i=>i.ref===removed)).toBe(false)
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
  await deleteWorkspace(PAULINA_REF)
  await synchronizePublishedPaulina()
  expect(await loadWorkspace(PAULINA_REF)).toBeNull()
  expect(await loadWorkspace(original.project.ref)).toEqual(original)
})
