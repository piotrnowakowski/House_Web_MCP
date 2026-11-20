import { describe, expect, it } from 'vitest'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import source from '../../project-data/architekt-7-11-bez-okapow/source-architekt-7-11-r17.json'
import initial from '../../project-data/architekt-7-11-bez-okapow/initial-r1.json'
import variant from '../../project-data/architekt-7-11-bez-okapow/project.json'
import { validateProject } from '../domain/commands'
import { gableGlazingProfile } from '../domain/gableGlazing'
import { polygonBounds } from '../domain/geometry'
import { gableRoofJunction, gableWallsForBuilding, roofWings } from '../domain/roofWings'
import { parseProject } from '../domain/schema'
import { clippedRoofBox, roofJunctionCutouts, roofJunctionPlanes } from './roofJunction'

const project = parseProject(variant)
const house = project.buildings.find(b => b.ref === 'house/main')!
const parent = parseProject(source).buildings.find(b => b.ref === house.ref)!

describe('Architekt 7.11 flush roof', () => {
  it('retains the source geometry, furnishings, landscaping and hosted glass outside the specified roof details', () => {
    // Pin the fork to its actual source revision while allowing future independent edits of the original.
    expect(source.revision).toBe(17)
    const expected = structuredClone(source)
    Object.assign(expected, { ref: initial.ref, revision: initial.revision, name: initial.name, updatedAt: initial.updatedAt })
    const h = expected.buildings.find(b => b.ref === house.ref)!
    const supports = h.walls.filter(w => w.ref.startsWith('wall/architekt-711/eaves/'))
    expect(supports).toHaveLength(24)
    h.walls = h.walls.filter(w => !supports.includes(w))
    h.roof.overhangM = 0
    for (const roof of h.roof.segments) {
      Object.assign(roof, { overhangM: 0, flushGableWallInsetM: 0.225 })
      Reflect.deleteProperty(roof, 'gableRecess')
      Reflect.deleteProperty(roof, 'gableFrame')
    }
    expect(initial).toEqual(expected)
    expect(validateProject(project).filter(i => i.severity === 'error')).toEqual([])
    for (const side of gableWallsForBuilding(house)) {
      const segment = house.roof.segments.find(s => s.ref === side.segmentRef)!
      const original = parent.roof.segments.find(s => s.ref === segment.ref)!
      expect(side.supportingWallRef).toBeTruthy()
      const profile = gableGlazingProfile(segment, side.side, house)
      expect(profile?.panels.length).toBeGreaterThan(0)
      expect(profile).toEqual(gableGlazingProfile(original, side.side, parent))
    }
  })

  it('terminates both faces of each pitched sheet at the facade and keeps the perpendicular valley open inside', () => {
    const [host, branch] = roofWings(house)
    expect(gableRoofJunction(house, branch)).toEqual({ host, side: 'min' })
    expect(gableWallsForBuilding(house)).toHaveLength(3)
    expect(branch.ridgeElevationM).toBeCloseTo(host.ridgeElevationM, 9)
    for (const wing of [host, branch]) {
      const b = polygonBounds(wing.footprint), alongZ = wing.ridgeAxis === 'z'
      const span = alongZ ? b.maxX - b.minX : b.maxZ - b.minZ
      const length = alongZ ? b.maxZ - b.minZ : b.maxX - b.minX
      const pitch = Math.atan2(wing.ridgeElevationM - wing.baseElevationM, span / 2)
      expect(pitch * 180 / Math.PI).toBeGreaterThanOrEqual(37)
      expect(pitch * 180 / Math.PI).toBeLessThanOrEqual(45)
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2
      for (const sign of [-1, 1]) {
        const across = sign * span / 4
        const slope = span / (2 * Math.cos(pitch))
        const geometry = clippedRoofBox(alongZ ? [slope, .2, length] : [length, .2, slope],
          [cx + (alongZ ? across : 0), (wing.ridgeElevationM + wing.baseElevationM) / 2, cz + (alongZ ? 0 : across)],
          alongZ ? [0, 0, -sign * pitch] : [sign * pitch, 0, 0],
          roofJunctionPlanes(gableRoofJunction(house, wing)), roofJunctionCutouts(house, wing), true)
        geometry.computeBoundingBox()
        const box = geometry.boundingBox!
        const axis = alongZ ? 'x' : 'z'
        expect(sign < 0 ? box.min[axis] : box.max[axis]).toBeCloseTo((alongZ ? cx : cz) + sign * span / 2, 5)
        const vertices = geometry.getAttribute('position')
        const edge = alongZ ? (sign < 0 ? b.minX : b.maxX) : (sign < 0 ? b.minZ : b.maxZ)
        const heights = Array.from({ length: vertices.count }, (_, i) => i)
          .filter(i => Math.abs((alongZ ? vertices.getX(i) : vertices.getZ(i)) - edge) < 1e-5)
          .map(i => vertices.getY(i))
        expect(Math.min(...heights)).toBeCloseTo(wing.baseElevationM - .1 / Math.cos(pitch), 5)
        expect(Math.max(...heights)).toBeCloseTo(wing.baseElevationM + .1 / Math.cos(pitch), 5)
        if (wing === host && sign > 0) {
          const branchBounds = polygonBounds(branch.footprint)
          const material = new MeshBasicMaterial({ side: DoubleSide })
          const mesh = new Mesh(geometry, material)
          const ray = new Raycaster(new Vector3(10, host.baseElevationM + .5, (branchBounds.minZ + branchBounds.maxZ) / 2), new Vector3(-1, 0, 0))
          expect(ray.intersectObject(mesh)).toHaveLength(0)
          ray.ray.origin.z = b.maxZ - 1
          expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
          material.dispose()
        }
        geometry.dispose()
      }
    }
  })
})
