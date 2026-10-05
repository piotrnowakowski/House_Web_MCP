import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import currentData from '../../project-data/zielonki-rear-bath-room/project.json'
import previousData from '../../project-data/zielonki-rear-bath-room/before-upper-bath-window-r39.json'
import { atticWallProfile, wallProfileHeightAt } from '../domain/attic'
import { validateProject } from '../domain/commands'
import { wallLength } from '../domain/geometry'
import { parseProject } from '../domain/schema'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'

const current = parseProject(currentData)
const previous = parseProject(previousData)
const house = current.buildings.find((building) => building.ref === 'house/main')!
const wall = house.walls.find((entry) => entry.ref === 'wall/reference-upper/bath-west')!
const windowRef = 'opening/upper-bathroom-window'
const window = wall.openings.find((opening) => opening.ref === windowRef)!

it('centres the bathroom window below the 1.40 m eaves profile', () => {
  expect(validateProject(current).filter((issue) => issue.severity === 'error')).toEqual([])
  expect(wallLength(wall)).toBeCloseTo(2.9)
  expect(window).toMatchObject({
    kind: 'window',
    glazed: true,
    wallRef: wall.ref,
    offsetM: 1.45,
    widthM: 1.2,
    heightM: 0.6,
    sillM: 0.75,
  })

  const profile = atticWallProfile(house, wall)!
  const top = window.sillM + window.heightM
  const edges = [window.offsetM - window.widthM / 2, window.offsetM + window.widthM / 2]
  expect(edges).toEqual([0.85, 2.05])
  for (const edge of edges) expect(wallProfileHeightAt(profile, edge) - top).toBeCloseTo(0.05)
})

it('adds the window to saved r39 while preserving edits and later deletions', async () => {
  globalThis.indexedDB = new IDBFactory()
  await synchronizePublishedProject(previous, previous)
  const saved = (await loadWorkspace(previous.ref))!
  saved.project.name = 'Mój GŁÓWNY z oknem'
  await saveWorkspace(saved)

  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  const merged = (await loadWorkspace(current.ref))!
  expect(merged.project.name).toBe('Mój GŁÓWNY z oknem')
  expect(merged.project.buildings.flatMap((building) => building.walls).flatMap((entry) => entry.openings))
    .toContainEqual(window)

  for (const building of merged.project.buildings) {
    for (const entry of building.walls) entry.openings = entry.openings.filter((opening) => opening.ref !== windowRef)
  }
  await saveWorkspace(merged)
  expect(await synchronizePublishedProject(current, previous)).toEqual([])
  expect((await loadWorkspace(current.ref))!.project.buildings.flatMap((building) => building.walls)
    .flatMap((entry) => entry.openings).some((opening) => opening.ref === windowRef)).toBe(false)
})
