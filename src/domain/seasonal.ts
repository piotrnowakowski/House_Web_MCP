import { solarPosition, sunriseSunset } from './solar'
import type { ProjectV2, SeasonalMonthAnalysis } from './types'

const MID_MONTH_DAY = 15
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/** Daylight duration in the middle of a month. Duration depends on latitude and declination only, so longitude and zone are irrelevant here. */
export const daylightHours = (latitude: number, month: number) =>
  sunriseSunset({ latitude, longitude: 0, timezone: 'UTC' }, { month, day: MID_MONTH_DAY, hour: 12 })?.daylightHours ?? 0

export const analyzeSeason = (project: ProjectV2, months: number[] = [1, 4, 7, 10]): SeasonalMonthAnalysis[] => months.map((monthNumber) => {
  const climate = project.climateProfile.months.find((item) => item.month === monthNumber)
  if (!climate) throw new Error(`Missing climate data for month ${monthNumber}`)
  const site = { latitude: project.climateProfile.latitude, longitude: project.climateProfile.longitude, timezone: project.climateProfile.timezone }
  const events = sunriseSunset(site, { month: monthNumber, day: MID_MONTH_DAY, hour: 12 })
  const daylight = events?.daylightHours ?? 0
  const noon = solarPosition(site, { month: monthNumber, day: MID_MONTH_DAY, hour: events?.solarNoonHour ?? 12 })
  const waterBalance = climate.precipitationMm + project.climateProfile.irrigationMm - climate.et0Mm
  const activePlants = project.landscape.plants.filter((plant) => plant.leafMonths.includes(monthNumber)).length
  const bloomingPlants = project.landscape.plants.filter((plant) => plant.bloomMonths.includes(monthNumber)).length
  const droughtRisk = waterBalance < -35 ? 'high' : waterBalance < -10 ? 'moderate' : 'low'
  const frostRisk = climate.frostDays > 12 ? 'high' : climate.frostDays > 2 ? 'moderate' : 'low'
  const notes: string[] = []
  if (droughtRisk !== 'low') notes.push(`${Math.abs(Math.round(waterBalance))} mm indicative monthly water deficit.`)
  if (frostRisk !== 'low') notes.push(`${climate.frostDays} typical frost days; protect sensitive planting.`)
  if (bloomingPlants === 0 && monthNumber >= 4 && monthNumber <= 10) notes.push('No catalog plants bloom this month; consider extending seasonal interest.')
  return {
    month: monthNumber,
    temperatureByDayPartC: { ...climate.temperatureByDayPartC },
    daylightHours: round(daylight, 1),
    sunriseLocal: events ? round(events.sunriseHour, 2) : null,
    sunsetLocal: events ? round(events.sunsetHour, 2) : null,
    solarNoonAltitudeDeg: round(noon.altitudeDeg, 1),
    representativeSunHours: round(Math.min(daylight, climate.sunshineHours / 30.44), 1),
    waterBalanceMm: Math.round(waterBalance), droughtRisk, frostRisk, activePlants, bloomingPlants, notes,
  }
})
