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

  it('ships the selectable modern barn preset as a valid two-level L-shaped house', () => {
    expect(modernBarnProject.buildings[0]).toMatchObject({
      architecturalStyle: 'barn',
      position: { x: 0, z: -1 },
      roof: { type: 'gable', pitchDegrees: 45, overhangM: 0.42 },
    })
    expect(modernBarnProject.buildings[0].storeys).toHaveLength(2)
    expect(modernBarnProject.buildings[0].slabs[0].footprint).toHaveLength(6)
    expect(calculateMetrics(modernBarnProject).homeAreaM2).toBe(204)
    expect(calculateMetrics(modernBarnProject).fixtureCount).toBe(6)
    expect(modernBarnProject.landscape.fixtures.map((fixture) => fixture.catalogId)).toEqual(['raised-bed-2x1', 'tomato-row', 'raised-bed-2x1', 'potato-row', 'raised-bed-2x1', 'cucumber-trellis'])
    expect(validateProject(modernBarnProject).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('extends the existing upper barn storey over the 16 × 6 m wing atomically', () => {
    const result = applyCommand(modernBarnProject, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
      spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living',
    })
    const building = result.buildings[0]; const upper = building.storeys.find((storey) => storey.ref === 'house/main/storey-upper')!
    const slab = building.slabs.find((item) => item.ref === upper.baseSlabRef)!
    expect(modernBarnProject.buildings[0].storeys).toHaveLength(2)
    expect(building.storeys).toHaveLength(2)
    expect(polygonArea(slab.footprint)).toBe(150)
    expect(calculateMetrics(result).homeAreaM2).toBe(300)
    expect(building.roof.footprint).toEqual(slab.footprint)
    expect(upper.spaceRefs).toContain('house/main/storey-upper/space-wing')
    expect(building.walls.find((wall) => wall.ref === 'wall/upper-east')?.openings).toHaveLength(2)
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('decomposes a complete concave upper-storey footprint into perpendicular roof wings', () => {
    const starting = structuredClone(modernBarnProject)
    const building = starting.buildings[0]
    building.roof.segments = [structuredClone(building.roof.segments.find((segment) => segment.ref === 'roof/main/segment-upper-wing')!)]
    building.roof.junctions = []
    const completeFootprint = structuredClone(building.slabs[0].footprint)
    const result = applyCommand(starting, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper', footprint: completeFootprint,
      spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living',
    })
    const roof = result.buildings[0].roof
    expect(roof.segments).toHaveLength(2)
    expect(roof.segments.map((segment) => segment.ridgeDirection)).toEqual(expect.arrayContaining(['z', 'x']))
    expect(roof.segments.every((segment) => Math.abs(segment.baseElevationM - 6.55) < 0.001 && segment.finish.colorHex === '#2D3435')).toBe(true)
    expect(roof.segments.find((segment) => segment.ridgeDirection === 'x')?.spaceRef).toBe('house/main/storey-upper/space-wing')
    expect(roof.junctions).toEqual([expect.objectContaining({ type: 'valley', segmentRefs: expect.arrayContaining(roof.segments.map((segment) => segment.ref)) })])
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('atomically splits a malformed L-shaped roof segment into two declared gables', () => {
    const extended = applyCommand(modernBarnProject, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
      spaceRef: 'house/main/storey-upper/space-wing', spaceName: 'Upper wing', usage: 'living',
    })
    const malformed = structuredClone(extended); const roof = malformed.buildings[0].roof; const source = structuredClone(roof.segments[0])
    roof.segments = [{ ...source, ref: 'roof/main/segment-main', footprint: structuredClone(roof.footprint!), spaceRef: 'house/main/storey-upper/space-main', ridgeDirection: 'z', adjacentSegmentRefs: [] }]
    roof.junctions = []
    const result = applyCommand(malformed, {
      type: 'roof.update', action: 'split-segment', buildingRef: 'house/main', segmentRef: 'roof/main/segment-main',
      segments: [
        { segmentRef: 'roof/main/segment-original-wing', footprint: [{ x: -8, z: 1 }, { x: -2, z: 1 }, { x: -2, z: 10 }, { x: -8, z: 10 }], ridgeDirection: 'z', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-main' },
        { segmentRef: 'roof/main/segment-extended-wing', footprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -8, z: 1 }], ridgeDirection: 'x', storeyRef: 'house/main/storey-upper', spaceRef: 'house/main/storey-upper/space-wing' },
      ],
      junctions: [{ ref: 'roof/main/junction-original-extended', type: 'valley', segmentRefs: ['roof/main/segment-original-wing', 'roof/main/segment-extended-wing'] }],
    })
    const repaired = result.buildings[0].roof
    expect(repaired.segments).toHaveLength(2)
    expect(repaired.segments.map((segment) => ({ ref: segment.ref, ridgeDirection: segment.ridgeDirection, baseElevationM: segment.baseElevationM, finish: segment.finish }))).toEqual([
      { ref: 'roof/main/segment-original-wing', ridgeDirection: 'z', baseElevationM: 6.55, finish: { material: 'standing-seam-metal', colorHex: '#2D3435' } },
      { ref: 'roof/main/segment-extended-wing', ridgeDirection: 'x', baseElevationM: 6.55, finish: { material: 'standing-seam-metal', colorHex: '#2D3435' } },
    ])
    expect(repaired.junctions).toEqual([{ ref: 'roof/main/junction-original-extended', type: 'valley', segmentRefs: ['roof/main/segment-original-wing', 'roof/main/segment-extended-wing'] }])
    expect(repaired.segments[0].adjacentSegmentRefs).toEqual(['roof/main/segment-extended-wing'])
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('raises and restyles one semantic roof segment without changing its neighbour', () => {
    const originalUpper = modernBarnProject.buildings[0].roof.segments.find((segment) => segment.ref === 'roof/main/segment-upper-wing')!
    const result = applyCommand(modernBarnProject, {
      type: 'roof.update', buildingRef: 'house/main', segmentRef: 'roof/main/segment-rear-wing', alignToSegmentRef: originalUpper.ref, alignEdge: 'eaves',
      material: 'standing-seam-metal', colorHex: '#2D3435', synchronization: 'roof-and-supporting-walls',
    })
    const roof = result.buildings[0].roof; const rear = roof.segments.find((segment) => segment.ref === 'roof/main/segment-rear-wing')!; const upper = roof.segments.find((segment) => segment.ref === originalUpper.ref)!
    expect(rear).toMatchObject({ baseElevationM: originalUpper.baseElevationM, finish: { material: 'standing-seam-metal', colorHex: '#2D3435' } })
    expect(upper).toEqual(originalUpper)
    expect(validateProject(result).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('adds and moves a semantic garden fixture without mutating the source', () => {
    const added = applyCommand(sampleProject, { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/test-bed', catalogId: 'raised-bed-2x1', position: { x: 8.4, z: 5.5 } })
    const moved = applyCommand(added, { type: 'garden-fixture.update', action: 'move', fixtureRef: 'fixture/test-bed', position: { x: 9, z: 6 } })
    expect(sampleProject.landscape.fixtures).toHaveLength(0)
    expect(moved.landscape.fixtures[0]).toMatchObject({ ref: 'fixture/test-bed', catalogId: 'raised-bed-2x1', position: { x: 9, z: 6 } })
    expect(validateProject(moved).filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('reports a crop fixture separated from its linked raised bed', () => {
    const movedCrop = applyCommand(modernBarnProject, { type: 'garden-fixture.update', action: 'move', fixtureRef: 'fixture-set/starter-1/crop-tomato', position: { x: 8.4, z: 25.5 } })
    expect(validateProject(movedCrop)).toContainEqual(expect.objectContaining({ severity: 'error', code: 'fixture.crop-host', subjectRef: 'fixture-set/starter-1/crop-tomato' }))
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
