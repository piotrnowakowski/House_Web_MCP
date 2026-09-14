import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-v2/project.json'
import previousData from '../../project-data/zielonki-v2/before-utility-buffer-r72.json'
import { validateProject } from '../domain/commands'
import { placementWarnings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const bufferRef = 'interior/510a8506-632d-40e7-9d39-06e2d87848c2'

it('reserves the 1500 l buffer envelope and labels the existing systems cabinet without changing the house', () => {
  const house = current.buildings.find((building) => building.ref === 'house/main')!
  const oldHouse = previous.buildings.find((building) => building.ref === 'house/main')!
  const buffer = house.furniture!.find((item) => item.ref === bufferRef)!
  const cabinet = house.furniture!.find((item) => item.ref === 'interior/carport-study/storage')!
  const floor = house.storeys.find((storey) => storey.ref === 'storey/reference-ground')!

  expect(buffer).toMatchObject({
    catalogId: 'thermal-buffer',
    position: { x: -1.85, z: 4.95 },
    widthM: 1.2,
    depthM: 1.2,
    heightM: 2.2,
  })
  expect(cabinet.name).toContain('rozdzielnia')
  expect(cabinet.name).toContain('zawory i liczniki')
  expect(placementWarnings(buffer, house, floor)).toEqual([])
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])

  expect(house.walls).toEqual(oldHouse.walls)
  expect(house.slabs).toEqual(oldHouse.slabs)
  expect(house.roof).toEqual(oldHouse.roof)
  expect(current.landscape).toEqual(previous.landscape)
  expect(house.furniture!.filter((item) => item.ref !== bufferRef && item.ref !== cabinet.ref))
    .toEqual(oldHouse.furniture!.filter((item) => item.ref !== cabinet.ref))
})

it('seeds the buffer for a fresh project and preserves a later user deletion through synchronization and reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  let saved = (await loadWorkspace(current.ref))!
  expect(saved.project.buildings[0].furniture!.some((item) => item.ref === bufferRef)).toBe(true)

  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter((item) => item.ref !== bufferRef)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  saved = (await loadWorkspace(current.ref))!
  expect(saved.project.buildings[0].furniture!.some((item) => item.ref === bufferRef)).toBe(false)
  await saveWorkspace(saved)
  expect((await loadWorkspace(current.ref))!.project).toEqual(saved.project)

  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(current, previous)
  expect((await loadWorkspace(current.ref))!.project.buildings[0].furniture!.some((item) => item.ref === bufferRef)).toBe(true)
})
