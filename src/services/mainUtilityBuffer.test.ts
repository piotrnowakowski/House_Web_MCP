import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
// Pin the completed utility-only revision; later attic-bathroom work has its own regression test.
import currentData from '../../project-data/zielonki-rear-bath-room/before-attic-bathroom-r24.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-utility-buffer-r20.json'
import { validateProject } from '../domain/commands'
import { placementWarnings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const bufferRef = 'interior/49834ba3-bba5-4b94-b07d-4fb94b36e311'
const cabinetRef = 'interior/carport-study/storage'

it('adds the boundary-case 1500 l envelope to favourite GŁÓWNY and changes nothing else', () => {
  const house = current.buildings.find((building) => building.ref === 'house/main')!
  const oldHouse = previous.buildings.find((building) => building.ref === 'house/main')!
  const floor = house.storeys.find((storey) => storey.ref === 'storey/reference-ground')!
  const buffer = house.furniture!.find((item) => item.ref === bufferRef)!
  const cabinet = house.furniture!.find((item) => item.ref === cabinetRef)!

  expect(current.ref).toBe('project/zielonki-rear-bath-room')
  expect(buffer).toMatchObject({
    catalogId: 'thermal-buffer',
    position: { x: -1.85, z: 5.18 },
    widthM: 1.2,
    depthM: 1.2,
    heightM: 2.2,
  })
  expect(cabinet.name).toContain('rozdzielnia')
  expect(cabinet.name).toContain('zawory i liczniki')
  const warnings = placementWarnings(buffer, house, floor)
  expect(warnings.some((warning) => warning.kind === 'overlap' || warning.kind === 'wall' || warning.kind === 'door')).toBe(false)
  expect(warnings).toContainEqual(expect.objectContaining({ ref: cabinetRef, kind: 'circulation' }))
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])

  const restored = structuredClone(current)
  const restoredHouse = restored.buildings.find((building) => building.ref === 'house/main')!
  restoredHouse.furniture = restoredHouse.furniture!
    .filter((item) => item.ref !== bufferRef)
    .map((item) => item.ref === cabinetRef ? oldHouse.furniture!.find((old) => old.ref === cabinetRef)! : item)
  restored.revision = previous.revision
  restored.updatedAt = previous.updatedAt
  expect(restored).toEqual(previous)
})

it('seeds the buffer for a fresh copy and preserves a later user deletion', async () => {
  globalThis.indexedDB = new IDBFactory()
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const saved = (await loadWorkspace(current.ref))!
  expect(saved.project.buildings[0].furniture!.some((item) => item.ref === bufferRef)).toBe(true)

  saved.project.buildings[0].furniture = saved.project.buildings[0].furniture!.filter((item) => item.ref !== bufferRef)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.buildings[0].furniture!.some((item) => item.ref === bufferRef)).toBe(false)
})
