import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/before-upper-reference-r103.json'
import before from '../../project-data/zielonki-rear-carport/before-symmetric-upper-r98.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { pointInPolygon, polygonArea } from '../domain/geometry'
import { interiorCorners } from '../domain/interior'
import { roomDimensions } from '../domain/roomDimensions'
import { uStairHeadroom } from '../domain/stairs'
import { mergeProjects } from '../domain/projectMerge'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it('fits equal bedrooms with independent hall doors and a furnished shared bathroom', () => {
  const p = parseProject(data), h = p.buildings[0], old = parseProject(before).buildings[0]
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const space = (id: string) => h.spaces.find(s => s.ref === `space/reference-${id}`)!
  const a = roomDimensions(h, space('child-one')), b = roomDimensions(h, space('child-two'))
  expect(a.area).toBeCloseTo(10.168); expect(b.area).toBeCloseTo(a.area)
  expect(a.width).toBeCloseTo(b.width); expect(a.depth).toBeCloseTo(b.depth)
  expect(a.bounds.minX + b.bounds.maxX).toBeCloseTo(-2.91)
  expect(a.bounds.maxX + b.bounds.minX).toBeCloseTo(-2.91)
  for (const id of ['child-one', 'child-two']) {
    expect(roomDimensions(h, space(id)).area).toBeGreaterThan(roomDimensions(old, old.spaces.find(s => s.ref === space(id).ref)!).area)
    const doorWall = h.walls.find(w => w.openings.some(o => o.ref === `opening/reference-${id}`))!
    expect(space('landing').boundary.some(b => b.wallRef === doorWall.ref)).toBe(true)
    expect(space(id).boundary.some(b => b.wallRef === doorWall.ref)).toBe(true)
    expect(space('bathroom').boundary.some(b => b.wallRef === doorWall.ref)).toBe(false)
  }
  const bathroom = roomDimensions(h, space('bathroom'))
  expect(bathroom.area).toBeCloseTo(3.8766)
  const fixtures = h.furniture!.filter(f => f.ref.startsWith('interior/shared-upper-bath/'))
  expect(fixtures).toHaveLength(3)
  for (const f of fixtures) expect(interiorCorners(f).every(c => pointInPolygon(c, bathroom.footprint))).toBe(true)
})

it('moves the complete stairs to the wall and adds 8.82 square metres without changing the shell', () => {
  const p = parseProject(data), h = p.buildings[0], old = parseProject(before).buildings[0]
  expect(h.position).toEqual(old.position); expect(h.rotationDegrees).toBe(old.rotationDegrees)
  expect(h.roof).toEqual(old.roof); expect(p.buildings[1]).toEqual(before.buildings[1])
  expect(p.site).toEqual(before.site); expect(p.landscape).toEqual(before.landscape)
  expect(h.stairs![0]).toEqual({ ...old.stairs![0], start: { ...old.stairs![0].start, x: old.stairs![0].start.x - 1 } })
  expect(uStairHeadroom(h, h.stairs![0])).toBeGreaterThan(2)
  const slab = h.slabs.find(s => s.ref === 'slab/reference-upper')!, base = old.slabs.find(s => s.ref === slab.ref)!
  expect(slab.footprint).toEqual(base.footprint)
  expect(slab.holes![0]).toEqual(base.holes![0].map(p => ({ ...p, x: p.x - 1 })))
  expect(polygonArea(base.holes![1]) - polygonArea(slab.holes![1])).toBeCloseTo(8.82)
  for (const w of old.walls.filter(w => w.groupRef === 'wall-group/stair-enclosure')) {
    expect(h.walls.find(n => n.ref === w.ref)).toEqual({ ...w, start: { ...w.start, x: w.start.x - 1 }, end: { ...w.end, x: w.end.x - 1 } })
  }
})

it('loads fresh data and migrates saved deletions without resurrecting laundry partitions', async () => {
  globalThis.indexedDB = new IDBFactory()
  const published = parseProject(data), base = parseProject(before)
  expect(await synchronizePublishedProject(published, base)).toEqual([])
  expect((await loadWorkspace(published.ref))!.project).toEqual(published)
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(base, base)
  const saved = (await loadWorkspace(base.ref))!
  saved.project.name = 'Independent name'
  const deleted = saved.project.buildings[0].furniture!.pop()!.ref
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(published, base)).toEqual([])
  const migrated = (await loadWorkspace(base.ref))!
  expect(migrated.project.name).toBe('Independent name')
  expect(migrated.project.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
  expect(migrated.project.buildings[0].spaces.some(s => s.ref === 'space/reference-laundry')).toBe(false)
  expect(migrated.project.buildings[0].walls.some(w => ['10', '11', '12'].some(n => w.ref === `wall/reference-upper/${n}`))).toBe(false)
  await saveWorkspace(migrated)
  await synchronizePublishedProject(published, base)
  expect((await loadWorkspace(base.ref))!.project).toEqual(migrated.project)
  const conflict = structuredClone(base)
  conflict.buildings[0].walls.find(w => w.ref === 'wall/reference-upper/10')!.heightM += .1
  expect(mergeProjects(base, conflict, published).conflicts.some(c => c.includes('wall/reference-upper/10'))).toBe(true)
})
