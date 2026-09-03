import { describe, expect, it } from 'vitest'
import { REFERENCE_YEAR, solarPosition, sunDirectionModel, sunriseSunset, timezoneOffsetMinutes } from './solar'

const zielonki = { latitude: 50.12, longitude: 19.92, timezone: 'Europe/Warsaw' }

describe('solar position for Zielonki', () => {
  it('detects the Europe/Warsaw offset with and without daylight saving', () => {
    expect(timezoneOffsetMinutes('Europe/Warsaw', new Date(Date.UTC(2026, 5, 21, 12)))).toBe(120)
    expect(timezoneOffsetMinutes('Europe/Warsaw', new Date(Date.UTC(2026, 11, 21, 12)))).toBe(60)
  })

  it('reaches the expected solar-noon altitude at the solstices and equinox', () => {
    const noon = (month: number, day: number) => {
      const events = sunriseSunset(zielonki, { month, day, hour: 12 })!
      return solarPosition(zielonki, { month, day, hour: events.solarNoonHour })
    }
    expect(noon(6, 21).altitudeDeg).toBeCloseTo(63.32, 0)
    expect(noon(3, 20).altitudeDeg).toBeCloseTo(39.82, 0)
    expect(noon(12, 21).altitudeDeg).toBeCloseTo(16.44, 0)
    expect(Math.abs(noon(6, 21).azimuthDeg - 180)).toBeLessThan(0.5)
    expect(Math.abs(noon(12, 21).azimuthDeg - 180)).toBeLessThan(0.5)
  })

  it('matches NOAA sunrise, sunset and solar noon within six minutes', () => {
    const june = sunriseSunset(zielonki, { month: 6, day: 21, hour: 12 })!
    expect(Math.abs(june.sunriseHour - 4.507)).toBeLessThan(0.1)
    expect(Math.abs(june.sunsetHour - 20.897)).toBeLessThan(0.1)
    expect(Math.abs(june.solarNoonHour - 12.7)).toBeLessThan(0.1)
    expect(june.daylightHours).toBeCloseTo(16.39, 1)
    const december = sunriseSunset(zielonki, { month: 12, day: 21, hour: 12 })!
    expect(Math.abs(december.sunriseHour - 7.614)).toBeLessThan(0.1)
    expect(Math.abs(december.sunsetHour - 15.665)).toBeLessThan(0.1)
    expect(december.daylightHours).toBeCloseTo(8.05, 1)
  })

  it('places a mid-morning June sun in the east-south-east', () => {
    const morning = solarPosition(zielonki, { month: 6, day: 21, hour: 9 })
    expect(morning.altitudeDeg).toBeCloseTo(39.66, 0)
    expect(morning.azimuthDeg).toBeCloseTo(100.74, 0)
    const afternoon = solarPosition(zielonki, { month: 6, day: 21, hour: 15 })
    expect(afternoon.azimuthDeg).toBeCloseTo(237.92, 0)
  })

  it('uses a fixed reference year so results are deterministic', () => {
    expect(REFERENCE_YEAR).toBe(2026)
    const a = solarPosition(zielonki, { month: 7, day: 15, hour: 14 })
    const b = solarPosition(zielonki, { month: 7, day: 15, hour: 14 })
    expect(a).toEqual(b)
  })

  it('returns null below the horizon all day only in polar conditions', () => {
    expect(sunriseSunset({ ...zielonki, latitude: 89 }, { month: 12, day: 21, hour: 12 })).toBeNull()
    expect(sunriseSunset(zielonki, { month: 12, day: 21, hour: 12 })).not.toBeNull()
  })
})

describe('sun direction in model space', () => {
  const length = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z)

  it('points from the ground toward a southern noon sun opposite to model north', () => {
    const direction = sunDirectionModel(180, 45, 0)
    expect(length(direction)).toBeCloseTo(1, 6)
    expect(direction.y).toBeCloseTo(Math.SQRT1_2, 6)
    expect(direction.x).toBeCloseTo(0, 6)
    expect(direction.z).toBeCloseTo(-Math.SQRT1_2, 6)
  })

  it('follows the site north rotation used by the north-elevation camera', () => {
    const north = -56.7 * Math.PI / 180
    const modelNorth = { x: Math.sin(north), z: Math.cos(north) }
    const direction = sunDirectionModel(180, 30, -56.7)
    const horizontal = Math.hypot(direction.x, direction.z)
    expect(direction.x / horizontal).toBeCloseTo(-modelNorth.x, 6)
    expect(direction.z / horizontal).toBeCloseTo(-modelNorth.z, 6)
  })

  it('puts an eastern sunrise on the right-hand side of someone facing north', () => {
    const direction = sunDirectionModel(90, 0, 0)
    expect(direction.x).toBeCloseTo(-1, 6)
    expect(direction.y).toBeCloseTo(0, 6)
    expect(direction.z).toBeCloseTo(0, 6)
  })
})
