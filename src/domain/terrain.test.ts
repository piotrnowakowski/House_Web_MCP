import { describe, expect, it } from 'vitest'
import { calculateMetrics, validateProject } from './commands'
import { polygonArea } from './geometry'
import { knowledgeSections, knowledgeSlice } from './refs'
import { sampleProject } from './sampleProject'
import { ProjectSchema } from './schema'
import { analyzeSeason } from './seasonal'
import { sunriseSunset } from './solar'
import { TerrainInputSchema, ZIELONKI_PROJECT_REF, createTerrainProject, isZielonkiProject, type TerrainInput } from './terrain'

const input: TerrainInput = { name: 'Test plot', widthM: 30, depthM: 40, northDegrees: 15, latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw' }
const fixedNow = new Date('2026-09-04T08:00:00.000Z')

describe('new terrain projects', () => {
  it('builds a schema-valid, empty plot of the requested size from the form input', () => {
    const project = createTerrainProject(input, fixedNow)
    expect(ProjectSchema.safeParse(project).success).toBe(true)
    expect(project.name).toBe('Test plot')
    expect(project.ref).toMatch(/^project\/terrain-test-plot-/)
    expect(project.revision).toBe(1)
    expect(project.updatedAt).toBe(fixedNow.toISOString())
    expect(project.site.boundary).toHaveLength(4)
    const xs = project.site.boundary.map((point) => point.x); const zs = project.site.boundary.map((point) => point.z)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(40)
    expect(polygonArea(project.site.boundary)).toBeCloseTo(1200)
    expect(project.site.terrain.boundary).toEqual(project.site.boundary)
    expect(project.site.terrain.elevationPoints.every((point) => point.elevation === 0)).toBe(true)
    expect(project.site.northDegrees).toBe(15)
    expect(project.site.parcels).toHaveLength(1)
    expect(project.site.parcels[0]).toMatchObject({ landRole: 'construction', officialAreaM2: 1200, geometryConfidence: 'derived' })
    expect(project.site.entrances).toEqual([])
    expect(project.buildings).toEqual([])
    expect(project.landscape.zones).toEqual([])
    expect(project.landscape.plants).toEqual([])
    expect(project.landscape.fixtures).toEqual([])
    expect(project.landscape.fixtureCatalogVersion).toBeGreaterThan(0)
  })

  it('takes the entered coordinates for the sun and keeps the bundled climate normal, labelled as such', () => {
    const project = createTerrainProject(input, fixedNow)
    expect(project.climateProfile).toMatchObject({ latitude: 52.23, longitude: 21.01, timezone: 'Europe/Warsaw' })
    expect(project.climateProfile.months).toHaveLength(12)
    expect(project.climateProfile.months).toEqual(sampleProject.climateProfile.months)
    expect(project.climateProfile.name).toContain('Test plot')
    expect(project.climateProfile.name).toContain('Zielonki climate normal')
    expect(project.climateProfile.provenance).toMatch(/copied from the bundled Zielonki/)
    expect(project.climateProfile.ref).not.toBe(sampleProject.climateProfile.ref)
    const equator = createTerrainProject({ ...input, latitude: 0, longitude: 0, timezone: 'UTC' }, fixedNow)
    const daylight = sunriseSunset({ latitude: 0, longitude: 0, timezone: equator.climateProfile.timezone }, { month: 6, day: 21, hour: 12 })
    expect(daylight?.daylightHours).toBeGreaterThan(11.5)
    expect(daylight?.daylightHours).toBeLessThan(12.6)
    const paris = createTerrainProject({ ...input, latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' }, fixedNow)
    const [june, december] = analyzeSeason(paris, [6, 12])
    expect(june.daylightHours).toBeGreaterThan(15.5)
    expect(december.daylightHours).toBeLessThan(9)
  })

  it('carries an honest, empty knowledge base that every knowledge tool can read', () => {
    const project = createTerrainProject(input, fixedNow)
    const bank = project.site.knowledgeBase
    expect(bank.locality).toBe('Test plot')
    expect(bank.sources).toEqual([])
    expect(bank.measurements).toEqual([])
    expect(bank.geotechnical.boreholes).toEqual([])
    expect(bank.planting.recommendations).toEqual([])
    expect(bank.planting.soilAnalysis.findings).toEqual([])
    expect(bank.planting.soilAnalysis.summary).toMatch(/No soil analysis/)
    expect(bank.planting.soilAnalysis.testsNeeded.length).toBeGreaterThan(0)
    expect(bank.caveats.length).toBeGreaterThan(0)
    expect(knowledgeSlice(project)).toMatchObject({ locality: 'Test plot', sectionCounts: { sources: 0, boreholes: 0, plantingRecommendations: 0 } })
    for (const section of knowledgeSections) expect(() => knowledgeSlice(project, section)).not.toThrow()
  })

  it('validates and measures as an empty site', () => {
    const project = createTerrainProject(input, fixedNow)
    expect(validateProject(project).filter((issue) => issue.severity === 'error')).toEqual([])
    expect(calculateMetrics(project)).toMatchObject({ homeAreaM2: 0, plantCount: 0, fixtureCount: 0 })
  })

  it('rejects impossible form values before a project is built', () => {
    expect(TerrainInputSchema.safeParse(input).success).toBe(true)
    expect(TerrainInputSchema.safeParse({ ...input, widthM: 2 }).success).toBe(false)
    expect(TerrainInputSchema.safeParse({ ...input, depthM: 800 }).success).toBe(false)
    expect(TerrainInputSchema.safeParse({ ...input, latitude: 95 }).success).toBe(false)
    expect(TerrainInputSchema.safeParse({ ...input, timezone: '' }).success).toBe(false)
    expect(TerrainInputSchema.safeParse({ ...input, timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(TerrainInputSchema.safeParse({ ...input, name: '' }).success).toBe(false)
  })

  it('tells the bundled Zielonki study apart from user terrains', () => {
    expect(ZIELONKI_PROJECT_REF).toBe('project/zielonki-spatial-v2')
    expect(isZielonkiProject(sampleProject)).toBe(true)
    expect(isZielonkiProject(createTerrainProject(input, fixedNow))).toBe(false)
  })
})
