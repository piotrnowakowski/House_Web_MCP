import { Box3, Vector3 } from 'three'
import { buildingFootprintsWorld } from '../../domain/geometry'
import { roofRidgeElevation } from '../../domain/roofWings'
import { solarPosition, sunDirectionModel, sunriseSunset, type SolarSite, type SunTime } from '../../domain/solar'
import type { ProjectV2 } from '../../domain/types'

export const SUN_DISTANCE_M = 120
export const SHADOW_MARGIN_M = 15

export const solarSiteOf = (project: ProjectV2): SolarSite => ({ latitude: project.climateProfile.latitude, longitude: project.climateProfile.longitude, timezone: project.climateProfile.timezone })

/** Sun altitude, azimuth and the model-space direction toward the sun for a moment at the site. */
export const sunStateFor = (project: ProjectV2, time: SunTime) => {
  const sun = solarPosition(solarSiteOf(project), time)
  return { ...sun, direction: sunDirectionModel(sun.azimuthDeg, sun.altitudeDeg, project.site.northDegrees), events: sunriseSunset(solarSiteOf(project), time) }
}

/** World bounds of everything that should receive crisp shadows: buildings, fixtures and the zones around them. */
export const shadowFocusBounds = (project: ProjectV2) => {
  const box = new Box3()
  for (const building of project.buildings) {
    const top = roofRidgeElevation(building) + 1
    buildingFootprintsWorld(building).flat().forEach((point) => { box.expandByPoint(new Vector3(point.x, 0, point.z)); box.expandByPoint(new Vector3(point.x, top, point.z)) })
  }
  project.landscape.fixtures.forEach((fixture) => box.expandByPoint(new Vector3(fixture.position.x, 1.6, fixture.position.z)))
  project.landscape.zones.forEach((zone) => zone.footprint.forEach((point) => box.expandByPoint(new Vector3(point.x, 0, point.z))))
  if (box.isEmpty()) box.setFromCenterAndSize(new Vector3(0, 2, 0), new Vector3(30, 10, 30))
  return box
}

/** Warm the light as the sun drops toward the horizon; neutral white above 25 degrees. */
export const sunColorFor = (altitudeDeg: number) => {
  const warmth = Math.min(1, Math.max(0, (25 - altitudeDeg) / 25))
  const channel = (day: number, dusk: number) => Math.round(day + (dusk - day) * warmth)
  return `rgb(${channel(255, 255)}, ${channel(247, 176)}, ${channel(234, 110)})`
}
