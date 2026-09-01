import { describe, expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { analyzeSeason, daylightHours, sunPositionForMonth } from './seasonal'

describe('seasonal analysis', () => {
  it('has longer days in July than January for Zielonki', () => {
    expect(daylightHours(sampleProject.climateProfile.latitude, 7)).toBeGreaterThan(daylightHours(sampleProject.climateProfile.latitude, 1))
  })

  it('returns deterministic monthly planning signals', () => {
    const result = analyzeSeason(sampleProject, [1, 7])
    expect(result).toHaveLength(2)
    expect(result[0].frostRisk).toBe('high')
    expect(result[1].droughtRisk).toBe('low')
    expect(result[1].activePlants).toBeGreaterThan(result[0].activePlants)
  })

  it('produces a usable directional-light position', () => {
    const sun = sunPositionForMonth(50.12, 7)
    expect(sun.y).toBeGreaterThan(10)
    expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(35, 3)
  })
})
