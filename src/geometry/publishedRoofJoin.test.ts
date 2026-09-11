import { expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import front from '../../project-data/zielonki-v2/project.json'
import rear from '../../project-data/zielonki-rear-carport/project.json'
import { parseProject } from '../domain/schema'
import { polygonBounds } from '../domain/geometry'
import { gableRoofJunction, gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { clippedRoofBox, roofJunctionCutouts } from './roofJunction'

for (const data of [front, rear]) it(`${data.ref}: joins equal ridges with compliant slopes and no internal roof sheet`, () => {
  const house = parseProject(data).buildings[0]
  const wings = roofWings(house)
  const host = wings.find(w => w.ref.endsWith('/front-barn'))!
  const branch = wings.find(w => w.ref.endsWith('/rear-barn'))!
  expect(host.ridgeElevationM).toBeCloseTo(branch.ridgeElevationM, 9)
  expect(host.ridgeElevationM).toBeCloseTo(7.7856938754, 9)
  for (const wing of [host, branch]) {
    const b = polygonBounds(wing.footprint)
    const span = wing.ridgeAxis === 'z' ? b.maxX - b.minX : b.maxZ - b.minZ
    const angle = Math.atan2(wing.ridgeElevationM - wing.baseElevationM, span / 2) * 180 / Math.PI
    expect(angle).toBeGreaterThanOrEqual(37)
    expect(angle).toBeLessThanOrEqual(45)
    expect(wing.baseElevationM).toBe(4.85)
  }
  expect(gableRoofJunction(house, branch)).toEqual({ host, side: 'min' })
  expect(gableWallsForBuilding(house).some(w => w.segmentRef === branch.ref && w.side === 'min')).toBe(false)
  const cutouts = roofJunctionCutouts(house, host)
  expect(cutouts).toHaveLength(1)
  const b = polygonBounds(host.footprint), half = (b.maxX - b.minX) / 2
  const pitch = house.roof.segments.find(s => s.ref === host.ref)!.pitchDegrees * Math.PI / 180
  const geometry = clippedRoofBox([half / Math.cos(pitch), .2, b.maxZ - b.minZ],
    [(b.minX + b.maxX) / 2 + half / 2, (host.baseElevationM + host.ridgeElevationM) / 2, (b.minZ + b.maxZ) / 2],
    [0, 0, -pitch], [], cutouts)
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  const branchBounds = polygonBounds(branch.footprint)
  const ray = new Raycaster(new Vector3(10, host.baseElevationM + .5, (branchBounds.minZ + branchBounds.maxZ) / 2), new Vector3(-1, 0, 0))
  expect(ray.intersectObject(mesh)).toHaveLength(0)
  ray.ray.origin.z = b.maxZ - 1
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
  geometry.dispose()
  material.dispose()
})
