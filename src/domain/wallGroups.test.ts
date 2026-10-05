import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import { parseProject } from './schema'
import { applyCommands } from './commands'
import { dragCommands } from '../interior/directManipulation'

const refs = [7, 6, 5].map(i => `wall/carport-layout/ground/${i}`)
const fixture = () => { const project = parseProject(data); const building = project.buildings[0]; return { project, building, base: { type: 'interior.update' as const, buildingRef: building.ref, storeyRef: building.storeys[0].ref } } }

it('persists wall groups and moves each connected corner exactly once, independent of member order', () => {
  const { project, building, base } = fixture()
  const grouped = applyCommands(project, [{ ...base, action: 'wall-group', wallRefs: refs, groupRef: 'walls/test' }])
  expect(parseProject(grouped)).toEqual(grouped)
  const commands = dragCommands(grouped.buildings[0], building.storeys[0], { kind: 'wall', ref: refs[0] }, { x: 0, z: .2 }, { enabled: true, gridM: .1, alignment: false }, [])
  expect(commands).toHaveLength(1)
  const moved = applyCommands(grouped, commands)
  const reversed = applyCommands(grouped, [{ ...base, action: 'walls-move', wallRefs: [...refs].reverse(), delta: { x: 0, z: .2 } }])
  expect(moved.buildings).toEqual(reversed.buildings)
  for (const ref of refs) {
    const before = building.walls.find(w => w.ref === ref)!, after = moved.buildings[0].walls.find(w => w.ref === ref)!
    expect(after.start.z).toBeCloseTo(before.start.z + .2)
    expect(after.end.z).toBeCloseTo(before.end.z + .2)
    expect(after.end.x - after.start.x).toBeCloseTo(before.end.x - before.start.x)
    after.openings.forEach((o, i) => expect(o.offsetM).toBeCloseTo(before.openings[i].offsetM))
  }
  expect(moved.buildings[0].roof).toEqual(building.roof)
  expect(project).toEqual(parseProject(data))
  const ungrouped = applyCommands(moved, [{ ...base, action: 'wall-group', wallRefs: [refs[0]], groupRef: null }])
  expect(ungrouped.buildings[0].walls.filter(w => refs.includes(w.ref)).every(w => !w.groupRef)).toBe(true)
})

it('rejects invalid moves, locked members, exterior walls and other-floor refs atomically', () => {
  const { project, building, base } = fixture(), before = structuredClone(project)
  expect(() => applyCommands(project, [{ ...base, action: 'walls-move', wallRefs: refs, delta: { x: 0, z: 8 } }])).toThrow()
  expect(project).toEqual(before)
  for (const invalid of [building.storeys[1].wallRefs[0], 'wall/reference-ground/1', 'missing']) {
    expect(() => applyCommands(project, [{ ...base, action: 'wall-group', wallRefs: [refs[0], invalid], groupRef: 'walls/test' }])).toThrow()
  }
  building.walls.find(w => w.ref === refs[1])!.locked = true
  expect(() => applyCommands(project, [{ ...base, action: 'walls-move', wallRefs: refs, delta: { x: 0, z: .2 } }])).toThrow()
})
