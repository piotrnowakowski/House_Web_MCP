import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import beforeData from '../../project-data/paulina-poprawki/before-bedroom-r5.json'
import mistakenData from '../../project-data/paulina-poprawki/before-marked-wall-r8.json'
import restoredWallData from '../../project-data/paulina-poprawki/before-both-walls-r9.json'
import openEntranceData from '../../project-data/paulina-poprawki/before-entrance-closure-r11.json'
import throughRoomData from '../../project-data/paulina-poprawki/before-independent-entrances-r13.json'
import data from '../../project-data/paulina-poprawki/project.json'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

it.each([beforeData, mistakenData, restoredWallData, openEntranceData])('migrates wall deletions and the closed entrance while retaining independent edits', async (baseline) => {
  globalThis.indexedDB = new IDBFactory()
  const before = parseProject(baseline), current = parseProject(data)
  await synchronizePublishedProject(before, before)
  const saved = (await loadWorkspace(before.ref))!
  saved.project.buildings[0].furniture![0].color = '#123456'
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, before)).toEqual([])
  await synchronizePublishedProject(current, before)
  const house = (await loadWorkspace(before.ref))!.project.buildings[0]
  expect(house.walls.some(w => w.ref === 'wall/paulina/upper/2')).toBe(false)
  expect(house.walls.some(w => w.ref === 'wall/paulina/upper/15')).toBe(false)
  expect(house.walls.find(w => w.ref === 'wall/paulina/upper/20')).toMatchObject({heightM:2.8,start:{z:1.135},end:{z:1.135}})
  expect(house.walls.find(w => w.ref === 'wall/paulina/upper/19')?.heightM).toBe(1.05)
  const entrance = house.walls.find(w => w.ref === 'wall/paulina/upper/3')!
  const guard = house.walls.find(w => w.ref === 'wall/paulina/upper/19')!
  expect(entrance.start).toEqual(guard.start)
  expect(entrance.openings[0].ref).toBe('opening/reference-parents')
  expect(entrance.start.x - entrance.openings[0].offsetM).toBeCloseTo(-1.065, 8)
  expect(house.spaces.find(r => r.ref === 'space/reference-parents')?.boundary.some(u => u.wallRef === entrance.ref)).toBe(true)
  expect(house.spaces.some(r => r.ref === 'space/reference-landing')).toBe(true)
  expect(house.furniture!.find(f => f.ref === 'interior/reference-parents-bed')).toMatchObject({ position: { x: -3.375, z: -3.945 }, rotationDegrees: 90 })
  expect(house.furniture![0].color).toBe('#123456')
  expect(house.roof).toEqual(before.buildings[0].roof)
})

it('gives every upstairs room its own corridor entrance without a door between bedrooms', async () => {
  globalThis.indexedDB = new IDBFactory()
  const before = parseProject(throughRoomData), current = parseProject(data)
  await synchronizePublishedProject(before, before)
  const saved = (await loadWorkspace(before.ref))!
  const removed = saved.project.buildings[0].furniture!.pop()!.ref
  saved.project.buildings[0].furniture![0].color = '#123456'
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(current, before)).toEqual([])
  await synchronizePublishedProject(current, before)
  const house = (await loadWorkspace(current.ref))!.project.buildings[0]
  const upper = house.storeys.find(s => s.ref === 'storey/reference-upper')!
  const hall = house.spaces.find(s => s.ref === 'space/reference-landing')!
  for (const room of house.spaces.filter(s => upper.spaceRefs.includes(s.ref) && s.ref !== hall.ref)) {
    const directDoors = house.walls.filter(w => room.boundary.some(u => u.wallRef === w.ref) && hall.boundary.some(u => u.wallRef === w.ref))
      .flatMap(w => w.openings.filter(o => o.kind === 'door'))
    expect(directDoors, room.name).toHaveLength(1)
  }
  expect(house.walls.find(w => w.ref === 'wall/paulina/upper/10')!.openings.filter(o => o.kind === 'door')).toEqual([])
  expect(house.walls.find(w => w.ref === 'wall/paulina/upper/9')!.openings).toEqual([
    expect.objectContaining({ ref: 'opening/reference-child-one', wallRef: 'wall/paulina/upper/9', offsetM: 0.63, widthM: 0.85, hinge: 'right', swing: 'in' }),
  ])
  expect(house.walls.flatMap(w => w.openings).filter(o => o.ref === 'opening/reference-child-one')).toHaveLength(1)
  expect(house.furniture!.some(item => item.ref === removed)).toBe(false)
  expect(house.furniture![0].color).toBe('#123456')
  expect(house.roof).toEqual(before.buildings[0].roof)
  expect(house.slabs).toEqual(before.buildings[0].slabs)
})
