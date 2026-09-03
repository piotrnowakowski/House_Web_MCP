import { describe, expect, it } from 'vitest'
import { modernBarnProject } from '../domain/sampleProject'
import { grassBladePoints } from './grassVisuals'

describe('real-time grass scattering', () => {
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
