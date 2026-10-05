import { describe, expect, it } from 'vitest'
import { sampleProject } from './sampleProject'
import { parseProject } from './schema'
import { polygonArea, polygonSelfIntersects, rectangle } from './geometry'
import { validateProject } from './commands'
import { interiorsOverlap, landUseAreas } from './zoning'

describe('Zielonki planning boundary', () => {
  it('splits each /3 parcel without changing its official area or leaving gaps', () => {
    const project = parseProject(sampleProject)
    for (const parcel of project.site.parcels.filter((p) => p.cadastralNumber.endsWith('/3'))) {
      expect(parcel.landRole).toBe('mixed')
      expect(parcel.landUseZones?.map((zone) => zone.code).sort()).toEqual(['06.MNU.8', '06.R.21'])
      const zones = parcel.landUseZones!
      expect(zones.every((zone) => !polygonSelfIntersects(zone.boundary))).toBe(true)
      expect(zones.reduce((sum, zone) => sum + polygonArea(zone.boundary), 0)).toBeCloseTo(polygonArea(parcel.boundary), 1)
      expect(interiorsOverlap(zones[0].boundary, zones[1].boundary)).toBe(false)
    }
    expect(project.site.parcels.reduce((sum, p) => sum + p.officialAreaM2, 0)).toBe(5209)
    const residential = landUseAreas(project).filter((zone) => zone.landRole === 'construction')
    expect(residential.reduce((sum, zone) => sum + polygonArea(zone.boundary), 0)).toBeCloseTo(698.52, 1)
  })

  it('reports a retained design in agricultural /3 land and clears the warning on the residential side', () => {
    const project = structuredClone(sampleProject)
    const building = project.buildings[0]
    building.slabs = [{ ...building.slabs[0], footprint: rectangle({ x: 0, z: 0 }, 2, 2) }]
    building.position = { x: 8, z: 10 }
    expect(validateProject(project).some((issue) => issue.code === 'building.zoning')).toBe(true)
    building.position = { x: 0, z: -10 }
    expect(validateProject(project).some((issue) => issue.code === 'building.zoning')).toBe(false)
  })

  it('detects crossing footprints even when no corner is contained, while allowing shared edges', () => {
    expect(interiorsOverlap(rectangle({ x: 0, z: 0 }, 8, 1), rectangle({ x: 0, z: 0 }, 1, 8))).toBe(true)
    expect(interiorsOverlap(rectangle({ x: 0, z: 0 }, 2, 2), rectangle({ x: 2, z: 0 }, 2, 2))).toBe(false)
  })
})
