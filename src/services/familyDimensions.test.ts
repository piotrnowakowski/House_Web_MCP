// Historical publication fixture; latest canonical preservation and migration are covered by allProjectsExterior.test.ts.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import architekt from '../../project-data/architekt/before-island-layout.json'
import architektBefore from '../../project-data/architekt/before-family-dimensions.json'
import architect711 from '../../project-data/architekt-7-11/before-island-layout.json'
import architect711Before from '../../project-data/architekt-7-11/before-family-dimensions.json'
import stairs from '../../project-data/architekt-7-11-stairs-12-6/before-island-layout.json'
import stairsBefore from '../../project-data/architekt-7-11-stairs-12-6/before-family-dimensions.json'
import mpzp from '../../project-data/nowe-mpzp/before-island-layout.json'
import mpzpBefore from '../../project-data/nowe-mpzp/before-family-dimensions.json'
import mpzpV2 from '../../project-data/nowe-mpzp-v2/before-island-layout.json'
import mpzpV2Before from '../../project-data/nowe-mpzp-v2/before-family-dimensions.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { interiorCorners, itemFitsFloor } from '../domain/interior'
import { polygonBounds } from '../domain/geometry'
import { placementWarnings } from '../domain/interiorPlacement'
import { mergeProjects } from '../domain/projectMerge'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const cases = [
  { name: 'architekt', data: architekt, before: architektBefore },
  { name: 'architekt 7.11', data: architect711, before: architect711Before },
  { name: 'stairs 12+6', data: stairs, before: stairsBefore },
  { name: 'nowe mpzp', data: mpzp, before: mpzpBefore },
  { name: 'nowe mpzp v2', data: mpzpV2, before: mpzpV2Before },
]
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it.each(cases)('$name enlarges the two fixtures and retains its own building, garden and other furniture', ({ data, before }) => {
  const p = parseProject(data), old = parseProject(before), b = p.buildings[0], floor = b.storeys[0]
  const item = (ref: string) => b.furniture!.find(f => f.ref === ref)!
  const sofa = item('interior/reference-sofa'), shower = item('interior/carport-study/shower')
  expect([sofa.widthM, sofa.depthM, sofa.sofaModuleDepthM]).toEqual([3.2, 2.2, .95])
  expect(sofa.rotationDegrees).toBe(old.buildings[0].furniture!.find(f => f.ref === sofa.ref)!.rotationDegrees)
  expect([shower.widthM, shower.depthM, shower.rotationDegrees]).toEqual([2.08, .9, 180])
  expect(polygonBounds(interiorCorners(shower)).maxZ).toBeCloseTo(4.27)
  expect(polygonBounds(interiorCorners(item('interior/reference-dining'))).minZ - polygonBounds(interiorCorners(sofa)).maxZ).toBeCloseTo(.945)
  for (const f of [sofa, shower, item('interior/reference-coffee')]) {
    expect(placementWarnings(f, b, floor).filter(w => w.kind !== 'circulation'), f.ref).toEqual([])
    const slab = b.slabs.find(s => s.ref === floor.baseSlabRef)!
    expect(itemFitsFloor(f, slab.footprint, slab.holes), f.ref).toBe(true)
  }
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  const changed = ['interior/reference-sofa', 'interior/carport-study/shower', 'interior/reference-coffee']
  if (sofa.rotationDegrees === 0) changed.push('interior/reference-dining', 'interior/architekt/lounge-chair')
  const restored = structuredClone(p)
  restored.revision = old.revision; restored.updatedAt = old.updatedAt
  restored.buildings[0].furniture = restored.buildings[0].furniture!.map(f => changed.includes(f.ref) ? old.buildings[0].furniture!.find(o => o.ref === f.ref)! : f)
  expect(restored).toEqual(old)
})

it.each(cases)('$name migrates independently and preserves unrelated edits and deletions on reload', async ({ data, before }) => {
  const old = parseProject(before)
  const sync = () => synchronizePublishedProject(parseProject(data), old)
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
  for (const ref of ['interior/reference-sofa', 'interior/carport-study/shower']) expect(saved.project.buildings[0].furniture!.find(f => f.ref === ref)).toEqual(parseProject(data).buildings[0].furniture!.find(f => f.ref === ref))
  expect(await sync()).toEqual([])
  expect(await loadWorkspace(old.ref)).toEqual(saved)
  const conflict = structuredClone(old)
  conflict.buildings[0].furniture!.find(f => f.ref === 'interior/reference-sofa')!.widthM = 2.9
  expect(mergeProjects(old, conflict, parseProject(data)).conflicts).toContain('/buildings/house/main/furniture/interior/reference-sofa/widthM')
})
