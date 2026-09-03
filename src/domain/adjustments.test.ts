import { describe, expect, it } from 'vitest'
import { applyCommand, validateProject } from './commands'
import { measureHeight } from './heightMeasurements'
import { createPlantingAreaPlan } from './plantingAreas'
import { modernBarnProject } from './sampleProject'

describe('adjustment capabilities', () => {
  it('creates one deterministic hornbeam perimeter scheme with parcel and conflict reporting', () => {
    const plan = createPlantingAreaPlan(modernBarnProject, {
      plantingRef: 'planting/hornbeam-perimeter', mode: 'boundary', sourceRefs: ['site'], inwardOffsetM: 1.2, spacingM: 2,
      rowCount: 1, rowSpacingM: 0.6, cornerTreatment: 'distribute', plantingPaletteRef: 'plant-guide/hornbeam', clearanceM: 1,
    })
    expect(plan.plants.length).toBeGreaterThan(100)
    expect(plan.plants[0]).toMatchObject({ ref: 'planting/hornbeam-perimeter/plant-0001', species: 'Carpinus betulus', kind: 'hedge' })
    expect(new Set(plan.plants.map((plant) => plant.ref)).size).toBe(plan.plants.length)
    expect(plan.metadata.totalLengthM).toBeGreaterThan(400)
    expect(plan.affectedParcelRefs).toEqual(expect.arrayContaining(['parcel/54-3', 'parcel/55-3', 'parcel/58-3', 'parcel/54-4', 'parcel/55-4', 'parcel/58-4']))
    expect(plan.conflicts).toContainEqual(expect.objectContaining({ code: 'planting.utilities-unmapped' }))
    const result = applyCommand(modernBarnProject, { type: 'planting-area.update', metadata: plan.metadata, plants: plan.plants })
    expect(result.landscape.plants).toHaveLength(modernBarnProject.landscape.plants.length + plan.plants.length)
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('returns reproducible semantic and free vertical height measurements with both elevation systems', () => {
    const wall = measureHeight(modernBarnProject, { mode: 'semantic', objectRef: 'wall/upper-east', measurement: 'object-height' })
    expect(wall).toMatchObject({ objectRef: 'wall/upper-east', buildingRef: 'house/main', label: 'Wall height', heightM: 3.1 })
    expect(wall.topPoint.reference).toBe('wall/upper-east/top')
    expect(wall.topElevation.absoluteM - wall.bottomElevation.absoluteM).toBeCloseTo(3.1)
    const ridge = measureHeight(modernBarnProject, { mode: 'semantic', objectRef: 'wall/upper-east', measurement: 'ground-to-ridge' })
    expect(ridge.topPoint.reference).toBe('roof/main/ridge')
    expect(ridge.heightM).toBeGreaterThan(wall.heightM)
    const opening = measureHeight(modernBarnProject, { mode: 'semantic', objectRef: 'opening/upper-east-north', measurement: 'opening-height' })
    expect(opening.heightM).toBe(1.55)
    expect(opening.bottomPoint.reference).toBe('opening/upper-east-north/sill')
    const clearance = measureHeight(modernBarnProject, { mode: 'semantic', objectRef: 'slab/upper', measurement: 'terrain-clearance' })
    expect(clearance).toMatchObject({ kind: 'terrain-clearance', label: 'Terrain to slab underside' })
    expect(clearance.bottomPoint.reference).toBe('terrain/surface')
    const free = measureHeight(modernBarnProject, { mode: 'free-vertical', startPoint: { x: 2, y: 1, z: 3 }, endPoint: { x: 5, y: 7.25, z: 9 } })
    expect(free).toMatchObject({ kind: 'free-vertical', heightM: 6.25 })
  })
})
