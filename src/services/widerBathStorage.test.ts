import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-roof-join-r66.json'
import previous from '../../project-data/zielonki-v2/before-wider-bath-storage-r65.json'
import { validateProject } from '../domain/commands'
import { polygonBounds, spaceFootprint } from '../domain/geometry'
import { itemFitsFloor } from '../domain/interior'
import { placementWarnings } from '../domain/interiorPlacement'
import { parseProject } from '../domain/schema'
import type { InteriorItem } from '../domain/types'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const project = parseProject(data), source = parseProject(previous)
const house = project.buildings[0], before = source.buildings[0]

it('gives bathroom and storage 50 cm of the guest room without changing the envelope or upper floor', () => {
  for (const ref of ['space/reference-wc', 'space/reference-pantry']) {
    const now = polygonBounds(spaceFootprint(house, house.spaces.find(s => s.ref === ref)!))
    const old = polygonBounds(spaceFootprint(before, before.spaces.find(s => s.ref === ref)!))
    expect(now.maxX - old.maxX).toBeCloseTo(.5)
    expect(now.minX).toBe(old.minX)
    expect(now.minZ).toBe(old.minZ)
    expect(now.maxZ).toBe(old.maxZ)
  }
  expect(house.walls.filter(w => house.storeys[1].wallRefs.includes(w.ref))).toEqual(before.walls.filter(w => before.storeys[1].wallRefs.includes(w.ref)))
  expect(house.slabs).toEqual(before.slabs)
  expect(house.roof).toEqual(before.roof)
  expect(project.landscape).toEqual(source.landscape)
  expect(project.buildings.slice(1)).toEqual(source.buildings.slice(1))
  expect(validateProject(project)).toEqual(validateProject(source))
})

it('keeps a 2 m sofa clear of the relocated doorway, desk and bed', () => {
  const sofa: InteriorItem = { ref: 'test/sofa', catalogId: 'sofa', storeyRef: house.storeys[0].ref,
    name: 'Sofa clearance', position: { x: 0, z: 2.52 }, widthM: 2, depthM: .9, heightM: .85, rotationDegrees: 0, color: '#aaaaaa' }
  const room = house.spaces.find(s => s.ref === 'space/reference-office')!
  expect(itemFitsFloor(sofa, spaceFootprint(house, room))).toBe(true)
  expect(placementWarnings(sofa, house, house.storeys[0])).toEqual([])
  const wall = house.walls.find(w => w.ref === 'wall/carport-layout/ground/5')!
  const door = wall.openings.find(o => o.ref === 'opening/reference-office')!
  const leftJamb = wall.start.x - door.offsetM - door.widthM / 2
  expect(leftJamb).toBeGreaterThan(sofa.position.x + sofa.widthM / 2)
  expect(door.widthM).toBe(.9)
  expect(house.furniture!.some(f => f.ref === sofa.ref)).toBe(false)
})

it('migrates the room edit while retaining unrelated deletions across save and reload', async () => {
  globalThis.indexedDB = new IDBFactory()
  const local = structuredClone(source)
  local.buildings[1].furniture!.pop()
  local.buildings[0].spaces[0].name = 'My bedroom'
  await saveWorkspace({ version: 1, project: local, proposals: [], draftChangeSets: [] })
  expect(await synchronizePublishedProject(project, source)).toEqual([])
  const saved = (await loadWorkspace(project.ref))!
  expect(saved.project.buildings[0].walls.find(w => w.ref === 'wall/carport-layout/ground/9')!.start.x).toBe(-1.13)
  expect(saved.project.buildings[1].furniture).toHaveLength(local.buildings[1].furniture!.length)
  expect(saved.project.buildings[0].spaces[0].name).toBe('My bedroom')
  expect(saved.project.buildings[0].walls.flatMap(w => w.openings).some(o => o.ref === 'opening/reference-pantry')).toBe(false)
  await saveWorkspace(saved)
  expect(await synchronizePublishedProject(project, source)).toEqual([])
  expect((await loadWorkspace(project.ref))!.project).toEqual(saved.project)
})
