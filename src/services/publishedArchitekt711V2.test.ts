import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/architekt-7-11-v2/project.json'
import source from '../../project-data/architekt-7-11-v2/source-architekt-711-r6.json'
import previous from '../../project-data/architekt-7-11-v2/before-island-seating-r1.json'
import { InteriorItemSchema, interiorCorners } from '../domain/interior'
import { polygonBounds } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { saveWorkspace, loadWorkspace, deleteWorkspace, synchronizePublishedProject } from './persistence'
import { ARCHITEKT_711_V2_REF, synchronizePublishedArchitekt711V2 } from './publishedArchitekt711V2'

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('preserves the r6 house outside the removed cabinet extension and approved island seating', () => {
  const p = parseProject(data), before = parseProject(source)
  expect(p.ref).toBe(ARCHITEKT_711_V2_REF)
  expect(p.name).toBe('architekt 7.11 wersja 2')
  expect(p.revision).toBe(2)
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const removed = ['interior/architekt-711/under-stair-cabinet', 'interior/architekt-711/stair-junction-filler']
  const revised = ['interior/reference-island', 'interior/reference-stool-one', 'interior/reference-stool-two']
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
  const next = parseProject(data)
  next.revision = data.revision + 1; next.updatedAt = '2026-11-11T12:00:00.000Z'
  next.name += ' test update'
  expect(await synchronizePublishedProject(next, parseProject(data))).toEqual([])
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
  const deleted = saved.project.buildings[0].furniture!.find(f => f.catalogId === 'armchair')!.ref
  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter(f => f.ref !== deleted)
  saved.project.landscape.plants.pop()
  await saveWorkspace(saved)
  expect(await synchronizePublishedArchitekt711V2()).toEqual([])
  const result = (await loadWorkspace(old.ref))!
  expect(result.project.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
  expect(result.project.landscape).toEqual(saved.project.landscape)
  expect(result.project.buildings[0].furniture!.find(f => f.catalogId === 'kitchen-island')?.seatingOverhangM).toBe(.38)
  await synchronizePublishedArchitekt711V2()
  expect((await loadWorkspace(old.ref))!.project).toEqual(result.project)
})

it('does not recreate a deleted version 2 when the launcher initializes again', async () => {
  await synchronizePublishedArchitekt711V2()
  await deleteWorkspace(ARCHITEKT_711_V2_REF)
  await synchronizePublishedArchitekt711V2()
  expect(await loadWorkspace(ARCHITEKT_711_V2_REF)).toBeNull()
})
