import type { Vec3 } from './types'

/** Fixed calendar year so every solar computation is deterministic across sessions and tests. */
export const REFERENCE_YEAR = 2026

/** Local civil time at the site; `hour` is fractional (14.5 = 14:30). */
export interface SunTime { month: number; day: number; hour: number; year?: number }
export interface SolarSite { latitude: number; longitude: number; timezone: string }
export interface SolarPosition { altitudeDeg: number; azimuthDeg: number; declinationDeg: number; equationOfTimeMin: number; solarNoonHour: number }
export interface SunEvents { sunriseHour: number; sunsetHour: number; solarNoonHour: number; daylightHours: number }

const rad = (degrees: number) => degrees * Math.PI / 180
const deg = (radians: number) => radians * 180 / Math.PI
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const MINUTES_PER_DAY = 1440

/** Offset of `timezone` from UTC at the given instant, in minutes, including daylight saving. */
export const timezoneOffsetMinutes = (timezone: string, utc: Date): number => {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    .formatToParts(utc).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label)
  if (!match) return 0
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

/** Converts a local civil time at the site into a UTC instant, resolving the daylight-saving offset. */
export const localToUtc = (timezone: string, time: SunTime): Date => {
  const year = time.year ?? REFERENCE_YEAR
  const naive = Date.UTC(year, time.month - 1, time.day, 0, 0, 0) + time.hour * 3_600_000
  const firstOffset = timezoneOffsetMinutes(timezone, new Date(naive))
  const utc = naive - firstOffset * 60_000
  const secondOffset = timezoneOffsetMinutes(timezone, new Date(utc))
  return new Date(secondOffset === firstOffset ? utc : naive - secondOffset * 60_000)
}

const julianCentury = (utc: Date) => (utc.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545) / 36_525

/** NOAA solar declination and equation of time for a UTC instant. */
const solarBasics = (utc: Date) => {
  const jc = julianCentury(utc)
  const meanLongitude = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
  const meanAnomaly = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  const eccentricity = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  const centre = Math.sin(rad(meanAnomaly)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
    + Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * jc) + Math.sin(rad(3 * meanAnomaly)) * 0.000289
  const apparentLongitude = meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * jc))
  const meanObliquity = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(125.04 - 1934.136 * jc))
  const declination = Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude)))
  const y = Math.tan(rad(obliquity / 2)) ** 2
  const equationOfTimeMin = 4 * deg(y * Math.sin(2 * rad(meanLongitude)) - 2 * eccentricity * Math.sin(rad(meanAnomaly))
    + 4 * eccentricity * y * Math.sin(rad(meanAnomaly)) * Math.cos(2 * rad(meanLongitude))
    - 0.5 * y * y * Math.sin(4 * rad(meanLongitude)) - 1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly)))
  return { declination, equationOfTimeMin }
}

const solarNoonMinutes = (site: SolarSite, equationOfTimeMin: number, offsetMinutes: number) => 720 - 4 * site.longitude - equationOfTimeMin + offsetMinutes

/** Geometric sun altitude and compass azimuth (0 north, 90 east) for a local civil time at the site. */
export const solarPosition = (site: SolarSite, time: SunTime): SolarPosition => {
  const utc = localToUtc(site.timezone, time)
  const offsetMinutes = timezoneOffsetMinutes(site.timezone, utc)
  const { declination, equationOfTimeMin } = solarBasics(utc)
  const localMinutes = time.hour * 60
  const trueSolarTime = (((localMinutes + equationOfTimeMin + 4 * site.longitude - offsetMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hourAngle = trueSolarTime / 4 - 180
  const latitude = rad(site.latitude)
  const zenith = Math.acos(clamp(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(rad(hourAngle)), -1, 1))
  const sinZenith = Math.sin(zenith)
  const azimuthCos = sinZenith < 1e-9 ? 1 : clamp((Math.sin(latitude) * Math.cos(zenith) - Math.sin(declination)) / (Math.cos(latitude) * sinZenith), -1, 1)
  const azimuthDeg = hourAngle > 0 ? (deg(Math.acos(azimuthCos)) + 180) % 360 : (540 - deg(Math.acos(azimuthCos))) % 360
  return {
    altitudeDeg: 90 - deg(zenith), azimuthDeg, declinationDeg: deg(declination), equationOfTimeMin,
    solarNoonHour: solarNoonMinutes(site, equationOfTimeMin, offsetMinutes) / 60,
  }
}

/** Sunrise, sunset and solar noon as local fractional hours for the date in `time`; null when the sun never rises or never sets. */
export const sunriseSunset = (site: SolarSite, time: SunTime): SunEvents | null => {
  const noonUtc = localToUtc(site.timezone, { ...time, hour: 12 })
  const offsetMinutes = timezoneOffsetMinutes(site.timezone, noonUtc)
  const { declination, equationOfTimeMin } = solarBasics(noonUtc)
  const latitude = rad(site.latitude)
  const cosHourAngle = Math.cos(rad(90.833)) / (Math.cos(latitude) * Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination)
  if (cosHourAngle > 1 || cosHourAngle < -1) return null
  const hourAngleDeg = deg(Math.acos(cosHourAngle))
  const noon = solarNoonMinutes(site, equationOfTimeMin, offsetMinutes)
  return { sunriseHour: (noon - hourAngleDeg * 4) / 60, sunsetHour: (noon + hourAngleDeg * 4) / 60, solarNoonHour: noon / 60, daylightHours: hourAngleDeg * 8 / 60 }
}

/**
 * Unit vector from the ground toward the sun in model space. Model north is (sin θ, 0, cos θ) for the site's
 * north angle θ, matching the north-elevation camera; east is the right-hand side of someone facing north.
 */
export const sunDirectionModel = (azimuthDeg: number, altitudeDeg: number, northDegrees: number): Vec3 => {
  const north = rad(northDegrees)
  const northVector = { x: Math.sin(north), z: Math.cos(north) }
  const eastVector = { x: -Math.cos(north), z: Math.sin(north) }
  const horizontal = Math.cos(rad(altitudeDeg))
  const along = Math.cos(rad(azimuthDeg)); const across = Math.sin(rad(azimuthDeg))
  return {
    x: horizontal * (along * northVector.x + across * eastVector.x),
    y: Math.sin(rad(altitudeDeg)),
    z: horizontal * (along * northVector.z + across * eastVector.z),
  }
}
