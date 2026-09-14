import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/before-stair-window-r110.json'
import before from '../../project-data/zielonki-rear-carport/before-upper-reference-r103.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { pointInPolygon, pointOnPolygonBoundary } from '../domain/geometry'
import { roomDimensions } from '../domain/roomDimensions'
import { interiorCorners } from '../domain/interior'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it('enlarges equal bedrooms with hall access and fits an ensuite wardrobe and right-hand bathroom', () => {
  const p = parseProject(data), h = p.buildings[0]
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const space = (id: string) => h.spaces.find(s => s.ref === `space/reference-${id}`)!
  const dims = (id: string) => roomDimensions(h, space(id))
  const a = dims('child-one'), b = dims('child-two')
  expect(a.area).toBeGreaterThan(12.8); expect(a.area).toBeCloseTo(b.area)
  expect(a.width).toBeCloseTo(b.width); expect(a.depth).toBeCloseTo(b.depth)
  expect(a.bounds.minX + b.bounds.maxX).toBeCloseTo(-2.91)
  expect(dims('parents').area).toBeGreaterThan(20)
  expect(dims('wardrobe').area).toBeGreaterThan(4.9)
  expect(dims('bathroom').area).toBeGreaterThan(4.8)
  for (const id of ['child-one', 'child-two', 'bathroom', 'parents']) {
    const wall = h.walls.find(w => w.openings.some(o => o.ref === `opening/reference-${id}`))!
    expect(space('landing').boundary.some(b => b.wallRef === wall.ref)).toBe(true)
    expect(space(id).boundary.some(b => b.wallRef === wall.ref)).toBe(true)
  }
  const wardrobeDoor = h.walls.find(w => w.openings.some(o => o.ref === 'opening/reference-wardrobe'))!
  expect(space('parents').boundary.some(b => b.wallRef === wardrobeDoor.ref)).toBe(true)
  expect(space('wardrobe').boundary.some(b => b.wallRef === wardrobeDoor.ref)).toBe(true)
  for (const f of h.furniture!) {
    const room = f.ref.startsWith('interior/shared-upper-bath/') ? 'bathroom' : f.ref.startsWith('interior/upper-wardrobe/') ? 'wardrobe' : f.ref.startsWith('interior/child-1/') ? 'child-one' : f.ref.startsWith('interior/child-2/') ? 'child-two' : null
    if (room) expect(interiorCorners(f).every(c => (pointInPolygon(c, dims(room).footprint) || pointOnPolygonBoundary(c, dims(room).footprint))), f.ref).toBe(true)
  }
  expect(a.area).toBeCloseTo(13.072)
  expect(dims('wardrobe').area).toBeCloseTo(5.012)
})

it('keeps the complete lower floor, stairs, slab void, roofs and site unchanged', () => {
  const p = parseProject(data), old = parseProject(before), h = p.buildings[0], base = old.buildings[0]
  expect(h.roof).toEqual(base.roof); expect(h.slabs).toEqual(base.slabs); expect(h.stairs).toEqual(base.stairs)
  expect(h.position).toEqual(base.position); expect(h.rotationDegrees).toEqual(base.rotationDegrees)
  expect(h.storeys[0]).toEqual(base.storeys[0])
  expect(h.walls.filter(w => h.storeys[0].wallRefs.includes(w.ref))).toEqual(base.walls.filter(w => base.storeys[0].wallRefs.includes(w.ref)))
  expect(h.furniture!.filter(f => f.storeyRef === h.storeys[0].ref)).toEqual(base.furniture!.filter(f => f.storeyRef === base.storeys[0].ref))
  expect(p.buildings.slice(1)).toEqual(old.buildings.slice(1)); expect(p.landscape).toEqual(old.landscape); expect(p.site).toEqual(old.site)
})

it('migrates old projects with independent deletion and retains deleted shower and partitions after reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  const base = parseProject(before), next = parseProject(data)
  await synchronizePublishedProject(base, base)
  const saved = (await loadWorkspace(base.ref))!
  saved.project.name = 'My upper layout'
  const ref = saved.project.landscape.plants.pop()!.ref
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(next, base)).toEqual([])
  const migrated = (await loadWorkspace(base.ref))!
  expect(migrated.project.name).toBe('My upper layout')
  expect(migrated.project.landscape.plants.some(p => p.ref === ref)).toBe(false)
  expect(migrated.project.buildings[0].furniture!.some(f => f.ref === 'interior/shared-upper-bath/shower')).toBe(false)
  expect(migrated.project.buildings[0].walls.some(w => w.ref === 'wall/reference-upper/17')).toBe(false)
  await saveWorkspace(migrated); await synchronizePublishedProject(next, base)
  expect((await loadWorkspace(base.ref))!.project).toEqual(migrated.project)
})
