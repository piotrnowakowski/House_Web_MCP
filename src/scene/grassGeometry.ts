import { elevationAt, pointInPolygon } from '../domain/geometry'
import type { BuildingModel, Polygon2, ProjectV2, Vec2 } from '../domain/types'
import { landUseAreas } from '../domain/zoning'

const NEAR_FIELD_LIMIT_Z = 38
const CANDIDATE_BLADES = 360_000

export type GrassBlade = { x: number; y: number; z: number; angle: number; height: number; shade: number }

const fraction = (value: number) => value - Math.floor(value)
const noise = (x: number, z: number, salt: number) => fraction(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453)

const buildingFootprint = (building: BuildingModel): Polygon2 => {
  const footprint = building.slabs[0]?.footprint ?? building.roof.footprint ?? []
  const angle = -building.rotationDegrees * Math.PI / 180
  const cosine = Math.cos(angle); const sine = Math.sin(angle)
  return footprint.map((point) => ({
    x: building.position.x + point.x * cosine - point.z * sine,
    z: building.position.z + point.x * sine + point.z * cosine,
  }))
}

const segmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x; const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz))
}

export const grassBladePoints = (project: ProjectV2, candidates = CANDIDATE_BLADES): GrassBlade[] => {
  const areas = [
    ...landUseAreas(project).filter((zone) => zone.landRole === 'agricultural').map((zone) => zone.boundary),
    ...project.landscape.zones.filter((zone) => zone.kind === 'lawn').map((zone) => zone.footprint),
  ]
  const exclusions = [
    ...project.buildings.map(buildingFootprint),
    ...project.landscape.zones.filter((zone) => zone.kind !== 'lawn').map((zone) => zone.footprint),
  ]
  const allPoints = areas.flat()
  const minX = Math.min(...allPoints.map((point) => point.x)); const maxX = Math.max(...allPoints.map((point) => point.x))
  const minZ = Math.min(...allPoints.map((point) => point.z)); const maxZ = Math.min(NEAR_FIELD_LIMIT_Z, Math.max(...allPoints.map((point) => point.z)))
  const blades: GrassBlade[] = []
  if (!allPoints.length || maxZ <= minZ || maxX <= minX) return blades

  for (let index = 0; index < candidates; index += 1) {
      const point = {
        x: minX + noise(index, 1, 1) * (maxX - minX),
        z: minZ + noise(index, 2, 2) * (maxZ - minZ),
      }
      if (!areas.some((area) => pointInPolygon(point, area))) continue
      if (exclusions.some((area) => area.length >= 3 && pointInPolygon(point, area))) continue
      if (project.landscape.fixtures.some((fixture) => Math.hypot(point.x - fixture.position.x, point.z - fixture.position.z) < 1.3)) continue
      if (project.site.entrances.some((entrance) => segmentDistance(point, entrance.start, entrance.end) < 1.05)) continue
      blades.push({
        x: point.x,
        y: elevationAt(project, point.x, point.z) + 0.026,
        z: point.z,
        angle: noise(index, 3, 3) * Math.PI * 2,
        height: 0.7 + noise(index, 4, 4) * 0.65,
        shade: noise(index, 5, 5),
      })
  }
  return blades
}

/** Includes only data that changes grass placement, never finishes or furniture. */
export const grassPlacementKey = (project: ProjectV2) => JSON.stringify({
  terrain: project.site.terrain.elevationPoints,
  areas: landUseAreas(project).filter(zone => zone.landRole === 'agricultural').map(zone => zone.boundary),
  buildings: project.buildings.map(buildingFootprint),
  zones: project.landscape.zones.map(zone => ({ kind: zone.kind, footprint: zone.footprint })),
  fixtures: project.landscape.fixtures.map(fixture => fixture.position),
  entrances: project.site.entrances.map(({ start, end }) => ({ start, end })),
})

export interface GrassAttributes { offsets: Float32Array; angles: Float32Array; heights: Float32Array; shades: Float32Array }
