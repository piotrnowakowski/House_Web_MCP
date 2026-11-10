import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3, Ray, DoubleSide } from 'three'
import { describe, expect, it } from 'vitest'
import { sampleProject } from '../../domain/sampleProject'
import { parseProject } from '../../domain/schema'
import { polygonCentroid } from '../../domain/geometry'
import architekt from '../../../project-data/architekt-7-11/project.json'
import { architecturalShadowMesh, assessDaylight, daylightObstacles, daylightAdvice, daylightFloor, daylightSample, LIGHT_LEVELS } from './daylight'

describe('interior daylight', () => {
  const origin = { x: 0, y: .8, z: 0 }
  it('distinguishes a sunny patch, sky-lit shade, deep shade, and night on the same workplane', () => {
    const sun = { x: .6, y: .8, z: 0 }
    expect(assessDaylight({ origin, skyFraction: .055 }, sun, () => false)).toEqual({ level: 10, direct: true })
    expect(assessDaylight({ origin, skyFraction: .055 }, sun, () => true)).toEqual({ level: 6, direct: false })
    expect(assessDaylight({ origin, skyFraction: .003 }, sun, () => true).level).toBe(2)
    expect(assessDaylight({ origin, skyFraction: 1 }, { x: 0, y: -1, z: 0 }, () => false)).toEqual({ level: 0, direct: false })
  })

  it('retains opaque frames and the world transform while letting rays pass through clear glass', () => {
    const root = new Group()
    root.position.x = 10
    const glass = new Mesh(new BoxGeometry(2, 2, .1), new MeshBasicMaterial({ opacity: .42, transparent: true }))
    const frame = new Mesh(new BoxGeometry(.1, 2, .1), new MeshBasicMaterial())
    frame.position.x = 1
    root.add(glass, frame)
    const mesh = architecturalShadowMesh(root, sampleProject.buildings[0])!
    const through = (x: number) => mesh.raycastFirst(new Ray(new Vector3(x, 0, -2), new Vector3(0, 0, 1)), DoubleSide)
    expect(through(10)).toBeNull()
    expect(through(11)).not.toBeNull()
  })

  it('keeps the eleven bands ordered and differentiates between activities at the same point', () => {
    const sun = { x: 0, y: 1, z: 0 }
    for (const [i, band] of LIGHT_LEVELS.entries()) {
      const lower = i ? LIGHT_LEVELS[i - 1].upper : 0
      const skyFraction = (lower + Math.min(1, band.upper)) / 2
      expect(assessDaylight({ origin, skyFraction }, sun, () => true).level).toBe(i)
    }
    expect(daylightAdvice(4, 4)).toBe('Sprzyjające')
    expect(daylightAdvice(4, 7)).toBe('Warto doświetlić')
  })

  it('allows one reflected sky path from the room side of an opaque wall', () => {
    const house = sampleProject.buildings[0]
    const scene = new Group()
    const wall = new Mesh(new BoxGeometry(4, 4, .1), new MeshBasicMaterial())
    wall.position.set(0, 1, 1)
    scene.add(wall)
    const mesh = architecturalShadowMesh(scene, house)!
    const project = { ...sampleProject, buildings: [house], landscape: { ...sampleProject.landscape, plants: [], fixtures: [] } }
    const rays = daylightObstacles(mesh, project, house, false, false)
    const direction = { x: 0, y: .1, z: Math.sqrt(.99) }
    expect(rays.blocked(origin, direction)).toBe(true)
    expect(rays.skyWeight(origin, direction, { x: 0, y: .8, z: .6 })).toBe(.4)
    expect(rays.skyWeight(origin, direction, { x: 0, y: .8, z: -.6 })).toBe(0)
  })
  it('excludes the upper-floor void and computes the same reference height independently of camera placement', () => {
    const building = parseProject(architekt).buildings.find(b => b.kind === 'house')!
    const floor = building.storeys[1]
    const grid = daylightFloor(building, floor)
    expect(grid.contains(polygonCentroid(grid.slab.holes![0]))).toBe(false)
    expect(grid.cells.length).toBeGreaterThan(50)
    const open = daylightSample(building, floor, grid.cells[0], { blocked: () => false, skyWeight: () => 1 })
    const closed = daylightSample(building, floor, grid.cells[0], { blocked: () => true, skyWeight: () => 0 })
    expect(open.skyFraction).toBe(1)
    expect(closed.skyFraction).toBe(0)
    expect(open.origin.y - daylightSample(building, building.storeys[0], grid.cells[0], { blocked: () => false, skyWeight: () => 1 }).origin.y).toBeCloseTo(floor.elevationM - building.storeys[0].elevationM)
  })
})
