import { describe, expect, it } from 'vitest'
import { applyModernBarnPreset } from './presets'
import { validateProject } from './commands'
import { polygonBounds } from './geometry'
import { createReferenceHouse } from './referenceHouse'
import { roomDimensions } from './roomDimensions'
import { modernBarnProject } from './sampleProject'
import { parseProject } from './schema'
import { fitZielonkiInterior, isExteriorWall } from './zielonkiInterior'

describe('Zielonki with the measured interior', () => {
  it('retains site and furnishings, transfers exact clear dimensions, and fits all three roofs', () => {
    const target = structuredClone(modernBarnProject)
    target.buildings[0].rotationDegrees = 12
    const reference = createReferenceHouse()
    reference.buildings[0].spaces[4].name = 'Our garage'
    const fitted = fitZielonkiInterior(target, reference)
    expect(fitted.site).toEqual(target.site)
    expect(fitted.landscape).toEqual(target.landscape)
    expect(fitted.ref).toBe(target.ref)
    const house = fitted.buildings[0]
    expect(house.position).toEqual(target.buildings[0].position)
    expect(house.rotationDegrees).toBe(12)
    expect(house.furniture).toHaveLength(22)
    expect(house.spaces[4].name).toBe('Our garage')
    for (const room of reference.buildings[0].spaces) {
      const before = roomDimensions(reference.buildings[0], room)
      const after = roomDimensions(house, house.spaces.find((s) => s.ref === room.ref)!)
      for (const key of ['width', 'depth', 'area'] as const) expect(after[key], `${room.name} ${key}`).toBeCloseTo(before[key], 4)
    }
    const bounds = polygonBounds(house.slabs[0].footprint)
    expect(bounds.maxX - bounds.minX).toBeCloseTo(11.19)
    expect(bounds.maxZ - bounds.minZ).toBeCloseTo(18.31)
    expect(house.walls.filter((w) => isExteriorWall(house, w)).every((w) => w.finish?.material === 'charred-timber')).toBe(true)
    expect(house.walls.filter((w) => isExteriorWall(house, w)).length).toBeGreaterThan(10)
    expect(house.roof.segments.map((s) => [s.type, s.ridgeDirection])).toEqual([['gable', 'x'], ['gable', 'z'], ['flat', 'z']])
    expect(house.roof.segments[2].baseElevationM).toBeCloseTo(3.25)
    expect(validateProject(fitted).filter((i) => i.severity === 'error')).toEqual([])
    expect(reference.buildings[0].position).toEqual({ x: -5.4, z: -11 })
  })
  it('survives schema persistence and legacy preset loading without expanding or overwriting the upper floor', () => {
    const fitted = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    fitted.buildings[0].spaces[0].name = 'Edited after fitting'
    const loaded = parseProject(JSON.parse(JSON.stringify(fitted)))
    expect(loaded).toEqual(fitted)
    expect(applyModernBarnPreset(loaded)).toEqual(fitted)
    expect(fitZielonkiInterior(loaded, createReferenceHouse())).toEqual(fitted)
  })
})
