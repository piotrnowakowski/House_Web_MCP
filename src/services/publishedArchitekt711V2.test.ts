// Historical publication geometry and migration; current six-project exterior is covered by allProjectsExterior.test.ts.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11-v2/before-island-layout.json'
import currentData from '../../project-data/architekt-7-11-v2/project.json'
import source from '../../project-data/architekt-7-11-v2/source-architekt-711-r6.json'
import previous from '../../project-data/architekt-7-11-v2/before-island-seating-r1.json'
import previousLayout from '../../project-data/architekt-7-11-v2/before-shower-90-r2.json'
import { InteriorItemSchema, interiorCorners } from '../domain/interior'
import { placementWarnings } from '../domain/interiorPlacement'
import { polygonBounds } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { saveWorkspace, loadWorkspace, deleteWorkspace, synchronizePublishedProject } from './persistence'
import { ARCHITEKT_711_V2_REF, synchronizePublishedArchitekt711V2 } from './publishedArchitekt711V2'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('preserves the r6 house outside the approved furniture and shower changes', () => {
  const p = parseProject(data), before = parseProject(source)
  expect(p.ref).toBe(ARCHITEKT_711_V2_REF)
  expect(p.name).toBe('architekt 7.11 wersja 2')
  expect(p.revision).toBe(3)
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const removed = ['interior/architekt-711/under-stair-cabinet', 'interior/architekt-711/stair-junction-filler']
  const revised = ['interior/reference-island', 'interior/reference-stool-one', 'interior/reference-stool-two', 'interior/reference-sofa', 'interior/reference-dining', 'interior/reference-coffee', 'interior/architekt/lounge-chair', 'interior/carport-study/shower']
  expect(p.buildings[0].furniture!.filter(f => !revised.includes(f.ref))).toEqual(before.buildings[0].furniture!.filter(f => !removed.includes(f.ref) && !revised.includes(f.ref)))
  expect(p.buildings[0].furniture!.some(f => f.cabinetry === 'under-stair')).toBe(false)
  const actual = structuredClone(p)
  actual.ref = before.ref; actual.name = before.name; actual.revision = before.revision; actual.updatedAt = before.updatedAt
  actual.buildings[0].furniture = before.buildings[0].furniture
  actual.buildings[0].interiorSource = before.buildings[0].interiorSource
  expect(actual).toEqual(before)
})

it('saves the independent copy and preserves user deletions during a subsequent published update', async () => {
  const parent = { version: 1 as const, project: parseProject(source), proposals: [], draftChangeSets: [] }
  parent.project.landscape.plants.pop()
  await saveWorkspace(parent)
  expect(await synchronizePublishedArchitekt711V2()).toEqual([])
  const saved = (await loadWorkspace(ARCHITEKT_711_V2_REF))!
  saved.project.landscape.plants.pop()
  saved.project.buildings[0].furniture!.pop()
  await saveWorkspace(saved)
  const next = parseProject(currentData)
  next.revision = currentData.revision + 1; next.updatedAt = '2026-11-11T12:00:00.000Z'
  next.name += ' test update'
  expect(await synchronizePublishedProject(next, parseProject(currentData))).toEqual([])
  const reloaded = (await loadWorkspace(ARCHITEKT_711_V2_REF))!
  expect(reloaded.project.landscape).toEqual(saved.project.landscape)
  expect(reloaded.project.buildings[0].furniture).toEqual(saved.project.buildings[0].furniture)
  expect(reloaded.project.name).toBe(next.name)
  expect(await loadWorkspace(parent.project.ref)).toEqual(parent)
})

it('leaves the working aisle and appliances fixed while adding usable knee depth', () => {
  const p = parseProject(data), b = p.buildings[0], old = parseProject(previous).buildings[0]
  const island = b.furniture!.find(f => f.catalogId === 'kitchen-island')!
  const before = old.furniture!.find(f => f.ref === island.ref)!
  const bounds = polygonBounds(interiorCorners(island)), prior = polygonBounds(interiorCorners(before))
  expect(island.widthM).toBe(2.8); expect(island.depthM).toBe(1.1); expect(island.seatingOverhangM).toBe(.38)
  expect(bounds.minX).toBeCloseTo(prior.minX); expect(bounds.minZ).toBeCloseTo(prior.minZ); expect(bounds.maxZ).toBeCloseTo(prior.maxZ)
  const cabinet = b.furniture!.find(f => f.ref === 'interior/reference-counter')!
  expect(bounds.minX - polygonBounds(interiorCorners(cabinet)).maxX).toBeCloseTo(1.1)
  const bodyMaxX = bounds.maxX - island.seatingOverhangM!
  for (const ref of ['interior/reference-sink', 'interior/architekt/cooker']) {
    const appliance = b.furniture!.find(f => f.ref === ref)!
    expect(appliance).toEqual(old.furniture!.find(f => f.ref === ref))
    expect(polygonBounds(interiorCorners(appliance)).maxX).toBeLessThan(bodyMaxX)
  }
  for (const stool of b.furniture!.filter(f => f.catalogId === 'bar-stool')) {
    expect(stool.heightM).toBe(.65)
    expect(island.heightM - stool.heightM).toBeCloseTo(.27)
    expect(polygonBounds(interiorCorners(stool)).minX).toBeGreaterThan(bounds.maxX)
  }
  expect(InteriorItemSchema.safeParse({...island, depthM: .7}).success).toBe(false)
  expect(InteriorItemSchema.safeParse({...island, cabinetry: 'tall'}).success).toBe(false)
})

it('migrates the published r1 seating, retaining independent furniture and tree deletions on reload', async () => {
  const old = parseProject(previous)
  await synchronizePublishedProject(old, old)
  const saved = (await loadWorkspace(old.ref))!
  const deleted = 'interior/office-c5/chair'
  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter(f => f.ref !== deleted)
  saved.project.landscape.plants.pop()
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(parseProject(data), old)).toEqual([])
  const result = (await loadWorkspace(old.ref))!
  expect(result.project.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
  expect(result.project.landscape).toEqual(saved.project.landscape)
  expect(result.project.buildings[0].furniture!.find(f => f.catalogId === 'kitchen-island')?.seatingOverhangM).toBe(.38)
  await synchronizePublishedProject(parseProject(data), old)
  expect((await loadWorkspace(old.ref))!.project).toEqual(result.project)
})

it('does not recreate a deleted version 2 when the launcher initializes again', async () => {
  await synchronizePublishedArchitekt711V2()
  await deleteWorkspace(ARCHITEKT_711_V2_REF)
  await synchronizePublishedArchitekt711V2()
  expect(await loadWorkspace(ARCHITEKT_711_V2_REF)).toBeNull()
})

it('keeps the enlarged shower clear of fittings and the entry door, with its rear edge fixed', () => {
  const b = parseProject(data).buildings[0], old = parseProject(previousLayout).buildings[0]
  const shower = b.furniture!.find(f => f.ref === 'interior/carport-study/shower')!
  const before = old.furniture!.find(f => f.ref === shower.ref)!
  const bounds = polygonBounds(interiorCorners(shower))
  expect([shower.widthM, shower.depthM]).toEqual([2.08, .9])
  expect(shower.rotationDegrees).toBe(180) // Open +z face of the generic fixture points into the room.
  expect(bounds.maxZ).toBeCloseTo(polygonBounds(interiorCorners(before)).maxZ)
  expect(placementWarnings(shower, b, b.storeys![0])).toEqual([])
  const wc = b.furniture!.find(f => f.ref === 'interior/carport-study/wc')!
  expect(bounds.minZ - polygonBounds(interiorCorners(wc)).maxZ).toBeCloseTo(.605)
})

it('retains the left return, requested sofa envelope and measured routes', () => {
  const b = parseProject(data).buildings[0]
  const item = (ref: string) => b.furniture!.find(f => f.ref === ref)!
  const sofa = item('interior/reference-sofa'), bounds = polygonBounds(interiorCorners(sofa))
  expect([sofa.widthM, sofa.depthM, sofa.rotationDegrees, sofa.sofaModuleDepthM]).toEqual([3.2, 2.2, 0, .95])
  expect(bounds.minX - polygonBounds(interiorCorners(item('interior/reference-island'))).maxX).toBeCloseTo(1.12)
  expect(polygonBounds(interiorCorners(item('interior/reference-dining'))).minZ - bounds.maxZ).toBeCloseTo(.945)
  expect(bounds.minZ - polygonBounds(interiorCorners(item('interior/architekt-711/fireplace'))).maxZ).toBeCloseTo(.925)
  // This gap is intentionally NOT claimed as a circulation route.
  expect(4.615 - bounds.maxX).toBeCloseTo(.39)
  expect(placementWarnings(sofa, b, b.storeys![0]).filter(w => w.kind !== 'circulation')).toEqual([])
  expect(placementWarnings(item('interior/architekt/lounge-chair'), b, b.storeys![0]).filter(w => w.kind !== 'circulation')).toEqual([])
  expect(InteriorItemSchema.safeParse({...sofa, widthM: 1.2}).success).toBe(false)
  expect(InteriorItemSchema.safeParse({...sofa, catalogId: 'bed'}).success).toBe(false)
})

it('detects collisions with either sofa run, but leaves its inner void usable after rotation', () => {
  for (const rotationDegrees of [0, 90, 180, 270]) {
    const b = parseProject(data).buildings[0], storey = b.storeys![0]
    const sofa = b.furniture!.find(f => f.ref === 'interior/reference-sofa')!
    const table = b.furniture!.find(f => f.ref === 'interior/reference-coffee')!
    Object.assign(sofa, { position: { x: 0, z: 0 }, rotationDegrees })
    Object.assign(table, { widthM: .3, depthM: .3 })
    b.furniture = [sofa, table]; b.walls = []
    const a = rotationDegrees * Math.PI / 180
    for (const [x, z, overlaps] of [[.5, -.5, false], [-1.2, -.5, true], [.5, .8, true]] as const) {
      table.position = { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) }
      expect(placementWarnings(sofa, b, storey).some(w => w.kind === 'overlap')).toBe(overlaps)
      expect(placementWarnings(table, b, storey).some(w => w.kind === 'overlap')).toBe(overlaps)
    }
  }
})

it('migrates r2 furniture and shower while preserving independent edits and deletions', async () => {
  const old = parseProject(previousLayout)
  await synchronizePublishedProject(old, old)
  const saved = (await loadWorkspace(old.ref))!
  saved.project.landscape.plants.pop()
  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter(f => f.ref !== 'interior/office-c5/chair')
  saved.project.name += ' user name'
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(parseProject(data), old)).toEqual([])
  const result = (await loadWorkspace(old.ref))!
  expect(result.project.landscape).toEqual(saved.project.landscape)
  expect(result.project.name).toBe(saved.project.name)
  expect(result.project.buildings[0].furniture!.some(f => f.ref === 'interior/office-c5/chair')).toBe(false)
  expect(result.project.buildings[0].furniture!.find(f => f.ref === 'interior/reference-sofa')?.sofaModuleDepthM).toBe(.95)
  expect(result.project.buildings[0].furniture!.find(f => f.ref === 'interior/carport-study/shower')?.depthM).toBe(.9)
  await synchronizePublishedProject(parseProject(data), old)
  expect((await loadWorkspace(old.ref))!.project).toEqual(result.project)
})

it('preserves the working copy when a user deleted the chair that this publication relocates', async () => {
  const old = parseProject(previousLayout)
  await synchronizePublishedProject(old, old)
  const saved = (await loadWorkspace(old.ref))!
  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter(f => f.ref !== 'interior/architekt/lounge-chair')
  await saveWorkspace(saved)
  expect(await synchronizePublishedArchitekt711V2()).toEqual(['/buildings/house/main/furniture/interior/architekt/lounge-chair'])
  expect((await loadWorkspace(old.ref))!).toEqual(saved)
  const publishedCopyRef = `${old.ref}/published-${currentData.revision}-${currentData.updatedAt.replace(/\D/g, '')}`
  expect((await loadWorkspace(publishedCopyRef))!.project.buildings[0].furniture).toEqual(parseProject(currentData).buildings[0].furniture)
})
