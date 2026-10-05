import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/project.json'
import { parseProject } from './schema'
import { applyCommand, validateProject } from './commands'
import { isEnvelopeWall } from './interiorLayout'
import { furnitureMoveCommands, wallWithLength } from './precisionEdits'
import { wallLength } from './geometry'
import { useStudioStore } from '../state/store'

beforeEach(() => useStudioStore.getState().restoreWorkspace({ version: 1, project: parseProject(data), proposals: [], draftChangeSets: [] }))

it('moves the complete v2 assembly in one undo step while keeping the road entrance and site evidence fixed', () => {
  const state = useStudioStore.getState(), before = state.project, house = before.buildings[0]
  state.commitCommands([{ type: 'building.update', action: 'move', buildingRef: house.ref, position: { x: house.position.x + 0.1, z: house.position.z }, moveLinkedFeatures: true }])
  const after = useStudioStore.getState().project
  expect(after.buildings[1].position.x).toBeCloseTo(before.buildings[1].position.x + 0.1)
  expect(after.buildings[0].roof).toEqual(house.roof)
  expect(after.site).toEqual(before.site)
  expect(after.landscape.plants).toEqual(before.landscape.plants)
  const terrace = after.landscape.zones.find(z => z.ref === 'zone/terrace')!
  expect(terrace.locked).toBe(true)
  expect(terrace.footprint[0].x).toBeCloseTo(before.landscape.zones.find(z => z.ref === terrace.ref)!.footprint[0].x + 0.1)
  expect(after.landscape.zones.find(z => z.ref === 'zone/driveway')!.footprint[0]).toEqual(before.landscape.zones.find(z => z.ref === 'zone/driveway')!.footprint[0])
  expect(useStudioStore.getState().history).toHaveLength(1)
  expect(useStudioStore.getState().undo()).toEqual(before)
  expect(useStudioStore.getState().redo()).toEqual(after)
})

it('shortens an interior wall and updates connected endpoints and hosted openings atomically', () => {
  const state = useStudioStore.getState(), before = state.project, building = before.buildings[0], storey = building.storeys[0]
  const wall = building.walls.find(w => w.ref === 'wall/carport-layout/ground/10')!
  const draft = wallWithLength(wall, wallLength(wall) - 0.1, 'end')
  state.commitCommand({ type: 'interior.update', action: 'wall', buildingRef: building.ref, storeyRef: storey.ref, wallRef: wall.ref, start: draft.start, end: draft.end })
  const after = useStudioStore.getState().project
  expect(wallLength(after.buildings[0].walls.find(w => w.ref === wall.ref)!)).toBeCloseTo(wallLength(wall) - 0.1)
  expect(validateProject(after).filter(i => i.severity === 'error')).toEqual([])
  expect(after.buildings[0].roof).toEqual(building.roof)
  expect(useStudioStore.getState().undo()).toEqual(before)
})

it('recognizes the outside wall behind the slab rim and rejects shortening it in the interior editor', () => {
  const before = parseProject(data), b = before.buildings[0], s = b.storeys[0]
  const wall = b.walls.find(w => w.start.z === -6.555 && w.end.z === -6.555)!
  expect(isEnvelopeWall(b, s, wall)).toBe(true)
  const draft = wallWithLength(wall, wallLength(wall) - 0.1, 'start')
  expect(() => applyCommand(before, { type: 'interior.update', action: 'wall', buildingRef: b.ref, storeyRef: s.ref, wallRef: wall.ref, start: draft.start, end: draft.end })).toThrow(/exterior/)
})

it('keeps a selected length anchor and rejects non-finite input', () => {
  const wall = parseProject(data).buildings[0].walls[0]
  expect(wallWithLength(wall, 2, 'end').end.x).toBeCloseTo(wall.end.x)
  expect(wallWithLength(wall, 2, 'end').end.z).toBeCloseTo(wall.end.z)
  expect(() => wallWithLength(wall, NaN, 'center')).toThrow()
})

it('moves furniture groups without changing original dimensions', () => {
  const b = parseProject(data).buildings[0], items = b.furniture!.slice(0,2)
  items.forEach(i => i.groupRef = 'group/test')
  const changed = { ...items[0], position: { x: items[0].position.x + .01, z: items[0].position.z } }
  const commands = furnitureMoveCommands(b,items[0],changed)
  expect(commands).toHaveLength(2)
  for (const c of commands) if (c.type === 'interior.update' && c.action === 'put') {
    const old = items.find(i => i.ref === c.item.ref)!
    expect(c.item.position.x).toBeCloseTo(old.position.x + .01)
    expect([c.item.widthM,c.item.depthM,c.item.heightM]).toEqual([old.widthM,old.depthM,old.heightM])
  }
})

it('rejects invalid window placement without adding undo history', () => {
  const state = useStudioStore.getState(), before = state.project, b = before.buildings[0], s = b.storeys[0]
  const wall = b.walls.find(w => s.wallRefs.includes(w.ref) && w.openings.length)!, opening = wall.openings[0]
  expect(() => state.commitCommand({ type: 'interior.update', action: 'opening', buildingRef: b.ref, storeyRef: s.ref, wallRef: wall.ref, opening: { ...opening, offsetM: 0 } })).toThrow()
  expect(useStudioStore.getState().project).toEqual(before)
  expect(useStudioStore.getState().history).toHaveLength(0)
})
