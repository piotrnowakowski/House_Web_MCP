import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-narrow-house-r64.json'
import publishedBefore from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import workingBefore from '../../project-data/zielonki-v2/before-short-hall-working-r63.json'
import { validateProject } from '../domain/commands'
import { polygonArea, spaceFootprint, wallLength } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import type { ProjectV2 } from '../domain/types'
import { listWorkspaces, loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const project = parseProject(data), source = parseProject(workingBefore), baseline = parseProject(publishedBefore)
const house = project.buildings[0], before = source.buildings[0]
const prefix = 'wall/carport-layout/ground/'
beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

it('shortens both floor outlines by 1.5 m with supported end walls and unchanged roof slopes', () => {
  for (const slab of house.slabs) {
    const original = before.slabs.find(s => s.ref === slab.ref)!
    expect(Math.max(...slab.footprint.map(p => p.z))).toBeCloseTo(6.985)
    expect(polygonArea(original.footprint) - polygonArea(slab.footprint)).toBeCloseTo(7.78 * 1.5)
    expect(slab.holes).toEqual(original.holes)
  }
  for (const ref of [prefix + '13', prefix + '16', 'wall/reference-upper/21', 'wall/reference-upper/24']) {
    const wall = house.walls.find(w => w.ref === ref)!
    expect(wall.start.z).toBeCloseTo(6.885)
    expect(wall.end.z).toBeCloseTo(6.885)
  }
  for (const segment of house.roof.segments.filter(s => s.type === 'gable')) {
    expect(segment.pitchDegrees).toBeCloseTo(40.13423424862029, 10)
    expect(segment.baseElevationM).toBe(4.85)
  }
  expect(Math.max(...house.roof.segments.find(s => s.ref === 'roof/reference/front-barn')!.footprint.map(p => p.z))).toBeCloseTo(6.885)
  expect(house.storeys[1].kneeWallHeightM).toBe(1.4)
})

it('aligns bathroom and office fronts, removes the return, and keeps the connected rooms rectangular', () => {
  for (const ref of [prefix + '5', prefix + '7']) {
    const wall = house.walls.find(w => w.ref === ref)!
    expect(wall.start.z).toBeCloseTo(1.915)
    expect(wall.end.z).toBeCloseTo(1.915)
  }
  expect(house.walls.some(w => w.ref === prefix + '6')).toBe(false)
  expect(house.spaces.some(s => s.boundary.some(b => b.wallRef === prefix + '6'))).toBe(false)
  expect(house.storeys[0].wallRefs).not.toContain(prefix + '6')
  for (const wall of house.walls.filter(w => house.storeys[0].wallRefs.includes(w.ref))) {
    expect(Math.min(Math.abs(wall.start.x - wall.end.x), Math.abs(wall.start.z - wall.end.z))).toBeLessThan(1e-9)
  }
  for (const ref of ['space/reference-wc', 'space/reference-pantry']) {
    expect(polygonArea(spaceFootprint(house, house.spaces.find(s => s.ref === ref)!)))
      .toBeCloseTo(polygonArea(spaceFootprint(before, before.spaces.find(s => s.ref === ref)!)))
  }
  expect(validateProject(project)).toEqual(validateProject(source))
})

it('moves hosted doors, windows and furniture with their rooms and retains unrelated edits and deletions', () => {
  const openingZ = (p: ProjectV2, ref: string) => {
    const wall = p.buildings[0].walls.find(w => w.openings.some(o => o.ref === ref))!
    const opening = wall.openings.find(o => o.ref === ref)!
    return wall.start.z + (wall.end.z - wall.start.z) * opening.offsetM / wallLength(wall)
  }
  for (const ref of ['opening/reference-entrance', 'opening/reference-utility-exterior', 'opening/reference-wc', 'opening/reference-pantry']) {
    expect(openingZ(source, ref) - openingZ(project, ref)).toBeCloseTo(1.5)
  }
  expect(openingZ(source, 'opening/reference-office-window') - openingZ(project, 'opening/reference-office-window')).toBeCloseTo(1.685)
  expect(house.furniture!.find(f => f.ref === 'interior/reference-understairs')!.position.z).toBeCloseTo(-.535)
  expect(project.name).toBe(source.name)
  expect(project.buildings.slice(1)).toEqual(source.buildings.slice(1))
  expect(project.site).toEqual(source.site)
  expect({ ...project.landscape, fixtures: [] }).toEqual({ ...source.landscape, fixtures: [] })
  for (const fixture of project.landscape.fixtures) {
    const original = source.landscape.fixtures.find(f => f.ref === fixture.ref)!
    expect({ ...fixture, position: null }).toEqual({ ...original, position: null })
    // CDP's structured-value export rounds these two pre-existing x coordinates.
    expect(fixture.position.x).toBeCloseTo(original.position.x, 12)
    expect(fixture.position.z).toBeCloseTo(original.position.z, 12)
  }
  expect(house.stairs).toEqual(before.stairs)
})

it('loads in a fresh workspace and migrates a saved project while preserving independent edits and deletions', async () => {
  expect(await synchronizePublishedProject(project, baseline)).toEqual([])
  expect((await loadWorkspace(project.ref))!.project).toEqual(project)
  globalThis.indexedDB = new IDBFactory()
  const local = structuredClone(baseline)
  local.buildings[0].spaces[0].name = 'Retained room name'
  local.buildings[1].furniture!.pop()
  await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
  expect(await synchronizePublishedProject(project, baseline)).toEqual([])
  const saved = (await loadWorkspace(project.ref))!
  expect(saved.project.buildings[0].spaces[0].name).toBe('Retained room name')
  expect(saved.project.buildings[1].furniture).toHaveLength(local.buildings[1].furniture!.length)
  expect(saved.project.buildings[0].walls.some(w => w.ref === prefix + '6')).toBe(false)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(project, baseline)).toEqual([])
  expect((await loadWorkspace(project.ref))!.project).toEqual(saved.project)
})

it('preserves both versions when a different saved wall edit conflicts with the shorter hall', async () => {
  await saveWorkspace({ version: 1, project: source, proposals: [], draftChangeSets: [] })
  expect((await synchronizePublishedProject(project, baseline)).length).toBeGreaterThan(0)
  expect((await loadWorkspace(source.ref))!.project).toEqual(source)
  expect((await listWorkspaces()).some(w => w.ref.startsWith(source.ref + '/published-'))).toBe(true)
})
