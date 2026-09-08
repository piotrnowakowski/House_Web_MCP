import { describe, expect, it } from 'vitest'
import { applyCommand, validateProject } from './commands'
import { createReferenceHouse, REFERENCE_HOUSE_REF } from './referenceHouse'
import { roomDimensions } from './roomDimensions'
import { parseProject } from './schema'
import { itemFitsFloor } from './interior'
import { solidInputsForBuilding } from '../geometry/geometryService'

describe('House reconstructed from the supplied plans', () => {
  it('round-trips a valid independent project with two floors, shared walls, stairs and furnishings', () => {
    const project = createReferenceHouse()
    expect(project.ref).toBe(REFERENCE_HOUSE_REF)
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
    expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
    const building = project.buildings[0]
    expect(building.storeys.map((s) => s.spaceRefs.length)).toEqual([5, 7])
    expect(building.furniture).toHaveLength(22)
    expect(building.stairs).toHaveLength(1)
    expect(solidInputsForBuilding(building).find((s) => s.ref === 'slab/reference-upper')).toHaveProperty('holes', building.slabs[1].holes)
    expect(building.spaces[1].boundary.some((edge) => building.spaces[2].boundary.some((b) => b.wallRef === edge.wallRef && b.direction !== edge.direction))).toBe(true)
  })
  it('reproduces the printed clear ground-floor dimensions and net areas rather than wall centre measurements', () => {
    const building = createReferenceHouse().buildings[0]
    const expected = [
      ['living', 10.79, 9.14, 86.3715], ['garage', 7.28, 6.2, 45.136], ['office', 2.78, 3.96, 11.0088],
      ['pantry', 1.84, 2.17, 3.9928], ['wc', 2.26, 2.17, 4.9042],
      ['parents', 5.15, 4.5, 23.175], ['mezzanine', 5.53, 7.35, 40.6455], ['bathroom', 2.03, 2.92, 5.9276],
      ['child-one', 3.52, 4.07, 14.3264], ['child-two', 3.54, 4.07, 14.4078],
    ] as const
    for (const [id, width, depth, area] of expected) {
      const dimensions = roomDimensions(building, building.spaces.find((s) => s.ref === `space/reference-${id}`)!)
      expect(dimensions.width, `${id} width`).toBeCloseTo(width, 4)
      expect(dimensions.depth, `${id} depth`).toBeCloseTo(depth, 4)
      expect(dimensions.area, `${id} area`).toBeCloseTo(area, 4)
    }
    const island = building.furniture!.find((i) => i.catalogId === 'kitchen-island')!
    expect(island.widthM).toBe(1.28); expect(island.depthM).toBe(2.92)
    expect(island.position.x - island.widthM / 2 - 0.65).toBeCloseTo(1.22, 5)
  })
  it('prevents furniture over the upper stair opening and keeps stairs connected after height edits', () => {
    const project = createReferenceHouse(); const building = project.buildings[0]
    const bed = { ...building.furniture!.at(-1)!, position: { x: 1.5, z: 5.1 } }
    expect(itemFitsFloor(bed, building.slabs[1].footprint, building.slabs[1].holes)).toBe(false)
    expect(() => applyCommand(project, { type: 'interior.update', action: 'put', buildingRef: building.ref, storeyRef: bed.storeyRef, item: bed })).toThrow(/stair openings/)
    const raised = applyCommand(project, { type: 'storey.update', action: 'set-height', buildingRef: building.ref, storeyRef: building.storeys[0].ref, clearHeightM: 3 })
    expect(raised.buildings[0].storeys[1].elevationM).toBeCloseTo(3.2)
    expect(raised.buildings[0].stairs).toEqual(building.stairs)
    const removed = applyCommand(project, { type: 'storey.update', action: 'remove', buildingRef: building.ref, storeyRef: building.storeys[1].ref })
    expect(removed.buildings[0].stairs).toEqual([])
  })
})
