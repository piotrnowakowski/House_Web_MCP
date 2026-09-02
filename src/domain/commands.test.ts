import { describe, expect, it } from 'vitest'
import { applyCommand, calculateMetrics, polygonArea, validateProject } from './commands'
import { modernBarnProject, sampleProject } from './sampleProject'
import { ProjectSchema } from './schema'

describe('ProjectV2 command bus', () => {
  it('keeps the bundled V2 model valid and measurable', () => {
    expect(ProjectSchema.safeParse(sampleProject).success).toBe(true)
    expect(polygonArea(sampleProject.site.boundary)).toBeGreaterThan(1_000)
    expect(calculateMetrics(sampleProject)).toMatchObject({ homeAreaM2: 108, spaceCount: 2, plantCount: 4 })
    expect(validateProject(sampleProject).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('adds an upper storey with one slab shared by adjacent storeys without mutating the source', () => {
    const result = applyCommand(sampleProject, { type: 'storey.update', action: 'add', buildingRef: 'house/main', storeyRef: 'storey/upper-test', name: 'Upper storey', clearHeightM: 2.9 })
    const lower = result.buildings[0].storeys[0]; const upper = result.buildings[0].storeys[1]
    expect(sampleProject.buildings[0].storeys).toHaveLength(1)
    expect(upper).toMatchObject({ ref: 'storey/upper-test', level: 1, clearHeightM: 2.9 })
    expect(lower.topBoundaryRef).toBe(upper.baseSlabRef)
    expect(result.buildings[0].spaces.find((space) => lower.spaceRefs.includes(space.ref))?.topBoundaryRef).toBe(upper.baseSlabRef)
    expect(result.buildings[0].walls.filter((wall) => upper.wallRefs.includes(wall.ref)).every((wall) => wall.baseElevationM === upper.elevationM)).toBe(true)
  })

  it('applies the modern barn roof geometry with the barn style', () => {
    const result = applyCommand(sampleProject, { type: 'building.update', action: 'set-style', buildingRef: 'house/main', architecturalStyle: 'barn' })
    expect(result.buildings[0]).toMatchObject({ architecturalStyle: 'barn', roof: { type: 'gable', pitchDegrees: 45, overhangM: 0.3 } })
  })

  it('ships the selectable modern barn preset as two levels without moving the house', () => {
    expect(modernBarnProject.buildings[0]).toMatchObject({
      architecturalStyle: 'barn',
      position: sampleProject.buildings[0].position,
      roof: { type: 'gable', pitchDegrees: 45, overhangM: 0.3 },
    })
    expect(modernBarnProject.buildings[0].storeys).toHaveLength(2)
    expect(calculateMetrics(modernBarnProject).homeAreaM2).toBe(216)
    expect(calculateMetrics(modernBarnProject).fixtureCount).toBe(6)
    expect(modernBarnProject.landscape.fixtures.map((fixture) => fixture.catalogId)).toEqual(['raised-bed-2x1', 'tomato-row', 'raised-bed-2x1', 'potato-row', 'raised-bed-2x1', 'cucumber-trellis'])
    expect(validateProject(modernBarnProject).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('adds and moves a semantic garden fixture without mutating the source', () => {
    const added = applyCommand(sampleProject, { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/test-bed', catalogId: 'raised-bed-2x1', position: { x: 8.4, z: 5.5 } })
    const moved = applyCommand(added, { type: 'garden-fixture.update', action: 'move', fixtureRef: 'fixture/test-bed', position: { x: 9, z: 6 } })
    expect(sampleProject.landscape.fixtures).toHaveLength(0)
    expect(moved.landscape.fixtures[0]).toMatchObject({ ref: 'fixture/test-bed', catalogId: 'raised-bed-2x1', position: { x: 9, z: 6 } })
    expect(validateProject(moved).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('moves the one intermediate slab used as both floor and ceiling', () => {
    const withUpper = applyCommand(sampleProject, { type: 'storey.update', action: 'add', buildingRef: 'house/main', storeyRef: 'storey/upper' })
    const slabRef = withUpper.buildings[0].storeys[1].baseSlabRef
    const moved = applyCommand(withUpper, { type: 'slab.update', action: 'set-elevation', buildingRef: 'house/main', slabRef, topElevationM: 3.6 })
    expect(moved.buildings[0].storeys[0].topBoundaryRef).toBe(slabRef)
    expect(moved.buildings[0].storeys[1].baseSlabRef).toBe(slabRef)
    expect(moved.buildings[0].slabs.find((slab) => slab.ref === slabRef)?.topElevationM).toBe(3.6)
    expect(moved.buildings[0].storeys[1].elevationM).toBe(3.6)
    expect(moved.buildings[0].storeys[0].clearHeightM).toBe(3.15)
  })

  it('keeps lowered ceilings as linked finish elements', () => {
    const result = applyCommand(sampleProject, { type: 'space.update', action: 'set-lowered-ceiling', buildingRef: 'house/main', storeyRef: 'storey/ground', spaceRef: 'space/living', ceilingElevationM: 3.1 })
    expect(result.buildings[0].ceilingFinishes[0]).toMatchObject({ spaceRef: 'space/living', hostBoundaryRef: 'roof/main', elevationM: 3.1 })
    expect(result.buildings[0].spaces.find((space) => space.ref === 'space/living')?.topBoundaryRef).toBe('roof/main')
  })

  it('rejects self-intersecting space polygons and out-of-wall openings', () => {
    const bowTie = applyCommand(sampleProject, { type: 'space.update', action: 'set-footprint', buildingRef: 'house/main', storeyRef: 'storey/ground', spaceRef: 'space/living', footprint: [{ x: 0, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }, { x: 3, z: 0 }] })
    expect(validateProject(bowTie)).toContainEqual(expect.objectContaining({ code: 'space.polygon', severity: 'error' }))
    const opening = applyCommand(sampleProject, { type: 'opening.update', action: 'add', buildingRef: 'house/main', wallRef: 'wall/west', openingRef: 'opening/invalid', offsetM: 0.1, widthM: 2 })
    expect(validateProject(opening)).toContainEqual(expect.objectContaining({ code: 'opening.bounds', severity: 'error' }))
  })

  it('rejects V1 and curved point payloads at the clean schema boundary', () => {
    expect(ProjectSchema.safeParse({ ...structuredClone(sampleProject), schemaVersion: 1 }).success).toBe(false)
    const curved = structuredClone(sampleProject) as unknown as Record<string, unknown>
    const site = curved.site as { boundary: Array<Record<string, unknown>> }; site.boundary[0].curve = 'arc'
    expect(ProjectSchema.safeParse(curved).success).toBe(false)
  })

  it('keeps the four day-part averages aligned when a monthly range changes', () => {
    const result = applyCommand(sampleProject, { type: 'climate.update', month: 1, values: { meanMinC: -6, meanMaxC: 4 } })
    expect(result.climateProfile.months[0].temperatureByDayPartC).toEqual({ night: -5.2, morning: -1.8, day: 2.8, evening: -0.4 })
    expect(sampleProject.climateProfile.months[0].meanMinC).toBe(-4.2)
  })

  it('hydrates day-part averages for an earlier ProjectV2 autosave', () => {
    const earlierV2 = structuredClone(sampleProject) as unknown as { climateProfile: { months: Array<Record<string, unknown>> } }
    delete earlierV2.climateProfile.months[0].temperatureByDayPartC
    expect(ProjectSchema.parse(earlierV2).climateProfile.months[0].temperatureByDayPartC).toEqual({ night: -3.7, morning: -1.6, day: 1.3, evening: -0.7 })
  })

  it('hydrates planting categories and soil guidance for an earlier ProjectV2 autosave', () => {
    const earlierV2 = structuredClone(sampleProject) as unknown as { site: { knowledgeBase: { planting: { soilAnalysis?: unknown; recommendations: Array<Record<string, unknown>> } } } }
    delete earlierV2.site.knowledgeBase.planting.soilAnalysis
    delete earlierV2.site.knowledgeBase.planting.recommendations[0].category
    const parsed = ProjectSchema.parse(earlierV2)
    expect(parsed.site.knowledgeBase.planting.soilAnalysis.testsNeeded.length).toBeGreaterThan(0)
    expect(parsed.site.knowledgeBase.planting.recommendations[0].category).toBe('structure')
  })

  it('hydrates an empty fixture collection for an earlier ProjectV2 autosave', () => {
    const earlierV2 = structuredClone(sampleProject) as unknown as { landscape: Record<string, unknown> }
    delete earlierV2.landscape.fixtures; delete earlierV2.landscape.fixtureCatalogVersion
    const parsed = ProjectSchema.parse(earlierV2)
    expect(parsed.landscape.fixtures).toEqual([])
    expect(parsed.landscape.fixtureCatalogVersion).toBe(0)
  })
})
