import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/before-left-bath-r114.json'
import previous from '../../project-data/zielonki-rear-carport/before-stair-window-r110.json'
import published from '../../project-data/zielonki-rear-carport/before-upper-reference-r103.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { roomDimensions } from '../domain/roomDimensions'
import { interiorCorners } from '../domain/interior'
import { pointInPolygon, pointOnPolygonBoundary, wallLength } from '../domain/geometry'
import { gablePlanGuides } from '../domain/gablePlanGuides'
import { uStairHeadroom } from '../domain/stairs'
import { placementWarnings } from '../domain/interiorPlacement'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const p = parseProject(data), h = p.buildings[0], old = parseProject(previous).buildings[0]
const space = (id: string) => h.spaces.find(s => s.ref === `space/reference-${id}`)!
const dims = (id: string) => roomDimensions(h, space(id))

it('moves the complete stair and opening 70 cm with shortened kitchen and clear headroom', () => {
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  expect(h.stairs![0]).toEqual({ ...old.stairs![0], start: { ...old.stairs![0].start, z: old.stairs![0].start.z - .7 } })
  old.slabs[1].holes![0].forEach((v, i) => {
    expect(h.slabs[1].holes![0][i].x).toBe(v.x)
    expect(h.slabs[1].holes![0][i].z).toBeCloseTo(v.z - .7)
  })
  for (const w of old.walls.filter(w => w.ref.startsWith('wall/stair-enclosure/'))) {
    const next = h.walls.find(n => n.ref === w.ref)!
    expect(next.start.z).toBeCloseTo(w.start.z - .7); expect(next.end.z).toBeCloseTo(w.end.z - .7)
  }
  expect(uStairHeadroom(h, h.stairs![0])).toBeGreaterThan(2)
  const counter = h.furniture!.find(f => f.ref === 'interior/reference-counter')!
  expect(counter.widthM).toBeCloseTo(1.14)
  const fridge = h.furniture!.find(f => f.ref === 'interior/reference-fridge')!
  expect(Math.max(...interiorCorners(fridge).map(c => c.z))).toBeCloseTo(-2.555)
  const island = h.furniture!.find(f => f.ref === 'interior/reference-island')!
  expect(island.depthM).toBeCloseTo(2.22)
  expect(placementWarnings(island, h, h.storeys[0]).filter(w => w.kind !== 'circulation')).toEqual([])
})

it('gives enlarged children independent doors, south bathroom access and a wardrobe beyond the window', () => {
  expect(dims('child-one').area).toBeGreaterThan(14)
  expect(dims('child-one').area).toBeCloseTo(dims('child-two').area)
  expect(dims('parents').area).toBeLessThan(roomDimensions(old, old.spaces.find(s => s.ref === space('parents').ref)!).area)
  for (const id of ['child-one', 'child-two', 'bathroom', 'parents']) {
    const wall = h.walls.find(w => w.openings.some(o => o.ref === `opening/reference-${id}`))!
    expect(space('landing').boundary.some(b => b.wallRef === wall.ref)).toBe(true)
    expect(space(id).boundary.some(b => b.wallRef === wall.ref)).toBe(true)
  }
  const bathDoorWall = h.walls.find(w => w.openings.some(o => o.ref === 'opening/reference-bathroom'))!
  expect(bathDoorWall.start.z).toBeCloseTo(dims('bathroom').bounds.maxZ + .1)
  const guide = gablePlanGuides(h, h.storeys[1]).find(g => g.ref === 'roof/reference/front-barn/glazing-upper')!
  expect(gablePlanGuides(h, h.storeys[1])).toHaveLength(1)
  expect(gablePlanGuides(h, h.storeys[0])).toEqual([])
  expect(guide.width).toBeCloseTo(2.4928)
  const wardrobeWall = h.walls.find(w => w.ref === 'wall/reference-upper/wardrobe-west')!
  expect(wardrobeWall.start.x - wardrobeWall.thicknessM / 2 - guide.end.x).toBeCloseTo(.02)
  for (const id of ['21', '24']) {
    const w = h.walls.find(w => w.ref === `wall/reference-upper/${id}`)!, o = w.openings[0]
    expect(o.offsetM - o.widthM / 2).toBeGreaterThan(.6)
    expect(wallLength(w) - o.offsetM - o.widthM / 2).toBeGreaterThan(.6)
  }
  for (const f of h.furniture!) {
    const room = f.ref.startsWith('interior/shared-upper-bath/') ? 'bathroom' : f.ref.startsWith('interior/upper-wardrobe/') ? 'wardrobe' : f.ref.startsWith('interior/child-1/') ? 'child-one' : f.ref.startsWith('interior/child-2/') ? 'child-two' : null
    if (!room) continue
    expect(interiorCorners(f).every(c => pointInPolygon(c, dims(room).footprint) || pointOnPolygonBoundary(c, dims(room).footprint)), f.ref).toBe(true)
    expect(placementWarnings(f, h, h.storeys[1]).filter(w => w.kind !== 'circulation'), f.ref).toEqual([])
  }
})

it('preserves the exterior, living void, roofs, site and other buildings', () => {
  expect(h.roof).toEqual(old.roof); expect(h.slabs[1].holes![1]).toEqual(old.slabs[1].holes![1])
  expect(h.slabs.map(s => s.footprint)).toEqual(old.slabs.map(s => s.footprint))
  expect(h.position).toEqual(old.position); expect(h.rotationDegrees).toEqual(old.rotationDegrees)
  expect(p.site).toEqual(previous.site); expect(p.landscape).toEqual(previous.landscape)
  expect(p.buildings.slice(1)).toEqual(previous.buildings.slice(1))
})

it('migrates published and local saved layouts without restoring deleted furniture', async () => {
  for (const baseline of [published, previous]) {
    globalThis.indexedDB = new IDBFactory()
    const base = parseProject(baseline)
    await synchronizePublishedProject(base, base)
    const saved = (await loadWorkspace(base.ref))!
    const deleted = saved.project.landscape.plants.pop()!.ref
    await saveWorkspace(saved)
    expect(await synchronizePublishedProject(p, base)).toEqual([])
    const migrated = (await loadWorkspace(base.ref))!
    expect(migrated.project.landscape.plants.some(t => t.ref === deleted)).toBe(false)
    expect(migrated.project.buildings[0].furniture!.some(f => f.ref === 'interior/upper-wardrobe/west')).toBe(false)
    await saveWorkspace(migrated); await synchronizePublishedProject(p, base)
    expect((await loadWorkspace(base.ref))!.project).toEqual(migrated.project)
  }
})
