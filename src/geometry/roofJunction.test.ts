import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createReferenceHouse } from '../domain/referenceHouse'
import { gableRoofJunction, gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { modernBarnProject } from '../domain/sampleProject'
import { fitZielonkiInterior } from '../domain/zielonkiInterior'
import { clippedRoofBox, roofJunctionPlanes } from './roofJunction'

describe('gable valley termination', () => {
  it('recognizes only the joined end and keeps the three exterior gables', () => {
    const building = fitZielonkiInterior(modernBarnProject, createReferenceHouse()).buildings[0]
    const wings = roofWings(building)
    const branch = wings.find((wing) => wing.ridgeAxis === 'x')!
    const main = wings.find((wing) => wing.ridgeAxis === 'z')!
    expect(gableRoofJunction(building, branch)).toEqual({ host: main, side: 'min' })
    expect(gableRoofJunction(building, main)).toBeNull()
    expect(gableWallsForBuilding(building).map((wall) => wall.ref)).not.toContain(`${branch.ref}/gable-wall/min`)
    expect(gableWallsForBuilding(building)).toHaveLength(3)
    building.roof.junctions = []
    expect(gableRoofJunction(building, branch)).toBeNull()
  })

  it.each([1, -1])('cuts panels and seams to the host surface with branch direction %s', (direction) => {
    const planes = roofJunctionPlanes({ side: direction === 1 ? 'min' : 'max', host: {
      ref: 'main', type: 'gable', ridgeAxis: 'z', baseElevationM: 6, ridgeElevationM: 10, overhangM: 0.4,
      footprint: [{ x: -4, z: -8 }, { x: 4, z: -8 }, { x: 4, z: 8 }, { x: -4, z: 8 }],
    } })
    const half = 4.4; const slopeLength = half * Math.sqrt(2)
    for (const sign of [-1, 1]) {
      const panel = clippedRoofBox([9.8, 0.2, slopeLength], [direction * 4.5, 7.8, sign * half / 2], [sign * Math.PI / 4, 0, 0], planes)
      const positions = panel.getAttribute('position')
      const vertices = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i))
      expect(vertices.length).toBeGreaterThan(0)
      expect(vertices.every((point) => planes.every((plane) => plane.distanceToPoint(point) >= -0.00001))).toBe(true)
      expect(vertices.some((point) => Math.abs(planes[0].distanceToPoint(point)) < 0.00001)).toBe(true)
      expect(Math.max(...vertices.map((p) => direction * p.x))).toBeCloseTo(9.4)
      panel.dispose()
      const seam = clippedRoofBox([0.032, 0.025, slopeLength], [direction * 0.4, 7.92, sign * half / 2], [sign * Math.PI / 4, 0, 0], planes)
      const seamPositions = seam.getAttribute('position')
      expect(seamPositions.count).toBeGreaterThan(0)
      for (let i = 0; i < seamPositions.count; i++) {
        const point = new Vector3().fromBufferAttribute(seamPositions, i)
        expect(planes.every((plane) => plane.distanceToPoint(point) >= -0.00001)).toBe(true)
      }
      seam.dispose()
    }
  })

  it('preserves the complete panel when there is no joined roof', () => {
    const geometry = clippedRoofBox([10, 0.2, 5], [2, 6, 3], [0, 0, 0], [])
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.toArray()).toEqual([-3, expect.closeTo(5.9), 0.5])
    expect(geometry.boundingBox!.max.toArray()).toEqual([7, expect.closeTo(6.1), 5.5])
    geometry.dispose()
  })
})
