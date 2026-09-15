import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-entry-wardrobe-r38.json'
import { validateProject } from '../domain/commands'
import { availableInteriorHeight, interiorCorners } from '../domain/interior'
import { placementWarnings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const house = current.buildings.find((building) => building.ref === 'house/main')!
const ground = house.storeys.find((storey) => storey.ref === 'storey/reference-ground')!
const wardrobe = house.furniture!.find((item) => item.ref === 'interior/entry-hall/wardrobe')!

it('fits the entrance wardrobe to the ceiling without blocking either door', () => {
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(wardrobe).toMatchObject({
    catalogId: 'wardrobe',
    storeyRef: ground.ref,
    position: { x: -3.23, z: 1.21 },
    widthM: 1.2,
    depthM: 0.6,
    heightM: 2.8,
    rotationDegrees: 0,
  })
  expect(wardrobe.heightM).toBeCloseTo(availableInteriorHeight(wardrobe, house, ground))
  const expectedCorners = [
    { x: -3.83, z: 0.91 },
    { x: -2.63, z: 0.91 },
    { x: -2.63, z: 1.51 },
    { x: -3.83, z: 1.51 },
  ]
  interiorCorners(wardrobe).forEach((corner, index) => {
    expect(corner.x).toBeCloseTo(expectedCorners[index].x)
    expect(corner.z).toBeCloseTo(expectedCorners[index].z)
  })
  expect(placementWarnings(wardrobe, house, ground).filter((warning) => warning.kind !== 'circulation')).toEqual([])
})

it('adds the wardrobe to an existing saved r38 project while preserving an independent edit', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.name = 'Mój GŁÓWNY'
  await saveWorkspace(saved)

  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!.project
  expect(merged.name).toBe('Mój GŁÓWNY')
  expect(merged.buildings.find((building) => building.ref === 'house/main')!.furniture)
    .toContainEqual(wardrobe)
})
