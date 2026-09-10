import { describe, expect, it } from 'vitest'
import data from '../../project-data/zielonki-v2/before-short-hall-r55.json'
import { applyCommands, validateProject } from './commands'
import { parseProject } from './schema'
import { polygonArea, spaceFootprint } from './geometry'
import { dragCommands } from '../interior/directManipulation'
import type { ProjectV2 } from './types'

const wallRef = 'wall/carport-layout/ground/5'
function slide(project: ProjectV2, dz: number) {
  const building = project.buildings[0]
  return applyCommands(project, dragCommands(building, building.storeys[0], { kind: 'wall', ref: wallRef }, { x: 0, z: dz }, { enabled: false, gridM: .1, alignment: false }, []))
}

describe('sliding past connected room junctions', () => {
  it('moves adjoining collinear segments without introducing diagonal walls', () => {
    const project = parseProject(data), building = project.buildings[0], storey = building.storeys[0]
    const wall = building.walls.find(wall => wall.ref === wallRef)!
    const continuation = { ...structuredClone(wall), ref: 'wall/test-continuation', start: { x: 1.5, z: 4 } }
    continuation.openings.forEach(opening => { opening.wallRef = continuation.ref; opening.offsetM -= .585 })
    wall.end = { ...continuation.start }; wall.openings = []
    building.walls.push(continuation); storey.wallRefs.push(continuation.ref)
    for (const room of building.spaces) room.boundary = room.boundary.flatMap(use => use.wallRef !== wallRef ? [use]
      : use.direction === 1 ? [use, { wallRef: continuation.ref, direction: 1 as const }] : [{ wallRef: continuation.ref, direction: -1 as const }, use])
    const result = slide(project, -1.4)
    const moved = result.buildings[0].walls.find(wall => wall.ref === continuation.ref)!
    expect(moved.start.z).toBeCloseTo(2.6); expect(moved.end.z).toBeCloseTo(2.6)
    expect(validateProject(result).filter(issue => issue.severity === 'error')).toEqual([])
  })

  it('rejects locked junctions and moves outside the envelope without changing the input', () => {
    const project = parseProject(data), original = structuredClone(project)
    expect(() => slide(project, -5)).toThrow()
    expect(project).toEqual(original)
    project.buildings[0].spaces.find(room => room.ref === 'space/reference-wc')!.locked = true
    expect(() => slide(project, -1.4)).toThrow(/locked/)
  })

  it('moves the screenshot wall beyond the short return and back, keeping rectangular connections', () => {
    const original = parseProject(data)
    const before = slide(original, -.4)
    const result = slide(before, -1)
    const building = result.buildings[0], storey = building.storeys[0]
    const selected = building.walls.find(wall => wall.ref === wallRef)!
    expect(selected.start.z).toBeCloseTo(2.6)
    expect(selected.end.z).toBeCloseTo(2.6)
    for (const wall of building.walls.filter(wall => storey.wallRefs.includes(wall.ref))) {
      expect(Math.min(Math.abs(wall.start.x - wall.end.x), Math.abs(wall.start.z - wall.end.z))).toBeLessThan(.0001)
    }
    const area = (p: ProjectV2) => p.buildings[0].spaces.filter(room => storey.spaceRefs.includes(room.ref)).reduce((sum, room) => sum + polygonArea(spaceFootprint(p.buildings[0], room)), 0)
    expect(area(result)).toBeCloseTo(area(original))
    expect(building.roof).toEqual(original.buildings[0].roof)
    expect(building.slabs).toEqual(original.buildings[0].slabs)
    expect(validateProject(result).filter(issue => issue.severity === 'error')).toEqual([])
    const back = slide(result, 1.4)
    for (const wall of original.buildings[0].walls) {
      const restored = back.buildings[0].walls.find(item => item.ref === wall.ref)!
      expect(restored.start.x).toBeCloseTo(wall.start.x); expect(restored.start.z).toBeCloseTo(wall.start.z)
      expect(restored.end.x).toBeCloseTo(wall.end.x); expect(restored.end.z).toBeCloseTo(wall.end.z)
    }
    expect(back.buildings[0].spaces.map(room => room.boundary)).toEqual(original.buildings[0].spaces.map(room => room.boundary))
    expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result)
  })
})
