import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-terrace-door-black-slab-r40.json'
import { validateProject } from '../domain/commands'
import { wallLength } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const house = current.buildings.find((building) => building.ref === 'house/main')!
const previousHouse = previous.buildings.find((building) => building.ref === house.ref)!
const living = house.spaces.find((space) => space.ref === 'space/reference-living')!
const wall = house.walls.find((entry) => entry.ref === 'wall/carport-layout/ground/3')!
const doorRef = 'opening/living-terrace-door'
const door = wall.openings.find((opening) => opening.ref === doorRef)!
const slab = house.slabs.find((entry) => entry.ref === 'slab/reference-upper')!
const mainRoof = house.roof.segments.find((segment) => segment.ref === 'roof/reference/rear-barn')!
const pergola = house.roof.segments.find((segment) => segment.ref === 'roof/reference/courtyard-canopy')!

it('adds a centred living-room terrace door directly under the retained pergola', () => {
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(living.boundary.some((edge) => edge.wallRef === wall.ref)).toBe(true)
  expect(wallLength(wall)).toBeCloseTo(2.41)
  expect(door).toMatchObject({
    kind: 'door',
    glazed: true,
    wallRef: wall.ref,
    offsetM: 1.205,
    widthM: 1.8,
    heightM: 2.3,
    sillM: 0,
  })
  expect(door.offsetM - door.widthM / 2).toBeCloseTo(0.305)
  expect(wallLength(wall) - door.offsetM - door.widthM / 2).toBeCloseTo(0.305)
  expect(pergola.footprint.some((point) => point.x === wall.end.x && point.z === wall.end.z)).toBe(true)
  expect(pergola.footprint.some((point) => point.z === wall.start.z && point.x > wall.start.x)).toBe(true)
})

it('colours only the exposed slab edge like the roof without changing geometry', () => {
  expect(slab.edgeColorHex).toBe('#2D3435')
  expect(slab.edgeColorHex).toBe(mainRoof.finish.colorHex)
  expect({ ...slab, edgeColorHex: undefined }).toEqual({
    ...previousHouse.slabs.find((entry) => entry.ref === slab.ref)!,
    edgeColorHex: undefined,
  })
  expect(house.roof).toEqual(previousHouse.roof)
})

it('migrates r40 while preserving an independent name and a later door deletion', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.name = 'Mój GŁÓWNY z tarasem'
  await saveWorkspace(saved)

  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!
  expect(merged.project.name).toBe('Mój GŁÓWNY z tarasem')
  expect(merged.project.buildings.flatMap((building) => building.walls).flatMap((entry) => entry.openings))
    .toContainEqual(door)

  for (const building of merged.project.buildings) {
    for (const entry of building.walls) entry.openings = entry.openings.filter((opening) => opening.ref !== doorRef)
  }
  await saveWorkspace(merged)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.buildings.flatMap((building) => building.walls)
    .flatMap((entry) => entry.openings).some((opening) => opening.ref === doorRef)).toBe(false)
})
