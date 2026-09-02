import { describe, expect, it } from 'vitest'
import { polygonArea, validateProject } from './commands'
import { sampleProject } from './sampleProject'

describe('Zielonki demo dataset', () => {
  it('keeps the official post-division areas and surveyed construction geometry aligned', () => {
    const construction = sampleProject.plot.parcels.filter((parcel) => parcel.landRole === 'construction')
    const agricultural = sampleProject.plot.parcels.filter((parcel) => parcel.landRole === 'agricultural')

    expect(construction.map((parcel) => parcel.cadastralNumber)).toEqual(['54/3', '55/3', '58/3'])
    expect(agricultural.map((parcel) => parcel.cadastralNumber)).toEqual(['54/4', '55/4', '58/4'])
    expect(construction.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)).toBe(1200)
    expect(agricultural.reduce((sum, parcel) => sum + parcel.officialAreaM2, 0)).toBe(4009)
    expect(construction.every((parcel) => parcel.geometryConfidence === 'surveyed')).toBe(true)
    expect(agricultural.every((parcel) => parcel.geometryConfidence === 'context-only')).toBe(true)

    for (const parcel of construction) {
      expect(polygonArea(parcel.boundary)).toBeCloseTo(parcel.officialAreaM2, 0)
    }
    expect(polygonArea(sampleProject.plot.boundary)).toBeCloseTo(1200, 0)
  })

  it('exposes concise, source-linked ground knowledge without inventing missing soil data', () => {
    const sourceRefs = new Set(sampleProject.knowledgeBase.sources.map((source) => source.ref))

    expect(sampleProject.knowledgeBase.geotechnical).toMatchObject({
      weakBearingToApproxM: 4,
      groundwaterRangeM: [1.6, 2.3],
    })
    expect(sampleProject.knowledgeBase.geotechnical.boreholes).toHaveLength(2)
    expect(sampleProject.climateProfile.soil.ph).toBeNull()
    expect(sampleProject.knowledgeBase.measurements.every((measurement) => sourceRefs.has(measurement.sourceRef))).toBe(true)
    expect(sampleProject.knowledgeBase.designRules.every((rule) => sourceRefs.has(rule.sourceRef))).toBe(true)
    expect(sampleProject.knowledgeBase.planting.recommendations.every((plant) => plant.sourceRefs.every((ref) => sourceRefs.has(ref)))).toBe(true)
    expect(sampleProject.knowledgeBase.planting.recommendations.filter((plant) => plant.priority === 'best-fit')).toHaveLength(6)
    expect(validateProject(sampleProject)).toContainEqual(expect.objectContaining({ code: 'site.geotechnical-review', severity: 'warning' }))
  })
})
