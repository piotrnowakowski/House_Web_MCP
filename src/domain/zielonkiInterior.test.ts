import { describe, expect, it } from 'vitest'
import { applyModernBarnPreset } from './presets'
import { validateProject } from './commands'
import { polygonBounds } from './geometry'
import { measureHeight } from './heightMeasurements'
import { createReferenceHouse } from './referenceHouse'
import { roomDimensions } from './roomDimensions'
import { modernBarnProject } from './sampleProject'
import { parseProject } from './schema'
import { fitZielonkiInterior, isExteriorWall, upgradeZielonkiRoof } from './zielonkiInterior'

describe('Zielonki with the measured interior', () => {
  it('retains the rooms and barn style with MPZP gables and a flat garage roof', () => {
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
      if (room.ref === 'space/reference-mezzanine') continue // Replaced by the requested living void.
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
    const main = polygonBounds(house.roof.segments[1].footprint)
    const side = polygonBounds(house.roof.segments[0].footprint)
    expect(main.minZ).toBeCloseTo(bounds.minZ + 0.1)
    expect(main.maxZ).toBeCloseTo(polygonBounds(house.slabs[1].footprint).maxZ - 0.1)
    expect(side.minX).toBeCloseTo((main.minX + main.maxX) / 2)
    expect(side.minZ).toBeCloseTo(main.minZ)
    const cap = house.roof.segments[2]
    expect(polygonBounds(cap.footprint).minZ).toBeCloseTo(main.maxZ)
    expect(polygonBounds(cap.footprint).maxZ).toBeCloseTo(bounds.maxZ - 0.1)
    expect(cap.baseElevationM).toBeCloseTo(house.storeys[0].elevationM + house.storeys[0].clearHeightM)
    expect(cap.pitchDegrees).toBe(0)
    const ridgeHeights = house.roof.segments.map((s) => measureHeight(fitted, { mode: 'semantic', objectRef: s.ref, measurement: 'ground-to-ridge' }).heightM)
    expect(Math.max(...ridgeHeights)).toBe(8.9)
    expect(house.roof.segments.filter((s) => s.type === 'gable').every((s) => s.pitchDegrees === house.roof.pitchDegrees)).toBe(true)
    expect(house.roof.pitchDegrees).toBeGreaterThanOrEqual(37)
    expect(house.roof.pitchDegrees).toBeLessThanOrEqual(45)
    expect(house.storeys.every((s) => s.clearHeightM === 2.8)).toBe(true)
    expect(validateProject(fitted).filter((i) => i.severity === 'error')).toEqual([])
    expect(reference.buildings[0].position).toEqual({ x: -5.4, z: -11 })
  })
  it.each([false, true])('corrects a saved roof once, preserving rooms and finishes (old cap: %s)', (oldCap) => {
    const legacy = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    const house = legacy.buildings[0]
    const main = house.roof.segments[1]; const side = house.roof.segments[0]
    const mainBounds = polygonBounds(main.footprint); const sideBounds = polygonBounds(side.footprint)
    const upper = polygonBounds(house.slabs[1].footprint)
    const ground = polygonBounds(house.slabs[0].footprint)
    main.footprint = main.footprint.map((p) => ({ x: p.x, z: p.z === mainBounds.minZ ? sideBounds.maxZ : oldCap ? upper.maxZ - 0.1 : ground.maxZ - 0.1 }))
    side.footprint = side.footprint.map((p) => ({ x: p.x === sideBounds.minX ? mainBounds.minX : p.x, z: p.z }))
    main.finish.colorHex = '#765432'
    house.interiorSource!.notes = []
    if (!oldCap) house.roof.segments.pop()
    else house.roof.segments[2].finish.colorHex = '#567654'
    const before = structuredClone(legacy)
    const changed = upgradeZielonkiRoof(legacy)
    expect(legacy).toEqual(before)
    expect(changed.revision).toBe(legacy.revision + 1)
    expect(changed.buildings[0].roof.segments).toHaveLength(3)
    expect(polygonBounds(changed.buildings[0].roof.segments[1].footprint).maxZ).toBeCloseTo(upper.maxZ - 0.1)
    if (oldCap) expect(changed.buildings[0].roof.segments[2].finish.colorHex).toBe('#567654')
    expect(changed.buildings[0].roof.segments[1].finish.colorHex).toBe('#765432')
    expect({ ...changed.buildings[0], roof: null, interiorSource: null }).toEqual({ ...house, roof: null, interiorSource: null })
    expect(upgradeZielonkiRoof(changed)).toBe(changed)
  })
  it('survives schema persistence and legacy preset loading without expanding or overwriting the upper floor', () => {
    const fitted = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    fitted.buildings[0].spaces[0].name = 'Edited after fitting'
    const loaded = parseProject(JSON.parse(JSON.stringify(fitted)))
    expect(loaded).toEqual(fitted)
    expect(applyModernBarnPreset(loaded)).toEqual(fitted)
    expect(fitZielonkiInterior(loaded, createReferenceHouse())).toEqual(fitted)
  })
  it('fits the saved gables within 37–45 degrees once, preserving eaves and later edits', () => {
    const source = fitZielonkiInterior(modernBarnProject, createReferenceHouse())
    const house = source.buildings[0]
    house.interiorSource!.notes = []
    house.roof.pitchDegrees = 45
    house.roof.segments.filter((s) => s.type === 'gable').forEach((segment) => { segment.pitchDegrees = 45 })
    const adjusted = upgradeZielonkiRoof(source)
    const roof = adjusted.buildings[0].roof
    expect(Math.max(...roof.segments.map((segment) => measureHeight(adjusted, { mode: 'semantic', objectRef: segment.ref, measurement: 'ground-to-ridge' }).heightM))).toBe(8.9)
    expect(roof.pitchDegrees).toBeLessThan(45)
    expect(roof.pitchDegrees).toBeGreaterThanOrEqual(37)
    expect(roof.segments.map((s) => s.baseElevationM)).toEqual(house.roof.segments.map((s) => s.baseElevationM))
    expect(adjusted.buildings[0].walls).toEqual(house.walls)
    expect(adjusted.buildings[0].slabs).toEqual(house.slabs)
    expect(adjusted.revision).toBe(source.revision + 1)
    roof.segments.forEach((segment) => { segment.pitchDegrees = 37 })
    expect(upgradeZielonkiRoof(adjusted)).toBe(adjusted)
  })
})
