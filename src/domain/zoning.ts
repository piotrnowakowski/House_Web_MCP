import { buildingFootprintsWorld, pointInPolygon, pointOnPolygonBoundary, polygonCentroid } from './geometry'
import type { BuildingModel, Polygon2, ProjectV2, Vec2 } from './types'

/** Planning subdivisions never replace the cadastral parcel or its official area. */
export const landUseAreas = (project: ProjectV2) => project.site.parcels.flatMap((parcel) =>
  parcel.landUseZones?.length ? parcel.landUseZones : parcel.landRole === 'mixed' ? [] : [{ ref: parcel.ref, code: '', landRole: parcel.landRole, boundary: parcel.boundary, sourceRef: '', geometryConfidence: parcel.geometryConfidence }])

const cross = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
const strictlyInside = (p: Vec2, polygon: Polygon2) => pointInPolygon(p, polygon) && !pointOnPolygonBoundary(p, polygon, 0.001)
export const interiorsOverlap = (a: Polygon2, b: Polygon2) =>
  a.some((p) => strictlyInside(p, b)) || b.some((p) => strictlyInside(p, a)) ||
  (strictlyInside(polygonCentroid(a), a) && strictlyInside(polygonCentroid(a), b)) ||
  a.some((p, i) => b.some((q, j) => {
    const r = a[(i + 1) % a.length]; const s = b[(j + 1) % b.length]
    return cross(p, r, q) * cross(p, r, s) < -1e-8 && cross(q, s, p) * cross(q, s, r) < -1e-8
  }))

export const buildingCrossesAgriculturalZone = (project: ProjectV2, building: BuildingModel) => {
  const agricultural = project.site.parcels.flatMap((parcel) => parcel.landUseZones ?? []).filter((zone) => zone.landRole === 'agricultural')
  return buildingFootprintsWorld(building).some((footprint) => agricultural.some((zone) => interiorsOverlap(footprint, zone.boundary)))
}
