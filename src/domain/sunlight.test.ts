import { describe, expect, it } from 'vitest'
import { applyCommand, validateProject } from './commands'
import { modernBarnProject, partialUpperModernBarnProject, sampleProject } from './sampleProject'
import { analyzeSunlight, collectOccluders, isLitAt } from './sunlight'
import type { BuildingModel, ProjectV2 } from './types'

/** A north-up site with one long east-west wall and nothing else casting shadow. */
const wallOnlyProject = (heightM = 3, lengthM = 6): ProjectV2 => {
  const project = structuredClone(sampleProject)
  project.site.northDegrees = 0
  project.landscape.plants = []; project.landscape.fixtures = []
  const building: BuildingModel = {
    ref: 'house/wall', name: 'Wall', kind: 'house', architecturalStyle: 'classic', position: { x: 0, z: 0 }, rotationDegrees: 0,
    storeys: [{ ref: 'storey/w', name: 'Ground', level: 0, elevationM: 0, clearHeightM: heightM, baseSlabRef: 'slab/w', topBoundaryRef: 'roof/w', wallRefs: ['wall/w'], spaceRefs: [], platformRefs: [], ceilingFinishRefs: [] }],
    slabs: [{ ref: 'slab/w', footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], topElevationM: 0, thicknessM: 0.1, locked: false }],
    walls: [{ ref: 'wall/w', start: { x: -lengthM / 2, z: 0 }, end: { x: lengthM / 2, z: 0 }, thicknessM: 0.2, baseElevationM: 0, heightM, openings: [], locked: false }],
    spaces: [], platforms: [], ceilingFinishes: [],
    roof: {
      ref: 'roof/w', type: 'flat', baseElevationM: 0, pitchDegrees: 0, overhangM: 0, footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], finish: { material: 'membrane', colorHex: '#333333' },
      segments: [{ ref: 'roof/w/segment-main', footprint: [{ x: -0.1, z: -0.1 }, { x: 0.1, z: -0.1 }, { x: 0.1, z: 0.1 }, { x: -0.1, z: 0.1 }], storeyRef: 'storey/w', baseElevationM: 0, type: 'flat', pitchDegrees: 0, overhangM: 0, ridgeDirection: 'z', finish: { material: 'membrane', colorHex: '#333333' }, adjacentSegmentRefs: [] }],
      junctions: [],
    },
  }
  project.buildings = [building]
  return project
}
const noon = { month: 6, day: 21, hour: 12.7 }

describe('sunlight occluders', () => {
  it('includes the low conifer crown and the full 15 metre rounded crown in shading', () => {
    const project = wallOnlyProject()
    project.buildings = []
    project.site.terrain.elevationPoints.forEach((point) => { point.elevation = 0 })
    const tree = structuredClone(modernBarnProject.landscape.plants.find((plant) => plant.crownShape === 'conical')!)
    tree.position = { x: 0, z: 0 }
    project.landscape.plants = [tree]
    expect(isLitAt(project, collectOccluders(project), { x: 0, y: 0.3, z: 0 }, noon)).toBe(false)
    expect(isLitAt(project, collectOccluders(project), { x: 0, y: 15.1, z: 0 }, noon)).toBe(true)
    tree.crownShape = 'rounded'
    expect(isLitAt(project, collectOccluders(project), { x: 0, y: 14.9, z: 0 }, noon)).toBe(false)
    expect(isLitAt(project, collectOccluders(project), { x: 0, y: 15.1, z: 0 }, noon)).toBe(true)
  })
  it('collects walls, slabs, roof wings, canopies and fixtures from the barn project', () => {
    const occluders = collectOccluders(partialUpperModernBarnProject)
    const kinds = occluders.map((occluder) => occluder.ref.split('/')[0])
    expect(occluders).toHaveLength(15 + 2 + 2 + partialUpperModernBarnProject.landscape.plants.length + 6)
    expect(kinds.filter((kind) => kind === 'wall')).toHaveLength(15)
    expect(occluders.filter((occluder) => occluder.ref.startsWith('plant/'))).toHaveLength(partialUpperModernBarnProject.landscape.plants.length)
  })

  it('shades the north side of an east-west wall at solar noon and lights the south side', () => {
    const project = wallOnlyProject()
    const occluders = collectOccluders(project)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: 1 }, noon)).toBe(false)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: -1 }, noon)).toBe(true)
    expect(isLitAt(project, occluders, { x: 0, y: 0.3, z: 6 }, noon)).toBe(true)
  })

  it('lets a rotated building shade with its own orientation', () => {
    const project = wallOnlyProject()
    project.buildings[0].rotationDegrees = 90
    const occluders = collectOccluders(project)
    expect(isLitAt(project, occluders, { x: 1, y: 0.3, z: 1 }, noon)).toBe(true)
    expect(isLitAt(project, occluders, { x: -1, y: 0.3, z: 0 }, { month: 6, day: 21, hour: 9 })).toBe(true)
    expect(isLitAt(project, occluders, { x: 1, y: 0.3, z: 0 }, { month: 6, day: 21, hour: 9 })).toBe(false)
  })
})

describe('sun-hours analysis', () => {
  it('moves the tree shadow when the modeled height changes to 15 metres', () => {
    const project = wallOnlyProject()
    project.buildings = []
    project.site.terrain.elevationPoints = [{ x: 0, z: 0, elevation: 0 }]
    project.landscape.plants = [{ ...structuredClone(sampleProject.landscape.plants[0]), position: { x: 0, z: 0 }, matureHeightM: 5, canopyM: 5, locked: false }]
    const point = { x: 0, y: 0.3, z: 5.3 }
    const time = { month: 6, day: 21, hour: 12.7 }
    expect(isLitAt(project, collectOccluders(project), point, time)).toBe(true)
    const taller = applyCommand(project, { type: 'plant.update', action: 'set-height', plantRef: project.landscape.plants[0].ref, matureHeightM: 15 })
    expect(isLitAt(taller, collectOccluders(taller), point, time)).toBe(false)
  })
  it('gives a point north of a tall wall fewer hours than a point in the open, deterministically', () => {
    const project = wallOnlyProject(10, 40)
    const shaded = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, stepMinutes: 30 })
    const open = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: -30 }, month: 6, day: 21, stepMinutes: 30 })
    expect(shaded.sunHours.mean).toBeLessThan(open.sunHours.mean)
    expect(open.sunHours.mean).toBeCloseTo(open.daylightHours, 0)
    expect(shaded.sunHours.mean).toBeLessThan(open.sunHours.mean * 0.55)
    expect(shaded.sunHours.mean).toBeGreaterThan(0)
    expect(analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, stepMinutes: 30 })).toEqual(shaded)
  })

  it('reports sunrise, sunset and an expected value scaled by the climate sunshine ratio', () => {
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/lawn' }, month: 6, day: 21 })
    expect(result.sunriseLocal).toBeCloseTo(4.51, 1)
    expect(result.sunsetLocal).toBeCloseTo(20.9, 1)
    const sunshine = modernBarnProject.climateProfile.months[5].sunshineHours
    expect(result.expectedSunHours).toBeCloseTo(result.sunHours.mean * sunshine / (result.daylightHours * 30.44), 1)
    expect(result.sampleCount).toBeGreaterThan(50)
    expect(result.grid).toBeUndefined()
  })

  it('returns a compact grid whose cells outside the zone are marked -1', () => {
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/rain-garden' }, month: 6, day: 21, cellM: 0.5, includeGrid: true })
    expect(result.grid).toBeDefined()
    expect(result.grid!.hours).toHaveLength(result.grid!.width * result.grid!.height)
    expect(result.grid!.hours.every((value) => value === -1 || (value >= 0 && value <= result.daylightHours))).toBe(true)
    expect(result.grid!.hours.filter((value) => value >= 0)).toHaveLength(result.sampleCount)
  })

  it('shows the upper-storey extension taking morning sun from the courtyard terrace', () => {
    const source = structuredClone(partialUpperModernBarnProject)
    source.landscape.plants = [] // Isolate the roof extension from the surveyed tree row's shade.
    const extended = applyCommand(source, {
      type: 'storey.update', action: 'extend-footprint', buildingRef: 'house/main', storeyRef: 'house/main/storey-upper',
      extensionFootprint: [{ x: -8, z: -5 }, { x: 8, z: -5 }, { x: 8, z: 1 }, { x: -2, z: 1 }, { x: -8, z: 1 }],
    })
    const before = analyzeSunlight(source, { target: { kind: 'zone', ref: 'zone/terrace' }, month: 9, day: 21 })
    const after = analyzeSunlight(extended, { target: { kind: 'zone', ref: 'zone/terrace' }, month: 9, day: 21 })
    expect(after.sunHours.mean).toBeLessThan(before.sunHours.mean)
  })

  it('restricts sampling to a local-time window when asked', () => {
    const project = wallOnlyProject(10, 40)
    const core = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: 1 }, month: 6, day: 21, hours: { from: 9, to: 17 } })
    expect(core.window).toEqual({ fromLocal: 9, toLocal: 17 })
    expect(core.sunHours.mean).toBe(0)
    const open = analyzeSunlight(project, { target: { kind: 'point', x: 0, z: -30 }, month: 6, day: 21, hours: { from: 9, to: 17 } })
    expect(open.sunHours.mean).toBeCloseTo(8, 1)
  })

  it('stays within the time budget for a fine grid over the lawn', () => {
    const started = performance.now()
    const result = analyzeSunlight(modernBarnProject, { target: { kind: 'zone', ref: 'zone/lawn' }, month: 6, day: 21, cellM: 0.2, stepMinutes: 30 })
    expect(result.sampleCount).toBeGreaterThan(1500)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})

describe('planting sun-mismatch validation', () => {
  it('warns about a crop bed hidden behind a tall wall and not about one in the open', () => {
    const project = wallOnlyProject(10, 40)
    const shadedBed = applyCommand(applyCommand(project,
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/shaded-bed', catalogId: 'raised-bed-2x1', position: { x: 0, z: 1.2 } }),
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/shaded-crop', catalogId: 'tomato-row', position: { x: 0, z: 1.2 } })
    expect(validateProject(shadedBed)).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'planting.sun-mismatch', subjectRef: 'fixture/shaded-crop' }))
    const openBed = applyCommand(applyCommand(project,
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/open-bed', catalogId: 'raised-bed-2x1', position: { x: 0, z: -20 } }),
      { type: 'garden-fixture.update', action: 'add', fixtureRef: 'fixture/open-crop', catalogId: 'potato-row', position: { x: 0, z: -20 } })
    expect(validateProject(openBed).filter((issue) => issue.code === 'planting.sun-mismatch')).toEqual([])
  })

  it('reveals extra shade in the original garden when the mapped trees are included', () => {
    // Retain the original regression scene independently of the current house-placement preset.
    const original = structuredClone(modernBarnProject)
    original.buildings[0].position = { x: 0, z: -1 }
    original.buildings[0].rotationDegrees = 0
    const withoutSurvey = structuredClone(original)
    withoutSurvey.landscape.plants = withoutSurvey.landscape.plants.filter((plant) => !plant.surveyHandle)
    expect(validateProject(withoutSurvey).filter((issue) => issue.code === 'planting.sun-mismatch')).toEqual([])
    const warnings = validateProject(original).filter((issue) => issue.code === 'planting.sun-mismatch')
    expect(warnings.length).toBeGreaterThan(0)
    const mappedRefs = new Set(original.landscape.plants.filter((plant) => plant.surveyHandle).map((plant) => plant.ref))
    expect(warnings.every((issue) => !mappedRefs.has(issue.subjectRef!))).toBe(true)
    expect(warnings.some((issue) => original.landscape.fixtures.some((fixture) => fixture.ref === issue.subjectRef))).toBe(true)
  })

  it('still checks proposed planting while excluding mapped trees at the same shaded location', () => {
    const project = wallOnlyProject(10, 40)
    const mapped = structuredClone(modernBarnProject.landscape.plants.find((plant) => plant.surveyHandle)!)
    mapped.position = { x: 0, z: 1.2 }
    const proposed = { ...mapped, ref: 'plant/proposed', surveyHandle: undefined }
    project.landscape.plants = [mapped, proposed]
    const warnings = validateProject(project).filter((issue) => issue.code === 'planting.sun-mismatch')
    expect(warnings.map((issue) => issue.subjectRef)).toEqual([proposed.ref])
    expect(collectOccluders(project).some((occluder) => occluder.ref === mapped.ref)).toBe(true)
  })
})
