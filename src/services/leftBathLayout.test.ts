import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-rear-carport/before-ceiling-r117.json'
import before from '../../project-data/zielonki-rear-carport/before-left-bath-r114.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { roomDimensions } from '../domain/roomDimensions'
import { interiorCorners } from '../domain/interior'
import { pointInPolygon, pointOnPolygonBoundary, wallLength } from '../domain/geometry'
import { placementWarnings } from '../domain/interiorPlacement'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const p = parseProject(data), h = p.buildings[0], old = parseProject(before).buildings[0]
const space = (id: string) => h.spaces.find(s => s.ref === `space/reference-${id}`)!
const dims = (id: string) => roomDimensions(h, space(id))

it('puts the bathroom below the stairs on the left with direct hall access and clear fixtures', () => {
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const bath = dims('bathroom')
  expect(bath.bounds.maxX).toBeLessThan(-2)
  expect(bath.bounds.minZ).toBeGreaterThan(Math.max(...h.slabs[1].holes![0].map(v => v.z)))
  expect(bath.area).toBeGreaterThan(4.5)
  for (const id of ['bathroom', 'parents', 'child-one', 'child-two']) {
    const w = h.walls.find(w => w.openings.some(o => o.ref === `opening/reference-${id}`))!
    expect(space(id).boundary.some(b => b.wallRef === w.ref)).toBe(true)
    expect(space('landing').boundary.some(b => b.wallRef === w.ref)).toBe(true)
  }
  for (const f of h.furniture!) {
    const id = f.ref.startsWith('interior/shared-upper-bath/') ? 'bathroom' : f.ref.startsWith('interior/upper-wardrobe/') ? 'wardrobe' : null
    if (!id) continue
    expect(interiorCorners(f).every(c => pointInPolygon(c, dims(id).footprint) || pointOnPolygonBoundary(c, dims(id).footprint)), f.ref).toBe(true)
    expect(placementWarnings(f, h, h.storeys[1]).filter(w => w.kind !== 'circulation'), f.ref).toEqual([])
  }
})

it('extends the wardrobe to the bedroom boundary and joins the right bedroom to the existing facade line', () => {
  expect(dims('wardrobe').bounds.maxZ).toBeCloseTo(dims('parents').bounds.maxZ)
  expect(dims('wardrobe').area).toBeGreaterThan(6)
  const wardrobeDoor = h.walls.find(w => w.openings.some(o => o.ref === 'opening/reference-wardrobe'))!
  expect(space('parents').boundary.some(b => b.wallRef === wardrobeDoor.ref)).toBe(true)
  const roomWall = h.walls.find(w => w.ref === 'wall/reference-upper/children-east-top')!
  const facade = h.walls.find(w => w.ref === 'wall/reference-upper/7')!
  expect(roomWall.start.z).toBe(facade.start.z); expect(roomWall.end.z).toBe(facade.end.z)
  expect(h.walls.some(w => w.ref === 'wall/reference-upper/18')).toBe(false)
  expect(dims('child-one').area).toBeCloseTo(dims('child-two').area, 2)
  expect(dims('child-one').area).toBeGreaterThan(13.8)
  for (const id of ['21', '24']) {
    const w = h.walls.find(w => w.ref === `wall/reference-upper/${id}`)!, o = w.openings[0]
    expect(o.offsetM - o.widthM / 2).toBeGreaterThan(.6)
    expect(wallLength(w) - o.offsetM - o.widthM / 2).toBeGreaterThan(.4)
  }
})

it('preserves the stairs, ground floor, roof and site while deleting obsolete bathroom walls', () => {
  expect(h.stairs).toEqual(old.stairs); expect(h.slabs).toEqual(old.slabs); expect(h.roof).toEqual(old.roof)
  expect(h.position).toEqual(old.position); expect(h.rotationDegrees).toEqual(old.rotationDegrees)
  expect(h.walls.filter(w => h.storeys[0].wallRefs.includes(w.ref))).toEqual(old.walls.filter(w => old.storeys[0].wallRefs.includes(w.ref)))
  expect(h.furniture!.filter(f => f.storeyRef === h.storeys[0].ref)).toEqual(old.furniture!.filter(f => f.storeyRef === h.storeys[0].ref))
  expect(p.site).toEqual(before.site); expect(p.landscape).toEqual(before.landscape)
  expect(p.buildings.slice(1)).toEqual(before.buildings.slice(1))
})

it('migrates saved projects and preserves independent furniture deletion after reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  const base = parseProject(before)
  await synchronizePublishedProject(base, base)
  const saved = (await loadWorkspace(base.ref))!
  const deleted = saved.project.buildings[0].furniture!.find(f => f.ref === 'interior/child-1/desk')!.ref
  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter(f => f.ref !== deleted)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(p, base)).toEqual([])
  const next = (await loadWorkspace(base.ref))!
  expect(next.project.buildings[0].furniture!.some(f => f.ref === deleted)).toBe(false)
  expect(next.project.buildings[0].walls.some(w => w.ref === 'wall/reference-upper/bath-void')).toBe(false)
  await saveWorkspace(next); await synchronizePublishedProject(p, base)
  expect((await loadWorkspace(base.ref))!.project).toEqual(next.project)
})
