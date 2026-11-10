import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import architekt from '../../project-data/architekt/project.json'
import architektBefore from '../../project-data/architekt/before-island-window-gap-90.json'
import architect711 from '../../project-data/architekt-7-11/project.json'
import architect711Before from '../../project-data/architekt-7-11/before-island-window-gap-90.json'
import stairs from '../../project-data/architekt-7-11-stairs-12-6/project.json'
import stairsBefore from '../../project-data/architekt-7-11-stairs-12-6/before-island-window-gap-90.json'
import version2 from '../../project-data/architekt-7-11-v2/project.json'
import version2Before from '../../project-data/architekt-7-11-v2/before-island-window-gap-90.json'
import mpzp from '../../project-data/nowe-mpzp/project.json'
import mpzpBefore from '../../project-data/nowe-mpzp/before-island-window-gap-90.json'
import mpzpV2 from '../../project-data/nowe-mpzp-v2/project.json'
import mpzpV2Before from '../../project-data/nowe-mpzp-v2/before-island-window-gap-90.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { interiorCorners, itemFitsFloor } from '../domain/interior'
import { polygonBounds } from '../domain/geometry'
import { placementWarnings } from '../domain/interiorPlacement'
import { mergeProjects } from '../domain/projectMerge'
import { islandSeating } from '../interior/islandSeating'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { synchronizePublishedArchitekt } from './publishedArchitekt'
import { synchronizePublishedArchitekt711 } from './publishedArchitekt711'
import { synchronizePublishedArchitekt711Stairs } from './publishedArchitekt711Stairs'
import { synchronizePublishedArchitekt711V2 } from './publishedArchitekt711V2'
import { synchronizePublishedNoweMpzp } from './publishedNoweMpzp'
import { synchronizePublishedNoweMpzpV2 } from './publishedNoweMpzpV2'

const cases = [
  { name: 'architekt', data: architekt, before: architektBefore, sync: synchronizePublishedArchitekt },
  { name: 'architekt 7.11', data: architect711, before: architect711Before, sync: synchronizePublishedArchitekt711 },
  { name: 'stairs 12+6', data: stairs, before: stairsBefore, sync: synchronizePublishedArchitekt711Stairs },
  { name: 'version 2', data: version2, before: version2Before, sync: synchronizePublishedArchitekt711V2 },
  { name: 'nowe mpzp', data: mpzp, before: mpzpBefore, sync: synchronizePublishedNoweMpzp },
  { name: 'nowe mpzp v2', data: mpzpV2, before: mpzpV2Before, sync: synchronizePublishedNoweMpzpV2 },
]
const changed = ['interior/reference-island', 'interior/reference-sink', 'interior/architekt/cooker', 'interior/reference-stool-one', 'interior/reference-stool-two']
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it.each(cases)('$name keeps 90 cm by the window with the centred hob and two-seat recess without changing the house or other furniture', ({ data, before }) => {
  const p = parseProject(data), old = parseProject(before), b = p.buildings[0], floor = b.storeys[0]
  const item = (ref: string) => b.furniture!.find(f => f.ref === ref)!
  const island = item(changed[0]), sink = item(changed[1]), hob = item(changed[2])
  const bounds = polygonBounds(interiorCorners(island)), prior = polygonBounds(interiorCorners(old.buildings[0].furniture!.find(f => f.ref === island.ref)!))
  expect([island.widthM, island.depthM, island.seatingWidthM, island.seatingOffsetM, island.seatingOverhangM]).toEqual([2.8, 1.1, 1.2, .8, .38])
  expect(bounds.minX).toBeCloseTo(prior.minX); expect(bounds.minZ - prior.minZ).toBeCloseTo(.18)
  const windowWall = b.walls.find(w => w.openings.some(o => o.ref === 'opening/reference-kitchen'))!
  expect(windowWall.start.z).toBe(windowWall.end.z)
  expect(bounds.minZ - (windowWall.start.z + windowWall.thicknessM / 2)).toBeCloseTo(.9)
  for (const ref of changed) {
    const current = item(ref), previous = old.buildings[0].furniture!.find(f => f.ref === ref)!
    expect({ ...current, position: previous.position }).toEqual(previous)
    expect(current.position.x).toBe(previous.position.x)
    expect(current.position.z - previous.position.z).toBeCloseTo(.18)
  }
  expect(hob.position.z).toBe(island.position.z)
  const sb = polygonBounds(interiorCorners(sink)), hb = polygonBounds(interiorCorners(hob))
  expect(hb.minZ - sb.maxZ).toBeCloseTo(.45)
  expect(sb.minZ - bounds.minZ).toBeCloseTo(.1)
  for (const appliance of [sink, hob]) {
    const ab = polygonBounds(interiorCorners(appliance))
    expect(ab.minX).toBeGreaterThan(bounds.minX)
    expect(ab.maxX).toBeLessThan(bounds.maxX - island.seatingOverhangM!)
    expect(appliance.elevationM).toBe(island.heightM)
  }
  const seating = islandSeating(island), stools = b.furniture!.filter(f => f.catalogId === 'bar-stool')
  expect(stools).toHaveLength(2)
  for (const stool of stools) {
    const x = island.position.z - stool.position.z
    expect(x - stool.depthM / 2).toBeGreaterThanOrEqual(seating.start)
    expect(x + stool.depthM / 2).toBeLessThanOrEqual(seating.end)
    expect(stool.heightM).toBe(.65)
  }
  expect(Math.abs(stools[1].position.z - stools[0].position.z)).toBeCloseTo(.6)
  for (const f of [island, sink, hob, ...stools]) {
    expect(placementWarnings(f, b, floor).filter(w => w.kind !== 'circulation'), f.ref).toEqual([])
    const slab = b.slabs.find(s => s.ref === floor.baseSlabRef)!
    expect(itemFitsFloor(f, slab.footprint, slab.holes), f.ref).toBe(true)
  }
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const restored = structuredClone(p)
  restored.revision = old.revision; restored.updatedAt = old.updatedAt
  restored.buildings[0].furniture = restored.buildings[0].furniture!.map(f => changed.includes(f.ref) ? old.buildings[0].furniture!.find(o => o.ref === f.ref)! : f)
  expect(restored).toEqual(old)
})

it.each(cases)('$name migrates the 90 cm window clearance and preserves independent edits and deletions across reload', async ({ data, before, sync }) => {
  const old = parseProject(before)
  await synchronizePublishedProject(old, old)
  const local = (await loadWorkspace(old.ref))!
  local.project.name += ' user edit'
  local.project.landscape.plants.pop()
  local.project.buildings[0].furniture = local.project.buildings[0].furniture!.filter(f => f.ref !== 'interior/office-c5/chair')
  await saveWorkspace(local)
  expect(await sync()).toEqual([])
  const saved = (await loadWorkspace(old.ref))!
  expect(saved.project.name).toBe(local.project.name)
  expect(saved.project.landscape).toEqual(local.project.landscape)
  expect(saved.project.buildings[0].furniture!.some(f => f.ref === 'interior/office-c5/chair')).toBe(false)
  for (const ref of changed) expect(saved.project.buildings[0].furniture!.find(f => f.ref === ref)).toEqual(parseProject(data).buildings[0].furniture!.find(f => f.ref === ref))
  expect(await sync()).toEqual([])
  expect(await loadWorkspace(old.ref)).toEqual(saved)
  const conflict = structuredClone(old)
  conflict.buildings[0].furniture!.find(f => f.ref === changed[1])!.position.z = 0
  expect(mergeProjects(old, conflict, parseProject(data)).conflicts).toContain('/buildings/house/main/furniture/interior/reference-sink/position/z')
  const deleted = structuredClone(old)
  deleted.buildings[0].furniture = deleted.buildings[0].furniture!.filter(f => f.ref !== changed[1])
  expect(mergeProjects(old, deleted, parseProject(data)).conflicts).toContain('/buildings/house/main/furniture/interior/reference-sink')
})
