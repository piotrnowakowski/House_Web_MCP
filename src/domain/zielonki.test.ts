import { describe, expect, it } from 'vitest'
import { polygonArea, validateProject } from './commands'
import { buildingBaseElevation, buildingFootprintsWorld, buildingGroundOffset, elevationAt, pointInPolygon } from './geometry'
import { sampleProject } from './sampleProject'

describe('Zielonki demo dataset', () => {
  it('keeps the official post-division areas and surveyed construction geometry aligned', () => {
    const construction = sampleProject.site.parcels.filter((parcel) => parcel.landRole === 'construction')
    const agricultural = sampleProject.site.parcels.filter((parcel) => parcel.landRole === 'agricultural')

    expect(construction.map((parcel) => parcel.cadastralNumber)).toEqual(['54/3', '55/3', '58/3'])
    expect(agricultural.map((parcel) => parcel.cadastralNumber)).toEqual(['54/4', '55/4', '58/4'])
    expect(construction.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)).toBe(1200)
    expect(agricultural.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)).toBe(4009)
    expect(construction.every((parcel) => parcel.geometryConfidence === 'surveyed')).toBe(true)
    expect(agricultural.every((parcel) => parcel.geometryConfidence === 'context-only')).toBe(true)

    for (const parcel of construction) {
      expect(polygonArea(parcel.boundary)).toBeCloseTo(parcel.officialAreaM2, 0)
    }
    for (const parcel of agricultural) {
      expect(polygonArea(parcel.boundary)).toBeCloseTo(parcel.officialAreaM2, 0)
    }
    const remoteExtent = (number: string) => Math.max(...agricultural.find((parcel) => parcel.cadastralNumber === number)!.boundary.map((point) => point.z))
    expect(remoteExtent('54/4')).toBeCloseTo(186.012, 3)
    expect(remoteExtent('55/4')).toBeCloseTo(186.012, 3)
    expect(remoteExtent('58/4')).toBeCloseTo(69.05, 3)
    expect(polygonArea(sampleProject.site.boundary)).toBeCloseTo(5209, 0)
    expect(sampleProject.site.entrances).toHaveLength(2)
    expect(sampleProject.site.entrances.every((entrance) => entrance.connectsTo === 'public-road' && entrance.geometryConfidence === 'user-marked')).toBe(true)
  })

  it('places the house footprint on the construction land with its structural base at terrain level', () => {
    const building = sampleProject.buildings[0]
    const construction = sampleProject.site.parcels.filter((parcel) => parcel.landRole === 'construction')

    expect(buildingFootprintsWorld(building).flat().every((point) => construction.some((parcel) => pointInPolygon(point, parcel.boundary)))).toBe(true)
    expect(buildingBaseElevation(building)).toBeCloseTo(0.15)
    expect(buildingGroundOffset(building)).toBeCloseTo(-0.15)
  })

  it('keeps local terrain offsets near the visible ground instead of subtracting the absolute survey datum twice', () => {
    const heights = sampleProject.site.terrain.elevationPoints.map((point) => elevationAt(sampleProject, point.x, point.z))
    expect(Math.min(...heights)).toBeGreaterThan(-1)
    expect(Math.max(...heights)).toBeLessThan(1)
  })

  it('exposes concise, source-linked ground knowledge without inventing missing soil data', () => {
    const sourceRefs = new Set(sampleProject.site.knowledgeBase.sources.map((source) => source.ref))

    expect(sampleProject.site.knowledgeBase.geotechnical).toMatchObject({
      weakBearingToApproxM: 4,
      groundwaterRangeM: [1.6, 2.3],
    })
    expect(sampleProject.site.knowledgeBase.geotechnical.boreholes).toHaveLength(2)
    expect(sampleProject.climateProfile.soil.ph).toBeNull()
    expect(sampleProject.site.knowledgeBase.measurements.every((measurement) => sourceRefs.has(measurement.sourceRef))).toBe(true)
    expect(sampleProject.site.knowledgeBase.designRules.every((rule) => sourceRefs.has(rule.sourceRef))).toBe(true)
    expect(sampleProject.site.knowledgeBase.planting.recommendations.every((plant) => plant.sourceRefs.every((ref) => sourceRefs.has(ref)))).toBe(true)
    expect(sampleProject.site.knowledgeBase.planting.recommendations.filter((plant) => plant.priority === 'best-fit')).toHaveLength(9)
    expect(sampleProject.site.knowledgeBase.planting.recommendations.filter((plant) => plant.category === 'fruit-shrub').map((plant) => plant.commonName)).toEqual(["Blackcurrant 'Ben Alder'", 'Black chokeberry', 'Common elder'])
    expect(sampleProject.site.knowledgeBase.planting.recommendations.filter((plant) => plant.category === 'vegetable').map((plant) => plant.commonName)).toEqual(['Tomato', 'Potato', 'Cucumber'])
    expect(sampleProject.site.knowledgeBase.planting.recommendations.filter((plant) => plant.category === 'fruit-tree').map((plant) => plant.commonName)).toEqual(['Apple tree', 'Sour cherry', 'European pear', 'European plum'])
    expect(sampleProject.site.knowledgeBase.planting.soilAnalysis.findings.map((finding) => finding.label)).toEqual(['Surface layer', 'Subsoil texture', 'Deep organic layers', 'Groundwater', 'pH and fertility'])
    expect(sampleProject.site.knowledgeBase.planting.soilAnalysis.testsNeeded).toHaveLength(4)
    expect(validateProject(sampleProject).filter((issue) => issue.severity === 'error')).toEqual([])
  })
})
