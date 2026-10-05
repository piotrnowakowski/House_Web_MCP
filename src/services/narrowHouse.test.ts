import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-wider-bath-storage-r65.json'
import previous from '../../project-data/zielonki-v2/before-narrow-house-r64.json'
import { validateProject } from '../domain/commands'
import { polygonArea, polygonBounds, spaceFootprint } from '../domain/geometry'
import { roofSegmentRidgeElevation } from '../domain/roofs'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const project = parseProject(data), source = parseProject(previous)
const house = project.buildings[0], before = source.buildings[0]
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('narrows the whole left facade 1.5 m and retains the aligned rectangular ground-floor layout', () => {
  for (const slab of house.slabs) {
    const old = before.slabs.find(s => s.ref === slab.ref)!
    expect(polygonBounds(slab.footprint).minX).toBeCloseTo(-4.095)
    expect(polygonArea(old.footprint) - polygonArea(slab.footprint)).toBeCloseTo(1.5 * 13.64)
  }
  for (const wall of house.walls.filter(w => house.storeys[0].wallRefs.includes(w.ref))) {
    expect(Math.min(Math.abs(wall.start.x - wall.end.x), Math.abs(wall.start.z - wall.end.z))).toBeLessThan(1e-9)
  }
  for (const number of [5, 7]) expect(house.walls.find(w => w.ref === `wall/carport-layout/ground/${number}`)!.start.z).toBe(1.915)
  for (const ref of ['space/reference-wc', 'space/reference-pantry', 'space/reference-living']) {
    const area = polygonArea(spaceFootprint(house, house.spaces.find(s => s.ref === ref)!))
    expect(area).toBeLessThan(polygonArea(spaceFootprint(before, before.spaces.find(s => s.ref === ref)!)))
  }
  expect(validateProject(project)).toEqual(validateProject(source))
})

it('removes only the bathroom/storage doorway and keeps external access clear', () => {
  const wall = house.walls.find(w => w.ref === 'wall/carport-layout/ground/10')!
  expect(wall.openings).toEqual([])
  const openings = house.walls.flatMap(w => w.openings)
  expect(openings.some(o => o.ref === 'opening/reference-pantry')).toBe(false)
  expect(openings.find(o => o.ref === 'opening/reference-utility-exterior')!.swing).toBe('out')
  expect(openings.some(o => o.ref === 'opening/reference-entrance')).toBe(true)
  expect(house.spaces.map(s => s.ref)).toEqual(before.spaces.map(s => s.ref))
})

it('moves stairs and both void edges together, preserving stair dimensions and landing space', () => {
  expect(house.stairs![0].start.x - before.stairs![0].start.x).toBeCloseTo(1.5)
  expect(house.stairs![0].runM).toBe(before.stairs![0].runM)
  expect(house.stairs![0].steps).toBe(before.stairs![0].steps)
  const [stairs, living] = house.slabs[1].holes!.map(polygonBounds)
  expect(living.minX - stairs.maxX).toBeCloseTo(.63)
  expect(house.furniture!.find(f => f.ref === 'interior/reference-island')!.position.x).toBeCloseTo(-1.385)
  expect(house.furniture!.find(f => f.ref === 'interior/reference-parents-bed')!.position.x).toBeCloseTo(-2.745)
})

it('keeps roof pitch and eaves while lowering the narrower gable ridge and preserving other buildings', () => {
  for (const segment of house.roof.segments) {
    const old = before.roof.segments.find(s => s.ref === segment.ref)!
    expect(segment.pitchDegrees).toBe(old.pitchDegrees)
    expect(segment.baseElevationM).toBe(old.baseElevationM)
    if (segment.ref === 'roof/reference/front-barn') {
      expect(roofSegmentRidgeElevation(old) - roofSegmentRidgeElevation(segment)).toBeCloseTo(.75 * Math.tan(segment.pitchDegrees * Math.PI / 180))
    } else expect(segment).toEqual(old)
  }
  expect(project.buildings.slice(1)).toEqual(source.buildings.slice(1))
  expect(project.site).toEqual(source.site)
  expect(project.landscape.zones.filter(z => z.ref !== 'zone/path')).toEqual(source.landscape.zones.filter(z => z.ref !== 'zone/path'))
})

it('preserves the removed doorway across migration/save/reload and keeps independent edits', async () => {
  const local = structuredClone(source)
  local.buildings[0].spaces[0].name = 'My bedroom'
  local.buildings[1].furniture!.pop()
  await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
  expect(await synchronizePublishedProject(project, source)).toEqual([])
  const saved = (await loadWorkspace(project.ref))!
  expect(saved.project.buildings[0].spaces[0].name).toBe('My bedroom')
  expect(saved.project.buildings[1].furniture).toHaveLength(local.buildings[1].furniture!.length)
  expect(saved.project.buildings[0].walls.flatMap(w => w.openings).some(o => o.ref === 'opening/reference-pantry')).toBe(false)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(project, source)).toEqual([])
  expect((await loadWorkspace(project.ref))!.project).toEqual(saved.project)
})
