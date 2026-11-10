import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import { isDeepStrictEqual } from 'node:util'
import architekt from '../../project-data/architekt/project.json'
import architektBefore from '../../project-data/architekt/before-exterior-v2.json'
import architect711 from '../../project-data/architekt-7-11/project.json'
import architect711Before from '../../project-data/architekt-7-11/before-exterior-v2.json'
import stairs from '../../project-data/architekt-7-11-stairs-12-6/project.json'
import stairsBefore from '../../project-data/architekt-7-11-stairs-12-6/before-exterior-v2.json'
import version2 from '../../project-data/architekt-7-11-v2/project.json'
import version2Before from '../../project-data/architekt-7-11-v2/before-exterior-v2.json'
import mpzp from '../../project-data/nowe-mpzp/project.json'
import mpzpBefore from '../../project-data/nowe-mpzp/before-exterior-v2.json'
import mpzpV2 from '../../project-data/nowe-mpzp-v2/project.json'
import mpzpV2Before from '../../project-data/nowe-mpzp-v2/before-exterior-v2.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { buildingFootprintsWorld, polygonBounds } from '../domain/geometry'
import { roofWings, gableRoofJunction, gableWallsForBuilding } from '../domain/roofWings'
import { mergeProjects } from '../domain/projectMerge'
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
const source = parseProject(mpzpV2Before)
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it.each(cases)('$name uses the selected v2 site while preserving its complete house geometry and interior', ({ data, before }) => {
  const p = parseProject(data), old = parseProject(before), house = p.buildings[0], oldHouse = old.buildings[0]
  expect(p.site).toEqual(source.site)
  expect(p.landscape).toEqual(source.landscape)
  expect(house.position).toEqual(source.buildings[0].position)
  expect(house.rotationDegrees).toBe(source.buildings[0].rotationDegrees)
  expect({ ...house, position: oldHouse.position, rotationDegrees: oldHouse.rotationDegrees }).toEqual(oldHouse)
  expect(buildingFootprintsWorld(house)[0]).toEqual(buildingFootprintsWorld(source.buildings[0])[0])
  for (const b of p.buildings.slice(1)) expect(b).toEqual(source.buildings.find(s => s.ref === b.ref))
  const restored = { ...p, site: old.site, landscape: old.landscape, buildings: old.buildings, revision: old.revision, updatedAt: old.updatedAt }
  expect(restored).toEqual(old)
  expect(validateProject(p).filter(i => i.severity === 'error')).toEqual([])
  expect(p.landscape.fixtures.filter(f => f.catalogId === 'solar-table-10')).toHaveLength(6)
  expect(p.landscape.fixtures.filter(f => f.catalogId === 'raised-bed-2x1')).toHaveLength(6)
  expect(p.landscape.zones.some(z => /^zone\/nowe-mpzp\/garden\/step-/.test(z.ref) || z.ref.endsWith('grass-border-4'))).toBe(false)
  expect(p.landscape.plants.some(t => /grasses-4-/.test(t.ref))).toBe(false)
  const roofs = roofWings(house).filter(w => w.type === 'gable')
  expect(roofs[0].ridgeElevationM).toBeCloseTo(roofs[1].ridgeElevationM, 8)
  for (const b of p.buildings) for (const wing of roofWings(b).filter(w => w.type === 'gable')) {
    const bounds = polygonBounds(wing.footprint)
    const span = wing.ridgeAxis === 'z' ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ
    const angle = Math.atan2(wing.ridgeElevationM - wing.baseElevationM, span / 2) * 180 / Math.PI
    expect(angle).toBeGreaterThanOrEqual(37); expect(angle).toBeLessThanOrEqual(45)
  }
  expect(gableRoofJunction(house, roofs[1])?.side).toBe('min')
  expect(gableWallsForBuilding(house).some(g => g.segmentRef === roofs[1].ref && g.side === 'min')).toBe(false)
})

it.each(cases)('$name merges the exterior into an existing workspace and preserves independent edits and deletions on reload', async ({ data, before, sync }) => {
  const p = parseProject(data), old = parseProject(before)
  await synchronizePublishedProject(old, old)
  const local = (await loadWorkspace(old.ref))!
  const retainedPlant = old.landscape.plants.find(t => p.landscape.plants.some(s => isDeepStrictEqual(t, s)))!
  expect(retainedPlant).toBeDefined()
  local.project.name += ' user edit'
  local.project.landscape.plants = local.project.landscape.plants.filter(t => t.ref !== retainedPlant.ref)
  local.project.buildings[0].furniture = local.project.buildings[0].furniture!.filter(f => f.ref !== 'interior/office-c5/chair')
  await saveWorkspace(local)
  expect(await sync()).toEqual([])
  const saved = (await loadWorkspace(old.ref))!
  expect(saved.project.name).toBe(local.project.name)
  expect(saved.project.site).toEqual(p.site)
  expect(saved.project.landscape).toEqual({ ...p.landscape, plants: p.landscape.plants.filter(t => t.ref !== retainedPlant.ref) })
  expect(saved.project.buildings[0]).toEqual({ ...p.buildings[0], furniture: p.buildings[0].furniture!.filter(f => f.ref !== 'interior/office-c5/chair') })
  for (const b of p.buildings.slice(1)) expect(saved.project.buildings.find(s => s.ref === b.ref)).toEqual(b)
  expect(await sync()).toEqual([])
  expect(await loadWorkspace(old.ref)).toEqual(saved)
  const moved = old.landscape.fixtures.find(f => p.landscape.fixtures.some(s => s.ref === f.ref && !isDeepStrictEqual(s.position, f.position)))
  if (moved) {
    const deleted = structuredClone(old)
    deleted.landscape.fixtures = deleted.landscape.fixtures.filter(f => f.ref !== moved.ref)
    const merge = mergeProjects(old, deleted, p)
    expect(merge.conflicts).toContain('/landscape/fixtures/' + moved.ref)
    expect(merge.project.landscape.fixtures.some(f => f.ref === moved.ref)).toBe(false)
    const edited = structuredClone(old)
    edited.landscape.fixtures.find(f => f.ref === moved.ref)!.position.x += .37
    expect(mergeProjects(old, edited, p).conflicts).toContain('/landscape/fixtures/' + moved.ref + '/position/x')
  }
})

it('keeps the selected source project byte-for-byte unchanged', () => {
  expect(mpzpV2).toEqual(mpzpV2Before)
})
