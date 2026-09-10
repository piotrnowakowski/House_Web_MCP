import { expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import { parseProject } from '../domain/schema'
import { applyCommands } from '../domain/commands'
import { dragCommands } from './directManipulation'

const snap = { enabled: true, gridM: .1, alignment: false }
it('slides the screenshot partition and connected walls from the original model without mutating it', () => {
  const p = parseProject(data), b = p.buildings[0], s = b.storeys[0], old = structuredClone(p)
  const wall = b.walls.find(w => w.ref === 'wall/carport-layout/ground/7')!
  const commands = dragCommands(b,s,{ kind: 'wall', ref: wall.ref },{ x: 2, z: .3 },snap,[])
  const result = applyCommands(p,commands)
  const changed = result.buildings[0].walls.find(w => w.ref === wall.ref)!
  expect(changed.start).toEqual({ x: wall.start.x, z: wall.start.z + .3 })
  expect(changed.end.x).toBe(wall.end.x)
  expect(result.buildings[0].roof).toEqual(b.roof)
  expect(p).toEqual(old)
  expect(() => applyCommands(p,dragCommands(b,s,{ kind:'wall',ref:wall.ref },{x:0,z:5},snap,[]))).toThrow()
})
it('projects opening movement along its wall and rejects edits that no longer fit', () => {
  const p=parseProject(data), b=p.buildings[0], s=b.storeys[0]
  const w=b.walls.find(w=>w.openings.some(o=>o.ref==='opening/reference-office-window'))!, opening=w.openings[0]
  const result=applyCommands(p,dragCommands(b,s,{kind:'opening',ref:opening.ref},{x:3,z:.2},snap,[]))
  expect(result.buildings[0].walls.find(v=>v.ref===w.ref)!.openings[0].offsetM).toBeCloseTo(opening.offsetM+.2)
  expect(()=>applyCommands(p,dragCommands(b,s,{kind:'opening',ref:opening.ref},{x:0,z:10},snap,[]))).toThrow()
})
it('rejects locked furniture and suppresses wall drags parallel to the wall', () => {
  const p=parseProject(data), b=p.buildings[0], s=b.storeys[0], item=b.furniture![0]
  item.locked=true
  expect(()=>applyCommands(p,dragCommands(b,s,{kind:'item',ref:item.ref},{x:.3,z:0},snap,[]))).toThrow()
  expect(dragCommands(b,s,{kind:'wall',ref:'wall/carport-layout/ground/7'},{x:2,z:0},snap,[])).toEqual([])
})
