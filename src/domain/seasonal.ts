import type { ProjectV1, SeasonalMonthAnalysis } from './types'

const degrees = (value: number) => value * Math.PI / 180

export const daylightHours = (latitude: number, month: number) => {
  const day = Math.round(30.44 * (month - 0.5))
  const declination = degrees(23.44) * Math.sin((2 * Math.PI / 365) * (day - 81))
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, -Math.tan(degrees(latitude)) * Math.tan(declination))))
  return 24 * hourAngle / Math.PI
}

export const analyzeSeason = (project: ProjectV1, months: number[] = [1, 4, 7, 10]): SeasonalMonthAnalysis[] => months.map((monthNumber) => {
  const climate = project.climateProfile.months.find((item) => item.month === monthNumber)
  if (!climate) throw new Error(`Missing climate data for month ${monthNumber}`)
  const daylight = daylightHours(project.climateProfile.latitude, monthNumber)
  const waterBalance = climate.precipitationMm + project.climateProfile.irrigationMm - climate.et0Mm
  const activePlants = project.garden.plants.filter((plant) => plant.leafMonths.includes(monthNumber)).length
  const bloomingPlants = project.garden.plants.filter((plant) => plant.bloomMonths.includes(monthNumber)).length
  const droughtRisk = waterBalance < -35 ? 'high' : waterBalance < -10 ? 'moderate' : 'low'
  const frostRisk = climate.frostDays > 12 ? 'high' : climate.frostDays > 2 ? 'moderate' : 'low'
  const notes: string[] = []
  if (droughtRisk !== 'low') notes.push(`${Math.abs(Math.round(waterBalance))} mm indicative monthly water deficit.`)
  if (frostRisk !== 'low') notes.push(`${climate.frostDays} typical frost days; protect sensitive planting.`)
  if (bloomingPlants === 0 && monthNumber >= 4 && monthNumber <= 10) notes.push('No catalog plants bloom this month; consider extending seasonal interest.')
  return {
    month: monthNumber,
    daylightHours: Math.round(daylight * 10) / 10,
    representativeSunHours: Math.round(Math.min(daylight, climate.sunshineHours / 30.44) * 10) / 10,
    waterBalanceMm: Math.round(waterBalance), droughtRisk, frostRisk, activePlants, bloomingPlants, notes,
  }
})

export const sunPositionForMonth = (latitude: number, month: number) => {
  const seasonal = Math.sin(((month - 1) / 12) * Math.PI * 2 - Math.PI / 2)
  const elevation = Math.max(12, 48 + seasonal * 24 - Math.abs(latitude - 50) * 0.2)
  const azimuth = 180 + seasonal * 16
  const radius = 35
  const elevationRad = degrees(elevation)
  const azimuthRad = degrees(azimuth)
  return {
    x: Math.sin(azimuthRad) * Math.cos(elevationRad) * radius,
    y: Math.sin(elevationRad) * radius,
    z: Math.cos(azimuthRad) * Math.cos(elevationRad) * radius,
  }
}
