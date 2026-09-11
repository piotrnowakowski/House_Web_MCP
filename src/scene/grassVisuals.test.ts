import { describe, expect, it } from 'vitest'
import { modernBarnProject } from '../domain/sampleProject'
import { grassBladePoints } from './grassVisuals'
import { grassPlacementKey } from './grassGeometry'

describe('real-time grass scattering', () => {
  it('reuses placement for finishes but changes it for moved buildings and removed fixtures', () => {
    const project = structuredClone(modernBarnProject)
    const key = grassPlacementKey(project)
    project.name = 'Renamed project'
    project.revision += 1
    project.buildings[0].walls[0].finish!.colorHex = '#ffffff'
    expect(grassPlacementKey(project)).toBe(key)
    project.buildings[0].position.x += 1
    expect(grassPlacementKey(project)).not.toBe(key)
    project.buildings[0].position.x -= 1
    project.landscape.fixtures.pop()
    expect(grassPlacementKey(project)).not.toBe(key)
  })

  it('does not scatter on an empty lawn', () => {
    const project = structuredClone(modernBarnProject)
    project.landscape.zones = []
    project.site.parcels = []
    expect(grassBladePoints(project)).toEqual([])
  })

  it('is dense, deterministic, near-field bounded, and leaves fixtures clear', () => {
    const first = grassBladePoints(modernBarnProject)
    expect(first).toEqual(grassBladePoints(modernBarnProject))
    expect(first.length).toBeGreaterThan(20_000)
    expect(first.every((blade) => blade.z <= 38)).toBe(true)
    for (const fixture of modernBarnProject.landscape.fixtures) {
      expect(first.every((blade) => Math.hypot(blade.x - fixture.position.x, blade.z - fixture.position.z) >= 1.3)).toBe(true)
    }
  })
})
