import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-kitchen-garden-r79.json'
import { validateProject } from '../domain/commands'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { pointInPolygon } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { landUseAreas } from '../domain/zoning'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const starterRefs = previous.landscape.fixtures.filter((fixture) => fixture.ref.startsWith('fixture-set/starter-1/')).map((fixture) => fixture.ref)
const garden = current.landscape.fixtures.filter((fixture) => fixture.ref.startsWith('fixture/kitchen-garden/'))
const greenhouse = current.landscape.fixtures.find((fixture) => fixture.ref === 'fixture/kitchen-garden/greenhouse')!

it('publishes the GŁÓWNY kitchen garden as r80 without touching buildings or site', () => {
  expect(current.revision).toBe(80)
  expect(previous.revision).toBe(79)
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])
  expect({ ...current, revision: 0, updatedAt: '', landscape: null }).toEqual({ ...previous, revision: 0, updatedAt: '', landscape: null })
  // The kitchen garden replaces the three starter beds; every other earlier landscape record is retained.
  expect(starterRefs).toHaveLength(6)
  expect(current.landscape.fixtures.filter((fixture) => !fixture.ref.startsWith('fixture/kitchen-garden/')))
    .toEqual(previous.landscape.fixtures.filter((fixture) => !starterRefs.includes(fixture.ref)))
  expect(current.landscape.plants.slice(0, previous.landscape.plants.length)).toEqual(previous.landscape.plants)
  expect(current.landscape.zones.slice(0, previous.landscape.zones.length)).toEqual(previous.landscape.zones)
  expect(garden.filter((fixture) => fixture.catalogId === 'larch-bed-long')).toHaveLength(8)
})

it('keeps the greenhouse on residential land and every garden corner inside the owned parcels', () => {
  const definition = gardenFixtureById(greenhouse.catalogId)
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({ x: greenhouse.position.x + x * definition.widthM / 2, z: greenhouse.position.z + z * definition.depthM / 2 }))
  const construction = landUseAreas(current).filter((area) => area.landRole === 'construction')
  // MPZP §28 prohibits new buildings on 06.R.21, so the greenhouse must stay entirely within 06.MNU.8.
  expect(corners.every((corner) => construction.some((area) => pointInPolygon(corner, area.boundary)))).toBe(true)
})

it('migrates a saved r79 workspace, removing starter beds while preserving an independent edit and a later deletion', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.name = 'Mój GŁÓWNY z ogrodem'
  await saveWorkspace(saved)

  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!
  expect(merged.project.name).toBe('Mój GŁÓWNY z ogrodem')
  expect(merged.project.landscape.fixtures.some((fixture) => starterRefs.includes(fixture.ref))).toBe(false)
  expect(merged.project.landscape.fixtures).toContainEqual(greenhouse)

  merged.project.landscape.fixtures = merged.project.landscape.fixtures.filter((fixture) => fixture.ref !== greenhouse.ref)
  await saveWorkspace(merged)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.landscape.fixtures.some((fixture) => fixture.ref === greenhouse.ref)).toBe(false)
})
