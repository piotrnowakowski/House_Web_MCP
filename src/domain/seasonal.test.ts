import { describe, expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { analyzeSeason, daylightHours } from './seasonal'

describe('seasonal analysis', () => {
  it('has longer days in July than January for Zielonki', () => {
    expect(daylightHours(sampleProject.climateProfile.latitude, 7)).toBeGreaterThan(daylightHours(sampleProject.climateProfile.latitude, 1))
  })

  it('matches NOAA mid-month daylight duration to within three minutes', () => {
    expect(daylightHours(50.12, 6)).toBeCloseTo(16.36, 1)
    expect(daylightHours(50.12, 1)).toBeCloseTo(8.55, 1)
  })

  it('returns deterministic monthly planning signals', () => {
    const result = analyzeSeason(sampleProject, [1, 7])
    expect(result).toHaveLength(2)
    expect(result[0].frostRisk).toBe('high')
    expect(result[1].droughtRisk).toBe('low')
    expect(result[1].activePlants).toBeGreaterThan(result[0].activePlants)
    expect(result[1].temperatureByDayPartC).toEqual({ night: 15.2, morning: 18.8, day: 23.6, evening: 20.2 })
    expect(result[1].temperatureByDayPartC.day).toBeGreaterThan(result[1].temperatureByDayPartC.night)
  })

  it('reports local sunrise, sunset and solar-noon altitude for the middle of each month', () => {
    const [july] = analyzeSeason(sampleProject, [7])
    expect(july.sunriseLocal).toBeCloseTo(4.79, 1)
    expect(july.sunsetLocal).toBeCloseTo(20.75, 1)
    expect(july.solarNoonAltitudeDeg).toBeCloseTo(61.4, 0)
    expect(july.daylightHours).toBeCloseTo(15.96, 1)
  })
})
