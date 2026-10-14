import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-compact-garden-r81.json'
import { parseProject } from '../domain/schema'
import { validateProject } from '../domain/commands'
import { pointInPolygon } from '../domain/geometry'
import { landUseAreas } from '../domain/zoning'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData), previous = parseProject(previousData)
const prefix = 'fixture/kitchen-garden/'
const beds = current.landscape.fixtures.filter(f => f.catalogId === 'larch-bed-long' || f.catalogId === 'larch-bed-square' || f.catalogId === 'raised-bed-2x1')
const removed = previous.landscape.fixtures.filter(old => !current.landscape.fixtures.some(f => f.ref === old.ref)).map(f => f.ref)

it('fits exactly six existing beds in a compact block with aligned crops and clear aisles', () => {
  expect(current.revision).toBe(83)
  expect(validateProject(current).filter(i => i.severity === 'error')).toEqual([])
  expect(beds).toHaveLength(6)
  expect(new Set(beds.map(f => f.position.x)).size).toBe(2)
  expect(new Set(beds.map(f => f.position.z)).size).toBe(3)
  for (const bed of beds) {
    expect(bed.catalogId).toBe('larch-bed-long')
    expect(bed.rotationDegrees).toBe(0)
    const crop = current.landscape.fixtures.find(f => f.ref === bed.ref.replace('/bed-', '/crop-'))!
    expect(crop.position).toEqual(bed.position)
    expect(crop.rotationDegrees).toBe(bed.rotationDegrees)
    expect(previous.landscape.fixtures.some(f => f.ref === bed.ref)).toBe(true)
    // No existing mapped tree trunk may be enclosed by a planter.
    for (const tree of current.landscape.plants) expect(
      Math.abs(tree.position.x - bed.position.x) <= 1.82 && Math.abs(tree.position.z - bed.position.z) <= 0.62,
    ).toBe(false)
  }
  const xs = [...new Set(beds.map(f => f.position.x))].sort((a, b) => a - b)
  const zs = [...new Set(beds.map(f => f.position.z))].sort((a, b) => a - b)
  expect(xs[1] - xs[0] - 3.64).toBeGreaterThanOrEqual(1.2)
  expect(zs[1] - zs[0] - 1.24).toBeGreaterThanOrEqual(1.2)
  expect(zs[2] - zs[1] - 1.24).toBeGreaterThanOrEqual(1.2)
  const enclosure = current.landscape.zones.filter(z => ['/potager', '/greenhouse-apron'].some(s => z.ref.endsWith(s))).flatMap(z => z.footprint)
  const width = Math.max(...enclosure.map(p => p.x)) - Math.min(...enclosure.map(p => p.x))
  const depth = Math.max(...enclosure.map(p => p.z)) - Math.min(...enclosure.map(p => p.z))
  expect(width).toBeCloseTo(9)
  expect(depth).toBeCloseTo(12)
  expect(depth / width).toBeLessThan(1.4)
  const greenhouse = current.landscape.fixtures.find(f => f.catalogId === 'greenhouse')!
  const construction = landUseAreas(current).filter(a => a.landRole === 'construction')
  for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) expect(construction.some(a => pointInPolygon({ x: greenhouse.position.x + x, z: greenhouse.position.z + z }, a.boundary))).toBe(true)
})

it('limits the revision to the garden layout while preserving surfaces, trees, the house and the fire lounge', () => {
  expect(current.buildings).toEqual(previous.buildings)
  expect(current.site).toEqual(previous.site)
  expect(current.landscape.plants).toEqual(previous.landscape.plants)
  expect(current.landscape.fixtures.filter(f => !f.ref.startsWith(prefix))).toEqual(previous.landscape.fixtures.filter(f => !f.ref.startsWith(prefix)))
  const dining = (p: typeof current) => p.landscape.fixtures.find(f => f.ref === prefix + 'dining')
  expect(dining(current)).toEqual(dining(previous))
  for (const zone of current.landscape.zones) {
    const old = previous.landscape.zones.find(z => z.ref === zone.ref)!
    expect(zone.textureId).toBe(old.textureId)
    if (!zone.ref.startsWith('zone/kitchen-garden/')) expect(zone).toEqual(old)
  }
  expect(removed).toHaveLength(31)
  expect(removed.every(ref => ref.startsWith(prefix))).toBe(true)
})

it('merges r81 into six beds, preserves independent edits, and does not resurrect removed planters on reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.buildings[0].spaces[0].name = 'Independent room edit'
  saved.project.landscape.plants = saved.project.landscape.plants.filter(p => p.ref !== 'plant/kitchen-garden/apple-1')
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!
  expect(merged.project.buildings[0].spaces[0].name).toBe('Independent room edit')
  expect(merged.project.landscape.plants.some(p => p.ref === 'plant/kitchen-garden/apple-1')).toBe(false)
  expect(merged.project.landscape.fixtures.filter(f => f.catalogId.startsWith('larch-bed'))).toHaveLength(6)
  expect(removed.some(ref => merged.project.landscape.fixtures.some(f => f.ref === ref))).toBe(false)
  await saveWorkspace(merged)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const reloaded = (await loadWorkspace(current.ref))!
  expect(removed.some(ref => reloaded.project.landscape.fixtures.some(f => f.ref === ref))).toBe(false)
  // A later user deletion also survives the next load/synchronization.
  reloaded.project.landscape.fixtures = reloaded.project.landscape.fixtures.filter(f => ![prefix + 'bed-nw1', prefix + 'crop-nw1'].includes(f.ref))
  await saveWorkspace(reloaded)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.landscape.fixtures.some(f => f.ref === prefix + 'bed-nw1')).toBe(false)
})
