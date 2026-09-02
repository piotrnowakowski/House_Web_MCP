import type { TemperatureByDayPartC } from './types'

export const dayParts = [
  { key: 'night', label: 'Night', hours: '00–06' },
  { key: 'morning', label: 'Morning', hours: '06–12' },
  { key: 'day', label: 'Day', hours: '12–18' },
  { key: 'evening', label: 'Evening', hours: '18–24' },
] as const

const roundTemperature = (value: number) => Math.round(value * 10) / 10

/**
 * Derive representative day-part means from the existing monthly mean minimum
 * and maximum. These are conceptual planning values, not hourly observations.
 */
export const estimateDayPartTemperatures = (meanMinC: number, meanMaxC: number): TemperatureByDayPartC => {
  const range = meanMaxC - meanMinC
  return {
    night: roundTemperature(meanMinC + range * 0.08),
    morning: roundTemperature(meanMinC + range * 0.42),
    day: roundTemperature(meanMinC + range * 0.88),
    evening: roundTemperature(meanMinC + range * 0.56),
  }
}
