import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-office-r27.json'
import { validateProject } from '../domain/commands'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const officePrefix = 'interior/office-c5/'
const openingRef = 'opening/reference-office-window'

it('publishes the complete office and converts the retained opening into a terrace door', () => {
  const house = current.buildings.find((building) => building.ref === 'house/main')!
  const items = house.furniture!.filter((item) => item.ref.startsWith(officePrefix))
  const opening = house.walls.flatMap((wall) => wall.openings).find((item) => item.ref === openingRef)

  expect(items.map((item) => item.ref)).toEqual([
    `${officePrefix}desk`,
    `${officePrefix}monitor`,
    `${officePrefix}chair`,
    `${officePrefix}sofa`,
    `${officePrefix}wardrobe`,
  ])
  expect(items.find((item) => item.ref.endsWith('/desk'))).toMatchObject({ widthM: 1.7, depthM: 0.8 })
  expect(items.find((item) => item.ref.endsWith('/wardrobe'))).toMatchObject({
    productId: 'pax',
    variantId: '49500652',
  })
  expect(opening).toMatchObject({
    kind: 'door',
    widthM: 1.8,
    heightM: 2.3,
    sillM: 0,
    glazed: true,
  })
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])

  const restored = structuredClone(current)
  const restoredHouse = restored.buildings.find((building) => building.ref === 'house/main')!
  const previousHouse = previous.buildings.find((building) => building.ref === 'house/main')!
  const previousDesk = previousHouse.furniture!.find((item) => item.ref === 'interior/carport-study/desk')!
  restoredHouse.furniture = restoredHouse.furniture!.filter((item) => !item.ref.startsWith(officePrefix))
  const insertionIndex = previousHouse.furniture!.findIndex((item) => item.ref === previousDesk.ref)
  restoredHouse.furniture.splice(insertionIndex, 0, previousDesk)
  const restoredOpening = restoredHouse.walls.flatMap((wall) => wall.openings).find((item) => item.ref === openingRef)!
  Object.assign(restoredOpening, previousHouse.walls.flatMap((wall) => wall.openings).find((item) => item.ref === openingRef))
  restored.revision = previous.revision
  restored.updatedAt = previous.updatedAt
  expect(restored).toEqual(previous)
})

it('seeds the office for a fresh copy and preserves a later furniture deletion', async () => {
  globalThis.indexedDB = new IDBFactory()
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const saved = (await loadWorkspace(current.ref))!
  const savedHouse = saved.project.buildings.find((building) => building.ref === 'house/main')!
  expect(savedHouse.furniture!.some((item) => item.ref === `${officePrefix}sofa`)).toBe(true)

  savedHouse.furniture = savedHouse.furniture!.filter((item) => item.ref !== `${officePrefix}sofa`)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const reloadedHouse = (await loadWorkspace(current.ref))!.project.buildings.find((building) => building.ref === 'house/main')!
  expect(reloadedHouse.furniture!.some((item) => item.ref === `${officePrefix}sofa`)).toBe(false)
})
