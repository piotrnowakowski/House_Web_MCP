import { describe, expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { polygonBounds } from '../domain/geometry'
import { createReferenceHouse } from '../domain/referenceHouse'
import { gableRoofJunction, gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { modernBarnProject } from '../domain/sampleProject'
import { fitZielonkiInterior, livingVoidPartitions } from '../domain/zielonkiInterior'
import { clippedRoofBox, gableVolumePlanes, roofJunctionCutouts, roofJunctionPlanes } from './roofJunction'

describe('gable valley termination', () => {
  it('removes the host roof across the open living volume while retaining the exterior slope', () => {
    const building = fitZielonkiInterior(modernBarnProject, createReferenceHouse()).buildings[0]
    const host = roofWings(building).find((wing) => wing.ridgeAxis === 'z' && wing.type === 'gable')!
    const b = polygonBounds(host.footprint)
    const pitch = building.roof.pitchDegrees * Math.PI / 180
    const half = (b.maxX - b.minX) / 2 + host.overhangM
    const centerX = (b.minX + b.maxX) / 2
    const midY = (host.baseElevationM - Math.tan(pitch) * host.overhangM + host.ridgeElevationM) / 2
    const cutouts = roofJunctionCutouts(building, host)
    expect(cutouts).toHaveLength(1)
    const geometry = clippedRoofBox([half / Math.cos(pitch), 0.2, b.maxZ - b.minZ + 2 * host.overhangM],
      [centerX + half / 2, midY, (b.minZ + b.maxZ) / 2], [0, 0, -pitch], [], cutouts)
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const mesh = new Mesh(geometry, material)
    const branch = roofWings(building).find((wing) => wing.ridgeAxis === 'x')!
    const branchBounds = polygonBounds(branch.footprint)
    const ray = new Raycaster(new Vector3(10, host.baseElevationM + 0.5, (branchBounds.minZ + branchBounds.maxZ) / 2), new Vector3(-1, 0, 0))
    expect(ray.intersectObject(mesh)).toHaveLength(0)
    ray.ray.origin.z = b.maxZ - 1
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
    geometry.dispose(); material.dispose()
  })

  it('closes the bedroom wall vertically under the meeting of the roof ridges', () => {
    const building = fitZielonkiInterior(modernBarnProject, createReferenceHouse()).buildings[0]
    const partitions = livingVoidPartitions(building)
    expect(partitions.map(({ wall }) => wall.ref)).toEqual(['wall/reference-upper/2', 'wall/reference-upper/9'])
    expect(building.spaces.find((s) => s.ref === 'space/reference-parents')!.boundary.some((b) => b.wallRef === partitions[0].wall.ref)).toBe(true)
    const host = roofWings(building).find((wing) => wing.ridgeAxis === 'z' && wing.type === 'gable')!
    const hostBounds = polygonBounds(host.footprint)
    for (const { wall, wing } of partitions) {
      expect(wall.start.x).toBeCloseTo((hostBounds.minX + hostBounds.maxX) / 2)
      expect(wall.end.x).toBeCloseTo(wall.start.x)
      const bottom = wall.baseElevationM + wall.heightM
      const height = wing.ridgeElevationM - bottom
      const planes = gableVolumePlanes({ ...wing, overhangM: 0 }, -0.1).slice(4)
      const geometry = clippedRoofBox([wall.thicknessM, height, Math.abs(wall.end.z - wall.start.z)],
        [wall.start.x, bottom + height / 2, (wall.start.z + wall.end.z) / 2], [0, 0, 0], planes)
      const positions = geometry.getAttribute('position')
      expect(positions.count).toBeGreaterThan(0)
      geometry.computeBoundingBox()
      expect(geometry.boundingBox!.min.x).toBeCloseTo(wall.start.x - wall.thicknessM / 2)
      expect(geometry.boundingBox!.max.x).toBeCloseTo(wall.start.x + wall.thicknessM / 2)
      for (let i = 0; i < positions.count; i++) {
        const point = new Vector3().fromBufferAttribute(positions, i)
        expect(Math.abs(point.x - wall.start.x)).toBeLessThanOrEqual(wall.thicknessM / 2 + 0.00001)
        expect(planes.every((plane) => plane.distanceToPoint(point) >= -0.00001)).toBe(true)
      }
      geometry.dispose()
    }
    building.slabs.find((slab) => slab.ref === 'slab/reference-upper')!.holes = []
    expect(livingVoidPartitions(building)).toEqual([])
    expect(livingVoidPartitions(createReferenceHouse().buildings[0])).toEqual([])
  })

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
