import { describe, expect, it } from 'vitest'
import { sampleProject } from '../../domain/sampleProject'
import { buildingGroundOffset } from '../../domain/geometry'
import { parseProject } from '../../domain/schema'
import architekt from '../../../project-data/architekt-7-11/project.json'
import { firstObserverPoint, observerPointIssue, observerWorldPosition } from './observer'

describe('observer placement', () => {
  it('transforms a local point and floor elevation into the same coordinates as the full building', () => {
    const building = structuredClone(sampleProject.buildings[0])
    building.position = { x: 10, z: 20 }; building.rotationDegrees = 90
    const storey = { ...building.storeys[0], elevationM: 3.2 }
    const point = observerWorldPosition(building, storey, { x: 2, z: 4 }, 1.6)
    expect(point[0]).toBeCloseTo(14)
    expect(point[1]).toBeCloseTo(buildingGroundOffset(building) + 4.8)
    expect(point[2]).toBeCloseTo(18)
  })
  it('finds valid standing points on both actual house floors and rejects a slab opening', () => {
    const building = parseProject(architekt).buildings.find(b => b.kind === 'house')!
    for (const storey of building.storeys) {
      const point = firstObserverPoint(building, storey)
      expect(point).not.toBeNull()
      expect(observerPointIssue(building, storey, point!, 1.6)).toBeNull()
      expect(observerPointIssue(building, storey, { x: 9999, z: 9999 }, 1.6)).toContain('podłodze')
    }
    const floor = building.storeys.find(s => building.slabs.find(slab => slab.ref === s.baseSlabRef)?.holes?.length)!
    const slab = building.slabs.find(s => s.ref === floor.baseSlabRef)!
    const valid = firstObserverPoint(building, floor)!
    slab.holes = [[{ x: valid.x - .1, z: valid.z - .1 }, { x: valid.x + .1, z: valid.z - .1 }, { x: valid.x + .1, z: valid.z + .1 }, { x: valid.x - .1, z: valid.z + .1 }]]
    expect(observerPointIssue(building, floor, valid, 1.6)).toContain('otwór')
  })
  it('rejects standing inside furniture and a wall', () => {
    const building = structuredClone(sampleProject.buildings[0]), floor = building.storeys[0]
    const point = firstObserverPoint(building, floor)!
    building.furniture = [{ ref: 'furniture/test', catalogId: 'sofa', name: 'Sofa', storeyRef: floor.ref, position: point, widthM: 1, depthM: 1, heightM: 1, rotationDegrees: 0, color: '#ffffff' }]
    expect(observerPointIssue(building, floor, point, 1.6)).toContain('mebel')
    building.furniture = []
    const wall = building.walls.find(w => floor.wallRefs.includes(w.ref))!
    wall.start = { x: point.x - .5, z: point.z }; wall.end = { x: point.x + .5, z: point.z }
    expect(observerPointIssue(building, floor, point, 1.6)).toContain('ściany')
  })
})
